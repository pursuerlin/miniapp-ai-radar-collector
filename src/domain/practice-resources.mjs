import {validProjectExtras} from './practice-projects.mjs'
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))
const validResourceCopy=r=>(r.aliases===undefined||Array.isArray(r.aliases)&&r.aliases.length<=8&&r.aliases.every(a=>typeof a==='string'&&a.trim()&&a.length<=100))&&['introduction','example','requirements','cost'].every(k=>r[k]===undefined||typeof r[k]==='string'&&r[k].length<=2000)
const repo=value=>typeof value==='string'&&/^[\w.-]+\/[\w.-]+$/.test(value)
function validProjectGuide(r){
 const g=r.guide;if(g===undefined)return true
 return g&&['introduction','quickStart'].every(k=>typeof g[k]==='string'&&g[k].trim().length>0&&g[k].length<=2000)&&Array.isArray(g.uses)&&g.uses.length>0&&g.uses.length<=4&&g.uses.every(t=>typeof t==='string'&&t.trim().length>0&&t.length<=200)&&/^[a-f0-9]{64}$/.test(g.sourceHash)&&/^[a-f0-9]{40}$/.test(g.readmeSha)&&typeof g.readmePath==='string'&&/^[\w./-]+$/.test(g.readmePath)&&!g.readmePath.split('/').includes('..')&&g.url===`https://github.com/${r.repo}#readme`&&date(g.observedAt)&&date(g.checkedAt)&&Date.parse(g.observedAt)<=Date.parse(g.checkedAt)&&Date.parse(g.checkedAt)<=Date.parse(r.checkedAt)&&(g.retained===undefined||typeof g.retained==='boolean')
}
export const validSkillPath=p=>typeof p==='string'&&p.length<=240&&(p===''||p.split('/').every(s=>/^[\w.-]+$/.test(s)&&s!=='.'&&s!=='..'))
export const skillDocumentPath=p=>`${p?p+'/':''}SKILL.md`
export const resourceCategories=['全部','前端开发','UI 设计','视频制作','办公文档','写作沟通','视觉设计','测试自动化']
export const resourceId=(kind,value)=>`${kind}:${String(value).toLowerCase().replace(/[^a-z0-9-]+/g,'-')}`
export function githubResourceUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password?u.href:''}catch{return ''}}
export function resourceSourceUrl(value){
 const github=githubResourceUrl(value);if(github)return github
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='skills.sh'&&!u.username&&!u.password&&/^\/[\w.-]+\/[\w.-]+\/[\w.-]+$/.test(u.pathname)&&!u.search&&!u.hash?u.href:''}catch{return ''}
}
export function validSkillTotalLabel(label){
 return typeof label==='string'&&/^(?:0|[1-9]\d{0,12}|[1-9]\d{0,2}(?:,\d{3}){1,4}|[1-9]\d{0,2}(?:\.\d{1,2})?[KMB])$/.test(label)
}
const validSkillTotal=(row,checkedAt)=>row.totalInstalls===undefined||(
 row.kind==='skill'&&validSkillTotalLabel(row.totalInstalls?.label)&&
 date(row.totalInstalls.observedAt)&&Date.parse(row.totalInstalls.observedAt)<=Date.parse(checkedAt))
export function resourceTotalInstalls(row,now=Date.now()){
 const metric=row?.totalInstalls
 const age=now-Date.parse(metric?.observedAt)
 return metric?.label&&age>=-300000&&age<=7*86400000?metric:null
}
const newerInstallTotal=(before,next)=>{
 const a=before?.totalInstalls,b=next.totalInstalls
 const metric=a&&(!b||Date.parse(a.observedAt)>Date.parse(b.observedAt))?a:b
 return metric?{totalInstalls:metric}:{}
}
function validSkillTrend(r,checkedAt){return validResourceCopy(r)&&r?.kind==='skill'&&validSkillTotal(r,checkedAt)&&r.listingSource==='skills.sh'&&repo(r.repo)&&typeof r.name==='string'&&/^[\w.-]+$/.test(r.name)&&r.id===resourceId('skill',`${r.repo}/skills-sh/${r.name}`)&&r.url===`https://skills.sh/${r.repo}/${r.name}`&&r.repoUrl===`https://github.com/${r.repo}`&&resourceSourceUrl(r.url)&&r.install===`npx skills add ${r.repo} --skill ${r.name}`&&typeof r.title==='string'&&r.title.length>0&&typeof r.description==='string'&&r.description.length>0&&typeof r.originalDescription==='string'&&r.originalDescription.length>0&&/^[a-f0-9]{64}$/.test(r.sourceHash)&&typeof r.category==='string'&&date(r.observedAt)&&date(r.checkedAt)&&Date.parse(r.observedAt)<=Date.parse(r.checkedAt)&&Date.parse(r.checkedAt)<=Date.parse(checkedAt)&&r.trend?.period==='24h'&&Number.isSafeInteger(r.trend.rank)&&r.trend.rank>0&&Number.isSafeInteger(r.trend.installs)&&r.trend.installs>=0&&date(r.trend.observedAt)&&Date.parse(r.trend.observedAt)<=Date.parse(r.checkedAt)&&r.provenance?.url===r.url&&/^[a-f0-9]{64}$/.test(r.provenance.sha256)}
export function validPracticeResources(data){try{return validate(data)}catch{return false}}
function validate(data){
 if(data?.schemaVersion!==1||!date(data.checkedAt)||Date.parse(data.checkedAt)>Date.now()+300000||!Array.isArray(data.skills)||!Array.isArray(data.projects)||!Array.isArray(data.sources)||data.skills.length>100||data.projects.length>100)return false
 if(data.skillTrends?.length&&!data.sources.some(s=>s?.id==='skills-trending:24h'&&date(s.observedAt)))return false
 if(data.skillTrends!==undefined&&(!Array.isArray(data.skillTrends)||data.skillTrends.length>60||!data.skillTrends.every(r=>validSkillTrend(r,data.checkedAt))||new Set(data.skillTrends.map(r=>r.id)).size!==data.skillTrends.length||new Set(data.skillTrends.map(r=>r.trend.rank)).size!==data.skillTrends.length))return false
 const rows=[...data.skills,...data.projects],ids=new Set();if(data.skillTrends?.some(t=>rows.some(r=>r.id===t.id)))return false;if(!rows.length||JSON.stringify(data).length>1000000)return false
 return data.sources.every(s=>typeof s.id==='string'&&['ok','stale','error'].includes(s.status)&&date(s.checkedAt)&&(!s.observedAt||date(s.observedAt)&&Date.parse(s.observedAt)<=Date.parse(s.checkedAt))&&Date.parse(s.checkedAt)<=Date.parse(data.checkedAt))&&rows.every(r=>{
  if(!r||!validResourceCopy(r)||!validSkillTotal(r,data.checkedAt)||ids.has(r.id)||r.id!==resourceId(r.kind,r.kind==='skill'?`${r.repo}/${r.path}`:String(r.githubId))||!repo(r.repo)||!['skill','github'].includes(r.kind)||typeof r.title!=='string'||!r.title||typeof r.description!=='string'||!date(r.observedAt)||!date(r.checkedAt)||Date.parse(r.observedAt)>Date.parse(r.checkedAt)||Date.parse(r.checkedAt)>Date.parse(data.checkedAt)||!githubResourceUrl(r.url)||r.repoUrl!==`https://github.com/${r.repo}`||!githubResourceUrl(r.repoUrl))return false
  ids.add(r.id)
  if(r.popularity&&!(r.kind==='skill'&&r.popularity.period==='24h'&&Number.isSafeInteger(r.popularity.rank)&&r.popularity.rank>0&&Number.isSafeInteger(r.popularity.installs)&&r.popularity.installs>=0&&date(r.popularity.observedAt)&&Date.parse(r.popularity.observedAt)<=Date.parse(data.checkedAt)))return false
  if(r.kind==='skill')return r.url===`https://github.com/${r.repo}/blob/${r.revision}/${skillDocumentPath(r.path)}`&&validSkillPath(r.path)&&/^[a-f0-9]{40}$/.test(r.revision)&&typeof r.name==='string'&&/^[\w.-]+$/.test(r.name)&&typeof r.originalDescription==='string'&&r.originalDescription.length>0&&typeof r.install==='string'&&r.install===`npx skills add ${r.repo} --skill ${r.name}`&&typeof r.license==='string'&&typeof r.example==='string'
  return validProjectExtras(r)&&validProjectGuide(r)&&r.url===r.repoUrl&&typeof r.license==='string'&&typeof r.language==='string'&&Number.isSafeInteger(r.githubId)&&r.githubId>0&&Number.isSafeInteger(r.stars)&&r.stars>=0&&typeof r.archived==='boolean'&&date(r.pushedAt)&&Array.isArray(r.trending)&&r.trending.every(t=>['daily','weekly'].includes(t.period)&&Number.isSafeInteger(t.gain)&&t.gain>=0&&Number.isSafeInteger(t.rank)&&t.rank>0&&date(t.observedAt)&&Date.parse(t.observedAt)<=Date.parse(data.checkedAt))
 })
}
// A failed source keeps its own successful observation time. The envelope's
// check time must never make retained content appear newly observed.
export function mergePracticeResources(previous,next){
 if(!validPracticeResources(next))throw Error('Invalid resource feed')
 if(!validPracticeResources(previous))return next
 if(Date.parse(next.checkedAt)<Date.parse(previous.checkedAt))return previous
 const oldTrendSource=previous.sources.find(s=>s.id==='skills-trending:24h'),newTrendSource=next.sources.find(s=>s.id==='skills-trending:24h')
 const listingCurrent=newTrendSource&&(!newTrendSource.code||newTrendSource.code==='DETAILS_PARTIAL')&&(!oldTrendSource?.observedAt||Date.parse(newTrendSource.observedAt)>=Date.parse(oldTrendSource.observedAt))
 const merge=(old,rows)=>rows.map(r=>{
  const before=old.find(x=>x.id===r.id),base=before&&Date.parse(before.observedAt)>Date.parse(r.observedAt)?before:r
  if(!before)return base
  if(r.kind==='github'){
   const checkedAt=Date.parse(before.checkedAt)>Date.parse(r.checkedAt)?before.checkedAt:r.checkedAt,result={...base,checkedAt},a=before.release,b=r.release
   if(a?.observedAt&&Date.parse(next.checkedAt)-Date.parse(a.observedAt)<=30*86400000&&(!b?.observedAt||Date.parse(a.observedAt)>Date.parse(b.observedAt)))result.release={...a,checkedAt,retained:true}
   else if(b)result.release=b
   else delete result.release
   return result
  }
  // Description and popularity have independent clocks. Keeping the newer
  // description must not discard a newer statistic, or revive an absent one.
  const a=resourcePopularity(before,Date.parse(next.checkedAt)),b=resourcePopularity(r,Date.parse(next.checkedAt))
  const metric=listingCurrent?b:!a?b:!b||Date.parse(a.observedAt)>Date.parse(b.observedAt)?a:b
  const result={...base,...newerInstallTotal(before,r),checkedAt:r.checkedAt};delete result.popularity;if(metric)result.popularity=metric
  return result
 })
 const trendRows=next.skillTrends?.map(row=>{
  const before=previous.skillTrends?.find(r=>r.id===row.id)
  const base=before&&Date.parse(before.observedAt)>Date.parse(row.observedAt)?{...before,checkedAt:row.checkedAt,trend:row.trend}:row
  return {...base,...newerInstallTotal(before,row)}
 })
 // Older publishers do not know this additive field. Keep recent verified trends
 // without advancing their observation time until the new collector is deployed.
 const oldSource=previous.sources.find(s=>s.id==='skills-trending:24h'),nextSource=next.sources.find(s=>s.id==='skills-trending:24h')
 const olderTrend=Date.parse(oldSource?.observedAt)>Date.parse(nextSource?.observedAt)
 const retained=(next.skillTrends===undefined||olderTrend)&&previous.skillTrends?.filter(r=>Date.parse(next.checkedAt)-Date.parse(r.trend.observedAt)<=7*86400000)
 const source=oldSource
 return {...next,skills:merge(previous.skills,next.skills),projects:merge(previous.projects,next.projects),...(trendRows?{skillTrends:trendRows}:{}),...(retained?.length?{skillTrends:retained,sources:[...next.sources.filter(s=>s.id!=='skills-trending:24h'),{...source,id:'skills-trending:24h',status:'stale',checkedAt:next.checkedAt}]}:{})}
}
export function resourceAllowed(config,row){return config.pages.practice&&config.resources?.[row.kind]===true&&!config.hiddenIds.includes(row.id)}
/** @param {any} data @param {{kind?:string,query?:string,category?:string,period?:string,task?:string,skillScope?:string,savedOnly?:boolean,favorites?:string[],config?:any}} [options] */
export function filterResources(data,{kind='skill',query='',category='全部',period='daily',task='all',skillScope='featured',savedOnly=false,favorites=[],config}={}){
 const q=query.trim().toLowerCase(),rows=kind==='skill'?(savedOnly?[...data.skills,...(data.skillTrends||[])]:skillScope==='trending'?(data.skillTrends||[]):data.skills):data.projects
 return rows.filter(r=>(!config||resourceAllowed(config,r))&&(!savedOnly||favorites.includes(r.id))&&(savedOnly||category==='全部'||r.category===category)&&(kind!=='github'||task==='all'||r.guide?.tasks?.includes(task))&&(!q||[r.title,...(r.aliases||[]),r.repo,r.description,r.introduction,r.guide?.introduction,r.guide?.quickStart,...Object.values(r.guide?.conditions||{}),...(r.guide?.uses||[]),r.originalDescription,r.name,r.category].join(' ').toLowerCase().includes(q))&&(savedOnly||kind!=='github'||(period==='all'||(period==='featured'?(config?.featuredOverrides?.[r.id]??r.featured):r.trending.some(t=>t.period===period))))).sort((a,b)=>{
  if(kind==='skill'&&skillScope==='trending')return (a.trend?.rank||999)-(b.trend?.rank||999)
  if(kind==='github'&&period!=='featured'&&period!=='all')return (a.trending.find(t=>t.period===period)?.rank||999)-(b.trending.find(t=>t.period===period)?.rank||999)
  const fa=config?.featuredOverrides?.[a.id]??a.featured,fb=config?.featuredOverrides?.[b.id]??b.featured
  return Number(!!fb)-Number(!!fa)||(config?.sort==='title'?a.title.localeCompare(b.title,'zh-CN'):kind==='skill'?(resourcePopularity(b)?.installs??-1)-(resourcePopularity(a)?.installs??-1):0)
 })
}
// Both feeds retain their own timestamps; never turn an old observation into a fresh one.
export function resourcePopularity(row,now=Date.now()){
 const metric=row.trend||row.popularity
 const age=now-Date.parse(metric?.observedAt)
 return metric?.period==='24h'&&Number.isSafeInteger(metric.installs)&&metric.installs>=0&&age>=-300000&&age<=7*86400000?metric:null
}
export function resourceMetric(row,period='daily'){
 const t=row.trending?.find(t=>t.period===period)
 return t?`${period==='daily'?'今日':'本周'} +${t.gain.toLocaleString('en-US')}`:''
}
