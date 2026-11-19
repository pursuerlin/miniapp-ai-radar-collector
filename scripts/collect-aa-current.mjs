import {httpResponseError} from './request-errors.mjs'
import {createHash} from 'node:crypto'
import {validReleaseDate} from '../src/domain/evaluation-date.mjs'
import {collectAaSupplements} from './collect-aa-supplements.mjs'
import {parseAaModels,parseAaCurrentModel,parseAaIndexVersion,isAaModelSlug,isAaReleaseRanking,source} from './collect-benchmark.mjs'

const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null
const context=value=>!number(value)?'—':value>=1e6?`${Number((value/1e6).toFixed(2))}M`:value>=1e3?`${Number((value/1e3).toFixed(1))}k`:String(value)
const modalities=(model,prefix)=>['Text','Image','Speech','Video'].filter(key=>model[`${prefix}Modality${key}`]===true).map(key=>key.toLowerCase())
const configurationKey=model=>model.configurationId||model.slug

function cacheWritePriceFields(listed,verified){
 const detailPrice=number(verified?.model?.cacheWritePrice)
 if(detailPrice!==null)return {cacheWritePrice:detailPrice,cacheWritePriceSource:'detail',cacheWritePriceSourceUrl:verified.url}
 // Only use the current ranking after its configuration UUID has been matched.
 // In particular, a missing detail field must not discard a published price.
 const rankingPrice=listed.configurationId?number(listed.cacheWritePrice):null
 return rankingPrice===null?{cacheWritePrice:null}:{cacheWritePrice:rankingPrice,cacheWritePriceSource:'ranking',cacheWritePriceSourceUrl:source}
}

// Release pages now share one URL across reasoning configurations. Keep existing
// client IDs where the source UUID (or an unambiguous exact name) still matches.
function releaseConfigurations(models,previousRows){
 const prior=model=>{
  const byId=previousRows.filter(row=>row.sourceModelId===model.id)
  if(byId.length===1)return byId[0].id
  const byName=previousRows.filter(row=>row.name===model.name)
  return byName.length===1?byName[0].id:undefined
 }
 return models.map(model=>({...model,slug:model.release.slug,configurationId:model.id,rowId:prior(model)}))
}

export function currentAaRow(listed,verified){
 const model=verified?.model
 if(model&&((listed.configurationId?model.release?.slug!==listed.release.slug||model.id!==listed.configurationId:model.slug!==listed.slug)||model.name!==listed.name))throw Error(`AA 配置身份不一致: ${listed.slug}`)
 const row={id:listed.rowId||model?.slug||(listed.configurationId?`aa-${listed.configurationId}`:listed.slug),name:listed.name,provider:model?.creator?.name||listed.modelCreatorName||'',
  score:number(model?.intelligenceIndex??listed.intelligenceIndex),context:context(model?.contextWindowTokens??listed.contextWindowTokens),
  openWeight:model?.isOpenWeights??listed.isOpenWeights,provisional:false,performanceVersion:'v3',
  releaseDate:validReleaseDate(model?.releaseDate)?model.releaseDate:null,
  detailStatus:model?'verified':'unavailable',sourceUrl:`https://artificialanalysis.ai/models/${model?.slug||listed.slug}`,
  cost:model?number(model.intelligenceIndexCostPerTask?.cost?.total):null,
  speed:number(model?.headline?.outputSpeed),firstTokenLatency:number(model?.headline?.timeToFirstToken),
  firstAnswerLatency:number(model?.headline?.timeToFirstAnswerToken),
  latency:number(model?.headline?.timeToFirstAnswerToken)}
 if(!model){
  if(!listed.configurationId)return row
  return {...row,sourceModelId:listed.configurationId,metricSource:'ranking',metricsSourceUrl:source,cost:number(listed.intelligenceIndexCostPerTask),
   speed:number(listed.outputSpeed),firstTokenLatency:number(listed.timeToFirstToken),firstAnswerLatency:number(listed.timeToFirstAnswerToken),latency:number(listed.timeToFirstAnswerToken),
   priceInput:number(listed.price1mInputTokens),priceOutput:number(listed.price1mOutputTokens),cacheReadPrice:number(listed.cacheHitPrice),...cacheWritePriceFields(listed),
   taskTimeSeconds:number(listed.intelligenceIndexTimePerTask),contextTokens:number(listed.contextWindowTokens)}
 }
 return {...row,sourceModelId:model.id,metricSource:'detail',metricsSourceUrl:verified.url,detailSourceUrl:verified.url,detailsCollectedAt:verified.fetchedAt,
  priceInput:number(model.price1mInputTokens),priceOutput:number(model.price1mOutputTokens),
  cacheReadPrice:number(model.cacheHitPrice),...cacheWritePriceFields(listed,verified),
  taskTimeSeconds:number(model.intelligenceIndexTimePerTask),contextTokens:number(model.contextWindowTokens),
  parametersBillions:number(model.parameters),activeParametersBillions:number(model.inferenceParametersActiveBillions),
  inputModalities:modalities(model,'input'),outputModalities:modalities(model,'output'),
  performanceDataSource:model.performanceDataSource,priceDataSource:model.priceDataSource,
  benchmarks:{frontierCode:number(model.frontierCode20),briefcase:number(model.briefcaseBreakdown?.overall?.elo),
   knowledgeAccuracy:number(model.omniscienceAccuracy),hallucinationRate:number(model.omniscienceHallucinationRate)}}
}

export function buildCurrentAaData(listed,verified,{collectedAt,indexVersion,assets=[],errors=[],strictLeaderDetails=true,previousRows=[],previousIndexVersion}={}){
 const rows=listed.map(model=>currentAaRow(model,verified.get(configurationKey(model))))
 if(rows.length<30||new Set(rows.map(row=>row.id)).size!==rows.length||rows.filter(row=>row.score!==null).length<30)throw Error('AA 当前数据覆盖校验失败')
 if(previousRows.length>=30&&rows.length<previousRows.length*.65)throw Error('AA 当前数据覆盖校验失败：记录数量异常下降')
 const previouslyRanked=previousRows.filter(r=>r.score!==null).length
 if(previousIndexVersion===indexVersion&&previouslyRanked>=30&&rows.filter(r=>r.score!==null).length<previouslyRanked*.7)throw Error('AA 当前数据覆盖校验失败：同版评分覆盖异常下降')
 const leaders=[...listed].filter(model=>number(model.intelligenceIndex)!==null).sort((a,b)=>b.intelligenceIndex-a.intelligenceIndex).slice(0,3)
 if(strictLeaderDetails&&leaders.some(model=>!verified.has(configurationKey(model))))throw Error('AA 前三配置的当前详情未核实，保留原快照')
 return {schemaVersion:1,collectedAt,source,name:'Artificial Analysis Intelligence Index',indexVersion,
  performanceVersion:'v3',coverage:{listed:rows.length,ranked:rows.filter(row=>row.score!==null).length,details:rows.filter(row=>row.detailStatus==='verified').length},
  costDefinition:'AA 智力指数按评测权重计算的每任务成本（USD），不是普通聊天单次费用。',
  provenance:{url:source,assets,errors,scoreField:'intelligenceIndex',costField:'intelligenceIndexCostPerTask.cost.total',
   speedField:'headline.outputSpeed',firstTokenField:'headline.timeToFirstToken',firstAnswerField:'headline.timeToFirstAnswerToken',
   speedDefinition:'包含推理 tokens 和首字等待的端到端输出速度（tok/s）',timingUnit:'seconds',
   methodologyUrl:'https://artificialanalysis.ai/methodology/intelligence-benchmarking'},rows}
}

export async function collectCurrentAa({fetchPage,concurrency=6,maxAttempts=3,retryDelayMs=1000,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),previousRows=[],previousIndexVersion,minVersionAnchors=2,onProgress=()=>{},supplementSlugs=[],previousAdditionalRows=[]}={}){
 const assets=[],errors=[],verified=new Map(),versionAnchors=[],requests={attempts:0,retries:0}
 const load=async(url,validate=()=>{})=>{
  for(let attempt=1;attempt<=maxAttempts;attempt++)try{
   requests.attempts++;if(attempt>1)requests.retries++
   const html=fetchPage?await fetchPage(url):await(async()=>{const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; ModelRadar/1.0)'},signal:AbortSignal.timeout(35000)});if(!response.ok)throw httpResponseError(response);return response.text()})()
   const asset={url,fetchedAt:new Date().toISOString(),sha256:createHash('sha256').update(html).digest('hex'),attempt}
   assets.push(asset);const page={html,...asset};validate(page)
   const version=parseAaIndexVersion(html);if(version)asset.indexVersion=version
   return page
  }catch(error){
   error.attempts=attempt
   if(attempt===maxAttempts||/配置身份不一致|指数版本不一致|配置得分不一致|HTTP (?:403|404|429)/.test(error.message))throw error
   await wait(retryDelayMs*attempt)
  }
 }
 let listed,indexVersion,releaseSchema
 const ranking=await load(source,page=>{
  const models=parseAaModels(page.html)
  releaseSchema=isAaReleaseRanking(models)
  indexVersion=parseAaIndexVersion(page.html)
  if(models.length<30)throw Error('AA 榜单身份或版本无法确认：模型列表缺失或不完整')
  if(!releaseSchema&&(!indexVersion||models.some(model=>!isAaModelSlug(model.slug))))throw Error('AA 榜单身份或版本无法确认：配置地址或指数版本缺失')
  if(releaseSchema&&new Set(models.map(model=>model.id)).size!==models.length)throw Error('AA 榜单身份或版本无法确认：配置 ID 重复')
  listed=releaseSchema?releaseConfigurations(models,previousRows):models
 })
 const expectedById=new Map(listed.map(model=>[model.configurationId,model]))
 const accept=page=>{
  const detailVersion=parseAaIndexVersion(page.html)
  if(!detailVersion||indexVersion&&detailVersion!==indexVersion)throw Error('AA 详情与榜单的指数版本不一致')
  if(releaseSchema){
   const models=parseAaModels(page.html)
   const accepted=[]
   for(const model of models){
    const expected=expectedById.get(model.id)
    if(!expected)continue
    if(model.release?.slug!==expected.release.slug||model.name!==expected.name||!isAaModelSlug(model.slug))throw Error(`AA 配置身份不一致: ${model.id}`)
    // The ranking omits its version label; confirm it on current detail pages and
    // join only the same UUID and score, never a release's default configuration.
    if(number(model.intelligenceIndex)!==number(expected.intelligenceIndex))throw Error(`AA 配置得分不一致: ${model.id}`)
    if(model.headline)accepted.push([model.id,{model,url:page.url,fetchedAt:page.fetchedAt}])
   }
   if(!models.length)throw Error('AA 详情模型列表缺失或不完整')
   if(accepted.length){indexVersion=detailVersion;page.verifiedConfigurations=accepted.length}
   for(const [id,entry] of accepted)verified.set(id,entry)
   return
  }
  const current=parseAaCurrentModel(page.html)
  if(current){
   const slug=new URL(page.url).pathname.split('/').pop()
   const expected=listed.find(model=>model.slug===slug)
   if(current.slug!==slug||expected&&current.name!==expected.name)throw Error(`AA 配置身份不一致: ${slug}`)
   if(current.headline&&typeof current.id==='string')verified.set(current.slug,{model:current,url:page.url,fetchedAt:page.fetchedAt})
  }
  for(const model of parseAaModels(page.html))if(model?.headline&&typeof model.id==='string'&&!verified.has(model.slug))verified.set(model.slug,{model,url:page.url,fetchedAt:page.fetchedAt})
 }
 const first=[...listed].filter(model=>number(model.intelligenceIndex)!==null).sort((a,b)=>b.intelligenceIndex-a.intelligenceIndex)[0]
 if(!first)throw Error('AA 当前数据覆盖校验失败')
 const pages=new Map()
 const details=url=>{
  if(!pages.has(url))pages.set(url,load(url,accept))
  return pages.get(url)
 }
 if(releaseSchema){
  const anchors=[...new Set([...listed].filter(m=>number(m.intelligenceIndex)!==null).sort((a,b)=>b.intelligenceIndex-a.intelligenceIndex).map(m=>m.slug))].slice(0,4)
  let confirmed=0
  for(const slug of anchors){
   const url=`https://artificialanalysis.ai/models/${slug}`
   try{const page=await details(url);if(page.verifiedConfigurations){confirmed++;versionAnchors.push({url:page.url,sha256:page.sha256,indexVersion:parseAaIndexVersion(page.html)})}}
   catch(error){if(/配置身份不一致|指数版本不一致|配置得分不一致/.test(error.message))throw error;errors.push({url,message:String(error.message).slice(0,160)})}
   if(confirmed>=minVersionAnchors)break
  }
  if(confirmed<minVersionAnchors)throw Error('AA_VERSION_UNVERIFIED')
 }else await details(`https://artificialanalysis.ai/models/${first.slug}`)
 let cursor=0,done=0
 await Promise.all(Array.from({length:concurrency},async()=>{
  while(cursor<listed.length){
   const model=listed[cursor++]
   if(!verified.has(configurationKey(model))){
    const url=`https://artificialanalysis.ai/models/${model.slug}`
    try{await details(url);if(!verified.has(configurationKey(model)))throw Error('页面没有当前配置的详情字段')}
    catch(error){errors.push({url,message:String(error.message).slice(0,160)})}
   }
   done++;if(done%25===0||done===listed.length)onProgress({done,total:listed.length,verified:verified.size})
  }
 }))
 const data=buildCurrentAaData(listed,verified,{collectedAt:new Date().toISOString(),indexVersion,assets,errors,strictLeaderDetails:!releaseSchema,previousRows,previousIndexVersion})
 data.provenance.requests=requests
 if(releaseSchema)data.provenance.versionAnchors=versionAnchors
 data.provenance.rankingFields={cost:'intelligenceIndexCostPerTask',speed:'outputSpeed',firstToken:'timeToFirstToken',firstAnswer:'timeToFirstAnswerToken'}
 if(releaseSchema)data.provenance.indexVersionStatus=parseAaIndexVersion(ranking.html)?'published':'verified-from-detail-pages'
 if(supplementSlugs.length){const extra=await collectAaSupplements({data,slugs:supplementSlugs,load,toRow:currentAaRow,previousRows:[...previousRows,...previousAdditionalRows],previousIndexVersion});data.additionalRows=extra.additionalRows;data.provenance.supplementEvidence=extra.supplementEvidence;data.provenance.supplementErrors=extra.supplementErrors}
 return {data,rankingHtml:ranking.html}
}
