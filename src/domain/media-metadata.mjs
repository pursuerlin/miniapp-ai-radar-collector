import {isDocumentSource,officialSourceSpec,officialSourceLabel} from './media-official-sources.mjs'
export const METADATA_MAX_AGE_MS=7*86400000
export const metadataMaxAge=source=>source==='huggingface'?METADATA_MAX_AGE_MS:86400000
export const metadataRecords=data=>[...(data?.records||[]),...(data?.officialRecords||[]),...(data?.documentRecords||[])]
export const METADATA_FIELDS={license:'权重许可证',parameterCount:'仓库参数量',pipeline:'模型卡任务',baseModels:'基础模型',access:'权重访问限制',weightFiles:'仓库列出权重文件',downloads:'近30天下载（Hub）',likes:'点赞数（Hub）',channelStatus:'渠道状态',channelLicense:'渠道许可分类',dimensions:'尺寸/画幅选项',aspectRatio:'宽高比',duration:'时长参数',fps:'帧率参数',audioControl:'音频开关',imageInput:'参考图参数',seedControl:'Seed 参数',imageCount:'输出数量参数',quality:'质量档位',outputFormat:'已核实输出格式',referenceImages:'参考图数量',reasoning:'思考档位',complexity:'画面复杂度',constraints:'适用限制',nativeAudio:'原生音频',billingBasis:'计费口径',inputPrice:'输入价格',textInputPrice:'文字输入',imageInputPrice:'图片输入',textOutputPrice:'文字输出',imageOutputPrice:'图片输出',videoOutputPrice:'视频输出',referencePrice:'参考单价'}
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)
const text=(v,max=200)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v)
const time=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=Date.now()+300000
export function metadataSourceUrl(source,id,revision){return isDocumentSource(source)?officialSourceSpec(source,id)?.url:source==='bfl'?`https://api.bfl.ai/openapi.json#/paths/~1v1~1${id}/post`:source==='huggingface'?`https://huggingface.co/${id}/tree/${revision}`:`https://fal.ai/models/${id}`}
export function validMetadataSourceId(source,id){if(typeof id!=='string'||id.length>240||id.split('/').some(p=>p==='.'||p==='..'))return false;return isDocumentSource(source)?!!officialSourceSpec(source,id):source==='bfl'?/^flux-[a-z0-9.-]+$/.test(id):source==='huggingface'?/^[\w.-]+\/[\w.-]+$/.test(id):source==='fal'&&/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*){1,8}$/.test(id)}
const valueValid=(key,v)=>['parameterCount','downloads','likes'].includes(key)?Number.isSafeInteger(v)&&v>=0:['weightFiles','audioControl','imageInput','seedControl','nativeAudio'].includes(key)?typeof v==='boolean':Array.isArray(v)?v.length>0&&v.length<=32&&v.every(x=>text(x,120)):text(v,500)
export function validMediaMetadata(data){
 if(!object(data)||data.schemaVersion!==1||!/^([a-f0-9]{64})$/.test(data.registryHash||'')||!Number.isInteger(data.registryRevision)||data.registryRevision<1||!time(data.checkedAt)||!Array.isArray(data.records)||data.records.length>500||!Array.isArray(data.errors)||data.errors.length>500)return false
 if(data.preview!==undefined&&typeof data.preview!=='boolean')return false
 if(data.officialRecords!==undefined&&(!Array.isArray(data.officialRecords)||data.officialRecords.some(r=>r?.source!=='bfl')))return false
 if(data.documentRecords!==undefined&&(!Array.isArray(data.documentRecords)||data.documentRecords.some(r=>!isDocumentSource(r?.source))))return false
 if(data.records.some(r=>r?.source==='bfl'||isDocumentSource(r?.source))||metadataRecords(data).length>500)return false
 const keys=new Set()
 return metadataRecords(data).every(r=>{
  if(!object(r)||!text(r.key)||keys.has(r.key)||!validMetadataSourceId(r.source,r.sourceId)||r.url!==metadataSourceUrl(r.source,r.sourceId,r.revision)||!['model','endpoint'].includes(r.scope)||(['fal','bfl'].includes(r.source)||isDocumentSource(r.source))&&r.scope!=='endpoint'||r.source==='huggingface'&&r.scope!=='model'||!['ok','stale','withdrawn'].includes(r.status)||!time(r.observedAt)||!time(r.checkedAt)||Date.parse(r.observedAt)>Date.parse(r.checkedAt)||Date.parse(r.checkedAt)>Date.parse(data.checkedAt)||(r.lastVerifiedAt!==undefined&&(!time(r.lastVerifiedAt)||Date.parse(r.lastVerifiedAt)>Date.parse(r.checkedAt)))||!time(r.reviewedAt)||!text(r.revision,160)||r.source==='huggingface'&&!/^[a-f0-9]{40,64}$/.test(r.revision)||r.sourceName!==undefined&&!text(r.sourceName)||r.sourceUpdatedAt!==null&&(!time(r.sourceUpdatedAt)||Date.parse(r.sourceUpdatedAt)>Date.parse(r.observedAt))||r.sourceCreatedAt!==null&&(!time(r.sourceCreatedAt)||Date.parse(r.sourceCreatedAt)>Date.parse(r.observedAt))||r.sourceCreatedAt&&r.sourceUpdatedAt&&Date.parse(r.sourceCreatedAt)>Date.parse(r.sourceUpdatedAt)||!Array.isArray(r.targets)||!r.targets.length||r.targets.length>20||!r.targets.every(t=>text(t.id)&&text(t.name)&&text(t.provider)&&Array.isArray(t.boards)&&t.boards.length>0&&t.boards.every(b=>['text-to-image','image-editing','text-to-video','image-to-video','text-to-video-audio','image-to-video-audio'].includes(b)))||!object(r.fields)||Object.keys(r.fields).length>Object.keys(METADATA_FIELDS).length||!Object.entries(r.fields).every(([key,value])=>Object.hasOwn(METADATA_FIELDS,key)&&valueValid(key,value)))return false
  if(r.sourceNote!==undefined&&(!isDocumentSource(r.source)||!text(r.sourceNote,500)))return false
  if(r.fieldEvidence!==undefined&&(!isDocumentSource(r.source)||!object(r.fieldEvidence)||Object.keys(r.fields).some(k=>!text(r.fieldEvidence[k],1400))||Object.keys(r.fieldEvidence).some(k=>!Object.hasOwn(r.fields,k))))return false
  if(r.contentHash!==undefined&&!/^[a-f0-9]{64}$/.test(r.contentHash))return false
  if(r.parameterMode!==undefined&&(r.source!=='bfl'||!['t2v','i2v'].includes(r.parameterMode)))return false
  if(r.fieldObservedAt!==undefined&&(!object(r.fieldObservedAt)||Object.entries(r.fieldObservedAt).some(([k,v])=>!Object.hasOwn(r.fields,k)||!time(v)||Date.parse(v)>Date.parse(r.observedAt))))return false
  keys.add(r.key);return true
 })&&data.errors.every(e=>text(e.key)&&/^METADATA_[A-Z0-9_]+$/.test(e.code)&&(e.source===undefined||(['fal','bfl','huggingface'].includes(e.source)||isDocumentSource(e.source)))&&(e.documentSource===undefined||isDocumentSource(e.documentSource))&&(e.retryAfterAt===undefined||typeof e.retryAfterAt==='string'&&Number.isFinite(Date.parse(e.retryAfterAt))))
}
export function mergeMediaMetadata(current,incoming){
 if(!validMediaMetadata(incoming))return validMediaMetadata(current)?current:null
 if(!validMediaMetadata(current))return incoming
 if(incoming.registryRevision!==current.registryRevision)return incoming.registryRevision>current.registryRevision?incoming:current
 if(current.registryHash!==incoming.registryHash)return current
 if(Date.parse(incoming.checkedAt)<Date.parse(current.checkedAt)||incoming.preview&&!current.preview||Date.parse(incoming.checkedAt)===Date.parse(current.checkedAt)&&!(current.preview&&!incoming.preview))return current
 const records=metadataRecords(incoming).map(record=>{
  const old=metadataRecords(current).find(r=>r.key===record.key)
  if(old&&Date.parse(old.observedAt)>Date.parse(record.observedAt)&&record.status!=='withdrawn')return {...old,checkedAt:incoming.checkedAt,status:old.status==='withdrawn'?'withdrawn':'stale'}
  return record
 })
 for(const record of metadataRecords(current))if(!records.some(r=>r.key===record.key)&&incoming.errors.some(e=>e.key===record.key&&(isDocumentSource(record.source)||!/HTTP_40[14]|HTTP_410/.test(e.code))))records.push({...record,checkedAt:incoming.checkedAt,status:record.status==='withdrawn'?'withdrawn':'stale'})
 return {...incoming,records:records.filter(r=>r.source!=='bfl'&&!isDocumentSource(r.source)),documentRecords:records.filter(r=>isDocumentSource(r.source)),...(records.some(r=>r.source==='bfl')?{officialRecords:records.filter(r=>r.source==='bfl')}:{})}
}
export function metadataForModel(data,row,boardId,now=Date.now()){
 if(!validMediaMetadata(data))return []
 const records=metadataRecords(data).filter(r=>r.status!=='withdrawn'&&r.targets.some(t=>t.id===row.id&&t.name===row.name&&t.provider===row.provider&&t.boards.includes(boardId)))
 const groups=new Map()
 for(const record of records){
  const context=record.scope==='model'?'model':record.source+':'+(record.source==='openai'?record.sourceId.replace(/-generate$/,''):record.sourceId)+(record.parameterMode?':'+record.parameterMode:'')
  if(!groups.has(context))groups.set(context,{id:context,label:context==='model'?'模型信息':`${isDocumentSource(record.source)?officialSourceLabel(record.source)+' 官方文档':record.source==='bfl'?'BFL 官方 API':'fal 渠道'} · ${record.sourceId}`,records:[],fields:[]})
  groups.get(context).records.push({...record,expired:now-Date.parse(record.status==='ok'?record.checkedAt:record.lastVerifiedAt||record.observedAt)>metadataMaxAge(record.source)})
 }
 for(const group of groups.values())for(const key of Object.keys(METADATA_FIELDS)){
  const observations=group.records.filter(r=>Object.hasOwn(r.fields,key)).map(r=>({source:r.source,url:r.url,value:r.fields[key],observedAt:r.fieldObservedAt?.[key]||r.observedAt,checkedAt:r.checkedAt,sourceUpdatedAt:r.sourceUpdatedAt,status:r.status,expired:r.expired}))
  if(!observations.length)continue
  const signatures=new Set(observations.map(o=>JSON.stringify(Array.isArray(o.value)?[...o.value].sort():o.value)))
  group.fields.push({key,label:METADATA_FIELDS[key],status:signatures.size>1?'conflict':observations.some(o=>o.status==='ok'&&!o.expired)?'verified':observations.every(o=>o.expired)?'expired':'stale',value:signatures.size===1?observations[0].value:null,observations})
 }
 const priority=group=>group.id.startsWith('bfl:')||isDocumentSource(group.records[0].source)?0:group.id==='model'?1:2
 return [...groups.values()].sort((a,b)=>priority(a)-priority(b))
}
export function mediaMetadataCoverage(data,rows,boardId,now=Date.now()){
 const top=[...rows].sort((a,b)=>b.elo-a.elo||a.id.localeCompare(b.id)).slice(0,20)
 const verified=top.filter(row=>metadataForModel(data,row,boardId,now).some(g=>g.id!=='model'&&g.fields.some(f=>['dimensions','aspectRatio','duration','fps','audioControl','imageInput','seedControl','imageCount','quality','outputFormat','referenceImages','reasoning','complexity','nativeAudio'].includes(f.key)&&f.status==='verified'))).length
 return {sample:top.length,verified,missing:top.length-verified}
}
export function formatMetadataValue(key,value){
 if(key==='license'&&value==='other')return '其他许可证（见原文）'
 if(typeof value==='boolean')return value?'有':'无（来源明确标记）'
 if(Array.isArray(value)){const labels={square_hd:'方形 HD',square:'方形',portrait_4_3:'竖向标准图',portrait_16_9:'竖向长图',landscape_4_3:'横向标准图',landscape_16_9:'横向宽图'};return value.map(v=>labels[v]||v).join(' / ')}
 if(key==='parameterCount')return value>=1e9?'约 '+(value/1e9).toFixed(2)+' B':value.toLocaleString('en-US')
 if(typeof value==='number')return value.toLocaleString('en-US')
 return value
}
