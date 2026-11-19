import { readFile } from 'node:fs/promises'

// One place for the patterns that keep credentials out of anything a card or a log
// summary can quote: CLI argument values, capability URLs and the literal tokens
// carried in lark-cli error bodies.
export function redactCliText(value) {
  return String(value ?? '')
    .replace(/--(base-token|table-id|app-id|app-secret)\s+\S+/g, '--$1 <redacted>')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\s+/g, ' ')
    .trim()
}

let configured
async function configValues(path) {
  if (configured) return configured
  const values = []
  try {
    const config = JSON.parse(await readFile(path, 'utf8'))
    values.push(config.baseToken, config.tableId)
  } catch { /* no config to leak */ }
  values.push(process.env.FEISHU_APP_ID, process.env.FEISHU_APP_SECRET)
  configured = values.filter(value => typeof value === 'string' && value.length > 5)
  return configured
}

export async function redactDiagnostic(value, configPath = 'scripts/config/feishu-base.json', limit = 200) {
  const text = redactCliText(value)
  const masked = (await configValues(configPath)).reduce((acc, secret) => acc.split(secret).join('<redacted>'), text)
  return masked.slice(0, limit)
}
