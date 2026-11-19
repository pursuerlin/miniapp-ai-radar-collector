import {parseAaModels,parseAaIndexVersion,isAaModelSlug} from './collect-benchmark.mjs'

// These official release pages remain useful after AA removes a deprecated
// release from its current leaderboard. Preserve that source scope; the app may
// rank verified scores from the same index edition in its combined view.
export const AA_DETAIL_RELEASES=['gpt-6-1-sol','gpt-6-astra']
export async function collectAaSupplements({data,slugs,load,toRow,previousRows=[],previousIndexVersion}){
 const present=new Set(data.rows.map(r=>r.sourceModelId)),additionalRows=[],evidence=[],errors=[]
 for(const slug of slugs){
  if(!isAaModelSlug(slug))throw Error('AA_SUPPLEMENT_SLUG_INVALID')
  const url=`https://artificialanalysis.ai/models/${slug}`
  // A release present in the main ranking is already covered by the normal collector.
  if(data.rows.some(r=>r.sourceUrl===url||r.detailSourceUrl===url))continue
  try{
   const page=await load(url)
   if(parseAaIndexVersion(page.html)!==data.indexVersion)throw Error('AA_SUPPLEMENT_VERSION_MISMATCH')
   const models=parseAaModels(page.html).filter(m=>m.release?.slug===slug)
   if(!models.length||new Set(models.map(m=>m.id)).size!==models.length)throw Error('AA_SUPPLEMENT_IDENTITY_MISSING')
   const ids=[],staged=[]
   for(const model of models){
    if(present.has(model.id))continue
    if(!model.deprecated||!model.headline||!isAaModelSlug(model.slug)||typeof model.creator?.name!=='string'||!model.creator.name)throw Error('AA_SUPPLEMENT_FIELDS_INVALID')
    const previous=previousRows.find(r=>r.sourceModelId===model.id&&r.name===model.name)
    const row=toRow({...model,rowId:previous?.id},{model,url:page.url,fetchedAt:page.fetchedAt})
    staged.push({...row,rankingScope:'detail',deprecated:true,observedAt:page.fetchedAt})
    ids.push(model.id)
   }
   additionalRows.push(...staged);ids.forEach(id=>present.add(id))
   evidence.push({url:page.url,sha256:page.sha256,indexVersion:data.indexVersion,modelIds:ids})
  }catch(error){
   errors.push({url,message:String(error.message).slice(0,160)})
   // Same-edition verified details can survive a transient request failure.
   // Keep their original observation time and an explicit retained state.
   if(previousIndexVersion===data.indexVersion){
    const retained=previousRows.filter(r=>r.rankingScope==='detail'&&r.deprecated===true&&r.detailStatus==='verified'&&r.detailSourceUrl===url&&
      r.observedAt&&Date.now()-Date.parse(r.observedAt)>=0&&Date.now()-Date.parse(r.observedAt)<7*86400000&&!present.has(r.sourceModelId))
    for(const row of retained){additionalRows.push({...row,retained:true});present.add(row.sourceModelId)}
   }
  }
 }
 return {additionalRows,supplementEvidence:evidence,supplementErrors:errors}
}
