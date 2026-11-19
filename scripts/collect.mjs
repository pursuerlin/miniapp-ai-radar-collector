import {httpResponseError} from './request-errors.mjs'
import { validIntelligence } from '../src/domain/intelligence.mjs';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';

export function parseUsage(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/g)].flatMap(m => {
    try { const v = JSON.parse(m[1]); return v[0] === 1 ? [v[1]] : []; } catch { return []; }
  }).join('');
  const result = {};
  for (const line of chunks.split('\n')) {
    if (!line.includes('total_prompt_tokens')) continue;
    let obj; try { obj = JSON.parse(line.slice(line.indexOf(':') + 1)); } catch { continue; }
    const queries = obj?.[3]?.state?.queries || [];
    for (const q of queries) {
      const key = q.queryKey;
      if (key?.[0] !== 'rankings' || key[1] !== 'models' || !['day', 'week', 'month'].includes(key[2]?.view)) continue;
      const rows = q.state?.data;
      if (!Array.isArray(rows) || !rows.length) continue;
      result[key[2].view] = rows.map(r => {
        const input = Number(r.total_prompt_tokens), output = Number(r.total_completion_tokens);
        if (!r.model_permaslug || !Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) throw Error('用量字段异常');
        return { slug: r.model_permaslug, variant: r.variant, tokens: input + output, input, output, date: r.date, requests: r.count };
      }).sort((a, b) => b.tokens - a.tokens);
    }
  }
  if (!result.week?.length) throw Error('未发现周榜，保留旧快照；公开页面结构可能变化');
  return result;
}
export function normalizeModel(m) {
  const price = v => v == null || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v) * 1e6;
  return { id: m.id, slug: m.canonical_slug || m.id, name: m.name, provider: m.id.split('/')[0], created: m.created,
    description: m.description || '', context: m.context_length || null, maxOutput: m.top_provider?.max_completion_tokens || null,
    input: price(m.pricing?.prompt), output: price(m.pricing?.completion), cache: price(m.pricing?.input_cache_read),
    modalities: m.architecture?.input_modalities || [], outputModalities: m.architecture?.output_modalities || [],
    parameters: m.supported_parameters || [], source: `https://openrouter.ai/${m.id}` };
}
async function get(url, json = false) {
  const res = await fetch(url, { headers: { 'User-Agent': 'AI-Radar-Research/0.1' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw httpResponseError(res);
  return json ? res.json() : res.text();
}
async function main() {
  const [catalog, html] = await Promise.all([get('https://openrouter.ai/api/v1/models', true), get('https://openrouter.ai/rankings')]);
  const models = catalog.data.map(normalizeModel).filter(m => m.id && m.name);
  if (models.length < 30 || new Set(models.map(m => m.id)).size !== models.length) throw Error('目录校验失败');
  const usage = parseUsage(html);
  const snapshot = { schemaVersion: 1, collectedAt: new Date().toISOString(), catalogSource: 'https://openrouter.ai/api/v1/models',
    usageSource: 'https://openrouter.ai/rankings', usageDefinition: 'OpenRouter 公开榜单中的输入 + 输出 Token；按模型版本与免费/标准变体分别统计。仅代表该平台，非全网用量。',
    models, usage };
  try { const intelligence = JSON.parse(await readFile('src/data/intelligence.json', 'utf8')); if (!validIntelligence(intelligence)) throw Error('资讯快照校验失败'); snapshot.intelligence = intelligence; } catch (e) { throw Error('请先运行 collect:intelligence：' + e.message); }
  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/snapshot.next.json', JSON.stringify(snapshot));
  await rename('src/data/snapshot.next.json', 'src/data/snapshot.json');
  console.log(`已采集 ${models.length} 个模型；${Object.entries(usage).map(([k,v])=>`${k}: ${v.length}`).join(', ')}。未发布至外部。`);
}
if (process.argv[1]?.endsWith('collect.mjs')) main().catch(e => { console.error(e.message); process.exitCode = 1; });
