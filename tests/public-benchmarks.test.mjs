import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {BENCHMARK_EDITIONS,validPublicBenchmarks,mergePublicBenchmarks,publicBenchmarkSources} from '../src/domain/public-benchmarks.mjs'
import {parseVBenchEdition,collectVBenchEditions} from '../scripts/collect-public-benchmarks.mjs'
const config=JSON.parse(await readFile('tests/fixtures/public-benchmarks/vbench-config.json','utf8'))
const snapshot=JSON.parse(await readFile('src/data/media-leaderboards.json','utf8')).publicBenchmarks
delete snapshot.editions
const start=Date.now()-86400000,at=n=>new Date(start+n*3600000).toISOString()
const collect=(options={})=>collectVBenchEditions({fetcher:async()=>Response.json(config),now:()=>at(0),...options})
test('real Space results preserve 24/12 dimensions, duplicate model evaluations, dates and score units',()=>{
 const rows=parseVBenchEdition(config,BENCHMARK_EDITIONS[0]),i2v=parseVBenchEdition(config,BENCHMARK_EDITIONS[1])
 assert.equal(rows.length,15);assert.equal(new Set(rows.map(r=>r.name)).size,14);assert.equal(i2v.length,36)
 assert.equal(Object.keys(rows[0].scores).length,24);assert.equal(Object.keys(i2v[0].scores).length,12)
 assert.equal(rows[0].scores['Total Score'],.671);assert.equal(rows[0].scores['Physics Score'],.6599)
 const repeated=rows.filter(r=>r.name==='Vivy-R-Vision-3B');assert.equal(repeated.length,2);assert.notEqual(repeated[0].id,repeated[1].id);assert.deepEqual(new Set(repeated.map(r=>r.evaluationScope)),new Set(['team','submitter']))
 assert.equal(i2v.find(r=>r.name==='SVD-XT-1.0').scores['Total Score'],null)
 assert.equal(rows[0].evaluatedAt,'2026-10-30');assert.equal(rows[0].evaluationScope,'submitter')
})
test('empty, duplicate tables, invalid dates, missing metrics and invalid percentages fail closed; component IDs may change',()=>{
 const change=fn=>{const data=structuredClone(config);fn(data);return data}
 assert.throws(()=>parseVBenchEdition({components:[]},BENCHMARK_EDITIONS[0]),/STRUCTURE/)
 assert.throws(()=>parseVBenchEdition(change(d=>d.components.push(d.components[0])),BENCHMARK_EDITIONS[0]),/STRUCTURE/)
 assert.throws(()=>parseVBenchEdition(change(d=>d.components[0].props.value.data=[]),BENCHMARK_EDITIONS[0]),/COVERAGE/)
 for(const value of ['NaN%','1.2','101%','-2%'])assert.throws(()=>parseVBenchEdition(change(d=>d.components[0].props.value.data[0][6]=value),BENCHMARK_EDITIONS[0]),/SCORE/)
 assert.throws(()=>parseVBenchEdition(change(d=>d.components[0].props.value.data[0][5]='2026-02-31'),BENCHMARK_EDITIONS[0]),/IDENTITY/)
 assert.throws(()=>parseVBenchEdition(change(d=>d.components[0].props.value.headers.splice(7,1)),BENCHMARK_EDITIONS[0]),/STRUCTURE/)
 assert.equal(parseVBenchEdition(change(d=>d.components[0].id=12345),BENCHMARK_EDITIONS[0]).length,15)
})
test('edition failures are isolated, observation times remain truthful, and request bounds reject huge payloads',async()=>{
 const editions=await collect(),previous=structuredClone(editions)
 assert.deepEqual(await collect({previous,now:()=>at(-1)}),previous)
 const unchanged=await collect({previous,now:()=>at(1)});assert.equal(unchanged[0].observedAt,at(0));assert.equal(unchanged[0].checkedAt,at(1))
 const stale=await collect({previous,now:()=>at(2),fetcher:async()=>new Response('',{status:503})});assert.equal(stale[0].status,'stale');assert.equal(stale[0].observedAt,at(0));assert.equal(stale[0].errorCode,'BENCHMARK_HTTP_503')
 const broken=structuredClone(config);broken.components[0].props.value.data[0][6]='bad'
 const partial=await collect({previous,fetcher:async()=>Response.json(broken)});assert.equal(partial[0].status,'stale');assert.equal(partial[1].status,'ok')
 const shrunk=structuredClone(config);shrunk.components[0].props.value.data=shrunk.components[0].props.value.data.slice(0,2)
 assert.equal((await collect({previous,fetcher:async()=>Response.json(shrunk)}))[0].errorCode,'BENCHMARK_COVERAGE_INVALID')
 const regressed=structuredClone(config);regressed.components[0].props.value.data.forEach(row=>row[5]='2024-01-01')
 assert.equal((await collect({previous,fetcher:async()=>Response.json(regressed)}))[0].errorCode,'BENCHMARK_SOURCE_TIME_REGRESSED')
 const huge=await collect({previous,fetcher:async()=>new Response('x'.repeat(2000001))});assert.equal(huge[0].errorCode,'BENCHMARK_PAYLOAD_TOO_LARGE')
})
test('optional editions preserve schema v1, exact board scopes and newer cache on legacy downloads',async()=>{
 const editions=await collect(),data={...snapshot,editions}
 assert.ok(validPublicBenchmarks(snapshot));assert.ok(validPublicBenchmarks(data));assert.equal(data.sources.length,2)
 assert.equal(publicBenchmarkSources(data,'video','text-to-video')[0].id,'vbench-2')
 assert.equal(publicBenchmarkSources(data,'video','image-to-video')[0].id,'vbench-i2v')
 assert.ok(publicBenchmarkSources(data,'image','text-to-image').every(s=>s.id==='geneval'))
 assert.ok(!publicBenchmarkSources(data,'video','text-to-video-audio').some(s=>s.id==='vbench-2'))
 assert.deepEqual(mergePublicBenchmarks(data,snapshot).editions,editions)
 const later={...snapshot,editions:await collect({now:()=>at(1)})};assert.equal(mergePublicBenchmarks(later,data).editions[0].checkedAt,at(1))
 const invalid=structuredClone(data);invalid.editions[0].rows[0].evaluationScope='team';assert.equal(validPublicBenchmarks(invalid),false)
})
test('daily academic cache skips requests without advancing either verification or observation dates',async()=>{
 const previous=await collect(),cached=await collect({previous,now:()=>at(1),cacheMaxAgeMs:24*3600000,fetcher:async()=>assert.fail('daily cache should not fetch')})
 assert.deepEqual(cached,previous)
 let calls=0;await collect({previous,now:()=>at(25),cacheMaxAgeMs:24*3600000,fetcher:async()=>{calls++;return Response.json(config)}});assert.equal(calls,1)
})

test('legacy academic checks preserve content dates and prior data when the local clock regresses',async()=>{
 const {collectPublicBenchmarks}=await import('../scripts/collect-public-benchmarks.mjs')
 const names=snapshot.sources.find(s=>s.id==='geneval').rows
 const {PUBLIC_BENCHMARKS}=await import('../src/domain/public-benchmarks.mjs')
 const text='| Model | '+PUBLIC_BENCHMARKS[0].metrics.join(' | ')+' |\n| --- | '+PUBLIC_BENCHMARKS[0].metrics.map(()=> '---').join(' | ')+' |\n'+names.map(r=>'| '+r.name+' | '+PUBLIC_BENCHMARKS[0].metrics.map(k=>r.scores[k]).join(' | ')+' |').join('\n')
 const t=Math.max(...snapshot.sources.map(s=>Date.parse(s.checkedAt)))+1000,now=()=>new Date(t).toISOString()
 const result=await collectPublicBenchmarks({previous:snapshot,now,cacheMaxAgeMs:0,fetcher:async url=>url.includes('geneval')?new Response(text):new Response('',{status:503})})
 const before=snapshot.sources.find(s=>s.id==='geneval'),after=result.sources.find(s=>s.id==='geneval')
 assert.equal(after.status,'ok');assert.equal(after.observedAt,before.observedAt);assert.equal(after.checkedAt,now())
 const future={...result,editions:await collect({now})}
 const regressed=await collectPublicBenchmarks({previous:future,now:()=>new Date(t-1).toISOString(),cacheMaxAgeMs:0,fetcher:async()=>assert.fail('regressed clock cannot fetch or re-date any source')})
 assert.deepEqual(regressed,future)
})

test('academic transport errors retry once while permission, schema and oversized results do not retry',async()=>{
 let calls=0
 const recovered=await collect({wait:async()=>{},fetcher:async()=>++calls===1?new Response('',{status:503}):Response.json(config)})
 assert.equal(calls,2);assert.ok(recovered.every(s=>s.status==='ok'))
 calls=0
 await collect({wait:async()=>{},fetcher:async()=>{calls++;throw new TypeError('body transport closed')}});assert.equal(calls,2)
 calls=0;await collect({wait:async()=>{},fetcher:async()=>{calls++;throw new DOMException('timeout','TimeoutError')}});assert.equal(calls,2)
 for(const status of [401,403,404,429]){calls=0;await collect({wait:async()=>{},fetcher:async()=>{calls++;return new Response('',{status})}});assert.equal(calls,1)}
 calls=0;await collect({wait:async()=>{},fetcher:async()=>{calls++;return new Response('not json')}});assert.equal(calls,1)
 calls=0;await collect({wait:async()=>{},fetcher:async()=>{calls++;return new Response('x'.repeat(2000001))}});assert.equal(calls,1)
})
