import {AIHOT_PERMISSION,aihotUrl,aihotOriginalUrl} from './aihot.mjs'
import {canonicalUrl} from './urls.mjs'

// These are Mojing's title-based subscriptions, not AIHOT's website topic assignments.
export const radarTopics=[
 ['openai','OpenAI / ChatGPT','公司与产品','openai',/\bopenai\b|\bchatgpt\b|\bgpt[- .]?\d|\bsora\b/i],
 ['anthropic','Anthropic / Claude','公司与产品','anthropic',/\banthropic\b|\bclaude\b/i],
 ['google','Google / Gemini','公司与产品','google',/\bgemini\b|\bgemma\b|\bproject suncatcher\b|\bdeepmind\b|谷歌|\bgoogle\s+(?:ai|发布|推出)/i],
 ['deepseek','DeepSeek','公司与产品','deepseek',/\bdeepseek\b|深度求索/i],
 ['qwen','千问 Qwen','公司与产品','qwen',/\bqwen\b|千问|通义/i],
 ['moonshot','Kimi','公司与产品','moonshotai',/\bkimi\b|月之暗面|\bmoonshot\b/i],
 ['minimax','MiniMax','公司与产品','minimax',/\bminimax\b|海螺/i],
 ['glm','智谱 GLM','公司与产品','z-ai',/\bglm\b|智谱/i],
 ['xai','xAI / Grok','公司与产品','x-ai',/\bxai\b|\bgrok\b/i],
 ['meta','Meta / Llama','公司与产品','meta-llama',/\bmeta\b|\bllama\b/i],
 ['microsoft','Microsoft / Copilot','公司与产品','microsoft',/\bmicrosoft\b|\bcopilot\b|微软/i],
 ['nvidia','NVIDIA','公司与产品','nvidia',/\bnvidia\b|英伟达/i],
 ['huggingface','Hugging Face','公司与产品','huggingface',/\bhugging\s*face\b/i],
 ['cursor','Cursor','公司与产品','cursor',/\bcursor\b/i],
 ['openrouter','OpenRouter','公司与产品','openrouter',/\bopenrouter\b/i],
 ['tencent','腾讯混元','公司与产品','tencent',/混元|\bhunyuan\b|\bhy\d/i],
 ['mistral','Mistral','公司与产品','mistralai',/\bmistral\b/i],
 ['bytedance','豆包 / 字节','公司与产品','bytedance',/豆包|字节|\bseedance\b|\bseedream\b|\bbytedance\b/i],
 ['agent','Agent 智能体','技术方向','',/\bagents?\b|智能体|代理式|代理编程/i],
 ['coding','AI 编程','技术方向','',/\bcodex\b|\bclaude\s+code\b|\bcursor\b|\bcopilot\b|编程|代码|软件工程|\bswe[- ]?bench\b/i],
 ['reasoning','推理能力','技术方向','',/推理(?:能力|模型|水平|评测|基准|得分)|(?:逻辑|数学|复杂|多步|深度)推理|\breasoning\b|思维链|思考能力|\bchain[- .]of[- .]thought\b/i],
 ['multimodal','多模态','技术方向','',/多模态|视觉理解|视觉能力|\bmultimodal\b|\bvlm\b/i],
 ['image','图像生成','技术方向','',/图像生成|图片生成|文生图|生图|图像编辑|\bimage\s+(?:generation|editing)\b|\bgpt[- ]?images?\b|\bimages\s+\d+(?:\.\d+)?\b|\bseedream\b|\bdall[- .·]?e\b|\bimagen\b|\bflux\b|\bstable\s+diffusion\b|\bmidjourney\b/i],
 ['video','AI 视频','技术方向','',/视频生成|生成视频|文生视频|\bsora\b|\bveo\b|\bseedance\b|\bkling\b|可灵/i],
 ['audio','语音与音频','技术方向','',/语音|音频|\btts\b|\basr\b|\bwhisper\b|\be voice\b/i],
 ['robotics','具身智能','技术方向','',/具身|机器人|\brobotics?\b/i],
 ['opensource','开源模型','技术方向','',/开源(?:(?!工具|框架|系统|平台|SDK|客户端|接口|教程)[^，。；!?！？]){0,40}(?:模型|权重)|(?:模型|权重)(?:(?!工具|框架|系统|平台|SDK|客户端|接口|教程)[^，。；!?！？]){0,40}开源|开放(?:(?!工具|框架|系统|平台|SDK|客户端|接口|教程)[^，。；!?！？]){0,60}权重|\bopen[- ]weights?\b/i],
 ['inference','部署与算力','技术方向','',/推理(?:引擎|服务|加速|部署|算力|成本|速度|延迟|吞吐)|(?:端侧|本地)[^，。；]{0,12}推理|部署|量化|\binference\b|\btpu\b|\bnpu\b|\bvllm\b|\bllama\.cpp\b|算力|\bgpu\b|\btensorrt\b/i],
].map(row=>({id:String(row[0]),name:String(row[1]),group:String(row[2]),provider:String(row[3]),pattern:/** @type {RegExp} */(row[4])}))
export const topicInfo=id=>radarTopics.find(t=>t.id===id)
export const matchesRadarTopic=(event,id)=>!!topicInfo(id)?.pattern.test(String(event?.title||''))
// Presentation-only shortening; originalSourceName remains intact for provenance.
export function compactRadarSource(value){
 const raw=typeof value==='string'?value:value?.articles?.[0]?.originalSourceName||value?.source?.name||'AIHOT'
 const name=String(raw||'AIHOT').trim()
 const social=/^(?:X|Twitter|公众号)[：:]\s*/i.test(name)
 const clean=name.replace(/^(?:X|Twitter|公众号)[：:]\s*/i,'')
  .replace(/[（(][^（）()]*?(?:RSS|网页)[^（）()]*[）)]/gi,'').trim()
 if(social)return clean.replace(/\s*\(@[^)]+\)\s*$/,'').trim()||name
 // A colon separates the outlet from the collector's feed description.
 return clean.split(/[：:]/,1)[0].trim()||name
}
function originalKey(value){
 const canonical=canonicalUrl(value)
 if(canonical)return 'original:'+canonical
 // HTTP and HTTPS can identify different resources. Normalize without upgrading.
 if(typeof value==='string'&&value.startsWith('http://')){
  const normalized=canonicalUrl(value.replace(/^http:/,'https:'))
  if(normalized)return 'original:'+normalized.replace(/^https:/,'http:')
 }
 return ''
}
export function radarEventKeys(event){
 const articles=Array.isArray(event?.articles)?event.articles:[]
 const originals=articles.map(a=>originalKey(a.originalUrl||a.externalOriginalUrl)).filter(Boolean)
 const itemUrls=articles.map(a=>aihotUrl(a.url)&&/^https:\/\/aihot\.news\/items\//.test(a.url)?'item-url:'+canonicalUrl(a.url):'').filter(Boolean)
 const ids=articles.filter(a=>a?.provider==='aihot'&&typeof a.id==='string'&&a.id).map(a=>'item-id:'+a.id)
 const direct=aihotUrl(event?.id)&&/^https:\/\/aihot\.news\/items\//.test(event.id)?['item-url:'+canonicalUrl(event.id)]:[]
 return [...new Set([...originals,...itemUrls,...ids,...direct])]
}
export const radarEventKey=event=>radarEventKeys(event)[0]||''
// Only explicit item identities or original URLs merge; story membership and titles do not.
export function dedupeRadarEvents(events){
 const output=[],byKey=new Map(),removed=new Set()
 const merge=(target,source)=>{
  const seenArticles=new Set(target.articles.map(a=>JSON.stringify(a)))
  for(const article of source.articles||[]){const key=JSON.stringify(article);if(!seenArticles.has(key)){target.articles.push(article);seenArticles.add(key)}}
  target.aliases=[...new Set([...(target.aliases||[]),target.id,...(source.aliases||[]),source.id].filter(Boolean))]
  target.urls=[...new Set([...(target.urls||[]),...(source.urls||[])].filter(Boolean))]
  target.selectionReasons=[...new Set([...(target.selectionReasons||[]),...(source.selectionReasons||[])])]
  const known=new Set((target.sourceStates||[]).map(s=>s.id))
  target.sourceStates=[...(target.sourceStates||[]),...(source.sourceStates||[]).filter(s=>!known.has(s.id)&&known.add(s.id))]
 }
 for(const event of Array.isArray(events)?events:[]){
  const keys=radarEventKeys(event),matches=[...new Set(keys.map(key=>byKey.get(key)).filter(Boolean))]
  if(!matches.length){const next={...event,articles:[...(event.articles||[])]};output.push(next);for(const key of keys)byKey.set(key,next);continue}
  const target=output.find(e=>matches.includes(e))
  for(const prior of matches)if(prior!==target){merge(target,prior);removed.add(prior);for(const [key,entry] of byKey)if(entry===prior)byKey.set(key,target)}
  merge(target,event)
  for(const key of keys)byKey.set(key,target)
 }
 return output.filter(event=>!removed.has(event))
}
// The client can project old public snapshots with the same rules as the collector.
// Never stamp local processing time as a source verification time.
export function rebuildRadarTopics(payloads){
 const seven=payloads?.['radar-selected-7d.json'],hot=payloads?.['radar-hot.json']
 if(!validRadarPayload(seven,'selected')||seven.window!=='7d'||seven.preview)return {}
 const items=dedupeRadarEvents(seven.items),patch={}
 const topics=radarTopics.map(({pattern,...topic})=>{
  const selected=items.filter(event=>matchesRadarTopic(event,topic.id))
  const hasHot=validRadarPayload(hot,'hot')&&!hot.preview
  const events=hasHot?hot.items.filter(h=>matchesRadarTopic(h.event,topic.id)):[]
  patch[`radar-topic-${topic.id}.json`]={schemaVersion:1,type:'topic',window:'7d',checkedAt:seven.checkedAt,hotCheckedAt:hasHot?hot.checkedAt:null,id:topic.id,items:selected,hot:events}
  return {...topic,count:selected.length,latest:selected[0]||null}
 })
 patch['radar-topics.json']={schemaVersion:1,type:'topics',window:'7d',checkedAt:seven.checkedAt,items:topics}
 return patch
}
export const reportKey=(kind,entry)=>kind==='daily'?entry.date:kind==='weekly'?entry.week:entry.month
export const validEdition=(kind,key)=>typeof key==='string'&&({daily:/^\d{4}-\d{2}-\d{2}$/,weekly:/^\d{4}-W\d{2}$/,monthly:/^\d{4}-\d{2}$/})[kind]?.test(key)
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))
export function validRadarEvent(e){
 return typeof e?.id==='string'&&typeof e.title==='string'&&e.title.length>0&&Array.isArray(e.articles)&&e.articles.length>0&&e.articles.every(a=>a?.provider==='aihot'&&typeof a.title==='string'&&typeof a.summary==='string'&&aihotUrl(a.url)&&aihotOriginalUrl(a.originalUrl||a.externalOriginalUrl)&&date(a.publishedAt)&&a.rights?.permissionId===AIHOT_PERMISSION&&a.rights?.evidenceUrl===a.url&&a.rights?.licenseId==='LicenseRef-AIHOT-Written-Permission')
}
export function validRadarPayload(value,type){
 if(value?.schemaVersion!==1||value.type!==type||!date(value.checkedAt))return false
 if(type==='selected')return ['24h','7d'].includes(value.window)&&Array.isArray(value.items)&&value.items.every(e=>validRadarEvent(e)&&e.articles[0].selected===true)
 if(type==='hot')return Array.isArray(value.items)&&new Set(value.items.map(h=>h.rank)).size===value.items.length&&value.items.every(h=>Number.isInteger(h.rank)&&h.rank>0&&h.rank<=10&&validRadarEvent(h.event))
 if(type==='archive')return ['daily','weekly','monthly'].every(kind=>Array.isArray(value[kind])&&value[kind].every(row=>validEdition(kind,row.key)&&typeof row.headline==='string'))
 if(type==='report')return validEdition(value.kind,value.edition)&&value.report?.kind===value.kind&&date(value.report.generatedAt)&&date(value.report.windowStart)&&date(value.report.windowEnd)&&Date.parse(value.report.windowStart)<=Date.parse(value.report.windowEnd)&&aihotUrl(value.report.sourceUrl)&&Array.isArray(value.report.items)&&value.report.items.every(validRadarEvent)
 if(type==='topics')return value.window==='7d'&&Array.isArray(value.items)&&value.items.every(t=>topicInfo(t.id)&&Number.isInteger(t.count)&&t.count>=0&&(!t.latest||validRadarEvent(t.latest)))
 if(type==='topic')return !!topicInfo(value.id)&&value.window==='7d'&&Array.isArray(value.items)&&value.items.every(e=>validRadarEvent(e)&&matchesRadarTopic(e,value.id))&&Array.isArray(value.hot)&&value.hot.every(h=>validRadarEvent(h.event)&&matchesRadarTopic(h.event,value.id))
 return false
}
export function compactRadarLaunch(payloads){
 const selected=payloads['radar-selected-24h.json'],hot=payloads['radar-hot.json'],archive=payloads['radar-archive.json']
 const reports=Object.fromEntries(['daily','weekly'].flatMap(kind=>{const row=archive?.[kind]?.[0],key=row&&`radar-report-${kind}-${row.key}.json`;return key&&payloads[key]?[[key,payloads[key]]]:[]}))
 return {...reports,...(selected?{'radar-selected-24h.json':{...selected,preview:true,items:selected.items.slice(0,5)}}:{}),...(hot?{'radar-hot.json':{...hot,preview:true,items:hot.items.slice(0,3).map(h=>({...h,event:{...h.event,story:h.event.story?{...h.event.story,reports:h.event.story.reports.slice(0,3),related:[],storyline:[]}:null}}))}}:{}),...(archive?{'radar-archive.json':{...archive,preview:true,daily:archive.daily.slice(0,1),weekly:archive.weekly.slice(0,1),monthly:archive.monthly.slice(0,1)}}:{})}
}
