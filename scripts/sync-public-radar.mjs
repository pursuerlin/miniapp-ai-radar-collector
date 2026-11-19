import {readdir,mkdir,copyFile,unlink} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
// Operations has its own publishing lifecycle. Scheduled data refreshes must
// neither remove its live file nor replace it with a local development copy.
export async function syncPublicRadar(source,destination){
 await mkdir(destination,{recursive:true})
 const managed=name=>name.endsWith('.json')&&!/^operations-config(?:-v[345])?\.json$/.test(name)
 const names=(await readdir(source)).filter(managed)
 for(const file of (await readdir(destination)).filter(managed))if(!names.includes(file))await unlink(resolve(destination,file))
 for(const file of names)await copyFile(resolve(source,file),resolve(destination,file))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await syncPublicRadar(resolve(process.argv[2]),resolve(process.argv[3]))
