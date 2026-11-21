import {appendFile, readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {SOURCE_LABELS} from './collection-state.mjs'

const REPEATED_FAILURES = 3
const MAX_NEWS_AGE_MS = 3 * 3600000

export function failedCollectedSources(health) {
 return Object.entries(health?.collection?.tasks || {}).filter(([id, task]) => {
  if (task.status === 'skipped') return false
  const quality = health.sourceHealth?.[id]?.quality
  return task.status !== 'ok' || quality?.regressed ||
   (id === 'media' && quality?.partial) || (id === 'intelligence' && health.intelligence?.partial)
 }).map(([id]) => id)
}

export function collectionHealthReport(health, {automatic = false, now = Date.now()} = {}) {
 const issues = failedCollectedSources(health).map(id => {
  const task = health.collection.tasks[id]
  const source = health.sourceHealth?.[id]
  const newsAge = now - Date.parse(source?.lastSuccessAt ?? task.collectedAt)
  const critical = id === 'intelligence' && (!Number.isFinite(newsAge) || newsAge > MAX_NEWS_AGE_MS)
  const repeated = Math.max(source?.consecutiveFailures || 0, source?.qualityFailures || 0) >= REPEATED_FAILURES
  const code = task.errorCode || source?.quality?.errorCode || (source?.quality?.regressed ? 'QUALITY_REGRESSION' : 'SOURCE_DEGRADED')
  return {
   id,
   label: SOURCE_LABELS[id] || id,
   code,
   blocking: !automatic || critical || repeated,
  }
 })
 return {status: issues.some(issue => issue.blocking) ? 'failed' : issues.length ? 'degraded' : 'healthy', issues}
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
 const health = JSON.parse(await readFile('public/radar/health.json', 'utf8'))
 const {status, issues} = collectionHealthReport(health, {automatic: process.env.AUTOMATIC_COLLECTION === 'true'})
 const heading = {
  healthy: '本轮所选来源已通过健康检查。',
  degraded: '本轮公开快照已核验，部分来源降级，将按来源重试计划恢复。',
  failed: '本轮公开快照已核验，所选来源存在需要处理的异常。',
 }[status]
 console.log(heading)
 for (const issue of issues) {
  console.log(`::${issue.blocking ? 'error' : 'warning'}::${issue.label}（${issue.code}）`)
 }
 if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = issues.map(issue => `- ${issue.label}（${issue.code}）${issue.blocking ? '，需要处理' : '，降级'}`)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, ['\n## 来源健康检查\n', heading, '', ...rows, ''].join('\n'))
 }
 if (status === 'failed') process.exitCode = 1
}
