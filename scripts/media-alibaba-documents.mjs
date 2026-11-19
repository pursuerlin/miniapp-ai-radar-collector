// Exact reviewed Model Studio documents. Never infer adjacent model versions.
export function alibabaDocument(raw,id,{put,match,section}){
 const model=id.replace(/-pricing$/,'');let sourceNote
 if(id.endsWith('-pricing')){
  if(!raw.startsWith('# '+model+'\n'))throw Object.assign(Error('METADATA_IDENTITY_INVALID'),{code:'METADATA_IDENTITY_INVALID'})
  const priceBlock=raw.slice(raw.indexOf('## Pricing')),s=section('<Tab title="China (Beijing)">','</Tab>',priceBlock)
  match(/(?:Price|Input and output price) \(USD\)/,s)
  const combinedVideo=model==='wan3.0-video'&&s.includes('Input and output price (USD)')
  if(combinedVideo)match(/Billable duration = input video duration \+ output video duration\./,priceBlock)
  const rows=[...s.matchAll(/<tr><td><p>([^<]+)<\/p><\/td><td><p>(\d+(?:\.\d+)?)<\/p><\/td><td><p>(Per image|Per second)<\/p><\/td><\/tr>/g)]
  const images=model.startsWith('qwen'),outputs=rows.filter(m=>images?/Image\s*(?:Generation|Output)/i.test(m[1]):/Video\s*Generation/i.test(m[1])),inputs=rows.filter(m=>/Image\s*Input/i.test(m[1]))
  if(outputs.length!==(images?2:model.startsWith('happyhorse-1.0')?2:3)||images&&inputs.length!==2||new Set(outputs.map(m=>m[1])).size!==outputs.length)throw Object.assign(Error('METADATA_DOCUMENT_SCHEMA_CHANGED'),{code:'METADATA_DOCUMENT_SCHEMA_CHANGED'})
  const render=m=>{const tier=match(/(\d+K|\d+P)/i,m[1])[1];if(m[3]!== (images?'Per image':'Per second'))throw Object.assign(Error('METADATA_DOCUMENT_SCHEMA_CHANGED'),{code:'METADATA_DOCUMENT_SCHEMA_CHANGED'});return `${tier}：US$${m[2]} / ${images?'张':'秒'}`}
  put('billingBasis','百炼北京地域 · 美元 · 官方原价',s.slice(0,250));put('referencePrice',outputs.map(render).join('；'),outputs.map(m=>m[0]).join(' '))
  if(inputs.length)put('imageInputPrice',inputs.map(render).join('；'),inputs.map(m=>m[0]).join(' '))
  sourceNote='仅适用于阿里云百炼北京地域的所列版本与规格，不含限时优惠；其他地域和渠道价格不同，不能当作 AA 评测费用。'+(images?'图片输入另计，不能把输出单价当作总费用。':'按视频时长计费，其他输入或功能费用以实际账单和原文为准。')
  if(combinedVideo)sourceNote+='输入视频和输出视频均按输出分辨率对应的每秒价格计费；计费时长为输入与输出视频时长之和。'
 }else if(model.startsWith('qwen-image')){
  match(/qwen-image-3\.0-pro/)
  const sizes=match(/qwen-image-3\.0 series, qwen-image-2\.1 series<\/strong>: ([^\n]+)/)
  // This page describes a pixel-area tier: its table contains non-square edges >2048.
  match(/512\\\*512 to 2048\\\*2048, aspect ratio 1:8 to 8:1/,sizes[0])
  put('dimensions','512×512 – 2048×2048 像素档位；非方形尺寸见原文',sizes[0]);put('aspectRatio','1:8 – 8:1',sizes[0])
  const n=match(/qwen-image-3\.0 and qwen-image-2\.1 series support (\d+) to (\d+) images/)
  put('imageCount',`${n[1]} – ${n[2]}`,n[0]);sourceNote='仅为文生图接口选项；尺寸不是单边上限，原文比例表含非方形组合。不套用到图片编辑模式，也不把 Wan 的 4K/12 张选项套给 Qwen。'
 }else if(model==='wan3.0-video'){
  match(/"model": "wan3\.0-video"/)
  const resolution=section('<strong>resolution</strong>','<strong>ratio</strong>');put('dimensions',[...new Set(literals(resolution).filter(v=>/^\d+P$/.test(v)))],resolution)
  const ratio=section('<strong>ratio</strong>','<strong>duration</strong>');put('aspectRatio',literals(ratio).filter(v=>/^(?:adaptive|\d+:\d+)$/.test(v)),ratio)
  const duration=match(/Without video input: an integer in the range \\\[(\d+), (\d+)\]/);put('duration',`${duration[1]} – ${duration[2]} 秒（无视频输入）`,duration[0])
  put('fps',match(/up to 30 seconds long at (\d+)fps/)[1],match(/up to 30 seconds long at \d+fps/)[0])
  put('imageInput',true,match(/`first_frame`: First frame image\. Maximum 1 image/)[0]);put('referenceImages','首帧/尾帧各最多 1 张；参考模式最多 10 张',match(/`reference_image`: Reference image\. Maximum 10 images/)[0])
  put('audioControl',true,section('<strong>audio</strong>','<strong>seed</strong>'));put('seedControl',true,section('<strong>seed</strong>','<strong>prompt\\_extend</strong>'))
  put('constraints','首尾帧与多模态参考素材不可混用；有输入视频时，输入+输出总时长不超过 30 秒。',match(/With video input: [^\n]+/)[0]);sourceNote='官方文档标记 Preview，示例为新加坡地域；参数不是 AA 的实际测试配置。未将文档中的典型耗时视为实测延迟。'
 }else if(model.startsWith('happyhorse')){
  const image=model.endsWith('-i2v'),version=model.includes('1.1')?'1.1':'1.0'
  match(new RegExp('happyhorse-'+version.replace('.','\\.')+'-'+(image?'i2v':'t2v')))
  const res=section('<strong>resolution</strong>',image?'<strong>duration</strong>':'<strong>ratio</strong>');put('dimensions',literals(res).filter(v=>/^\d+P$/.test(v)),res)
  if(image){put('imageInput',true,match(/Exactly one first-frame image is required/)[0]);put('referenceImages','1 张首帧',match(/first.frame/i)[0]);put('aspectRatio','跟随输入图片',match(/preserving the input image's aspect ratio/)[0]);const duration=match(/integer in the range \\\[(\d+), (\d+)\]/);put('duration',`${duration[1]} – ${duration[2]} 秒`,duration[0])}
  else{const ratio=section('<strong>ratio</strong>','<strong>duration</strong>');put('aspectRatio',literals(ratio).filter(v=>/^(?:adaptive|\d+:\d+)$/.test(v)),ratio);if(version==='1.0'){const duration=match(/happyhorse-1\.0-t2v: (\d+)–(\d+)/);put('duration',`${duration[1]} – ${duration[2]} 秒`,duration[0])}}
  put('seedControl',true,match(/fixed seed improves reproducibility/)[0]);sourceNote='仅适用于百炼所列版本的'+(image?'首帧图生视频':'文生视频')+'接口；不套用参考生视频或编辑模式。'+(!image&&version==='1.1'?'该页时长仅明确列出 1.0，因此 1.1 时长仍待核实。':'')
 }
 return sourceNote
}
const literals=s=>[...s.matchAll(/`([^`\n]+)`/g)].map(m=>m[1])
