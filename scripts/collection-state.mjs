import {COLLECTION_TASKS} from './collection-profiles.mjs'
import {metadataRecords} from '../src/domain/media-metadata.mjs'

export const SOURCE_LABELS={catalog:'模型目录与用量',intelligence:'AI 资讯',aa:'Artificial Analysis',livebench:'LiveBench',media:'生图与视频质量榜',research:'AIHOT 模型评测'}
export const SOURCE_MAX_AGE_HOURS={catalog:10,intelligence:2,aa:14,livebench:14,media:6,research:4}
const iso=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():null
const structural=code=>/STRUCTURE_CHANGED|IDENTITY_(MISMATCH|INVALID)|ENDPOINT_MISMATCH|SCHEMA_INVALID|OUTPUT_INVALID|VERSION_UNVERIFIED|DETAILS_UNVERIFIED|REGISTRY|LICENSE|HTTP_40[134]/.test(code||'')
export function nextRetryTime({checkedAt,consecutiveFailures=1,errorCode,retryAfterAt}={}){
 const time=Date.parse(checkedAt);if(!Number.isFinite(time))return null
 const minutes=/EVIDENCE_/.test(errorCode||'')?60:structural(errorCode)?360:[10,30,60,180,360][Math.min(4,Math.max(0,consecutiveFailures-1))]
 return new Date(Math.max(time+minutes*60000,Date.parse(retryAfterAt)||0)).toISOString()
}
export function previousSourceState(manifest,id){
 if(manifest?.sourceHealth?.[id])return manifest.sourceHealth[id]
 const source=id==='aa'||id==='livebench'?manifest?.datasets?.evaluation?.sources?.find(s=>s.id===(id==='aa'?'artificial-analysis':'livebench')):manifest?.datasets?.[id]
 return source?{...source,lastSuccessAt:source.collectedAt,consecutiveFailures:source.status==='stale'?1:0}:null
}
export function sourceQuality(id,payload,previous){
 if(id==='research')return {records:payload?.models?.length||0,details:payload?.models?.filter(r=>r.detailStatus==='ok').length||0,errors:payload?.errors?.length||0}
 if(id==='media'){
  const staleBoards=payload?.boards?.filter(b=>b.status==='stale').length||0,metadataErrors=payload?.metadata?.errors?.length||0,publicBenchmarkErrors=[...(payload?.publicBenchmarks?.sources||[]),...(payload?.publicBenchmarks?.editions||[])].filter(s=>s.status!=='ok').length
  return {boards:payload?.boards?.length||0,records:payload?.boards?.reduce((n,b)=>n+b.rows.length,0)||0,staleBoards,metadataRecords:metadataRecords(payload?.metadata).length,metadataErrors,publicBenchmarkErrors,partial:!!(staleBoards||metadataErrors||publicBenchmarkErrors),errorCode:payload?.metadata?.errors?.[0]?.code,retryAfterAt:payload?.metadata?.errors?.map(e=>e.retryAfterAt).filter(Boolean).sort().at(-1)}
 }
 if(id==='aa'){
  const rows=payload?.rows||[],ranked=rows.filter(r=>r.score!==null),missing=ranked.filter(r=>r.detailStatus!=='verified').length
  const baseline=(previous?.lastHealthyQuality||previous?.quality)?.missingScoredDetails
  return {listed:rows.length,ranked:ranked.length,details:rows.filter(r=>r.detailStatus==='verified').length,missingScoredDetails:missing,
   status:missing?'partial':'complete',regressed:typeof baseline==='number'&&missing>Math.max(baseline+5,Math.ceil(ranked.length*.25))}
 }
 if(id==='intelligence')return {sources:payload?.sources?.length||0,unavailableSources:payload?.sources?.filter(s=>s.status!=='ok').length||0,partial:!!payload?.aihot?.partial,articles:payload?.articles?.length||0}
 const rows=payload?.models||payload?.rows||[],knownPrices=rows.filter(r=>id==='catalog'?typeof r.input==='number'&&typeof r.output==='number':typeof r.cost==='number').length
 const baseline=previous?.lastHealthyQuality?.knownPrices??previous?.quality?.knownPrices
 return {records:rows.length,knownPrices,missingPrices:rows.length-knownPrices,regressed:typeof baseline==='number'&&baseline>=10&&knownPrices<baseline*.6}
}
export function buildSourceHealth({tasks={},previousManifest,payloads={}}){
 return Object.fromEntries(COLLECTION_TASKS.map(id=>{
  const old=previousSourceState(previousManifest,id),task=tasks[id],payload=payloads[id]
  if((task?.status==='skipped'||!task)&&old&&!old.quality){const quality=sourceQuality(id,payload,old);return [id,{...old,quality,lastHealthyQuality:quality}]}
  if(task?.status==='skipped'||!task)return [id,old||{label:SOURCE_LABELS[id],status:'unknown',lastSuccessAt:iso(payload?.collectedAt),consecutiveFailures:0,nextRetryAt:null}]
  const success=task.status==='ok',failures=success?0:(old?.consecutiveFailures||0)+1
  const quality=sourceQuality(id,payload,old),needsRecovery=quality.regressed||id==='media'&&quality.partial,qualityFailures=success&&needsRecovery?(old?.qualityFailures||0)+1:0
  return [id,{label:SOURCE_LABELS[id],status:success?'ok':'stale',collectedAt:task.collectedAt,lastAttemptAt:task.checkedAt,completedAt:task.completedAt||task.checkedAt,
   lastSuccessAt:success?task.collectedAt:old?.lastSuccessAt||task.collectedAt,consecutiveFailures:failures,
   nextRetryAt:success&&!needsRecovery?null:nextRetryTime({...task,errorCode:task.errorCode||quality.errorCode,retryAfterAt:task.retryAfterAt||quality.retryAfterAt,checkedAt:task.completedAt||task.checkedAt,consecutiveFailures:failures||qualityFailures}),qualityFailures,
   ...(success?{}:{errorCode:task.errorCode,lastError:task.lastError}),collectorAttempts:task.attempts||1,
   quality,lastHealthyQuality:success&&!needsRecovery?quality:old?.lastHealthyQuality||old?.quality||quality,...(success&&id==='aa'&&payload?.provenance?.requests?{httpRequests:payload.provenance.requests}:{})}]
 }))
}
export function sourcesNeedingRecovery(manifest,now=Date.now()){
 return COLLECTION_TASKS.filter(id=>{
  const state=previousSourceState(manifest,id);if(!state)return false
  if(state.status==='stale'||state.quality?.regressed||id==='media'&&state.quality?.partial)return !Number.isFinite(Date.parse(state.nextRetryAt))||Date.parse(state.nextRetryAt)<=now
  const age=now-Date.parse(state.lastSuccessAt||state.collectedAt)
  return Number.isFinite(age)&&age>SOURCE_MAX_AGE_HOURS[id]*36e5
 })
}
