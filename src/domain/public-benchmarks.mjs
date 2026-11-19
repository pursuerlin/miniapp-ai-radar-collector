export const PUBLIC_BENCHMARKS=[
 {id:'geneval',name:'GenEval',kind:'image',url:'https://github.com/djghosh13/geneval',dataUrl:'https://raw.githubusercontent.com/djghosh13/geneval/main/README.md',metrics:['Overall','Single object','Two object','Counting','Colors','Position','Color attribution'],labels:['综合','单物体','双物体','数量','颜色','位置','颜色归属']},
 {id:'vbench',name:'VBench',kind:'video',url:'https://vchitect.github.io/VBench-project/',dataUrl:'https://vchitect.github.io/VBench-project/',metrics:['Subject Consistency','Background Consistency','Temporal Flickering','Motion Smoothness','Dynamic Degree','Aesthetic Quality','Imaging Quality','Object Class','Multiple Objects','Human Action','Color','Spatial Relationship','Scene','Appearance Style','Temporal Style','Overall Consistency'],labels:['主体一致性','背景一致性','时序稳定','运动流畅','动态程度','美学质量','成像质量','物体类别','多物体','人物动作','颜色','空间关系','场景','外观风格','时序风格','整体一致性']}
]
// Optional editions keep schema v1 readable by clients that only know the two legacy sources.
export const VBENCH_CONFIG_URL='https://vchitect-vbench-leaderboard.hf.space/config'
export const BENCHMARK_EDITIONS=[
 {id:'vbench-2',name:'VBench 2.0 · 文生视频',kind:'video',board:'text-to-video',url:'https://huggingface.co/spaces/Vchitect/VBench_Leaderboard',metrics:['Total Score','Creativity Score','Commonsense Score','Controllability Score','Human Fidelity Score','Physics Score','Human Anatomy','Human Clothes','Human Identity','Composition','Diversity','Mechanics','Material','Thermotics','Multi-View Consistency','Dynamic Spatial Relationship','Dynamic Attribute','Motion Order Understanding','Human Interaction','Complex Landscape','Complex Plot','Camera Motion','Motion Rationality','Instance Preservation'],labels:['综合','创意','常识','可控性','人物表现','物理规律','人体结构','人物服饰','人物身份','构图','多样性','力学','材质','热学','多视角一致性','动态空间关系','动态属性','动作顺序理解','人物交互','复杂景观','复杂情节','镜头运动','运动合理性','实例保留']},
 {id:'vbench-i2v',name:'VBench · 图生视频',kind:'video',board:'image-to-video',url:'https://huggingface.co/spaces/Vchitect/VBench_Leaderboard',metrics:['Total Score','I2V Score','Quality Score','Video-Text Camera Motion','Video-Image Subject Consistency','Video-Image Background Consistency','Subject Consistency','Background Consistency','Motion Smoothness','Dynamic Degree','Aesthetic Quality','Imaging Quality'],labels:['综合','图生视频综合','质量综合','镜头指令遵循','参考图主体一致性','参考图背景一致性','主体一致性','背景一致性','运动流畅','动态程度','美学质量','成像质量']}
]
const time=value=>Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+300000
const text=value=>typeof value==='string'&&value.length>0&&value.length<200
function validSource(s,defs,edition=false){
 const def=defs.find(d=>d.id===s?.id)
 if(!def||s.url!==def.url||!time(s.checkedAt)||!['ok','stale','unavailable'].includes(s.status)||s.sourceUpdatedAt!==null||!Array.isArray(s.rows)||s.rows.length>500)return false
 if(new Set(s.rows.map(r=>edition?r?.id:r?.name)).size!==s.rows.length||s.status==='ok'&&!s.rows.length)return false
 if(s.rows.length&&(!/^[a-f0-9]{64}$/.test(s.contentHash)||!time(s.observedAt)||Date.parse(s.observedAt)>Date.parse(s.checkedAt)))return false
 return s.rows.every(r=>{
  if(!r||!text(r.name)||!r.scores||Object.keys(r.scores).length!==def.metrics.length||!Object.entries(r.scores).every(([k,v])=>def.metrics.includes(k)&&(edition&&v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)))return false
  return !edition||/^[a-f0-9]{24}$/.test(r.id)&&/^\d{4}-\d{2}-\d{2}$/.test(r.evaluatedAt)&&time(r.evaluatedAt)&&new Date(r.evaluatedAt).toISOString().slice(0,10)===r.evaluatedAt&&Date.parse(r.evaluatedAt)<=Date.parse(s.checkedAt)&&text(r.evaluatedBy)&&text(r.sampledBy)&&r.evaluationScope===(r.evaluatedBy==='VBench Team'?'team':'submitter')
 })
}
export function validPublicBenchmarks(data){return !!(data?.schemaVersion===1&&Array.isArray(data.sources)&&data.sources.length===2&&new Set(data.sources.map(s=>s?.id)).size===2&&data.sources.every(s=>validSource(s,PUBLIC_BENCHMARKS))&&(data.editions===undefined||Array.isArray(data.editions)&&data.editions.length<=BENCHMARK_EDITIONS.length&&new Set(data.editions.map(s=>s?.id)).size===data.editions.length&&data.editions.every(s=>validSource(s,BENCHMARK_EDITIONS,true))))}
function mergeSources(current,incoming){
 const result=incoming.map(source=>{const old=current.find(s=>s.id===source.id);if(!old)return source;if(Date.parse(old.checkedAt)>Date.parse(source.checkedAt))return old;if(old.rows.length&&!source.rows.length)return {...old,checkedAt:source.checkedAt,status:'stale',errorCode:source.errorCode};return Date.parse(old.observedAt)>Date.parse(source.observedAt)?old:source})
 for(const old of current)if(!result.some(s=>s.id===old.id))result.push(old)
 return result
}
export function mergePublicBenchmarks(current,incoming){
 if(!validPublicBenchmarks(incoming))return validPublicBenchmarks(current)?current:null
 if(!validPublicBenchmarks(current))return incoming
 const editions=mergeSources(current.editions||[],incoming.editions||[])
 return {...incoming,sources:mergeSources(current.sources,incoming.sources),...(editions.length?{editions}:{})}
}
export function publicBenchmarkSources(data,kind,board){
 if(!validPublicBenchmarks(data))return []
 return [...(data.editions||[]),...data.sources].map(s=>({...s,definition:[...BENCHMARK_EDITIONS,...PUBLIC_BENCHMARKS].find(d=>d.id===s.id)})).filter(s=>s.definition.kind===kind&&(!s.definition.board||s.definition.board===board))
}
