#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(pluginRoot, '../..')
const serverPath = join(pluginRoot, 'mcp', 'server.mjs')
const workspace = await mkdtemp(join(repoRoot, '.deepseek-harness-plugin-smoke-'))
const planFile = join(workspace, 'plan.json')
const child = spawn(process.execPath, [serverPath], {
  cwd: repoRoot,
  env: {
    ...process.env,
    DSH_CWD: workspace,
    DSH_REPO_ROOT: repoRoot,
    DSH_PLAN_FILE: planFile,
    DSH_RUNTIME_TIMEOUT_MS: '30000',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
})

let output = ''
let errorOutput = ''
let inputBuffer = ''
let nextId = 1
const pending = new Map()

child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
child.stdout.on('data', chunk => {
  inputBuffer += String(chunk)
  while (true) {
    const newline = inputBuffer.indexOf('\n')
    if (newline < 0) break
    const line = inputBuffer.slice(0, newline).trim()
    inputBuffer = inputBuffer.slice(newline + 1)
    if (!line) continue
    output += `${line}\n`
    const frame = JSON.parse(line)
    const request = pending.get(frame.id)
    if (request === undefined) continue
    pending.delete(frame.id)
    request.resolve(frame)
  }
})
child.stderr.on('data', chunk => { errorOutput += String(chunk) })

function request(method, params) {
  const id = nextId++
  return new Promise((resolveRequest, rejectRequest) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      rejectRequest(new Error(`timed out waiting for ${method}\nstderr:\n${errorOutput}`))
    }, 45000)
    pending.set(id, {
      resolve: frame => {
        clearTimeout(timer)
        resolveRequest(frame)
      },
      reject: rejectRequest,
    })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })}\n`)
  })
}

async function call(name, args = {}) {
  const frame = await request('tools/call', { name, arguments: args })
  assert.equal(frame.error, undefined, `${name} returned a JSON-RPC error`)
  return frame.result
}

try {
  const initialize = await request('initialize', { clientInfo: { name: 'plugin-smoke', version: '0.1.0' } })
  assert.equal(initialize.result.serverInfo.name, 'deepseek-harness')

  const listed = await request('tools/list')
  assert.deepEqual(
    listed.result.tools.map(tool => tool.name),
    ['dsh_status', 'dsh_start_session', 'dsh_plan', 'dsh_prompt', 'dsh_stop'],
  )

  const initialStatus = await call('dsh_status')
  assert.equal(initialStatus.isError, false)
  assert.equal(initialStatus.structuredContent.plan.active, false)

  const startedPlan = await call('dsh_plan', { action: 'start', objective: 'Verify the plugin plan gate' })
  assert.equal(startedPlan.structuredContent.active, true)
  assert.equal(startedPlan.structuredContent.approved, false)

  const blocked = await call('dsh_prompt', { prompt: 'This must not reach the model runtime.' })
  assert.equal(blocked.isError, true)
  assert.match(blocked.content[0].text, /plan mode is active/)

  const updatedPlan = await call('dsh_plan', {
    action: 'update',
    plan: '# Plugin smoke plan\n\n- Inspect MCP discovery.\n- Verify plan blocking.\n- Start and stop the keyless runtime.\n- Record acceptance evidence.',
    items: [
      { id: 'inspect', title: 'Inspect MCP discovery' },
      { id: 'gate', title: 'Verify plan blocking' },
      { id: 'runtime', title: 'Start and stop the keyless runtime' },
    ],
  })
  assert.equal(updatedPlan.structuredContent.active, true)
  assert.equal(updatedPlan.structuredContent.approved, false)

  const approvedPlan = await call('dsh_plan', { action: 'approve' })
  assert.equal(approvedPlan.structuredContent.active, false)
  assert.equal(approvedPlan.structuredContent.approved, true)
  const persisted = JSON.parse(await readFile(planFile, 'utf8'))
  assert.equal(persisted.approved, true)

  const startedRuntime = await call('dsh_start_session', { sessionId: 'plugin-smoke-session' })
  assert.equal(startedRuntime.isError, false)
  assert.equal(startedRuntime.structuredContent.serverInfo.name, 'deepseek-harness-sdk-runtime')

  const stoppedRuntime = await call('dsh_stop')
  assert.equal(stoppedRuntime.structuredContent.stopped, true)

  child.stdin.end()
  await new Promise((resolveExit, rejectExit) => {
    const timer = setTimeout(() => rejectExit(new Error(`server did not exit\n${errorOutput}`)), 10000)
    child.once('exit', code => {
      clearTimeout(timer)
      assert.equal(code, 0)
      resolveExit()
    })
  })
  assert.match(output, /deepseek-harness/)
  process.stdout.write('deepseek-harness plugin smoke: PASS\n')
} finally {
  for (const requestState of pending.values()) requestState.reject(new Error('smoke test finished'))
  pending.clear()
  if (child.exitCode === null) child.kill()
  await rm(workspace, { recursive: true, force: true })
}
