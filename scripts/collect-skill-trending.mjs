import {createHash} from 'node:crypto'
import {resourceId,validSkillTotalLabel} from '../src/domain/practice-resources.mjs'
const slug=/^[\w.-]+\/[\w.-]+$/,name=/^[\w.-]+$/
const digest=text=>createHash('sha256').update(text).digest('hex')
export function parseSkillTrending(html){
 if(!/Trending \(24h\)/.test(html))throw Error('SKILL_TRENDING_PERIOD_CHANGED')
 const candidates=[]
 for(const match of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)){
  let chunk;try{chunk=JSON.parse(match[1])[1]}catch{continue}
  if(typeof chunk!=='string')continue
  // Only parse the named JSON array; never execute page scripts or flight data.
  const start=chunk.indexOf('"initialSkills":[')
  if(start<0||!chunk.includes('"view":"trending"'))continue
  const tail=chunk.slice(start+16),end=tail.indexOf('],"totalSkills"')
  if(end<0)throw Error('SKILL_TRENDING_STRUCTURE_CHANGED')
  let rows;try{rows=JSON.parse(tail.slice(0,end+1))}catch{throw Error('SKILL_TRENDING_STRUCTURE_CHANGED')}
  candidates.push(rows)
 }
 if(candidates.length!==1)throw Error('SKILL_TRENDING_STRUCTURE_CHANGED')
 const rows=candidates[0]
 if(!Array.isArray(rows)||!rows.length||rows.length>2000)throw Error('SKILL_TRENDING_FIELDS_CHANGED')
 return validateTrendRows(rows)
}
export function parseSkillTrendingApi(raw){
 let data;try{data=typeof raw==='string'?JSON.parse(raw):raw}catch{throw Error('SKILL_API_STRUCTURE_CHANGED')}
 if(data?.page!==0||!Number.isSafeInteger(data.total)||data.total<1||typeof data.hasMore!=='boolean'||!Array.isArray(data.skills)||!data.skills.length||data.skills.length>200||data.total<data.skills.length)throw Error('SKILL_API_FIELDS_CHANGED')
 return validateTrendRows(data.skills)
}
function validateTrendRows(rows){
 const ids=new Set()
 return rows.map((r,i)=>{
  const id=r.source+'/'+r.skillId
  if(typeof r.source!=='string'||!/^([\w.-]+\/)?[\w.-]+$/.test(r.source)||!name.test(r.skillId)||r.name!==r.skillId||!Number.isSafeInteger(r.installs)||r.installs<0||ids.has(id.toLowerCase()))throw Error('SKILL_TRENDING_FIELDS_CHANGED')
  ids.add(id.toLowerCase());return {repo:r.source,name:r.skillId,rank:i+1,installs:r.installs}
 }).filter(r=>slug.test(r.repo))
}
// Read the single Skill's visible Installs card, excluding the weekly chart and repo totals.
function parseTotalInstalls(html){
 const cards=[...html.matchAll(/<div\b[^>]*>\s*<span>Installs<\/span>\s*<\/div>\s*<div\b[^>]*>\s*([\d.,]+[KMB]?)\s*<\/div>/g)]
 const label=cards.length===1?cards[0][1]:''
 return validSkillTotalLabel(label)?label:null
}
export function parseSkillTrendDetail(html,{repo,name}){
 const url=`https://skills.sh/${repo}/${name}`
 const applications=[]
 for(const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)){
  let d;try{d=JSON.parse(m[1])}catch{continue}
  if(d?.['@type']==='SoftwareApplication')applications.push(d)
 }
 const d=applications[0]
 if(applications.length!==1||d.name!==name||d.url?.replace('https://www.skills.sh/','https://skills.sh/')!==url||typeof d.description!=='string'||!d.description.trim()||d.description.length>20000||!html.includes(`npx skills add https://github.com/${repo} --skill ${name}`))throw Error('SKILL_DETAIL_IDENTITY_CHANGED')
 const total=parseTotalInstalls(html)
 return {description:d.description,sourceHash:digest(d.description),...(total?{totalInstalls:total}:{})}
}
export async function collectSkillTrending({load,previous=[],now=new Date().toISOString(),editorial=[],limit=30,trackedSkills=[],detailTtlMs=6*3600000}={}){
 const url='https://skills.sh/trending',apiUrl='https://www.skills.sh/api/skills/trending/0',maxAge=7*86400000,deadline=Date.now()+90000
 const fresh=r=>Date.parse(r.observedAt)<=Date.parse(now)&&Date.parse(now)-Date.parse(r.observedAt)<=maxAge
 let html,listing,tracked=[],listingUrl=apiUrl,transport='json'
 try{
  let all
  try{html=await load(apiUrl);all=parseSkillTrendingApi(html)}catch{
   listingUrl=url;transport='html';html=await load(url);all=parseSkillTrending(html)
  }
  listing=all.filter(r=>r.rank<=limit);tracked=all.filter(r=>trackedSkills.some(s=>s.repo.toLowerCase()===r.repo.toLowerCase()&&s.name===r.name)).map(r=>({...r,observedAt:now}))
 }catch(e){
  const rows=previous.filter(fresh).map(r=>({...r,checkedAt:now}))
  return {rows,tracked,source:{id:'skills-trending:24h',status:rows.length?'stale':'error',checkedAt:now,...(rows.length?{observedAt:rows.reduce((a,r)=>!a||r.trend.observedAt<a?r.trend.observedAt:a,'')}:{}),code:/CHANGED/.test(e.message)?'SOURCE_CHANGED':/429|RATE_LIMIT/.test(e.message)?'RATE_LIMIT':/timeout|abort|ETIMEDOUT/i.test([e.name,e.message,e.cause?.code].join(' '))?'TIMEOUT':'UNAVAILABLE',url}}
 }
 const staged=new Array(listing.length);let next=0,failures=0,reused=0,verified=0
 const annotationFor=row=>editorial.find(a=>a.repo.toLowerCase()===row.repo.toLowerCase()&&a.name===row.name&&a.sourceHash===row.sourceHash)
 const annotate=row=>{const a=annotationFor(row);return a?{...row,title:a.title,description:a.description,category:a.category,...Object.fromEntries(['introduction','example','requirements','cost'].filter(k=>typeof a[k]==='string').map(k=>[k,a[k]]))}:row}
 await Promise.all(Array.from({length:4},async()=>{while(next<listing.length){const index=next++,entry=listing[index],before=previous.find(r=>r.repo.toLowerCase()===entry.repo.toLowerCase()&&r.name===entry.name)
  if(before?.totalInstalls&&fresh(before)&&Date.parse(now)-Date.parse(before.observedAt)<detailTtlMs){
   reused++;const row=annotate({...before,checkedAt:now,detailCached:true,trend:{period:'24h',rank:entry.rank,installs:entry.installs,observedAt:now}});delete row.detailRetained;staged[index]=row;continue
  }
  try{
   if(Date.now()>deadline)throw Error('SKILL_SOURCE_BUDGET')
   const detailHtml=await load(`https://skills.sh/${entry.repo}/${entry.name}`),detail=parseSkillTrendDetail(detailHtml,entry)
   const annotation=annotationFor({...entry,...detail});verified++
   const totalInstalls=detail.totalInstalls?{label:detail.totalInstalls,observedAt:now}:before?.totalInstalls
   staged[index]=annotate({id:resourceId('skill',`${entry.repo}/skills-sh/${entry.name}`),kind:'skill',listingSource:'skills.sh',repo:entry.repo,name:entry.name,title:annotation?.title||entry.name,description:annotation?.description||detail.description,originalDescription:detail.description,sourceHash:detail.sourceHash,category:annotation?.category||'趋势技能',url:`https://skills.sh/${entry.repo}/${entry.name}`,repoUrl:`https://github.com/${entry.repo}`,install:`npx skills add ${entry.repo} --skill ${entry.name}`,compatibility:'Agent Skills 格式；支持范围与依赖以作者说明为准。',requirements:'需要支持技能的 AI 工具；安装前请阅读作者说明。',cost:'热度不代表免费；模型 API、外部服务和许可条件请查阅作者说明。',license:'以作者仓库许可为准',featured:false,observedAt:now,checkedAt:now,...(totalInstalls?{totalInstalls}:{}),trend:{period:'24h',rank:entry.rank,installs:entry.installs,observedAt:now},provenance:{url:`https://skills.sh/${entry.repo}/${entry.name}`,sha256:digest(detailHtml)}})
  }catch{failures++;if(before&&fresh(before))staged[index]=annotate({...before,checkedAt:now,detailRetained:true,trend:{period:'24h',rank:entry.rank,installs:entry.installs,observedAt:now}})}
 }}))
 const rows=staged.filter(Boolean)
 return {rows,tracked,source:{id:'skills-trending:24h',status:failures?'stale':'ok',checkedAt:now,observedAt:now,url,listingUrl,transport,sha256:digest(html),listed:listing.length,details:rows.length,detailsReused:reused,detailsVerified:verified,detailsFailed:failures,...(failures?{code:'DETAILS_PARTIAL'}:{})}}
}
