import {validChanges} from '../src/domain/changes.mjs'
import {validPracticeResources} from '../src/domain/practice-resources.mjs'
import {validModelEvidence} from '../src/domain/model-evidence.mjs'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {validMediaSnapshot} from '../src/domain/media-leaderboards.mjs'
import {validSnapshot} from '../src/domain/snapshot.mjs'
import {validIntelligence} from '../src/domain/intelligence.mjs'
import {validBenchmark,validEvaluations} from '../src/domain/online-data.mjs'
import {validManifest,firstManifestTimeMismatch,DATASET_KEYS} from '../src/domain/manifest.mjs'
import {assertBenchmarkMatchesArchive} from './validate-aa-archive.mjs'

export const PUBLIC_CORE_FILES=['manifest.json','snapshot.json','latest-benchmark.json','evaluation-leaderboards.json','intelligence.json','briefings.json','health.json']
export function validatePublicPayloads(payloads){
 const [manifest,snapshot,benchmark,evaluation,intelligence,briefings,health]=PUBLIC_CORE_FILES.map(name=>payloads[name])
 if(!validManifest(manifest)||!validSnapshot(snapshot)||!validBenchmark(benchmark)||!validEvaluations(evaluation)||!validIntelligence(intelligence))throw Error('PUBLIC_PAYLOAD_INVALID')
 if(!isDeepStrictEqual(snapshot.onlineData?.manifest,manifest)||!isDeepStrictEqual(snapshot.onlineData?.benchmark,benchmark)||!isDeepStrictEqual(snapshot.onlineData?.evaluations,evaluation))throw Error('PUBLIC_SNAPSHOT_MISMATCH')
 if(firstManifestTimeMismatch(manifest,{snapshot,intelligence,benchmark,evaluation,briefings}))throw Error('PUBLIC_COLLECTION_TIME_MISMATCH')
 if(manifest.datasets.media){const media=payloads['media-leaderboards.json'];if(!validMediaSnapshot(media)||media.collectedAt!==manifest.datasets.media.collectedAt)throw Error('PUBLIC_MEDIA_INVALID')}
 if(manifest.datasets.research){const research=payloads['model-evidence.json'];if(!validModelEvidence(research)||research.collectedAt!==manifest.datasets.research.collectedAt)throw Error('PUBLIC_RESEARCH_INVALID')}
 if(!health?.readable||health.generatedAt!==manifest.generatedAt||!isDeepStrictEqual(health.collection,manifest.collection))throw Error('PUBLIC_HEALTH_MISMATCH')
 if(!Array.isArray(health.datasets)||health.datasets.length!==DATASET_KEYS.length+(manifest.datasets.media?1:0)+(manifest.datasets.research?1:0)||[...DATASET_KEYS,...(manifest.datasets.media?['media']:[]),...(manifest.datasets.research?['research']:[])].some(id=>{const item=health.datasets.find(d=>d.id===id);return !item||item.status!==manifest.datasets[id].status||item.collectedAt!==manifest.datasets[id].collectedAt}))throw Error('PUBLIC_HEALTH_DATASETS_MISMATCH')
 if([manifest.generatedAt,snapshot.collectedAt,benchmark.collectedAt,evaluation.collectedAt,intelligence.collectedAt].some(t=>Date.parse(t)>Date.now()+300000))throw Error('PUBLIC_FUTURE_TIMESTAMP')
 if(payloads['practice-resources.json']&&!validPracticeResources(payloads['practice-resources.json']))throw Error('PUBLIC_RESOURCES_INVALID')
 if(!isDeepStrictEqual(health.sourceHealth,manifest.sourceHealth))throw Error('PUBLIC_SOURCE_HEALTH_MISMATCH')
 if(payloads['changes.json']&&!validChanges(payloads['changes.json']))throw Error('PUBLIC_CHANGES_INVALID')
 const baseline=payloads['catalog-baseline.json'];if(baseline&&(!Number.isFinite(Date.parse(baseline.collectedAt))||!Array.isArray(baseline.models)))throw Error('PUBLIC_CHANGE_BASELINE_INVALID')
 return {ok:true,generatedAt:manifest.generatedAt,sourceStates:Object.fromEntries(Object.entries(manifest.sourceHealth||{}).map(([id,s])=>[id,s.status]))}
}
export async function readPublicPayloads(dir){const payloads=Object.fromEntries(await Promise.all(PUBLIC_CORE_FILES.map(async name=>[name,JSON.parse(await readFile(resolve(dir,name),'utf8'))])));if(payloads['manifest.json'].datasets.media)payloads['media-leaderboards.json']=JSON.parse(await readFile(resolve(dir,'media-leaderboards.json'),'utf8'));if(payloads['manifest.json'].datasets.research)payloads['model-evidence.json']=JSON.parse(await readFile(resolve(dir,'model-evidence.json'),'utf8'));for(const name of ['changes.json','catalog-baseline.json']){try{payloads[name]=JSON.parse(await readFile(resolve(dir,name),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}}try{payloads['practice-resources.json']=JSON.parse(await readFile(resolve(dir,'practice-resources.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}return payloads}
export async function validateCandidate({root=process.cwd()}={}){
 const payloads=await readPublicPayloads(resolve(root,'public/radar')),report=validatePublicPayloads(payloads)
 const benchmark=payloads['latest-benchmark.json']
 const html=await readFile(resolve(root,'docs/accuracy-audit/raw',benchmark.performanceVersion==='v3'?'aa-current-v3.html':'aa-current.html'),'utf8')
 assertBenchmarkMatchesArchive(benchmark,html)
 return {...report,checkedAt:new Date().toISOString(),aaArchiveVerified:true}
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)validateCandidate().then(async report=>{await writeFile('.candidate-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))}).catch(error=>{console.error(error.message);process.exitCode=1})
