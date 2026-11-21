import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {validModelEvidence,EVIDENCE_CATEGORIES} from '../src/domain/model-evidence.mjs'
const MAX_EVIDENCE_REQUESTS=110
const hash=s=>createHash('sha256').update(s).digest('hex')
const fail=code=>Object.assign(Error(code),{code})
const clean=s=>s.replace(/<[^>]*>/g,'').replace(/\*\*/g,'').replace(/&amp;/g,'&').trim()
export function markdownTables(text){
 const blocks=[];let current=null
 for(const line of text.split('\n')){if(line.trim().startsWith('|')){const cells=line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(clean);if(cells.every(c=>/^:?-+:?$/.test(c.replace(/\s/g,''))))continue;if(!current){current={header:cells,rows:[]};blocks.push(current)}else{if(cells.length!==current.header.length)throw fail('EVIDENCE_TABLE_TRUNCATED');current.rows.push(cells)}}else current=null}
 return blocks
}
const link=s=>{const m=s.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);if(!m)throw fail('EVIDENCE_LINK_INVALID');return {name:m[1],url:m[2]}}
const numeric=s=>{if(!/^\d+(?:\.\d+)?$/.test(s))throw fail('EVIDENCE_NUMBER_INVALID');return Number(s)}
export function updatedAt(text){const m=text.match(/^- 更新：([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}:[0-9]{2})（北京时间）/m);if(!m)throw fail('EVIDENCE_SOURCE_TIME_UNKNOWN');const stamp=new Date(m[1]+'T'+m[2]+':00+08:00').toISOString();if(Date.parse(stamp)>Date.now()+300000)throw fail('EVIDENCE_SOURCE_TIME_INVALID');return stamp}
export function parseEvidenceIndex(text){
 const stamp=updatedAt(text),tables=markdownTables(text),ranked=tables.find(t=>t.header.join('|')==='名次|模型|厂商|AIHOT 评分|上线日期|官方 API 价格（每百万 Token，输入 / 输出）'),unranked=tables.find(t=>t.header.join('|')==='模型|厂商|AIHOT 评分|原因')
 const count=Number(text.match(/## 排名（共 (\d+) 个模型）/)?.[1]);if(!ranked||!count||ranked.rows.length!==count)throw fail('EVIDENCE_COVERAGE_INVALID')
 const model=(cells,pending=false)=>{const [rank,label,provider,score,release,price]=pending?[null,cells[0],cells[1],cells[2],null,null]:cells;const item=link(label);if(!/^https:\/\/aihot\.news\/leaderboard\/[a-z0-9-]+$/.test(item.url))throw fail('EVIDENCE_IDENTITY_INVALID');return{id:item.url.split('/').pop(),...item,provider,score:numeric(score),rank:pending?null:numeric(rank),rankingNote:pending?cells[3]:'',releaseDate:release&&/^\d{4}-\d{2}-\d{2}$/.test(release)?release:null,priceSummary:price,sourceUpdatedAt:stamp}}
 const models=[...ranked.rows.map(r=>model(r)),...(unranked?.rows||[]).map(r=>model(r,true))];if(new Set(models.map(r=>r.id)).size!==models.length)throw fail('EVIDENCE_DUPLICATE_ID');return {models,sourceUpdatedAt:stamp}
}
export function parseEvidenceDetail(text,row){
 if(![' 评测与 API 价格：',' 评测：'].some(suffix=>text.startsWith('# '+row.name+suffix)))throw fail('EVIDENCE_IDENTITY_INVALID')
 if(!text.includes('- 厂商：'+row.provider+'\n')||!text.includes('- 网页版：'+row.url+'\n'))throw fail('EVIDENCE_IDENTITY_INVALID')
 if(updatedAt(text)!==row.sourceUpdatedAt)throw fail('EVIDENCE_VERSION_MISMATCH')
 const tables=markdownTables(text),rank=tables.find(t=>t.header.join('|')==='榜单|名次|AIHOT 评分|评测数');if(!rank)throw fail('EVIDENCE_STRUCTURE_CHANGED')
 const categories={},categoryRanks={};for(const [name,place,score,count]of rank.rows){if(!EVIDENCE_CATEGORIES.includes(name))throw fail('EVIDENCE_STRUCTURE_CHANGED');numeric(count);if(score==='—')continue;categories[name]=numeric(score);categoryRanks[name]=/^\d+$/.test(place)?numeric(place):null}
 if(categories['综合']!==row.score)throw fail('EVIDENCE_VERSION_MISMATCH')
 const evaluations=[];let category=''
 for(const section of text.split(/(?=^### )/m)){
  const title=section.match(/^### (编程|科研|专业办公|知识问答|真人盲选)/)?.[1];if(!title)continue;category=title==='真人盲选'?'综合':title
  const table=markdownTables(section).find(t=>t.header.join('|')==='评测|机构|测的是什么|公布的成绩|折算分|原榜名次|核实日期|备注');if(!table)throw fail('EVIDENCE_STRUCTURE_CHANGED')
  for(const [label,evaluator,description,raw,normalized,rank,verifiedOn,notes]of table.rows){const item=link(label);evaluations.push({...item,evaluator,description,raw,normalized,rank,verifiedOn,notes,category,acquiredVia:'aihot'})}
 }
 if(!evaluations.length)throw fail('EVIDENCE_DETAILS_EMPTY')
 const declared=rank.rows.find(r=>r[0]==='综合')?.[3];if(!declared||numeric(declared)!==evaluations.length)throw fail('EVIDENCE_DETAIL_COVERAGE_INVALID')
 const prices=(text.split('## 官方 API 价格（每百万 Token）')[1]||'').split('\n## ')[0].split('\n').filter(s=>s.startsWith('- ')).map(s=>s.slice(2))
 return {categories,categoryRanks,evaluations,prices,context:text.match(/^- 上下文：(.+)$/m)?.[1]||null,openWeight:text.match(/^- 开源权重：(有|无)$/m)?.[1]==='有'||/^- 开源权重：\[开源权重\]\(https:\/\/huggingface\.co\/[\w.-]+\/[\w.-]+\)$/m.test(text)?true:text.includes('- 开源权重：无\n')?false:null}
}

// AIHOT documents curl --compressed for its public machine-readable pages.
// Parse HTTP metadata without executing page scripts or following challenge pages.
const runFile=promisify(execFile)
async function curlResponse(url,options={}){
 const args=['--compressed','--silent','--show-error','--max-time','15','--max-filesize','3000000','--dump-header','-']
 if(options.headers?.['If-None-Match'])args.push('-H','If-None-Match: '+options.headers['If-None-Match'])
 if(options.headers?.['Cache-Control'])args.push('-H','Cache-Control: '+options.headers['Cache-Control'])
 args.push(url)
 const {stdout}=await runFile('curl',args,{maxBuffer:3100000,timeout:18000})
 let rest=stdout,status=0,headers={}
 while(rest.startsWith('HTTP/')){
  const end=rest.indexOf('\r\n\r\n');if(end<0)throw fail('EVIDENCE_HTTP_INVALID')
  const block=rest.slice(0,end).split('\r\n');status=Number(block.shift().split(' ')[1]);headers={}
  for(const line of block){const split=line.indexOf(':');if(split>0)headers[line.slice(0,split).toLowerCase()]=line.slice(split+1).trim()}
  rest=rest.slice(end+4)
 }
 if(!status)throw fail('EVIDENCE_HTTP_INVALID')
 return new Response(status===304?null:rest,{status,headers})
}

export function createEvidenceClient({fetcher=curlResponse,wait=ms=>new Promise(r=>setTimeout(r,ms)),interval=3000}={}){
 let next=0,count=0;const cache=new Map()
 return async(path,{revalidate=false}={})=>{
  if(!/^\/leaderboard(?:\.md|\/[a-z0-9-]+\.md|\/rules|\/sources)$/.test(path))throw fail('EVIDENCE_ENDPOINT_INVALID')
  if(++count>MAX_EVIDENCE_REQUESTS)throw fail('EVIDENCE_REQUEST_BUDGET')
  const delay=Math.max(0,next-Date.now());await wait(delay);next=Date.now()+interval
  const url='https://aihot.news'+path,old=cache.get(url);let response
  try{response=await fetcher(url,{headers:{Accept:'text/markdown, text/html;q=0.8','User-Agent':'Mojing-AI-Radar/0.5 (+https://github.com/pursuerlin/miniapp-ai-radar)',...(revalidate?{'Cache-Control':'no-cache'}:{}),...(revalidate&&old?.etag?{'If-None-Match':old.etag}:{})},redirect:'error',signal:AbortSignal.timeout(15000)})}catch{throw fail('EVIDENCE_REQUEST_FAILED')}
  const age=Number(response.headers.get('cache-control')?.match(/(?:s-maxage|max-age)=(\d+)/)?.[1]||0);next=Math.max(next,Date.now()+interval)
  if(response.status===304&&old)return old.text
  if(!response.ok){const error=fail('EVIDENCE_HTTP_'+response.status),retry=response.headers.get('retry-after');if(retry){const delay=/^\d+$/.test(retry)?Date.now()+Number(retry)*1000:Date.parse(retry);if(Number.isFinite(delay))error.retryAfterAt=new Date(Math.max(Date.now(),delay)).toISOString()}throw error}
  const reader=response.body.getReader(),parts=[];let size=0
  for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw fail('EVIDENCE_PAYLOAD_TOO_LARGE')}parts.push(value)}
  const text=Buffer.concat(parts).toString('utf8');if(/^\s*<script/i.test(text))throw fail('EVIDENCE_ACCESS_CHALLENGE');cache.set(url,{text,etag:response.headers.get('etag'),maxAge:age});return text
 }
}
export async function collectModelEvidence({previous,get=createEvidenceClient(),now=()=>new Date().toISOString()}={}){
 const started=now(),indexText=await get('/leaderboard.md'),index=parseEvidenceIndex(indexText),rules=indexText.split('## 排名')[0],sources='AIHOT 官方 Markdown 方法说明'
 if(!rules.includes('各项成绩折算')||!rules.includes('领域加权'))throw fail('EVIDENCE_METHOD_UNVERIFIED')
 if(previous&&validModelEvidence(previous)&&Date.parse(index.sourceUpdatedAt)<Math.max(...previous.models.map(r=>Date.parse(r.sourceUpdatedAt))))throw fail('EVIDENCE_SOURCE_TIME_REGRESSED')
 if(previous&&validModelEvidence(previous)&&index.models.length<previous.models.length*.7)throw fail('EVIDENCE_COVERAGE_COLLAPSED')
 const models=[],errors=[],pending=[]
 let stop=false,retryAfterAt=null
 // Reserve reads for both the initial and final index.
 let retries=Math.max(0,Math.min(8,MAX_EVIDENCE_REQUESTS-index.models.length-2))
 function retainFailure(i,row,prior,error){
  const code=/^EVIDENCE_[A-Z0-9_]+$/.test(error.code||'')?error.code:'EVIDENCE_DETAILS_INVALID'
  errors.push({key:row.id,code})
  if(error.retryAfterAt)retryAfterAt=error.retryAfterAt
  if(/HTTP_429|HTTP_503|ACCESS_CHALLENGE/.test(code))stop=true
  // Only previously verified details from this exact index version can be retained.
  models[i]=prior?.detailStatus==='ok'?{...prior,...row,detailStatus:'stale'}:
   {...row,categories:{},evaluations:[],prices:[],observedAt:started,detailStatus:'missing'}
 }
 async function collectDetail(i,row,path,options){
  const facts=parseEvidenceDetail(await get(path,options),row)
  models[i]={...row,...facts,observedAt:now(),detailStatus:'ok'}
 }
 for(const [i,row] of index.models.entries()){
  const prior=previous?.models?.find(r=>r.id===row.id&&r.name===row.name&&r.provider===row.provider&&
   r.sourceUpdatedAt===row.sourceUpdatedAt&&r.score===row.score)
  if(prior?.detailStatus==='ok'&&prior.categoryRanks&&Date.parse(started)-Date.parse(prior.observedAt)<6*3600000){
   models[i]={...prior,...row}
   continue
  }
  const path='/leaderboard/'+row.id+'.md'
  try{
   if(stop)throw fail('EVIDENCE_SOURCE_THROTTLED')
   await collectDetail(i,row,path)
  }catch(error){
   if(retries>0&&['EVIDENCE_VERSION_MISMATCH','EVIDENCE_REQUEST_FAILED'].includes(error.code)){
    retries--
    pending.push({i,row,prior,path,error})
   }else retainFailure(i,row,prior,error)
  }
 }
 // Retry after reading the other models so lagging detail pages have time to catch up.
 for(const {i,row,prior,path,error} of pending){
  if(stop){retainFailure(i,row,prior,error);continue}
  try{await collectDetail(i,row,path,{revalidate:true})}
  catch(recheckError){retainFailure(i,row,prior,recheckError)}
 }
 // Every detail must match the index generation. An unavailable final check
 // degrades publication; a positively different index invalidates the entire run.
 if(stop)errors.push({key:'index',code:'EVIDENCE_FINAL_CHECK_DEFERRED'})
 else {
  let finalText;try{finalText=await get('/leaderboard.md',{revalidate:true})}catch(error){errors.push({key:'index',code:'EVIDENCE_FINAL_CHECK_UNAVAILABLE'})}
  if(finalText&&JSON.stringify(parseEvidenceIndex(finalText))!==JSON.stringify(index))throw fail('EVIDENCE_VERSION_CHANGED')
 }
 const methodText=(rules+'\n'+sources).replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
 const data={schemaVersion:1,...(retryAfterAt?{retryAfterAt}:{}),collectedAt:started,checkedAt:now(),status:errors.length?'partial':'ok',sourceUrl:'https://aihot.news/leaderboard',rulesUrl:'https://aihot.news/leaderboard/rules',methodHash:hash(methodText),models,errors,provenance:{evaluator:'multiple',acquiredVia:'aihot',indexHash:hash(indexText),sourceUpdatedAt:index.sourceUpdatedAt}}
 if(!validModelEvidence(data))throw fail('EVIDENCE_OUTPUT_INVALID');return data
}
export async function collectModelEvidenceFile({root=process.cwd(),get}={}){
 const file=resolve(root,'src/data/model-evidence.json');let previous;try{previous=JSON.parse(await readFile(file,'utf8'))}catch{}
 try{const data=await collectModelEvidence({previous,get});await mkdir(resolve(root,'src/data'),{recursive:true});await writeFile(file+'.next',JSON.stringify(data)+'\n');await rename(file+'.next',file);console.log(JSON.stringify({models:data.models.length,details:data.models.filter(r=>r.detailStatus==='ok').length,errors:data.errors.length}));return data}
 catch(error){if(!validModelEvidence(previous))throw error;const data={...previous,checkedAt:new Date().toISOString(),status:'stale',errors:[{key:'aihot',code:/^EVIDENCE_[A-Z0-9_]+$/.test(error.code||'')?error.code:'EVIDENCE_COLLECTION_FAILED'}]};await writeFile(file+'.next',JSON.stringify(data)+'\n');await rename(file+'.next',file);console.warn(data.errors[0].code+'; retained previous evidence');return data}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)collectModelEvidenceFile().catch(e=>{console.error(e.code||e.message);process.exitCode=1})
