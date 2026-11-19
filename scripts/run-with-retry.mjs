import {spawn} from 'node:child_process'
import {writeFile} from 'node:fs/promises'
import {redactDiagnostic} from './redact-diagnostic.mjs'

const [, , command, ...args] = process.argv
if (!command) throw Error('Usage: node scripts/run-with-retry.mjs <command> [args...]')
const maxAttempts = Number(process.env.RETRY_ATTEMPTS || 3)
const delayMs = Number(process.env.RETRY_DELAY_MS || 15000)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// A failure card that only says "open the log" gets asked about anyway, so the retry
// report keeps a redacted quote of what the process last complained about.
function errorQuote(text) {
 const lines = text.split('\n').map(line => line.trim()).filter(line => line && !/^[{}\[\],\s]+$/.test(line))
 return lines.slice(-8).join(' · ')
}

let lastOutput = ''
function run() {
 return new Promise((resolve, reject) => {
  const child = spawn(command, args, {stdio: ['inherit', 'pipe', 'pipe'], shell: false})
  let tail = ''
  const capture = stream => stream?.setEncoding('utf8').on('data', chunk => {
   process.stdout.write(chunk)
   tail = (tail + chunk).slice(-6000)
  })
  capture(child.stdout)
  capture(child.stderr)
  child.on('error', reject)
  child.on('exit', code => { lastOutput = errorQuote(tail); resolve(code ?? 1) })
 })
}
let last = 1
const startedAt=new Date().toISOString()
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
 console.log(`执行 ${command}（第 ${attempt}/${maxAttempts} 次）`)
 try { last = await run() } catch(error) { console.error(error.message); last=1 }
 if(process.env.COLLECTION_RETRY_REPORT)await writeFile(process.env.COLLECTION_RETRY_REPORT,JSON.stringify({runId:process.env.GITHUB_RUN_ID,startedAt,finishedAt:new Date().toISOString(),attempts:attempt,maxAttempts,exitCode:last,errorTail:last===0?'':await redactDiagnostic(lastOutput)}))
 if (last === 0) process.exit(0)
 if (attempt < maxAttempts) await sleep(delayMs * attempt)
}
process.exit(last)
