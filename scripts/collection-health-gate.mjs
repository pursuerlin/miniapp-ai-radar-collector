import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const DATASET_TASKS = { catalog: 'catalog', usage: 'catalog', intelligence: 'intelligence', briefings: 'intelligence', media:'media',research:'research' }
const DATASET_LABELS = { catalog: '模型目录与报价', usage: 'Token 用量周榜', intelligence: 'AI 资讯', briefings: '每日与每周简报', evaluation: '能力评测', media:'生图与视频质量榜',research:'AIHOT 模型评测' }
const TASK_LABELS = { catalog: '模型目录与报价', intelligence: 'AI 资讯', aa: 'Artificial Analysis', livebench: 'LiveBench', media:'生图与视频质量榜',research:'AIHOT 模型评测' }

const collected = (health, task) => {
  const status = health?.collection?.tasks?.[task]?.status
  return Boolean(status) && status !== 'skipped'
}
const originsOf = dataset => dataset?.id === 'evaluation' ? ['aa', 'livebench'] : [DATASET_TASKS[dataset?.id] || dataset?.id]
// A problem can only be declared fixed by a run that collected the data behind it;
// otherwise a catalog-only round would "recover" every news source it never touched.
const collectable = (health, origins = []) => origins.some(origin => origin === 'editorial' || origin === 'health' || collected(health, origin))

// One stable key per problem, so two consecutive runs can be compared. Keys deliberately
// drop volatile detail (a row count) that changes while the same problem persists.
export function problemList(health) {
  const problems = []
  const editorial = health?.collection?.editorial
  if (editorial?.status === 'failed') problems.push({ key: `editorial:${editorial.code || 'failed'}`, label: '审核通道', code: editorial.code || 'FAILED', origins: ['editorial'] })
  if (Number.isInteger(editorial?.incomplete) && editorial.incomplete > 0) problems.push({ key: 'editorial:incomplete', label: '审核通道', code: `${editorial.incomplete} 条待补全`, origins: ['editorial'] })
  const tasks = health?.collection?.tasks
  const datasets = health?.datasets
  // Without this run's task list an inherited snapshot cannot be told apart from a fresh
  // failure; fall back to the published status, which is what the reader cares about.
  if (!tasks || !Array.isArray(datasets)) {
    if (health?.status !== 'healthy') problems.push({ key: `health:${health?.status || 'missing'}`, label: '数据状态', code: String(health?.status || 'missing').toUpperCase(), origins: ['health'] })
    return problems
  }
  for(const [id,state] of Object.entries(health.sourceHealth||{})){
    if(state.status==='stale')problems.push({key:`collection-source:${id}:stale`,label:TASK_LABELS[id]||id,code:state.errorCode||'STALE',origins:[id]})
    if(state.quality?.regressed)problems.push({key:`collection-source:${id}:coverage`,label:TASK_LABELS[id]||id,code:'DETAIL_COVERAGE_REGRESSED',origins:[id]})
    if(id==='media'&&state.quality?.partial)problems.push({key:'collection-source:media:partial',label:TASK_LABELS.media,code:'MEDIA_SUPPLEMENTS_PARTIAL',origins:['media']})
  }
  for (const [id, task] of Object.entries(tasks)) {
    if(health.sourceHealth?.[id])continue
    if (task?.status && task.status !== 'ok' && task.status !== 'skipped') {
      problems.push({ key: `task:${id}:${task.status}`, label: TASK_LABELS[id] || id, code: String(task.status).toUpperCase(), origins: [id] })
    }
  }
  if (collected(health, 'intelligence')) {
    for (const source of health?.intelligence?.sources || []) {
      if (source.status !== 'ok') problems.push({ key: `source:${source.id}:${source.errorCode || source.status}`, label: source.name || source.label || source.id, code: source.errorCode || String(source.status).toUpperCase(), origins: ['intelligence'], source })
    }
  }
  for (const dataset of datasets) {
    if (dataset?.freshness === 'stale') problems.push({ key: `dataset:${dataset.id}:stale`, label: dataset.label || DATASET_LABELS[dataset.id] || dataset.id, code: '超过 48 小时', origins: originsOf(dataset) })
    if (dataset?.id === 'evaluation') {
      for (const source of dataset.sources || []) {
        const task = source.id === 'livebench' ? 'livebench' : 'aa'
        if (!health.sourceHealth?.[task] && collected(health, task) && source.status !== 'ok') problems.push({ key: `board:${source.id}:${source.status}`, label: source.id === 'livebench' ? 'LiveBench' : 'Artificial Analysis', code: String(source.status).toUpperCase(), origins: [task] })
      }
      continue
    }
    const task = DATASET_TASKS[dataset?.id]
    if (task && collected(health, task) && dataset.status !== 'ok') {
      problems.push({ key: `dataset:${dataset.id}:${dataset.status}`, label: dataset.label || DATASET_LABELS[dataset.id] || dataset.id, code: String(dataset.status).toUpperCase(), origins: [task] })
    }
  }
  return problems
}

// Decides whether a completed run deserves a Feishu card. A broken review channel must
// alert even when every dataset is healthy, otherwise an approval silently does nothing.
// A skipped dataset keeps its previous status, so only a problem this run could have
// fixed belongs on a card; otherwise one failed source alerts again on every catalog run.
export function classifyHealth(health) {
  const editorial = health?.collection?.editorial
  const editorialNotice = editorial?.status === 'failed' || (Number.isInteger(editorial?.incomplete) && editorial.incomplete > 0)
  const problems = problemList(health)
  const degraded = problems.some(problem => !problem.origins.includes('editorial'))
  return { editorialNotice, degraded, inheritedOnly: !degraded && health?.status === 'degraded' }
}

// Alert on state changes, not on every run: a source broken for a day used to send a card
// on each news round. Comparing against the last published health needs no stored state.
export function decideNotification({ health, previous, kind = 'degraded' } = {}) {
  const current = problemList(health)
  if (kind === 'receipt') return { action: 'receipt', current, added: [], resolved: [] }
  const previousProblems = previous ? problemList(previous) : []
  const previousKeys = new Set(previousProblems.map(problem => problem.key))
  const currentKeys = new Set(current.map(problem => problem.key))
  const added = current.filter(problem => !previousKeys.has(problem.key))
  const resolved = previousProblems.filter(problem => !currentKeys.has(problem.key) && collectable(health, problem.origins))
  if (current.length === 0) return { action: resolved.length ? 'recovered' : 'silent', current, added, resolved }
  return { action: added.length ? 'degraded' : 'silent', current, added, resolved }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const path = process.argv[2] || 'public/radar/health.json'
  const previousPath = process.argv[3]
  let health
  try {
    health = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    console.log('NO_HEALTH')
    process.exit(0)
  }
  const { editorialNotice, degraded, inheritedOnly } = classifyHealth(health)
  if (previousPath) {
    let previous
    try {
      previous = JSON.parse(await readFile(previousPath, 'utf8'))
    } catch { /* no previous report means every current problem is new */ }
    const decision = decideNotification({ health, previous })
    console.log(`ACTION ${decision.action.toUpperCase()} · 新增 ${decision.added.length} · 恢复 ${decision.resolved.length}`)
    process.exitCode = decision.action === 'silent' ? 0 : 1
  } else {
    if (editorialNotice) console.log('EDITORIAL_NOTICE')
    if (degraded) console.log('DEGRADED')
    if (!editorialNotice && !degraded) console.log(inheritedOnly ? 'INHERITED' : 'HEALTHY')
    // Exit 1 means "notify"; the workflow keeps the step non-fatal.
    process.exitCode = editorialNotice || degraded ? 1 : 0
  }
}
