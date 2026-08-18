import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseDocument } from 'yaml'

const PROVIDER_ROUTE = 'freellmapi'
const CREDENTIAL_REF = 'FREELLMAPI_API_KEY'

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return ''
    throw error
  }
}

async function writeAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = join(dirname(path), `.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`)
  try {
    await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

function modelRows(payload) {
  if (typeof payload !== 'object' || payload === null || !Array.isArray(payload.data)) return []
  const seen = new Set()
  return payload.data.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (id.length === 0 || seen.has(id)) return []
    seen.add(id)
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    return [{ id, ...name.length === 0 ? {} : { name } }]
  })
}

/**
 * Discover the models served by the desktop-owned gateway and persist a
 * provider profile while keeping the generated key out of the settings file.
 */
export async function ensureFreeLlmProfile({
  settingsPath,
  connection,
  fetchImpl = fetch,
  signal = AbortSignal.timeout(10_000),
}) {
  const endpoint = `${connection.baseURL.replace(/\/+$/, '')}/models`
  const response = await fetchImpl(endpoint, {
    headers: { Authorization: `Bearer ${connection.apiKey}` },
    signal,
  })
  if (!response.ok) {
    throw new Error(`FreeLLMAPI model discovery failed with HTTP ${String(response.status)}.`)
  }
  const models = modelRows(await response.json())
  if (models.length === 0) throw new Error('FreeLLMAPI did not return any valid models.')

  const original = await readOptional(settingsPath)
  const document = parseDocument(original.length === 0 ? '{}\n' : original)
  if (document.errors.length > 0) {
    throw new Error(`Cannot add FreeLLMAPI because the desktop settings file is invalid: ${document.errors[0].code}.`)
  }
  const root = document.toJS()
  if (typeof root !== 'object' || root === null || Array.isArray(root)) {
    throw new Error('Cannot add FreeLLMAPI because the desktop settings file root is not a map.')
  }
  document.setIn(['llm-pi-ai', 'providers', PROVIDER_ROUTE], {
    displayName: 'FreeLLMAPI',
    apiKeyEnv: CREDENTIAL_REF,
    api: 'openai-completions',
    baseURL: connection.baseURL,
    models,
  })
  await writeAtomic(settingsPath, document.toString())
  return { modelCount: models.length }
}
