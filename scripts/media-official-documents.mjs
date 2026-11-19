import {createHash} from 'node:crypto'
import YAML from 'yaml'
import {alibabaDocument} from './media-alibaba-documents.mjs'
import {officialSourceSpec} from '../src/domain/media-official-sources.mjs'
const fail=code=>{throw Object.assign(Error(code),{code})}
const clean=s=>s.replace(/\s+/g,' ').trim()
const literals=s=>[...s.matchAll(/`([^`\n]+)`/g)].map(m=>m[1])
export function normalizeOfficialDocument(raw,source,id){
 const spec=officialSourceSpec(source,id)
 if(!spec||typeof raw!=='string'||!raw.trim()||/<html[\s>]/i.test(raw))fail('METADATA_DOCUMENT_INVALID')
 const fields={},fieldEvidence={}
 function put(key,value,evidence){if(value===undefined||value===null||Array.isArray(value)&&!value.length)fail('METADATA_DOCUMENT_SCHEMA_CHANGED');fields[key]=value;fieldEvidence[key]=clean(evidence).slice(0,1400)}
 function match(re,text=raw){const m=text.match(re);if(!m)fail('METADATA_DOCUMENT_SCHEMA_CHANGED');return m}
 function section(start,end,text=raw){const from=text.indexOf(start);if(from<0)fail('METADATA_DOCUMENT_SCHEMA_CHANGED');const to=text.indexOf(end,from+start.length);if(to<0)fail('METADATA_DOCUMENT_SCHEMA_CHANGED');return text.slice(from,to)}
 let sourceNote
 if(source==='alibaba'){sourceNote=alibabaDocument(raw,id,{put,match,section})
 }else if(source==='bfl-docs'){
  const block=match(/`{4}yaml[^\n]*\n([\s\S]+?)\n`{4}/)[1],root=YAML.parse(block)
  if(root.info?.['x-fal-metadata']?.endpointId!=='blackforestlabs/flux-3-max/text-to-video')fail('METADATA_IDENTITY_INVALID')
  const p=root.components?.schemas?.Flux3MaxTextToVideoInput?.properties;if(!p?.resolution?.enum||!p.duration?.enum||!p.aspect_ratio?.enum||p.generate_audio?.type!=='boolean')fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
  match(/upscaled from the 720p generation/,p.resolution.description)
  put('dimensions',p.resolution.enum.map(v=>v==='720p'?v+'（原生）':v+'（升采样）'),p.resolution.description);put('duration',`${Math.min(...p.duration.enum)} – ${Math.max(...p.duration.enum)} 秒`,JSON.stringify(p.duration))
  put('aspectRatio',p.aspect_ratio.enum,p.aspect_ratio.description);put('audioControl',true,p.generate_audio.description);put('seedControl',true,p.seed.description);put('reasoning',p.reasoning_level.enum,p.reasoning_level.description)
  if(id.endsWith('-i2v')){
   const block=section('> [tab] Image to video','> [tab] Keyframes to video')
   match(/queue\.fal\.run\/blackforestlabs\/flux-3-max\/image-to-video/,block)
   match(/Every other field in the Body section below works the same way\./,block)
   put('imageInput',true,block);put('referenceImages','1 张首帧；可选 1 张尾帧',match(/starts from that image\. Optionally, add `end_image_url` to\s*>?\s*choose the last frame\./,block)[0])
  }
  sourceNote='BFL 官方文档明确的 fal '+(id.endsWith('-i2v')?'图生视频模式，其他 Body 字段与文生视频共用':'文生视频端点')+'；1080p/2K/4K 从 720p 升采样。不是 AA 实测配置，不套用仅关键帧模式的 24fps 描述。'
 }else if(id.endsWith('-pricing')){
  const model=id.slice(0,-8)
  if(source==='openai'){
   const imageStart=raw.indexOf('\nImages\n'),start=raw.indexOf('\nStandard\n',imageStart),end=raw.indexOf('\nBatch\n',start)
   if(imageStart<0||start<0||end<0)fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
   const s=raw.slice(start,end);match(/Prices per 1M tokens unless noted\./)
   const row=mode=>{const line=s.split('\n').filter(l=>l.startsWith('| '+model+' | '+mode+' |'));if(line.length!==1)fail('METADATA_DOCUMENT_SCHEMA_CHANGED');const cells=line[0].split('|').map(x=>x.trim());if(!cells.slice(3,6).every(v=>v==='-'||/^\$\d+(?:\.\d+)?$/.test(v)))fail('METADATA_DOCUMENT_SCHEMA_CHANGED');return {line:line[0],cells}}
   const image=row('Image'),text=row('Text'),price=v=>{if(!/^\$\d+(?:\.\d+)?$/.test(v))fail('METADATA_DOCUMENT_SCHEMA_CHANGED');return 'US'+v+' / 百万 token'}
   put('billingBasis','标准 API · 美元 · 按 token 计费',s.slice(0,120))
   put('textInputPrice',price(text.cells[3]),text.line);put('imageInputPrice',price(image.cells[3]),image.line);put('imageOutputPrice',price(image.cells[4]),image.line)
   if(text.cells[4]!=='-')put('textOutputPrice',price(text.cells[4]),text.line)
   sourceNote='以上为官方标准 API 非缓存价格，不含 Batch、优惠或渠道报价；输入和输出分别计费。没有该次用量时，不能据此给出每张图片的总费用。'
  }else if(source==='google'){
   const marker=`{% id="${model}" %}`,start=raw.indexOf(marker),next=raw.indexOf('\n## ',start)
   if(start<0)fail('METADATA_IDENTITY_INVALID')
   const modelBlock=raw.slice(start,next<0?raw.length:next),s=section('{% tab title="Standard" %}','{% /tab %}',modelBlock)
   match(/Paid Tier, per 1M tokens in USD/,s)
   const input=match(/\* Input price\s+\* Not available\s+\* \$(\d+(?:\.\d+)?) \(([^)]+)\)/,s)
   put('billingBasis','标准 API · 美元 · 输入另计',s.slice(0,150));put('inputPrice',`US$${input[1]} / 百万 token（${input[2].replaceAll('text','文字').replaceAll('image','图片').replaceAll('video','视频')}）`,input[0])
   const output=match(/\* Output price[^\n]*\n([\s\S]+?)(?:\n  ---|\{% \/table)/,s)[0]
   if(model.includes('omni')){
    const video=match(/\$(\d+(?:\.\d+)?) \(video\)/,output),text=match(/\$(\d+(?:\.\d+)?) \(text\)/,output)
    put('videoOutputPrice',`US$${video[1]} / 百万 token`,output);put('textOutputPrice',`US$${text[1]} / 百万 token`,output)
    sourceNote='视频按输出 token 计费，不是固定每秒单价；输入、思考等用量需按原文计入，分辨率会影响视频 token 数。'+(model.includes('1.1')?'官方预告 2026-12-03 路由并改按 1.2 价格计费，届时需重新核验。':'')
   }else{
    const image=output.match(/\$(\d+(?:\.\d+)?) \(images\)/)
    if(image)put('imageOutputPrice',`US$${image[1]} / 百万 token`,output)
    const text=output.match(/\$(\d+(?:\.\d+)?) \(text and thinking\)/);if(text)put('textOutputPrice',`US$${text[1]} / 百万 token（含思考）`,output)
    const estimates=[...output.matchAll(/\$(\d+(?:\.\d+)?) per ([\d.K/]+)(?: resolution)? image/g)].map(m=>`${m[2]}：US$${m[1]} / 张（仅图片输出）`)
    if(estimates.length)put('referencePrice',estimates.join('；'),output)
    else if(model==='gemini-2.5-flash-image')put('referencePrice',`US$${match(/\$(\d+(?:\.\d+)?) per image/,output)[1]} / 张（仅图片输出）`,output)
    sourceNote='每张参考价仅为官方列出的图片输出费用，输入、文字/思考输出及搜索等工具可能另计；不含 Batch、优惠或渠道加价。'+(model==='gemini-2.5-flash-image'?'官方已预告该版本于 2027-03-15 关闭，需关注迁移。':'')
   }
  }else if(source==='volcengine'){
   const text=raw.replaceAll('\\-','-'),image=model.includes('seedream')
   const block=section(image?'# 图片生成模型':'# 视频生成模型',image?'# 3D 生成模型':'## 价格示例',text)
   match(image?/输入图单价（元\/张）/:/在线推理<br><br>元\/M token/,block)
   const lines=block.split('\n').filter(l=>l.startsWith('|'+model+' ')||l.startsWith('|'+model+'<'))
   if(lines.length!==1)fail('METADATA_IDENTITY_INVALID')
   const line=lines[0],cells=line.split('|').map(v=>v.trim()),money=v=>match(/^\d+(?:\.\d+)?$/,v)[0]
   put('billingBasis','火山方舟官方目录 · 人民币 · 在线推理',block.slice(0,150))
   if(!image){
    const parts=[...cells[2].matchAll(/输出视频分辨率为 ([^<]+)<br><br>\s*\* 输入不含视频：(\d+(?:\.\d+)?)<br><br>\s*\* 输入包含视频：(\d+(?:\.\d+)?)/g)]
    if(parts.length!==3||parts.map(p=>p[1]).join('|')!=='480p，720p|1080p|4K')fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
    put('videoOutputPrice',parts.map(m=>`${m[1]}：¥${m[2]} / 百万 token`).join('；'),line)
    put('inputPrice','含输入视频时的任务费率：'+parts.map(m=>`${m[1]} ¥${m[3]} / 百万 token`).join('；'),line)
    sourceNote='火山方舟 '+model+' 系列目录价；视频输出栏为输入不含视频时的任务费率，含输入视频时按另一档计费并计入输入时长。不是固定每秒价或单独输入附加费；最低用量、Draft 分步计费另见原文，以 usage 和账单为准。'
   }else{
    if(model==='doubao-seedream-5-5'){
     put('imageInputPrice','¥'+money(cells[2])+' / 张',line)
     const rates=match(/^\* P ≤ (\d+(?:\.\d+)?M)：(\d+(?:\.\d+)?)<br><br>\* \1 < P ≤ (\d+(?:\.\d+)?M)：(\d+(?:\.\d+)?)$/,cells[3])
     put('referencePrice',`总像素 ≤ ${rates[1]}：¥${rates[2]} / 张；${rates[1]}–${rates[3]}（不含下限）：¥${rates[4]} / 张`,line)
    }else if(model==='doubao-seedream-5-0-pro'){
     const input=match(/^\* 首张免费<br><br>\* 第 2 张起：(\d+(?:\.\d+)?)$/,cells[2]);put('imageInputPrice','首张免费；第 2 张起 ¥'+input[1]+' / 张',line)
     const single=section('**单图生成场景：**','**图层拆分场景：**',cells[3]),rates=match(/P ≤ (\d+(?:\.\d+)?M)：(\d+(?:\.\d+)?)[\s\S]*?P \\> \1：(\d+(?:\.\d+)?)/,single)
     put('referencePrice',`单图生成：总像素 ≤ ${rates[1]} ¥${rates[2]} / 张；超过 ${rates[1]} ¥${rates[3]} / 张`,single)
    }else{
     if(cells[2]!=='免费')fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
     put('imageInputPrice','免费（官方目录）',line);put('referencePrice','¥'+money(cells[3])+' / 张（输出）',line)
    }
    sourceNote='所列系列的官方目录价，输入另计；不是其他渠道或 AA 评测费用。P 指总像素，不是单边尺寸；不将图层拆分单价套给普通生成，也不将目录价视为所有账户最终结算价。'
   }
  }else if(source==='minimax'){
   const prices=raw.replaceAll('\\$','$')
   if(model==='MiniMax-H3-Max'){
    const block=section('### H3 Series Extended Models','* **MiniMax-H3-Max**',prices)
    match(/\*\*MiniMax-H3-Max\*\*/,block);match(/Output Video\\\s*per second/,block);match(/Input Video\\\s*per second/,block)
    const rows=[...block.matchAll(/<td>(768P|480P)<\/td>\s*<td>\$(\d+(?:\.\d+)?)<\/td>\s*<td>\$(\d+(?:\.\d+)?)<\/td>\s*<td>\$(\d+(?:\.\d+)?)<\/td>/g)]
    if(rows.length!==2||rows.map(m=>m[1]).join('|')!=='768P|480P'||rows[0][4]!==rows[1][4])fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
    put('videoOutputPrice',rows.map(m=>`${m[1]}：US$${m[2]} / 秒`).join('；'),block);put('inputPrice',rows.map(m=>`${m[1]} 视频：US$${m[3]} / 秒`).join('；'),block)
    const free=match(/\* \*\*MiniMax-H3-Max\*\*: The first \*\*(\d+) images\*\* per task are free;[^\n]+/,prices)
    put('imageInputPrice',`每任务前 ${free[1]} 张免费；额外每张 US$${rows[0][4]}`,free[0]+' '+block)
    sourceNote='MiniMax 官方 H3 Max 标准价，输出和输入分别计费；AA 此模型由 Fal 提供，不能据此认定 Fal 收费相同。音频输入免费，实际费用以对应渠道账单为准。'
   }else if(model==='MiniMax-H3'){
    const s=section('### H3 Series Flagship Models','* **Image input**',prices),block=section('**MiniMax-H3**','**MiniMax-H3-Highspeed**',s)
    const rows=[...block.matchAll(/<td>(2K|768P)<\/td>\s*<td>\$(\d+(?:\.\d+)?)<\/td>\s*<td>\$(\d+(?:\.\d+)?)<\/td>\s*<td>\$(\d+(?:\.\d+)?)<\/td>/g)];if(rows.length!==2)fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
    put('videoOutputPrice',rows.map(m=>`${m[1]}：US$${m[2]} / 秒`).join('；'),block);put('inputPrice',rows.map(m=>`${m[1]} 视频：US$${m[3]} / 秒`).join('；'),block);put('imageInputPrice','每任务前 5 张免费；额外每张 US$'+rows[0][4],match(/first \*\*5 images\*\* per task are free/,prices)[0]);
    sourceNote='同模型/分辨率的任务单价一致，音频输入免费；输出与输入素材分别计费。不套用到 H3 Max 或其他档位。'
   }else{
    const s=section('### Image Generation','### Example cost',prices),line=s.split('\n').find(l=>l.startsWith('| **'+model+'** '));if(!line)fail('METADATA_IDENTITY_INVALID')
    const cells=line.split('|').map(v=>v.trim()),price=i=>'US$'+match(/^\$(\d+(?:\.\d+)?)$/,cells[i])[1]+' / 百万 token'
    put('textInputPrice',price(2),line);put('imageInputPrice',price(3),line);put('imageOutputPrice',price(4),line);sourceNote='官方 token 标准价，输入和输出分别计费；不使用已过期的 4K 五折活动或示例总费用。'
   }
   put('billingBasis','MiniMax 标准 API · 美元',prices.slice(0,100))
  }else if(source==='xai'){
   const s=section('### Image & Video Pricing','### Voice Pricing'),line=s.split('\n').filter(l=>l.startsWith('| '+model+' |'))
   if(line.length!==1)fail('METADATA_IDENTITY_INVALID')
   const price=match(/\| \$(\d+(?:\.\d+)?) \/ (image|sec) \|/,line[0]);put('referencePrice',`US$${price[1]} / ${price[2]==='image'?'张':'秒'}（目录参考价）`,line[0]);put('billingBasis','官方目录 · 美元',line[0])
   sourceNote='该目录未按分辨率、质量或编辑模式拆分此价格；仅作目录参考，不能认定所有模式均按此价收费。以实际请求规格与账单为准。'
  }
 }else if(source==='openai'){
  const editing=id.endsWith('-edit'),modelId=id.replace(/-(?:edit|generate)$/,'')
  if(id.includes('2.6')&&!editing&&!id.endsWith('-generate')){
   const s=section('### GPT-Image-2.6','### Safety identifiers')
   match(new RegExp(id.replaceAll('.','\\.')),s)
   const m=match(/supported complexity levels[\s\S]*?are ([^.]+)\./,s)
   put('complexity',literals(m[1]),m[0]);put('imageInput',true,match(/Both models support[^\n]+/,s)[0])
   put('outputFormat',['svg','gif'],match(/Both models support[^\n]+SVG output[^\n]+/,s)[0])
   sourceNote='此处仅列官方明确归属 2.6 的能力；SVG/GIF 有模式与权限限制，不能据此认定 AA 的 max 档设置。'
  }else{
   match(new RegExp('`'+modelId.replaceAll('.','\\.')+'`'))
   const quality=section('- `quality:',editing?'- `safety_identifier:':'- `response_format:')
   match(editing?/GPT image models support `low`, `medium`,\s*and `high`/:/`high`, `medium` and `low` are supported for the GPT image models/,quality)
   const values=['low','medium','high','auto']
   if(id.includes('2.5')){match(new RegExp('`'+modelId.replaceAll('.','\\.')+'`[\\s\\S]*?also support `xhigh` and `max`'),quality);values.splice(3,0,'xhigh','max')}
   put('quality',values,quality)
   const size=section('- `size:',editing?'### Returns':'- `user:')
   const standard=match(/standard sizes ([^.]+) are supported by the GPT image models/,size)
   put('dimensions',literals(standard[1]),standard[0])
   if(!['gpt-image-1.5','gpt-image-2.6-sunburst','gpt-image-2.6-flare'].includes(modelId)){
    const text=match(/For `gpt-image-2`[\s\S]*?current pixel and edge limits\./,size)[0]
    const limits=match(/divisible by (\d+)[\s\S]*?between ([\d:]+) and ([\d:]+)[\s\S]*?above `([^`]+)`[\s\S]*?maximum supported resolution is `([^`]+)`/,text)
    put('constraints',`自定义尺寸宽高均为 ${limits[1]} 的倍数；比例 ${limits[2]}–${limits[3]}；超过 ${limits[4]} 为实验性，最大 ${limits[5]}，另受像素和边长限制。`,text)
   }
   const n=section('- `n:','- `output_compression:');const count=match(/minimum: (\d+)`, `maximum: (\d+)/,n)
   put('imageCount',`${count[1]} – ${count[2]}`,n)
   // The generation endpoint does not prove image input or edit-specific limits.
   if(editing){const images=section('- `images:','- `prompt:');const refs=match(/maxItems: (\d+)/,images);put('referenceImages','最多 '+refs[1]+' 张',images);put('imageInput',true,images)}
   sourceNote=editing?'官方图片编辑接口选项；GIF/SVG 等额外模式有模型与项目权限限制。':'官方图片生成接口选项；编辑模式的参考图限制另行核验，不能将通用枚举视为该版本全部支持。'
  }
 }else if(source==='google'){
  match(new RegExp('`'+id.replaceAll('.','\\.')+'`'))
  if(id==='gemini-omni-1.1-flash'){
   const s=raw.slice(raw.indexOf('## gemini-omni-1.1-flash'))
   const output=match(/\*\*Output video\*\* (\d+)s-(\d+)s \(([^,]+), (\d+) FPS\)/,s)
   put('duration',`${output[1]} – ${output[2]} 秒`,output[0]);put('dimensions',output[3].split('/'),output[0]);put('fps',output[4],output[0])
   put('imageInput',true,match(/\*\*Input\*\* Text, Image, Video[^\n]+/,s)[0])
   sourceNote='此页未区分 1.1 的原生与升采样分辨率；不套用 1.2 的时长和参考图限制。模型文档标明 1.1 将于 2026-12-03 路由至 1.2，届时需重新核对。'
  }else if(['gemini-3.1-flash-image','gemini-3-pro-image','gemini-2.5-flash-image'].includes(id)){
   const title=id==='gemini-3.1-flash-image'?'3.1 Flash Image':id==='gemini-3-pro-image'?'3 Pro Image':'Gemini 2.5 Flash Image'
   const s=section(`{% tab label="${title}" %}`,'{% /tab %}')
   const ratios=[...s.matchAll(/\* (?:\*\*)?(\d+:\d+)(?:\*\*)?(?: \{% align="left" %\})?\s*\n/g)].map(m=>m[1])
   put('aspectRatio',ratios,s.slice(0,1100))
   const sizes=id==='gemini-2.5-flash-image'?[...s.matchAll(/\* (\d+x\d+)\s*\n/g)].map(m=>m[1]):[...s.matchAll(/\* (\w+) resolution/g)].map(m=>m[1])
   put('dimensions',sizes,s.slice(0,1100));put('imageInput',true,match(new RegExp('`'+id.replaceAll('.','\\.')+'`[\\s\\S]{0,100}(?:images|image)'))[0])
   if(id==='gemini-3-pro-image')put('referenceImages','最多 14 张；其中最多 5 张高保真',match(/`gemini-3-pro-image` supports 5 images with high fidelity, and up to\s+14 images in total/)[0])
   if(id==='gemini-2.5-flash-image')sourceNote='官方建议输入最多 3 张图以获得较好表现，未将该建议当作接口硬上限。'
  }else if(id.includes('omni')){
   const resolution=section('### Output resolution','{% tabs %}')
   const values=[...resolution.matchAll(/\| `([^`]+)` \| ([^\n]+)\|/g)].map(m=>m[1]+(/upscaled/.test(m[2])?'（升采样）':''))
   put('dimensions',values,resolution)
   const duration=match(/Supported values: ['"]?(\d+)s['"]? to ['"]?(\d+)s/)
   put('duration',`${duration[1]} – ${duration[2]} 秒`,duration[0])
   put('aspectRatio',literals(match(/Supported values: "9:16", "16:9"/)[0].replaceAll('"','`')),match(/Supported values: "9:16", "16:9"/)[0])
   put('referenceImages',match(/supports up to (\d+) reference images/)[1]+' 张',match(/supports up to \d+ reference images[^.]+/)[0]);put('imageInput',true,fieldEvidence.referenceImages)
   put('nativeAudio',true,match(/generate synchronized video and native audio[^.]+/)[0])
   put('constraints','首尾帧插值为 3–10 秒；更长时长不适用该模式。',match(/First and last frame interpolation supports video durations from 3 to 10\s+seconds/)[0])
  }else{
   if(id==='gemini-nano-banana-2.1'){
    const m=match(/across ([\s\S]+?) output\s+resolutions/);put('dimensions',literals(m[1]),m[0])
    const refs=match(/up to (\d+) reference images/);put('referenceImages',refs[1]+' 张',refs[0]);put('imageInput',true,refs[0])
    const thinking=match(/Thinking levels \(([^)]+)\)/);put('reasoning',literals(thinking[1]),thinking[0])
   }else{
    const m=match(/Supported `image_size` values: `([^`]+)`[^\n]+/);put('dimensions',[m[1]],m[0]);put('imageInput',true,match(/Interleaved generation and editing[^\n]+/)[0]);put('constraints','官方文档明确不支持 2K 和 4K。',match(/2K and 4K are unsupported/)[0])
   }
  }
 }else if(source==='xai'){
  const modelId=id.replace(/-(?:i2v|edit)$/,'')
  match(new RegExp('[`"]'+modelId.replaceAll('.','\\.')+'[`"]'))
  if(id.endsWith('-edit')){
   put('imageInput',true,match(/Edit an existing image by providing a source image along with your prompt\./)[0])
   sourceNote='仅确认此版本的图片编辑输入；没有将生成接口的尺寸、张数等枚举套用于编辑接口。'
  }else if(id.includes('image')){
   const res=section('## Resolution','## Quality'),values=[...res.matchAll(/(?:\*|-|\d+\.)\s+`(\d+k)`/g)].map(m=>m[1]);put('dimensions',[...new Set(values)],res.slice(0,700))
   const ratio=section('## Aspect Ratio','## Resolution');const ratios=[...ratio.matchAll(/\b\d+(?:\.\d+)?:\d+(?:\.\d+)?\b/g)].map(m=>m[0]);put('aspectRatio',[...new Set(ratios)],ratio.slice(0,1100))
   const quality=match(/Allowed values are ([^.]+)\./);put('quality',literals(quality[1]),quality[0])
   const n=match(/`n` parameter \(`(\d+)`[–—-]`(\d+)`\)/);put('imageCount',`${n[1]} – ${n[2]}`,n[0])
  }else{
   const lite=modelId.endsWith('-lite'),image=id.endsWith('-i2v')
   const note=match(lite?/`grok-imagine-video-1\.5-lite` reaches 1080p for text-to-video and image-to-video by upscaling 720p\./:/`grok-imagine-video-1\.5` renders `1080p` natively for text-to-video and image-to-video;/)[0]
   const resolution=section('### Resolution','### Audio');match(/`480p`/,resolution);match(/`720p`/,resolution)
   put('dimensions',['480p','720p',lite?'1080p（由 720p 升采样）':'1080p（原生）'],note)
   const duration=match(/Set `duration` from (\d+) to (\d+) seconds/);put('duration',`${duration[1]} – ${duration[2]} 秒`,duration[0])
   if(image){put('imageInput',true,note);put('aspectRatio','跟随输入图片；比例参数不生效',match(/Image-to-video output always matches the input image's aspect ratio; `aspect_ratio` is ignored\./)[0])}
   else{const ratio=section('### Aspect Ratio','### Resolution');put('aspectRatio',[...new Set([...ratio.matchAll(/`(\d+:\d+)`/g)].map(m=>m[1]))],ratio)}
   put('nativeAudio',true,match(/Generated videos include an audio track by default, with lip-synced speech on `grok-imagine-video-1\.5` and `grok-imagine-video-1\.5-lite`\./)[0]);put('audioControl',true,match(/Pass `generate_audio=False` to request a silent video:/)[0])
   sourceNote=(image?'图生视频模式':'文生视频模式')+'；参考素材生视频与编辑模式有另外的限制，不在此处混用。'
  }
 }else if(source==='volcengine'){
  if(id.includes('seedance')){
   const modelIds=match(/^\|Model ID[^\n]+/m)[0].split('|').map(x=>x.trim().replaceAll('\\-','-')),column=modelIds.indexOf(id)
   if(column<3)fail('METADATA_IDENTITY_INVALID')
   function cell(name){const line=raw.split('\n').find(l=>l.startsWith('|')&&l.includes(name));if(!line)fail('METADATA_DOCUMENT_SCHEMA_CHANGED');const value=line.split('|')[column]?.trim();if(!value)fail('METADATA_DOCUMENT_SCHEMA_CHANGED');return value}
   const resolution=cell('输出分辨率'),dimensions=[...resolution.matchAll(/\b(480p|720p|1080p|4K)\b/g)].map(m=>m[1]);put('dimensions',dimensions,resolution)
   const ratio=cell('输出宽高比');put('aspectRatio',[...ratio.matchAll(/\b\d+:\d+\b/g)].map(m=>m[0]),ratio)
   const duration=cell('输出时长'),range=match(/(\d+)~(\d+) 秒/,duration);put('duration',`${range[1]} – ${range[2]} 秒`,duration)
   const audio=cell('生成有声视频');if(audio!=='✓')fail('METADATA_DOCUMENT_SCHEMA_CHANGED');put('nativeAudio',true,'生成有声视频：'+audio+'；Model ID：'+id)
   const input=cell(id.includes('2-5')?'首帧生视频':'图生视频-首帧');if(input!=='✓')fail('METADATA_DOCUMENT_SCHEMA_CHANGED');put('imageInput',true,'首帧生视频：'+input+'；Model ID：'+id)
   const format=cell('输出视频格式');put('outputFormat',format.split(',').map(x=>x.trim()),format)
   if(id.includes('2-5')){
    const refs=cell('参考素材数量上限'),count=match(/（(\d+)张图/,refs);put('referenceImages',`全模态参考最多 ${count[1]} 张；首帧 1 张、首尾帧 2 张`,refs)
    put('constraints','首帧/首尾帧的画面比例跟随输入；视频编辑时比例为 adaptive、时长为 -1。1080p/4K 使用 H.265/HEVC 10bit，需注意播放器兼容性。',match(/\*\*Seedance 2\.5 输出的 1080p、4k 视频均采用 10bit 位深与 H\.265\/HEVC 编码\*\*/)[0])
   }else put('constraints','4K 使用 H.265/HEVC 10bit 编码，部分播放器或浏览器可能无法直接播放。',match(/4K 视频采用 H\.265\/HEVC 编码格式输出，部分播放器或浏览器可能无法直接播放/)[0])
   sourceNote='所列为火山方舟对应系列与日期版本的接口规格；AA 未披露是否采用同一服务端修订，不能将官方可选配置当作榜单评测配置。'
  }else{
  if(id==='doubao-seedream-5-5-261028')match(/doubao-seedream-5-5-261028/)
  const version=id.includes('5-5')?'5.5':'5.0 pro'
  const title=version==='5.5'?version:'5.0 pro / Seedream 5.0 flash'
  const start=`**Seedream ${title}（图片生成场景）**`,s=section(start,`**Seedream ${title}（图层拆分场景）**`)
  const m=match(/可选值：([^\n]+)/,s);put('dimensions',literals(m[1]),m[0])
  const ratio=match(/宽高比取值范围：\[([^\]]+)\]/,s);put('aspectRatio',ratio[1]+'（自定义尺寸）',ratio[0])
  const pixels=match(/总像素取值范围：([^\n]+)/,s);put('constraints',clean(pixels[1]).replaceAll('`','')+'；总像素与宽高比须同时满足。',pixels[0])
  const refs=match(/Seedream 5\.5 \/ 5\.0 pro \/ 5\.0 flash 最多支持传入 (\d+) 张参考图/);put('referenceImages',refs[1]+' 张（图片生成）；图层拆分仅单图',refs[0]);put('imageInput',true,refs[0])
  const intro=section(`* **Seedream ${version}`,version==='5.5'?'* **Seedream 5.0 pro':'* **Seedream 5.0 lite')
  put('imageCount','生成单图：1 张；图层拆分为独立模式，数量限制见原文。',match(/生成单图[\s\S]*?暂不支持组图生成/,intro)[0])
  sourceNote='生成图片与图层拆分分别限制；不把拆分图层数当作批量生成张数。'
  }
 }else if(source==='microsoft'){
  const line=raw.split('\n').find(line=>line.startsWith('| `'+id+'`**Preview**'))
  if(!line)fail('METADATA_IDENTITY_INVALID')
  const minimum=match(/Minimum ([\d×]+) pixels; maximum total pixel count ([\d,]+)/,line)
  put('dimensions',`最小 ${minimum[1]}；最大总像素 ${minimum[2]}（不是单边上限）`,minimum[0])
  const refs=match(/up to (\w+) images/,line);if(refs[1]!=='five')fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
  put('referenceImages','最多 5 张（JPEG / PNG）',refs[0]);put('imageInput',true,refs[0])
  put('imageCount','1',match(/\*\*Output:\*\* One image/,line)[0]);put('outputFormat',['png'],match(/Response formats:\*\* Image \(PNG\)/,line)[0])
  sourceNote='微软官方目录将此版本标记为 Preview；资料适用于 Azure 接口，不代表 AA 披露了相同服务端修订。'
 }else if(source==='minimax'){
  const block=match(/`{4}yaml[^\n]*\n([\s\S]+?)\n`{4}/)[1],root=YAML.parse(block),schemas=root.components?.schemas||{}
  const schema=Object.values(schemas).find(s=>s.properties?.model?.enum?.includes(id)&&s.properties?.prompt||s.properties?.model?.enum?.includes(id)&&s.properties?.content)
  const p=schema?.properties;if(!p)fail('METADATA_IDENTITY_INVALID')
  if(['MiniMax-H3','MiniMax-H3-Max'].includes(id)){
   const res=match(new RegExp('\\*\\*`'+id+'`\\*\\*: ([^\\n]+)'),p.resolution.description);put('dimensions',literals(res[1]).filter(v=>v!=='2K'||id==='MiniMax-H3'),res[0])
   const duration=match(new RegExp('\\*\\*`'+id+'`\\*\\*: `(\\d+)`[–—-]`(\\d+)`'),p.duration.description);put('duration',`${duration[1]} – ${duration[2]} 秒`,duration[0])
   put('aspectRatio',p.ratio.enum,p.ratio.description);if(p.generate_audio?.type!=='boolean')fail('METADATA_DOCUMENT_SCHEMA_CHANGED');put('audioControl',true,p.generate_audio.description)
   put('imageInput',true,match(/Image-to-video[\s\S]{0,180}first_frame/,p.ratio.description)[0])
   put('constraints','文生视频需指定比例且不接受 adaptive；首尾帧模式按输入图比例，传入其他比例也会忽略。',p.ratio.description)
   sourceNote=id==='MiniMax-H3'?'榜单名称中的 768p 是评测配置；这里列官方 API 可选参数，不代表 AA 使用了 2K。':'官方 H3 Max 规格；AA 榜单的厂商字段是 Fal，不据此认定其托管配置、价格与官方 API 完全相同。'
  }else{
   if(!p.area?.enum||!p.n?.maximum)fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
   put('dimensions',p.area.enum,p.area.description);put('imageCount',`${p.n.minimum} – ${p.n.maximum}`,p.n.description)
   put('aspectRatio','1:3 – 3:1；auto 或自定义整数比例，组合条件见原文。',match(/ratio is between\s+1:3 and 3:1/,p.aspect_ratio.description)[0])
   put('outputFormat',p.output_format.enum,p.output_format.description)
   put('imageInput',true,match(/1 to 16 reference images/)[0]);put('referenceImages','1 – 16 张',fieldEvidence.imageInput)
  }
 }
 if(!Object.keys(fields).length)fail('METADATA_DOCUMENT_SCHEMA_CHANGED')
 return {sourceName:spec.label+' · '+id,revision:createHash('sha256').update(JSON.stringify({fields,fieldEvidence,sourceNote})).digest('hex'),sourceCreatedAt:null,sourceUpdatedAt:null,fields,fieldEvidence,...(sourceNote?{sourceNote}:{})}
}
