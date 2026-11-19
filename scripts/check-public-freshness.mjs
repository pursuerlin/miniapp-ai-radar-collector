import {sendCard} from './feishu-notification.mjs'
const url='https://pursuerlin.github.io/miniapp-ai-radar-data/radar/health.json'
const response=await fetch(url+'?check='+Date.now(),{signal:AbortSignal.timeout(20000)})
if(!response.ok)throw Error('PUBLIC_HEALTH_HTTP_'+response.status)
const data=await response.json(),news=data.datasets?.find(d=>d.id==='intelligence'),stamp=news?.collectedAt,age=(Date.now()-Date.parse(stamp))/36e5
if(!Number.isFinite(age)||age>3){
 const message=Number.isFinite(age)?`资讯数据已 ${age.toFixed(1)} 小时未更新。`:'未获取有效的资讯采集时间。'
 console.error(message)
 if(process.env.FEISHU_WEBHOOK_URL)await sendCard(process.env.FEISHU_WEBHOOK_URL,{config:{wide_screen_mode:true},header:{template:'orange',title:{tag:'plain_text',content:'AI 雷达 · 公开采集需要检查'}},elements:[{tag:'markdown',content:message+'请查看公开采集仓库的最近运行。'},{tag:'markdown',content:'[查看采集记录](https://github.com/pursuerlin/miniapp-ai-radar-collector/actions/workflows/collect.yml)'}]})
 process.exitCode=1
}else console.log(`资讯快照正常：${stamp}，距现在 ${age.toFixed(1)} 小时。`)
