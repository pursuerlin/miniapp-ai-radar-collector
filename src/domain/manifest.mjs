export const DATASET_KEYS = ['catalog', 'usage', 'intelligence', 'evaluation', 'briefings']

export function validManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !Number.isFinite(Date.parse(manifest.generatedAt))) return false
  return [...DATASET_KEYS,...(manifest.datasets?.media?['media']:[]),...(manifest.datasets?.research?['research']:[])].every(key => {
    const d = manifest.datasets?.[key]
    return d && typeof d.label === 'string' && Number.isFinite(Date.parse(d.collectedAt)) &&
      ['ok', 'partial', 'stale', 'error'].includes(d.status) && typeof d.source === 'string'
  })
}

export function newerManifest(next, current) {
  const nextTime = Date.parse(next?.generatedAt)
  const currentTime = Date.parse(current?.generatedAt)
  return Number.isFinite(nextTime) && (!Number.isFinite(currentTime) || nextTime > currentTime)
}

const isoTime = value => new Date(value).toISOString()
// The client renders these summaries verbatim; a manifest that lags its payload would
// describe data the reader cannot see.
export function datasetCollectedTimes({ snapshot, intelligence, benchmark, evaluation, briefings }) {
  return {
    catalog: isoTime(snapshot.collectedAt),
    usage: isoTime(snapshot.collectedAt),
    intelligence: isoTime(intelligence.collectedAt),
    evaluation: [benchmark.collectedAt, evaluation.collectedAt].sort((a, b) => Date.parse(a) - Date.parse(b)).map(isoTime)[0],
    briefings: isoTime(briefings.collectedAt)
  }
}
export function firstManifestTimeMismatch(manifest, payloads) {
  const expected = datasetCollectedTimes(payloads)
  return Object.keys(expected).find(id => manifest?.datasets?.[id]?.collectedAt !== expected[id]) || ''
}

export function freshnessStatus(collectedAt, now = Date.now(), maxAgeHours = 48) {
  const ts = Date.parse(collectedAt)
  if (!Number.isFinite(ts)) return 'unknown'
  if (now - ts > maxAgeHours * 3600e3) return 'stale'
  return 'fresh'
}

export function datasetSummary(manifest, now = Date.now()) {
  if (!validManifest(manifest)) return []
  return [...DATASET_KEYS,...(manifest.datasets.media?['media']:[]),...(manifest.datasets.research?['research']:[])].map(key => ({
    id: key,
    ...manifest.datasets[key],
    freshness: freshnessStatus(manifest.datasets[key].collectedAt, now),
    statusLabel: datasetStatusLabel(manifest.datasets[key], now)
  }))
}

export function datasetStatusLabel(dataset, now = Date.now()) {
  const status = {ok:'已采集',partial:'部分成功',stale:'保留旧数据',error:'采集异常'}[dataset.status] || '状态未知'
  const freshness = freshnessStatus(dataset.collectedAt, now)
  return status + (freshness === 'stale' ? ' · 超过 48 小时' : freshness === 'unknown' ? ' · 时间未知' : '')
}
