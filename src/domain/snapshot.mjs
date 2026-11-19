import { validIntelligence } from './intelligence.mjs';
import { validOnlineData } from './online-data.mjs';
export function newerSnapshot(next, current, currentManifest) {
  const nextTime = Date.parse(next.collectedAt), currentTime = Date.parse(current.collectedAt)
  if (nextTime < currentTime) return false
  if (nextTime > currentTime) return true
  return !!next.onlineData && Date.parse(next.onlineData.manifest.generatedAt) >
    Date.parse((current.onlineData?.manifest || currentManifest)?.generatedAt)
}
export function validSnapshot(data) {
  const s = data;
  // v2 lets model data update independently of the separately validated news module.
  // v1 launch/cache payloads still require their attached news to be valid.
  return (!s?.onlineData || validOnlineData(s.onlineData)) && (s?.schemaVersion===2&&!s.intelligence||validIntelligence(s?.intelligence)) && [1,2].includes(s?.schemaVersion) && Number.isFinite(Date.parse(s.collectedAt)) &&
    typeof s.catalogSource === 'string' && typeof s.usageSource === 'string' && typeof s.usageDefinition === 'string' &&
    Array.isArray(s.models) && s.models.length > 0 &&
    new Set(s.models.map(m=>m?.id)).size === s.models.length &&
    s.models.every(m => m && typeof m.id === 'string' && typeof m.name === 'string' && typeof m.slug === 'string' && typeof m.provider === 'string' && typeof m.description === 'string' && typeof m.source === 'string' && m.source.startsWith('https://') &&
      Number.isFinite(m.created) && [m.context,m.maxOutput,m.input,m.output,m.cache].every(v => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0) &&
      ['modalities','outputModalities','parameters'].every(k=>Array.isArray(m[k]) && m[k].every(v=>typeof v==='string'))) &&
    Array.isArray(s.usage?.week) && s.usage.week.length > 0 && s.usage.week.every(r => r && typeof r.slug === 'string' && typeof r.variant === 'string' && typeof r.date === 'string' && ['tokens','input','output'].every(k=>typeof r[k]==='number' && Number.isFinite(r[k]) && r[k]>=0));
}
