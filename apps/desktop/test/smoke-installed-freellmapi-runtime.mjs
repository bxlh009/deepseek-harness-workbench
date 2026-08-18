import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { FreeLlmSupervisor } from '../src/freellmapi-supervisor.mjs'
import { ensureFreeLlmProfile } from '../src/freellmapi-profile.mjs'

const [resourcesDirectory, dataDirectory] = process.argv.slice(2)
if (resourcesDirectory === undefined || dataDirectory === undefined) {
  throw new Error('usage: smoke-installed-freellmapi-runtime.mjs <resources-directory> <data-directory>')
}

const resourcesRoot = resolve(resourcesDirectory)
const runtimeRoot = join(resourcesRoot, 'freellmapi')
const entry = join(resourcesRoot, 'freellmapi-sidecar.mjs')
const nodeCommand = join(resourcesRoot, 'runtime.asar.unpacked', 'node.exe')

for (const required of [entry, nodeCommand, join(runtimeRoot, 'server.mjs')]) {
  assert.equal(existsSync(required), true, `installed desktop resource is missing: ${required}`)
}

const supervisor = new FreeLlmSupervisor({
  entry,
  runtimeRoot,
  dataDirectory: resolve(dataDirectory),
  nodeCommand,
})

try {
  const info = await supervisor.start()
  const response = await fetch(`${info.baseURL}/models`, {
    headers: { authorization: `Bearer ${info.apiKey}` },
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body.data))
  assert.ok(body.data.length > 0, 'installed FreeLLMAPI runtime should advertise models')
  const settingsPath = join(resolve(dataDirectory), 'settings.yaml')
  writeFileSync(settingsPath, '# installed-runtime smoke\nlocale:\n  preference: zh\n', 'utf8')
  const profile = await ensureFreeLlmProfile({ settingsPath, connection: info })
  const settings = readFileSync(settingsPath, 'utf8')
  assert.match(settings, /# installed-runtime smoke/)
  assert.match(settings, /freellmapi:/)
  assert.match(settings, /apiKeyEnv: FREELLMAPI_API_KEY/)
  assert.doesNotMatch(settings, new RegExp(info.apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.equal(profile.modelCount, body.data.length)
  console.log(JSON.stringify({ status: response.status, modelCount: body.data.length, profileWritten: true }))
} finally {
  await supervisor.stop()
  rmSync(resolve(dataDirectory), { recursive: true, force: true })
}
