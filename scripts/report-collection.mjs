import {readFile,appendFile} from 'node:fs/promises'

// Only report the last validated snapshot. If collection failed before publishing,
// this timestamp makes it explicit that the retained report is from an earlier run.
const health=JSON.parse(await readFile('public/radar/health.json','utf8'))
const cell=value=>String(value??'—').replaceAll('|',' / ').replace(/[\r\n]/g,' ')
let retry;try{retry=JSON.parse(await readFile(process.env.COLLECTION_RETRY_REPORT||'.collection-retry.json','utf8'))}catch{}
const current=Boolean(retry&&String(retry.runId)===String(process.env.GITHUB_RUN_ID)&&Date.parse(health.generatedAt)>=Date.parse(retry.startedAt))
const lines=[
 '# 最近一次通过校验的数据快照',
 '',
 `快照生成时间：${cell(health.generatedAt)}；状态：${cell(health.status)}`,
 `采集范围：${cell(health.collection?.profile)}；触发方式：${cell(health.collection?.trigger)}`,
 '',
 '本报告来自保留的有效快照；本轮是否成功请同时查看采集步骤。',
 retry&&String(retry.runId)===String(process.env.GITHUB_RUN_ID)?`采集实际执行 ${retry.attempts} 次，重试 ${Math.max(0,retry.attempts-1)} 次；上限 ${retry.maxAttempts} 次。`:'本轮实际重试次数未记录。',
 '',
 `| 采集任务 | ${current?'本轮状态':'历史快照状态（非本轮）'} | 说明 |`,
 '| --- | --- | --- |',
 ...Object.entries(health.collection?.tasks||{}).map(([id,t])=>`| ${cell(id)} | ${cell(t.status)} | ${t.status==='skipped'?'本轮未采集；保留状态属于历史快照':cell(t.message||'')} |`),
 '',
 '| 来源 | 状态 | 上次有效采集 | 连续失败 | 最早可重试 | 详情覆盖 |',
 '| --- | --- | --- | --- | --- | --- |',
 ...Object.entries(health.sourceHealth||{}).map(([id,s])=>`| ${cell(s.label||id)} | ${cell(s.status)} | ${cell(s.lastSuccessAt)} | ${cell(s.consecutiveFailures)} | ${cell(s.nextRetryAt)} | ${cell(s.quality?.ranked!==undefined?(s.quality.ranked-s.quality.missingScoredDetails)+' / '+s.quality.ranked:'')} |`),
 '',
 '| 数据集 | 状态 | 实际采集时间 |',
 '| --- | --- | --- |',
 ...(health.datasets||[]).map(d=>`| ${cell(d.label)} | ${cell(d.statusLabel)} | ${cell(d.collectedAt)} |`),
 '',
 '| 资讯来源 | 状态 | 最近成功时间 | 条数 | 错误码 | 原因 / 建议 | HTTP 次数 |',
 '| --- | --- | --- | --- | --- | --- | --- |',
 ...(health.intelligence?.sources||[]).map(s=>`| ${cell(s.name||s.id)} | ${cell(s.status)} | ${cell(s.lastSuccessAt)} | ${cell(s.count)} | ${cell(s.errorCode)} | ${cell(s.lastError)} | ${cell(s.attempts)} |`),
 ''
]
const report=lines.join('\n')
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,report)
else console.log(report)
