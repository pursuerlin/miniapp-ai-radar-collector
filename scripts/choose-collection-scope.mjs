import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import {collectionTasks,COLLECTION_TASKS} from './collection-profiles.mjs'
import {sourcesNeedingRecovery,SOURCE_LABELS} from './collection-state.mjs'

// GitHub's own schedule is best-effort: under load it delays or drops runs, and this
// repository has seen gaps of 9.5 hours. An external timer can dispatch a heartbeat,
// and any run that finds a dataset past its tolerance widens itself to a full
// collection, so a dropped slot is repaired by whatever run happens next.
export const CATCH_UP_HOURS = { evaluation: 14, catalog: 10, intelligence: 2 }
export const HEARTBEAT_FRESH_MINUTES = 20
const SCHEDULES = { '11,41 * * * *':'news', '37 0,12 * * *': 'all', '7 0,4,8,12,16,20 * * *': 'catalog', '17 */2 * * *': 'news' }
const LABELS = { evaluation: '能力评测', catalog: '模型目录与报价', intelligence: 'AI 资讯' }
// A workflow input arrives as a boolean from the UI but as the string "true" through
// the dispatch API, and the heartbeat is useless if one of them is misread.
const truthy = value => value === true || ['true', '1'].includes(String(value ?? '').trim().toLowerCase())

export function baseProfile({ eventName, schedule, inputProfile } = {}) {
  if (eventName === 'schedule') return SCHEDULES[schedule] || 'all'
  return inputProfile || 'all'
}

export function chooseScope({ eventName, schedule, inputProfile, heartbeat = false, manifest, now = new Date().toISOString() } = {}) {
  const requested = baseProfile({ eventName, schedule, inputProfile })
  const external = eventName === 'workflow_dispatch' && truthy(heartbeat)
  const hoursSince = id => {
    const ms = Date.parse(now) - Date.parse(manifest?.datasets?.[id]?.collectedAt)
    // A clock-skewed future timestamp must not read as ancient data.
    return Number.isFinite(ms) ? Math.max(0, ms) / 36e5 : null
  }
  // New manifests remember each source independently. A healthy LiveBench never
  // hides an AA outage, and an AA repair need not re-fetch the news archive.
  if(manifest?.sourceHealth){
    const automatic=eventName==='schedule'||external
    const newsAge=(Date.parse(now)-Date.parse(manifest.datasets?.intelligence?.collectedAt))/60000
    const freshHeartbeat=external&&['news','approved'].includes(requested)&&Number.isFinite(newsAge)&&newsAge<HEARTBEAT_FRESH_MINUTES
    let selected=freshHeartbeat?[]:collectionTasks(requested)
    const repairs=automatic&&requested!=='approved'?sourcesNeedingRecovery(manifest,Date.parse(now)):[]
    selected=COLLECTION_TASKS.filter(id=>selected.includes(id)||repairs.includes(id))
    return {profile:requested,skip:!selected.length,tasks:selected.join(','),reason:repairs.length?'按来源补采：'+repairs.map(id=>SOURCE_LABELS[id]).join('、'):freshHeartbeat?'AI 资讯刚更新，跳过本次心跳':'按计划范围采集'}
  }
  let profile = requested
  const notes = []
  // Only a schedule-driven run may change its own scope. A manual dispatch publishes
  // exactly the dataset asked for, even when another dataset is stale.
  if ((eventName === 'schedule' || external) && (requested === 'news' || requested === 'catalog')) {
    const stale = Object.entries(CATCH_UP_HOURS)
      .map(([id, hours]) => ({ id, hours, age: hoursSince(id) }))
      .filter(item => item.age !== null && item.age > item.hours)
      .sort((a, b) => b.age / b.hours - a.age / a.hours)[0]
    if (stale) {
      profile = 'all'
      notes.push(`${LABELS[stale.id]}已 ${stale.age.toFixed(1)} 小时未更新，本轮扩为完整采集`)
    }
  }
  const newsAge = hoursSince('intelligence')
  // The heartbeat only exists to fill a slot GitHub dropped, so it earns a run only
  // when news is actually old. Both intelligence-only profiles count, because a
  // dispatch that forgets its profile falls back to the default approved. A widened
  // run is never skipped: it answers staleness.
  const intelligenceOnly = requested === 'news' || requested === 'approved'
  const skip = external && intelligenceOnly && profile === requested && newsAge !== null && newsAge * 60 < HEARTBEAT_FRESH_MINUTES
  if (skip) notes.push(`AI 资讯 ${Math.round(newsAge * 60)} 分钟前已更新，跳过本次心跳`)
  return { profile, skip, reason: notes.join('；') || '按计划范围采集' }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const env = process.env
  let manifest
  try {
    manifest = JSON.parse(await readFile(env.MANIFEST_PATH || 'src/data/manifest.json', 'utf8'))
  } catch {
    // An unreadable manifest must never stop a collection; the requested scope stands.
    manifest = undefined
  }
  const decision = chooseScope({ eventName: env.EVENT_NAME, schedule: env.EVENT_SCHEDULE, inputProfile: env.INPUT_PROFILE, heartbeat: env.HEARTBEAT, manifest })
  console.error(`采集范围 ${decision.profile}${decision.skip ? '（跳过）' : ''}：${decision.reason}`)
  console.log(`profile=${decision.profile}`)
  console.log(`skip=${decision.skip}`)
  console.log(`reason=${decision.reason}`)
  console.log(`tasks=${decision.tasks??collectionTasks(decision.profile).join(',')}`)
}
