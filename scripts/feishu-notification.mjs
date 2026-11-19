import {readFileSync} from 'node:fs'
import {sourceFailure} from './collection-diagnostics.mjs'

const profiles={all:'完整采集',catalog:'模型目录与报价',news:'资讯采集',approved:'飞书审核发布'}
const labels={catalog:'模型目录与报价',intelligence:'AI 资讯',aa:'Artificial Analysis',livebench:'LiveBench'}
const changeLabels={'provider-added':'新增供应商',price:'价格变动',context:'上下文变化','model-added':'新增模型','model-removed':'下架模型'}
const text=value=>String(value??'未知').replace(/[\r\n]/g,' ').replace(/[<>`*\[\]]/g,'').slice(0,240)
const time=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(value))+' 北京时间':'无成功记录'
const age=(value,now)=>{
 const hours=(Date.parse(now)-Date.parse(value))/36e5
 return Number.isFinite(hours)?`距快照 ${Math.max(0,hours).toFixed(1)} 小时`:'时间未知'
}
const hoursAgo=(value,now)=>{
 const hours=(Date.parse(now)-Date.parse(value))/36e5
 return Number.isFinite(hours)?`${Math.max(0,hours).toFixed(hours<10?1:0)} 小时前`:'时间未知'
}
const shanghaiDay=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric'}).format(new Date(value))

// The operations Base is linked from cards that ask someone to do something there.
// A missing config only costs the button, never the card.
const baseLink=null

const markdown=content=>({tag:'markdown',content})
const note=content=>({tag:'note',elements:[{tag:'plain_text',content}]})
const metrics=cells=>({tag:'column_set',flex_mode:'none',columns:cells.map(({label,value})=>({
 tag:'column',width:'weighted',weight:1,vertical_align:'top',
 elements:[markdown(`**${value}**\n<font color='grey'>${label}</font>`)]
}))})
const actions=list=>{
 const buttons=list.filter(item=>item&&item.url).map(({label,url,type='default'})=>({tag:'button',text:{tag:'plain_text',content:label},type,url}))
 return buttons.length?{tag:'action',actions:buttons}:null
}
const push=(elements,element)=>{if(element)elements.push(element)}
// Legacy card envelope: buttons with a plain url and the note footer are only accepted
// here, and the card JSON 2.0 schema rejects them silently at delivery time.
const card=(template,title,elements)=>({config:{wide_screen_mode:true},header:{template,title:{tag:'plain_text',content:title}},elements})

function detail(item,now){
 const code=item.errorCode?`\`${text(item.errorCode)}\``:'未记录错误码（旧快照）；查看采集日志'
 const attempts=Number.isInteger(item.attempts)?`；HTTP 请求 ${item.attempts} 次`:''
 const reason=item.errorCode?sourceFailure(Error(item.errorCode)).lastError:'本轮未更新，请维护者查看运行日志'
 return `• **${text(item.name||item.label||item.id)}**：${reason}\n<font color='grey'>错误码：${code}${attempts}\n最近成功：${time(item.lastSuccessAt||item.collectedAt)}（${age(item.lastSuccessAt||item.collectedAt,now)}）${Number.isInteger(item.count)?`；保留 ${item.count} 条`:''}</font>`
}

// One delivery path for real alerts and format previews alike, so a previewed card
// exercises the same retry and response checks the workflow uses.
export async function sendCard(webhook, card, { fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetchImpl(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ msg_type: 'interactive', card }), signal: AbortSignal.timeout(15000) })
      const body = await response.json()
      if (response.ok && body?.code === 0) return true
      throw Error(`HTTP ${response.status}; Feishu code ${Number(body?.code) || 'unknown'}; ${String(body?.msg || '')}`)
    } catch (error) {
      // Fetch errors can embed the webhook URL. Never log that capability URL, but keep
      // the Feishu code so a rejected card is diagnosable from the run log alone.
      console.warn(`飞书通知第 ${attempt}/3 次失败：${String(error?.message || error).replace(/https?:\/\/\S+/g, '[link]')}`)
      if (attempt < 3) await sleep(attempt * 3000)
    }
  }
  return false
}

function runLink(env){
 return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(env.RUN_URL||'')?env.RUN_URL:null
}

export function buildNotification({env={},health,retry,failedSteps=[],added=[],failure=null}={}){
 const degraded=env.NOTIFY_KIND==='degraded'
 const runUrl=runLink(env)
 // Only this run's own retry report may describe this run, including its error quote.
 const actualRetry=retry&&String(retry.runId)===String(env.GITHUB_RUN_ID)
 const errorTail=actualRetry?text(retry.errorTail||''):''
 // A failed refresh may leave a previous, valid health.json in the checkout.
 const current=Boolean(health&&retry&&String(retry.runId)===String(env.GITHUB_RUN_ID)&&Date.parse(health.generatedAt)>=Date.parse(retry.startedAt))
 const tasks=health?.collection?.tasks||{}
 const sources=health?.intelligence?.sources||[]
 const badNews=sources.filter(s=>s.status!=='ok')
 const currentNews=current&&tasks.intelligence?.status==='ok'?badNews:[]
 const currentTasks=current?Object.entries(tasks).filter(([,v])=>v.status==='stale').map(([id,v])=>({id,name:labels[id],...v})):[]
 const inherited=[]
 if(health){
  if(!current||tasks.intelligence?.status!=='ok')inherited.push(...badNews)
  for(const d of health.datasets||[]){
   if(d.id==='evaluation'){
    for(const s of d.sources||[]){
     // A board this profile never collects is not an item needing attention; the
     // staleness line below already says it, and repeating it read like a data fault.
     if(s.status!=='ok'&&!current)inherited.push({...s,name:s.id==='livebench'?'LiveBench':'Artificial Analysis'})
    }
   }else if(!['intelligence','briefings'].includes(d.id)&&d.status!=='ok'&&!current)inherited.push(d)
  }
 }
 const active=[...currentNews,...currentTasks]
 // A card titled 需关注 must never contain 0 items; say which dataset is waiting instead.
 const staleDatasets=(health?.datasets||[]).filter(d=>d.status!=='ok'||d.freshness==='stale')
 const editorial=health?.collection?.editorial
 const incomplete=Number.isInteger(editorial?.incomplete)?Math.max(0,editorial.incomplete):0
 const editorialNotice=editorial?.status==='failed'?`审核通道 ${text(editorial.code||'异常')}`:incomplete?`审核通道 ${incomplete} 条待补全`:null
 const headline=active.length?(active.length===1?`${text(active[0].name||active[0].id)}采集异常`:`${active.length} 项采集异常`):editorialNotice?editorialNotice:inherited.length?`${inherited.length} 项历史问题`:staleDatasets.length?`${staleDatasets.map(d=>text(d.label)).join('、')} 待更新`:'无待更新项'

 const elements=[]
 const add=content=>elements.push(markdown(content))
 // "资讯采集" was also the name of the news profile, so a catalog round read as if it
 // had just collected the news at the time shown. Label the clock for what it is.
 add(`**资讯快照：** ${health?.intelligence?.collectedAt||health?.generatedAt?time(health?.intelligence?.collectedAt||health?.generatedAt):'未知'} · **本轮范围：** ${text(profiles[env.COLLECTION_PROFILE||health?.collection?.profile]||env.COLLECTION_PROFILE||health?.collection?.profile)} · 运行 #${text(env.GITHUB_RUN_NUMBER)}`)
 if(health)push(elements,metrics([
  {label:'资讯条数',value:health?.intelligence?.articles??'未知'},
  {label:'来源连通',value:`${health?.intelligence?.connected??'未知'} / ${health?.intelligence?.total??'未知'}`},
  {label:'数据快照',value:time(health.generatedAt).replace(' 北京时间','')}
 ]))
 if(!degraded){
  // The captured detail names the step and quotes the error line; the API list and the
  // run variables only exist as fallbacks for rounds where that capture itself died.
  const step=failure?.step?text(failure.step):failedSteps.length?failedSteps.map(text).join('、'):text(env.FAILED_STEP||'未获取，请查看运行日志')
  const reason=failure?.reason?text(failure.reason):text(env.FAILURE_REASON||'请打开运行日志查看异常；健康快照不能代表本轮执行结果。')
  add(`**失败步骤：** ${step}\n**原因：** ${reason}${errorTail?`\n**进程日志末尾：** ${errorTail}`:''}`)
 }
 if(!health)add('**健康快照：** 未取得本轮健康快照，不能判断来源是否成功。')
 else if(!current)add(`**健康快照：** 非本轮已验证快照，仅供参考（${time(health.generatedAt)}）。`)
 // A zero-count "本轮需关注 · 0 项" heading reads like a fault that isn't there.
 if(active.length)add(`**本轮需关注 · ${active.length} 项**${added.length&&added.length<active.length?`\n<font color='grey'>其中 ${added.length} 项为本轮新增，其余仍在持续。</font>`:''}\n${active.slice(0,8).map(s=>detail(s,health.generatedAt)).join('\n\n')}`)
 else if(editorialNotice)add('数据源全部正常，只有飞书审核通道需要处理；详见下方「审核通道」。')
 else if(health&&current&&staleDatasets.length)add('无来源级失败；只有数据集整体待更新，见下方时效提醒。')
 else if(health&&!current)add(`<font color='grey'>健康快照不是本轮生成的，无法确认本轮来源是否全部成功。</font>`)
 if(active.length>8)add(`另有 ${active.length-8} 项，完整列表见运行摘要。`)
 if(currentNews.length)add('**影响：** 上述来源本轮未更新，有有效缓存时继续展示旧数据，可能缺少最新资讯；其他成功来源照常更新。\n**处理人：** 采集维护者；无需在审核表处理这类异常。')
 if(inherited.length)add(`**${current?'历史问题 · '+inherited.length+' 项，本轮未采集':'旧快照问题 · '+inherited.length+' 项'}**\n${inherited.slice(0,4).map(s=>detail(s,health.generatedAt)).join('\n\n')}`)
 const outdated=(health?.datasets||[]).filter(d=>d.freshness==='stale')
 if(outdated.length)add(`**时效提醒：** ${outdated.map(d=>text(d.label)).join('、')}超过 48 小时；不等于本轮采集失败。`)
 if(editorial?.status==='failed')add(`**审核通道：** ${text(editorial.code||'未知')} · ${text(editorial.message)}。本轮已按未审核状态发布，资讯与模型数据照常可用，只是编辑导语不会更新。`)
 else if(incomplete)add(`**审核通道：** ${incomplete} 条「已通过」缺少中文导读或主题，本轮未发布${editorial?.approved?`；其余 ${editorial.approved} 条已正常发布`:' '}。补齐字段后再运行一次 approved 即可上线。`)
 const tips=[]
 if(editorial?.status==='failed')tips.push('审核通道异常：按错误码处理（缺权限补权限、表结构不符改回字段名），再运行一次 approved 采集。')
 else if(incomplete)tips.push('审核通道待补全：在 Base「资讯审核」给「已通过」行填上中文导读，并在主题里选一个值，再运行一次 approved 采集。')
 if(currentNews.some(s=>s.errorCode==='HTTP_429'))tips.push('限流来源：等待下一次定时采集，避免连续手动发布。')
 if(currentNews.some(s=>/DATES_MISSING|HEADINGS_MISSING|STRUCTURE_CHANGED/.test(s.errorCode||'')))tips.push('页面解析失败：需检查来源页面并修复适配器，单纯重跑通常无效。')
 if(currentNews.some(s=>s.errorCode==='LICENSE_NOTICE_MISSING'))tips.push('许可校验失败：维护者核对页面格式和许可声明；未确认前仅收录标题、日期和原文链接，不要只删除校验或连续重跑。')
 if(inherited.length)tips.push('历史来源异常：在 GitHub 手动选择 all 完整采集后再核查。')
 if(tips.length)add('**建议操作：**\n'+tips.map(s=>'• '+s).join('\n'))
 // Without this run's own report there is nothing honest to count; the retry policy
 // line only means something next to an actual attempt number.
 if(actualRetry)add(`**采集次数：** 执行 ${retry.attempts} 次，重试 ${Math.max(0,retry.attempts-1)} 次（流程上限 ${retry.maxAttempts} 次）。429 限流不会立即重试，可重试的网络异常最多请求 2 次。`)
 push(elements,actions([
  {label:'查看运行',url:runUrl,type:'primary'},
  editorialNotice?{label:'处理审核',url:baseLink}:null
 ]))
 push(elements,note('数据仍经过校验；异常来源使用最近一次有效缓存。'))
 // A preview run must be unmistakable in a shared group, so it may label its own title.
 const prefix=text(env.NOTIFY_TITLE_PREFIX||'').slice(0,24)
 return card(degraded?'orange':'red',degraded?`${prefix}AI 雷达已发布 · ${headline}`:`${prefix}AI 雷达工作流失败`,elements)
}

// A manual or Feishu-button publication needs a receipt even when everything is healthy:
// without one, "I clicked it and nothing happened" is indistinguishable from success.
export function buildReceiptCard({env={},health,retry,problemCount=0}={}){
 const runUrl=runLink(env)
 const editorial=health?.collection?.editorial
 const approved=Number.isInteger(editorial?.approved)?editorial.approved:0
 const pending=Number.isInteger(editorial?.pending)?editorial.pending:0
 const incomplete=Number.isInteger(editorial?.incomplete)?editorial.incomplete:0
 const channelFailed=editorial?.status==='failed'
 // A skipped channel means this run never looked at the review queue; saying
 // "nothing was approved" would blame the editor for a configuration gap.
 const channelSkipped=!channelFailed&&(!editorial||editorial.status==='skipped')
 const published=!channelFailed&&!channelSkipped&&approved>0
 const attention=channelFailed||channelSkipped||incomplete>0||problemCount>0
 const headline=channelFailed?'审核通道未连上':channelSkipped?'未同步审核通道':published?`已上线 ${approved} 条`:incomplete?`${incomplete} 条待补全`:'没有新内容'
 const lines=[]
 if(channelFailed)lines.push(`**审核通道：** ${text(editorial?.code||'未知')} · ${text(editorial?.message)}。本轮没有发布编辑导语，资讯本身照常更新。`)
 else if(channelSkipped)lines.push('**审核通道：** 本轮没有同步审核队列（档位不含审核或未配置飞书应用），只更新了资讯数据。')
 else if(published)lines.push(`**已发布：** ${approved} 条「已通过」资讯连同中文导读已写入线上。`)
 else if(incomplete)lines.push(`**未发布：** ${incomplete} 条「已通过」缺少中文导读或主题。`)
 else lines.push('**未发布：** Base 里没有「已通过」的条目，本次没有新内容上线。')
 if(incomplete&&published)lines.push(`**待补全：** 另有 ${incomplete} 条已通过但缺少中文导读或主题，未发布。`)
 if(pending)lines.push(`**新增待审：** ${pending} 条已写入「资讯审核」，可以直接处理。`)
 if(problemCount)lines.push(`**数据来源：** 本轮还有 ${problemCount} 个问题，详见运行记录；发布本身已完成。`)
 const elements=[markdown(lines.join('\n'))]
 push(elements,metrics([
  {label:'本次上线',value:channelFailed||channelSkipped?'—':approved},
  {label:'新增待审',value:pending},
  {label:'待补全',value:incomplete}
 ]))
 push(elements,actions([
  {label:'打开审核表',url:baseLink,type:'primary'},
  {label:'查看运行',url:runUrl}
 ]))
 push(elements,note(channelFailed||incomplete?'数据已校验；补齐审核字段后，再点一次按钮即可上线。':'数据已校验，线上已是最新快照。'))
 const prefix=text(env.NOTIFY_TITLE_PREFIX||'').slice(0,24)
 return card(channelFailed?'red':attention?'orange':'green',`${prefix}审核发布 · ${headline}`,elements)
}

// Sent once when a problem that was on a card disappears. Without it, an overnight
// outage that recovers by morning leaves the last card saying "failing".
export function buildRecoveryCard({env={},health,resolved=[],retry}={}){
 const runUrl=runLink(env)
 const items=resolved.slice(0,6).map(problem=>`• **${text(problem.label)}**：${text(problem.code)} 已恢复正常`).join('\n')
 const more=resolved.length>6?`\n另有 ${resolved.length-6} 项同时恢复。`:''
 const elements=[]
 if(items)elements.push(markdown(items+more))
 push(elements,metrics([
  {label:'资讯条数',value:health?.intelligence?.articles??'未知'},
  {label:'来源连通',value:`${health?.intelligence?.connected??'未知'} / ${health?.intelligence?.total??'未知'}`},
  {label:'数据快照',value:time(health?.generatedAt).replace(' 北京时间','')}
 ]))
 push(elements,actions([{label:'查看运行',url:runUrl,type:'primary'}]))
 push(elements,note('无需操作；异常期间线上一直使用最近一次有效数据。'))
 const prefix=text(env.NOTIFY_TITLE_PREFIX||'').slice(0,24)
 return card('green',`${prefix}AI 雷达已恢复 · ${resolved.length} 项正常`,elements)
}

const safeLink=value=>/^https:\/\/[^\s)]+$/.test(value||'')?value:null
const shortTitle=value=>text(value).slice(0,60)

// One card a day, only when there is something to read. It is a summary, not an alert.
export function buildDigestCard({health,manifest,intelligence,changes,now}={}){
 const asOf=health?.generatedAt||now||new Date().toISOString()
 const from=Date.parse(asOf)-24*36e5
 const articles=(intelligence?.articles||[]).filter(item=>Number.isFinite(Date.parse(item.publishedAt))&&Date.parse(item.publishedAt)>=from)
 const fresh=articles.filter(item=>safeLink(item.url)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))
 const top=fresh.slice(0,3).map(item=>`• [${shortTitle(item.title)}](${item.url})\n<font color='grey'>${text(item.sourceId)} · ${time(item.publishedAt).replace(' 北京时间','')} 更新</font>`)
 const editorial=health?.collection?.editorial
 const pending=Number.isInteger(editorial?.pending)?editorial.pending:0
 const incomplete=Number.isInteger(editorial?.incomplete)?editorial.incomplete:0
 const datasets=manifest?.datasets||{}
 const freshness=['catalog','intelligence','evaluation'].map(id=>datasets[id]?`${text(datasets[id].label||id)} ${hoursAgo(datasets[id].collectedAt,asOf)}`:null).filter(Boolean)
 const badSources=(health?.intelligence?.sources||[]).filter(s=>s.status!=='ok')
 const connected=health?.intelligence?.connected??'未知'
 const total=health?.intelligence?.total??'未知'
 const elements=[]
 if(top.length){elements.push(markdown(`**值得看**\n${top.join('\n')}`))}
 const stats=Object.entries(changes?.stats||{}).filter(([,v])=>Number.isInteger(v)&&v>0).map(([kind,v])=>`${changeLabels[kind]||kind} ${v}`)
 if(Number.isInteger(changes?.total)&&changes.total>0)elements.push(markdown(`**模型目录 · ${changes.total} 项变化**\n<font color='grey'>${stats.join(' · ')||'详见小程序变更页'}；${changes.window?.from?`自 ${time(changes.window.from)}`:'统计窗口未知'}</font>`))
 if(freshness.length)elements.push(markdown(`**数据新鲜度**\n<font color='grey'>${freshness.join(' · ')}</font>`))
 elements.push(markdown(`**来源连通：** ${connected} / ${total}${badSources.length?`，仍有 ${badSources.length} 个来源未恢复：${badSources.slice(0,3).map(s=>text(s.name||s.id)).join('、')}`:'，全部正常'}\n**审核待办：** ${pending?`新增 ${pending} 条待审`:'无新增待审'}${incomplete?`；${incomplete} 条已通过但待补全`:''}`))
 push(elements,metrics([
  {label:'24 小时新增资讯',value:fresh.length},
  {label:'目录变化',value:Number.isInteger(changes?.total)?changes.total:'未知'},
  {label:'来源连通',value:`${connected} / ${total}`}
 ]))
 push(elements,actions([{label:'打开审核表',url:baseLink,type:'primary'}]))
 push(elements,note(`自动汇总自 ${time(asOf)} 的最新快照；只在这 24 小时有内容或有待办时发送。`))
 return card(badSources.length?'blue':'turquoise',`AI 雷达日报 · ${shanghaiDay(asOf)}`,elements)
}
