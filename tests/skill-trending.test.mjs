import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {parseSkillTrending,parseSkillTrendDetail,collectSkillTrending} from '../scripts/collect-skill-trending.mjs'
import {validPracticeResources,filterResources,mergePracticeResources,resourceSourceUrl} from '../src/domain/practice-resources.mjs'
import {defaultOperations} from '../src/domain/operations.mjs'
const data=JSON.parse(await readFile('tests/fixtures/skill-trending-2026-11-19.json','utf8')),trend=data.skillTrends[0]
const now=data.checkedAt,later=new Date(Date.parse(now)+60000).toISOString()
const listing=(rows=[{source:trend.repo,skillId:trend.name,name:trend.name,installs:120}])=>'<a>Trending (24h)</a><script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify({initialSkills:rows,totalSkills:rows.length,view:'trending'})])+')</script>'
const detail=(repo=trend.repo,name=trend.name,description=trend.originalDescription)=>'<script type="application/ld+json">'+JSON.stringify({'@type':'SoftwareApplication',url:`https://www.skills.sh/${repo}/${name}`,name,description})+'</script>'+`npx skills add https://github.com/${repo} --skill ${name}`
test('24h parser preserves exact source identity, install counts and source rank without running scripts',()=>{
 assert.deepEqual(parseSkillTrending(listing()),[{repo:trend.repo,name:trend.name,installs:120,rank:1}])
 const domain={source:'open.example.com',skillId:'valid',name:'valid',installs:2}
 assert.equal(parseSkillTrending(listing([domain,{source:trend.repo,skillId:trend.name,name:trend.name,installs:1}]))[0].rank,2)
 for(const html of [listing().replace('Trending (24h)','All Time'),listing().replace('trending','all'),listing([{source:trend.repo,skillId:trend.name,name:trend.name,installs:-1}]),listing([{source:trend.repo,skillId:'x;run',name:'x;run',installs:1}]),listing([{source:trend.repo,skillId:trend.name,name:trend.name,installs:1},{source:trend.repo,skillId:trend.name,name:trend.name,installs:2}])])assert.throws(()=>parseSkillTrending(html))
})
test('detail import requires the exact source, skill name and matching installation command',()=>{
 assert.equal(parseSkillTrendDetail(detail(),trend).description,trend.originalDescription)
 for(const html of [detail('other/repo'),detail(trend.repo,'other'),detail().replace('npx skills add','curl'),detail()+detail()])assert.throws(()=>parseSkillTrendDetail(html,trend))
})
test('live 24h snapshot validates independently of curated skills and preserves raw observation',()=>{
 assert.equal(validPracticeResources(data),true);assert.equal(data.skillTrends.length,2)
 const snapshot=JSON.stringify(data)
 const rows=filterResources(data,{kind:'skill',skillScope:'trending'})
 assert.deepEqual(rows.map(r=>r.trend.rank),Array.from({length:2},(_,i)=>i+1))
 assert.equal(filterResources(data,{kind:'skill',skillScope:'featured'}).length,1)
 assert.equal(JSON.stringify(data),snapshot)
 for(const mutate of [d=>d.skillTrends[0].trend.installs=-1,d=>d.skillTrends[0].trend.period='weekly',d=>d.skillTrends[0].trend.observedAt='2999-01-01',d=>d.skillTrends[0].url='https://evil.com',d=>d.skillTrends[0].install+=';bad',d=>d.skillTrends.push(d.skillTrends[0])]){const d=structuredClone(data);mutate(d);assert.equal(validPracticeResources(d),false)}
})
test('trend source failures retain original times for seven days and expire old data',async()=>{
 const load=async()=>{throw Error('offline')}
 const result=await collectSkillTrending({load,previous:[trend],now:later})
 assert.equal(result.source.status,'stale');assert.equal(result.rows[0].trend.observedAt,trend.trend.observedAt);assert.equal(result.rows[0].observedAt,trend.observedAt);assert.equal(result.rows[0].checkedAt,later)
 const expired=await collectSkillTrending({load,previous:[trend],now:new Date(Date.parse(now)+8*86400000).toISOString()})
 assert.deepEqual(expired.rows,[]);assert.equal(expired.source.status,'error');assert.equal(expired.source.observedAt,undefined)
})
test('a detail failure retains only matching recently verified text while installs use the new list time',async()=>{
 const result=await collectSkillTrending({load:async url=>url.endsWith('/trending')?listing():Promise.reject(Error('503')),previous:[trend],now:later,detailTtlMs:0})
 assert.equal(result.source.code,'DETAILS_PARTIAL');assert.equal(result.rows[0].detailRetained,true)
 assert.equal(result.rows[0].originalDescription,trend.originalDescription);assert.equal(result.rows[0].observedAt,trend.observedAt)
 assert.equal(result.rows[0].trend.observedAt,later);assert.equal(result.rows[0].trend.installs,120)
 const missing=await collectSkillTrending({load:async url=>url.endsWith('/trending')?listing():Promise.reject(Error('503')),now:later})
 assert.deepEqual(missing.rows,[])
})
test('Chinese editorial text is attached only to the same repository, name and exact description hash',async()=>{
 const editorial=[{repo:trend.repo,name:trend.name,sourceHash:trend.sourceHash,title:'核实用途',description:'中文用途',category:'设计开发'}]
 const run=html=>collectSkillTrending({load:async url=>url.endsWith('/trending')?listing():html,now:later,editorial})
 assert.equal((await run(detail())).rows[0].description,'中文用途')
 assert.equal((await run(detail(trend.repo,trend.name,'Changed purpose'))).rows[0].description,'Changed purpose')
})
test('older publishers cannot erase recent additive trend records or advance their observations',()=>{
 const old=structuredClone(data);delete old.skillTrends;old.sources=old.sources.filter(s=>s.id!=='skills-trending:24h');old.checkedAt=later
 const merged=mergePracticeResources(data,old)
 assert.equal(validPracticeResources(merged),true);assert.deepEqual(merged.skillTrends,data.skillTrends)
 assert.equal(merged.sources.find(s=>s.id==='skills-trending:24h').status,'stale')
 const stale=structuredClone(data);stale.checkedAt=later;stale.sources.find(s=>s.id==='skills-trending:24h').observedAt='2026-11-01T00:00:00Z';for(const r of stale.skillTrends){r.trend.observedAt=r.observedAt='2026-11-01T00:00:00Z';r.trend.installs=1}
 assert.deepEqual(mergePracticeResources(data,stale).skillTrends,data.skillTrends,'older cohorts cannot overwrite a later trend observation')
 const previous=structuredClone(data);for(const r of previous.skillTrends)r.trend.observedAt=r.observedAt=new Date(Date.parse(now)-8*86400000).toISOString()
 assert.equal(mergePracticeResources(previous,old).skillTrends,undefined)
})
test('trend browse respects search, saved items, hidden resources and the existing Skill channel switch',()=>{
 const config={...defaultOperations(),resources:{skill:true,github:true}},options={kind:'skill',skillScope:'trending',query:trend.repo,config}
 assert.ok(filterResources(data,options).some(r=>r.id===trend.id))
 assert.deepEqual(filterResources(data,{...options,savedOnly:true,favorites:[trend.id]}).map(r=>r.id),[trend.id])
 config.hiddenIds=[trend.id];assert.equal(filterResources(data,options).some(r=>r.id===trend.id),false)
 config.resources.skill=false;assert.deepEqual(filterResources(data,options),[])
 for(const url of ['http://skills.sh/a/b/c','https://skills.sh.evil.com/a/b/c','https://skills.sh/a/b/c?redirect=bad','https://u:p@skills.sh/a/b/c'])assert.equal(resourceSourceUrl(url),'')
 assert.equal(resourceSourceUrl(trend.url),trend.url)
})

test('saved skills and projects are findable independently of trend, category and period filters',()=>{
 const s=data.skills[0],t=data.skillTrends[0],g=data.projects[0]
 assert.deepEqual(new Set(filterResources(data,{kind:'skill',skillScope:'featured',category:'unknown',savedOnly:true,favorites:[s.id,t.id]}).map(r=>r.id)),new Set([s.id,t.id]))
 assert.deepEqual(filterResources(data,{kind:'github',period:'unlisted',savedOnly:true,favorites:[g.id]}).map(r=>r.id),[g.id])
})
