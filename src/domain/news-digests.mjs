import {canonicalUrl} from './urls.mjs'
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(value)
export function validNewsDigest(value){
 return !!value&&value.language==='zh-CN'&&['source-text','source-summary'].includes(value.basis)&&text(value.title,150)&&text(value.overview,500)&&
  Array.isArray(value.points)&&value.points.length>=2&&value.points.length<=4&&value.points.every(point=>text(point,240))&&
  new Set(value.points).size===value.points.length&&!!canonicalUrl(value.sourceUrl)&&
  typeof value.generatedAt==='string'&&Number.isFinite(Date.parse(value.generatedAt))&&
  Object.keys(value).every(key=>['language','basis','title','overview','points','sourceUrl','generatedAt'].includes(key))
}
export function validDigestEnvelope(value){
 return value?.schemaVersion===1&&Array.isArray(value.items)&&value.items.every(item=>canonicalUrl(item.url)&&validNewsDigest(item.digest))&&
  new Set(value.items.map(item=>canonicalUrl(item.url))).size===value.items.length
}
/** @template T @param {T & {articles:any[]}} intelligence @param {any} envelope @returns {T & {articles:any[]}} */
export function applyNewsDigests(intelligence,envelope){
 if(!validDigestEnvelope(envelope))throw Error('Invalid news digest snapshot')
 const entries=new Map(envelope.items.map(item=>[canonicalUrl(item.url),item.digest]))
 return {...intelligence,articles:intelligence.articles.map(article=>{
  const bundled=entries.get(canonicalUrl(article.url))
  const digest=validNewsDigest(article.digest)&&(!bundled||Date.parse(article.digest.generatedAt)>=Date.parse(bundled.generatedAt))?article.digest:bundled
  return validNewsDigest(digest)&&[article.url,article.originalUrl].some(url=>canonicalUrl(url)===canonicalUrl(digest.sourceUrl))?{...article,digest}:article
 })}
}
export function pickNewsDigest(articles){
 return (articles||[]).map(article=>article.digest).find(validNewsDigest)||null
}
