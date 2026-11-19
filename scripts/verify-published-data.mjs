import {readFile,writeFile,appendFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {PUBLIC_CORE_FILES,readPublicPayloads,validatePublicPayloads} from './validate-public-data.mjs'

export async function verifyPublishedData({expected,baseUrl='https://pursuerlin.github.io/miniapp-ai-radar-data/radar/',fetcher=fetch,maxAttempts=36,delayMs=5000,maxDurationMs=180000,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now()}={}){
 validatePublicPayloads(expected)
 const files=[...PUBLIC_CORE_FILES,...['changes.json','catalog-baseline.json'].filter(name=>expected[name]),...(expected['practice-resources.json']?['practice-resources.json']:[]),...(expected['manifest.json'].datasets.media?['media-leaderboards.json']:[]),...(expected['manifest.json'].datasets.research?['model-evidence.json']:[])]
 const endpoint=new URL(baseUrl);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error('PUBLIC_VERIFY_URL_INVALID')
 let lastCode='PUBLIC_VERIFY_PENDING',attempts=0
 const deadline=now()+maxDurationMs
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  if(now()>deadline)break
  attempts=attempt
  try{
   const live=Object.fromEntries(await Promise.all(files.map(async name=>{
    const url=new URL(name,endpoint);url.searchParams.set('verify',String(now()))
    const response=await fetcher(url.href,{signal:AbortSignal.timeout(10000),cache:'no-store'})
    if(!response.ok)throw Error(`PUBLIC_HTTP_${response.status}`)
    return [name,await response.json()]
   })))
   validatePublicPayloads(live)
   if(!files.every(name=>isDeepStrictEqual(live[name],expected[name])))throw Error('PUBLIC_CONTENT_PENDING')
   return {ok:true,state:'verified',verifiedAt:new Date(now()).toISOString(),generatedAt:live['manifest.json'].generatedAt,attempts:attempt,
    files:files.map(name=>({name,url:new URL(name,endpoint).href,sha256:createHash('sha256').update(JSON.stringify(live[name])).digest('hex')}))}
  }catch(error){lastCode=/^PUBLIC_[A-Z0-9_]+$/.test(error.message)?error.message:'PUBLIC_REQUEST_FAILED'}
  if(attempt<maxAttempts)await wait(delayMs)
 }
 return {ok:false,state:'unverified',checkedAt:new Date(now()).toISOString(),generatedAt:expected['manifest.json'].generatedAt,attempts,errorCode:lastCode}
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const expected=await readPublicPayloads(resolve('public/radar'))
 const report=await verifyPublishedData({expected})
 await writeFile('.publication-verification.json',JSON.stringify(report,null,2)+'\n')
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`\n## 公开文件核验\n\n${report.ok?'已核实本轮公开文件及其内容一致性':'尚未核实本轮公开文件：'+report.errorCode}。此结果不代表手机已应用。\n`)
 console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1
}
