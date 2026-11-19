import {validRadarPayload,validEdition,radarEventKeys,compactRadarSource} from './radar-content.mjs'
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))
export const validSearchFile=file=>typeof file==='string'&&(/^radar-selected-(24h|7d)\.json$/.test(file)||file==='radar-hot.json'||(()=>{const m=file.match(/^radar-report-(daily|weekly|monthly)-(.+)\.json$/);return !!m&&validEdition(m[1],m[2])})())
export function eventsFromRadarFiles(files){
 return Object.entries(files||{}).flatMap(([file,value])=>{
  const rows=value?.type==='report'?value.report?.items:value?.type==='hot'?value.items?.map(h=>h.event):['selected','topic'].includes(value?.type)?value.items:[]
  return (rows||[]).map(event=>({...event,_radarFile:file}))
 })
}
export function buildRadarSearchIndex(payloads){
 const sources=Object.entries(payloads).filter(([file,value])=>validSearchFile(file)&&validRadarPayload(value,value?.type)&&!value.preview)
 const items=eventsFromRadarFiles(Object.fromEntries(sources)).map(event=>({id:event.id,title:event.title,topic:event.topic||'',file:event._radarFile,identity:radarEventKeys(event)[0]||event.id,source:compactRadarSource(event),publishedAt:event.articles?.[0]?.sourcePublishedAt||null,discoveredAt:event.articles?.[0]?.discoveredAt||null}))
 const reports=sources.filter(([,value])=>value.type==='report').map(([,value])=>value.report)
 return {schemaVersion:1,type:'search',checkedAt:sources.map(([,value])=>value.checkedAt).sort()[0]||null,coverage:{from:reports.map(r=>r.windowStart).sort()[0]||null,to:reports.map(r=>r.windowEnd).sort().at(-1)||null,issues:reports.length},items}
}
export function validRadarSearchIndex(value){
 value=decodeRadarSearchIndex(value)
 return value?.schemaVersion===1&&value.type==='search'&&date(value.checkedAt)&&Array.isArray(value.items)&&value.items.length<=50000&&Number.isInteger(value.coverage?.issues)&&value.coverage.issues>=0&&(!value.coverage.from||date(value.coverage.from))&&(!value.coverage.to||date(value.coverage.to))&&value.items.every(row=>typeof row.id==='string'&&row.id.length>0&&row.id.length<4096&&typeof row.title==='string'&&row.title.length>0&&row.title.length<=5000&&typeof row.identity==='string'&&validSearchFile(row.file)&&typeof row.source==='string'&&(!row.publishedAt||date(row.publishedAt))&&(!row.discoveredAt||date(row.discoveredAt)))
}
export function searchIndexEvents(value){value=decodeRadarSearchIndex(value);return validRadarSearchIndex(value)?value.items.map(row=>({id:row.id,title:row.title,topic:row.topic,_radarFile:row.file,_searchOnly:true,_searchKeys:[row.identity,'event:'+row.id],_searchSource:row.source,_searchPublishedAt:row.publishedAt,_searchDiscoveredAt:row.discoveredAt})):[]}

// Transport dictionaries remove repeated issue paths, source names and URL prefixes.
// Keep alternate titles searchable; only exact identity/title copies collapse.
export function encodeRadarSearchIndex(value){
 if(!validRadarSearchIndex(value))throw Error('Invalid search index')
 const files=[],sources=[],seen=new Set(),items=[]
 for(const row of value.items){
  const key=JSON.stringify([row.id,row.title,row.identity])
  if(seen.has(key))continue
  seen.add(key)
  let file=files.indexOf(row.file);if(file<0){file=files.length;files.push(row.file)}
  let source=sources.indexOf(row.source);if(source<0){source=sources.length;sources.push(row.source)}
  items.push([row.id.replace(/^https:\/\/aihot\.news\/items\//,'@'),row.title,row.topic,file,row.identity,source,row.publishedAt,row.discoveredAt])
 }
 return {schemaVersion:1,type:'search',encoding:'tuples-v1',checkedAt:value.checkedAt,coverage:value.coverage,files,sources,items}
}
export function decodeRadarSearchIndex(value){
 if(!value?.encoding)return value
 if(value.encoding!=='tuples-v1'||!Array.isArray(value.files)||value.files.length>1000||!value.files.every(validSearchFile)||!Array.isArray(value.sources)||value.sources.length>10000||!value.sources.every(s=>typeof s==='string')||!Array.isArray(value.items)||value.items.length>50000||value.items.some(r=>!Array.isArray(r)||r.length!==8||typeof r[0]!=='string'||!Number.isInteger(r[3])||!value.files[r[3]]||!Number.isInteger(r[5])||typeof value.sources[r[5]]!=='string'))return null
 return {...value,encoding:undefined,items:value.items.map(r=>({id:r[0].startsWith('@')?'https://aihot.news/items/'+r[0].slice(1):r[0],title:r[1],topic:r[2],file:value.files[r[3]],identity:r[4],source:value.sources[r[5]],publishedAt:r[6],discoveredAt:r[7]}))}
}
