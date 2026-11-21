import {isPublicSnapshotHealthy} from './check-collection-health.mjs'
import {validModelEvidence} from '../src/domain/model-evidence.mjs'
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises'
import {validRadarFile} from '../src/domain/radar-cache.mjs'
import {validMediaSnapshot} from '../src/domain/media-leaderboards.mjs'
import {validSnapshot} from '../src/domain/snapshot.mjs'
import {validAihotData} from '../src/domain/aihot.mjs'
import {validIntelligence} from '../src/domain/intelligence.mjs'
import {datasetSummary,firstManifestTimeMismatch} from '../src/domain/manifest.mjs'

const files=['media-leaderboards.json','snapshot.json','intelligence.json','briefings.json','latest-benchmark.json','evaluation-leaderboards.json','manifest.json']
const payloads=Object.fromEntries(await Promise.all(files.map(async file=>[file,JSON.parse(await readFile(`src/data/${file}`,'utf8'))])))
const snapshot=payloads['snapshot.json'],intelligence=payloads['intelligence.json'],briefings=payloads['briefings.json'],manifest=payloads['manifest.json'],benchmark=payloads['latest-benchmark.json'],evaluation=payloads['evaluation-leaderboards.json']
const media=payloads['media-leaderboards.json']
try{const research=JSON.parse(await readFile('src/data/model-evidence.json','utf8'));if(!validModelEvidence(research)||manifest.datasets.research?.collectedAt!==research.collectedAt||manifest.datasets.research?.checkedAt!==research.checkedAt)throw Error('PUBLIC_RESEARCH_INVALID');payloads['model-evidence.json']=research;files.push('model-evidence.json')}catch(error){if(error.code!=='ENOENT')throw error}

if(!validMediaSnapshot(media)||manifest.datasets.media&&manifest.datasets.media.collectedAt!==media.collectedAt)throw Error('媒体榜数据或清单时间无效')
// Validate before overwriting any public artifact. A new collector cannot accidentally publish a legacy unreviewed cache.
if(intelligence.rightsVersion!==1||!validIntelligence(intelligence))throw Error('资讯缺少有效来源使用范围，不得发布')
if(snapshot.intelligence?.collectedAt!==intelligence.collectedAt||JSON.stringify(snapshot.intelligence)!==JSON.stringify(intelligence))throw Error('模型包内资讯与独立资讯不一致，请先运行 collect')
if(briefings.collectedAt!==intelligence.collectedAt||[...briefings.daily,...briefings.weekly].some(report=>report.items.some(event=>event.articles.some(article=>!intelligence.articles.some(a=>JSON.stringify(a)===JSON.stringify(article)) && !(report.provider==='aihot'&&validAihotData({...intelligence.aihot,daily:report.kind==='daily'?[report]:[],weekly:report.kind==='weekly'?[report]:[]}))))))throw Error('简报与资讯快照不一致，不得发布')
const staleDataset=firstManifestTimeMismatch(manifest,{snapshot,intelligence,benchmark,evaluation,briefings})
if(staleDataset)throw Error(`数据清单 ${staleDataset} 时间与实际数据不一致，请重新生成 manifest`)
snapshot.onlineData={manifest,benchmark,evaluations:evaluation}
if(!validSnapshot(snapshot))throw Error('公开数据包校验失败，不得发布')
await mkdir('public/radar',{recursive:true})
for(const file of await readdir('public/radar'))if(file.startsWith('radar-')&&file.endsWith('.json')&&!validRadarFile(file,JSON.parse(await readFile('public/radar/'+file,'utf8'))))throw Error('栏目数据校验失败：'+file)
payloads['snapshot.json']={...snapshot,schemaVersion:2}
delete payloads['snapshot.json'].intelligence
if(!validSnapshot(payloads['snapshot.json']))throw Error('独立模型数据包校验失败')
for(const file of files)await writeFile(`public/radar/${file}`,JSON.stringify(payloads[file])+'\n')
await writeFile('public/radar/attribution.json',JSON.stringify({schemaVersion:1,generatedAt:intelligence.collectedAt,
  notice:'AIHOT 摘要与报告按模境书面授权展示与分发；授权不向下游授予第三方原文权利。模型及评测数据另按其来源条款。' ,
  provider:intelligence.aihot?{name:'AIHOT',url:'https://aihot.news',permissionId:'aihot-mojing-written-2026-11-04',scope:'本产品展示、商业使用与公开JSON分发；不授予第三方原文权利'}:null,
  sources:intelligence.sources.map(s=>({id:s.id,name:s.name,url:s.url,rights:s.rights})),
  articles:intelligence.articles.filter(a=>a.contentMode==='licensed-summary').map(a=>({url:a.url,title:a.title,rights:a.rights}))})+'\n')
const datasets=datasetSummary(manifest)
const newsHealth={collectedAt:intelligence.collectedAt,
  connected:intelligence.sources.filter(s=>s.status==='ok').length,total:intelligence.sources.length,
  partial:!!intelligence.aihot?.partial||intelligence.sources.some(s=>s.status!=='ok'),articles:intelligence.articles.length,
  sources:intelligence.sources.map(({id,name,status,count,checkedAt,lastSuccessAt,latestPublishedAt,freshness,errorCode,lastError,attempts})=>({id,name,status,count,checkedAt,lastSuccessAt,latestPublishedAt,freshness,errorCode,lastError,attempts}))}
const healthy=isPublicSnapshotHealthy({datasets,sourceHealth:manifest.sourceHealth,intelligence:newsHealth})
await writeFile('public/radar/health.json',JSON.stringify({ok:healthy,readable:true,status:healthy?'healthy':'degraded',generatedAt:manifest.generatedAt,collection:manifest.collection,sourceHealth:manifest.sourceHealth,datasets,intelligence:newsHealth})+'\n')
console.log(`已校验并打包公开数据与逐条归属信息到 public/radar/`)
