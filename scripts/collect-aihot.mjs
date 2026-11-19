import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {AIHOT_API,aihotArticle,aihotEvent,aihotReport,aihotSource,aihotUrl,validAihotData} from '../src/domain/aihot.mjs'
import {validIntelligence} from '../src/domain/intelligence.mjs'
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let nextAihotRequestAt=0
const read=async file=>{try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return {};throw e}}
export function createAihotClient({fetcher=fetch,cache={},now=Date.now(),wait=pause}={}){
 return {cache,async get(path,{maxAge=0,optional404=false}={}){
  const url=path.startsWith('https://')?path:AIHOT_API+path
  if(!aihotUrl(url)||!new URL(url).pathname.startsWith('/api/v1/'))throw Error('AIHOT_ENDPOINT_INVALID')
  const old=cache[url]
  if(old&&now-old.checkedAt<maxAge)return old.body
  for(let attempt=0;attempt<3;attempt++){
   let response
   try{
    if(fetcher===globalThis.fetch){const reserved=Math.max(Date.now(),nextAihotRequestAt);nextAihotRequestAt=reserved+1300;await wait(Math.max(0,reserved-Date.now()))}
    response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'Mojing-AI-Radar/0.4 (+https://github.com/pursuerlin/miniapp-ai-radar)',...(old?.etag?{'If-None-Match':old.etag}:{})},signal:AbortSignal.timeout(25000)})
   }
   catch(error){if(attempt===2)throw error;await wait(700*(attempt+1));continue}
   if(response.status===304){if(!old)throw Error('AIHOT_304_WITHOUT_CACHE');cache[url]={...old,checkedAt:now};return old.body}
   if(response.status===404&&optional404){delete cache[url];return null}
   if(response.status===429||response.status>=500){
    const retry=Number(response.headers.get('retry-after'))
    if(attempt===2||(Number.isFinite(retry)&&retry>8))throw Error(`AIHOT_HTTP_${response.status}`)
    await wait(Math.max(800*(attempt+1),Number.isFinite(retry)?retry*1000:0));continue
   }
   if(!response.ok)throw Error(`AIHOT_HTTP_${response.status}`)
   const text=await response.text()
   if(Buffer.byteLength(text)>12e6)throw Error('AIHOT_PAYLOAD_TOO_LARGE')
   const body=JSON.parse(text)
   if(body.schemaVersion!==1)throw Error('AIHOT_SCHEMA_CHANGED')
   cache[url]={body,etag:response.headers.get('etag')||'',checkedAt:now}
   return body
  }
 }}
}
export async function fetchAihotItems(client){
 const items=[],ids=new Set(),cursors=new Set();let cursor=''
 for(let page=0;page<100;page++){
  const query=new URLSearchParams({mode:'all',window:'7d',limit:'100',...(cursor?{cursor}:{})})
  const data=await client.get('/items?'+query)
  if(!Array.isArray(data.items)||typeof data.page?.hasMore!=='boolean')throw Error('AIHOT_ITEMS_PAGE_INVALID')
  for(const item of data.items){if(!item.id||ids.has(item.id))continue;ids.add(item.id);items.push(item)}
  if(!data.page.hasMore)return items
  cursor=data.page.nextCursor
  if(!cursor||cursors.has(cursor))throw Error('AIHOT_CURSOR_NOT_ADVANCING')
  cursors.add(cursor)
 }
 throw Error('AIHOT_PAGE_LIMIT')
}
const mapLimit=async(values,limit,fn)=>{const result=[];for(let i=0;i<values.length;i+=limit)result.push(...await Promise.all(values.slice(i,i+limit).map(fn)));return result}
export async function collectAihot({client,now=new Date().toISOString(),write=true}={}){
 const cachePath='.cache/aihot/http.json'
 const api=client||createAihotClient({cache:await read(cachePath),now:Date.parse(now)})
 const previous=await read('src/data/intelligence.json')
 const [raw,dailyIndex,weeklyIndex,hot]=await Promise.all([fetchAihotItems(api),api.get('/dailies?limit=14').catch(()=>null),api.get('/weeklies?limit=5').catch(()=>null),api.get('/hot-topics').catch(()=>null)])
 for(const index of [dailyIndex,weeklyIndex,hot])if(index&&(!Array.isArray(index.items)||index.count!==index.items.length))throw Error('AIHOT_INDEX_INVALID')
 const prior=previous.aihot
 // Failure of an optional module retains that module, never a partial set of pages.
 const modules={};let partial=false
 async function module(name,load,fallback){
  try{const value=await load();modules[name]={status:'ok',checkedAt:now,lastSuccessAt:now};return value}
  catch(error){if(!fallback)throw error;partial=true;modules[name]={status:'stale',checkedAt:now,lastSuccessAt:prior?.modules?.[name]?.lastSuccessAt||previous.collectedAt,error:'上游内容暂不可用，保留上次成功版本'};return fallback}
 }
 const reports=async(kind,index)=>{if(!index)throw Error('AIHOT_REPORT_INDEX_UNAVAILABLE');return mapLimit(index.items,3,async(entry,indexNo)=>{
  const key=kind==='daily'?entry.date:entry.week
  if(!/^(?:\d{4}-\d{2}-\d{2}|\d{4}-W\d{2})$/.test(key||''))throw Error('AIHOT_REPORT_INDEX_INVALID')
  const data=await api.get(`/${kind==='daily'?'dailies':'weeklies'}/${key}`,{maxAge:indexNo===0?0:6*3600e3,optional404:true})
  return data?aihotReport(data.report,kind,now):null
 }).then(rows=>rows.filter(Boolean))}
 const [daily,weekly]=await Promise.all([module('daily',()=>reports('daily',dailyIndex),prior?.daily),module('weekly',()=>reports('weekly',weeklyIndex),prior?.weekly)])
 if(!daily.length||!weekly.length)throw Error('AIHOT_REPORTS_EMPTY')
 const allArticles=raw.map(item=>aihotArticle(item,now))
 const byUrl=new Map(allArticles.map(a=>[a.url,a]))
 for(const report of [...daily,...weekly])for(const event of report.items){
  const existing=byUrl.get(event.id)
  if(existing){event.articles=[{...existing,summary:event.reportSummary}];event.publishedAt=existing.publishedAt;event.sourceStates=[{id:existing.sourceId,name:existing.originalSourceName,status:'ok',lastSuccessAt:now}]}
 }
 const hotTopics=await module('hot',async()=>{if(!hot)throw Error('AIHOT_HOT_UNAVAILABLE');return mapLimit(hot.items,3,async(item)=>{
  if(!Number.isInteger(item.rank)||item.rank<1||item.rank>10)throw Error('AIHOT_HOT_RANK_INVALID')
  let story=null,storyStatus='unavailable'
  if(item.links?.story){
   const storyUrl=new URL(item.links.story)
   if(storyUrl.hostname!=='aihot.news'||!/^\/story\/[^/]+$/.test(storyUrl.pathname))throw Error('AIHOT_STORY_LINK_INVALID')
   try{const response=await api.get('/stories/'+encodeURIComponent(storyUrl.pathname.split('/').pop()),{optional404:true});story=response?.story||null;storyStatus=story?'ok':'unavailable'}catch{partial=true;storyStatus='stale'}
  }
  const existing=byUrl.get(item.links?.aihot)
  // Hot topics have no publication timestamp; latestAt is event activity, not original publication.
  const article=existing||aihotArticle({...item,discoveredAt:item.latestAt},now)
  const event=aihotEvent(article,{id:item.links?.story||article.url,story,storyStatus})
  if(existing)event.topic=aihotEvent(existing).topic
  return {rank:item.rank,id:item.id,title:item.title,sourceCount:item.sourceCount,signalCount:item.signalCount,latestAt:item.latestAt,event}
 })},prior?.hotTopics)
 const sources=new Map()
 for(const article of allArticles){const item=raw.find(x=>x.id===article.id);const source=aihotSource(item,now);sources.set(source.id,source)}
 const sourceRows=[...sources.values()].map(s=>({...s,count:allArticles.filter(a=>a.sourceId===s.id).length,limit:allArticles.filter(a=>a.sourceId===s.id).length,latestPublishedAt:allArticles.filter(a=>a.sourceId===s.id).reduce((v,a)=>!v||a.publishedAt>v?a.publishedAt:v,null)}))
 const aihot={schemaVersion:1,provider:'aihot',checkedAt:now,hotCheckedAt:modules.hot.status==='ok'?now:prior.hotCheckedAt,modules,partial,daily,weekly,hotTopics,coverage:{window:'7d',items:raw.length},notice:'AIHOT 授权供给；摘要、推荐理由与编排来自 AIHOT，原报道来源和链接保留。'}
 const data={schemaVersion:1,rightsVersion:1,collectedAt:now,sources:sourceRows,articles:allArticles,aihot}
 if(!validAihotData(aihot)||!validIntelligence(data))throw Error('AIHOT_NORMALIZED_DATA_INVALID')
 if(write){
  await mkdir('src/data',{recursive:true});await writeFile('src/data/intelligence.next.json',JSON.stringify(data));await rename('src/data/intelligence.next.json','src/data/intelligence.json')
  await mkdir('.cache/aihot',{recursive:true});await writeFile(cachePath,JSON.stringify(Object.fromEntries(Object.entries(api.cache).filter(([,entry])=>Date.parse(now)-entry.checkedAt<7*864e5))))
 }
 console.log(`AIHOT：${allArticles.length} 条近7天动态，${daily.length} 期日报，${weekly.length} 期周报，${hotTopics.length} 个热点${partial?'（部分模块降级）':''}`)
 return data
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)collectAihot().catch(error=>{console.error(error.message);process.exitCode=1})
