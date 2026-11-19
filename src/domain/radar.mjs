export function resolveUsage(rows, models, metric = 'tokens') {
  const key = ['tokens', 'input', 'output'].includes(metric) ? metric : 'tokens';
  return rows.map(r => {
    const m = models.find(m => m.slug === r.slug && (r.variant === 'free' ? m.id.endsWith(':free') : !m.id.endsWith(':free') && !m.id.endsWith(':batch')));
    const fallback = r.slug.split('/').pop().replace(/-\d{8}$/, '').replaceAll('-', ' ');
    return { ...r, modelId: m?.id || null, name: m?.name || fallback, provider: m?.provider || r.slug.split('/')[0], weightStatus:m?.weightStatus||'unknown', value: r[key] };
  }).sort((a,b) => b.value - a.value);
}
import { providerKey, providerLabel } from './providers.mjs';

export function filterModels(models, { query = '', capability = 'all', provider = 'all', sort = 'new' } = {}) {
  const q = query.trim().toLowerCase();
  const required = capability === 'all' ? [] : capability.split(',');
  return models.filter(m => (!q || `${m.name} ${m.id} ${m.provider} ${providerLabel(m.provider)}`.toLowerCase().includes(q)) &&
    (provider === 'all' || providerKey(m.provider) === provider) &&
    required.every(feature => feature === 'vision' ? m.modalities.includes('image') : feature === 'tools' ? m.parameters.includes('tools') : feature === 'free' ? m.input === 0 && m.output === 0 : false))
    .sort((a,b) => sort === 'price' ? (a.input ?? Infinity) - (b.input ?? Infinity) : sort === 'context' ? (b.context || 0) - (a.context || 0) : b.created - a.created);
}
/**
 * @param {any} model
 * @param {string|number} requests  @param {string|number} input  @param {string|number} output
 * @param {string|number} days      @param {string|number} cacheRate  0-100, ignored without a published cache price
 */
export function estimateCost(model, requests, input, output, days = 30, cacheRate = 0) {
  // The cache field is optional: an empty input means no cache hits, not invalid usage.
  const cache = cacheRate == null || typeof cacheRate === 'string' && !cacheRate.trim() ? 0 : cacheRate;
  const raw = [requests, input, output, days, cache];
  if (raw.some(v => v == null || typeof v === "string" && !v.trim())) return null;
  const values = raw.map(Number);
  if (values.some(v => !Number.isFinite(v) || v < 0) || values[3] <= 0 || values[4] > 100 || !model || model.input == null || model.output == null) return null;
  const [req, inp, out, d, rate] = values;
  // A cache hit only saves money where the source publishes a cache-read price; without
  // it the rate is ignored rather than guessed from the input price.
  const hasCache = model.cache !== null && model.cache !== undefined && Number.isFinite(Number(model.cache));
  const hit = hasCache ? rate / 100 : 0;
  const effectiveInput = hit > 0 ? (1 - hit) * model.input + hit * Number(model.cache) : model.input;
  const cost = req * d * (inp * effectiveInput + out * model.output) / 1e6;
  return Number.isFinite(cost) ? cost : null;
}

// Catalog providers spell JSON-schema output differently; none of these is a guarantee
// of task quality, but all of them mean the model accepts a structured response.
export function supportsStructuredOutput(model) {
  const parameters = model?.parameters || [];
  return ['response_format', 'structured_outputs', 'json_schema'].some(key => parameters.includes(key));
}

// Lets the UI say honestly that a requested hit rate had no effect for this model.
// Note that a missing cache price is published as null, and Number(null) is 0.
export function cacheApplied(model, cacheRate) {
  const cache = model?.cache;
  const hasCache = cache !== null && cache !== undefined && cache !== '' && Number.isFinite(Number(cache));
  return Number(cacheRate) > 0 && Number(cacheRate) <= 100 && hasCache;
}
export function tokenLabel(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e12) return `${(n/1e12).toFixed(2)} T`;
  if (n >= 1e9) return `${(n/1e9).toFixed(2)} B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(2)} M`;
  return n.toLocaleString('en-US');
}
export function toggleCompare(ids, id) {
  if (ids.includes(id)) return ids.filter(v => v !== id);
  if (ids.length >= 3) throw Error('最多比较 3 个模型，请先移除一个');
  return [...ids, id];
}
export function validateFavorites(value) {
  if (!Array.isArray(value)) return [];
  // A model can leave one snapshot and return in the next, so ids are kept even
  // when the current catalog cannot show them; pruning here lost saved models.
  return [...new Set(value.filter(id => typeof id === 'string' && id))];
}

// Text output is always required. Optional capabilities compose with AND semantics.
export function normalizeSelectionTask(value) {
  const selected = typeof value === 'string' ? value.split(',') : [];
  return ['tools', 'vision'].filter(key => selected.includes(key)).join(',') || 'all';
}
