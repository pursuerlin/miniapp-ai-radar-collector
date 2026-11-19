import {collectorFailure} from './collection-diagnostics.mjs'

// Collectors that already retry individual HTTP reads keep that ownership.
// Retry whole processes only for transient transport failures, not bad schemas,
// denied access or throttling; a changed page does not heal after 15 seconds.
export async function runCollector({id,run,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),maxAttempts=3,delayMs=1000}){
 for(let attempt=1;attempt<=maxAttempts;attempt++)try{
  await run();return {attempts:attempt}
 }catch(error){
  error.attempts=attempt
  const code=collectorFailure(error).errorCode
  if(id==='aa'||id==='intelligence'||attempt===maxAttempts||!['REQUEST_TIMEOUT','HTTP_408','HTTP_500','HTTP_502','HTTP_503','HTTP_504'].includes(code))throw error
  await wait(delayMs*2**(attempt-1))
 }
}
