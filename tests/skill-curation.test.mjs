import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {collectPracticeResources} from '../scripts/collect-practice-resources.mjs'
import {filterResources,validPracticeResources,resourceCategories} from '../src/domain/practice-resources.mjs'
const data=JSON.parse(await readFile('tests/fixtures/skill-curation-2026-11-19.json','utf8'))
const clone=x=>structuredClone(x),nextTime=new Date(Date.parse(data.checkedAt)+60000).toISOString()

test('curated popularity keeps exact recent trend observations on list failure and drops them on a successful absence',async()=>{
 const old=data.skills.find(s=>s.repo==='heygen-com/hyperframes'&&s.name==='hyperframes'),trend=data.skillTrends.find(s=>s.repo===old.repo&&s.name===old.name)
 assert.ok(old&&trend)
 const api=async path=>path===`repos/${old.repo}`?{full_name:old.repo,default_branch:'main',pushed_at:old.sourceUpdatedAt}:path.includes('/commits/')?{sha:old.revision}:Promise.reject(Error('offline'))
 const registry={skills:[old],projects:[]},base={previous:data,registry,now:nextTime,client:{api,trending:async()=>{throw Error('offline')},skillTrending:async()=>{throw Error('offline')}}}
 const retained=await collectPracticeResources(base)
 assert.deepEqual(retained.skills[0].popularity,{period:'24h',rank:trend.trend.rank,installs:trend.trend.installs,observedAt:trend.trend.observedAt})
 assert.equal(retained.sources.find(s=>s.id==='skills-trending:24h').status,'stale')
 const listing='<a>Trending (24h)</a><script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify({initialSkills:[{source:'another/repo',skillId:old.name,name:old.name,installs:999999}],totalSkills:1,view:'trending'})])+')</script>'
 const current=await collectPracticeResources({...base,client:{...base.client,skillTrending:async url=>url.endsWith('/trending')?listing:Promise.reject(Error('offline'))}})
 assert.equal(current.skills[0].popularity,undefined,'a different author with the same skill name must not be matched')
 const aged=clone(data),past=new Date(Date.parse(data.checkedAt)-8*86400000).toISOString();for(const r of aged.skillTrends){r.trend.observedAt=r.observedAt=past}for(const r of aged.skills)if(r.popularity)r.popularity.observedAt=past
 const expired=await collectPracticeResources({...base,previous:aged})
 assert.equal(expired.skills[0].popularity,undefined,'retained observations expire after seven days')
})

test('curated task categories sort by observed installs while preserving explicit title sort and expiration',async()=>{
 const {resourcePopularity}=await import('../src/domain/practice-resources.mjs')
 const a={...data.skills[0],id:'a',title:'A',category:'UI 设计',popularity:undefined},b={...data.skills[0],id:'b',title:'B',category:'UI 设计',popularity:{period:'24h',rank:3,installs:99,observedAt:new Date().toISOString()}}
 assert.deepEqual(filterResources({...data,skills:[a,b]},{category:'UI 设计'}).map(r=>r.id),['b','a'])
 assert.deepEqual(filterResources({...data,skills:[a,b]},{category:'UI 设计',config:{pages:{practice:true},resources:{skill:true},hiddenIds:[],sort:'title'}}).map(r=>r.id),['a','b'])
 assert.equal(resourcePopularity(b,Date.parse(b.popularity.observedAt)+8*86400000),null)
 assert.equal(resourcePopularity({...b,popularity:{...b.popularity,installs:-1}}),null)
})

test('curation validates hidden skill directories, safe commands and independent trend timestamps',()=>{
 assert.ok(resourceCategories.includes('前端开发')&&resourceCategories.includes('UI 设计')&&resourceCategories.includes('视频制作'))
 for(const directory of ['skills','.agents/skills','.claude/skills']){
  const d=clone(data),s=d.skills[0];s.path=directory+'/'+s.name;s.id='skill:'+`${s.repo}/${s.path}`.toLowerCase().replace(/[^a-z0-9-]+/g,'-');s.url=`https://github.com/${s.repo}/blob/${s.revision}/${s.path}/SKILL.md`
  assert.equal(validPracticeResources(d),true)
 }
 for(const mutate of [d=>d.skills[0].popularity.installs=-1,d=>d.skills[0].popularity.period='weekly',d=>d.skills[0].popularity.observedAt='2999-01-01',d=>d.skills[0].install+=';run']){const d=clone(data);mutate(d);assert.equal(validPracticeResources(d),false)}
})
