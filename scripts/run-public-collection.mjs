import {buildChangesFiles} from './build-changes.mjs'
import {writeFile,readFile,appendFile} from 'node:fs/promises'
import {hasMatchingAaArchive} from './aa-source-proof.mjs'
import {chooseScope} from './choose-collection-scope.mjs'
import {refreshAll} from './refresh-data.mjs'
import {collectPracticeResources,createResourceClient,writePracticeResources,practiceResourcesDue} from './collect-practice-resources.mjs'
import {validateCandidate} from './validate-public-data.mjs'
import {failedCollectedSources} from './check-collection-health.mjs'
const env=process.env,requested=env.INPUT_PROFILE||'news',manifest=JSON.parse(await readFile('src/data/manifest.json','utf8'))
if(!['all','catalog','news','aa','livebench','media','research','evaluation','skills'].includes(requested))throw Error('COLLECTION_PROFILE_INVALID')
let decision=requested==='skills'?{profile:'news',skip:true,tasks:'',reason:'仅刷新 Skill 与 GitHub'}:chooseScope({eventName:env.EVENT_NAME,schedule:env.EVENT_SCHEDULE,inputProfile:requested,heartbeat:env.HEARTBEAT,manifest})
const automatic=env.EVENT_NAME==='schedule'||['true','1'].includes(String(env.HEARTBEAT).toLowerCase())
const refreshResources=requested==='skills'||automatic||['all','news','catalog'].includes(decision.profile)
const previousResources=refreshResources?JSON.parse(await readFile('src/practice-resources/resources.json','utf8')):null
const resourcesDue=refreshResources&&(requested==='skills'||practiceResourcesDue(previousResources,{
 expectedSkills:JSON.parse(await readFile('scripts/config/practice-resources.json','utf8')).skills.length,
}))
console.log(`采集范围 ${requested}：${decision.reason}`)
if(decision.skip&&!resourcesDue){
 await writeFile('.collection-result.json',JSON.stringify({requested,skipped:true,checkedAt:new Date().toISOString()})+'\n')
 if(env.GITHUB_OUTPUT)await appendFile(env.GITHUB_OUTPUT,'publish=false\n')
 process.exit(0)
}
if(decision.skip&&resourcesDue){
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
if(resourcesDue){
 const resources=await collectPracticeResources({client:createResourceClient(),previous:previousResources})
 await writePracticeResources('.',resources)
 const boards=resources.sources.filter(s=>s.id==='skills-trending:24h'||s.id.startsWith('trending:'))
 const status=boards.map(s=>`${s.id} ${s.status} ${s.observedAt||'暂无统计'}`).join(' · ')
 console.log(status)
 if(env.GITHUB_STEP_SUMMARY)await appendFile(env.GITHUB_STEP_SUMMARY,`\nSkill 与 GitHub 榜单 · ${status}\n`)
}
await buildChangesFiles()
const report=await validateCandidate();await writeFile('.candidate-verification.json',JSON.stringify(report,null,2)+'\n')
const health=JSON.parse(await readFile('public/radar/health.json','utf8')),failed=failedCollectedSources(health)
await writeFile('.collection-result.json',JSON.stringify({requested,skipped:false,resourcesRefreshed:resourcesDue,checkedAt:new Date().toISOString(),failedSources:failed,generatedAt:report.generatedAt},null,2)+'\n')
if(env.GITHUB_STEP_SUMMARY)await appendFile(env.GITHUB_STEP_SUMMARY,`\n采集与数据校验完成。异常来源：${failed.join(', ')||'无'}。公开发布仍需后续核验。\n`)

if(env.GITHUB_OUTPUT)await appendFile(env.GITHUB_OUTPUT,'publish=true\n')
