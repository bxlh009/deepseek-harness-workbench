import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FreeLlmSupervisor } from '../src/freellmapi-supervisor.mjs'

const [runtimeRoot, dataDirectory, nodeCommand] = process.argv.slice(2)
if (runtimeRoot === undefined || dataDirectory === undefined || nodeCommand === undefined) {
  throw new Error('usage: smoke-freellmapi-runtime.mjs <runtime-root> <data-directory> <node-command>')
}

const supervisor = new FreeLlmSupervisor({
  entry: fileURLToPath(new URL('../src/freellmapi-sidecar.mjs', import.meta.url)),
  runtimeRoot: resolve(runtimeRoot),
  dataDirectory: resolve(dataDirectory),
  nodeCommand: resolve(nodeCommand),
})

try {
  const info = await supervisor.start()
  const dashboard = await fetch(info.dashboardURL)
  assert.equal(dashboard.status, 200)
  const models = await fetch(`${info.baseURL}/models`, {
    headers: { authorization: `Bearer ${info.apiKey}` },
  })
  assert.equal(models.status, 200)
  const body = await models.json()
  assert.ok(Array.isArray(body.data))
  console.log(JSON.stringify({
    baseURL: info.baseURL,
    dashboardStatus: dashboard.status,
    modelsStatus: models.status,
    modelCount: body.data.length,
  }))
} finally {
  await supervisor.stop()
}
