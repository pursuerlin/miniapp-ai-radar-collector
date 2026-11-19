import {buildChangesFiles} from './build-changes.mjs'
import {writeFile,readFile,appendFile} from 'node:fs/promises'
import {hasMatchingAaArchive} from './aa-source-proof.mjs'
import {chooseScope} from './choose-collection-scope.mjs'
import {refreshAll} from './refresh-data.mjs'
import {collectPracticeResources,createResourceClient,writePracticeResources} from './collect-practice-resources.mjs'
import {validateCandidate} from './validate-public-data.mjs'
import {failedCollectedSources} from './check-collection-health.mjs'
const env=process.env,requested=env.INPUT_PROFILE||'news',manifest=JSON.parse(await readFile('src/data/manifest.json','utf8'))
if(!['all','catalog','news','aa','livebench','media','research','evaluation','skills'].includes(requested))throw Error('COLLECTION_PROFILE_INVALID')
let decision=requested==='skills'?{profile:'news',skip:true,tasks:'',reason:'仅刷新 Skill 与 GitHub'}:chooseScope({eventName:env.EVENT_NAME,schedule:env.EVENT_SCHEDULE,inputProfile:requested,heartbeat:env.HEARTBEAT,manifest})
console.log(`采集范围 ${requested}：${decision.reason}`)
if(decision.skip&&requested!=='skills'){
 await writeFile('.collection-result.json',JSON.stringify({requested,skipped:true,checkedAt:new Date().toISOString()})+'\n')
 if(env.GITHUB_OUTPUT)await appendFile(env.GITHUB_OUTPUT,'publish=false\n')
 process.exit(0)
}
if(requested==='skills'){
 if(!await hasMatchingAaArchive())decision={profile:'aa',skip:false,tasks:'aa',reason:'冷启动补齐 AA 来源证据'}
}
if(!decision.skip){
 const tasks=decision.tasks?decision.tasks.split(','):[]
 // Fresh snapshots must retain their original AA source proof. A cold cache widens
 // to AA rather than accepting unverified retained scores or inventing timestamps.
 if(!await hasMatchingAaArchive()&&!tasks.includes('aa'))tasks.push('aa')
 if(tasks.includes('media')&&!env.AA_API_KEY)throw Error('AA_API_KEY_MISSING: configure the collector repository Secret before media collection')
 await refreshAll({profile:decision.profile,taskIds:tasks,trigger:env.HEARTBEAT==='true'?'heartbeat':env.EVENT_NAME||'manual'})
}
if(requested==='skills'||['all','news','catalog'].includes(decision.profile)){
 const previous=JSON.parse(await readFile('src/practice-resources/resources.json','utf8'))
 const due=requested==='skills'||Date.now()-Date.parse(previous.checkedAt)>6*3600000||previous.skills.length<JSON.parse(await readFile('scripts/config/practice-resources.json','utf8')).skills.length
 if(due)await writePracticeResources('.',await collectPracticeResources({client:createResourceClient(),previous}))
}
await buildChangesFiles()
const report=await validateCandidate();await writeFile('.candidate-verification.json',JSON.stringify(report,null,2)+'\n')
const health=JSON.parse(await readFile('public/radar/health.json','utf8')),failed=failedCollectedSources(health)
await writeFile('.collection-result.json',JSON.stringify({requested,skipped:decision.skip,checkedAt:new Date().toISOString(),failedSources:failed,generatedAt:report.generatedAt},null,2)+'\n')
if(env.GITHUB_STEP_SUMMARY)await appendFile(env.GITHUB_STEP_SUMMARY,`\n采集与数据校验完成。异常来源：${failed.join(', ')||'无'}。公开发布仍需后续核验。\n`)

if(env.GITHUB_OUTPUT)await appendFile(env.GITHUB_OUTPUT,'publish=true\n')
