import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {parse as parseYaml} from 'yaml'
import {validPracticeResources,resourceId,resourcePopularity,validSkillPath,skillDocumentPath} from '../src/domain/practice-resources.mjs'
import {projectRelease} from './github-project-releases.mjs'
import {projectGuide} from './github-project-guides.mjs'
import {collectSkillTrending} from './collect-skill-trending.mjs'
const exec=promisify(execFile),read=async file=>{try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
const text=html=>html.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim()
export function parseTrending(html,period,now){
 const articles=html.match(/<article\b[^>]*class="[^"]*\bBox-row\b[^"]*"[\s\S]*?<\/article>/g)||[]
 if(!articles.length||articles.length>100)throw Error('TRENDING_STRUCTURE_CHANGED')
 const rows=articles.map((a,i)=>{const heading=a.match(/<h2\b[\s\S]*?<\/h2>/)?.[0]||'',slug=heading.match(/href="\/([\w.-]+\/[\w.-]+)"/)?.[1],gain=text(a).match(period==='daily'?/([\d,]+) stars today/:/([\d,]+) stars this week/);if(!slug||!gain)throw Error('TRENDING_FIELDS_CHANGED');return {repo:slug,period,rank:i+1,gain:Number(gain[1].replace(/,/g,'')),observedAt:now}})
 if(new Set(rows.map(r=>r.repo.toLowerCase())).size!==rows.length)throw Error('TRENDING_DUPLICATE')
 return rows
}
export function skillFrontmatter(raw){
 const block=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
 if(!block)throw Error('SKILL_FRONTMATTER_MISSING')
 const d=parseYaml(block)
 if(typeof d?.name!=='string'||!/^[\w.-]+$/.test(d.name)||typeof d.description!=='string'||!d.description.trim())throw Error('SKILL_FRONTMATTER_INVALID')
 return d
}
export function projectDescription(entry,meta,editorial=[]){const annotation=editorial.find(a=>a.githubId===meta.id&&a.sourceHash===createHash('sha256').update(meta.description||'').digest('hex'));return entry.description||annotation?.description||meta.description||meta.full_name}
export function isAiProject(meta){return /(?:\bai\b|\bllm\b|\bagent\b|\bagents\b|\bmcp\b|\bmachine.learning\b|\bdiffusion\b|\blanguage.models?\b|\bartificial.intelligence\b|claude|chatgpt|人工智能|大模型)/i.test([meta.description,...(meta.topics||[])].join(' '))}
export function createResourceClient({cli=false,fetcher=fetch,token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 return {async api(path){
  if(cli){try{const {stdout}=await exec('gh',['api',path],{maxBuffer:6e6,timeout:25000});return JSON.parse(stdout)}catch(e){const code=String(e.stderr||'').match(/HTTP (\d{3})/)?.[1];throw Error(['403','429'].includes(code)?'GITHUB_RATE_LIMIT':code?`GITHUB_HTTP_${code}`:'GITHUB_UNAVAILABLE')}}
  for(let attempt=0;attempt<3;attempt++){try{const r=await fetcher('https://api.github.com/'+path,{headers:{Accept:'application/vnd.github+json','User-Agent':'Mojing-Practice-Collector',...(token?{Authorization:`Bearer ${token}`}:{})},signal:AbortSignal.timeout(20000)});if(!r.ok){if([403,429].includes(r.status))throw Error('GITHUB_RATE_LIMIT');if(r.status>=500&&attempt<2){await wait(1000*(attempt+1));continue}throw Error('GITHUB_HTTP_'+r.status)}return await r.json()}catch(e){if(attempt===2||/GITHUB_/.test(e.message))throw e;await wait(1000*(attempt+1))}}
 },async trending(period){const r=await fetcher('https://github.com/trending?since='+period,{headers:{'User-Agent':'Mozilla/5.0 Mojing-Practice-Collector'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('TRENDING_HTTP_'+r.status);return r.text()},async skillTrending(url){
  if(!/^https:\/\/(?:www\.)?skills\.sh\/(?:trending|api\/skills\/trending\/0|[\w.-]+\/[\w.-]+\/[\w.-]+)$/.test(url))throw Error('SKILL_SOURCE_URL_INVALID')
  for(let attempt=0;attempt<2;attempt++){try{const r=await fetcher(url.replace('https://skills.sh/','https://www.skills.sh/'),{headers:{'User-Agent':'Mozilla/5.0 Mojing-Practice-Collector',Accept:url.includes('/api/')?'application/json':'text/html'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('SKILL_HTTP_'+r.status);const body=await r.text();if(body.length>6000000)throw Error('SKILL_BODY_TOO_LARGE');return body}catch(e){if(attempt===1)throw e;await wait(1000*(attempt+1))}}
 }}
}
export async function collectPracticeResources({root='.',client=createResourceClient(),now=new Date().toISOString(),registry,previous,guides,onlySkills=false}={}){
 guides??=await read(`${root}/scripts/config/github-project-guides.json`)||[]
 const editorial=await read(`${root}/scripts/config/practice-resources-editorial.json`)||[]
 const skillEditorial=await read(`${root}/scripts/config/skill-trending-editorial.json`)||[]
 registry??=await read(`${root}/scripts/config/practice-resources.json`);previous??=await read(`${root}/src/practice-resources/resources.json`)
 const skillTrendingTask=!onlySkills&&client.skillTrending?collectSkillTrending({load:url=>client.skillTrending(url),previous:previous?.skillTrends||[],now,trackedSkills:registry.skills.map(s=>({repo:s.repo,name:s.trendName||s.path.split('/').pop()})),editorial:skillEditorial}):null
 const sources=[],skills=[],projects=[],metadata=new Map(),revisions=new Map(),oldSkills=previous?.skills||[],oldProjects=previous?.projects||[]
 const meta=async slug=>{if(!metadata.has(slug))metadata.set(slug,client.api('repos/'+slug));return metadata.get(slug)}
 const record=(id,status,observedAt,code)=>sources.push({id,status,checkedAt:now,...(observedAt?{observedAt}:{}),...(code?{code}: {})})
 const failCode=e=>/RATE_LIMIT/.test(e.message)?'RATE_LIMIT':/STRUCTURE|FIELDS|FRONTMATTER/.test(e.message)?'SOURCE_CHANGED':'UNAVAILABLE'
 for(const entry of registry.skills){const key='skill:'+entry.repo+'/'+entry.path,before=oldSkills.find(s=>s.repo.toLowerCase()===entry.repo.toLowerCase()&&s.path===entry.path)
  try{
   if(!validSkillPath(entry.path))throw Error('SKILL_PATH_INVALID')
   const m=await meta(entry.repo);if(m.archived||m.disabled)throw Error('REPOSITORY_ARCHIVED')
   if(!revisions.has(entry.repo))revisions.set(entry.repo,await client.api(`repos/${entry.repo}/commits/${encodeURIComponent(m.default_branch)}`))
   const revision=revisions.get(entry.repo).sha
   let d
   if(before?.revision===revision)d={name:before.name,description:before.originalDescription,license:before.license}
   else{const file=await client.api(`repos/${entry.repo}/contents/${skillDocumentPath(entry.path)}?ref=${revision}`);d=skillFrontmatter(Buffer.from(file.content,'base64').toString('utf8'))}
   const path=entry.path,repo=m.full_name
   const matched=entry.detailSourceHash===createHash('sha256').update(d.description).digest('hex'),introduction=matched?entry.introduction:undefined
   const details=matched?Object.fromEntries(['requirements','cost','compatibility'].filter(k=>typeof entry[k]==='string').map(k=>[k,entry[k]])):{}
   skills.push({id:resourceId('skill',`${repo}/${path}`),kind:'skill',repo,path,title:entry.title,description:entry.description,...(introduction?{introduction}:{}),example:entry.example,category:entry.category,name:d.name,originalDescription:d.description,revision,license:String(d.license||'作者未单独注明，请查阅技能目录许可'),compatibility:repo.toLowerCase()==='anthropics/skills'?'作者面向 Claude 提供；其他工具需自行确认':'Agent Skills 格式；各工具兼容性需确认',requirements:'需要支持技能的 AI 编程工具；具体依赖见原始说明。',cost:'技能使用条件以目录许可为准；模型、API 或外部服务可能另行收费。',install:`npx skills add ${repo} --skill ${d.name}`,url:`https://github.com/${repo}/blob/${revision}/${skillDocumentPath(path)}`,repoUrl:`https://github.com/${repo}`,observedAt:now,checkedAt:now,sourceUpdatedAt:m.pushed_at,featured:true,...details,...(entry.aliases?{aliases:entry.aliases}:{})})
   record(key,'ok',now)
  }catch(e){if(before)skills.push({...before,checkedAt:now});record(key,before?'stale':'error',before?.observedAt,failCode(e))}
 }
 if(onlySkills){
  for(const skill of skills){const before=oldSkills.find(s=>s.id===skill.id),metric=resourcePopularity(before||{},Date.parse(now));delete skill.popularity;if(metric)skill.popularity={...metric}}
  const data={...previous,schemaVersion:1,checkedAt:now,skills,sources:[...(previous?.sources||[]).filter(s=>!s.id.startsWith('skill:')), ...sources]}
  if(!skills.length||!validPracticeResources(data))throw Error('RESOURCE_FEED_INVALID')
  return data
 }
 const trendings=[]
 for(const period of ['daily','weekly']){try{const rows=parseTrending(await client.trending(period),period,now);trendings.push(...rows);record('trending:'+period,'ok',now)}catch(e){const source=previous?.sources?.find(s=>s.id==='trending:'+period);for(const p of oldProjects)for(const t of p.trending||[])if(t.period===period)trendings.push({...t,repo:p.repo});record('trending:'+period,source?.observedAt?'stale':'error',source?.observedAt,failCode(e))}}
 const candidates=new Map(registry.projects.map(p=>[p.repo.toLowerCase(),p]))
 for(const t of trendings)if(!candidates.has(t.repo.toLowerCase()))candidates.set(t.repo.toLowerCase(),{repo:t.repo})
 for(const entry of candidates.values()){
  const key='repo:'+entry.repo.toLowerCase(),before=oldProjects.find(p=>p.repo.toLowerCase()===entry.repo.toLowerCase())
  try{const m=await meta(entry.repo);if(!m.id||m.archived||m.disabled||m.fork||(!entry.description&&!isAiProject(m)))continue
   const trending=trendings.filter(t=>t.repo.toLowerCase()===entry.repo.toLowerCase()).map(({repo,...t})=>t)
   const [guide,release]=await Promise.all([projectGuide(m,before,guides,path=>client.api(path),now),projectRelease(m,before,path=>client.api(path),now)])
   projects.push({...(guide?{guide}:{}),release,id:resourceId('github',String(m.id)),kind:'github',githubId:m.id,repo:m.full_name,title:m.name,description:projectDescription(entry,m,editorial),originalDescription:m.description||'',category:guide?guides.find(g=>g.githubId===m.id).category:entry.category||'AI 开源',language:m.language||'',license:m.license?.spdx_id&&m.license.spdx_id!=='NOASSERTION'?m.license.spdx_id:'请查阅仓库许可',stars:m.stargazers_count,forks:m.forks_count,archived:m.archived,pushedAt:m.pushed_at,createdAt:m.created_at,url:m.html_url,repoUrl:m.html_url,readmeUrl:m.html_url+'#readme',trending,featured:!!entry.description,observedAt:now,checkedAt:now})
   record(key,'ok',now)
  }catch(e){if(before)projects.push({...before,trending:trendings.filter(t=>t.repo.toLowerCase()===before.repo.toLowerCase()).map(({repo,...t})=>t),checkedAt:now});record(key,before?'stale':'error',before?.observedAt,failCode(e))}
 }
 let skillTrends=previous?.skillTrends||[]
 if(skillTrendingTask){const result=await skillTrendingTask;skillTrends=result.rows;sources.push(result.source)
  for(const skill of skills){
   const spec=registry.skills.find(s=>s.repo.toLowerCase()===skill.repo.toLowerCase()&&s.path===skill.path),name=spec?.trendName||skill.name
   const exact=r=>r.repo.toLowerCase()===skill.repo.toLowerCase()&&r.name===name
   // A successful list is authoritative, including absence. On list failure,
   // use a recent exact match from the retained trend feed or previous curated record.
   let metric=result.tracked.find(exact)
   if(!metric&&['UNAVAILABLE','SOURCE_CHANGED','TIMEOUT','RATE_LIMIT'].includes(result.source.code)){
    const retained=result.rows.find(exact),before=oldSkills.find(r=>r.id===skill.id)
    metric=resourcePopularity(retained||{},Date.parse(now))||resourcePopularity(before||{},Date.parse(now))
   }
   const total=result.rows.find(exact)?.totalInstalls||oldSkills.find(r=>r.id===skill.id)?.totalInstalls
   if(total)skill.totalInstalls=total
   if(metric)skill.popularity={period:'24h',rank:metric.rank,installs:metric.installs,observedAt:metric.observedAt};else delete skill.popularity
  }
  skillTrends=skillTrends.map(row=>{const a=skillEditorial.find(a=>a.repo.toLowerCase()===row.repo.toLowerCase()&&a.name===row.name&&a.sourceHash===row.sourceHash);return a?{...row,title:a.title,description:a.description,category:a.category,...Object.fromEntries(['introduction','example','requirements','cost'].filter(k=>typeof a[k]==='string').map(k=>[k,a[k]]))}:row})
 }
 else if(skillTrends.length){const source=previous.sources.find(s=>s.id==='skills-trending:24h');if(source)sources.push({...source,status:'stale',checkedAt:now})}
 const data={schemaVersion:1,checkedAt:now,skills,projects,sources,...(client.skillTrending||skillTrends.length?{skillTrends}:{})}
 if(!skills.length||!projects.length||!validPracticeResources(data))throw Error('RESOURCE_FEED_INVALID')
 return data
}
const PRACTICE_LISTS=['skills-trending:24h','trending:daily','trending:weekly']
export function practiceResourcesDue(previous,{now=Date.now(),expectedSkills=0}={}){
 if(!previous?.skills||previous.skills.length<expectedSkills)return true
 return PRACTICE_LISTS.some(id=>{
  const source=previous.sources?.find(entry=>entry.id===id)
  if(!source)return true
  const last=Date.parse(source.checkedAt)
  const delay=source.status==='ok'?6*3600000:source.code==='RATE_LIMIT'?2*3600000:3600000
  return !Number.isFinite(last)||now-last>=delay
 })
}
export async function writePracticeResources(root,data){
 if(!validPracticeResources(data))throw Error('RESOURCE_FEED_INVALID')
 for(const file of ['src/practice-resources/resources.json','public/radar/practice-resources.json']){const path=`${root}/${file}`;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path+'.next',JSON.stringify(data)+'\n');await rename(path+'.next',path)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const previous=await read('./src/practice-resources/resources.json');const fresh=process.argv.includes('--if-stale')&&validPracticeResources(previous)&&Date.now()-Date.parse(previous.checkedAt)<(previous.sources.some(s=>s.status!=='ok')||previous.projects.some(p=>p.release?.retained||p.release?.status==='unavailable'||p.guide?.retained)?30*60000:6*3600000);const data=fresh?previous:await collectPracticeResources({client:createResourceClient({cli:process.argv.includes('--github-cli')}),previous,onlySkills:process.argv.includes('--skills-only')});await writePracticeResources('.',data);console.log(`实战资源：${data.skills.length} Skills，${data.projects.length} 项目，${data.sources.filter(s=>s.status!=='ok').length} 个来源保留旧数据或暂不可用`)}
