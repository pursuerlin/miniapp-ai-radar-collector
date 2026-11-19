import {createHash} from 'node:crypto'
const hash=value=>createHash('sha256').update(value||'').digest('hex')
// Editorial copy is bound to a repository identity and the README actually reviewed.
export async function projectGuide(meta,before,guides,api,now){
 const spec=guides.find(g=>g.githubId===meta.id&&g.repo.toLowerCase()===meta.full_name.toLowerCase()&&g.sourceHash===hash(meta.description))
 if(!spec)return undefined
 const previous=before?.guide
 const exact=before?.githubId===meta.id&&previous?.readmeSha===spec.readmeSha&&previous?.sourceHash===spec.sourceHash&&previous?.readmePath===spec.readmePath
 const content={introduction:spec.introduction,uses:spec.uses,quickStart:spec.quickStart,sourceHash:spec.sourceHash,readmeSha:spec.readmeSha,readmePath:spec.readmePath,...Object.fromEntries(['tasks','conditions','examples','relatedSkills'].filter(k=>spec[k]!==undefined).map(k=>[k,spec[k]])),url:`https://github.com/${meta.full_name}#readme`}
 try{
  const file=await api(`repos/${meta.full_name}/readme`)
  if(file.sha!==spec.readmeSha||file.path!==spec.readmePath)return undefined
  return {...content,observedAt:now,checkedAt:now}
 }catch{
  // Metadata can update independently; retained prose keeps its own clock.
  return exact?{...content,observedAt:previous.observedAt,checkedAt:now,retained:true}:undefined
 }
}
