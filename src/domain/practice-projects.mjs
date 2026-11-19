export const projectTasks=[{id:'all',label:'全部用途'},{id:'web',label:'做网页'},{id:'office',label:'办公自动化'},{id:'local',label:'本地模型'},{id:'media',label:'图像视频'},{id:'agent',label:'Agent 开发'},{id:'research',label:'研究写作'}]
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))
const text=(v,max=500)=>typeof v==='string'&&v.trim().length>0&&v.length<=max
export function projectDocumentUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['github.com','docs.openwebui.com','appwrite.io','docs.plannotator.ai'].includes(u.hostname)?u.href:''}catch{return ''}}
export function projectReleaseUrl(value,repo,tag){try{const u=new URL(value),prefix=`/${repo}/releases/tag/`;return u.origin==='https://github.com'&&!u.username&&!u.password&&u.pathname.startsWith(prefix)&&decodeURIComponent(u.pathname.slice(prefix.length))===tag&&!u.search&&!u.hash?u.href:''}catch{return ''}}
export function validProjectExtras(row){
 const g=row.guide
 if(g){
  if(g.tasks!==undefined&&(!Array.isArray(g.tasks)||g.tasks.length>6||new Set(g.tasks).size!==g.tasks.length||!g.tasks.every(id=>projectTasks.some(t=>t.id===id&&id!=='all'))))return false
  if(g.conditions!==undefined&&(!g.conditions||Object.keys(g.conditions).some(k=>!['audience','runtime','credentials','cost','hardware'].includes(k))||!Object.values(g.conditions).every(v=>text(v))))return false
  if(g.examples!==undefined&&(!Array.isArray(g.examples)||g.examples.length>4||!g.examples.every(e=>text(e.title,100)&&projectDocumentUrl(e.url)&&e.sourceUrl===row.repoUrl+'#readme')))return false
  if(g.relatedSkills!==undefined&&(!Array.isArray(g.relatedSkills)||g.relatedSkills.length>6||new Set(g.relatedSkills.map(r=>r.id)).size!==g.relatedSkills.length||!g.relatedSkills.every(r=>/^skill:[a-z0-9-]{1,190}$/.test(r.id)&&['same-repo','task'].includes(r.relation)&&text(r.reason,200))))return false
 }
 const r=row.release;if(r===undefined)return true
 if(!r||!['published','none','unavailable'].includes(r.status)||!date(r.checkedAt)||Date.parse(r.checkedAt)>Date.parse(row.checkedAt)||r.observedAt!==undefined&&(!date(r.observedAt)||Date.parse(r.observedAt)>Date.parse(r.checkedAt))||r.retained!==undefined&&typeof r.retained!=='boolean')return false
 if(r.status==='unavailable')return r.observedAt===undefined&&r.tag===undefined&&r.url===undefined&&r.publishedAt===undefined
 if(!date(r.observedAt))return false
 if(r.status==='none')return r.tag===undefined&&r.url===undefined&&r.publishedAt===undefined
 return text(r.tag,200)&&date(r.publishedAt)&&Date.parse(r.publishedAt)<=Date.parse(r.observedAt)&&!!projectReleaseUrl(r.url,row.repo,r.tag)
}
export function relatedProjectSkills(row,data,config){
 return (row.guide?.relatedSkills||[]).flatMap(link=>{
  const target=data.skills.find(s=>s.id===link.id)
  return target&&config?.pages?.practice&&config?.resources?.skill===true&&!config.hiddenIds?.includes(target.id)&&(link.relation!=='same-repo'||target.repo.toLowerCase()===row.repo.toLowerCase())?[{...target,relation:link.relation,reason:link.reason}]:[]
 })
}
