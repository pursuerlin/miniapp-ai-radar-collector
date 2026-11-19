import {readFile,writeFile,rename} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {validIntelligence} from '../src/domain/intelligence.mjs'
import {applyPolicy,parseSource,recentArticle} from './intelligence-adapters.mjs'
import {sourceFailure} from './collection-diagnostics.mjs'
export {parseFeed} from './intelligence-adapters.mjs'
const sources=JSON.parse(await readFile(new URL('./config/sources.json',import.meta.url),'utf8'))
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))
export function sourceResult(source,rows,previous,now,error=false){
  const old=previous?.sources?.find(s=>s.id===source.id)
  // Old cache must pass today's rights policy and rolling date window too.
  const articles=(error?(previous?.articles||[]).filter(a=>a.sourceId===source.id):rows)
    .filter(a=>recentArticle(a,Date.parse(now))).map(a=>applyPolicy(a,source)).slice(0,source.limit||20)
  const lastSuccessAt=error?old?.lastSuccessAt||null:now
  return {source:{...source,count:articles.length,status:error?(old?.lastSuccessAt?'stale':'failed'):'ok',lastSuccessAt,
    checkedAt:now,latestPublishedAt:articles.reduce((latest,a)=>!latest||Date.parse(a.publishedAt)>Date.parse(latest)?a.publishedAt:latest,null),
    freshness:!articles.length?'empty':Date.parse(now)-Math.max(...articles.map(a=>Date.parse(a.publishedAt)))>7*864e5?'quiet':'recent',
    lastError:'',...(error?sourceFailure(error):{})},articles}
}
export const sourceTimeout=source=>Number.isFinite(source?.timeoutMs)&&source.timeoutMs>0?source.timeoutMs:20000
export async function fetchSource(source,now,fetcher=fetch){
  const errors=[]
  const urls=[source.url,...(source.fallbackUrls||[])]
  for(const [index,url] of urls.entries()){
    try{
      const rows=parseSource(await fetchText(url,fetcher,sourceTimeout(source)),source,now)
      // Riding on a mirror is a latent risk: log which address actually served the run,
      // otherwise an ok status hides that the primary has been unreachable for days.
      if(index>0)console.log(`${source.id}: 主站未成功，本轮改用第 ${index+1} 个地址（共尝试 ${urls.length} 个）`)
      return rows
    }catch(error){errors.push(error)}
  }
  // Report the primary endpoint's failure. A fallback's error would describe a
  // different page in the health card and send the reader to the wrong diagnosis.
  if(errors.length>1)console.warn(`${source.id}: ${errors.length-1} 个备用地址也未成功（${errors.slice(1).map(e=>e.message).join(' / ').slice(0,160)}）`)
  throw errors[0]||Error('SOURCE_UNAVAILABLE')
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
export async function fetchText(url,fetcher=fetch,timeoutMs=20000){
  for(let attempt=0;attempt<2;attempt++){
    const started=Date.now()
    try{
      const r=await fetcher(url,{signal:AbortSignal.timeout(timeoutMs),headers:{'User-Agent':'Mojing-AI-Radar/0.3 (scheduled source index)','Accept':'application/atom+xml, application/rss+xml, application/json, text/html'}})
      if(!r.ok){const e=Object.assign(Error(`HTTP ${r.status}`),{status:r.status});throw e}
      const reader=r.body.getReader();let size=0;const chunks=[]
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5e6){await reader.cancel();throw Error('PAYLOAD_TOO_LARGE')}chunks.push(value)}
      const elapsed=Date.now()-started
      // A slow success is the warning shot before a timeout; keep the measurement.
      if(elapsed>8000)console.log(`${new URL(url).host}: 慢响应 ${Math.round(size/1024)} KB，用时 ${(elapsed/1000).toFixed(1)} 秒`)
      return Buffer.concat(chunks).toString('utf8')
    }catch(e){
      e.attempts=attempt+1
      // Never hammer rate-limited services. arXiv has one serial request per run.
      if(attempt||e.status===429||e.status>=400&&e.status<500||e.message==='PAYLOAD_TOO_LARGE')throw e
      await pause(3200)
    }
  }
}
export async function collectIntelligence(cacheDir=''){
  if(!cacheDir){const {collectAihot}=await import('./collect-aihot.mjs');const data=await collectAihot();const {collectRadarContent}=await import('./collect-radar-content.mjs');await collectRadarContent();return data}
  let previous;try{previous=JSON.parse(await readFile('src/data/intelligence.json','utf8'))}catch{}
  const collectedAt=new Date().toISOString(),results=[]
  // Bounded concurrency; arXiv occurs once and the job itself never overlaps in CI.
  for(let i=0;i<sources.length;i+=3){
    results.push(...await Promise.all(sources.slice(i,i+3).map(async s=>{
      try{
        const extension=['gemini','deepseek'].includes(s.adapter)?'html':s.adapter==='hn'?'json':'xml'
        const rows=cacheDir?parseSource(await readFile(`${cacheDir}/${s.id}.${extension}`,'utf8'),s,Date.parse(collectedAt)):await fetchSource(s,Date.parse(collectedAt))
        // A structurally valid feed may legitimately have no items in 30 days.
        return sourceResult(s,rows,previous,collectedAt)
      }catch(e){console.warn(`${s.id}: ${e.message}; 继续使用有效期内缓存`);return sourceResult(s,[],previous,collectedAt,e)}
    })))
  }
  // A total outage must not manufacture a newly collected snapshot.
  if(!results.some(r=>r.source.status==='ok'))throw Error('全部来源采集失败，未替换旧快照')
  const data={schemaVersion:1,rightsVersion:1,collectedAt,sources:results.map(r=>r.source),articles:results.flatMap(r=>r.articles)}
  if(!date(data.collectedAt)||!validIntelligence(data))throw Error('资讯快照校验失败，未替换旧数据')
  await writeFile('src/data/intelligence.next.json',JSON.stringify(data));await rename('src/data/intelligence.next.json','src/data/intelligence.json')
  console.log(`${data.articles.length} 条有效索引，${data.sources.filter(s=>s.status==='ok').length}/${sources.length} 个源连通；摘要仅限已核开放许可。`)
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)collectIntelligence(process.argv[2]||'').catch(e=>{console.error(e);process.exitCode=1})
