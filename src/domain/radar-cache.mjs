import {validRadarPayload,validEdition,topicInfo} from './radar-content.mjs'
import {validRadarSearchIndex} from './radar-search.mjs'
export function radarFileType(file){
 if(file==='radar-search.json')return 'search'
 if(/^radar-selected-(24h|7d)\.json$/.test(file))return 'selected'
 if(file==='radar-hot.json')return 'hot'
 if(file==='radar-archive.json')return 'archive'
 if(file==='radar-topics.json')return 'topics'
 const report=file.match(/^radar-report-(daily|weekly|monthly)-(.+)\.json$/)
 if(report&&validEdition(report[1],report[2]))return 'report'
 const topic=file.match(/^radar-topic-([a-z]+)\.json$/)
 return topic&&topicInfo(topic[1])?'topic':''
}
export function validRadarFile(file,value){
 const type=radarFileType(file)
 if(type==='search')return validRadarSearchIndex(value)
 if(!type||!validRadarPayload(value,type))return false
 if(type==='selected')return file===`radar-selected-${value.window}.json`
 if(type==='topic')return file===`radar-topic-${value.id}.json`
 if(type==='report')return file===`radar-report-${value.kind}-${value.edition}.json`
 return true
}
export function createRadarCache({request,now=Date.now,initial={},persist=(_entries)=>{},maxBytes=1500000,maxEntries=10}){
 const entries={},pending=new Map(),blockedUntil={}
 for(const [file,entry] of Object.entries(initial))if(validRadarFile(file,entry?.data)&&Number.isFinite(entry?.fetchedAt))entries[file]=entry
 const trim=()=>{const files=Object.keys(entries).sort((a,b)=>entries[b].usedAt-entries[a].usedAt);let bytes=0,kept=0;for(const file of files){const size=encodeURIComponent(JSON.stringify(entries[file])).replace(/%[A-F\d]{2}/g,'x').length;if(kept>=maxEntries||bytes+size>maxBytes)delete entries[file];else{bytes+=size;kept++}}}
 const save=()=>{trim();try{persist(entries)}catch{/* In-memory content remains usable when storage is full. */}}
 trim()
 return {entries,peek(file){const entry=entries[file];if(entry)entry.usedAt=now();return entry?.data||null},async get(file,{force=false}={}){
  if(!radarFileType(file))throw Error('RADAR_PATH_INVALID')
  if(pending.has(file))return pending.get(file)
  const old=entries[file],ttl=file==='radar-search.json'?4*3600e3:file==='radar-archive.json'?30*60e3:5*60e3
  if(!force&&old&&!old.data.preview&&now()-old.fetchedAt<ttl)return {data:old.data,status:'ready'}
  if((blockedUntil[file]||0)>now())return {data:old?.data||null,status:'offline'}
  const task=(async()=>{
   try{
    const response=await request(file,old?.etag||'')
    if(response.statusCode===404){delete entries[file];save();return {data:null,status:'missing'}}
    if(response.statusCode===429){const header=response.header||{};blockedUntil[file]=now()+Math.max(1000,Number(header['Retry-After']||header['retry-after']||60)*1000);throw Error('RATE_LIMITED')}
    if(response.statusCode===304&&old){old.fetchedAt=now();old.usedAt=now();save();return {data:old.data,status:'ready'}}
    if(response.statusCode!==200||!validRadarFile(file,response.data))throw Error('RADAR_RESPONSE_INVALID')
    if(old&&Date.parse(response.data.checkedAt)<Date.parse(old.data.checkedAt))return {data:old.data,status:'offline'}
    const header=response.header||{}
    entries[file]={data:response.data,etag:header.ETag||header.etag||'',fetchedAt:now(),usedAt:now()};save()
    return {data:response.data,status:'ready'}
   }catch{return {data:old?.data||null,status:'offline'}}
   finally{pending.delete(file)}
  })()
  pending.set(file,task);return task
 }}
}
