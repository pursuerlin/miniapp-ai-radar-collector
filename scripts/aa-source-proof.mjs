import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {assertBenchmarkMatchesArchive} from './validate-aa-archive.mjs'
export async function hasMatchingAaArchive(root=process.cwd()){
 try{const snapshot=JSON.parse(await readFile(resolve(root,'src/data/latest-benchmark.json'),'utf8')),html=await readFile(resolve(root,`docs/accuracy-audit/raw/${snapshot.performanceVersion==='v3'?'aa-current-v3.html':'aa-current.html'}`),'utf8');assertBenchmarkMatchesArchive(snapshot,html);return true}catch{return false}
}
