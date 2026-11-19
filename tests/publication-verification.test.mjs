import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {readPublicPayloads,validatePublicPayloads} from '../scripts/validate-public-data.mjs'
import {verifyPublishedData} from '../scripts/verify-published-data.mjs'
const expected=JSON.parse(await readFile(new URL('./fixtures/publication-payloads.json',import.meta.url),'utf8'))
test('public verification waits through mixed CDN snapshots and proves actual file contents',async()=>{
 let round=0,waits=0
 const result=await verifyPublishedData({expected,maxAttempts:3,wait:async()=>{waits++;round++},fetcher:async url=>{
  const name=new URL(url).pathname.split('/').pop(),body=structuredClone(expected[name])
  if(round===0&&name==='latest-benchmark.json')body.rows[0].cost=(body.rows[0].cost||0)+1
  return Response.json(body)
 }})
 assert.equal(result.ok,true);assert.equal(result.attempts,2);assert.equal(waits,1);assert.equal(result.files.length,7)
 const failed=await verifyPublishedData({expected,maxAttempts:1,fetcher:async()=>new Response('',{status:503})})
 assert.equal(failed.ok,false);assert.equal(failed.state,'unverified');assert.equal(failed.errorCode,'PUBLIC_HTTP_503')
})
test('same timestamps cannot make a contradictory snapshot or health report valid',()=>{
 const broken=structuredClone(expected);broken['snapshot.json'].onlineData.benchmark.rows[0].cost=123456
 assert.throws(()=>validatePublicPayloads(broken),/SNAPSHOT_MISMATCH/)
 const wrong=structuredClone(expected);wrong['health.json'].generatedAt='2020-01-01T00:00:00Z'
 assert.throws(()=>validatePublicPayloads(wrong),/HEALTH_MISMATCH/)
})
test('source metadata and dataset status cannot disappear from an otherwise matching report',()=>{
 const missing=structuredClone(expected);delete missing['health.json'].sourceHealth
 assert.throws(()=>validatePublicPayloads(missing),/SOURCE_HEALTH_MISMATCH/)
 const stale=structuredClone(expected);stale['health.json'].datasets[0].status='stale'
 assert.throws(()=>validatePublicPayloads(stale),/HEALTH_DATASETS_MISMATCH/)
 const future=structuredClone(expected);future['manifest.json'].generatedAt=new Date(Date.now()+3600000).toISOString();future['snapshot.json'].onlineData.manifest=structuredClone(future['manifest.json']);future['health.json'].generatedAt=future['manifest.json'].generatedAt
 assert.throws(()=>validatePublicPayloads(future),/FUTURE_TIMESTAMP/)
})

test('media is fetched and compared when the manifest includes it; 404 cannot verify successfully',async()=>{
 const media=JSON.parse(await readFile('src/data/media-leaderboards.json','utf8'))
 const candidate=structuredClone(expected)
 candidate['media-leaderboards.json']=media
 const dataset={label:'生图与视频质量榜',collectedAt:media.collectedAt,status:'ok',source:'Artificial Analysis Data API'}
 candidate['manifest.json'].datasets.media=dataset
 candidate['snapshot.json'].onlineData.manifest=structuredClone(candidate['manifest.json'])
 candidate['health.json'].datasets.push({id:'media',...dataset})
 const names=[]
 const fetcher=async url=>{const name=new URL(url).pathname.split('/').pop();names.push(name);return Response.json(candidate[name])}
 const ok=await verifyPublishedData({expected:candidate,fetcher,maxAttempts:1})
 assert.equal(ok.ok,true);assert.equal(ok.files.length,8);assert.ok(names.includes('media-leaderboards.json'))
 const missing=await verifyPublishedData({expected:candidate,maxAttempts:1,fetcher:async url=>url.includes('media-leaderboards')?new Response('',{status:404}):fetcher(url)})
 assert.equal(missing.ok,false);assert.equal(missing.errorCode,'PUBLIC_HTTP_404')
 const changed=await verifyPublishedData({expected:candidate,maxAttempts:1,fetcher:async url=>{if(!url.includes('media-leaderboards'))return fetcher(url);const next=structuredClone(media);next.boards[0].rows[0].elo++;return Response.json(next)}})
 assert.equal(changed.ok,false);assert.equal(changed.errorCode,'PUBLIC_CONTENT_PENDING')
})
