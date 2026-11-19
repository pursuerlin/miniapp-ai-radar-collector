import {canonicalUrl} from './urls.mjs'

export const AIHOT_PERMISSION = 'aihot-mojing-written-2026-11-04'
export const AIHOT_API = 'https://aihot.news/api/v1'
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
export const aihotUrl = value => { const url=canonicalUrl(value); return !!url && /^https:\/\/aihot\.news(?:\/|$)/.test(url) }
export const aihotOriginalUrl = value => !!canonicalUrl(value)||(typeof value==='string'&&value.startsWith('http://')&&!!canonicalUrl(value.replace(/^http:/,'https:')))
const hash = value => { let n=2166136261; for(const char of value)n=Math.imul(n^char.charCodeAt(0),16777619);return (n>>>0).toString(36) }
const clean = value => typeof value==='string'?value.replace(/\r/g,'').trim():''
export const aihotTopic = category => ({'ai-models':'模型','ai-products':'应用',industry:'行业',paper:'研究',tip:'开发',opinion:'观点'})[category] || '其他'
export function aihotRights(url,checkedAt){return {licenseId:'LicenseRef-AIHOT-Written-Permission',permissionId:AIHOT_PERMISSION,provider:'aihot',scope:'text-summary',evidenceUrl:url,licenseUrl:'https://aihot.news/terms',checkedAt,attribution:'导读来源：AIHOT；原报道权利归原作者',modified:'保留 AIHOT 原摘要，未二次改写'}}
export function aihotSource(item,checkedAt){
 const name=clean(item.source?.name)||'来源未标注',url=canonicalUrl(item.links?.original)||(aihotOriginalUrl(item.links?.original)?canonicalUrl(item.links.original.replace(/^http:/,'https:')):null)
 if(!url)throw Error('AIHOT_ORIGINAL_URL_INVALID')
 const host=new URL(url).hostname
 const official=/^(?:www\.)?(openai\.com|anthropic\.com|deepmind\.google|blog\.google|ai\.google|mistral\.ai|cohere\.com|preferred\.jp|api-docs\.deepseek\.com)$/.test(host)
 const haystack=`${name} ${host}`.toLowerCase()
 // A source identity is an outlet; a family is used only for following vendors, never as verification.
 const family=/openai/.test(haystack)?'openai':/anthropic|claude/.test(haystack)?'anthropic':/deepmind|google|gemini/.test(haystack)?'google':/deepseek/.test(haystack)?'deepseek':/moonshot|kimi/.test(haystack)?'moonshot':/qwen|通义|阿里/.test(haystack)?'qwen':/腾讯混元|hunyuan/.test(haystack)?'tencent':/mistral/.test(haystack)?'mistral':`outlet-${hash(name)}`
 return {id:`aihot-${hash(name+'|'+host)}`,name,family,kind:official&&!/hacker|之家|decoder|verge|新闻|热帖/i.test(name)?'official':/X：|Hacker News|社区/.test(name)?'community':'media',url:`https://${host}`,provider:'aihot',rights:aihotRights('https://aihot.news/agent',checkedAt),status:'ok',lastSuccessAt:checkedAt,checkedAt}
}
export function aihotArticle(item,checkedAt,{fallbackTime,sectionLabel}={}){
 if(!item||!clean(item.title)||!aihotUrl(item.links?.aihot)||!aihotOriginalUrl(item.links?.original))throw Error('AIHOT_ITEM_INVALID')
 const source=aihotSource({...item,links:{...item.links,original:item.links.original.replace(/^http:/,'https:')}},checkedAt)
 const sourcePublishedAt=date(item.publishedAt)?item.publishedAt:null
 const discoveredAt=date(item.discoveredAt)?item.discoveredAt:null
 const publishedAt=sourcePublishedAt||discoveredAt||fallbackTime
 if(!date(publishedAt))throw Error('AIHOT_ITEM_TIME_INVALID')
 return {id:clean(item.id)||item.links.aihot.split('/').pop(),title:clean(item.title),originalTitle:clean(item.originalTitle),summary:clean(item.summary),reason:clean(item.reason),url:canonicalUrl(item.links.aihot),originalUrl:canonicalUrl(item.links.original),...(!canonicalUrl(item.links.original)?{externalOriginalUrl:item.links.original}:{}),publishedAt,sourcePublishedAt,discoveredAt,datePrecision:sourcePublishedAt?'source':discoveredAt?'discovered':'report',sourceId:source.id,originalSourceName:source.name,family:source.family,kind:source.kind,provider:'aihot',category:item.category||null,sectionLabel:sectionLabel||'',selected:item.selected===true,contentMode:'licensed-summary',contentType:'news',translationStatus:'original',evidenceRole:'discovery',rights:aihotRights(item.links.aihot,checkedAt)}
}
export function aihotEvent(article,extra={}){
 return {id:article.url,title:article.title,topic:aihotTopic(article.category),publishedAt:article.publishedAt,urls:[article.url,article.originalUrl],articles:[article],familyCount:0,mergeReasons:[],selectionReasons:article.reason?[article.reason]:[],provider:'aihot',sourceStates:[{id:article.sourceId,name:article.originalSourceName,status:'ok',lastSuccessAt:article.rights.checkedAt}],...extra}
}
export function aihotEvents(intelligence){
 const events=[],byOriginal=new Map()
 for(const article of intelligence.articles){
  const key=canonicalUrl(article.originalUrl)||article.externalOriginalUrl||article.url,prior=byOriginal.get(key)
  if(prior){if(!prior.articles.some(a=>a.id===article.id))prior.articles.push(article);continue}
  const event=aihotEvent(article);byOriginal.set(key,event);events.push(event)
 }
 return events
}
const sectionTopic = label => /模型/.test(label)?'模型':/论文|研究/.test(label)?'研究':/行业/.test(label)?'行业':/技巧|观点/.test(label)?'开发':'应用'
export function aihotReport(report,kind,checkedAt){
 if(!report||!date(report.generatedAt)||!date(report.windowStart)||!date(report.windowEnd)||!aihotUrl(report.links?.aihot)||!Array.isArray(report.sections))throw Error('AIHOT_REPORT_INVALID')
 const dateKey=kind==='daily'?report.date:report.periodStart
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey||''))throw Error('AIHOT_REPORT_DATE_INVALID')
 const items=[]
 for(const section of [...report.sections,...(Array.isArray(report.flashes)&&report.flashes.length?[{label:'快讯',items:report.flashes}]:[])]){
  if(!Array.isArray(section.items))throw Error('AIHOT_REPORT_SECTION_INVALID')
  for(const item of section.items){const article=aihotArticle(item,checkedAt,{fallbackTime:report.generatedAt,sectionLabel:section.label});items.push(aihotEvent(article,{topic:sectionTopic(section.label),sectionLabel:section.label,reportSummary:article.summary,reportEdition:dateKey,reportKind:kind}))}
 }
 return {kind,provider:'aihot',start:dateKey,end:kind==='daily'?dateKey:report.periodEnd,edition:kind==='monthly'?report.month:dateKey,week:report.week||null,generatedAt:report.generatedAt,windowStart:report.windowStart,windowEnd:report.windowEnd,sourceUrl:report.links.aihot,headline:report.lead?.title||report.headline||'',overview:report.lead?.leadParagraph||report.overview||'',items,total:items.length,partial:false,itemSourceCount:new Set(items.flatMap(e=>e.articles.map(a=>a.sourceId))).size,topics:[...new Set(items.map(e=>e.topic))].map(topic=>({topic,count:items.filter(e=>e.topic===topic).length})),method:'AIHOT 提供选题、摘要与编排；模境保留来源与报告窗口，关联模型数据。原报道与模型评测分别核对，不将资讯排名当作能力评分。'}
}
export function validAihotData(data){
 if(data?.provider!=='aihot'||data.schemaVersion!==1||!date(data.checkedAt)||!Array.isArray(data.daily)||!Array.isArray(data.weekly)||!Array.isArray(data.hotTopics))return false
 const article=a=>a?.provider==='aihot'&&typeof a.title==='string'&&typeof a.summary==='string'&&aihotUrl(a.url)&&aihotOriginalUrl(a.originalUrl||a.externalOriginalUrl)&&date(a.publishedAt)&&a.rights?.permissionId===AIHOT_PERMISSION&&a.rights?.licenseId==='LicenseRef-AIHOT-Written-Permission'&&a.rights?.provider==='aihot'&&a.rights?.scope==='text-summary'&&a.rights?.evidenceUrl===a.url&&(a.sourcePublishedAt===null||date(a.sourcePublishedAt))
 const story=s=>!s||(typeof s.publicId==='string'&&typeof s.title==='string'&&['active','settled'].includes(s.status)&&typeof s.latest==='string'&&(s.digest===null||typeof s.digest==='string')&&date(s.latestAt)&&Array.isArray(s.reports)&&s.reports.every(r=>typeof r.title==='string'&&typeof r.source?.name==='string'&&date(r.publishedAt)&&aihotUrl(r.links?.aihot)&&(!r.links.original||!!canonicalUrl(r.links.original)))&&Array.isArray(s.storyline)&&Array.isArray(s.related))
 const event=e=>story(e?.story)&&typeof e?.id==='string'&&Array.isArray(e.articles)&&e.articles.length>0&&e.articles.every(article)
 const report=r=>r?.provider==='aihot'&&['daily','weekly'].includes(r.kind)&&date(r.generatedAt)&&date(r.windowStart)&&date(r.windowEnd)&&Date.parse(r.windowStart)<=Date.parse(r.windowEnd)&&aihotUrl(r.sourceUrl)&&Array.isArray(r.items)&&r.items.every(event)
 return new Set(data.hotTopics.map(h=>h.rank)).size===data.hotTopics.length&&data.daily.every(report)&&data.weekly.every(report)&&data.hotTopics.every(h=>Number.isInteger(h.rank)&&h.rank>=1&&h.rank<=10&&event(h.event))
}
