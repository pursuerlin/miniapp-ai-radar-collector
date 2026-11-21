import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {parseSkillTrendDetail,parseSkillTrendingApi,collectSkillTrending} from '../scripts/collect-skill-trending.mjs'
import {validPracticeResources,filterResources} from '../src/domain/practice-resources.mjs'
import {collectPracticeResources,createResourceClient} from '../scripts/collect-practice-resources.mjs'
const data=JSON.parse(await readFile('tests/fixtures/skill-curation-2026-11-19.json','utf8')),trend=data.skillTrends[0],now=new Date(Date.parse(data.checkedAt)+60000).toISOString()
const api=(rows=[{source:trend.repo,skillId:trend.name,name:trend.name,installs:123}])=>JSON.stringify({skills:rows,total:rows.length,hasMore:false,page:0})
const html='<a>Trending (24h)</a><script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify({initialSkills:[{source:trend.repo,skillId:trend.name,name:trend.name,installs:78}],totalSkills:1,view:'trending'})])+')</script>'
test('source pagination JSON is validated as page zero and cannot substitute HTML, malformed or another page',()=>{
 assert.deepEqual(parseSkillTrendingApi(api()),[{repo:trend.repo,name:trend.name,installs:123,rank:1}])
 for(const body of ['<html>200 OK</html>',api().replace('"page":0','"page":1'),api().replace('"installs":123','"installs":-1'),api().replace('"hasMore":false','"hasMore":"no"'),api([{source:'a/b',name:'x',skillId:'x',installs:1},{source:'a/b',name:'x',skillId:'x',installs:1}])])assert.throws(()=>parseSkillTrendingApi(body))
})
test('fresh JSON statistics do not depend on full HTML or repeat detail downloads and keep separate observation times',async()=>{
 const calls=[],editorial=[{repo:trend.repo,name:trend.name,sourceHash:trend.sourceHash,title:'视频入口',description:'短用途',introduction:'这是按作者原文整理的详细用途。',example:'制作产品视频。',category:'视频制作'}]
 const result=await collectSkillTrending({load:async url=>{calls.push(url);if(url.endsWith('/api/skills/trending/0'))return api();throw Error('HTML must not be needed')},previous:[{...trend,totalInstalls:{label:'81.2K',observedAt:trend.observedAt}}],now,editorial})
 assert.equal(calls.length,1);assert.equal(result.source.status,'ok');assert.equal(result.source.transport,'json');assert.equal(result.source.detailsReused,1)
 assert.equal(result.rows[0].trend.installs,123);assert.equal(result.rows[0].trend.observedAt,now);assert.equal(result.rows[0].observedAt,trend.observedAt);assert.equal(result.rows[0].introduction,editorial[0].introduction)
 assert.equal(result.rows[0].detailRetained,undefined)
})
test('bad JSON falls back to independently validated 24h HTML and reports a real timeout when both transports fail',async()=>{
 const result=await collectSkillTrending({load:async url=>url.endsWith('/trending')?html:'<html>Sign in</html>',previous:[{...trend,totalInstalls:{label:'81.2K',observedAt:trend.observedAt}}],now})
 assert.equal(result.source.transport,'html');assert.equal(result.source.status,'ok');assert.equal(result.rows[0].trend.installs,78)
 const delayed=await collectSkillTrending({load:async()=>{throw Object.assign(Error('connection timeout'),{name:'TimeoutError'})},previous:[trend],now})
 assert.equal(delayed.source.code,'TIMEOUT');assert.equal(delayed.rows[0].trend.observedAt,trend.trend.observedAt)
})
test('expired detail cache failures keep new statistics and flag only the description failure',async()=>{
 const result=await collectSkillTrending({load:async url=>url.includes('/api/')?api():Promise.reject(Error('detail unavailable')),previous:[trend],now,detailTtlMs:0})
 assert.equal(result.source.code,'DETAILS_PARTIAL');assert.equal(result.source.detailsFailed,1);assert.equal(result.rows[0].detailRetained,true)
 assert.equal(result.rows[0].trend.observedAt,now);assert.equal(result.rows[0].observedAt,trend.observedAt)
})
test('long introductions require a matching author-description hash and remain optional for older publishers',async()=>{
 const old=data.skills[0],registry={skills:[{...old,introduction:'详细说明',detailSourceHash:'wrong'}],projects:[]}
 const api=async path=>path===`repos/${old.repo}`?{full_name:old.repo,default_branch:'main',pushed_at:old.sourceUpdatedAt}:path.includes('/commits/')?{sha:old.revision}:Promise.reject(Error('offline'))
 const result=await collectPracticeResources({registry,previous:data,now,client:{api,trending:async()=>{throw Error('offline')}}})
 assert.equal(result.skills[0].introduction,undefined)
 const bad=structuredClone(data);bad.skillTrends[0].introduction={text:'wrong'};assert.equal(validPracticeResources(bad),false)
 const long=structuredClone(data);long.skills[0].introduction='x'.repeat(2001);assert.equal(validPracticeResources(long),false)
 assert.equal(validPracticeResources(data),true)
 const searchable=structuredClone(data);searchable.skillTrends[0].introduction='可用于口型同步与配音';assert.equal(filterResources(searchable,{kind:'skill',skillScope:'trending',query:'口型同步'}).length,1)
})
test('client uses canonical host and validates API route before sending requests',async()=>{
 const calls=[],client=createResourceClient({fetcher:async(url,options)=>{calls.push(url);assert.equal(options.headers.Accept,'application/json');return {ok:true,text:async()=>api()}},wait:async()=>{}})
 await client.skillTrending('https://www.skills.sh/api/skills/trending/0');assert.deepEqual(calls,['https://www.skills.sh/api/skills/trending/0'])
 await assert.rejects(()=>client.skillTrending('https://evil.com/api/skills/trending/0'),/URL_INVALID/)
 await assert.rejects(()=>client.skillTrending('https://www.skills.sh/api/skills/all-time/0'),/URL_INVALID/)
})

test('client fusion preserves newest descriptions and newest cohort statistics independently, including successful absence',async()=>{
 const {mergePracticeResources}=await import('../src/domain/practice-resources.mjs')
 const previous=structuredClone(data),next=structuredClone(data),later=new Date(Date.parse(data.checkedAt)+120000).toISOString()
 previous.skills[0].introduction='本机较新的介绍';previous.skillTrends[0].introduction='本机较新的趋势介绍'
 next.checkedAt=later;next.skills[0].observedAt='2026-11-18T10:00:00Z';next.skills[0].checkedAt=later;next.skills[0].popularity={period:'24h',rank:1,installs:321,observedAt:later}
 next.skillTrends[0].observedAt='2026-11-18T10:00:00Z';next.skillTrends[0].checkedAt=later;next.skillTrends[0].trend={period:'24h',rank:1,installs:321,observedAt:later}
 const source=next.sources.find(s=>s.id==='skills-trending:24h');source.observedAt=source.checkedAt=later;source.status='ok';delete source.code
 const merged=mergePracticeResources(previous,next);assert.equal(validPracticeResources(merged),true)
 assert.equal(merged.skills[0].introduction,'本机较新的介绍');assert.equal(merged.skills[0].popularity.installs,321)
 assert.equal(merged.skillTrends[0].introduction,'本机较新的趋势介绍');assert.equal(merged.skillTrends[0].trend.installs,321)
 delete next.skills[0].popularity;assert.equal(mergePracticeResources(previous,next).skills[0].popularity,undefined)
})

test('Skill totals come from the matching detail card and keep the original precision',async()=>{
 const detail=card=>'<script type="application/ld+json">'+JSON.stringify({'@type':'SoftwareApplication',url:trend.url,name:trend.name,description:'Verified Skill description'})+'</script>'+`npx skills add https://github.com/${trend.repo} --skill ${trend.name}`+card
 const card='<div class="label"><span>Installs</span></div><div class="stat">108.1K</div><svg aria-label="Weekly installs: 200"></svg>'
 assert.equal(parseSkillTrendDetail(detail(card),trend).totalInstalls,'108.1K')
 assert.equal(parseSkillTrendDetail(detail(card+card),trend).totalInstalls,undefined)
 assert.equal(parseSkillTrendDetail(detail(card.replace('>Installs<','>Weekly Installs<')),trend).totalInstalls,undefined)
 const result=await collectSkillTrending({load:async url=>url.includes('/api/')?api():detail(card),previous:[trend],now})
 assert.equal(result.rows[0].trend.installs,123)
 assert.deepEqual(result.rows[0].totalInstalls,{label:'108.1K',observedAt:now})
})
