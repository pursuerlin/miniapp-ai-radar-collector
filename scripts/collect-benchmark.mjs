import {createHash} from 'node:crypto';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const source='https://artificialanalysis.ai/leaderboards/models';
// AA release slugs can contain underscores (e.g. joyvl2_v27). Accept a single
// unreserved URL path segment, never a URL, encoded separator or dot traversal.
export const isAaModelSlug=value=>typeof value==='string'&&/^(?!\.{1,2}$)[A-Za-z0-9._~-]+$/.test(value);
export const isAaReleaseRanking=models=>models.length>=30&&models.every(model=>typeof model.id==='string'&&model.id.length>0&&isAaModelSlug(model.release?.slug)&&model.slug===undefined);
const clean=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').trim();
const weightKey=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'');
// The rendered table omits the weight label; the page's flight payload carries it.
function flightOf(html){
 try{return [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map(m=>JSON.parse(m[1])).join('')}catch{return ''}
}
function flightValue(flight,key,opening,closing){
 const match=new RegExp(`"${key}"\\s*:\\s*\\${opening}`).exec(flight);if(!match)return null;
 const start=flight.indexOf(opening,match.index+key.length+2);let depth=0,inString=false,escaped=false,end=-1;
 for(let i=start;i<flight.length;i++){const ch=flight[i];
  if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue}
  if(ch==='"'){inString=true;continue}
  if(ch===opening)depth++;
  else if(ch===closing&&!--depth){end=i+1;break}
 }
 if(end<0)return null;
 try{return JSON.parse(flight.slice(start,end))}catch{return null}
}
export function parseAaModels(html){
 const models=flightValue(flightOf(html),'initialModels','[',']');
 return Array.isArray(models)?models.filter(m=>m&&typeof m.name==='string'):[];
}
// A detail page keeps its own configuration outside the comparison list. The
// current model may be absent from initialModels, even when every metric exists.
export function parseAaCurrentModel(html){
 const model=flightValue(flightOf(html),'currentModel','{','}');
 return model&&typeof model.slug==='string'&&typeof model.name==='string'?model:null;
}
// Scores do not carry across index versions, and the page names its own version.
// A page mentioning two versions is ambiguous, so it gets no label rather than a guess.
export function parseAaIndexVersion(html){
 const found=new Set([...flightOf(html).matchAll(/Artificial Analysis Intelligence Index (v\d+(?:\.\d+)*)/g)].map(m=>m[1]));
 return found.size===1?[...found][0]:'';
}
function weightIndex(models){
 const index=new Map();
 for(const m of models)for(const n of new Set([m.name,m.shortName])){
  if(typeof m.isOpenWeights!=='boolean')continue;
  if(typeof n!=='string'||!n)continue;
  const key=weightKey(n),values=index.get(key)||[];values.push(m.isOpenWeights);index.set(key,values);
 }
 return index;
}
function openWeightOf(name,index){
 const values=new Set(index.get(weightKey(name))||[]);
 return values.size===1?[...values][0]:undefined;
}
export function parseBenchmark(html){
 const table=html.match(/<table\b[\s\S]*?<\/table>/i)?.[0];if(!table)throw Error('未找到综合榜表格');
 const cells=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>clean(c[1])));
 const header=cells.find(c=>c[0]==='Model');if(header?.length!==9||!header[3]?.includes('Intelligence Index')||!header[4]?.includes('Cost per Task')||!/^(?:Speed|(?:Median\s*)?Tokens\/s)$/i.test(header[5])||!/^(?:Latency|Latency\s*First Chunk\s*\(s\))$/i.test(header[6])||!/^(?:Response|Total\s*Response\s*\(s\))$/i.test(header[7]))throw Error('榜单字段已变化，保留旧快照');
 const models=parseAaModels(html),weights=weightIndex(models),seen=new Map();
 // The page distinguishes first streamed token from first answer token. Attach
 // timing only to one exact name/configuration, never to a model family.
 const identity=name=>String(name||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
 const timingFor=(name,tableLatency,tableResponse)=>{
  const matches=models.filter(m=>[m.name,m.shortName].some(n=>identity(n)===identity(name)));
  if(matches.length!==1)return {};
  const model=matches[0],timing={};
  for(const [field,sourceField] of [['firstTokenLatency','medianTimeToFirstTokenSeconds'],['firstAnswerLatency','medianTimeToFirstAnswerTokenSeconds'],['endToEndLatency','medianEndToEndResponseTimeSeconds']]){
   const value=model[sourceField];if(typeof value==='number'&&Number.isFinite(value)&&value>=0)timing[field]=value;
  }
  // Two independent representations from the same response must agree at the
  // table's two-decimal precision. Never join metrics from a different config.
  for(const [field,cell] of [['firstTokenLatency',tableLatency],['endToEndLatency',tableResponse]]){
   if(timing[field]!==undefined&&/^\d+(?:\.\d+)?$/.test(cell)&&Math.abs(timing[field]-Number(cell))>.00500001)throw Error(`AA timing mismatch: ${name} / ${field}`);
  }
  return timing;
 };
 // A model AA lists but has not scored yet keeps its row: context, provider, speed and
 // latency are real, only the score and cost are absent. Dropping it would hide coverage.
 const scoreCell=/^\d+(\.\d+)?\*?$/,noScore=/^[-–—]+$/;
 return cells.filter(c=>c.length===9&&(scoreCell.test(c[3])||noScore.test(c[3]))).map(c=>{const key=c[0].toLowerCase().replace(/[^a-z0-9]+/g,'-');const n=(seen.get(key)||0)+1;seen.set(key,n);const row={id:key+(n>1?n:''),name:c[0],provider:c[2],context:c[1],score:scoreCell.test(c[3])?Number(c[3].replace('*','')):null,provisional:c[3].includes('*'),cost:/^\$[\d,.]+$/.test(c[4])?Number(c[4].slice(1).replaceAll(',','')):null,speed:/^[\d,.]+$/.test(c[5])?Number(c[5].replaceAll(',','')):null,latency:c[6],responseTime:c[7],...timingFor(c[0],c[6],c[7])};const openWeight=openWeightOf(c[0],weights);if(openWeight!==undefined)row.openWeight=openWeight;return row});
}
export function buildBenchmarkData(html,collectedAt=new Date().toISOString()){
 const rows=parseBenchmark(html),models=parseAaModels(html),ranked=models.filter(m=>typeof m.intelligenceIndex==='number').length;
 // A payload we cannot read says nothing about coverage; claiming "0 models on the
 // source page" next to a populated board would be a fabricated denominator.
 const coverage=models.length?{listed:models.length,ranked}:undefined;
 return {schemaVersion:1,collectedAt,source,name:'Artificial Analysis Intelligence Index',indexVersion:parseAaIndexVersion(html),coverage,costDefinition:'来源列名：Cost per Task · USD。仅保留官方报告数值，不换算目录价格。',provenance:{url:source,sha256:createHash('sha256').update(html).digest('hex'),scoreColumn:'Artificial Analysis Intelligence Index',costColumn:'Cost per Task USD',speedColumn:'Median Tokens/s',latencyColumn:'Latency First Chunk (s)',firstTokenField:'medianTimeToFirstTokenSeconds',firstAnswerField:'medianTimeToFirstAnswerTokenSeconds',endToEndField:'medianEndToEndResponseTimeSeconds',responseTimeColumn:'Total Response (s)',timingUnit:'seconds',methodologyUrl:'https://artificialanalysis.ai/methodology/performance-benchmarking'},rows};
}
async function main(){
 let html,data;
 if(process.argv[2]){html=await readFile(process.argv[2],'utf8');data=buildBenchmarkData(html)}
 else{const {collectCurrentAa}=await import('./collect-aa-current.mjs');let previousRows=[],previousAdditionalRows=[],previousIndexVersion;try{const previous=JSON.parse(await readFile('src/data/latest-benchmark.json','utf8'));previousRows=previous.rows||[];previousAdditionalRows=previous.additionalRows||[];previousIndexVersion=previous.indexVersion}catch(error){if(error.code!=='ENOENT')throw error}const {AA_DETAIL_RELEASES}=await import('./collect-aa-supplements.mjs');const result=await collectCurrentAa({supplementSlugs:AA_DETAIL_RELEASES,previousRows,previousAdditionalRows,previousIndexVersion,onProgress:({done,total,verified})=>console.log(`AA 详情 ${done}/${total}，已核实 ${verified} 条`)});html=result.rankingHtml;data=result.data}
 const rows=data.rows;if(rows.length<30||rows.filter(r=>r.score!==null).length<30||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('综合榜数据校验失败');
 await mkdir('docs/accuracy-audit/raw',{recursive:true});await writeFile(`docs/accuracy-audit/raw/${data.performanceVersion==='v3'?'aa-current-v3.html':'aa-current.html'}`,html);
 const coverage=data.coverage?`，其中 ${data.coverage.ranked} 条有 ${data.indexVersion||'当前版'} 综合分、${data.coverage.listed-data.coverage.ranked} 条来源未给分`:'';
 await writeFile('src/data/latest-benchmark.next.json',JSON.stringify(data,null,2)+'\n');await rename('src/data/latest-benchmark.next.json','src/data/latest-benchmark.json');console.log(`已采集 ${rows.length} 条综合榜记录${coverage}；缺失费用 ${rows.filter(r=>r.cost==null).length} 条；开放权重 ${rows.filter(r=>r.openWeight===true).length} 条，未标注 ${rows.filter(r=>typeof r.openWeight!=='boolean').length} 条`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1});
