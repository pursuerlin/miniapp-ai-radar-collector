const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=Date.now()+300000
const str=(v,n=500)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
const number=v=>typeof v==='number'&&Number.isFinite(v)
// WeChat's native JS runtime does not guarantee the browser URL constructor.
const url=v=>typeof v==='string'&&/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s<>\\]*)?$/i.test(v)
export const EVIDENCE_CATEGORIES=['综合','编程','科研','专业办公','知识问答']
export function validModelEvidence(data){
 if(data?.schemaVersion!==1||!date(data.checkedAt)||!date(data.collectedAt)||Date.parse(data.collectedAt)>Date.parse(data.checkedAt)||!['ok','partial','stale'].includes(data.status)||!Array.isArray(data.errors)||!data.errors.every(e=>str(e.key)&&/^EVIDENCE_[A-Z0-9_]+$/.test(e.code))||!data.provenance||!/^[a-f0-9]{64}$/.test(data.provenance.indexHash)||data.provenance.acquiredVia!=='aihot'||!date(data.provenance.sourceUpdatedAt)||!Array.isArray(data.models)||!data.models.length||data.models.length>500||new Set(data.models.map(r=>r.id)).size!==data.models.length||!/^([a-f0-9]{64})$/.test(data.methodHash)||data.rulesUrl!=='https://aihot.news/leaderboard/rules'||data.sourceUrl!=='https://aihot.news/leaderboard')return false
 return data.models.every(r=>str(r.id)&&/^[a-z0-9-]+$/.test(r.id)&&str(r.name)&&str(r.provider)&&number(r.score)&&r.score>=0&&r.score<=200&&(r.rank===null||Number.isInteger(r.rank)&&r.rank>0)&&url(r.url)&&r.url==='https://aihot.news/leaderboard/'+r.id&&r.sourceUpdatedAt===data.provenance.sourceUpdatedAt&&date(r.sourceUpdatedAt)&&Date.parse(r.sourceUpdatedAt)<=Date.parse(data.checkedAt)+300000&&date(r.observedAt)&&Date.parse(r.observedAt)<=Date.parse(data.checkedAt)&&['ok','missing','stale','withdrawn'].includes(r.detailStatus)&&str(r.rankingNote||'none',2000)&&(!r.categoryRanks||Object.entries(r.categoryRanks).every(([k,v])=>EVIDENCE_CATEGORIES.includes(k)&&(v===null||Number.isInteger(v)&&v>0)))&&r.categories&&Object.entries(r.categories).every(([k,v])=>EVIDENCE_CATEGORIES.includes(k)&&number(v)&&v>=0&&v<=200)&&(r.detailStatus!=='ok'||r.categories['综合']===r.score)&&Array.isArray(r.evaluations)&&(r.detailStatus!=='ok'||r.evaluations.length>0)&&new Set(r.evaluations.map(e=>e.category+'|'+e.evaluator+'|'+e.name+'|'+e.url)).size===r.evaluations.length&&r.evaluations.length<=300&&r.evaluations.every(e=>str(e.name)&&str(e.evaluator)&&str(e.description,3000)&&str(e.raw,120)&&str(e.normalized,120)&&str(e.rank,120)&&str(e.verifiedOn,80)&&(/^\d{4}-\d{2}-\d{2}$/.test(e.verifiedOn))&&date(e.verifiedOn+'T00:00:00+08:00')&&e.acquiredVia==='aihot'&&str(e.notes||'none',6000)&&EVIDENCE_CATEGORIES.includes(e.category)&&url(e.url))&&Array.isArray(r.prices)&&r.prices.every(p=>str(p,4000)))
}
export function evidenceIdentity(name){return String(name||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')}
export function sameEvidenceModel(a,b){return evidenceIdentity(a.name)===evidenceIdentity(b.name)&&evidenceIdentity(a.provider)===evidenceIdentity(b.provider)}
export function evidenceRows(data,category='综合',query='',allowed=(_row)=>true){
 if(!validModelEvidence(data))return []
 const q=query.trim().toLowerCase()
 return data.models.filter(r=>r.detailStatus!=='withdrawn'&&(category==='综合'||r.detailStatus==='ok')&&number(category==='综合'?r.score:r.categories[category])).map(r=>({...r,value:category==='综合'?r.score:r.categories[category]})).sort((a,b)=>(category==='综合'?Number(a.rank===null)-Number(b.rank===null):0)||b.value-a.value||(a.rank??999)-(b.rank??999)||a.id.localeCompare(b.id)).map(r=>({...r,place:category==='综合'?r.rank:r.categoryRanks?.[category]??null})).filter(r=>(!q||(r.name+' '+r.provider).toLowerCase().includes(q))&&allowed(r))
}
// A repeated successful response is not a rollback. Keep the newest check time,
// while reporting unchanged content separately from a genuinely older snapshot.
export function evidenceDelivery(current,incoming){
 if(!validModelEvidence(incoming))return {data:current,outcome:'invalid'}
 if(!validModelEvidence(current))return {data:incoming,outcome:'updated'}
 const same=JSON.stringify(current.models)===JSON.stringify(incoming.models)&&current.provenance.indexHash===incoming.provenance.indexHash&&current.methodHash===incoming.methodHash&&current.status===incoming.status&&JSON.stringify(current.errors)===JSON.stringify(incoming.errors)
 const merged=mergeEvidence(current,incoming)
 return {data:merged,outcome:same?'unchanged':merged===current?'older':'updated'}
}
export function mergeEvidence(current,incoming){
 if(!validModelEvidence(incoming))return current
 if(!validModelEvidence(current))return incoming
 if(Math.min(...incoming.models.map(r=>Date.parse(r.sourceUpdatedAt)))<Math.max(...current.models.map(r=>Date.parse(r.sourceUpdatedAt)))||Date.parse(incoming.collectedAt)<Date.parse(current.collectedAt)||Date.parse(incoming.checkedAt)<=Date.parse(current.checkedAt))return current
 return incoming
}
export function evidenceComparisons(rows){
 const pairs=new Map()
 for(const row of rows)for(const e of row.evaluations){const key=e.category+'\u0000'+e.evaluator+'\u0000'+e.name+'\u0000'+e.url;const v=pairs.get(key)||{key,name:e.name,evaluator:e.evaluator,values:[]};v.values.push({model:row.name,...e});pairs.set(key,v)}
 return [...pairs.values()].filter(p=>p.values.length>1)
}
