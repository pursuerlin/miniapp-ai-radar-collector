import {aihotEvents,validAihotData} from './aihot.mjs'
import {articleLinks,matchArticles,eventPriority,isAiRelevant} from './news-policy.mjs'
import {estimateCost,supportsStructuredOutput,normalizeSelectionTask} from './radar.mjs'
import {validArticleRights} from './content-rights.mjs'
import {canonicalUrl} from './urls.mjs'
export {canonicalUrl} from './urls.mjs'
export function topicFor(title) {
  if (/arxiv|preprint|论文|预印本/i.test(title)) return '研究';
  if (/model|gpt|claude|gemini|llama|deepseek|qwen|minimax|大模型|语言模型|模型/i.test(title)) return '模型';
  if (/price|pricing|cost|降价|价格/i.test(title)) return '价格';
  if (/agent|coding|code\b|developer|sdk|api\b|工具|编程/i.test(title)) return '开发';
  return '应用';
}
export function groupNews(articles, now) {
  if(articles.length && articles.every(a=>a.provider==='aihot'))return aihotEvents({articles});
  const groups=[];
  for(const a of articles){
    const url=canonicalUrl(a.url),time=Date.parse(a.publishedAt);
    if(!url||!a.title||!Number.isFinite(time)||time>now)continue;
    // Compare each member to avoid fuzzy bridge chains merging unrelated stories.
    let g=groups.find(g=>g.articles.some(b=>matchArticles(a,b)==='相同原文链接')||g.articles.every(b=>!!matchArticles(a,b)));
    if(!g){g={id:url,title:a.title,urls:[],articles:[],mergeReasons:[],topic:a.contentType==='preprint'?'研究':topicFor(a.title),publishedAt:a.publishedAt};groups.push(g);}
    if(!g.articles.some(x=>x.sourceId===a.sourceId&&canonicalUrl(x.url)===url)){
      if(g.articles.length){const reason=g.articles.map(b=>matchArticles(a,b)).find(Boolean);if(reason&&!g.mergeReasons.includes(reason))g.mergeReasons.push(reason);}
      // Prefer the official headline to a newsletter's or forum's wording.
      if(a.kind==='official'&&!g.articles.some(b=>b.kind==='official')){g.title=a.title;g.topic=a.contentType==='preprint'?'研究':topicFor(a.title);}
      g.articles.push(a);
    }
    for(const link of articleLinks(a))if(!g.urls.includes(link))g.urls.push(link);
    if(time>Date.parse(g.publishedAt))g.publishedAt=a.publishedAt;
  }
  return groups.map(g=>{
    // Only distinct families inside the 48-hour window count: a syndicated copy from
    // the same house is one voice, and yesterday's coverage of the same story is stale.
    const families=new Set();
    for(const a of g.articles){const age=(now-Date.parse(a.publishedAt))/36e5;if(a.evidenceRole!=='discovery'&&age>=0&&age<=48)families.add(a.family);}
    const event={...g,familyCount:families.size};
    return {...event,selectionReasons:eventPriority(event).reasons};
  }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
export function filterNews(events,{topic='全部',kind='all',families=/** @type {string[]} */ ([])}={}) {
  return events.filter(e=>(topic==='全部'||e.topic===topic)&&(kind==='all'||(kind==='followed'?e.articles.some(a=>families.includes(a.family)):e.articles.some(a=>a.kind===kind))))
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
// Recency stays primary, but a single outlet or vendor family should not own a
// whole screen. Greedily pull the next event that breaks the run; when only one
// voice is left, keep it rather than dropping or inventing coverage.
export function interleaveNews(events,{maxRun=2,familyOf=e=>e?.articles?.[0]?.family||'',sourceOf=e=>e?.articles?.[0]?.sourceId||''}={}) {
  const pending=[...events],result=[]
  let lastFamily='',lastSource='',familyRun=0,sourceRun=0
  while(pending.length){
    let index=pending.findIndex(event=>{
      const family=familyOf(event),source=sourceOf(event)
      return !((family&&family===lastFamily&&familyRun>=maxRun)||(source&&source===lastSource&&sourceRun>=maxRun))
    })
    if(index<0)index=0
    const [event]=pending.splice(index,1)
    const family=familyOf(event),source=sourceOf(event)
    familyRun=family&&family===lastFamily?familyRun+1:1
    sourceRun=source&&source===lastSource?sourceRun+1:1
    lastFamily=family;lastSource=source
    result.push(event)
  }
  return result
}
// One label per event, so 每日精选 and 全部动态 name the same thing the same way.
export function newsKindLabel(event) {
  return event.articles.some(a=>a.contentType==='preprint')?'预印本':event.articles.some(a=>a.contentType==='changelog')?'更新日志':event.articles.some(a=>a.kind==='official')?'官方发布':event.articles.some(a=>a.kind==='community')?'社区文章':'媒体报道';
}
// Feeds that publish a date with no clock arrive as UTC midnight; printing it as a time would invent 08:00 in Beijing.
export function isDayOnly(publishedAt,precision) {
  return precision==='day'||/T00:00:00\.000Z$/.test(String(publishedAt));
}
// groupNews moves an event's publishedAt to its newest article, so the precision flag must come from that same article.
export function eventDayOnly(event) {
  const article=event.articles.find(a=>a.publishedAt===event.publishedAt)||event.articles[0];
  return isDayOnly(article.publishedAt,article.datePrecision);
}
export function isLatinTitle(title) {
  return !/[\u4e00-\u9fff]/.test(title);
}
/** @param {any[]} models @param {{task?:string,daily?:string|number,input?:string|number,output?:string|number,budget?:string,minContext?:number,structured?:boolean,cacheRate?:string|number}} options */
// Pass the options straight through: rebuilding them here silently dropped new filters.
export function selectCandidates(models,options={}) {
  return diagnoseCandidates(models,options).candidates;
}
// First-failure counts are disjoint: every excluded model has one reason.
/** @param {any[]} models @param {{task?:string,daily?:string|number,input?:string|number,output?:string|number,budget?:string,minContext?:number,structured?:boolean,cacheRate?:string|number}} options */
export function diagnoseCandidates(models,{task='all',daily,input,output,budget='',minContext=0,structured=false,cacheRate=0}={}) {
  const capabilities=normalizeSelectionTask(task).split(',');
  const invalid=v=>v==null||String(v).trim()===''||!Number.isFinite(Number(v))||Number(v)<0;
  const fields={daily:['每天请求数',daily],input:['平均输入',input],output:['平均输出',output],minContext:['上下文要求',minContext],budget:['月预算上限',budget]};
  const errors=Object.fromEntries(Object.entries(fields).filter(([key,[,value]])=>!(key==='budget'&&value==='')&&invalid(value)).map(([key,[label,value]])=>[key,value==null||String(value).trim()===''?`请填写${label}`:`${label}需为不小于 0 的有效数字`]));
  // An empty cache rate means no cache hits; anything outside 0–100 is a typed error,
  // not a reason to silently drop every candidate into the budget bucket.
  const cacheValue=String(cacheRate??'').trim()===''?0:Number(cacheRate);
  if(!Number.isFinite(cacheValue)||cacheValue<0||cacheValue>100)errors.cache='缓存命中率需为 0 到 100 之间的数字';
  // A batch price presupposes an asynchronous channel, and a task-specific model is
  // not a general chat substitute. Both used to win the cost table on price alone.
  const batchVariant=/[:/]batch$|\(batch\)$/i
  const specialtyModel=/\b(extract|summari[sz]e|embedding|embed|rerank|re-rank|guard|moderation|classifier|classify)\b/i
  const excluded={price:0,variant:0,capability:0,specialized:0,context:0,output:0,structured:0,budget:0};
  if(Object.keys(errors).length)return {candidates:[],errors,excluded};
  const required=Math.max(Number(minContext),Number(input)+Number(output)),candidates=[];
  for(const m of models){
    let reason='';
    if(m.input==null||m.output==null||!(m.input>0||m.output>0)||m.id.endsWith(':free'))reason='price';
    else if(batchVariant.test(`${m.id} ${m.name}`))reason='variant';
    else if(!m.outputModalities.includes('text')||capabilities.includes('vision')&&!m.modalities.includes('image')||capabilities.includes('tools')&&!m.parameters.includes('tools'))reason='capability';
    else if(specialtyModel.test(`${m.id} ${m.name}`))reason='specialized';
    else if(m.context==null||m.context<required)reason='context';
    else if(Number(output)>0&&(m.maxOutput==null||m.maxOutput<Number(output)))reason='output';
    else if(structured&&!supportsStructuredOutput(m))reason='structured';
    // One implementation of the cost math, shared with the comparison table.
    const monthly=estimateCost(m,Number(daily),Number(input),Number(output),30,cacheValue);
    if(!reason&&(monthly===null||budget!==''&&monthly>Number(budget)))reason='budget';
    if(reason)excluded[reason]++;else candidates.push({...m,monthly});
  }
  candidates.sort((a,b)=>a.monthly-b.monthly||a.id.localeCompare(b.id));
  return {candidates,errors,excluded};
}
// Cost is the page's promise, but "cheapest" is not always answerable when evidence
// exists. This keeps both orders explicit and never mixes leaderboard scales: the
// caller supplies whichever single-source evidence is comparable.
/** @param {any[]} candidates @param {{sort?:'cost'|'evidence',evidence?:(model:any)=>any}} [options] */
export function rankCandidates(candidates,{sort='cost',evidence=()=>null}={}){
  const decorated=candidates.map(m=>({...m,evidence:evidence(m)}))
  const byCost=(a,b)=>a.monthly-b.monthly||a.id.localeCompare(b.id)
  if(sort!=='evidence')return decorated.sort(byCost)
  const score=m=>Number.isFinite(m.evidence?.score)?m.evidence.score:null
  return decorated.sort((a,b)=>{
    const left=score(a),right=score(b)
    if((left===null)!==(right===null))return left===null?1:-1
    if(left!==null&&left!==right)return right-left
    return byCost(a,b)
  })
}
export function costDifference(value, baseline) {
  if(value==null||baseline==null||![value,baseline].every(Number.isFinite))return null;
  return {delta:value-baseline,percent:baseline>0?(value-baseline)/baseline*100:null};
}
export function benchmarkCohort(records) {
  return records.filter(r=>r.test_cases===225&&r.edit_format==='diff'&&r.versions==='0.86.2.dev'&&Number.isFinite(r.pass_rate_2)&&r.pass_rate_2>=0&&r.pass_rate_2<=100)
    .map(r=>({id:r.dirname,name:r.model,date:r.date,score:r.pass_rate_2,cost:Number.isFinite(r.total_cost)&&r.total_cost>0?r.total_cost:null,format:r.edit_format,version:r.versions,cases:r.test_cases,command:r.command||''})).sort((a,b)=>b.score-a.score);
}
export function validIntelligence(s) {
  const str=v=>typeof v==='string',dt=v=>str(v)&&Number.isFinite(Date.parse(v));
  if(s?.aihot&&!validAihotData(s.aihot))return false;
  if(s?.rightsVersion!=null&&(s.rightsVersion!==1||!Array.isArray(s.articles)||!s.articles.every(validArticleRights)))return false;
  if(s?.rightsVersion===1&&(!Array.isArray(s.sources)||new Set(s.sources.map(x=>x.id)).size!==s.sources.length||
    s.sources.some(x=>x.count!==s.articles.filter(a=>a.sourceId===x.id).length)||
    s.articles.some(a=>Date.parse(a.publishedAt)>Date.parse(s.collectedAt)||a.provider!=='aihot'&&Date.parse(a.publishedAt)<Date.parse(s.collectedAt)-30*864e5||
      !s.sources.some(x=>x.id===a.sourceId&&x.rights?.licenseId===a.rights.licenseId&&x.rights?.scope===a.rights.scope))))return false;
  return s?.schemaVersion===1&&dt(s.collectedAt)&&Array.isArray(s.sources)&&s.sources.every(x=>str(x.id)&&str(x.name)&&['official','community','media'].includes(x.kind)&&str(x.family)&&canonicalUrl(x.url)&&['ok','stale','failed'].includes(x.status)&&Number.isInteger(x.count)&&x.count>=0&& (x.lastSuccessAt===null||dt(x.lastSuccessAt)))&&Array.isArray(s.articles)&&s.articles.every(a=>str(a.title)&&str(a.summary)&&dt(a.publishedAt)&&canonicalUrl(a.url)&&s.sources.some(x=>x.id===a.sourceId&&x.family===a.family&&x.kind===a.kind))&&(!s.benchmark||canonicalUrl(s.benchmark.source)&&dt(s.benchmark.collectedAt)&&Array.isArray(s.benchmark.rows)&&s.benchmark.rows.every(r=>str(r.id)&&str(r.name)&&dt(r.date)&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100&&(r.cost===null||Number.isFinite(r.cost)&&r.cost>0)&&r.format==='diff'&&r.version==='0.86.2.dev'&&r.cases===225));
}
