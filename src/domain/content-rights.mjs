// Content policy travels with public JSON; an accessible feed is not a text license.
import {canonicalUrl} from './urls.mjs'
import {validEditorial} from './editorial.mjs'
import {AIHOT_PERMISSION,aihotUrl} from './aihot.mjs'
import {validNewsDigest} from './news-digests.mjs'
export function canPublishSummary(rights) {
  const written = rights?.licenseId==='LicenseRef-AIHOT-Written-Permission' && rights.permissionId===AIHOT_PERMISSION && rights.provider==='aihot' && aihotUrl(rights.evidenceUrl) && rights.licenseUrl==='https://aihot.news/terms'
  return !!rights && (written || ['CC0-1.0','CC-BY-4.0'].includes(rights.licenseId)) &&
    rights.scope==='text-summary' && !!canonicalUrl(rights.licenseUrl) &&
    !!canonicalUrl(rights.evidenceUrl) && typeof rights.checkedAt==='string' && Number.isFinite(Date.parse(rights.checkedAt))
}
export function validArticleRights(article) {
  const rights=article?.rights
  return (!article?.digest||(validNewsDigest(article.digest)&&[article.url,article.originalUrl].some(url=>canonicalUrl(url)===canonicalUrl(article.digest.sourceUrl)))) && (!article?.editorial||validEditorial(article.editorial)) && !!rights && ['metadata','licensed-summary'].includes(article.contentMode) &&
    typeof rights.attribution==='string' && rights.attribution.length>0 &&
    typeof rights.modified==='string' && article.translationStatus==='original' &&
    ['primary','discovery'].includes(article.evidenceRole) &&
    ['news','digest','preprint','changelog'].includes(article.contentType) &&
    (!article.originalUrl||!!canonicalUrl(article.originalUrl)) &&
    typeof rights.licenseId==='string' && !!canonicalUrl(rights.evidenceUrl) &&
    Number.isFinite(Date.parse(rights.checkedAt)) &&
    (article.contentMode==='metadata' ? article.summary==='' : canPublishSummary(rights))
}
export function readingLabel(article) {
  if(article?.provider==='aihot')return 'AIHOT 授权导读'
  return article?.contentMode==='metadata'?'来源索引 · 未转载正文':article?.contentType==='preprint'?'论文摘要 · 预印本':'来源摘要 · 小程序内阅读'
}
export function readingNotice(article,{host='原站',action='open'}={}) {
  if(article?.provider==='aihot')return '中文摘要由 AIHOT 提供；原报道、发布时间与完整信息以原文为准。'
  if(article?.contentMode==='metadata') return action==='copy'
    ? `本条只索引标题、时间与链接，不转载正文。复制链接后可在浏览器打开 ${host}；正文与许可由原站决定。`
    : `本条只索引标题、时间与链接，不转载正文。打开后离开模境，正文与许可由 ${host} 决定。`
  if(article?.contentType==='preprint') return `摘要保留来源语言；预印本不代表已经通过同行评审，完整正文与最新版本以 ${host} 为准。`
  return `摘要按 ${host} 的开放许可展示，保留来源语言；完整正文与最新版本以原站为准。`
}
