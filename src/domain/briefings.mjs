import {canonicalUrl,groupNews} from './intelligence.mjs'
import {compareEditorial,isAiRelevant,digestTitle,customerStoryTitle,personnelTitle} from './news-policy.mjs'
import {isModelBoundaryCharacter} from './unicode-compatible.mjs'
const DAY=86400000,OFFSET=8*3600000
export const chinaDay=value=>new Date(Date.parse(value)+OFFSET).toISOString().slice(0,10)
const startOfDay=day=>{const [y,m,d]=day.split('-').map(Number);return Date.UTC(y,m-1,d)-OFFSET}
const dayAt=ms=>new Date(ms+OFFSET).toISOString().slice(0,10)
export function weekBounds(day){const start=startOfDay(day);const weekday=(new Date(start+OFFSET).getUTCDay()+6)%7;const monday=start-weekday*DAY;return{start:dayAt(monday),end:dayAt(monday+6*DAY)}}
const order=['模型','价格','开发','应用','研究']
// Roundups, vendor customer stories and personnel moves stay in the full index but
// would otherwise take editorial slots from model, product and pricing changes.
export function isEditorialNoise(event){const title=String(event?.title||'');return digestTitle.test(title)||customerStoryTitle.test(title)||personnelTitle.test(title)}
function selectDiverse(events,max,{sourceLimit=2,researchLimit=1}={}){
 const result=[],used=new Set(),counts={}
 const priority=[...events].sort(compareEditorial)
 const eligible=e=>(counts[e.articles[0].sourceId]||0)<sourceLimit&&(e.topic!=='研究'||result.filter(item=>item.topic==='研究').length<researchLimit)
 const add=e=>{result.push(e);used.add(e.id);const id=e.articles[0].sourceId;counts[id]=(counts[id]||0)+1}
 for(const topic of order){const e=priority.find(e=>e.topic===topic&&eligible(e));if(e&&result.length<max)add(e)}
 for(const e of priority){if(result.length>=max)break;if(!used.has(e.id)&&eligible(e))add(e)}
 return result
}
export function buildBriefing(intelligence,{kind='daily',day=chinaDay(intelligence.collectedAt)}={}){
 if(intelligence.aihot){
  const reports=kind==='weekly'?intelligence.aihot.weekly:intelligence.aihot.daily
  return reports.find(r=>r.start===day)||{kind,start:day,end:day,provider:'aihot',items:[],topics:[],total:0,itemSourceCount:0,partial:false,generatedAt:intelligence.collectedAt,method:'该日期暂无已发布的 AIHOT 报告。'}
 }
 const now=Date.parse(intelligence.collectedAt);const bounds=kind==='weekly'?weekBounds(day):{start:day,end:day}
 const start=startOfDay(bounds.start),end=startOfDay(bounds.end)+DAY
 // Filter articles before grouping: reports cannot borrow evidence from outside the period.
 const articles=intelligence.articles.filter(a=>{const t=Date.parse(a.publishedAt);return Number.isFinite(t)&&t>=start&&t<end&&t<=now&&canonicalUrl(a.url)})
 const events=groupNews(articles,now)
 // This is an AI radar: broad tech headlines can remain in the feed, but only
 // items with an explicit AI/model signal should occupy editorial slots.
 const relevant=events.filter(event=>isAiRelevant(event)&&!isEditorialNoise(event))
 const selected=kind==='weekly'?order.flatMap(topic=>selectDiverse(relevant.filter(e=>e.topic===topic),2)):selectDiverse(relevant,10,{sourceLimit:4,researchLimit:2})
 if(kind==='daily')selected.sort(compareEditorial)
 const items=selected.map(e=>({...e,sourceStates:e.articles.map(a=>{const s=intelligence.sources.find(s=>s.id===a.sourceId);return{id:a.sourceId,name:s?.name||a.sourceId,status:s?.status||'unknown',lastSuccessAt:s?.lastSuccessAt||null}})}))
 return{kind,...bounds,generatedAt:intelligence.collectedAt,partial:end>now,total:events.length,itemSourceCount:new Set(items.flatMap(e=>e.articles.map(a=>a.sourceId))).size,items,topics:order.map(topic=>({topic,count:events.filter(e=>e.topic===topic).length})),method:'按北京时间划分；先分散主题，主题内优先直接来源，再按发布、价格、服务变化等标题线索选取，官方与较新内容优先；每日最多10条，同一主来源最多4条、研究最多2条，不足不凑数；每周每主题最多2条，其中研究最多1条。早报汇编、厂商客户案例与人事变动不进精选，仍保留在全部动态。入选依据是规则线索，不代表事实核验或全网重要性；不跨期合并报道。'}
}
export function reportDays(intelligence){if(intelligence.aihot)return intelligence.aihot.daily.map(r=>r.start).sort().reverse();return [...new Set(intelligence.articles.filter(a=>Date.parse(a.publishedAt)<=Date.parse(intelligence.collectedAt)).map(a=>chinaDay(a.publishedAt)))].sort().reverse()}
export function reportWeeks(intelligence){if(intelligence.aihot)return intelligence.aihot.weekly.map(r=>r.start).sort().reverse();return [...new Set([chinaDay(intelligence.collectedAt),...reportDays(intelligence)].map(d=>weekBounds(d).start))].sort().reverse()}
export function relatedCatalogModels(event,models){
 const title=String(event.title||'').toLowerCase()
 const body=event.articles.map(a=>a.summary||'').join(' ').toLowerCase()
 function matches(text){
  const found=models.map(model=>{
   const name=model.name.replace(/^[^:]+: /,'').toLowerCase()
   if(name.length<3||!/[0-9]/.test(name))return null
   let start=text.indexOf(name)
   while(start>=0){
    const before=text[start-1]||'',after=text[start+name.length]||''
    const suffix=text.slice(start+name.length)
    const knownVariant=/^\s+(?:preview|pro|flash|lite|mini|nano|turbo|thinking|instruct|base|fast|max|ultra)\b/i.test(suffix)
    if(!/[a-z0-9_.-]/i.test(before)&&!/[a-z0-9_.-]/i.test(after)&&!knownVariant)return {model,start,end:start+name.length}
    start=text.indexOf(name,start+1)
   }
   return null
  }).filter(Boolean)
  return found.filter(hit=>!found.some(other=>other!==hit&&other.start<=hit.start&&other.end>hit.end)).sort((a,b)=>a.start-b.start||b.end-a.end)
 }
 const titleMatches=matches(title)
 const found=titleMatches.length?titleMatches:matches(body)
 const seen=new Set()
 return found.filter(hit=>{const id=hit.model.id||hit.model.name;const base=String(id).replace(/:(?:free|batch)$/,'');if(seen.has(base))return false;seen.add(base);return true}).slice(0,3).map(hit=>hit.model)
}
