import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
export function failedCollectedSources(health){
 const tasks=health?.collection?.tasks||{}
 return Object.entries(tasks).filter(([id,t])=>t.status!=='skipped'&&(t.status!=='ok'||health.sourceHealth?.[id]?.quality?.regressed||id==='media'&&health.sourceHealth?.[id]?.quality?.partial||id==='intelligence'&&health.intelligence?.partial)).map(([id])=>id)
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const health=JSON.parse(await readFile('public/radar/health.json','utf8'))
 const failed=failedCollectedSources(health)
 if(failed.length){console.error('本轮来源仍异常，已发布核实的保留快照及真实状态：'+failed.join(', '));process.exitCode=1}
 else console.log('本轮所选来源已通过采集健康检查；未采集来源保留历史状态。')
}
