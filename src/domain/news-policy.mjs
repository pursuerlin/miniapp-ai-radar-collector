import {normalizedTitle} from './unicode-compatible.mjs'
import {canonicalUrl} from './urls.mjs'
const DAY=864e5
export const articleLinks=a=>[canonicalUrl(a.url),canonicalUrl(a.originalUrl)].filter(Boolean)
const versions=title=>{
 const text=String(title).toLowerCase()
 // A product/model version is meaningful only in an AI or model context. This
 // avoids treating car names such as LS8 as evidence of a model release.
 if(!/\b(?:ai|llm|model|gpt|claude|gemini|llama|deepseek|qwen|minimax|mistral|glm|ernie|豆包|大模型|模型)\b/i.test(text))return ''
 return (text.match(/\b(?:gpt|claude|gemini|llama|deepseek|qwen|mistral|glm|ernie|kimi|yi|minimax)[- ]?\d+(?:[.-]\d+)*(?:[- ](?:pro|flash|mini|lite|preview|high|low|max))?|\b[a-z]{1,8}\d+(?:[.-]\d+)*(?:[- ](?:pro|flash|mini|lite|preview|high|low|max))?\b/gi)||[]).map(x=>x.replace(/\s+/g,'-')).sort().join('|')
}
export function isAiRelevant(event){
 const text=[event.title,...(event.articles||[]).map(a=>a.title+' '+(a.summary||''))].join(' ')
 return (event.articles||[]).some(a=>a.contentType==='preprint')||/\b(?:artificial intelligence|generative ai|genai|ai|llm|large language model|foundation model|model|gpt|claude|gemini|llama|deepseek|qwen|minimax|mistral|glm|ernie|kimi|copilot|ai agent|agents|machine learning|open.source model)\b|人工智能|生成式人工智能|大模型|语言模型|模型训练|智能体|AI助手/i.test(text)
}
const action=title=>/\b(?:launch(?:es|ed)?|releas(?:e[sd]?|ing)|introduc(?:e[sd]?|ing)|announc(?:e[sd]?|ing))\b|发布|推出|上线/i.test(title)?'release':/\b(?:price|pricing|discount|cost)\b|价格|降价|涨价/i.test(title)?'price':''
export function matchArticles(a,b){
 if(articleLinks(a).some(url=>articleLinks(b).includes(url)))return '相同原文链接'
 const left=normalizedTitle(a.title),right=normalizedTitle(b.title)
 if(left&&left===right)return '标准化标题相同'
 // Only near-identical English headlines with an explicit matching version and action.
 // Different languages, launch vs pricing, differing dates/numbers and versions stay separate.
 if(Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt))>3*DAY||!action(a.title)||action(a.title)!==action(b.title))return ''
 if(!versions(a.title)||versions(a.title)!==versions(b.title))return ''
 if((String(a.title).match(/\d+(?:[.-]\d+)*/g)||[]).sort().join('|')!==(String(b.title).match(/\d+(?:[.-]\d+)*/g)||[]).sort().join('|'))return ''
 if(/[^\x00-\x7f]/.test(a.title+b.title)||/rumou?r|reportedly|leak|might|could|预计|传闻/i.test(a.title+b.title))return ''
 const words=v=>new Set(String(v).toLowerCase().match(/[a-z0-9]+/g)||[]),x=words(a.title),y=words(b.title)
 const overlap=[...x].filter(w=>y.has(w)).length
 return x.size>=6&&y.size>=6&&overlap/new Set([...x,...y]).size>=.85?'近似标题 · 同版本同动作（72小时内）':''
}
export function eventPriority(event){
 const title=event.title,official=event.articles.some(a=>a.kind==='official'),direct=event.articles.some(a=>a.evidenceRole!=='discovery')
 let value=0,label='主题补充'
 if(action(title)==='release'&&event.topic!=='研究'&&(/\b(?:model|llm|gpt|claude|gemini|llama|deepseek|qwen|minimax|mistral|glm|ernie)\b|大模型|模型/i.test(title)||versions(title))){value=3;label='模型发布线索'}
 else if(/\b(?:price cut|cuts? prices?|pricing update|price reduction)\b|降价|涨价|调价/i.test(title)){value=3;label='价格调整线索'}
 else if(/deprecat|shutdown|retir|security|vulnerab|停止服务|下线|漏洞/i.test(title)){value=3;label='服务或安全变化线索'}
 else if(/\b(?:API|SDK|MCP)\b|开源|工具调用/i.test(title)){value=2;label='开发接口线索'}
 // This is a headline signal, never a verified significance or truth score.
 return {value,direct,official,reasons:[label,...(official?['含官方来源']:[]),...(event.familyCount>=2?[`${event.familyCount} 个来源家族关注`]:[])]}
}
export function compareEditorial(a,b){
 const x=eventPriority(a),y=eventPriority(b)
 return Number(y.direct)-Number(x.direct)||y.value-x.value||Number(y.official)-Number(x.official)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.id.localeCompare(b.id)
}
// One copy of the headline patterns that describe what an item *is*: the briefing
// selector drops these from editorial slots, and the detail sheet picks its reading
// warning with the same rules. Topic alone comes from the headline, so a news report
// and a vendor case study would otherwise be handed the same sentence.
export const digestTitle=/^(?:早报|晚报|午报|周报|日报|一周要闻|本周要闻)\s*[｜|丨:：]/
export const customerStoryTitle=/\bcustomer stor(?:y|ies)\b|\bcase stud(?:y|ies)\b|\bhow\s+[A-Z0-9][\w.&'’-]*(?:\s+(?:[A-Z0-9][\w.&'’-]*|&))*\s+(?:is|are|uses?|used|using|built|scaled|cut|saved|automates?|developing|deployed|rolled out|adopted)\b|\bhelps?\s+[A-Z][\w.-]*\s+(?:strengthen|secure|cut|reduce|scale|build|ship|speed|automate|modernize|transform|improve)\b/i
// 加入 and 面试 are everywhere in product headlines ("Gemini 4 加入实时视频"), so a
// personnel move has to name a person's role or a hiring verb next to them.
export const personnelTitle=/(?:离职|入职|跳槽|任命|辞任|卸任|人事变动|裁员|招聘|挖角|去向确认)|(?:负责人|创始人|首席|联合创始人|研究员|科学家|工程师|高管|骨干|CTO|CEO|COO|VP)[^，。|｜]{0,24}(?:加入|离职|入职|跳槽|出任|接棒)|(?:取消|恢复|暂停|放弃)[^，。|｜]{0,10}面试|\b(?:joins?|joining|leaves|leaving|resigns?|steps? down|stepping down|laid off|layoffs?|hires?|is hired|appointed|exits?|names? .* (?:as|to))\b/i
const researchSignal=/study|findings?|researchers?|研究显示|研究发现|新研究|论文|同行评审/i
const priceSignal=/降价|涨价|调价|骨折价|价格|定价|pricing|price|discount|cost/i
const devSignal=/api|sdk|mcp|cli|开源|工具调用|编程|开发者|智能体|agent|coding|插件|how to/i
const modelSignal=/gpt|claude|gemini|deepseek|qwen|llama|mistral|chatgpt|copilot|grok|kimi|大模型|语言模型|model/i
export function readingFocus(event){
 const title=String(event?.title||''),articles=event?.articles||[],kinds=new Set(articles.map(a=>a.kind))
 if(articles.some(a=>a.contentType==='preprint'))return 'preprint'
 if(kinds.has('community'))return 'community'
 if(digestTitle.test(title))return 'digest'
 if(researchSignal.test(title))return 'research'
 if(customerStoryTitle.test(title))return 'case'
 if(priceSignal.test(title))return 'price'
 if(devSignal.test(title))return 'dev'
 if(modelSignal.test(title))return 'model'
 if(kinds.has('official'))return 'official'
 return 'report'
}
