import {httpResponseError} from './request-errors.mjs'
import {writeFile,rename} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
export const source='https://livebench.ai/'
export function parseCsv(text){
 const records=[];let row=[],cell='',quoted=false
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\n')){row.push(cell.trim());cell='';if(c==='\n'){if(row.some(Boolean))records.push(row);row=[]}}else if(c!=='\r')cell+=c}
 if(quoted)throw Error('CSV 引号未闭合');if(cell||row.length){row.push(cell.trim());records.push(row)}
 const header=records.shift();if(!header?.includes('model'))throw Error('CSV 缺少 model');return records.map(values=>{if(values.length!==header.length)throw Error('CSV 列数异常');return Object.fromEntries(header.map((k,i)=>[k,values[i]]))})
}
const numeric=v=>v!==undefined&&v!==null&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null
export function livebenchRows(csv,categories,costCsv,metadata,release){
 // The official file keeps bookkeeping keys such as _overall_weights beside the suites.
 const groups=Object.entries(categories||{}).filter(([key])=>!key.startsWith('_'));if(!groups.length||groups.some(([,v])=>!Array.isArray(v)||!v.length))throw Error('分类字段异常')
 const costs=new Map(parseCsv(costCsv).map(r=>[r.model,r]));const columns=groups.flatMap(([,v])=>v)
 return parseCsv(csv).map(r=>{
  const scores=Object.fromEntries(groups.map(([k,cols])=>{const vs=cols.map(c=>numeric(r[c]));if(vs.some(v=>v==null||v<0||v>100))return[k,null];return[k,vs.reduce((a,b)=>a+b,0)/vs.length]}))
  if(Object.values(scores).some(v=>v==null))throw Error('分项不完整，停止更新而非补零')
  const m=metadata[r.model]||{};const cr=costs.get(r.model);let sum=0,count=0,complete=!!cr
  for(const col of columns){const c=numeric(cr?.[col]),n=numeric(cr?.['nq_'+col]);if(c==null||c<0||n==null||n<=0){complete=false;break}sum+=c;count+=n}
  return{sourceId:'livebench',id:r.model,name:m.displayName||r.model,provider:m.organization||'未标注厂商',openWeight:m.openWeight??null,score:Number((Object.values(scores).reduce((a,b)=>a+b,0)/groups.length).toFixed(2)),cost:complete?sum/count:null,costBasis:'source',costUnit:'USD / task',date:release,configuration:m.effort?`effort: ${m.effort}`:'来源未标注配置',categories:scores,source:source,modelSource:m.url||null}
 })
}
export function releaseFromBundle(js){
 const dashed=id=>`${id.slice(0,4)}-${id.slice(4,6)}-${id.slice(6,8)}`
 // LiveBench 2.0 publishes compact keys under data/<key>/; the earlier page exposed dashed
// pairs and ./v1/table_<dashed>.csv. Read both so a redesign cannot silently freeze the board.
 const compact=[...js.matchAll(/"(20\d{6})"/g)].map(m=>m[1]).filter(id=>/^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(id))
 if(compact.length){const id=compact.sort().at(-1);return {key:id,label:dashed(id),dir:`data/${id}`}}
 const pairs=[...js.matchAll(/"(20\d\d-\d\d-\d\d)":"(20\d\d-\d\d-\d\d)"/g)].sort((a,b)=>b[2].localeCompare(a[2]))
 if(pairs.length){const[,key,label]=pairs[0];return {key,label,dir:'v1',tag:key.replaceAll('-','_')}}
 throw Error('未确认当前发布版本')
}
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw httpResponseError(r);return r.text()}async function main(){
 const html=await get(source);const script=html.match(/src="([^" ]+main\.[^" ]+\.js)"/)?.[1];if(!script)throw Error('未发现官方应用脚本')
 const js=await get(new URL(script,source));const release=releaseFromBundle(js)
 const urls=['table','categories','cost','notes'].map(k=>{const ext=['categories','notes'].includes(k)?'json':'csv';return new URL(`${release.dir}/${release.tag?`${k}_${release.tag}`:k}.${ext}`,source).href})
 const [table,categoriesText,cost,notes]=await Promise.all(urls.map(get));const metadata={}
 for(const hit of js.matchAll(/"([^" ]+)":\{([^{}]{0,1500})\}/g)){const body=hit[2],org=body.match(/organization:"([^"]+)"/)?.[1],name=body.match(/displayName:"([^"]+)"/)?.[1];if(org&&name)metadata[hit[1]]={organization:org,displayName:name,openWeight:/openweight:!0/.test(body)?true:/openweight:!1/.test(body)?false:null,effort:body.match(/effort:"([^"]+)"/)?.[1],url:body.match(/url:"([^"]+)"/)?.[1]}}
 const categories=JSON.parse(categoriesText);const rows=livebenchRows(table,categories,cost,metadata,release.label);if(rows.length<20||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('记录校验失败')
 const collectedAt=new Date().toISOString();const sources=[{id:'artificial-analysis',shortLabel:'AA 综合',status:'integrated',domain:'综合能力',source:'https://artificialanalysis.ai/leaderboards/models',note:'原始 Intelligence Index；保留推理档位和 fallback 配置。'},{id:'livebench',shortLabel:'LiveBench 2.0',status:'integrated',domain:'七类实际任务',source,release:release.label,collectedAt,note:'先计算各分类均分，再对分类等权平均；任务费用按官方总费用 / 任务数。'}]
 const data={schemaVersion:2,collectedAt,sources,rows,methodology:JSON.parse(notes),provenance:{releaseKey:release.key,releaseLabel:release.label,assets:urls.map((url,i)=>({url,sha256:createHash('sha256').update([table,categoriesText,cost,notes][i]).digest('hex')})),applicationScript:new URL(script,source).href},withdrawn:[{id:'weighted',reason:'不同量纲的原始分不能直接相加；版本和测试配置尚未跨源核验。'},{id:'aider-polyglot',reason:'历史编程测试不作为当前模型排行，停止展示。'}]}
 await writeFile('src/data/evaluation-leaderboards.next.json',JSON.stringify(data,null,2)+'\n');await rename('src/data/evaluation-leaderboards.next.json','src/data/evaluation-leaderboards.json');console.log(`LiveBench: ${rows.length} 条，官方发布 ${release.label}`)
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1})
