import {createHash} from 'node:crypto'
import {readFile,writeFile,rename} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {PUBLIC_BENCHMARKS,BENCHMARK_EDITIONS,VBENCH_CONFIG_URL,validPublicBenchmarks} from '../src/domain/public-benchmarks.mjs'
const fail=code=>Object.assign(Error(code),{code})
const clean=s=>s.replace(/<[^>]*>/g,'').replace(/\*\*/g,'').trim()
const score=s=>{if(!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(s))throw fail('BENCHMARK_SCORE_INVALID');return Number(s)}
export function parseGenEval(text){
 const section=text.split(/^\| Model \|/m)[1]?.split(/^## /m)[0];if(!section)throw fail('BENCHMARK_STRUCTURE_CHANGED')
 const lines=('Model |'+section).trim().split('\n'),header=lines.shift().replace(/\|$/,'').split('|').map(clean)
 if(header.join('|')!==['Model',...PUBLIC_BENCHMARKS[0].metrics].join('|'))throw fail('BENCHMARK_STRUCTURE_CHANGED')
 return lines.filter(s=>s.includes('|')&&!/^\|?\s*:?-+/.test(s)).map(line=>{const cells=line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(clean);if(cells.length!==header.length)throw fail('BENCHMARK_STRUCTURE_CHANGED');return{name:cells[0],scores:Object.fromEntries(header.slice(1).map((k,i)=>[k,score(cells[i+1])]))}})
}
export function parseVBench(text){
 const tables=[...text.matchAll(/<table\b[^>]*id="RawTable"[^>]*>([\s\S]*?)<\/table>/g)].map(m=>m[1]);if(tables.length!==2)throw fail('BENCHMARK_STRUCTURE_CHANGED')
 const rows=new Map()
 for(const table of tables){const header=[...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>clean(m[1]));if(header[0]!=='Model'||header.length!==9)throw fail('BENCHMARK_STRUCTURE_CHANGED')
  for(const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>clean(m[1]));if(!cells.length)continue;if(cells.length!==9)throw fail('BENCHMARK_STRUCTURE_CHANGED');const row=rows.get(cells[0])||{name:cells[0],scores:{}};for(let i=1;i<9;i++){if(row.scores[header[i]]!==undefined)throw fail('BENCHMARK_DUPLICATE');row.scores[header[i]]=score(cells[i])}rows.set(row.name,row)}
 }return [...rows.values()]
}
// Match headers rather than Gradio component IDs, which change when the Space is edited.
export function parseVBenchEdition(config,def){
 if(!Array.isArray(config?.components))throw fail('BENCHMARK_STRUCTURE_CHANGED')
 const tables=config.components.filter(c=>c.type==='dataframe').map(c=>c.props?.value).filter(v=>Array.isArray(v?.headers)&&def.metrics.every(k=>v.headers.includes(k)))
 if(tables.length!==1)throw fail('BENCHMARK_STRUCTURE_CHANGED')
 const table=tables[0],headers=table.headers
 if(new Set(headers).size!==headers.length||!Array.isArray(table.data)||table.data.length>500)throw fail('BENCHMARK_STRUCTURE_CHANGED')
 const rows=table.data.map(cells=>{
  if(!Array.isArray(cells)||cells.length!==headers.length)throw fail('BENCHMARK_STRUCTURE_CHANGED')
  const get=k=>cells[headers.indexOf(k)],plain=value=>String(value??'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/<[^>]*>/g,'').trim()
  const name=plain(cells[0]),evaluatedAt=plain(get('Date')),evaluatedBy=plain(get('Evaluated by')),sampledBy=plain(get('Sampled by'))
  if([name,evaluatedBy,sampledBy].some(s=>!s||s.length>=200)||!/^\d{4}-\d{2}-\d{2}$/.test(evaluatedAt)||!Number.isFinite(Date.parse(evaluatedAt))||new Date(evaluatedAt).toISOString().slice(0,10)!==evaluatedAt||Date.parse(evaluatedAt)>Date.now()+300000)throw fail('BENCHMARK_IDENTITY_INVALID')
  const scores=Object.fromEntries(def.metrics.map(key=>{const raw=get(key);if(raw==='nan'||raw===null)return [key,null];if(typeof raw!=='string'||!/^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)%$/.test(raw))throw fail('BENCHMARK_SCORE_INVALID');return [key,Number((Number(raw.slice(0,-1))/100).toFixed(8))]}))
  if(Object.values(scores).every(v=>v===null))throw fail('BENCHMARK_SCORE_INVALID')
  const id=createHash('sha256').update(JSON.stringify([name,evaluatedAt,evaluatedBy,sampledBy])).digest('hex').slice(0,24)
  return {id,name,evaluatedAt,evaluatedBy,sampledBy,evaluationScope:evaluatedBy==='VBench Team'?'team':'submitter',scores}
 })
 if(!rows.length||new Set(rows.map(r=>r.id)).size!==rows.length)throw fail('BENCHMARK_COVERAGE_INVALID')
 return rows.sort((a,b)=>(b.scores['Total Score']??-1)-(a.scores['Total Score']??-1)||a.id.localeCompare(b.id))
}
async function readResponse(response){
 if(!response.ok)throw fail('BENCHMARK_HTTP_'+response.status)
 const reader=response.body.getReader(),parts=[];let size=0
 for(;;){const {done,value}=await reader.read();if(done)break;if((size+=value.length)>2000000){await reader.cancel();throw fail('BENCHMARK_PAYLOAD_TOO_LARGE')}parts.push(value)}
 return Buffer.concat(parts).toString('utf8')
}
async function fetchBenchmarkText(url,fetcher,wait){
 for(let attempt=0;;attempt++)try{
  return await readResponse(await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'}))
 }catch(error){
  const retryable=/^BENCHMARK_HTTP_50[0234]$/.test(error.code||'')||!/^BENCHMARK_/.test(error.code||'')&&['TypeError','TimeoutError','AbortError'].includes(error.name)
  if(attempt||!retryable)throw error
  await wait(1000)
 }
}
export async function collectVBenchEditions({previous=[],fetcher=fetch,now=()=>new Date().toISOString(),cacheMaxAgeMs=fetcher===fetch?24*3600000:0,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(cacheMaxAgeMs>0&&BENCHMARK_EDITIONS.every(def=>previous.some(s=>s.id===def.id&&s.status==='ok'&&Date.parse(now())-Date.parse(s.checkedAt)>=0&&Date.parse(now())-Date.parse(s.checkedAt)<cacheMaxAgeMs)))return previous
 let text,config,error
 try{text=await fetchBenchmarkText(VBENCH_CONFIG_URL,fetcher,wait);config=JSON.parse(text)}catch(e){error=e}
 return BENCHMARK_EDITIONS.map(def=>{
  const old=previous.find(s=>s.id===def.id),checkedAt=now()
  if(old&&Date.parse(old.checkedAt)>Date.parse(checkedAt))return old
  try{
   if(error)throw error
   const rows=parseVBenchEdition(config,def)
   if(old?.rows.length&&rows.length<old.rows.length*.7)throw fail('BENCHMARK_COVERAGE_INVALID')
   if(old?.rows.length&&rows.map(r=>r.evaluatedAt).sort().at(-1)<old.rows.map(r=>r.evaluatedAt).sort().at(-1))throw fail('BENCHMARK_SOURCE_TIME_REGRESSED')
   for(const prior of old?.rows||[]){
    const matches=rows.filter(r=>r.name===prior.name&&r.evaluatedBy===prior.evaluatedBy&&r.sampledBy===prior.sampledBy)
    if(matches.length&&matches.every(r=>r.evaluatedAt<prior.evaluatedAt))throw fail('BENCHMARK_SOURCE_TIME_REGRESSED')
   }
   const contentHash=createHash('sha256').update(JSON.stringify(rows)).digest('hex')
   return {id:def.id,url:def.url,status:'ok',observedAt:old?.contentHash===contentHash?old.observedAt:checkedAt,checkedAt,sourceUpdatedAt:null,contentHash,rows}
  }catch(e){return {...old,id:def.id,url:def.url,status:old?.rows.length?'stale':'unavailable',checkedAt,sourceUpdatedAt:null,rows:old?.rows||[],errorCode:/^BENCHMARK_[A-Z0-9_]+$/.test(e.code||'')?e.code:'BENCHMARK_COLLECTION_FAILED'}}
 })
}
export async function collectPublicBenchmarks({previous,fetcher=fetch,now=()=>new Date().toISOString(),cacheMaxAgeMs=fetcher===fetch?24*3600000:0,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const sources=[]
 for(const def of PUBLIC_BENCHMARKS){const old=validPublicBenchmarks(previous)?previous.sources.find(s=>s.id===def.id):null
  if(old&&Date.parse(old.checkedAt)>Date.parse(now())){sources.push(old);continue}
  if(cacheMaxAgeMs>0&&old?.status==='ok'&&Date.parse(now())-Date.parse(old.checkedAt)>=0&&Date.parse(now())-Date.parse(old.checkedAt)<cacheMaxAgeMs){sources.push(old);continue}
  try{const text=await fetchBenchmarkText(def.dataUrl,fetcher,wait),rows=def.id==='geneval'?parseGenEval(text):parseVBench(text);if(!rows.length||rows.some(r=>Object.keys(r.scores).length!==def.metrics.length)||new Set(rows.map(r=>r.name)).size!==rows.length||old&&rows.length<old.rows.length*.7)throw fail('BENCHMARK_COVERAGE_INVALID');sources.push({id:def.id,url:def.url,status:'ok',observedAt:old&&JSON.stringify(old.rows)===JSON.stringify(rows)?old.observedAt:now(),checkedAt:now(),sourceUpdatedAt:null,contentHash:createHash('sha256').update(text).digest('hex'),rows})
  }catch(error){sources.push({...old,id:def.id,url:def.url,status:old?.rows.length?'stale':'unavailable',checkedAt:now(),sourceUpdatedAt:null,rows:old?.rows||[],errorCode:/^BENCHMARK_[A-Z0-9_]+$/.test(error.code||'')?error.code:'BENCHMARK_COLLECTION_FAILED'})}
 }const editions=await collectVBenchEditions({previous:validPublicBenchmarks(previous)?previous.editions:[],fetcher,now,cacheMaxAgeMs,wait})
 const data={schemaVersion:1,sources,editions};if(!validPublicBenchmarks(data))throw fail('BENCHMARK_OUTPUT_INVALID');return data
}
export async function collectPublicBenchmarksFile({root=process.cwd()}={}){const file=resolve(root,'src/data/media-leaderboards.json'),media=JSON.parse(await readFile(file,'utf8'));media.publicBenchmarks=await collectPublicBenchmarks({previous:media.publicBenchmarks});await writeFile(file+'.next',JSON.stringify(media)+'\n');await rename(file+'.next',file);console.log(JSON.stringify(media.publicBenchmarks.sources.map(s=>({id:s.id,status:s.status,rows:s.rows.length}))))}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)collectPublicBenchmarksFile().catch(e=>{console.error(e.code||e.message);process.exitCode=1})
