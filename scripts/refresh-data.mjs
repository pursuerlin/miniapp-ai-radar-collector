import {mkdtemp,mkdir,cp,readFile,writeFile,rename,rm,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {spawn} from 'node:child_process'
import {validModelEvidence} from '../src/domain/model-evidence.mjs'
import {validSnapshot} from '../src/domain/snapshot.mjs'
import {validIntelligence} from '../src/domain/intelligence.mjs'
import {validBenchmark,validEvaluations} from '../src/domain/online-data.mjs'
import {buildManifest} from './build-manifest.mjs'
import {selectedCollectionTasks} from './collection-profiles.mjs'
import {syncPublicRadar} from './sync-public-radar.mjs'
import {runCollector} from './collector-retry.mjs'
import {applyEditorial,mergeEditorialEnvelope} from '../src/domain/editorial.mjs'
import {redactCliText} from './redact-diagnostic.mjs'
import {collectorFailure} from './collection-diagnostics.mjs'
import {generateNewsDigests} from './generate-news-digests.mjs'
import {applyNewsDigests} from '../src/domain/news-digests.mjs'
import {validMediaSnapshot} from '../src/domain/media-leaderboards.mjs'

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const read=async path=>JSON.parse(await readFile(path,'utf8'))
const files={catalog:'snapshot.json',intelligence:'intelligence.json',aa:'latest-benchmark.json',livebench:'evaluation-leaderboards.json',media:'media-leaderboards.json'}
const scripts={catalog:'collect.mjs',intelligence:'collect-intelligence.mjs',aa:'collect-benchmark.mjs',livebench:'collect-livebench.mjs',media:'collect-media.mjs'}
const checks={catalog:validSnapshot,intelligence:validIntelligence,aa:validBenchmark,livebench:validEvaluations,media:validMediaSnapshot}
function command(script,cwd){
 return new Promise((resolveResult,reject)=>{
  let stderr=''
  const child=spawn(process.execPath,[join(project,'scripts',script)],{cwd,stdio:['inherit','inherit','pipe']})
  child.stderr.on('data',chunk=>{process.stderr.write(chunk);stderr=(stderr+chunk).slice(-8192)})
  child.on('error',reject)
  child.on('exit',code=>code===0?resolveResult():reject(Object.assign(Error(`${script} exited ${code}`),{stderr})))
 })
}
async function atomicWrite(path,text){await mkdir(dirname(path),{recursive:true});await writeFile(path+'.next',text);await rename(path+'.next',path)}

// The workflow step publishes a step output, so the value arrives as "true"/"false";
// local runs use "1". Accept both, or the review round-trip silently never runs.
export function feishuSyncEnabled(env = process.env) {
 return ['1', 'true'].includes(String(env.FEISHU_SYNC ?? '').trim().toLowerCase())
}

const EDITORIAL_FAILURES={
 BASE_SCOPE_MISSING:'应用缺少 Base 读写权限，需在飞书开放平台补权限',
 BASE_SCHEMA_MISMATCH:'Base 表结构与预期不符，已停止同步',
 EDITORIAL_ROWS_INVALID:'已通过条目不合规，已停止同步',
 BASE_UNREACHABLE:'飞书接口超时或不可达',
 BASE_REQUEST_FAILED:'飞书接口调用失败'
}
// Only a code and a fixed sentence are published: the raw CLI error line carries the
// base token and table id, which must never reach public data.
export function editorialSyncStatus(error) {
 const raw = String(error?.message || error)
 const code = /app_scope_not_applied|has not applied for the required scope/i.test(raw) ? 'BASE_SCOPE_MISSING'
  : /Unexpected Base field|Incomplete field schema|Unexpected URL cell|Pagination did not advance/.test(raw) ? 'BASE_SCHEMA_MISMATCH'
  : /Invalid approved|Conflicting approved|Invalid editorial|Invalid intelligence snapshot/.test(raw) ? 'EDITORIAL_ROWS_INVALID'
  : /ETIMEDOUT|TimeoutError|AbortError|ENOTFOUND|ECONNRESET/.test(raw) ? 'BASE_UNREACHABLE' : 'BASE_REQUEST_FAILED'
 return {status:'failed', code, message:EDITORIAL_FAILURES[code]}
}
export function editorialSyncDetail(error) {
 return redactCliText(error?.message || error).slice(0, 200)
}

export async function runEditorialSync(){throw Error('EDITORIAL_SYNC_PRIVATE')}

// Collect into isolation first. No public or bundled file changes until every
// dataset (new or retained) and the final combined payload pass validation.
export async function refreshAll({root=project,runner=command,now=new Date().toISOString(),profile='all',taskIds,trigger='local',editorialSync=runEditorialSync}={}){
 const selected=selectedCollectionTasks(profile,taskIds)
 const stage=await mkdtemp(join(tmpdir(),'radar-refresh-'))
 try{
  await mkdir(join(stage,'src'),{recursive:true})
  await cp(join(root,'src/data'),join(stage,'src/data'),{recursive:true})
  await mkdir(join(stage,'public/radar'),{recursive:true})
  try{for(const file of await readdir(join(root,'public/radar')))if(/^radar-.*\.json$/.test(file)||file==='practice-resources.json')await cp(join(root,'public/radar',file),join(stage,'public/radar',file))}catch(error){if(error.code!=='ENOENT')throw error}
  try{await cp(join(root,'.cache/aihot'),join(stage,'.cache/aihot'),{recursive:true})}catch(error){if(error.code!=='ENOENT')throw error}
  await mkdir(join(stage,'docs/accuracy-audit/raw'),{recursive:true})
  const before=Object.fromEntries(await Promise.all(Object.entries(files).map(async([id,file])=>[id,await read(join(stage,'src/data',file))])))
  const previousManifest=await read(join(stage,'src/data/manifest.json'))
  const results=await Promise.allSettled(Object.keys(files).map(async id=>{
   if(!selected.includes(id))return [id,{status:'skipped',collectedAt:before[id].collectedAt}]
   const path=join(stage,'src/data',files[id])
   try{
    const execution=await runCollector({id,run:()=>runner(scripts[id],stage)})
    const data=await read(path)
    if(!checks[id](data))throw Error('collector output failed validation')
    if(id==='media'&&data.errors?.length)return [id,{status:'stale',checkedAt:now,collectedAt:data.collectedAt,completedAt:new Date().toISOString(),errorCode:'AA_MEDIA_PARTIAL',lastError:'部分媒体榜更新失败，保留各榜上次有效快照',attempts:execution.attempts}]
    if(['catalog','livebench'].includes(id)){const key=id==='catalog'?'models':'rows';if(before[id][key].length>=30&&data[key].length<before[id][key].length*.6)throw Error('collector output failed validation: coverage collapsed');const priced=rows=>rows.filter(r=>id==='catalog'?typeof r.input==='number'&&typeof r.output==='number':typeof r.cost==='number').length;if(priced(before[id][key])>=10&&priced(data[key])<priced(before[id][key])*.6)throw Error('collector output failed validation: price coverage collapsed')}
    return [id,{status:'ok',checkedAt:now,collectedAt:data.collectedAt,completedAt:new Date().toISOString(),attempts:execution.attempts}]
   }catch(error){
    if(!checks[id](before[id]))throw Error(`${id}: neither collector output nor retained data is valid`)
    const retained=id==='media'?{...before[id],checkedAt:now,boards:before[id].boards.map(board=>({...board,status:'stale',errorCode:'AA_MEDIA_COLLECTION_FAILED'})),errors:before[id].boards.map(board=>({board:board.id,errorCode:'AA_MEDIA_COLLECTION_FAILED'}))}:before[id]
    await writeFile(path,JSON.stringify(retained))
    const diagnostic=collectorFailure(error)
    console.warn(`${id}: ${diagnostic.errorCode}; update failed; retained ${before[id].collectedAt}`)
    // Public diagnostics deliberately exclude raw network URLs and process logs.
    return [id,{status:'stale',checkedAt:now,collectedAt:before[id].collectedAt,message:'本轮更新失败，保留上次有效数据',...diagnostic,completedAt:new Date().toISOString(),attempts:error.attempts||1}]
   }
  }))
  const rejected=results.find(result=>result.status==='rejected')
  if(rejected)throw rejected.reason
  const tasks=Object.fromEntries(results.map(result=>result.value))
  const snapshot=await read(join(stage,'src/data/snapshot.json'))
  let envelope
  try{envelope=await read(join(stage,'src/data/editorial.json'))}catch(error){if(error.code!=='ENOENT')throw error}
  let collected=await read(join(stage,'src/data/intelligence.json'))
  let digestEnvelope={schemaVersion:1,items:[]}
  try{digestEnvelope=await read(join(stage,'src/data/news-digests.json'))}catch(error){if(error.code!=='ENOENT')throw error}
  // Current publishing mode is Feishu review. Never generate public copy in a refresh.
  const digests=await generateNewsDigests(collected,digestEnvelope,{enabled:false})
  if(!collected.aihot)collected=applyNewsDigests(collected,digests.envelope)
  await writeFile(join(stage,'src/data/news-digests.json'),JSON.stringify(digests.envelope))
  console.log(`中文要点：已有 ${digests.envelope.items.length} 条，新增 ${digests.generated} 条，失败 ${digests.failed} 条${digests.enabled?'':'（本轮未启用自动生成）'}`)
  // Heal a legacy gap where intelligence was published with a lead but editorial.json
  // was not saved back, and keep that lead through rounds without a review channel.
  envelope=mergeEditorialEnvelope(envelope,collected)
  let intelligence=collected
  let editorial={status:'skipped'}
  if((!collected.aihot||profile==='approved')&&feishuSyncEnabled(process.env)&&(selected.includes('intelligence')||selected.includes('catalog'))){
   try{
    const result=await editorialSync({intelligence:collected})
    console.log(`飞书导入：本轮新增待审 ${result.pending} 条，实际写入 ${result.created} 条 | 已通过 ${result.approved} 条${result.incomplete?` | ${result.incomplete} 条已通过但缺导读或主题，本轮未发布`:''}`)
    envelope=result.envelope??envelope
    editorial={status:'ok',pending:result.pending,created:result.created,approved:result.approved,incomplete:result.incomplete}
   }catch(error){
    // A broken review channel must not stop the data readers actually use.
    editorial=editorialSyncStatus(error)
    console.warn(`飞书审核同步失败，本轮按未审核状态发布：${editorialSyncDetail(error)}`)
   }
  }
  if(collected.aihot&&envelope)envelope={...envelope,items:envelope.items.filter(item=>collected.articles.some(a=>a.url===item.url)).map(({article,...item})=>item)}
  if(envelope)await writeFile(join(stage,'src/data/editorial.json'),JSON.stringify(envelope))
  // Apply only after the Feishu round-trip, otherwise a catalog-only run pushes the
  // stale envelope back into intelligence and wipes annotations approved this round.
  if(collected.aihot&&envelope)envelope={...envelope,items:envelope.items.filter(item=>collected.articles.some(a=>a.url===item.url)).map(({article,...item})=>item)}
  intelligence=applyEditorial(collected,envelope)
  // All retained payloads have been validated. Publish the failure metadata too,
  // without advancing their collection times; otherwise every failed-only run is
  // forgotten and cannot be scheduled, diagnosed or reported as degraded.
  await writeFile(join(stage,'src/data/intelligence.json'),JSON.stringify(intelligence))
  // News may update even when the catalog/usage collector failed. Keep its
  // own timestamp; never stamp the old catalog with the packaging time.
  snapshot.intelligence=intelligence
  delete snapshot.onlineData
  if(!validSnapshot(snapshot))throw Error('Combined snapshot failed validation')
  await writeFile(join(stage,'src/data/snapshot.json'),JSON.stringify(snapshot))
  if(tasks.intelligence.status==='ok'||editorial.status==='ok')await command('collect-briefings.mjs',stage)
  const benchmark=await read(join(stage,'src/data/latest-benchmark.json'))
  const evaluation=await read(join(stage,'src/data/evaluation-leaderboards.json'))
  const briefings=await read(join(stage,'src/data/briefings.json'))
  const media=await read(join(stage,'src/data/media-leaderboards.json'))
  let research;try{research=await read(join(stage,'src/data/model-evidence.json'))}catch{}
  tasks.research={status:'skipped',collectedAt:research?.collectedAt}
  if(selected.includes('research')){
   try{await runner('collect-model-evidence.mjs',stage);research=await read(join(stage,'src/data/model-evidence.json'));if(!validModelEvidence(research))throw Error('invalid research');tasks.research={status:research.status==='ok'?'ok':'stale',checkedAt:research.checkedAt,collectedAt:research.collectedAt,...(research.status==='ok'?{}:{errorCode:research.errors[0]?.code||'EVIDENCE_PARTIAL',lastError:'部分评测明细尚未核实，保留各条来源时间',retryAfterAt:research.retryAfterAt})}}
   catch(error){console.warn('EVIDENCE_COLLECTION_FAILED; independent sources retained');if(validModelEvidence(research)){research={...research,checkedAt:new Date().toISOString(),status:'stale',errors:[{key:'aihot',code:'EVIDENCE_COLLECTION_FAILED'}]};await writeFile(join(stage,'src/data/model-evidence.json'),JSON.stringify(research))}tasks.research={status:'stale',checkedAt:new Date().toISOString(),collectedAt:research?.collectedAt,errorCode:'EVIDENCE_COLLECTION_FAILED',lastError:'补充评测未更新，其他来源独立展示'}}
  }

  const manifest=buildManifest({snapshot,intelligence,benchmark,evaluation,briefings,media,research,collection:{profile,trigger,tasks,editorial},previousManifest},now)
  await writeFile(join(stage,'src/data/manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  // Use the existing rights, report-consistency and whole-payload gate.
  await command('package-public-data.mjs',stage)
  const radarLaunch=await read(join(stage,'src/data/radar-launch.json')).catch(()=>null)
  const dataFiles=[...new Set([...Object.values(files),'briefings.json','manifest.json','news-digests.json',...(radarLaunch?['radar-launch.json']:[]),...(research?['model-evidence.json']:[]),...(envelope?['editorial.json']:[])])]
  for(const file of dataFiles)await atomicWrite(join(root,'src/data',file),await readFile(join(stage,'src/data',file)))
  try{await cp(join(stage,'.cache/aihot'),join(root,'.cache/aihot'),{recursive:true})}catch(error){if(error.code!=='ENOENT')throw error}
  // The public directory is an allowlist from this run, never an accumulation.
  const publicDir=join(root,'public/radar')
  await syncPublicRadar(join(stage,'public/radar'),publicDir)
  if(tasks.aa.status==='ok'){
   for(const file of ['aa-current.html','aa-current-v3.html']){
    try{const raw=await readFile(join(stage,'docs/accuracy-audit/raw',file));await atomicWrite(join(root,'docs/accuracy-audit/raw',file),raw)}catch(error){if(error.code!=='ENOENT')throw error}
   }
  }
  console.log(`Refresh completed: ${Object.entries(tasks).map(([id,s])=>id+'='+s.status).join(', ')}`)
  return {tasks,manifest}
 }finally{await rm(stage,{recursive:true,force:true})}
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)refreshAll({profile:process.argv[2]||'all',taskIds:process.env.COLLECTION_TASK_IDS,trigger:process.env.COLLECTION_TRIGGER||'local'}).catch(error=>{console.error(error.message);process.exitCode=1})
