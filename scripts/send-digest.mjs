import {readFile} from 'node:fs/promises'
import {buildDigestCard,sendCard} from './feishu-notification.mjs'
import {problemList} from './collection-health-gate.mjs'

const read=async path=>{try{return JSON.parse(await readFile(path,'utf8'))}catch{return undefined}}
const health=await read('public/radar/health.json')
const manifest=await read('public/radar/manifest.json')
const intelligence=await read('public/radar/intelligence.json')
const changes=await read('public/radar/changes.json')

const asOf=health?.generatedAt||new Date().toISOString()
const from=Date.parse(asOf)-24*36e5
const articles=(intelligence?.articles||[]).filter(item=>Number.isFinite(Date.parse(item.publishedAt))&&Date.parse(item.publishedAt)>=from)
const changesTotal=Number.isInteger(changes?.total)?changes.total:0
const editorial=health?.collection?.editorial
const pending=Number.isInteger(editorial?.pending)?editorial.pending:0
const incomplete=Number.isInteger(editorial?.incomplete)?editorial.incomplete:0
const problems=problemList(health)

// A daily card that says "nothing happened" trains people to ignore the card.
const notable=articles.length>0||changesTotal>0||pending>0||incomplete>0||problems.length>0
if(!notable&&!process.argv.includes('--force')){
 console.log('过去 24 小时没有新内容、待办或来源问题，跳过日报')
 process.exit(0)
}
const card=buildDigestCard({health,manifest,intelligence,changes,now:asOf})
if(process.argv.includes('--dry')){
 console.log('标题：'+card.header.title.content)
 console.log(card.elements.map(element=>{
  if(element.content)return element.content
  if(element.tag==='column_set')return element.columns.map(column=>column.elements.map(e=>e.content).join(' ')).join(' | ')
  if(element.tag==='note')return element.elements.map(e=>e.content).join(' ')
  if(element.tag==='action')return element.actions.map(a=>a.text.content).join(' / ')
  return ''
 }).filter(Boolean).join('\n'))
 process.exit(0)
}
const webhook=process.env.FEISHU_WEBHOOK_URL
if(!webhook){console.log('未配置 FEISHU_WEBHOOK_URL，跳过日报');process.exit(0)}
process.exitCode=(await sendCard(webhook,card))?0:1
