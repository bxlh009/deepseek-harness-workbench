import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { FreeLlmSupervisor } from '../src/freellmapi-supervisor.mjs'

test('owns an embedded FreeLLMAPI sidecar for the lifetime of the desktop app', async () => {
  const fixture = fileURLToPath(new URL('./fixtures/fake-freellmapi-sidecar.mjs', import.meta.url))
  const supervisor = new FreeLlmSupervisor({
    entry: fixture,
    runtimeRoot: dirname(fixture),
    dataDirectory: resolve('D:/codex/.codex/fake-freellmapi-data'),
    nodeCommand: process.env.DSH_TEST_NODE_RUNTIME ?? process.execPath,
  })

  const info = await supervisor.start()
  assert.match(info.baseURL, /^http:\/\/127\.0\.0\.1:\d+\/v1$/)
  assert.match(info.dashboardURL, /^http:\/\/127\.0\.0\.1:\d+\/dashboard$/)
  assert.equal(supervisor.running, true)

  await supervisor.stop()
  assert.equal(supervisor.running, false)
})
