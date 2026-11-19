import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildChanges, validChanges, catalogFingerprint } from '../src/domain/changes.mjs'
import { validSnapshot } from '../src/domain/snapshot.mjs'

const SNAPSHOT = 'src/data/snapshot.json'
const BASELINE = 'src/data/catalog-baseline.json'
const OUT = ['src/data/changes.json', 'public/radar/changes.json']
const windowDays = Number(process.env.CHANGE_WINDOW_DAYS || 7)

const read = async path => JSON.parse(await readFile(path, 'utf8'))
async function atomic(path, text) {
  await writeFile(`${path}.next`, text)
  await rename(`${path}.next`, path)
}

async function loadBaseline(root) {
  try {
    const baseline = await read(resolve(root,BASELINE))
    return Number.isFinite(Date.parse(baseline?.collectedAt)) && Array.isArray(baseline?.models) ? baseline : null
  } catch { return null }
}

export async function buildChangesFiles({ now = new Date(),root=process.cwd() } = {}) {
  await mkdir(resolve(root,'public/radar'),{recursive:true})
  const write=async(path,value)=>atomic(resolve(root,path),JSON.stringify(value)+'\n')
  const saveBaseline=async value=>{await write(BASELINE,value);await write('public/radar/catalog-baseline.json',value)}
  const snapshot = await read(resolve(root,SNAPSHOT))
  if (!validSnapshot(snapshot)) throw Error('当前快照无效，拒绝生成变化摘要')
  const baseline = await loadBaseline(root)
  const baselineAge = baseline ? (Date.parse(snapshot.collectedAt) - Date.parse(baseline.collectedAt)) / 864e5 : Infinity
  const stamp = snapshot.collectedAt

  if (!baseline || baselineAge < 0 || baselineAge >= windowDays) {
    // First run, or the window just rolled over: publish an empty summary and re-anchor.
    const changes = buildChanges(catalogFingerprint({ collectedAt: stamp, models: snapshot.models }), catalogFingerprint(snapshot))
    await saveBaseline(catalogFingerprint(snapshot))
    if (!validChanges(changes)) throw Error('变化摘要校验失败')
    for (const path of OUT) await write(path,changes)
    return { changes, reanchored: true }
  }

  await saveBaseline(baseline)
  const changes = buildChanges(baseline, catalogFingerprint(snapshot))
  if (!validChanges(changes)) throw Error('变化摘要校验失败')
  for (const path of OUT) await write(path,changes)
  return { changes, reanchored: false }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { changes, reanchored } = await buildChangesFiles()
  console.log(`变化摘要: ${changes.total} 项（展示 ${changes.items.length}），窗口 ${changes.window.from} → ${changes.window.to}${reanchored ? '；已重设基线' : ''}`)
}
