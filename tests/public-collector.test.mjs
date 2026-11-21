import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {parse} from 'yaml'
import {bootstrapPublicData} from '../scripts/bootstrap-public-data.mjs'
import {hasMatchingAaArchive} from '../scripts/aa-source-proof.mjs'
import {collectionHealthReport} from '../scripts/check-collection-health.mjs'
const expected=JSON.parse(await readFile('tests/fixtures/publication-payloads.json','utf8'))
test('bootstrap accepts only validated published state and excludes independently managed operations',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'public-collector-'))
 try{
  const source=resolve(root,'state/data-site/public/radar');await mkdir(source,{recursive:true})
  for(const [name,value] of Object.entries(expected))await writeFile(resolve(source,name),JSON.stringify(value))
  await writeFile(resolve(source,'operations-config-v5.json'),'{}')
  const result=await bootstrapPublicData({root});assert.equal(result.generatedAt,expected['manifest.json'].generatedAt)
  const snapshot=JSON.parse(await readFile(resolve(root,'src/data/snapshot.json'),'utf8'));assert.equal(snapshot.collectedAt,expected['snapshot.json'].collectedAt);assert.deepEqual(snapshot.intelligence,expected['intelligence.json'])
  await assert.rejects(()=>access(resolve(root,'public/radar/operations-config-v5.json')))
  await writeFile(resolve(source,'health.json'),'{}');await assert.rejects(()=>bootstrapPublicData({root}),/HEALTH/)
 }finally{await rm(root,{recursive:true,force:true})}
})
test('a cold or contradictory AA archive cannot be treated as verified source evidence',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'aa-proof-'))
 try{assert.equal(await hasMatchingAaArchive(root),false);await mkdir(resolve(root,'src/data'),{recursive:true});await mkdir(resolve(root,'docs/accuracy-audit/raw'),{recursive:true});await writeFile(resolve(root,'src/data/latest-benchmark.json'),JSON.stringify(expected['latest-benchmark.json']));await writeFile(resolve(root,'docs/accuracy-audit/raw/aa-current.html'),'<html>Sign in</html>');assert.equal(await hasMatchingAaArchive(root),false)}finally{await rm(root,{recursive:true,force:true})}
})
test('public collection uses standard hosted runners, no private checkout, no client build and no general write token',async()=>{
 const workflow=parse(await readFile('.github/workflows/collect.yml','utf8')),job=workflow.jobs.collect
 assert.equal(job['runs-on'],'ubuntu-latest');assert.equal(workflow.permissions.contents,'read');assert.equal(workflow.concurrency['cancel-in-progress'],false)
 for(const step of job.steps){assert.notEqual(step.with?.repository,'pursuerlin/miniapp-ai-radar');assert.ok(!/build:mp-weixin|vue-tsc|npm test/.test(step.run||''))}
 const publisher=job.steps.find(s=>s.name==='Checkout currently published state');assert.equal(publisher.with.repository,'pursuerlin/miniapp-ai-radar-data');assert.match(publisher.with['ssh-key'],/DATA_REPO_DEPLOY_KEY/)
 const verify=job.steps.findIndex(s=>s.name==='Verify deployed public contents')
 const report=job.steps.findIndex(s=>s.name==='Report selected source health')
 assert.ok(verify>=0&&report>verify)
 assert.match(job.steps[report].env.AUTOMATIC_COLLECTION,/schedule.*heartbeat/)
})

test('public data sync preserves the independently published v6 comparison policy',async()=>{
 const {mkdtemp,mkdir,writeFile,readFile,rm}=await import('node:fs/promises')
 const {tmpdir}=await import('node:os'),{resolve}=await import('node:path')
 const {syncPublicRadar}=await import('../scripts/sync-public-radar.mjs')
 const root=await mkdtemp(resolve(tmpdir(),'collector-v6-'))
 try{const from=resolve(root,'from'),to=resolve(root,'to');await mkdir(from);await mkdir(to);await writeFile(resolve(from,'snapshot.json'),'new');await writeFile(resolve(to,'operations-config-v6.json'),'published-policy');await syncPublicRadar(from,to);assert.equal(await readFile(resolve(to,'operations-config-v6.json'),'utf8'),'published-policy')}finally{await rm(root,{recursive:true,force:true})}
})

test('verified automatic runs warn on recoverable source failures and fail on sustained degradation',()=>{
 const now=Date.parse('2026-11-21T08:00:00Z')
 const health={collection:{tasks:{media:{status:'ok'},research:{status:'stale',errorCode:'EVIDENCE_VERSION_MISMATCH'},catalog:{status:'skipped'}}},
  sourceHealth:{media:{qualityFailures:2,quality:{partial:true,errorCode:'METADATA_DOCUMENT_SCHEMA_CHANGED'}},
   research:{consecutiveFailures:1},catalog:{consecutiveFailures:7}}}
 const warning=collectionHealthReport(health,{automatic:true,now})
 assert.equal(warning.status,'degraded')
 assert.deepEqual(warning.issues.map(issue=>[issue.id,issue.code,issue.blocking]),[
  ['media','METADATA_DOCUMENT_SCHEMA_CHANGED',false],['research','EVIDENCE_VERSION_MISMATCH',false],
 ])
 assert.equal(collectionHealthReport(health,{now}).status,'failed')
 health.sourceHealth.media.qualityFailures=3
 assert.equal(collectionHealthReport(health,{automatic:true,now}).status,'failed')
 health.sourceHealth.media.qualityFailures=0
 health.collection.tasks.intelligence={status:'stale'}
 health.sourceHealth.intelligence={lastSuccessAt:'2026-11-21T04:59:00Z',consecutiveFailures:1}
 assert.equal(collectionHealthReport(health,{automatic:true,now}).issues.find(issue=>issue.id==='intelligence').blocking,true)
})
