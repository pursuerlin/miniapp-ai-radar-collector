import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {collectCurrentAa} from '../scripts/collect-aa-current.mjs'
import {validBenchmark} from '../src/domain/online-data.mjs'
import {parseAaCurrentModel,parseAaModels,isAaModelSlug} from '../scripts/collect-benchmark.mjs'
import {assertBenchmarkMatchesArchive} from '../scripts/validate-aa-archive.mjs'
const listed={slug:'example',name:'Example (High)',modelCreatorName:'Google',intelligenceIndex:60,contextWindowTokens:1000000,isOpenWeights:false}
const model={...listed,id:'example-id',creator:{name:'Google'},headline:{outputSpeed:70,timeToFirstToken:2,timeToFirstAnswerToken:20}}

const flight=models=>`self.__next_f.push([1,${JSON.stringify('Artificial Analysis Intelligence Index v5.0.1 '+JSON.stringify({initialModels:models}))}])`
const detailFlight=(currentModel,initialModels=[])=>`self.__next_f.push([1,${JSON.stringify('Artificial Analysis Intelligence Index v5.0.1 '+JSON.stringify({currentModel,initialModels}))}])`
test('scheduled AA collection reads v3 detail payloads even when the legacy table changed',async()=>{
 const models=Array.from({length:30},(_,i)=>({...listed,slug:'model-'+i,name:`Model ${i} (High)`,intelligenceIndex:60-i}))
 const details=models.map(m=>({...model,...m,id:'verified-'+m.slug}))
 const result=await collectCurrentAa({fetchPage:async url=>url.endsWith('/leaderboards/models')?flight(models):flight(details)})
 assert.equal(validBenchmark(result.data),true)
 assert.equal(result.data.performanceVersion,'v3')
 assert.deepEqual(result.data.coverage,{listed:30,ranked:30,details:30})
 assert.equal(result.data.rows[0].firstAnswerLatency,model.headline.timeToFirstAnswerToken)
 assert.equal(result.data.provenance.errors.length,0)
 await assert.rejects(()=>collectCurrentAa({fetchPage:async()=>flight(models)}),/前三配置.*未核实/,'榜单有分但前三当前详情缺失时仍须保留原快照')
})

test('AA collects the current configuration when it is absent from all comparison lists',async()=>{
 const models=Array.from({length:30},(_,i)=>({...listed,slug:'model-'+i,name:`Model ${i} (High)`,intelligenceIndex:60-i}))
 const requested=[]
 const result=await collectCurrentAa({fetchPage:async url=>{
  requested.push(url)
  if(url.endsWith('/leaderboards/models'))return flight(models)
  const current=models.find(m=>url.endsWith('/'+m.slug))
  return detailFlight({...model,...current,id:'verified-'+current.slug,price1mInputTokens:2,price1mOutputTokens:10,
   cacheHitPrice:.1,cacheWritePrice:null,intelligenceIndexCostPerTask:{cost:{total:4.97}},
   frontierCode20:.257,briefcaseBreakdown:{overall:{elo:1484.37}},omniscienceAccuracy:.483,omniscienceHallucinationRate:.0425},[models[0]])
 }})
 assert.equal(validBenchmark(result.data),true)
 assert.deepEqual(result.data.coverage,{listed:30,ranked:30,details:30})
 assert.equal(result.data.provenance.errors.length,0)
 assert.equal(requested.length,31,'one ranking and one page per missing configuration')
 const row=result.data.rows[22]
 assert.equal(row.detailStatus,'verified')
 assert.equal(row.detailSourceUrl,'https://artificialanalysis.ai/models/model-22')
 assert.equal(row.cost,4.97)
 assert.equal(row.priceInput,2)
 assert.equal(row.priceOutput,10)
 assert.equal(row.cacheReadPrice,.1)
 assert.equal(row.cacheWritePrice,null,'unpublished prices remain unknown')
 assert.equal(row.benchmarks.briefcase,1484.37)
 assert.equal(row.firstAnswerLatency,20)
})

test('AA current model parsing handles nested objects, split flight chunks and quoted delimiters',()=>{
 const current={...model,name:'Example "quoted } ]" (High)',metadata:{nested:[{text:'escaped \\ path'}]}}
 const payload='Artificial Analysis Intelligence Index v5.0.1 '+JSON.stringify({currentModel:current,initialModels:[listed]})
 const html=[payload.slice(0,120),payload.slice(120)].map(chunk=>`self.__next_f.push([1,${JSON.stringify(chunk)}])`).join('')
 assert.deepEqual(parseAaCurrentModel(html),current)
 assert.deepEqual(parseAaModels(html),[listed])
 assert.equal(parseAaCurrentModel(detailFlight(null)),null)
 assert.deepEqual(parseAaModels(flight([])),[])
 assert.equal(parseAaCurrentModel('self.__next_f.push([1,"truncated'),null)
})

test('AA rejects detail pages that resolve to a different current configuration',async()=>{
 const models=Array.from({length:30},(_,i)=>({...listed,slug:'model-'+i,name:`Model ${i} (High)`,intelligenceIndex:60-i}))
 await assert.rejects(()=>collectCurrentAa({fetchPage:async url=>url.endsWith('/leaderboards/models')?flight(models):detailFlight({...model,id:'wrong-id'})}),/配置身份不一致/)
})

const releaseFlight=models=>`self.__next_f.push([1,${JSON.stringify(JSON.stringify({initialModels:models}))}])`
const releaseModels=()=>Array.from({length:30},(_,i)=>({id:`configuration-${i}`,release:{slug:`release-${Math.floor(i/5)}`,name:`Release ${Math.floor(i/5)}`},name:`Release ${Math.floor(i/5)} (Effort ${i%5})`,intelligenceIndex:60-i,
 modelCreatorName:'Example',contextWindowTokens:1000000,isOpenWeights:false,intelligenceIndexCostPerTask:0,price1mInputTokens:0,price1mOutputTokens:null,outputSpeed:20,timeToFirstToken:1,timeToFirstAnswerToken:2}))
const releaseDetails=models=>models.map(m=>({...m,slug:`${m.release.slug}-effort-${m.name.match(/Effort (\d+)/)[1]}`,headline:{outputSpeed:20,timeToFirstToken:1,timeToFirstAnswerToken:2},intelligenceIndexCostPerTask:{cost:{total:0}}}))

test('release URLs keep separate configuration UUIDs, reuse page requests and preserve existing client IDs',async()=>{
 const models=releaseModels(),calls=[]
 const result=await collectCurrentAa({previousRows:[{id:'old-effort-link',sourceModelId:models[1].id,name:models[1].name}],fetchPage:async url=>{
  calls.push(url)
  if(url.endsWith('/leaderboards/models'))return releaseFlight(models)
  return flight(releaseDetails(models.filter(m=>url.endsWith('/'+m.release.slug))))
 }})
 assert.equal(validBenchmark(result.data),true)
 assert.deepEqual(result.data.coverage,{listed:30,ranked:30,details:30})
 assert.equal(new Set(result.data.rows.map(row=>row.id)).size,30)
 assert.equal(result.data.rows[1].id,'old-effort-link')
 assert.equal(result.data.rows[1].sourceModelId,models[1].id)
 assert.equal(result.data.rows[1].sourceUrl,'https://artificialanalysis.ai/models/release-0-effort-1')
 assert.equal(result.data.rows[1].cost,0)
 assert.equal(result.data.indexVersion,'v5.0.1','confirm the omitted ranking version on live detail pages')
 assert.equal(result.data.provenance.indexVersionStatus,'verified-from-detail-pages')
 assert.equal(calls.length,7,'one ranking and one request per release, including concurrent configurations')
})

test('AA retries its own failed ranking and detail reads even when other collectors succeed',async()=>{
 const models=releaseModels(),calls=new Map(),delays=[]
 const result=await collectCurrentAa({wait:async ms=>delays.push(ms),fetchPage:async url=>{
  const n=(calls.get(url)||0)+1;calls.set(url,n)
  if(n===1){if(url.endsWith('/leaderboards/models'))return '<html>truncated response';throw Error('request timed out')}
  return url.endsWith('/leaderboards/models')?releaseFlight(models):flight(releaseDetails(models))
 }})
 assert.equal(result.data.rows.length,30)
 assert.deepEqual([...calls.values()],[2,2,2])
 assert.deepEqual(delays,[1000,1000,1000])
 await assert.rejects(()=>collectCurrentAa({wait:async()=>{},fetchPage:async()=>'<html>bad response'}),error=>error.attempts===3&&/模型列表缺失/.test(error.message))
})

test('release details must match configuration UUID, name and the current ranking score',async()=>{
 const models=releaseModels()
 for(const patch of [{name:'Wrong configuration'},{intelligenceIndex:999}]){
  await assert.rejects(()=>collectCurrentAa({fetchPage:async url=>url.endsWith('/leaderboards/models')?releaseFlight(models):flight(releaseDetails(models).map((m,i)=>i===0?{...m,...patch}:m))}),/配置身份不一致|配置得分不一致/)
 }
 await assert.rejects(()=>collectCurrentAa({wait:async()=>{},fetchPage:async()=>releaseFlight(models.map((m,i)=>i===1?{...m,id:models[0].id}:m))}),/配置 ID 重复/)
 await assert.rejects(()=>collectCurrentAa({wait:async()=>{},fetchPage:async()=>releaseFlight(models.map(({release,id,...m},i)=>({...m,slug:`legacy-${i}`})))}),/指数版本缺失/,'legacy pages still require their original version label')
})

test('missing release detail retains current published ranking metrics without inventing full details',async()=>{
 const models=releaseModels()
 const result=await collectCurrentAa({fetchPage:async url=>url.endsWith('/leaderboards/models')?releaseFlight(models):flight(releaseDetails(models.slice(0,3)))})
 const row=result.data.rows[10]
 assert.equal(row.detailStatus,'unavailable')
 assert.equal(row.cost,0)
 assert.equal(row.priceInput,0)
 assert.equal(row.priceOutput,null)
 assert.equal(row.firstTokenLatency,1)
 assert.equal(row.firstAnswerLatency,2)
 assert.equal(row.parametersBillions,undefined)
 assert.equal(row.metricSource,'ranking')
 assert.equal(row.metricsSourceUrl,'https://artificialanalysis.ai/leaderboards/models')
})

test('captured November 14 release ranking joins real configuration slugs and versioned detail metrics',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/aa-release-2026-11-14.json',import.meta.url),'utf8'))
 const result=await collectCurrentAa({minVersionAnchors:1,maxAttempts:1,fetchPage:async url=>{
  if(url===fixture.source)return releaseFlight(fixture.ranking)
  if(url===fixture.detailSource)return flight(fixture.details)
  throw Error('No captured page for this release')
 }})
 assert.equal(validBenchmark(result.data),true)
 assert.equal(result.data.indexVersion,fixture.indexVersion)
 const max=result.data.rows.find(row=>row.id==='claude-fable-5-2')
 const high=result.data.rows.find(row=>row.id==='claude-fable-5-2-high')
 assert.equal(max.score,64.563595756626)
 assert.equal(max.cost,26.53855780398091)
 assert.equal(high.score,61.8218785440284)
 assert.equal(high.cost,9.078414777860381)
 assert.equal(max.firstAnswerLatency,268.4313495212288)
 assert.equal(max.sourceModelId,'593f2d23-247b-41c9-a679-cebd225f0a9a')
})

test('a failed leading release page falls back to independent version anchors without freezing valid ranking rows',async()=>{
 const models=releaseModels(),calls=new Map()
 const {data}=await collectCurrentAa({maxAttempts:1,fetchPage:async url=>{
  calls.set(url,(calls.get(url)||0)+1)
  if(url.endsWith('/leaderboards/models'))return releaseFlight(models)
  if(url.endsWith('/release-0'))throw Error('HTTP 503')
  return flight(releaseDetails(models.filter(m=>url.endsWith('/'+m.release.slug))))
 }})
 assert.equal(validBenchmark(data),true)
 assert.equal(data.rows[0].score,60);assert.equal(data.rows[0].detailStatus,'unavailable');assert.equal(data.rows[0].cost,0)
 assert.equal(calls.get('https://artificialanalysis.ai/models/release-0'),1)
 assert.ok(new Set(data.provenance.assets.filter(a=>a.indexVersion).map(a=>a.url)).size>=2)
})
test('independent version conflicts and sharp coverage losses fail closed',async()=>{
 const models=releaseModels()
 await assert.rejects(()=>collectCurrentAa({maxAttempts:1,fetchPage:async url=>url.endsWith('/leaderboards/models')?releaseFlight(models):flight(releaseDetails(models)).replaceAll('v5.0.1',url.endsWith('/release-0')?'v5.0.1':'v6.0')}),/指数版本不一致/)
 await assert.rejects(()=>collectCurrentAa({previousRows:Array.from({length:100},(_,i)=>({id:i,score:i})),fetchPage:async url=>url.endsWith('/leaderboards/models')?releaseFlight(models):flight(releaseDetails(models))}),/记录数量异常下降/)
})

test('November 18 ranking accepts the official underscored release without losing identity or archive validation',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/aa-release-2026-11-18.json',import.meta.url),'utf8'))
 const html=flight(fixture.ranking),calls=[]
 const {data}=await collectCurrentAa({maxAttempts:1,fetchPage:async url=>{
  calls.push(url)
  if(url===fixture.source)return html
  const page=fixture.details.find(d=>d.url===url)
  if(page)return flight(page.models)
  throw Error('No captured detail page')
 }})
 assert.equal(validBenchmark(data),true)
 assert.equal(data.indexVersion,fixture.indexVersion)
 assert.equal(data.rows.length,282)
 assert.equal(data.provenance.versionAnchors.length,2)
 const original=fixture.ranking.find(m=>m.release.slug==='joyvl2_v27')
 const row=data.rows.find(m=>m.sourceModelId===original.id)
 assert.equal(row.name,original.name)
 assert.equal(row.score,original.intelligenceIndex)
 assert.equal(row.sourceUrl,'https://artificialanalysis.ai/models/joyvl2_v27')
 assert.ok(calls.includes(row.sourceUrl))
 assert.equal(row.detailStatus,'unavailable','an accepted release address does not invent verified details')
 assert.equal(assertBenchmarkMatchesArchive(data,html),true)
 assert.throws(()=>assertBenchmarkMatchesArchive({...data,rows:data.rows.map(r=>r===row?{...r,score:999}:r)},html),/SCORE_MISMATCH/)
})

test('AA model addresses accept URL unreserved characters and reject redirects or path traversal',async()=>{
 for(const slug of ['joyvl2_v27','model-v2.1','Model_2~preview'])assert.equal(isAaModelSlug(slug),true)
 for(const slug of ['',null,undefined,42,'.','..','../model','model/other','https://other.test','//other.test','model?x=1','model#part','model%2fother','model%5cother','model\\other','model\n']){
  assert.equal(isAaModelSlug(slug),false,String(slug))
  const models=releaseModels();models[0].release.slug=slug
  let calls=0
  await assert.rejects(()=>collectCurrentAa({maxAttempts:1,fetchPage:async()=>{calls++;return releaseFlight(models)}}),/榜单身份或版本无法确认/)
  assert.equal(calls,1,'invalid addresses are rejected before requesting any detail page')
 }
})
