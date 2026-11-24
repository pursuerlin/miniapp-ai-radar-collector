import {readFile,writeFile,appendFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {PUBLIC_CORE_FILES,readPublicPayloads,validatePublicPayloads} from './validate-public-data.mjs'

// Pages can reach a terminal failure while the CDN still serves the last good snapshot.
export async function failedPagesRun(sha, {fetcher=fetch,token=process.env.GH_TOKEN}={}) {
 if(!/^[a-f0-9]{40}$/.test(sha||''))return null
 const repository='https://api.github.com/repos/pursuerlin/miniapp-ai-radar-data'
 const get=async path=>{
  const response=await fetcher(repository+path,{
   cache:'no-store',signal:AbortSignal.timeout(5000),
   headers:{Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{})},
  })
  return response.ok?response.json():null
 }
 try{
  const result=await get('/actions/workflows/pages.yml/runs?head_sha='+sha+'&per_page=1')
  const run=result?.workflow_runs?.[0]
  if(run?.head_sha!==sha||run.status!=='completed'||run.conclusion!=='failure'||!Number.isSafeInteger(run.id)||run.id<=0)return null
  const head=await get('/git/ref/heads/master')
  if(head?.object?.sha!==sha)return null
  return 'https://github.com/pursuerlin/miniapp-ai-radar-data/actions/runs/'+run.id
 }catch{return null}
}

export async function verifyPublishedData({
 expected, baseUrl='https://pursuerlin.github.io/miniapp-ai-radar-data/radar/',
 fetcher=fetch, maxAttempts=90, delayMs, maxDurationMs=25*60_000,
 wait=ms=>new Promise(r=>setTimeout(r,ms)), now=()=>Date.now(), checkPagesFailure,
}={}){
 validatePublicPayloads(expected)
 const files=[...PUBLIC_CORE_FILES,...['changes.json','catalog-baseline.json'].filter(name=>expected[name]),...(expected['practice-resources.json']?['practice-resources.json']:[]),...(expected['manifest.json'].datasets.media?['media-leaderboards.json']:[]),...(expected['manifest.json'].datasets.research?['model-evidence.json']:[])]
 const endpoint=new URL(baseUrl);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error('PUBLIC_VERIFY_URL_INVALID')
 const generatedAt=expected['manifest.json'].generatedAt
 const deadline=now()+maxDurationMs
 let lastCode='PUBLIC_VERIFY_PENDING',attempts=0
 let observedGeneratedAt=null,pendingFiles=[],deploymentRun=null,nextPagesCheck=0
 for(let attempt=1;attempt<=maxAttempts&&now()<deadline;attempt++){
  attempts=attempt
  const stamp=now()
  const load=async name=>{
   const url=new URL(name,endpoint)
   url.searchParams.set('verify',String(stamp))
   const response=await fetcher(url.href,{signal:AbortSignal.timeout(Math.max(1,Math.min(10_000,deadline-now()))),cache:'no-store'})
   if(!response.ok)throw Error(`PUBLIC_HTTP_${response.status}`)
   return [name,await response.json()]
  }
  try{
   pendingFiles=['manifest.json']
   const manifest=await load('manifest.json')
   observedGeneratedAt=Number.isFinite(Date.parse(manifest[1]?.generatedAt))?manifest[1].generatedAt:null
   if(!isDeepStrictEqual(manifest[1],expected['manifest.json']))throw Error('PUBLIC_CONTENT_PENDING')
   const results=await Promise.allSettled(files.filter(name=>name!=='manifest.json').map(load))
   const missing=results.find(result=>result.status==='rejected')
   if(missing){
    pendingFiles=files.filter(name=>name!=='manifest.json').filter((_,index)=>results[index].status==='rejected')
    throw missing.reason
   }
   const live=Object.fromEntries([manifest,...results.map(result=>result.value)])
   pendingFiles=files.filter(name=>!isDeepStrictEqual(live[name],expected[name]))
   validatePublicPayloads(live)
   if(pendingFiles.length)throw Error('PUBLIC_CONTENT_PENDING')
   return {ok:true,state:'verified',verifiedAt:new Date(now()).toISOString(),generatedAt,attempts,
    files:files.map(name=>({name,url:new URL(name,endpoint).href,sha256:createHash('sha256').update(JSON.stringify(live[name])).digest('hex')}))}
  }catch(error){lastCode=/^PUBLIC_[A-Z0-9_]+$/.test(error.message)?error.message:'PUBLIC_REQUEST_FAILED'}
  if(checkPagesFailure&&now()>=nextPagesCheck){
   nextPagesCheck=now()+30_000
   deploymentRun=await checkPagesFailure()
   if(deploymentRun){lastCode='PUBLIC_PAGES_DEPLOYMENT_FAILED';break}
  }
  const remaining=deadline-now()
  if(attempt<maxAttempts&&remaining>0)await wait(Math.min(remaining,delayMs??(attempt<=6?5000:20000)))
 }
 return {ok:false,state:'unverified',checkedAt:new Date(now()).toISOString(),generatedAt,attempts,errorCode:lastCode,observedGeneratedAt,pendingFiles,...(deploymentRun?{deploymentRun}:{})}
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const expected=await readPublicPayloads(resolve('public/radar'))
 const sha=process.env.PUBLIC_DATA_SHA
 const report=await verifyPublishedData({expected,checkPagesFailure:sha?()=>failedPagesRun(sha):undefined})
 await writeFile('.publication-verification.json',JSON.stringify(report,null,2)+'\n')
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`\n## 公开文件核验\n\n${report.ok?'已核实本轮公开文件及其内容一致性':'尚未核实本轮公开文件：'+report.errorCode}。此结果不代表手机已应用。\n${report.deploymentRun?`\n[查看 Pages 部署失败记录](${report.deploymentRun})\n`: ''}`)
 console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1
}
