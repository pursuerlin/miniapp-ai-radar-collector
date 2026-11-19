import {readFile,writeFile,rename} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {buildBriefing,reportDays,reportWeeks} from '../src/domain/briefings.mjs'
export async function collectBriefings(){
 const intelligence=JSON.parse(await readFile('src/data/intelligence.json','utf8'))
 const data={schemaVersion:1,collectedAt:intelligence.collectedAt,timezone:'Asia/Shanghai',daily:reportDays(intelligence).slice(0,14).map(day=>buildBriefing(intelligence,{kind:'daily',day})),weekly:reportWeeks(intelligence).slice(0,5).map(day=>buildBriefing(intelligence,{kind:'weekly',day}))}
 await writeFile('src/data/briefings.next.json',JSON.stringify(data)+'\n');await rename('src/data/briefings.next.json','src/data/briefings.json');console.log(`${data.daily.length} 期每日速览，${data.weekly.length} 期每周观察；基于来源快照 ${data.collectedAt}`)
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)collectBriefings().catch(e=>{console.error(e);process.exitCode=1})
