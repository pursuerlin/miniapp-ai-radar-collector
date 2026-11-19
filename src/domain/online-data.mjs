import {validReleaseDate} from './evaluation-date.mjs'
import { validManifest } from './manifest.mjs'

const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const https = value => typeof value === 'string' && value.startsWith('https://')
const cost = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0
const rowShape = r => r && typeof r.id === 'string' && typeof r.name === 'string' &&
  typeof r.provider === 'string' && cost(r.cost) &&
  (r.openWeight === undefined || r.openWeight === null || typeof r.openWeight === 'boolean')
const rows = values => Array.isArray(values) && values.length > 0 &&
  values.every(r => rowShape(r) && Number.isFinite(r.score))
// AA lists models it has not scored yet; they stay on the board with a null score, but a
// board with no score at all is a broken page, not an empty leaderboard.
const aaRows = values => Array.isArray(values) && values.length > 0 &&
  values.every(r => rowShape(r) && (r.score === null || Number.isFinite(r.score))) &&
  values.every(r=>r.releaseDate===undefined||r.releaseDate===null||validReleaseDate(r.releaseDate)) &&
  values.every(r => ['firstTokenLatency', 'firstAnswerLatency', 'endToEndLatency','priceInput','priceOutput','cacheReadPrice','cacheWritePrice','taskTimeSeconds','contextTokens','parametersBillions','activeParametersBillions'].every(key => r[key] === undefined || cost(r[key]))) &&
  values.every(r => ['inputModalities','outputModalities'].every(key=>r[key]===undefined||Array.isArray(r[key])&&r[key].every(value=>['text','image','speech','video'].includes(value)))) &&
  values.some(r => Number.isFinite(r.score))

// All datasets travel in one response: a failed validation preserves the whole cache.
// indexVersion and coverage are additive: a cache published before them stays valid.
const indexVersion = value => value === undefined || value === '' ||
  (typeof value === 'string' && /^v\d+(\.\d+)*$/.test(value))
const coverage = value => value === undefined || (value && Number.isInteger(value.listed) &&
  Number.isInteger(value.ranked) && value.listed > 0 && value.ranked >= 0 && value.ranked <= value.listed)
export function validBenchmark(aa) {
  if (!(aa?.schemaVersion === 1 && date(aa.collectedAt) && https(aa.source) && aaRows(aa.rows) &&
    indexVersion(aa.indexVersion) && coverage(aa.coverage))) return false
  const extra=aa.additionalRows
  if(extra===undefined)return true
  return Array.isArray(extra)&&extra.length<=100&&(!extra.length||aaRows(extra))&&
    extra.every(r=>r.rankingScope==='detail'&&r.deprecated===true&&r.detailStatus==='verified'&&
      date(r.observedAt)&&Date.parse(r.observedAt)<=Date.now()+300000&&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(r.sourceModelId)&&
      /^https:\/\/artificialanalysis\.ai\/models\/[a-z0-9-]+$/.test(r.detailSourceUrl))&&
    new Set([...aa.rows,...extra].map(r=>r.sourceModelId||r.id)).size===aa.rows.length+extra.length&&
    new Set([...aa.rows,...extra].map(r=>r.id)).size===aa.rows.length+extra.length
}
export function validEvaluations(lb) {
  return !!(lb?.schemaVersion === 2 && date(lb.collectedAt) &&
    Array.isArray(lb.sources) && lb.sources.length > 0 &&
    lb.sources.every(s => s && typeof s.id === 'string' && typeof s.shortLabel === 'string' && https(s.source)) &&
    rows(lb.rows) && lb.rows.every(r => lb.sources.some(s => s.id === r.sourceId) &&
      r.costBasis === 'source' && r.categories && Object.values(r.categories).every(v => typeof v === 'number' && Number.isFinite(v))))
}
export function validOnlineData(data) {
  return validManifest(data?.manifest) && validBenchmark(data?.benchmark) && validEvaluations(data?.evaluations)
}
