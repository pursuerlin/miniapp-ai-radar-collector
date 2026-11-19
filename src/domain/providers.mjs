const aliases = {
  'moonshot': 'moonshotai',
  'moonshot ai': 'moonshotai',
  'kimi': 'moonshotai',
  'alibaba': 'qwen',
  'alibaba cloud': 'qwen',
  'z ai': 'z-ai',
  'zhipu': 'z-ai',
  'zhipu ai': 'z-ai',
  'bytedance seed': 'bytedance-seed',
  'inclusion ai': 'inclusionai',
  'ant group': 'inclusionai',
  'x ai': 'x-ai',
  'xai': 'x-ai',
  'spacexai': 'x-ai',
  'meta llama': 'meta',
  'mistral': 'mistralai',
  'mistral ai': 'mistralai',
  'step fun': 'stepfun',
  'mini max': 'minimax',
  'google deepmind': 'google',
  'deepmind': 'google',
  'kwai kat': 'kwaikat',
  'china mobile': 'china-mobile',
  'china telecom': 'china-telecom',
  'china unicom': 'china-unicom',
  '01 ai': '01-ai',
  'nex agi': 'nex-agi',
  'lg ai research': 'lg',
  'institute of foundation models': 'institute-of-foundation-models',
  'allen institute for ai': 'ai2',
  'tii uae': 'tii',
  'nous research': 'nousresearch',
  'arcee ai': 'arcee-ai',
  'liquid ai': 'liquid',
  'reka ai': 'rekaai',
  'thinking machines': 'thinkingmachines',
  'reflection ai': 'reflection',
  'prime intellect': 'prime-intellect',
  'swiss ai initiative': 'swiss-ai-initiative',
  'motif technologies': 'motif-technologies',
  'sk telecom': 'sk-telecom',
  'korea telecom': 'korea-telecom',
  'sapiens ai': 'sapiens-ai',
  'multiverse computing': 'multiverse-computing',
  'ai21 labs': 'ai21',
  'ibm': 'ibm-granite',
  'ibm research': 'ibm-granite'
}

const labels = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  moonshotai: 'Moonshot AI',
  'z-ai': 'Z.ai',
  stepfun: 'StepFun',
  minimax: 'MiniMax',
  xiaomi: 'Xiaomi',
  baidu: 'Baidu',
  bytedance: 'ByteDance',
  'bytedance-seed': 'ByteDance Seed',
  tencent: 'Tencent',
  'xingchen-agi': 'Xingchen AGI',
  hunyuan: 'Hunyuan',
  inclusionai: 'InclusionAI',
  meituan: 'Meituan',
  'x-ai': 'xAI',
  mistralai: 'Mistral AI',
  meta: 'Meta',
  cohere: 'Cohere',
  nvidia: 'NVIDIA',
  openrouter: 'OpenRouter',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
  '01-ai': '01.AI',
  longcat: 'LongCat',
  kwaikat: 'KwaiKAT',
  'china-mobile': 'China Mobile',
  'ibm-granite': 'IBM',
  nousresearch: 'Nous Research',
  'arcee-ai': 'Arcee AI',
  liquid: 'Liquid AI',
  rekaai: 'Reka AI',
  thinkingmachines: 'Thinking Machines',
  'nex-agi': 'Nex AGI',
  perplexity: 'Perplexity',
  fireworks: 'Fireworks',
  upstage: 'Upstage',
  writer: 'Writer',
  reflection: 'Reflection AI',
  'institute-of-foundation-models': 'Institute of Foundation Models',
  'aion-labs': 'Aion Labs',
  'anthracite-org': 'Anthracite',
  'cognitivecomputations': 'Cognitive Computations',
  'dots-studio': 'Dots Studio',
  elorian: 'Elorian',
  gryphe: 'Gryphe',
  inception: 'Inception',
  'inference-net': 'Inference.net',
  mancer: 'Mancer',
  moondream: 'Moondream',
  morph: 'Morph',
  perceptron: 'Perceptron',
  'particle-ai': 'Particle AI',
  poolside: 'Poolside',
  recursive: 'Recursive',
  'prism-ml': 'Prism ML',
  relace: 'Relace',
  sakana: 'Sakana AI',
  sao10k: 'Sao10K',
  scaledown: 'ScaleDown',
  thedrummer: 'TheDrummer',
  typesafe: 'TypeSafe',
  unbiased: 'Unbiased',
  undi95: 'Undi95'
}

const domestic = new Set([
  'qwen', 'deepseek', 'z-ai', 'moonshotai', 'stepfun', 'minimax', 'xiaomi', 'baidu',
  'bytedance', 'bytedance-seed', 'tencent', 'xingchen-agi', 'hunyuan', 'inclusionai',
  'meituan', 'longcat', 'kwaikat', 'china-mobile', 'china-telecom', 'china-unicom',
  '01-ai', 'sensetime', 'iflytek', 'baichuan', 'kuaishou',
  // Nex AGI is initiated by the Shanghai Innovation Institute; Nanbeige comes from
  // BOSS Zhipin's Nanbeige LLM Lab; OpenBMB is the Tsinghua NLP open-model group.
  'nex-agi', 'nanbeige', 'openbmb'
])

const overseas = new Set([
  'openai', 'anthropic', 'google', 'meta', 'meta-llama', 'x-ai', 'mistralai', 'cohere',
  'nvidia', 'amazon', 'microsoft', 'perplexity', 'github', 'openrouter', 'reflection',
  'ai21', 'ai2', 'tii', 'upstage', 'naver', 'lg', 'sk-telecom', 'korea-telecom', 'sarvam',
  'servicenow', 'apodex', 'celeris', 'institute-of-foundation-models', 'swiss-ai-initiative',
  'motif-technologies', 'multiverse-computing', 'prime-intellect', 'thinkingmachines',
  'nousresearch', 'arcee-ai', 'liquid', 'rekaai',
  'ibm-granite', 'sakana', 'fireworks', 'writer', 'poolside'
])

// Only these providers have an independent source we actually collect; anything else
// reports "not connected" instead of borrowing another lab's coverage.
const newsFamilies = { anthropic: 'anthropic', openai: 'openai', google: 'google', github: 'github', deepseek: 'deepseek' }
export function providerNewsFamily(value = '') {
  return newsFamilies[providerKey(value)] || ''
}

export function providerKey(value = '') {
  const normalized = String(value).trim().replace(/^~+/, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, ' ').trim().toLowerCase()
  return aliases[normalized] || normalized.replace(/\s+/g, '-')
}

export function providerLabel(value = '') {
  return labels[providerKey(value)] || String(value).trim().replace(/^~+/, '')
}

export function providerOrigin(value = '') {
  const key = providerKey(value)
  if (domestic.has(key)) return 'domestic'
  if (overseas.has(key)) return 'overseas'
  return 'unknown'
}
