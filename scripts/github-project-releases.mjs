import {projectReleaseUrl} from '../src/domain/practice-projects.mjs'
export async function projectRelease(meta,before,api,now){
 try{
  const r=await api(`repos/${meta.full_name}/releases/latest`)
  if(!r||r.draft||r.prerelease||typeof r.tag_name!=='string'||!r.tag_name.trim()||r.tag_name.length>200||!Number.isFinite(Date.parse(r.published_at))||Date.parse(r.published_at)>Date.parse(now)||!projectReleaseUrl(r.html_url,meta.full_name,r.tag_name))throw Error('RELEASE_FIELDS_CHANGED')
  return {status:'published',tag:r.tag_name,publishedAt:r.published_at,url:r.html_url,observedAt:now,checkedAt:now}
 }catch(error){
  if(error.message==='GITHUB_HTTP_404')return {status:'none',observedAt:now,checkedAt:now}
  const old=before?.release
  if(before?.githubId===meta.id&&before?.repo?.toLowerCase()===meta.full_name.toLowerCase()&&old?.observedAt&&old.status!=='unavailable'&&Date.parse(now)-Date.parse(old.observedAt)<=30*86400000)return {...old,checkedAt:now,retained:true}
  return {status:'unavailable',checkedAt:now}
 }
}
