import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {normalizeOfficialDocument} from '../scripts/media-official-documents.mjs'
const fixture=name=>readFile(new URL('./fixtures/media-official/'+name,import.meta.url),'utf8')

test('Wan pricing accepts both reviewed headers and explains combined input/output billing',async()=>{
 const old=await fixture('wan3-card.md'),current=await fixture('wan3-pricing-2026-11-19.md')
 const parse=body=>normalizeOfficialDocument(body,'alibaba','wan3.0-video-pricing')
 assert.equal(parse(current).fields.referencePrice,parse(old).fields.referencePrice)
 assert.equal(parse(current).fields.referencePrice,'480P：US$0.041256 / 秒；720P：US$0.082513 / 秒；1080P：US$0.165025 / 秒')
 assert.match(parse(current).sourceNote,/计费时长为输入与输出视频时长之和/)
 for(const body of [current.replaceAll('Per second','Per image'),current.replaceAll('(USD)','(CNY)'),current.replace('Billable duration = input video duration + output video duration.','Unknown duration.')])assert.throws(()=>parse(body),/DOCUMENT/)
})

test('Seedance pricing table layout preserves exact editions, three tiers and input conditions',async()=>{
 const old=await fixture('volc-pricing.md'),current=await fixture('volc-pricing-2026-11-19.md')
 for(const version of ['2.5','2.0']){
  const id='doubao-seedance-'+version+'-pricing',a=normalizeOfficialDocument(old,'volcengine',id),b=normalizeOfficialDocument(current,'volcengine',id)
  assert.deepEqual(b.fields,a.fields)
  assert.match(b.fields.videoOutputPrice,/4K：¥/)
  assert.match(b.fields.inputPrice,/含输入视频时/)
 }
 const parse=body=>normalizeOfficialDocument(body,'volcengine','doubao-seedance-2.5-pricing')
 for(const body of [current.replace('|Seedance 2.5 |','|Seedance 2.5 flash |'),current.replace('||4K |31.00 |19.00 |',''),current.replace('|70.00 |42.00 |','|70.00 |unknown |'),current.replaceAll('元/M token','元/秒')])assert.throws(()=>parse(body),/METADATA_/)
})
