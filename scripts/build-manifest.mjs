import { readFile, writeFile, rename } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import {buildSourceHealth} from './collection-state.mjs'

const files = {
  catalog: 'src/data/snapshot.json',
  usage: 'src/data/snapshot.json',
  intelligence: 'src/data/intelligence.json',
  evaluation: 'src/data/evaluation-leaderboards.json',
  briefings: 'src/data/briefings.json'
}

const sourceLabels = {
  catalog: ['模型目录与报价', 'OpenRouter models API'],
  usage: ['Token 用量周榜', 'OpenRouter rankings'],
  intelligence: ['AI 资讯', 'RSS / 官方更新 / arXiv / HN API'],
  evaluation: ['能力评测', 'Artificial Analysis / LiveBench'],
  briefings: ['每日与每周简报', '本地结构化简报']
}

const read = async file => JSON.parse(await readFile(file, 'utf8'))
const iso = value => new Date(value).toISOString()

export function buildManifest({snapshot,intelligence,benchmark,evaluation,briefings,media,research,collection,previousManifest}, now = new Date().toISOString()) {
  const datasets = {}
  for (const id of Object.keys(files)) {
    const data = id === 'catalog' || id === 'usage' ? snapshot : id === 'intelligence' ? intelligence : id === 'evaluation' ? evaluation : briefings
    // A combined label must never let a fresh source hide an older source.
    const collectedAt = id === 'evaluation' ? [benchmark.collectedAt,evaluation.collectedAt].sort((a,b)=>Date.parse(a)-Date.parse(b))[0] : data.collectedAt
    const partial = (id === 'intelligence' || id === 'briefings') && (intelligence.sources.some(s => s.status !== 'ok')||intelligence.aihot?.partial)
    let status = partial ? 'partial' : 'ok'
    const task=collection?.tasks?.[id==='usage'?'catalog':id==='briefings'?'intelligence':id]
    // A news-only run must preserve prior failures and last-check times.
    if(task?.status==='skipped'&&previousManifest?.datasets?.[id]){datasets[id]=structuredClone(previousManifest.datasets[id]);continue}
    if(id==='evaluation'&&collection?.tasks?.aa?.status==='skipped'&&collection?.tasks?.livebench?.status==='skipped'&&previousManifest?.datasets?.evaluation){datasets[id]=structuredClone(previousManifest.datasets.evaluation);continue}
    if(task?.status==='stale')status='stale'
    datasets[id] = { label: sourceLabels[id][0], collectedAt: iso(collectedAt), status, source: intelligence.aihot && ['intelligence','briefings'].includes(id)?'AIHOT /api/v1（授权导读与报告）':sourceLabels[id][1], ...(task?{checkedAt:task.checkedAt}:{}) }
    if(id==='evaluation'){
      const sources=[['artificial-analysis','aa',benchmark],['livebench','livebench',evaluation]].map(([sourceId,key,payload])=>{
        const result=collection?.tasks?.[key]
        const prior=previousManifest?.datasets?.evaluation?.sources?.find(s=>s.id===sourceId)
        return {id:sourceId,collectedAt:payload.collectedAt,...(result?.status==='skipped'?(prior||{status:previousManifest?.datasets?.evaluation?.status==='stale'?'stale':'ok'}):result||{status:'ok'})}
      })
      const failures=sources.filter(s=>s.status==='stale').length
      datasets[id].status=failures===2?'stale':failures?'partial':'ok'
      datasets[id].sources=sources
    }
  }
  if(media)datasets.media={label:'生图与视频质量榜',collectedAt:media.collectedAt,source:'Artificial Analysis Data API',status:collection?.tasks?.media?.status==='stale'||media.errors?.length?'stale':'ok'}
  if(research)datasets.research={label:'AIHOT 模型评测',collectedAt:research.collectedAt,checkedAt:research.checkedAt,source:'AIHOT 官方 Markdown',status:research.status==='stale'?'stale':research.errors.length?'partial':'ok'}
  const sourceHealth=buildSourceHealth({tasks:collection?.tasks,previousManifest,payloads:{catalog:snapshot,intelligence,aa:benchmark,livebench:evaluation,media,research}})
  return { schemaVersion: 1, generatedAt: now, datasets,sourceHealth, ...(collection?{collection:{profile:collection.profile||'all',trigger:collection.trigger||'local',checkedAt:now,tasks:collection.tasks,...(collection.editorial?{editorial:collection.editorial}:{})}}:{}) }
}

async function main() {
  const [snapshot, intelligence, benchmark, evaluation, briefings] = await Promise.all([
    read(files.catalog), read(files.intelligence), read('src/data/latest-benchmark.json'), read(files.evaluation), read(files.briefings)
  ])
  let media;try{media=await read('src/data/media-leaderboards.json')}catch(error){if(error.code!=='ENOENT')throw error}
  let research;try{research=await read('src/data/model-evidence.json')}catch(error){if(error.code!=='ENOENT')throw error}
 const manifest = buildManifest({snapshot,intelligence,benchmark,evaluation,briefings,media,research})
  await writeFile('src/data/manifest.next.json', JSON.stringify(manifest, null, 2) + '\n')
  await rename('src/data/manifest.next.json', 'src/data/manifest.json')
  console.log(`已生成数据清单：${Object.values(manifest.datasets).map(d => `${d.label}=${d.status}`).join('；')}`)
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(error => { console.error(error.message); process.exitCode = 1 })
