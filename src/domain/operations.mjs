import {providerKey,providerOrigin} from './providers.mjs'
export const OPERATIONS_CONTRACT='mojing-operations-v2'
export const PAGE_IDS=['radar','models','select','practice','mine']
export const ORIGIN_IDS=['domestic','overseas','unknown']
export const RADAR_VIEWS=['selected','hot','briefings','topics']
export const MODEL_TABS=['evidence','usage','catalog']
export const NEWS_TOPICS=['模型','开发','价格','应用','行业','研究','观点','其他']
export function defaultOperations(){return {
 schemaVersion:2,pages:{radar:false,models:true,select:true,practice:true,mine:true},fallback:'models',
 resources:{skill:true,github:true},channels:{image:true,web:true,skill:false},scope:'featured',sort:'score',hideIncomplete:false,hiddenIds:[],featuredOverrides:{},
 radar:{views:[...RADAR_VIEWS],defaultView:'selected',window:'24h',periods:['daily','weekly','monthly'],topics:[...NEWS_TOPICS],hiddenSourceIds:[],hiddenIds:[],blockedTerms:[]},
 modelPolicy:{origins:['domestic','unknown'],hiddenProviderIds:[],hiddenModelIds:[]},
 research:{enabled:true,categories:['综合','编程','科研','专业办公','知识问答']},
 models:{tabs:[...MODEL_TABS],defaultTab:'evidence',defaultOrigin:'all',source:'artificial-analysis',openOnly:false,sort:'new'},
 media:{boards:['text-to-image','image-editing','text-to-video','image-to-video','text-to-video-audio','image-to-video-audio'],defaultType:'language',defaultBoard:'text-to-image',qualityComparison:true,hiddenModelIds:[]},
 selection:{inheritPolicy:true,origins:[...ORIGIN_IDS],defaultOrigin:'all',purposes:['daily','coding','reading','automation'],defaultPurpose:'daily',load:'regular',resultCount:5,advanced:true},
 delivery:{refreshMinutes:5}
}}
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x)
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k))
const set=(v,allowed,min=1)=>Array.isArray(v)&&v.length>=min&&v.length<=allowed.length&&new Set(v).size===v.length&&v.every(x=>allowed.includes(x))
const ids=(v,max=5000)=>Array.isArray(v)&&v.length<=max&&new Set(v).size===v.length&&v.every(s=>typeof s==='string'&&s.length>0&&s.length<=4096&&!/[\u0000-\u001f]/.test(s))
export function validateOperations(input,options={}){
 try{return validateConfig(input,options)}catch{return ['配置结构无效']}
}
function validateConfig(input,{published=false}={}){
 const errors=[]
 if(!object(input))return ['配置必须是JSON对象']
 if(JSON.stringify(input).length>256000)return ['配置超过256KB限制']
 const d=defaultOperations(),metadata=['contract','version','revision','updatedAt','note']
 if(Object.keys(input).some(k=>!Object.hasOwn(d,k)&&!metadata.includes(k)))errors.push('包含客户端不支持的配置字段')
 const config=Object.fromEntries(Object.keys(d).map(k=>[k,['media','research','resources'].includes(k)&&input[k]===undefined?d[k]:input[k]]))
 if(config.schemaVersion!==2)errors.push('配置协议版本不受支持')
 for(const key of ['pages','channels','radar','modelPolicy','models','selection','delivery'])if(!exact(config[key],Object.keys(d[key])))errors.push(key+' 字段不完整或存在未知字段')
 if(errors.length)return errors
 if(!Object.values(config.pages).every(v=>typeof v==='boolean')||!PAGE_IDS.some(id=>config.pages[id])||!config.pages[config.fallback]||!PAGE_IDS.includes(config.fallback))errors.push('页面开关或默认入口无效')
 if(!Object.values(config.channels).every(v=>typeof v==='boolean')||(!config.channels.web&&!config.channels.image)||config.channels.skill)errors.push('实战频道无效，当前客户端尚未支持Skill内容')
 if(!['featured','all'].includes(config.scope)||!['score','title'].includes(config.sort)||typeof config.hideIncomplete!=='boolean'||!ids(config.hiddenIds))errors.push('实战展示配置无效')
 if(!object(config.featuredOverrides)||Object.keys(config.featuredOverrides).length>5000||!ids(Object.keys(config.featuredOverrides))||!Object.values(config.featuredOverrides).every(v=>typeof v==='boolean'))errors.push('精选调整格式无效')
 const r=config.radar,m=config.models,p=config.modelPolicy,s=config.selection
 if(!set(r.views,RADAR_VIEWS)||!r.views.includes(r.defaultView)||!['24h','7d'].includes(r.window)||!set(r.periods,['daily','weekly','monthly'])||!set(r.topics,NEWS_TOPICS)||!ids(r.hiddenSourceIds,1000)||!ids(r.hiddenIds)||!ids(r.blockedTerms,30)||r.blockedTerms.some(t=>t.length>100||t.trim()!==t))errors.push('雷达栏目、来源或过滤条件无效')
 if(!set(p.origins,ORIGIN_IDS)||!ids(p.hiddenProviderIds,1000)||!ids(p.hiddenModelIds))errors.push('统一模型范围无效')
 if(!set(m.tabs,MODEL_TABS)||!m.tabs.includes(m.defaultTab)||!['all',...p.origins].includes(m.defaultOrigin)||!['artificial-analysis','livebench'].includes(m.source)||typeof m.openOnly!=='boolean'||!['new','price','context'].includes(m.sort))errors.push('模型默认筛选超出允许范围或格式无效')
 if(!exact(config.resources,['skill','github'])||!Object.values(config.resources).every(v=>typeof v==='boolean'))errors.push('实战资源配置无效')
 const research=config.research
 if(!exact(research,Object.keys(d.research))||typeof research.enabled!=='boolean'||!set(research.categories,['综合','编程','科研','专业办公','知识问答']))errors.push('补充评测来源或分类无效')
 const media=config.media
 if(!exact(media,Object.keys(d.media))||!set(media.boards,['text-to-image','image-editing','text-to-video','image-to-video','text-to-video-audio','image-to-video-audio'],0)||!['language','image','video'].includes(media.defaultType)||typeof media.qualityComparison!=='boolean'||!ids(media.hiddenModelIds)||!(media.boards.includes(media.defaultBoard)||media.boards.length===0&&media.defaultBoard==='')||media.defaultType==='image'&&!media.boards.some(id=>['text-to-image','image-editing'].includes(id))||media.defaultType==='video'&&!media.boards.some(id=>id.includes('video')))errors.push('媒体榜单范围或默认入口无效')
 else if(media.defaultType!=='language'&&(['text-to-image','image-editing'].includes(media.defaultBoard)?'image':'video')!==media.defaultType)errors.push('默认媒体榜必须属于默认模型类型')
 if(typeof s.inheritPolicy!=='boolean'||!set(s.origins,ORIGIN_IDS)||!set(s.purposes,['daily','coding','reading','automation'])||!s.purposes.includes(s.defaultPurpose)||!['light','regular','heavy'].includes(s.load)||![3,5,10].includes(s.resultCount)||typeof s.advanced!=='boolean')errors.push('选型条件无效')
 const origins=s.inheritPolicy?p.origins:s.origins.filter(o=>p.origins.includes(o))
 if(!origins.length||!['all',...origins].includes(s.defaultOrigin))errors.push('选型默认条件超出统一范围')
 if(![1,5,15,60].includes(config.delivery.refreshMinutes))errors.push('配置检查间隔无效')
 if(published&&!(input.contract===OPERATIONS_CONTRACT&&typeof input.version==='string'&&/^cfg-[a-zA-Z0-9-]{6,100}$/.test(input.version)&&Number.isSafeInteger(input.revision)&&input.revision>=1&&typeof input.updatedAt==='string'&&Number.isFinite(Date.parse(input.updatedAt))&&typeof input.note==='string'&&input.note.length<=120))errors.push('发布版本信息无效')
 return errors
}
export function operationsConfig(input){const errors=validateOperations(input);if(errors.length)throw Error(errors.join('；'));const defaults=defaultOperations();return JSON.parse(JSON.stringify(Object.fromEntries(Object.keys(defaults).map(k=>[k,['media','research','resources'].includes(k)&&input[k]===undefined?defaults[k]:input[k]]))))}
// Existing released clients reject unknown configuration keys. Publish their exact
// v2 projection at the original URL and the extended envelope at a separate URL.
export function legacyOperations(input){const result=JSON.parse(JSON.stringify(input));delete result.media;delete result.research;delete result.resources;return result}
export function mediaOperations(input){const result=JSON.parse(JSON.stringify(input));delete result.research;delete result.resources;return result}
export const pageAllowed=(config,id)=>PAGE_IDS.includes(id)&&config.pages[id]===true
export const allowedSelectionOrigins=config=>config.selection.inheritPolicy?config.modelPolicy.origins:config.selection.origins.filter(id=>config.modelPolicy.origins.includes(id))
export function modelAllowed(config,model){return config.modelPolicy.origins.includes(providerOrigin(model.provider))&&!config.modelPolicy.hiddenProviderIds.includes(providerKey(model.provider))&&!config.modelPolicy.hiddenModelIds.includes(model.id)}
export function evaluationAllowed(config,row,models=[]){
 if(!modelAllowed(config,row))return false
 // Evidence rows have independent IDs. Suppress matched names too, so hiding a
 // catalog model cannot leave its leaderboard record or detail route visible.
 const name=String(row.name||'').toLowerCase().replace(/[^a-z0-9]/g,'')
 return !models.some(m=>config.modelPolicy.hiddenModelIds.includes(m.id)&&providerKey(m.provider)===providerKey(row.provider)&&[m.name?.split(': ').pop(),m.id?.split('/').pop()].some(n=>n&&String(n).toLowerCase().replace(/[^a-z0-9]/g,'')===name))
}
export function practiceAllowed(config,item){return pageAllowed(config,'practice')&&config.channels[item.channel]===true&&!config.hiddenIds.includes(item.id)&&!(config.hideIncomplete&&item.promptStatus==='needs-input')}
export function projectPractice(config,items){return items.filter(item=>practiceAllowed(config,item)).map(item=>Object.hasOwn(config.featuredOverrides,item.id)?{...item,quality:{...item.quality,featured:config.featuredOverrides[item.id]}}:item)}
export function projectRadarEvent(config,event){
 if(!event||!pageAllowed(config,'radar')||config.radar.hiddenIds.includes(event.id)||event.aliases?.some(id=>config.radar.hiddenIds.includes(id))||!config.radar.topics.includes(event.topic||'其他')||config.radar.blockedTerms.some(t=>String(event.title).toLowerCase().includes(t.toLowerCase())))return null
 const articles=Array.isArray(event.articles)?event.articles:[]
 if(articles.some(a=>config.radar.hiddenIds.includes(a.id)||config.radar.hiddenIds.includes(a.url)))return null
 // Fail closed for aggregated summaries: removing one source cannot prove which
 // sentences came from it. Hide the entire event until re-edited, including search.
 if(config.radar.hiddenSourceIds.length&&(event._searchOnly||articles.some(a=>config.radar.hiddenSourceIds.includes(a.sourceId))))return null
 return event
}
export function projectRadarPayload(config,payload){
 if(!payload)return payload
 const project=rows=>(rows||[]).map(e=>projectRadarEvent(config,e)).filter(Boolean)
 const hot=rows=>(rows||[]).map(h=>({...h,event:projectRadarEvent(config,h.event)})).filter(h=>h.event)
 if(payload.type==='topics')return {...payload,items:(payload.items||[]).map(t=>({...t,latest:projectRadarEvent(config,t.latest)}))}
 if(payload.type==='archive'&&(config.radar.hiddenSourceIds.length||config.radar.hiddenIds.length||config.radar.blockedTerms.length||config.radar.topics.length<NEWS_TOPICS.length||!config.pages.radar))return {...payload,...Object.fromEntries(['daily','weekly','monthly'].map(kind=>[kind,(payload[kind]||[]).map(row=>({...row,headline:'按当前范围查看简报'}))]))}
 if(payload.type==='selected')return {...payload,items:project(payload.items)}
 if(payload.type==='hot')return {...payload,items:hot(payload.items)}
 if(payload.type==='topic')return {...payload,items:project(payload.items),hot:hot(payload.hot)}
 if(payload.type==='report'){
  const items=project(payload.report.items),changed=items.length!==payload.report.items.length
  return {...payload,report:{...payload.report,items,...(changed?{headline:'当前范围简报',overview:'已按当前展示范围筛选，查看下方保留内容。',sections:undefined}: {})}}
 }
 return payload
}

const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item)
export function operationsEnvelopesAgree(legacy,full){return !!legacy&&!!full&&legacy.version===full.version&&stable(legacyOperations(legacy))===stable(legacyOperations(full))}

export function mediaEnvelopesAgree(v3,v4){return !!v3&&!!v4&&v3.version===v4.version&&stable(mediaOperations(v3))===stable(mediaOperations(v4))}

export function resourceOperations(input){const result=JSON.parse(JSON.stringify(input));delete result.resources;return result}
export function resourceEnvelopesAgree(v4,v5){return !!v4&&!!v5&&v4.version===v5.version&&stable(resourceOperations(v5))===stable(v4)}
