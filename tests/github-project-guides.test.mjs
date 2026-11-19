import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {projectGuide} from '../scripts/github-project-guides.mjs'
import {validPracticeResources} from '../src/domain/practice-resources.mjs'
const now='2026-11-19T05:00:00Z',meta={id:1,full_name:'owner/repo',description:'AI project'},spec={githubId:1,repo:meta.full_name,sourceHash:createHash('sha256').update(meta.description).digest('hex'),readmeSha:'a'.repeat(40),readmePath:'README.md',introduction:'已核实用途',uses:['任务一','任务二'],quickStart:'阅读快速开始'}
const api=async()=>({sha:spec.readmeSha,path:spec.readmePath})
test('project guide requires exact repo, identity, metadata and reviewed README revision',async()=>{
 const g=await projectGuide(meta,null,[spec],api,now);assert.equal(g.introduction,spec.introduction);assert.equal(g.url,'https://github.com/owner/repo#readme')
 for(const patch of [{id:2},{full_name:'other/repo'},{description:'changed'}])assert.equal(await projectGuide({...meta,...patch},null,[spec],api,now),undefined)
 assert.equal(await projectGuide(meta,null,[spec],async()=>({sha:'b'.repeat(40),path:'README.md'}),now),undefined)
})
test('README failure retains only exact previously verified copy and its original clock',async()=>{
 const old=await projectGuide(meta,null,[spec],api,now),later='2026-11-19T06:00:00Z',offline=async()=>{throw Error('offline')}
 const kept=await projectGuide(meta,{githubId:meta.id,guide:old},[spec],offline,later);assert.equal(kept.observedAt,now);assert.equal(kept.checkedAt,later);assert.equal(kept.retained,true)
 assert.equal(await projectGuide(meta,null,[spec],offline,later),undefined)
 assert.equal(await projectGuide(meta,{githubId:meta.id,guide:old},[{...spec,readmeSha:'b'.repeat(40)}],offline,later),undefined)
})
test('optional project guide accepts older feeds and rejects unsafe or malformed provenance',async()=>{
 const data=JSON.parse(fs.readFileSync('src/practice-resources/resources.json')),r=data.projects[0];delete r.guide;assert.equal(validPracticeResources(data),true)
 const g=await projectGuide(meta,null,[spec],api,r.checkedAt);r.guide={...g,url:r.repoUrl+'#readme'};assert.equal(validPracticeResources(data),true)
 for(const patch of [{url:'https://evil.test'},{observedAt:'2999-01-01'},{uses:['']},{readmePath:'../README.md'},{readmeSha:'main'}]){r.guide={...g,url:r.repoUrl+'#readme',...patch};assert.equal(validPracticeResources(data),false)}
})
