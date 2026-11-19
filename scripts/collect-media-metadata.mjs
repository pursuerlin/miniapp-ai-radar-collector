import {isDocumentSource,officialSourceSpec} from '../src/domain/media-official-sources.mjs'
import {normalizeOfficialDocument} from './media-official-documents.mjs'
import {createHash} from 'node:crypto'
import {readFile,writeFile,rename} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {validMediaMetadata,validMetadataSourceId,metadataSourceUrl,metadataRecords} from '../src/domain/media-metadata.mjs'
const fail=code=>Object.assign(Error(code),{code})
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)
const safe=v=>typeof v==='string'&&v.length>0&&v.length<=500&&!/[\u0000-\u001f]/.test(v)
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=Date.now()+300000?new Date(v).toISOString():null
const observationHash=record=>createHash('sha256').update(JSON.stringify(Object.fromEntries(['sourceName','revision','sourceCreatedAt','sourceUpdatedAt','fields','sourceNote','fieldEvidence'].map(k=>[k,record[k]])))).digest('hex')
async function responseText(response){
 const reader=response.body?.getReader()
 if(!reader){const text=await response.text();if(Buffer.byteLength(text)>2000000)throw fail('METADATA_PAYLOAD_TOO_LARGE');return text}
 const chunks=[];let size=0
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000){await reader.cancel();throw fail('METADATA_PAYLOAD_TOO_LARGE')}chunks.push(value)}
 return Buffer.concat(chunks).toString('utf8')
}
export function normalizeHuggingFace(body,id){
 if(body?.id!==id||body.private===true||!safe(body.sha))throw fail('METADATA_IDENTITY_INVALID')
 if(body.lastModified!==undefined&&!date(body.lastModified)||body.createdAt!==undefined&&!date(body.createdAt))throw fail('METADATA_SOURCE_TIME_INVALID')
 const fields={},card=body.cardData||{}
 if(safe(card.license))fields.license=/^[a-z0-9.+-]+$/i.test(card.license)?card.license.toLowerCase():card.license
 if(Number.isSafeInteger(body.safetensors?.total)&&body.safetensors.total>0)fields.parameterCount=body.safetensors.total
 if(safe(body.pipeline_tag))fields.pipeline=body.pipeline_tag
 const bases=Array.isArray(card.base_model)?card.base_model:typeof card.base_model==='string'?[card.base_model]:[]
 if(bases.length&&bases.length<=32&&bases.every(safe))fields.baseModels=bases
 if(body.gated===false)fields.access='来源未标记需申请访问'
 else if(['auto','manual',true].includes(body.gated))fields.access='需申请访问；不代表取得商用许可'
 if(Array.isArray(body.siblings)&&body.siblings.some(f=>/\.(safetensors|bin)$/.test(f.rfilename||'')))fields.weightFiles=true
 for(const key of ['downloads','likes'])if(Number.isSafeInteger(body[key])&&body[key]>=0)fields[key]=body[key]
 return {sourceName:id,revision:body.sha,sourceCreatedAt:date(body.createdAt),sourceUpdatedAt:date(body.lastModified),fields}
}
// Resolve only local schema references. Never fetch references or inference URLs.
function property(schema,root,depth=0){
 if(depth>8||!plain(schema))return {}
 if(schema.$ref){const path=/^#\/components\/schemas\/([A-Za-z0-9_]+)$/.exec(schema.$ref);return path?property(root.components?.schemas?.[path[1]],root,depth+1):{}}
 if(schema.anyOf||schema.oneOf){const branches=(schema.anyOf||schema.oneOf).map(s=>property(s,root,depth+1)).filter(s=>s.type!=='null');if(branches.length===1)return branches[0];if(branches.every(s=>Array.isArray(s.enum)||s.const!==undefined||s.type==='object'&&s.properties?.width&&s.properties?.height||['integer','number'].includes(s.type)&&Number.isFinite(s.minimum)&&Number.isFinite(s.maximum)))return {enum:[...new Set(branches.flatMap(s=>s.enum||(s.const!==undefined?[s.const]:s.type==='object'?['自定义尺寸（约束见原文）']:[`${s.minimum} – ${s.maximum}`])))]};return {}}
 if(schema.allOf){const out={};for(const p of schema.allOf)Object.assign(out,property(p,root,depth+1));return out}
 return schema
}
function parameterText(schema){
 if(Array.isArray(schema.enum)){const values=schema.enum.filter(v=>typeof v==='number'||safe(v)).map(String);if(values.length&&values.length<=32)return values}
 if(typeof schema.minimum==='number'||typeof schema.maximum==='number')return `${schema.minimum??'未声明下限'} – ${schema.maximum??'未声明上限'}${schema.default!==undefined?'；默认 '+String(schema.default):''}`
 return null
}
export function normalizeFal(body,id){
 const models=body?.models
 if(!Array.isArray(models)||models.length!==1||models[0].endpoint_id!==id)throw fail('METADATA_IDENTITY_INVALID')
 const model=models[0],meta=model.metadata,root=model.openapi
 if(!plain(meta)||!safe(meta.display_name)||!['active','deprecated'].includes(meta.status))throw fail('METADATA_SCHEMA_INVALID')
 if(meta.updated_at!==undefined&&!date(meta.updated_at)||meta.date!==undefined&&!date(meta.date))throw fail('METADATA_SOURCE_TIME_INVALID')
 const fields={channelStatus:meta.status==='active'?'在服务商目录中启用':'服务商已标记废弃'}
 if(safe(meta.license_type))fields.channelLicense=meta.license_type+'（渠道分类，非权重许可证）'
 if(plain(root)&&!root.error){
  const declared=root.info?.['x-fal-metadata']?.endpointId
  if(declared!==undefined&&declared!==id)throw fail('METADATA_ENDPOINT_MISMATCH')
  const operation=root.paths?.['/'+id]?.post||(declared===id?root.paths?.['/']?.post:null)
  if(!operation)throw fail('METADATA_ENDPOINT_MISMATCH')
  const input=property(operation?.requestBody?.content?.['application/json']?.schema,root)
  const properties=input.properties||{}
  for(const [name,key]of [['image_size','dimensions'],['resolution','dimensions'],['aspect_ratio','aspectRatio'],['duration','duration'],['fps','fps'],['num_images','imageCount']]){
   const schema=property(properties[name],root),text=parameterText(schema)
   if(text)fields[key]=fields[key]?[...new Set([fields[key],text].flat())]:text
  }
  if(property(properties.generate_audio,root).type==='boolean')fields.audioControl=true
  if(['image_url','image_urls','reference_image_urls','start_image_url','first_frame_url'].some(k=>plain(properties[k])))fields.imageInput=true
  if(property(properties.seed,root).type==='integer')fields.seedControl=true
 }
 return {sourceName:meta.display_name,revision:date(meta.updated_at)||'unversioned',sourceCreatedAt:date(meta.date),sourceUpdatedAt:date(meta.updated_at),fields}
}
export function normalizeBfl(root,id,expectedName,mode){
 const operation=root?.paths?.['/v1/'+id]?.post
 if(!root?.openapi?.startsWith('3.')||operation?.summary!==expectedName)throw fail('METADATA_IDENTITY_INVALID')
 let schema=operation.requestBody?.content?.['application/json']?.schema
 if(mode&&schema?.$ref){const match=/^#\/components\/schemas\/([A-Za-z0-9_]+)$/.exec(schema.$ref);schema=match?root.components?.schemas?.[match[1]]:null}
 if(mode){const ref=schema?.discriminator?.propertyName==='mode'&&schema.discriminator.mapping?.[mode];if(!ref)throw fail('METADATA_VERSION_UNVERIFIED');schema={$ref:ref}}
 const input=property(schema,root),properties=input.properties
 if(!plain(properties)||!properties.prompt)throw fail('METADATA_SCHEMA_INVALID')
 const fields={}
 for(const [name,key]of [['resolution','dimensions'],['aspect_ratio','aspectRatio'],['duration','duration'],['fps','fps']]){const value=parameterText(property(properties[name],root));if(value)fields[key]=value}
 if(!fields.dimensions){const ranges=['width','height'].map(k=>parameterText({...property(properties[k],root),default:undefined}));if(ranges.every(Boolean))fields.dimensions=`宽度参数：${ranges[0]}；高度参数：${ranges[1]}；组合限制见原文`}
 if(['images','input_image','image','start_frame'].some(k=>properties[k])||mode==='i2v'&&properties.keyframes)fields.imageInput=true
 if(property(properties.seed,root).type==='integer')fields.seedControl=true
 if(property(properties.generate_audio,root).type==='boolean')fields.audioControl=true
 if(!Object.keys(fields).length)throw fail('METADATA_SCHEMA_INVALID')
 // Hash only this endpoint contract: unrelated API changes do not re-date its facts.
 const revision=createHash('sha256').update(JSON.stringify({operation,input})).digest('hex')
 return {sourceName:expectedName,revision,sourceCreatedAt:null,sourceUpdatedAt:null,fields}
}
export function validMetadataRegistry(registry){
 const ids=new Set()
 return registry?.schemaVersion===1&&Number.isInteger(registry.revision)&&registry.revision>0&&Array.isArray(registry.models)&&registry.models.length<=200&&registry.models.every(m=>{
  if(!safe(m.id)||ids.has(m.id)||!date(m.reviewedAt)||!Array.isArray(m.targets)||!m.targets.length||!m.targets.every(t=>safe(t.id)&&safe(t.name)&&safe(t.provider)&&Array.isArray(t.boards)&&t.boards.length)||!Array.isArray(m.sources)||!m.sources.length||m.sources.length>5)return false
  ids.add(m.id);return m.sources.every(s=>validMetadataSourceId(s.source,s.id)&&['model','endpoint'].includes(s.scope)&&!((['fal','bfl'].includes(s.source)||isDocumentSource(s.source))&&s.scope!=='endpoint')&&!(s.source==='huggingface'&&s.scope!=='model')&&(s.source!=='huggingface'||/^[a-f0-9]{40,64}$/.test(s.revision||''))&&(!['fal','bfl'].includes(s.source)||safe(s.expectedName))&&(s.mode===undefined||s.source==='bfl'&&['t2v','i2v'].includes(s.mode)))
 })
}
export async function collectMediaMetadata({registry,media,previous,fetcher=fetch,now=()=>new Date().toISOString(),maxRequests=64,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),interval=fetcher===fetch?6500:0,cacheMaxAgeMs=fetcher===fetch?6*3600000:0,elapsedNow=()=>performance.now(),maxDurationMs=12*60000}={}){
 if(!validMetadataRegistry(registry))throw fail('METADATA_REGISTRY_INVALID')
 const prior=validMediaMetadata(previous)?previous:null,records=[],errors=[],throttled=new Set(),responses=new Map(),failures=new Map(),startedAt=elapsedNow();let requests=0,retries=0
 const remaining=()=>maxDurationMs-(elapsedNow()-startedAt)
 const registryHash=createHash('sha256').update(JSON.stringify(registry)).digest('hex')
 if(prior&&registry.revision===prior.registryRevision&&prior.registryHash!==registryHash)throw fail('METADATA_REGISTRY_CONFLICT')
 if(prior&&registry.revision<prior.registryRevision)throw fail('METADATA_REGISTRY_REGRESSED')
 if(prior&&Date.parse(now())<Date.parse(prior.checkedAt))return prior
 for(const mapping of registry.models){
  const targets=mapping.targets.filter(t=>t.boards.some(b=>media.boards.some(board=>board.id===b&&board.rows.some(r=>r.id===t.id&&r.name===t.name&&r.provider===t.provider))))
  if(!targets.length){errors.push({key:mapping.id,code:'METADATA_TARGET_UNVERIFIED'});continue}
  for(const source of mapping.sources){
   const key=mapping.id+':'+source.source+':'+source.id,checkedAt=now()
   const base={key,source:source.source,sourceId:source.id,url:metadataSourceUrl(source.source,source.id,source.revision),scope:source.scope,targets,reviewedAt:mapping.reviewedAt,...(source.mode?{parameterMode:source.mode}:{})}
   // A changed revision or mode is a different contract. Never relabel an old
   // value/URL as the replacement endpoint when a new request fails.
   const old=prior&&metadataRecords(prior).find(r=>r.key===key&&r.url===base.url&&r.scope===base.scope&&r.parameterMode===base.parameterMode&&(source.source!=='huggingface'||r.revision===source.revision))
   try{
    if(old&&Date.parse(old.checkedAt)>Date.parse(checkedAt)){records.push(old);continue}
    if(cacheMaxAgeMs>0&&old?.status==='ok'&&old.reviewedAt===mapping.reviewedAt&&JSON.stringify(old.targets)===JSON.stringify(targets)&&Date.parse(checkedAt)-Date.parse(old.checkedAt)<cacheMaxAgeMs&&(source.source==='huggingface'?old.revision===source.revision:old.sourceName===source.expectedName||isDocumentSource(source.source)&&old.sourceName===officialSourceSpec(source.source,source.id).label+' · '+source.id)){records.push(old);continue}
    if(throttled.has(source.source))throw fail('METADATA_SOURCE_THROTTLED')
    const cooldown=prior?.errors.find(e=>(e.source||e.documentSource)===source.source&&Date.parse(e.retryAfterAt)>Date.parse(checkedAt))
    if(cooldown)throw Object.assign(fail('METADATA_SOURCE_COOLDOWN'),{retryAfterAt:cooldown.retryAfterAt})
    if(remaining()<=0)throw fail('METADATA_TIME_BUDGET')
    const url=isDocumentSource(source.source)?officialSourceSpec(source.source,source.id).url:source.source==='bfl'?'https://api.bfl.ai/openapi.json':source.source==='huggingface'?'https://huggingface.co/api/models/'+source.id+'/revision/'+source.revision:'https://api.fal.ai/v1/models?'+new URLSearchParams({endpoint_id:source.id,expand:'openapi-3.0'})
    if(!responses.has(url))responses.set(url,(async()=>{
     if((failures.get(source.source)||0)>=3)throw fail('METADATA_SOURCE_UNAVAILABLE')
     for(let attempt=0;;attempt++){
      if(remaining()<=interval)throw fail('METADATA_TIME_BUDGET')
      if(++requests>maxRequests)throw fail('METADATA_REQUEST_BUDGET')
      if(interval)await wait(interval)
      if(remaining()<=0)throw fail('METADATA_TIME_BUDGET')
      try{
       // Some .md documentation routes return 404 for Accept: text/markdown.
       // Use the explicit allowlisted URL and verify MIME + contract below.
       let response;try{response=await fetcher(url,{headers:{Accept:isDocumentSource(source.source)?'*/*':'application/json'},redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.ceil(Math.min(20000,remaining()))))})}catch{throw fail(remaining()<=0?'METADATA_TIME_BUDGET':'METADATA_REQUEST_FAILED')}
       if(!response.ok){const error=fail('METADATA_HTTP_'+response.status),retry=response.headers.get('retry-after');if(response.status===429&&retry){const ms=/^\d+$/.test(retry)?Date.parse(now())+Number(retry)*1000:Date.parse(retry);if(Number.isFinite(ms)&&ms>Date.parse(now()))error.retryAfterAt=new Date(ms).toISOString()}throw error}
       let raw;try{raw=await responseText(response)}catch(e){if(e.code==='METADATA_PAYLOAD_TOO_LARGE')throw e;throw fail('METADATA_REQUEST_FAILED')}
       if(isDocumentSource(source.source)){if(!/text\/(markdown|plain)/i.test(response.headers.get('content-type')||''))throw fail('METADATA_DOCUMENT_INVALID');failures.set(source.source,0);return raw}
       let parsed;try{parsed=JSON.parse(raw)}catch{throw fail('METADATA_JSON_INVALID')}
       failures.set(source.source,0);return parsed
      }catch(e){
       const transient=/^METADATA_(REQUEST_FAILED|HTTP_50[0234])$/.test(e.code||'')
       if(attempt||retries>=4||!transient||remaining()<=1000){if(transient)failures.set(source.source,(failures.get(source.source)||0)+1);throw e}
       retries++;await wait(1000)
      }
     }
    })())
    const body=await responses.get(url)
    const observation=isDocumentSource(source.source)?normalizeOfficialDocument(body,source.source,source.id):source.source==='bfl'?normalizeBfl(body,source.id,source.expectedName,source.mode):source.source==='huggingface'?normalizeHuggingFace(body,source.id):normalizeFal(body,source.id)
    if(source.source==='huggingface'&&observation.revision!==source.revision||source.source==='fal'&&observation.sourceName!==source.expectedName)throw fail('METADATA_VERSION_UNVERIFIED')
    if(old&&Object.keys(old?.fields||{}).some(k=>Object.hasOwn(old.fields,k)&&!Object.hasOwn(observation.fields,k)))throw fail('METADATA_FIELDS_LOST')
    if(old?.sourceUpdatedAt&&!observation.sourceUpdatedAt)throw fail('METADATA_SOURCE_TIME_UNKNOWN')
    if(old?.sourceUpdatedAt&&observation.sourceUpdatedAt&&Date.parse(observation.sourceUpdatedAt)<Date.parse(old.sourceUpdatedAt))throw fail('METADATA_SOURCE_TIME_REGRESSED')
    if(source.source==='huggingface'&&old?.revision===observation.revision&&['license','pipeline','baseModels'].some(k=>Object.hasOwn(old.fields,k)&&Object.hasOwn(observation.fields,k)&&JSON.stringify(old.fields[k])!==JSON.stringify(observation.fields[k])))throw fail('METADATA_SOURCE_REVISION_CONFLICT')
    const contentHash=observationHash(observation)
    const observedAt=old&&(old.contentHash||observationHash(old))===contentHash?old.observedAt:now()
    const fieldObservedAt=Object.fromEntries(Object.entries(observation.fields).map(([k,v])=>[k,old&&JSON.stringify(old.fields[k])===JSON.stringify(v)?old.fieldObservedAt?.[k]||old.observedAt:observedAt]))
    const record={...base,...observation,contentHash,fieldObservedAt,observedAt,checkedAt:now(),status:observation.fields.channelStatus==='服务商已标记废弃'?'withdrawn':'ok'}
    const probe={schemaVersion:1,registryRevision:registry.revision,registryHash,checkedAt:record.checkedAt,records:source.source==='bfl'||isDocumentSource(source.source)?[]:[record],...(isDocumentSource(source.source)?{documentRecords:[record]}:{}),...(source.source==='bfl'?{officialRecords:[record]}:{}),errors:[]}
    if(!validMediaMetadata(probe))throw fail('METADATA_SCHEMA_INVALID')
    records.push(record)
   }catch(error){
    const code=/^METADATA_[A-Z0-9_]+$/.test(error.code||'')?error.code:'METADATA_SCHEMA_INVALID'
    errors.push({key,code,...(isDocumentSource(source.source)?{documentSource:source.source}:{source:source.source}),...(error.retryAfterAt?{retryAfterAt:error.retryAfterAt}:{})})
    if(['METADATA_HTTP_401','METADATA_HTTP_403','METADATA_HTTP_429'].includes(code))throttled.add(source.source)
    // Withdrawal is authoritative; temporary errors retain facts with original observation time.
    if(old&&JSON.stringify(old.targets)===JSON.stringify(targets))records.push({...old,...base,lastVerifiedAt:old.status==='ok'?old.checkedAt:old.lastVerifiedAt||old.observedAt,checkedAt,status:old.status==='withdrawn'||old.fields.channelStatus==='服务商已标记废弃'||code==='METADATA_ENDPOINT_MISMATCH'||!isDocumentSource(source.source)&&['METADATA_HTTP_404','METADATA_HTTP_410'].includes(code)?'withdrawn':'stale'})
   }
  }
 }
 const result={schemaVersion:1,registryRevision:registry.revision,registryHash,checkedAt:now(),records:records.filter(r=>r.source!=='bfl'&&!isDocumentSource(r.source)),documentRecords:records.filter(r=>isDocumentSource(r.source)),officialRecords:records.filter(r=>r.source==='bfl'),errors}
 if(!validMediaMetadata(result))throw fail('METADATA_OUTPUT_INVALID')
 return result
}
export async function collectMediaMetadataFile({root=process.cwd(),fetcher=fetch}={}){
 const media=JSON.parse(await readFile(resolve(root,'src/data/media-leaderboards.json'),'utf8'))
 const registry=JSON.parse(await readFile(new URL('./config/media-metadata-registry.json',import.meta.url),'utf8'))
 media.metadata=await collectMediaMetadata({registry,media,previous:media.metadata,fetcher})
 const path=resolve(root,'src/data/media-leaderboards.json');await writeFile(path+'.next',JSON.stringify(media)+'\n');await rename(path+'.next',path)
 console.log(JSON.stringify({metadataRecords:metadataRecords(media.metadata).length,repositoryAndChannelRecords:media.metadata.records.length,officialApiRecords:media.metadata.officialRecords?.length||0,officialDocumentRecords:media.metadata.documentRecords?.length||0,errors:media.metadata.errors}))
 return media
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)collectMediaMetadataFile().catch(e=>{console.error(e.code||'METADATA_COLLECTION_FAILED');process.exitCode=1})
