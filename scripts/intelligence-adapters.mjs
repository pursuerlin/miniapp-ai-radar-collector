import {XMLParser,XMLValidator} from 'fast-xml-parser'
import {canonicalUrl} from '../src/domain/intelligence.mjs'
import {canPublishSummary} from '../src/domain/content-rights.mjs'
const DAY=86400000
export const list=v=>v==null?[]:Array.isArray(v)?v:[v]
function decode(s){return s.replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):''}).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[n])}
export function plain(v){return decode(decode(String(typeof v==='object'?v?.['#text']||'':v||''))).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}
// A bare "AI" is also hardware marketing ("AI NAS", "X3D AI 高帧模式"), so it only
// counts when the headline is not about a device category. The brand list stays in
// step with isAiRelevant: a model brand the editor treats as AI must not be dropped
// by the collector, whose title-only match is the only gate those feeds have.
const strongAIText=/\b(?:LLMs?|GPT[ -]?\d*|Claude|Gemini|DeepSeek|Qwen|Llama|Copilot|ChatGPT|OpenAI|Anthropic|NVIDIA|MCP|AGI|Mistral|Grok|xAI|Kimi|GLM|ERNIE|MiniMax|Gemma|Granite|Hunyuan|SenseChat|Midjourney|LLaVA)\b|multimodal|embedding|diffusion|tokenizer|inference|fine[- ]tun|agentic|retrieval[- ]augmented|text-to-|人工智能|生成式|大模型|语言模型|智能体|机器学习|深度学习|多模态|推理模型|具身智能|通义|千问|文心|豆包|智谱|英伟达|混元|星火|即梦/i
const hardwareText=/手机|笔记本|游戏本|工作站|主板|显卡|NAS|机箱|键盘|鼠标|耳机|音箱|电视|显示器|相机|路由|充电|电池|平板|手表|\b(?:PC|NAS|laptop|phone|tablet|monitor)\b/i
export function isAIText(text){const t=String(text||'');return strongAIText.test(t)||/\bAI\b/i.test(t)&&!hardwareText.test(t)}
export function recentArticle(a,now){const t=Date.parse(a.publishedAt);return !!canonicalUrl(a.url)&&!!a.title&&Number.isFinite(t)&&t<=now&&t>=now-30*DAY}
export function applyPolicy(article,source){
  const allowed=canPublishSummary(source.rights)
  const text=plain(article.summary)
  return {...article,summary:allowed?text.slice(0,1200)+(text.length>1200?'…':''):'',contentMode:allowed?'licensed-summary':'metadata',
    contentType:source.contentType||'news',translationStatus:'original',rights:{...source.rights,
      attribution:article.authors?.length?article.authors.join('、')+' · '+source.name:source.name,
      modified:allowed?'提取纯文本并节选；未翻译':'仅收录标题、时间与原始链接；未收录正文'}}
}
function normalize(rows,source,now){
  // Match the title only: Chinese feeds append "本文由 AI 自动分析生成" to every
  // earnings or hardware post, which made a body-level match accept the whole feed.
  return [...new Map(rows.filter(a=>recentArticle(a,now)&&(!source.aiOnly||isAIText(a.title)))
    .map(a=>{const article=applyPolicy({...a,title:plain(a.title).slice(0,300),sourceId:source.id,family:source.family,kind:source.kind,evidenceRole:source.evidenceRole||'primary',publishedAt:new Date(a.publishedAt).toISOString()},source);return[article.url,article]})).values()]
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,source.limit||20)
}
export function parseFeed(xml,source,now=Date.now()){
  if(xml.length>5e6||/<!DOCTYPE|<!ENTITY/i.test(xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,'')))throw Error('UNSAFE_XML')
  if(XMLValidator.validate(xml)!==true)throw Error('INVALID_XML')
  const x=new XMLParser({ignoreAttributes:false,processEntities:false}).parse(xml)
  const rows=x.rss?.channel?.item??x.feed?.entry
  if(rows==null)throw Error('NOT_A_FEED')
  const items=list(rows).filter(r=>!source.stableReleasesOnly||/^v?\d+\.\d+\.\d+$/.test(plain(r.title)))
  const parsed=items.map(r=>{
    const links=list(r.link),link=links.find(l=>typeof l==='string'||l?.['@_rel']==='alternate')||links.find(l=>l?.['@_href']&&!l?.['@_rel'])
    let address=typeof link==='string'?link:link?.['@_href']
    // arXiv legacy Atom IDs/links use HTTP; upgrade this known origin only.
    if(source.adapter==='arxiv')address=String(address||r.id||'').replace(/^http:\/\/arxiv\.org\//,'https://arxiv.org/')
    return {title:(source.titlePrefix||'')+plain(r.title),url:canonicalUrl(address),
      publishedAt:r.pubDate||r.published||r.updated||r['dc:date']||r.date||r.pubdate,
      summary:plain(r.description||r.summary),authors:list(r.author).map(a=>plain(a.name||a)).filter(Boolean).slice(0,12)}
  })
  // A feed that still returns items but suddenly loses dates or links would otherwise
  // normalize to zero articles and report "ok", masking upstream schema drift.
  if(parsed.length&&parsed.every(a=>!Number.isFinite(Date.parse(a.publishedAt))))throw Error('FEED_DATES_MISSING')
  if(parsed.length&&parsed.every(a=>!a.url))throw Error('FEED_LINKS_MISSING')
  return normalize(parsed,source,now)
}
export function parseDeepSeek(html,source,now=Date.now()){
  const contentStart=html.match(/<div\b[^>]*class=(?:"[^"]*\btheme-doc-markdown\b[^"]*"|'[^']*\btheme-doc-markdown\b[^']*')[^>]*>/i)
  const tail=contentStart?html.slice(contentStart.index+contentStart[0].length):''
  const body=tail.match(/^[\s\S]*?<\/article>/i)?.[0]||tail.match(/^[\s\S]*?(?=<\/main>|<\/body>)/i)?.[0]
  if(!body)throw Error('DEEPSEEK_CHANGELOG_STRUCTURE_CHANGED')
  // Docusaurus localizes the anchor prefix (date-… / 时间-…), so match on the trailing date.
  const scope=body.match(/\d{4}-\d{2}-\d{2}/)?body:html
  const dates=[...scope.matchAll(/<h2\b[^>]*id=(?:"[^"]{0,24}?-(\d{4}-\d{2}-\d{2})(?:-[^"]*)?"|'[^']{0,24}?-(\d{4}-\d{2}-\d{2})(?:-[^']*)?')[^>]*>[\s\S]*?<\/h2>/gi)].map(match=>({index:match.index,0:match[0],1:match[1]||match[2]}))
  if(!dates.length){
    for(const match of scope.matchAll(/<h2\b[^>]*>[\s\S]*?\bDate:\s*(\d{4}-\d{2}-\d{2})[\s\S]*?<\/h2>/gi))dates.push({index:match.index,0:match[0],1:match[1]})
  }
  if(!dates.length)throw Error('DEEPSEEK_DATES_MISSING')
  const rows=dates.map((hit,i)=>{
    const section=scope.slice(hit.index+hit[0].length,dates[i+1]?.index||scope.length)
    const headings=[...section.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].map(m=>plain(m[1]).replace(/\u200b/g,'')).filter(Boolean)
    if(!headings.length)throw Error('DEEPSEEK_HEADINGS_MISSING')
    return {title:`DeepSeek · ${headings.slice(0,2).join(' / ')}`,url:source.url+'#date-'+hit[1],publishedAt:hit[1]+'T00:00:00Z',summary:'',datePrecision:'day'}
  })
  return normalize(rows,source,now)
}
export function parseGemini(html,source,now=Date.now()){
  const embedded=html.match(/<noscript>\s*<pre>([\s\S]*?)<\/pre>\s*<\/noscript>/i)
  if(embedded)html=decode(embedded[1])
  // AI Studio now serves Markdown to automated clients. Its response has no
  // license footer, so only a metadata-only policy may consume that format.
  if(/^# Release notes\s*$/m.test(html)){
    if(canPublishSummary(source.rights))throw Error('LICENSE_NOTICE_MISSING')
    const matches=[...html.matchAll(/^## [^\n]+?\{%\s*id="(\d{2}-\d{2}-\d{4})"\s*%\}\s*$/gm)]
    if(!matches.length)throw Error('CHANGELOG_DATES_MISSING')
    return normalize(matches.map((m,i)=>{
      const [month,day,year]=m[1].split('-')
      const section=html.slice(m.index+m[0].length,matches[i+1]?.index||html.length)
      const label=plain((section.match(/\*\*([^\n]+?)\*\*/)?.[1]||'Gemini API updates').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/`/g,'')).replace(/:\s*$/,'')
      const url=source.url+'#'+m[1]
      return {title:`${label} · ${year}-${month}-${day}`,url,entryId:url,publishedAt:`${year}-${month}-${day}T00:00:00Z`,summary:'',authors:['Google'],datePrecision:'day'}
    }),source,now)
  }
  // Diagnose an unexpected response before checking its license footer.
  const body=html.split(/<div[^>]*class="devsite-article-body[^\"]*"[^>]*>/i)[1]?.split(/<devsite-thumb-rating|<\/article>/i)[0]
  if(!body)throw Error('CHANGELOG_STRUCTURE_CHANGED')
  if(canPublishSummary(source.rights)&&!/creativecommons\.org\/licenses\/by\/4\.0/i.test(html))throw Error('LICENSE_NOTICE_MISSING')
  const matches=[...body.matchAll(/<h2\b[^>]*id="(\d{2}-\d{2}-\d{4})"[^>]*>([\s\S]*?)<\/h2>/gi)]
  if(!matches.length)throw Error('CHANGELOG_DATES_MISSING')
  return normalize(matches.map((m,i)=>{
    const [month,day,year]=m[1].split('-'),text=body.slice(m.index+m[0].length,matches[i+1]?.index||body.length)
    const label=plain(text.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1]||'Gemini API updates')
    return {title:`${label} · ${year}-${month}-${day}`,url:source.url+'#'+m[1],publishedAt:`${year}-${month}-${day}T00:00:00Z`,summary:plain(text),authors:['Google'],datePrecision:'day'}
  }).map(a=>({...a,entryId:a.url})),source,now)
}
export function parseHN(text,source,now=Date.now()){
  const data=JSON.parse(text)
  if(!Array.isArray(data.hits))throw Error('INVALID_HN_RESPONSE')
  return normalize(data.hits.filter(h=>h.objectID&&Number.isFinite(h.points)&&h.points>=5).map(h=>({
    title:plain(h.title),url:`https://news.ycombinator.com/item?id=${encodeURIComponent(h.objectID)}`,
    originalUrl:canonicalUrl(h.url),publishedAt:h.created_at,summary:'',community:{platform:'Hacker News',points:h.points,comments:Number.isFinite(h.num_comments)?h.num_comments:0}
  })),source,now)
}
export function parseSource(text,source,now=Date.now()){
  if(source.adapter==='deepseek')return parseDeepSeek(text,source,now)
  if(source.adapter==='gemini')return parseGemini(text,source,now)
  if(source.adapter==='hn')return parseHN(text,source,now)
  return parseFeed(text,source,now)
}
