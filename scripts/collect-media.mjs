import {collectPublicBenchmarks} from './collect-public-benchmarks.mjs'
import {validMediaMetadata} from '../src/domain/media-metadata.mjs'
import {collectMediaMetadata} from './collect-media-metadata.mjs'
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {MEDIA_BOARDS,validMediaBoard,validMediaSnapshot} from '../src/domain/media-leaderboards.mjs'
const host='https://artificialanalysis.ai'
const fail=code=>Object.assign(Error(code),{code})
const safeText=(v,key,max=200)=>typeof v==='string'&&v.trim()&&v.length<=max&&!v.includes(key)&&!/[\u0000-\u001f]/.test(v)?v.trim():null
export async function collectMedia({apiKey,previous,fetcher=fetch,now=()=>new Date().toISOString(),maxRequests=12}={}){
 if(!apiKey)throw fail('AA_API_KEY_MISSING')
 let requests=0;const boards=[],errors=[]
 for(const definition of MEDIA_BOARDS){
  const old=previous?.boards?.find(b=>b.id===definition.id),rows=[],ids=new Set();let totalPages=null,totalRecords=null
  try{
   for(let page=1;page<=12;page++){
    if(++requests>maxRequests)throw fail('AA_MEDIA_REQUEST_BUDGET')
    let response;try{response=await fetcher(host+definition.endpoint+'?page='+page,{headers:{'x-api-key':apiKey,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)})}catch{throw fail('AA_MEDIA_REQUEST_FAILED')}
    if(!response.ok)throw fail('AA_MEDIA_HTTP_'+response.status)
    let body;try{body=await response.json()}catch{throw fail('AA_MEDIA_JSON_INVALID')}
    if(!Array.isArray(body.data)||!body.data.length)throw fail('AA_MEDIA_SCHEMA_INVALID')
    if(body.pagination){
     const p=body.pagination
     if(p.page!==page||!Number.isInteger(p.total_pages)||p.total_pages<page||p.total_pages>12||typeof p.has_more!=='boolean'||p.has_more!==(page<p.total_pages))throw fail('AA_MEDIA_PAGINATION_INVALID')
     if(totalPages!==null&&p.total_pages!==totalPages)throw fail('AA_MEDIA_PAGINATION_CHANGED')
     totalPages=p.total_pages
     if(p.total!==undefined){if(!Number.isInteger(p.total)||p.total<0||(totalRecords!==null&&p.total!==totalRecords))throw fail('AA_MEDIA_TOTAL_CHANGED');totalRecords=p.total}
    }else if(page!==1)throw fail('AA_MEDIA_PAGINATION_MISSING')
    for(const r of body.data){
     const id=safeText(r.id,apiKey),name=safeText(r.name,apiKey)
     if(!id||!name||ids.has(id))throw fail('AA_MEDIA_IDENTITY_INVALID')
     ids.add(id)
     const provider=safeText(r.model_creator?.name||r.provider?.name||r.provider||'归属待确认',apiKey)
     rows.push({id,name,provider,elo:r.elo,ci95:r.ci_95})
    }
    if(!body.pagination?.has_more)break
   }
   const board={id:definition.id,source:definition.source,collectedAt:now(),status:'ok',rows}
   if(!validMediaBoard(board)||(totalRecords!==null&&rows.length!==totalRecords))throw fail('AA_MEDIA_OUTPUT_INVALID')
   if(old?.rows.length>=10&&rows.length<old.rows.length*.6)throw fail('AA_MEDIA_COVERAGE_COLLAPSED')
   boards.push(board)
  }catch(error){
   const errorCode=/^AA_MEDIA_[A-Z0-9_]+$/.test(error.code||'')?error.code:'AA_MEDIA_OUTPUT_INVALID'
   errors.push({board:definition.id,errorCode})
   if(validMediaBoard(old))boards.push({...old,status:'stale',errorCode})
   // Do not keep spending a throttled or rejected key's quota.
   if(/HTTP_(401|403|429)|REQUEST_BUDGET/.test(errorCode)){
    for(const b of previous?.boards||[])if(!boards.some(v=>v.id===b.id)&&validMediaBoard(b))boards.push({...b,status:'stale',errorCode})
    break
   }
  }
 }
 const data={schemaVersion:1,checkedAt:now(),collectedAt:boards.map(b=>b.collectedAt).sort()[0],boards,errors}
 if(!validMediaSnapshot(data))throw fail(errors[0]?.errorCode||'AA_MEDIA_OUTPUT_INVALID')
 return {data,requests:Math.min(requests,maxRequests)}
}
export async function collectMediaFile({root=process.cwd(),apiKey=process.env.AA_API_KEY,fetcher=fetch,metadataRegistry}={}){
 const file=resolve(root,'src/data/media-leaderboards.json');let previous
 try{previous=JSON.parse(await readFile(file,'utf8'))}catch{}
 const result=await collectMedia({apiKey,previous,fetcher})
 try{
  const registry=metadataRegistry??JSON.parse(await readFile(new URL('./config/media-metadata-registry.json',import.meta.url),'utf8'))
  result.data.metadata=await collectMediaMetadata({registry,media:result.data,previous:previous?.metadata,fetcher})
 }catch(error){
  const code=/^METADATA_[A-Z0-9_]+$/.test(error.code||'')?error.code:'METADATA_COLLECTION_FAILED'
  if(validMediaMetadata(previous?.metadata)){const checkedAt=new Date().toISOString();result.data.metadata={...previous.metadata,checkedAt,records:previous.metadata.records.map(r=>({...r,lastVerifiedAt:r.status==='ok'?r.checkedAt:r.lastVerifiedAt||r.observedAt,checkedAt,status:r.status==='withdrawn'?'withdrawn':'stale'})),documentRecords:(previous.metadata.documentRecords||[]).map(r=>({...r,lastVerifiedAt:r.status==='ok'?r.checkedAt:r.lastVerifiedAt||r.observedAt,checkedAt,status:r.status==='withdrawn'?'withdrawn':'stale'})),officialRecords:(previous.metadata.officialRecords||[]).map(r=>({...r,lastVerifiedAt:r.status==='ok'?r.checkedAt:r.lastVerifiedAt||r.observedAt,checkedAt,status:r.status==='withdrawn'?'withdrawn':'stale'})),errors:[{key:'metadata',code}]}}
  console.warn(code+'; AA boards retained independently')
 }
 result.data.publicBenchmarks=await collectPublicBenchmarks({previous:previous?.publicBenchmarks,fetcher})
 await mkdir(resolve(root,'src/data'),{recursive:true});await writeFile(file+'.next',JSON.stringify(result.data)+'\n');await rename(file+'.next',file)
 console.log(JSON.stringify({requests:result.requests,boards:result.data.boards.map(b=>({id:b.id,records:b.rows.length,status:b.status})),errors:result.data.errors}))
 return result
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)collectMediaFile().catch(error=>{console.error(/^AA_[A-Z0-9_]+$/.test(error.code||'')?error.code:'AA_MEDIA_COLLECTION_FAILED');process.exitCode=1})
