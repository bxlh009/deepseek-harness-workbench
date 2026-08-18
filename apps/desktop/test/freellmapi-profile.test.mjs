import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ensureFreeLlmProfile } from '../src/freellmapi-profile.mjs'

test('adds the embedded gateway without exposing its key or replacing existing providers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-freellmapi-profile-'))
  const settingsPath = join(root, 'settings.yaml')
  await writeFile(settingsPath, [
    '# keep this user comment',
    'llm-pi-ai:',
    '  providers:',
    '    longcat:',
    '      baseURL: https://api.longcat.chat/openai',
    '      models:',
    '        - id: LongCat-2.0',
    '',
  ].join('\n'), 'utf8')

  try {
    const outcome = await ensureFreeLlmProfile({
      settingsPath,
      connection: {
        baseURL: 'http://127.0.0.1:31415/v1',
        apiKey: 'local-secret-that-must-not-be-written',
      },
      fetchImpl: async (url, init) => {
        assert.equal(url, 'http://127.0.0.1:31415/v1/models')
        assert.equal(init.headers.Authorization, 'Bearer local-secret-that-must-not-be-written')
        assert.ok(init.signal instanceof AbortSignal)
        return new Response(JSON.stringify({
          data: [
            { id: 'free/text-model' },
            { id: 'free/vision-model', name: 'Free Vision' },
          ],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    })

    assert.deepEqual(outcome, { modelCount: 2 })
    const saved = await readFile(settingsPath, 'utf8')
    assert.match(saved, /# keep this user comment/)
    assert.match(saved, /longcat:/)
    assert.match(saved, /freellmapi:/)
    assert.match(saved, /apiKeyEnv: FREELLMAPI_API_KEY/)
    assert.match(saved, /baseURL: http:\/\/127\.0\.0\.1:31415\/v1/)
    assert.match(saved, /id: free\/text-model/)
    assert.match(saved, /id: free\/vision-model/)
    assert.doesNotMatch(saved, /local-secret-that-must-not-be-written/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('passes an explicit discovery timeout signal to the gateway', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-freellmapi-profile-timeout-'))
  const settingsPath = join(root, 'settings.yaml')
  const controller = new AbortController()

  try {
    await ensureFreeLlmProfile({
      settingsPath,
      connection: { baseURL: 'http://127.0.0.1:31415/v1', apiKey: 'secret' },
      signal: controller.signal,
      fetchImpl: async (_url, init) => {
        assert.equal(init.signal, controller.signal)
        return new Response(JSON.stringify({ data: [{ id: 'free/model' }] }), { status: 200 })
      },
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('refuses an empty or malformed model listing without touching settings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-desktop-freellmapi-profile-invalid-'))
  const settingsPath = join(root, 'settings.yaml')
  const original = 'locale:\n  preference: zh\n'
  await writeFile(settingsPath, original, 'utf8')

  try {
    await assert.rejects(
      ensureFreeLlmProfile({
        settingsPath,
        connection: { baseURL: 'http://127.0.0.1:31415/v1', apiKey: 'secret' },
        fetchImpl: async () => new Response(JSON.stringify({ data: [{ nope: true }] }), { status: 200 }),
      }),
      /did not return any valid models/,
    )
    assert.equal(await readFile(settingsPath, 'utf8'), original)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
