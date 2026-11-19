import {parseAaModels,parseAaIndexVersion,parseBenchmark,isAaReleaseRanking} from './collect-benchmark.mjs'

export function assertBenchmarkMatchesArchive(snapshot,html){
 if(snapshot.performanceVersion!=='v3'){
  if(JSON.stringify(snapshot.rows)!==JSON.stringify(parseBenchmark(html)))throw Error('AA_ARCHIVE_ROWS_MISMATCH')
  return true
 }
 const listed=parseAaModels(html)
 if(listed.length!==snapshot.rows.length||listed.length<30)throw Error('AA_ARCHIVE_COVERAGE_MISMATCH')
 const modern=isAaReleaseRanking(listed)
 const key=modern?'sourceModelId':'id',sourceKey=modern?'id':'slug',byId=new Map(listed.map(m=>[m[sourceKey],m]))
 const ids=new Set()
 for(const row of snapshot.rows){
  const source=byId.get(row[key]);if(!source||ids.has(row[key]))throw Error('AA_ARCHIVE_IDENTITY_MISMATCH')
  ids.add(row[key])
  if(row.name!==source.name||row.score!==source.intelligenceIndex)throw Error('AA_ARCHIVE_SCORE_MISMATCH')
 }
 const anchors=snapshot.provenance?.versionAnchors
 if(anchors&&(new Set(anchors.map(a=>a.url)).size<2||anchors.some(a=>a.indexVersion!==snapshot.indexVersion)))throw Error('AA_ARCHIVE_VERSION_ANCHORS_INVALID')
 const version=parseAaIndexVersion(html)
 if(version){if(snapshot.indexVersion!==version)throw Error('AA_ARCHIVE_VERSION_MISMATCH')}
 else{
  const evidence=snapshot.provenance?.assets?.filter(a=>a.indexVersion)||[]
  if(!modern||snapshot.provenance.indexVersionStatus!=='verified-from-detail-pages'||!evidence.length||evidence.some(a=>a.indexVersion!==snapshot.indexVersion))throw Error('AA_ARCHIVE_VERSION_EVIDENCE_MISSING')
 }
 if(!snapshot.rows.every(r=>r.performanceVersion==='v3'&&!('endToEndLatency'in r)))throw Error('AA_ARCHIVE_TIMING_INVALID')
 return true
}
