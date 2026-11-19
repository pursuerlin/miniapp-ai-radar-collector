import {canonicalUrl} from './urls.mjs'
export const EDITORIAL_TOPICS=['模型发布','产品工具','研究评测','行业动态']
export function validEditorial(value){
 return !!value&&typeof value.lead==='string'&&value.lead.trim().length>0&&value.lead.length<=1200&&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.lead)&&
  EDITORIAL_TOPICS.includes(value.topic)&&typeof value.recommended==='boolean'&&
  typeof value.syncedAt==='string'&&Number.isFinite(Date.parse(value.syncedAt))&&
  Object.keys(value).every(key=>['lead','topic','recommended','syncedAt'].includes(key))
}
// Always rebuild editorial annotations, so a later rejection removes an older lead.
// A grouped event can carry several articles; the recommended lead wins, otherwise the
// first reviewed annotation is used so the reader sees what a human actually wrote.
export function pickEditorial(articles) {
  const found = (articles || []).map(article => article?.editorial).filter(Boolean)
  if (!found.length) return null
  return found.find(entry => validEditorial(entry) && entry.recommended) || found.find(entry => validEditorial(entry)) || null
}
// A skipped or failed review round cannot speak for annotations already published.
// Carry them forward so a catalog-only refresh does not erase the last approved lead;
// a successful round replaces the envelope and remains authoritative.
export function mergeEditorialEnvelope(envelope,intelligence){
 const items=[...(envelope?.items||[])]
 const seen=new Set(items.map(item=>canonicalUrl(item.url)))
 for(const article of intelligence?.articles||[]){
  if(!article.editorial||!validEditorial(article.editorial))continue
  const url=canonicalUrl(article.url)
  if(!url||seen.has(url))continue
  seen.add(url);items.push({url,editorial:article.editorial})
 }
 if(!items.length)return envelope
 const syncedAt=envelope?.syncedAt||items.map(item=>item.editorial.syncedAt).sort().pop()
 return {...(envelope||{}),schemaVersion:1,syncedAt,items}
}
export function applyEditorial(intelligence,envelope){
 if(envelope&&(envelope.schemaVersion!==1||!Array.isArray(envelope.items)||!envelope.items.every(item=>canonicalUrl(item.url)&&validEditorial(item.editorial))))throw Error('Invalid editorial snapshot')
 const entries=new Map((envelope?.items||[]).map(item=>[canonicalUrl(item.url),item.editorial]))
 if(entries.size!==(envelope?.items.length||0))throw Error('Duplicate editorial URL')
 const articles=intelligence.articles.slice()
 const known=new Set(articles.map(article=>canonicalUrl(article.url)))
 for(const item of envelope?.items||[]){
  if(known.has(canonicalUrl(item.url))||!item.article)continue
  const article=item.article,source=intelligence.sources.find(source=>source.id===article.sourceId)
  if(canonicalUrl(article.url)!==canonicalUrl(item.url)||!source||article.family!==source.family||article.kind!==source.kind||
   article.summary!==''||typeof article.title!=='string'||!article.title.trim()||!Number.isFinite(Date.parse(article.publishedAt))||
   Date.parse(article.publishedAt)>Date.parse(intelligence.collectedAt)||Date.parse(article.publishedAt)<Date.parse(intelligence.collectedAt)-30*864e5)throw Error('Invalid editorial article')
  articles.push(article);known.add(canonicalUrl(item.url))
 }
 const annotated=articles.map(article=>{
  const {editorial:previous,...facts}=article
  const editorial=entries.get(canonicalUrl(article.url))
  return editorial?{...facts,editorial}:facts
 })
 return {...intelligence,sources:intelligence.sources.map(source=>({...source,count:annotated.filter(article=>article.sourceId===source.id).length})),articles:annotated}
}
