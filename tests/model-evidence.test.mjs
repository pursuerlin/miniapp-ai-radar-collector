import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {parseEvidenceIndex,parseEvidenceDetail,collectModelEvidence,createEvidenceClient} from '../scripts/collect-model-evidence.mjs'
import {validModelEvidence,evidenceRows,mergeEvidence,evidenceComparisons,evidenceDelivery} from '../src/domain/model-evidence.mjs'
import {parseGenEval,parseVBench,collectPublicBenchmarks} from '../scripts/collect-public-benchmarks.mjs'
import {validPublicBenchmarks,mergePublicBenchmarks} from '../src/domain/public-benchmarks.mjs'
const fixture=async name=>readFile(new URL('./fixtures/model-evidence/'+name,import.meta.url),'utf8')
const index=await fixture('index.md'),detail=await fixture('detail.md'),parsed=parseEvidenceIndex(index),row=parsed.models.find(r=>r.id==='gpt-6-1-sol'),facts=parseEvidenceDetail(detail,row)
const get=async path=>{if(path==='/leaderboard.md')return index;if(path==='/leaderboard/gpt-6-1-sol.md')return detail;throw Object.assign(Error(),{code:'EVIDENCE_ACCESS_CHALLENGE'})}
const data=await collectModelEvidence({get:async path=>path==='/leaderboard.md'?index:path.endsWith('/gpt-6-1-sol.md')?detail:Promise.reject(Object.assign(Error(),{code:'EVIDENCE_DETAILS_INVALID'}))})
test('official Markdown keeps original scores, configurations and conditional prices',()=>{
 assert.equal(parsed.models.length,98);assert.equal(facts.evaluations.length,56);assert.equal(facts.categoryRanks['科研'],5);assert.ok(facts.prices.some(p=>p.includes('272K')));assert.ok(facts.evaluations.some(e=>e.notes.includes('Max 推理')));assert.equal(facts.evaluations.filter(e=>e.evaluator==='Artificial Analysis').length,15);assert.ok(validModelEvidence(data))
})
test('reject identity/version mismatch, truncated detail and numeric schema drift',()=>{
 assert.throws(()=>parseEvidenceDetail(detail,{...row,provider:'other'}),/IDENTITY/)
 assert.throws(()=>parseEvidenceDetail(detail,{...row,sourceUpdatedAt:'2026-11-16T12:10:00.000Z'}),/VERSION/)
 assert.throws(()=>parseEvidenceDetail(detail.replace('| 综合 | 9 | 70.1 | 56 |','| 综合 | 9 | 70.1 | 57 |'),row),/COVERAGE/)
 assert.throws(()=>parseEvidenceIndex(index.replace('共 93 个模型','共 94 个模型')),/COVERAGE/)
})
test('challenge stops requests and saves partial generation; old details are not relabeled',async()=>{
 let calls=0;const result=await collectModelEvidence({get:async path=>{calls++;return get(path)}})
 assert.equal(calls,2);assert.equal(result.status,'partial');assert.equal(result.models.filter(r=>r.detailStatus==='ok').length,0)
 const retained=await collectModelEvidence({previous:data,get});assert.ok(retained.models.find(r=>r.id===row.id).evaluations.length===56)
 assert.ok(retained.errors.some(e=>e.code==='EVIDENCE_FINAL_CHECK_DEFERRED'))
})
test('positively changed final index invalidates the run',async()=>{
 let reads=0;await assert.rejects(collectModelEvidence({get:async path=>path==='/leaderboard.md'?(++reads===1?index:index.replace('79.8','79.9')):Promise.reject(Object.assign(Error(),{code:'EVIDENCE_DETAILS_INVALID'}))}),/VERSION_CHANGED/)
})
test('http challenge, status and ETag are handled without executing scripts',async()=>{
 const challenge=createEvidenceClient({wait:async()=>{},fetcher:async()=>new Response('<script>blocked</script>')});await assert.rejects(challenge('/leaderboard.md'),/ACCESS_CHALLENGE/)
 let n=0;const client=createEvidenceClient({wait:async()=>{},fetcher:async(_,options)=>{if(n++){assert.equal(options.headers['If-None-Match'],'abc');return new Response(null,{status:304})}return new Response(index,{headers:{etag:'abc'}})}});assert.equal(await client('/leaderboard.md'),await client('/leaderboard.md',{revalidate:true}))
})
test('categories preserve original ranks and missing data never becomes zero',()=>{
 const rows=evidenceRows(data,'科研');assert.equal(rows.length,1);assert.equal(rows[0].place,5);assert.equal(evidenceRows(data,'综合','',()=>false).length,0)
 const altered=structuredClone(data);altered.models[0].url='https://evil.example/model';assert.equal(validModelEvidence(altered),false)
 const older={...data,collectedAt:'2026-11-16T00:00:00.000Z'};assert.equal(mergeEvidence(data,older),data)
 const pairs=evidenceComparisons([{name:'a',evaluations:[facts.evaluations[0]]},{name:'b',evaluations:[{...facts.evaluations[0],evaluator:'other'}]}]);assert.equal(pairs.length,0)
})
test('public benchmark archives keep dimensions and real zero; failed source retains old observation time',async()=>{
 const geneval=await fixture('geneval.md'),vbench=await fixture('vbench.html');assert.equal(parseGenEval(geneval).length,6);assert.equal(parseGenEval(geneval)[0].scores['Color attribution'],0);assert.equal(Object.keys(parseVBench(vbench)[0].scores).length,16)
 const result=await collectPublicBenchmarks({fetcher:async url=>new Response(url.includes('geneval')?geneval:vbench)});assert.ok(validPublicBenchmarks(result));assert.ok(result.sources.every(s=>s.sourceUpdatedAt===null))
 const stale=await collectPublicBenchmarks({previous:result,fetcher:async()=>new Response('fail',{status:503})});assert.equal(stale.sources[0].status,'stale');assert.equal(stale.sources[0].observedAt,result.sources[0].observedAt);assert.deepEqual(mergePublicBenchmarks(stale,result).sources[0].rows,result.sources[0].rows)
 assert.throws(()=>parseVBench(vbench.replace('0.9141','9.141')),/SCORE_INVALID/)
})

test('native evidence validation does not require the browser URL constructor',()=>{
 const saved=globalThis.URL;try{globalThis.URL=undefined;assert.equal(validModelEvidence(data),true)}finally{globalThis.URL=saved}
})
test('official no-paid-API title and zero-test category retain unknown scores',async()=>{
 const unranked=parsed.models.find(r=>r.id==='ember-1'),facts=parseEvidenceDetail(await fixture('unranked.md'),unranked)
 assert.equal(facts.evaluations.length,9);assert.equal(facts.categories['知识问答'],undefined);assert.equal(facts.categoryRanks['编程'],null)
 const open=parseEvidenceDetail(await fixture('open-weight.md'),parsed.models.find(r=>r.id==='muse-spark-open'))
 assert.equal(open.openWeight,true);assert.ok(open.prices.includes('厂商没有提供付费 API'));assert.ok(open.evaluations.length)
})
test('a withheld category score stays unknown even when its section has tests and a provisional heading',async()=>{
 const facts=parseEvidenceDetail(await fixture('missing-category.md'),parsed.models.find(r=>r.id==='ling-3-1-flash'))
 assert.equal(facts.categories['编程'],undefined);assert.equal(facts.evaluations.filter(e=>e.category==='编程').length,2);assert.equal(facts.evaluations.length,13)
})


test('repeated successful evidence is unchanged; real rollback remains protected',()=>{
 const repeat=JSON.parse(JSON.stringify(data))
 assert.equal(evidenceDelivery(data,repeat).outcome,'unchanged')
 assert.equal(evidenceDelivery(data,repeat).data,data)
 const older=structuredClone(data)
 const checkedLater={...data,checkedAt:new Date(Date.parse(data.checkedAt)+60000).toISOString()}
 // Identical facts checked earlier are not an older source generation.
 assert.equal(evidenceDelivery(checkedLater,older).outcome,'unchanged')
 const rollback=structuredClone(data)
 rollback.provenance.sourceUpdatedAt=new Date(Date.parse(data.provenance.sourceUpdatedAt)-60000).toISOString()
 rollback.models.forEach(row=>row.sourceUpdatedAt=rollback.provenance.sourceUpdatedAt)
 assert.equal(evidenceDelivery(data,rollback).outcome,'older')
 assert.equal(evidenceDelivery(data,rollback).data,data)
 const newer=structuredClone(data)
 newer.checkedAt=new Date(Date.parse(data.checkedAt)+1000).toISOString()
 newer.models[0].rankingNote+=' Updated'
 assert.equal(evidenceDelivery(data,newer).outcome,'updated')
 assert.equal(evidenceDelivery(data,null).outcome,'invalid')
})


test('an old detail generation is revalidated once; a still-mismatched result stays missing',async()=>{
 for(const recovers of [true,false]){
  const stale=detail.replace('2026-11-17 20:10','2026-11-16 20:10')
  assert.notEqual(stale,detail)
  let calls=0,revalidated=false
  const result=await collectModelEvidence({get:async(path,options={})=>{
   if(path==='/leaderboard.md')return index
   if(!path.endsWith('/gpt-6-1-sol.md'))throw Object.assign(Error(),{code:'EVIDENCE_DETAILS_INVALID'})
   calls++;if(options.revalidate){revalidated=true;return recovers?detail:stale}return stale
  }})
  const model=result.models.find(r=>r.id===row.id)
  assert.equal(calls,2);assert.equal(revalidated,true)
  assert.equal(model.detailStatus,recovers?'ok':'missing')
 }
})


test('one failed detail read may recover, while persistent transport errors remain bounded',async()=>{
 for(const recovers of [true,false]){
  let calls=0
  const result=await collectModelEvidence({get:async(path)=>{
   if(path==='/leaderboard.md')return index
   if(!path.endsWith('/gpt-6-1-sol.md'))throw Object.assign(Error(),{code:'EVIDENCE_DETAILS_INVALID'})
   calls++;if(calls===1||!recovers)throw Object.assign(Error(),{code:'EVIDENCE_REQUEST_FAILED'})
   return detail
  }})
  assert.equal(calls,2)
  assert.equal(result.models.find(r=>r.id===row.id).detailStatus,recovers?'ok':'missing')
 }
})
