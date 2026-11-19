import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {buildChangesFiles} from '../scripts/build-changes.mjs'
import {validChanges,buildChanges,catalogFingerprint} from '../src/domain/changes.mjs'
import {validatePublicPayloads} from '../scripts/validate-public-data.mjs'
const fixture=JSON.parse(await readFile('tests/fixtures/publication-payloads.json','utf8'))
test('change publication anchors honestly, persists its baseline and compares the next coherent catalog',async t=>{
 const root=await mkdtemp(resolve(tmpdir(),'collector-changes-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(resolve(root,'src/data'),{recursive:true})
 const snapshot=structuredClone(fixture['snapshot.json']);delete snapshot.onlineData
 await writeFile(resolve(root,'src/data/snapshot.json'),JSON.stringify(snapshot))
 const first=await buildChangesFiles({root,now:new Date(snapshot.collectedAt)});assert.equal(first.reanchored,true);assert.equal(first.changes.total,0);assert.ok(validChanges(first.changes))
 const old=await readFile(resolve(root,'public/radar/catalog-baseline.json'),'utf8')
 snapshot.models[0].input=(snapshot.models[0].input||1)*2;snapshot.collectedAt=new Date(Date.parse(snapshot.collectedAt)+3600000).toISOString();await writeFile(resolve(root,'src/data/snapshot.json'),JSON.stringify(snapshot))
 const next=await buildChangesFiles({root,now:new Date(snapshot.collectedAt)});assert.equal(next.reanchored,false);assert.ok(next.changes.items.some(i=>i.kind==='price'))
 assert.equal(await readFile(resolve(root,'public/radar/catalog-baseline.json'),'utf8'),old)
 assert.ok(validChanges(JSON.parse(await readFile(resolve(root,'public/radar/changes.json'),'utf8'))))
 // A rollback to an older catalog must re-anchor, never emit an inverted window.
 snapshot.collectedAt=new Date(Date.parse(snapshot.collectedAt)-86400000).toISOString();await writeFile(resolve(root,'src/data/snapshot.json'),JSON.stringify(snapshot));assert.equal((await buildChangesFiles({root})).reanchored,true)
})

test('publication rejects corrupt baselines, mismatched windows and fabricated change records',()=>{
 const payloads=structuredClone(fixture)
 const baseline=catalogFingerprint(payloads['snapshot.json'])
 payloads['catalog-baseline.json']=baseline
 payloads['changes.json']=buildChanges(baseline,catalogFingerprint(payloads['snapshot.json']))
 assert.equal(validatePublicPayloads(payloads).ok,true)
 const stale=structuredClone(payloads);stale['changes.json'].window.to='2020-01-01T00:00:00Z'
 assert.throws(()=>validatePublicPayloads(stale),/PUBLIC_CHANGES_INVALID/)
 const fabricated=structuredClone(payloads);fabricated['changes.json'].total=1;fabricated['changes.json'].stats.price=1
 assert.throws(()=>validatePublicPayloads(fabricated),/PUBLIC_CHANGES_MISMATCH/)
 for(const damage of [b=>b.models.push(b.models[0]),b=>b.models[0].input=-1,b=>b.models[0].name='',b=>b.models=[]]){
  const broken=structuredClone(payloads);damage(broken['catalog-baseline.json'])
  assert.throws(()=>validatePublicPayloads(broken),/PUBLIC_CHANGE_BASELINE_INVALID/)
 }
})
