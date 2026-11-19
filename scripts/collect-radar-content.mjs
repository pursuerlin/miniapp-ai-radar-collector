import {mkdir,readFile,writeFile,readdir,rename,rm} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {createAihotClient} from './collect-aihot.mjs'
import {aihotArticle,aihotEvent,aihotReport} from '../src/domain/aihot.mjs'
import {reportKey,validRadarPayload,compactRadarLaunch,dedupeRadarEvents,rebuildRadarTopics} from '../src/domain/radar-content.mjs'
import {buildRadarSearchIndex,encodeRadarSearchIndex} from '../src/domain/radar-search.mjs'
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const read=async file=>{try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
export async function collectRadarContent({client,now=new Date().toISOString(),wait=pause}={}){
 await mkdir('public/radar',{recursive:true});await mkdir('.cache/aihot',{recursive:true})
 const cache=await read('.cache/aihot/radar-http.json')||{}
 const base=client||createAihotClient({cache,now:Date.parse(now)})
 // All new requests are serial and paced below the documented per-IP limit.
 let lastRequest=0
 const get=async(path,options={})=>{const old=cache['https://aihot.news/api/v1'+path];if(!client&&!(old&&Date.parse(now)-old.checkedAt<(options.maxAge||0))){await wait(Math.max(0,1500-(Date.now()-lastRequest)));lastRequest=Date.now()}const value=await base.get(path,options);if(!client){await writeFile('.cache/aihot/radar-http.json.next',JSON.stringify(base.cache));await rename('.cache/aihot/radar-http.json.next','.cache/aihot/radar-http.json')}return value}
 const payloads={},failures=[]
 const add=(file,data)=>{if(!validRadarPayload(data,data.type))throw Error('RADAR_INVALID_'+file);payloads[file]=data}
 const collect=async(name,run)=>{try{await run()}catch(e){failures.push(name);console.warn(`Radar ${name}: ${e.message}; retained previous module`)}}
 for(const window of ['24h','7d'])await collect('selected-'+window,async()=>{
  const items=[],seen=new Set(),cursors=new Set();let cursor=''
  for(let page=0;page<100;page++){
   const q=new URLSearchParams({mode:'selected',window,limit:'100',...(cursor?{cursor}:{})})
   const data=await get('/items?'+q)
   if(!Array.isArray(data.items)||typeof data.page?.hasMore!=='boolean'||data.query?.mode!=='selected'||data.query?.window!==window)throw Error('SELECTED_PAGE_INVALID')
   for(const raw of data.items){if(!raw.selected)throw Error('NOT_SELECTED');if(seen.has(raw.id))continue;seen.add(raw.id);items.push(aihotEvent(aihotArticle(raw,now)))}
   if(!data.page.hasMore){add(`radar-selected-${window}.json`,{schemaVersion:1,type:'selected',window,checkedAt:now,items:dedupeRadarEvents(items)});return}
   cursor=data.page.nextCursor;if(!cursor||cursors.has(cursor))throw Error('CURSOR_NOT_ADVANCING');cursors.add(cursor)
  }
  throw Error('PAGE_LIMIT')
 })
 await collect('hot',async()=>{
  const intelligence=await read('src/data/intelligence.json')
  if(!intelligence?.aihot?.hotTopics)throw Error('HOT_UNAVAILABLE')
  add('radar-hot.json',{schemaVersion:1,type:'hot',checkedAt:intelligence.aihot.hotCheckedAt,items:intelligence.aihot.hotTopics})
 })
 await collect('archive',async()=>{
  const archive={schemaVersion:1,type:'archive',checkedAt:now,daily:[],weekly:[],monthly:[]}
  for(const [kind,path,limit] of [['daily','dailies',180],['weekly','weeklies',60],['monthly','monthlies',60]]){
   const index=await get(`/${path}?limit=${limit}`)
   if(!Array.isArray(index.items))throw Error('INDEX_INVALID')
   for(const entry of index.items){
    const key=reportKey(kind,entry)
    const filename=`radar-report-${kind}-${key}.json`
    const existing=await read('public/radar/'+filename)
    if(validRadarPayload(existing,'report')&&Date.parse(now)-Date.parse(existing.checkedAt)<6*3600e3){
     payloads[filename]=existing
     archive[kind].push({key,headline:entry.leadTitle||entry.headline||'',start:kind==='daily'?entry.date:entry.periodStart,end:kind==='daily'?entry.date:entry.periodEnd})
     continue
    }
    let raw
    try{raw=await get(`/${path}/${key}`,{maxAge:6*3600e3,optional404:true})}catch(e){
     // An inaccessible issue is retained with its original verification time.
     const previous=await read(`public/radar/radar-report-${kind}-${key}.json`)
     if(validRadarPayload(previous,'report')){payloads[`radar-report-${kind}-${key}.json`]=previous;raw={report:null}}else throw e
    }
    if(!raw)continue
    if(raw.report){const report=aihotReport(raw.report,kind,now);if(reportKey(kind,raw.report)!==key)throw Error('REPORT_ID_MISMATCH');add(filename,{schemaVersion:1,type:'report',kind,edition:key,checkedAt:new Date(cache['https://aihot.news/api/v1'+`/${path}/${key}`]?.checkedAt||Date.parse(now)).toISOString(),report})}
    archive[kind].push({key,headline:entry.leadTitle||entry.headline||'',start:kind==='daily'?entry.date:entry.periodStart,end:kind==='daily'?entry.date:entry.periodEnd})
   }
   console.log(`Radar archive: ${kind} ${archive[kind].length} issues`)
  }
  add('radar-archive.json',archive)
 })
 // A failed module keeps its complete previous snapshot. Successful ones replace it.
 for(const file of await readdir('public/radar'))if(file.startsWith('radar-')&&file.endsWith('.json')&&!payloads[file]){const old=await read('public/radar/'+file);if(validRadarPayload(old,old?.type))payloads[file]=old}
 Object.assign(payloads,rebuildRadarTopics(payloads))
 if(!payloads['radar-selected-24h.json']||!payloads['radar-archive.json'])throw Error('RADAR_CORE_UNAVAILABLE')
 // Withdrawn issues must disappear from the public cache as well as the date picker.
 const archive=payloads['radar-archive.json']
 for(const file of Object.keys(payloads))if(file.startsWith('radar-report-')){const value=payloads[file];if(!archive[value.kind].some(r=>r.key===value.edition)){delete payloads[file];await rm('public/radar/'+file,{force:true})}}
 payloads['radar-search.json']=encodeRadarSearchIndex(buildRadarSearchIndex(payloads))
 for(const [file,data] of Object.entries(payloads)){await writeFile('public/radar/'+file+'.next',JSON.stringify(data)+'\n');await rename('public/radar/'+file+'.next','public/radar/'+file)}
 await writeFile('src/data/radar-launch.json',JSON.stringify(compactRadarLaunch(payloads))+'\n')
 await writeFile('.cache/aihot/radar-http.json',JSON.stringify(base.cache))
 console.log(`Radar: ${Object.keys(payloads).length} shared files${failures.length?' · retained '+failures.join(', '):''}`)
 return payloads
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)await collectRadarContent()
