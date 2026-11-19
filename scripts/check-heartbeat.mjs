import { pathToFileURL } from 'node:url'
import { sendCard } from './feishu-notification.mjs'

// A skipped heartbeat leaves no trace in the data, so the run history is the only
// evidence the timer is alive. run-name is the only thing that separates it from
// the Feishu button, which uses the same workflow_dispatch event.
export const HEARTBEAT_TITLE = '心跳采集'
export const STALE_HOURS = 8

const ageInHours = (at, now) => (Date.parse(now) - Date.parse(at)) / 36e5
const beijing = value => Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value))
  : '无成功记录'

// Distinguishes a timer that stopped from one that keeps firing and failing: the
// first needs the Cloudflare cron revived, the second needs a new token.
export function evaluateHeartbeat(runs, now = new Date().toISOString(), { staleHours = STALE_HOURS } = {}) {
  const heartbeats = (Array.isArray(runs) ? runs : [])
    .filter(run => run?.display_title === HEARTBEAT_TITLE || run?.displayTitle === HEARTBEAT_TITLE)
    .map(run => ({ at: run.created_at ?? run.createdAt, conclusion: run.conclusion }))
    .filter(run => Number.isFinite(Date.parse(run.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const success = heartbeats.find(run => run.conclusion === 'success')
  const ageHours = success ? ageInHours(success.at, now) : null
  if (ageHours !== null && ageHours <= staleHours) return { stale: false, reason: 'ok', lastSuccessAt: success.at, ageHours }
  const window = heartbeats.filter(run => ageInHours(run.at, now) <= staleHours)
  const failures = window.filter(run => run.conclusion === 'failure').length
  return {
    stale: true,
    reason: window.length && failures === window.length ? 'failing' : heartbeats.length ? 'missing' : 'never',
    lastSuccessAt: success?.at ?? null,
    ageHours,
    attempts: window.length,
    failures,
  }
}

export function buildHeartbeatCard(verdict, { runUrl } = {}) {
  const headline = verdict.reason === 'failing' ? '外部心跳在触发但一直失败' : '外部心跳已经停了'
  const what = verdict.reason === 'failing'
    ? `最近 ${STALE_HOURS} 小时里 ${verdict.failures} 次心跳全部失败。心跳已成功触发 GitHub，但工作流执行失败；应查看失败步骤，不能据此认定 token 过期。`
    : verdict.reason === 'never'
      ? '运行记录里没有任何一次心跳，定时任务可能从未触发过。'
      : `最后一次成功心跳是 ${beijing(verdict.lastSuccessAt)}，已经 ${Math.round(verdict.ageHours)} 小时没有动静。`
  // The point of this card is that nothing else would have said anything.
  const elements = [
    { tag: 'markdown', content: `**${what}**` },
    { tag: 'markdown', content: '**影响：** 数据可能仍停留在上次成功快照；GitHub 定时采集也可能受同一故障影响，请核对最近成功发布的时间。' },
    { tag: 'markdown', content: '**要检查：** 先查看 GitHub Actions 中失败的采集运行及具体步骤。只有没有触发记录时，再检查 Cloudflare Worker 的 Cron 与 token 权限；修复后确认一次采集和公开文件核验成功。' },
  ]
  if (runUrl) elements.push({ tag: 'markdown', content: `[查看心跳运行记录](${runUrl})` })
  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: { template: 'orange', title: { tag: 'plain_text', content: `AI 雷达 · ${headline}` } },
    body: { elements },
  }
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!repo || !token) {
    console.log('缺少 GITHUB_REPOSITORY 或令牌，跳过心跳检查')
    return
  }
  let runs
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?event=workflow_dispatch&per_page=50`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'ai-radar-watchdog' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      console.log(`读取运行记录失败（HTTP ${response.status}），本轮不判断`)
      return
    }
    runs = (await response.json()).workflow_runs || []
  } catch {
    console.log('读取运行记录失败（网络），本轮不判断')
    return
  }
  const verdict = evaluateHeartbeat(runs)
  if (!verdict.stale) {
    console.log(`心跳正常：最近一次成功在 ${verdict.ageHours.toFixed(1)} 小时前`)
    return
  }
  console.log(`心跳停摆：${JSON.stringify(verdict)}`)
  const webhook = process.env.FEISHU_WEBHOOK_URL
  if (!webhook) {
    console.log('未配置 FEISHU_WEBHOOK_URL，只输出结论')
    return
  }
  const card = buildHeartbeatCard(verdict, { runUrl: `https://github.com/${repo}/actions/workflows/publish-pages.yml` })
  process.exitCode = (await sendCard(webhook, card)) ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
