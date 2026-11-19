import { providerKey, providerLabel } from './providers.mjs'

export const CHANGE_KINDS = ['provider-added', 'model-removed', 'price', 'context', 'model-added']
export const CHANGE_NOTICE = '这里只比较模型目录与报价快照，不代表能力变化；下架指本次来源不再返回该条目。'

// OpenRouter prices arrive as long floats, so only a move above these thresholds counts.
const PRICE_REL = 0.05
const CONTEXT_REL = 0.02
const MAX_ITEMS = 40

const finite = value => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const rel = (from, to) => {
  if (from === null || to === null || from === 0) return null
  return (to - from) / Math.abs(from) * 100
}

function pricePair(model) {
  return { input: finite(model?.input), output: finite(model?.output) }
}

// A price move is judged per direction: a provider that cuts input while raising
// output is a mixed move, not the blended percentage the two would average to.
function fieldMove(from, to) {
  if (from === null && to === null) return null
  if (from === null || to === null) return { from, to, pct: null }
  const pct = rel(from, to)
  if (pct === null || Math.abs(pct) < PRICE_REL * 100) return null
  return { from, to, pct: Number(pct.toFixed(1)) }
}

const sum = pair => pair.input === null && pair.output === null ? null : (pair.input ?? 0) + (pair.output ?? 0)

function priceMove(before, after) {
  const input = fieldMove(before.input, after.input)
  const output = fieldMove(before.output, after.output)
  if (!input && !output) {
    const stopped = sum(before) !== null && sum(after) === null
    const started = sum(before) === null && sum(after) !== null
    if (!stopped && !started) return null
    return { from: before, to: after, fields: { input: null, output: null }, pct: null, direction: started ? 'started' : 'stopped' }
  }
  const signs = new Set([input, output].filter(Boolean).map(move => Math.sign(move.pct)))
  const direction = signs.size === 1 ? (signs.has(1) ? 'up' : 'down') : 'mixed'
  return { from: before, to: after, fields: { input, output }, pct: rel(sum(before), sum(after)) === null ? null : Number(rel(sum(before), sum(after)).toFixed(1)), direction }
}

export function diffSnapshots(prev, next) {
  if (!Array.isArray(prev?.models) || !Array.isArray(next?.models)) throw Error('需要两份完整模型目录')
  const before = new Map(prev.models.map(m => [m.id, m]))
  const after = new Map(next.models.map(m => [m.id, m]))
  const prevProviders = new Set(prev.models.map(m => providerKey(m.provider)))
  const seenProviders = new Set()
  const items = []

  for (const model of next.models) {
    const key = providerKey(model.provider)
    if (!prevProviders.has(key) && !seenProviders.has(key)) {
      seenProviders.add(key)
      items.push({ kind: 'provider-added', provider: model.provider, providerKey: key, label: providerLabel(model.provider), exampleId: model.id })
    }
  }
  for (const model of next.models) {
    const old = before.get(model.id)
    if (!old) {
      items.push({ kind: 'model-added', modelId: model.id, name: model.name, provider: model.provider, price: pricePair(model), context: finite(model.context) })
      continue
    }
    const move = priceMove(pricePair(old), pricePair(model))
    if (move) items.push({ kind: 'price', modelId: model.id, name: model.name, provider: model.provider, ...move })
    const context = rel(finite(old.context), finite(model.context))
    if (context !== null && Math.abs(context) >= CONTEXT_REL * 100) {
      items.push({ kind: 'context', modelId: model.id, name: model.name, provider: model.provider, from: finite(old.context), to: finite(model.context), pct: Number(context.toFixed(1)) })
    }
  }
  for (const model of prev.models) {
    if (!after.has(model.id)) items.push({ kind: 'model-removed', modelId: model.id, name: model.name, provider: model.provider })
  }

  const rank = kind => CHANGE_KINDS.indexOf(kind)
  const ordered = items.sort((a, b) => rank(a.kind) - rank(b.kind) || String(a.name || a.label).localeCompare(String(b.name || b.label)))
  return ordered
}

export function countKinds(items) {
  const counts = Object.fromEntries(CHANGE_KINDS.map(kind => [kind, 0]))
  for (const item of items) counts[item.kind] = (counts[item.kind] || 0) + 1
  return counts
}

export function buildChanges(prev, next, { maxItems = MAX_ITEMS } = {}) {
  const items = diffSnapshots(prev, next)
  const stats = countKinds(items)
  return {
    schemaVersion: 1,
    generatedAt: next.collectedAt,
    window: { from: prev.collectedAt, to: next.collectedAt },
    notice: CHANGE_NOTICE,
    stats,
    total: items.length,
    truncated: items.length > maxItems,
    items: items.slice(0, maxItems)
  }
}

const validItem = item => typeof item?.kind === 'string' && CHANGE_KINDS.includes(item.kind)

export function validChanges(changes) {
  if (!changes || changes.schemaVersion !== 1) return false
  if (!Number.isFinite(Date.parse(changes.generatedAt))) return false
  if (!Number.isFinite(Date.parse(changes.window?.from)) || !Number.isFinite(Date.parse(changes.window?.to))) return false
  if (Date.parse(changes.window.from) > Date.parse(changes.window.to)) return false
  if (!Array.isArray(changes.items) || !changes.items.every(validItem)) return false
  if (!Number.isInteger(changes.total) || changes.total < changes.items.length) return false
  return CHANGE_KINDS.every(kind => Number.isInteger(changes.stats?.[kind]))
}

export function hasChanges(changes) {
  return validChanges(changes) && changes.total > 0
}

// A rolling weekly window keeps the same content across collections, so unread is
// decided by the summary digest instead of its generation time.
export function changesDigest(changes) {
  if (!validChanges(changes)) return ''
  return [changes.window.from, changes.total, ...CHANGE_KINDS.map(kind => changes.stats[kind])].join(':')
}

export function isUnread(changes, lastSeenDigest) {
  if (!hasChanges(changes)) return false
  const digest = changesDigest(changes)
  return typeof lastSeenDigest === 'string' ? digest !== lastSeenDigest : true
}

// Only the fields the diff reads are kept, which keeps the baseline near 50KB.
export function catalogFingerprint(snapshot) {
  return {
    collectedAt: snapshot.collectedAt,
    models: snapshot.models.map(m => ({ id: m.id, name: m.name, provider: m.provider, input: finite(m.input), output: finite(m.output), context: finite(m.context) }))
  }
}

export function priceMoves(changes, direction) {
  if (!validChanges(changes)) return []
  return changes.items
    .filter(item => item.kind === 'price' && item.direction === direction && Number.isFinite(item.pct))
    .sort((a, b) => direction === 'down' ? a.pct - b.pct : b.pct - a.pct)
}

export function changesByProvider(changes) {
  const groups = new Map()
  for (const item of changes?.items || []) {
    const key = item.providerKey || providerKey(item.provider || '')
    if (!groups.has(key)) groups.set(key, { key, label: providerLabel(item.provider || key), items: [] })
    groups.get(key).items.push(item)
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label))
}
