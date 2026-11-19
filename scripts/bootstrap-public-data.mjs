import {mkdir,cp,readFile,writeFile,readdir,access} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {readPublicPayloads,validatePublicPayloads} from './validate-public-data.mjs'
import {validRadarFile} from '../src/domain/radar-cache.mjs'
import {compactRadarLaunch} from '../src/domain/radar-content.mjs'
export async function bootstrapPublicData({site='state/data-site',root=process.cwd()}={}){
 const from=resolve(root,site,'public/radar'),payloads=await readPublicPayloads(from);validatePublicPayloads(payloads)
 await mkdir(resolve(root,'src/data'),{recursive:true});await mkdir(resolve(root,'src/practice-resources'),{recursive:true});await mkdir(resolve(root,'public/radar'),{recursive:true})
 for(const name of ['snapshot.json','intelligence.json','briefings.json','latest-benchmark.json','evaluation-leaderboards.json','manifest.json','media-leaderboards.json','model-evidence.json'])if(payloads[name])await writeFile(resolve(root,'src/data',name),JSON.stringify(payloads[name])+'\n')
 // The published compact model payload keeps news in a separate validated file.
 const snapshot={...payloads['snapshot.json'],intelligence:payloads['intelligence.json']};await writeFile(resolve(root,'src/data/snapshot.json'),JSON.stringify(snapshot)+'\n')
 if(payloads['practice-resources.json'])await writeFile(resolve(root,'src/practice-resources/resources.json'),JSON.stringify(payloads['practice-resources.json'])+'\n')
 await writeFile(resolve(root,'src/data/news-digests.json'),JSON.stringify({schemaVersion:1,items:[]})+'\n')
 const radar={}
 for(const name of await readdir(from)){
  if(!name.endsWith('.json')||/^operations-config/.test(name))continue
  const value=JSON.parse(await readFile(resolve(from,name),'utf8'))
  if(name.startsWith('radar-')){if(!validRadarFile(name,value))throw Error('BOOTSTRAP_RADAR_INVALID');radar[name]=value}
  await cp(resolve(from,name),resolve(root,'public/radar',name))
 }
 if(Object.keys(radar).length)await writeFile(resolve(root,'src/data/radar-launch.json'),JSON.stringify(compactRadarLaunch(radar))+'\n')
 return {generatedAt:payloads['manifest.json'].generatedAt,files:Object.keys(payloads).length}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await bootstrapPublicData()))
