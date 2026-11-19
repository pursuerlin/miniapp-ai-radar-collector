import {validPublicBenchmarks} from './public-benchmarks.mjs'
import {validMediaMetadata} from './media-metadata.mjs'
import {modelAllowed} from './operations.mjs'
export const MEDIA_BOARDS = [
 {id:'text-to-image',kind:'image',label:'文生图',endpoint:'/api/v2/media/text-to-image/models/free',source:'https://artificialanalysis.ai/data-api/docs/reference#getTextToImageArenaFree',scope:'根据文字生成图片，按同榜质量评分比较。'},
 {id:'image-editing',kind:'image',label:'图像编辑',endpoint:'/api/v2/media/image-editing/models/free',source:'https://artificialanalysis.ai/data-api/docs/reference#getImageEditingArenaFree',scope:'根据指令编辑输入图片，与文生图分榜比较。'},
 {id:'text-to-video',kind:'video',label:'文生视频 · 无声',endpoint:'/api/v2/media/text-to-video/models/free',source:'https://artificialanalysis.ai/data-api/docs/reference#getTextToVideoArenaFree',scope:'按无声画面评比，不评价对白、配乐或音效；不代表模型不支持声音。'},
 {id:'image-to-video',kind:'video',label:'图生视频 · 无声',endpoint:'/api/v2/media/image-to-video/models/free',source:'https://artificialanalysis.ai/data-api/docs/reference#getImageToVideoArenaFree',scope:'输入图片生成视频，按无声画面评比，不评价音频。'},
 {id:'text-to-video-audio',kind:'video',label:'文生视频 · 有声',endpoint:'/api/v2/media/text-to-video-audio/models/free',source:'https://artificialanalysis.ai/data-api/docs/reference#getTextToVideoAudioArenaFree',scope:'输入文字生成带音频的视频；与无声评测分榜比较。'},
 {id:'image-to-video-audio',kind:'video',label:'图生视频 · 有声',endpoint:'/api/v2/media/image-to-video-audio/models/free',source:'https://artificialanalysis.ai/data-api/docs/reference#getImageToVideoAudioArenaFree',scope:'输入图片生成带音频的视频；与无声评测分榜比较。'}
]
const text=(v,max=200)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v)
const number=v=>typeof v==='number'&&Number.isFinite(v)
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=Date.now()+300000
export function validMediaBoard(board){
 const definition=MEDIA_BOARDS.find(b=>b.id===board?.id)
 return !!(definition&&board.source===definition.source&&timestamp(board.collectedAt)&&['ok','stale'].includes(board.status)&&Array.isArray(board.rows)&&board.rows.length>0&&board.rows.length<=5000&&
  (board.previewTotal===undefined||Number.isInteger(board.previewTotal)&&board.previewTotal>=board.rows.length&&board.previewTotal<=5000)&&new Set(board.rows.map(r=>r?.id)).size===board.rows.length&&board.rows.every(r=>r&&text(r.id)&&text(r.name)&&text(r.provider)&&number(r.elo)&&r.elo>=0&&(r.ci95===null||number(r.ci95)&&r.ci95>=0&&r.ci95<=r.elo)))
}
export function validMediaSnapshot(data){return !!(data?.schemaVersion===1&&(data.publicBenchmarks===undefined||validPublicBenchmarks(data.publicBenchmarks))&&(data.metadata===undefined||validMediaMetadata(data.metadata))&&timestamp(data.checkedAt)&&timestamp(data.collectedAt)&&Array.isArray(data.boards)&&data.boards.length>0&&data.boards.length<=MEDIA_BOARDS.length&&new Set(data.boards.map(b=>b?.id)).size===data.boards.length&&data.boards.every(validMediaBoard)&&data.collectedAt===data.boards.map(b=>b.collectedAt).sort((a,b)=>Date.parse(a)-Date.parse(b))[0]&&data.boards.every(b=>Date.parse(b.collectedAt)<=Date.parse(data.checkedAt))&&Array.isArray(data.errors)&&data.errors.every(e=>MEDIA_BOARDS.some(b=>b.id===e?.board)&&/^AA_MEDIA_[A-Z0-9_]+$/.test(e.errorCode)))}
export function rankMedia(rows,query=''){
 const ranked=[...rows].sort((a,b)=>b.elo-a.elo||a.id.localeCompare(b.id)).map((r,i,a)=>({...r,rank:i&&a[i-1].elo===r.elo?null:i+1}))
 let rank=1;for(let i=0;i<ranked.length;i++){if(ranked[i].rank!==null)rank=ranked[i].rank;else ranked[i].rank=rank}
 const q=query.trim().toLowerCase();return q?ranked.filter(r=>(r.name+' '+r.provider).toLowerCase().includes(q)):ranked
}
export function mediaIntervalLayout(rows){
 rows=rows.filter(r=>typeof r.ci95==='number')
 if(!rows.length)return []
 const min=Math.floor(Math.min(...rows.map(r=>r.elo-r.ci95))/10)*10-10,max=Math.ceil(Math.max(...rows.map(r=>r.elo+r.ci95))/10)*10+10
 return rows.map(row=>({...row,min,max,left:100*(row.elo-row.ci95-min)/(max-min),width:200*row.ci95/(max-min),dot:100*(row.elo-min)/(max-min)}))
}
export function mediaComparisonNote(rows){
 rows=rows.filter(r=>typeof r.ci95==='number')
 if(rows.length<2)return '再选择一款同榜模型，即可比较评分区间。'
 const overlaps=rows.some((r,i)=>rows.slice(i+1).some(s=>Math.max(r.elo-r.ci95,s.elo-s.ci95)<=Math.min(r.elo+r.ci95,s.elo+s.ci95)))
 return overlaps?'部分区间重叠，不能只凭名次判断明显优劣。':'这些评分区间未重叠；仍需结合自己的任务判断。'
}
// Shared access projection: changing operations also closes hidden shared routes.
export function allowedMediaBoards(config,data){
 const rules=config.media
 if(!config.pages.models||!config.models.tabs.includes('evidence')||!rules)return []
 return rules.boards.map(id=>data?.boards.find(b=>b.id===id)).filter(Boolean).map(board=>({...board,rows:board.rows.filter(row=>!rules.hiddenModelIds.includes(row.id)&&modelAllowed(config,row))})).filter(b=>b.rows.length)
}
