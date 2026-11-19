import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {projectRelease} from '../scripts/github-project-releases.mjs'
import {projectGuide} from '../scripts/github-project-guides.mjs'
import {projectTasks,validProjectExtras,relatedProjectSkills,projectDocumentUrl} from '../src/domain/practice-projects.mjs'
import {validPracticeResources,filterResources,mergePracticeResources} from '../src/domain/practice-resources.mjs'
import {defaultOperations} from '../src/domain/operations.mjs'
const resourceConfig=()=>({...defaultOperations(),resources:{skill:true,github:true}})
const data=JSON.parse(fs.readFileSync('src/practice-resources/resources.json')),specs=JSON.parse(fs.readFileSync('scripts/config/github-project-guides.json')),now=data.checkedAt,meta={id:1,full_name:'owner/repo'},published={tag_name:'v1.0',published_at:'2026-01-01T00:00:00Z',html_url:'https://github.com/owner/repo/releases/tag/v1.0',draft:false,prerelease:false}
const fail=async()=>{throw Error('GITHUB_HTTP_503')}
test('formal release is taken from official exact repository, with real dates and separate clocks',async()=>{
 for(const url of ['https://github.com/owner/repo/releases/tag/release/2026-11-17','https://github.com/owner/repo/releases/tag/release%2F2026-11-17'])assert.equal((await projectRelease(meta,null,async()=>({...published,tag_name:'release/2026-11-17',html_url:url}),now)).status,'published')
 const r=await projectRelease(meta,null,async()=>published,now);assert.equal(r.status,'published');assert.equal(r.tag,'v1.0');assert.equal(r.observedAt,now)
 for(const change of [{draft:true},{prerelease:true},{html_url:'https://github.com/other/repo/releases/tag/v1.0'},{published_at:'2999-01-01'}])assert.equal((await projectRelease(meta,null,async()=>({...published,...change}),now)).status,'unavailable')
})
test('404 means no formal GitHub release, while offline and malformed payloads never imply absence',async()=>{
 const none=await projectRelease(meta,null,async()=>{throw Error('GITHUB_HTTP_404')},now);assert.equal(none.status,'none');assert.equal(none.observedAt,now)
 assert.equal((await projectRelease(meta,null,fail,now)).status,'unavailable')
 const old=await projectRelease(meta,null,async()=>published,'2026-11-18T00:00:00Z'),before={githubId:meta.id,repo:meta.full_name,release:old}
 const retained=await projectRelease(meta,before,fail,now);assert.equal(retained.retained,true);assert.equal(retained.observedAt,old.observedAt);assert.equal(retained.checkedAt,now)
 assert.equal((await projectRelease({...meta,id:2},before,fail,now)).status,'unavailable')
 assert.equal((await projectRelease(meta,before,fail,'2027-01-01T00:00:00Z')).status,'unavailable')
})
test('tasks intersect period, search, saved and operations without changing source ranks',()=>{
 const config=resourceConfig()
 for(const task of projectTasks.slice(1)){
  const rows=filterResources(data,{kind:'github',task:task.id,period:'daily',config});assert.ok(rows.every(r=>r.guide.tasks.includes(task.id)));assert.deepEqual(rows.map(r=>r.trending.find(t=>t.period==='daily').rank),rows.map(r=>r.trending.find(t=>t.period==='daily').rank).sort((a,b)=>a-b))
 }
 const row=data.projects.find(r=>r.guide?.tasks?.includes('web'));config.hiddenIds=[row.id]
 assert.ok(!filterResources(data,{kind:'github',task:'web',savedOnly:true,favorites:[row.id],config}).length)
 assert.equal(filterResources(data,{kind:'github',task:'nonexistent'}).length,0)
 const q=row.guide.conditions.runtime;assert.equal(filterResources(data,{kind:'github',query:q,savedOnly:true,favorites:[row.id]}).length,1)
})
test('related skills require actual resource identity, exact same-repo claims and live visibility',()=>{
 const p=data.projects.find(p=>p.repo==='anthropics/skills'),config=resourceConfig(),links=relatedProjectSkills(p,data,config);assert.ok(links.length>0);assert.ok(links.every(s=>s.repo===p.repo))
 config.hiddenIds=[links[0].id];assert.ok(!relatedProjectSkills(p,data,config).some(s=>s.id===links[0].id));config.resources.skill=false;assert.deepEqual(relatedProjectSkills(p,data,config),[])
 assert.deepEqual(relatedProjectSkills({...p,guide:{relatedSkills:[{id:links[0].id,relation:'same-repo'}]},repo:'another/project'},data,resourceConfig()),[])
 assert.deepEqual(relatedProjectSkills(p,data,{pages:{practice:true},hiddenIds:[]}),[])
})
test('extended fields are optional for old publishers and unsafe URLs or malformed conditions fail validation',()=>{
 assert.equal(validPracticeResources(data),true)
 const d=structuredClone(data);for(const p of d.projects){delete p.release;if(p.guide)for(const k of ['tasks','conditions','examples','relatedSkills'])delete p.guide[k]};assert.equal(validPracticeResources(d),true)
 const row=data.projects.find(r=>r.guide?.conditions)
 for(const guide of [{...row.guide,tasks:['quality']},{...row.guide,conditions:{cost:123}},{...row.guide,examples:[{title:'x',url:'https://evil.test',sourceUrl:row.repoUrl+'#readme'}]},{...row.guide,relatedSkills:[{id:'skill:abc',relation:'official',reason:'x'}]}])assert.equal(validProjectExtras({...row,guide}),false)
 assert.equal(projectDocumentUrl('https://github.com@evil.test/file'),'');assert.equal(projectDocumentUrl('http://github.com/file'),'');assert.equal(projectDocumentUrl('https://docs.openwebui.com/getting-started/quick-start/').length>0,true)
 for(const release of [{status:'none',observedAt:now,checkedAt:'2999-01-01'},{status:'published',tag:'v1.0',publishedAt:now,url:'https://evil.test',observedAt:now,checkedAt:now}])assert.equal(validProjectExtras({...row,release}),false)
})
test('usage facts and relations remain bound to reviewed README revision',async()=>{
 const s=specs[0],m={id:s.githubId,full_name:s.repo,description:data.projects.find(r=>r.repo===s.repo).originalDescription}
 const g=await projectGuide(m,null,[s],async()=>({sha:s.readmeSha,path:s.readmePath}),now);assert.deepEqual(g.conditions,s.conditions);assert.deepEqual(g.tasks,s.tasks)
 assert.equal(await projectGuide(m,null,[s],async()=>({sha:'b'.repeat(40),path:s.readmePath}),now),undefined)
})

test('release observations merge independently from Stars, and a fresh no-release result is authoritative',()=>{
 const before=structuredClone(data),next=structuredClone(data),row=before.projects.find(r=>r.release?.status==='published'),target=next.projects.find(r=>r.id===row.id)
 const later=new Date(Date.parse(data.checkedAt)+60000).toISOString();next.checkedAt=later;target.checkedAt=later;target.observedAt=later;target.stars+=1;target.release={status:'unavailable',checkedAt:later}
 let fused=mergePracticeResources(before,next).projects.find(r=>r.id===row.id);assert.equal(fused.stars,target.stars);assert.equal(fused.release.tag,row.release.tag);assert.equal(fused.release.observedAt,row.release.observedAt);assert.equal(fused.release.retained,true)
 target.release={status:'none',observedAt:later,checkedAt:later};fused=mergePracticeResources(before,next).projects.find(r=>r.id===row.id);assert.equal(fused.release.status,'none')
 target.observedAt='2026-01-01T00:00:00Z';fused=mergePracticeResources(before,next).projects.find(r=>r.id===row.id);assert.equal(fused.stars,row.stars);assert.equal(fused.release.status,'none');assert.equal(validPracticeResources(mergePracticeResources(before,next)),true)
})
test('project library scope reveals verified task matches beyond the selected Trending period',()=>{
 const all=filterResources(data,{kind:'github',period:'all',task:'local'});assert.ok(all.length>0);assert.ok(all.every(r=>r.guide.tasks.includes('local')))
 const unknown=structuredClone(data.projects[0]);delete unknown.guide;unknown.id='github:999999';unknown.githubId=999999;assert.ok(filterResources({...data,projects:[unknown]},{kind:'github',period:'all'}).length===1);assert.equal(filterResources({...data,projects:[unknown]},{kind:'github',period:'all',task:'local'}).length,0)
})
