#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const VERSION = '0.1.0'
const PROTOCOL_VERSION = '2025-06-18'
const DEFAULT_MODEL = 'deepseek-v4-flash'
const DEFAULT_TIMEOUT_MS = 120000
const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const tools = [
  {
    name: 'dsh_status',
    title: 'DeepSeek Harness status',
    description: 'Inspect the configured DeepSeek Harness runtime, session, and persisted plan without changing state.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: { type: 'object' },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'dsh_start_session',
    title: 'Start DeepSeek Harness session',
    description: 'Start and initialize the local DeepSeek Harness SDK JSON-RPC runtime.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string', minLength: 1 } },
      additionalProperties: false,
    },
    outputSchema: { type: 'object' },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'dsh_plan',
    title: 'Manage DeepSeek Harness plan',
    description: 'Create, update, inspect, approve, or clear the explicit plan that gates DeepSeek Harness execution.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'start', 'update', 'approve', 'clear'] },
        objective: { type: 'string', minLength: 1 },
        plan: { type: 'string', minLength: 1 },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', minLength: 1 },
              title: { type: 'string', minLength: 1 },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            },
            required: ['id', 'title'],
            additionalProperties: false,
          },
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    outputSchema: { type: 'object' },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'dsh_prompt',
    title: 'Run approved DeepSeek Harness prompt',
    description: 'Send one prompt to the configured DeepSeek Harness session and wait for its activity interval to become idle. Refuses while a plan is active and unapproved.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', minLength: 1 },
        sessionId: { type: 'string', minLength: 1 },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    outputSchema: { type: 'object' },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  {
    name: 'dsh_stop',
    title: 'Stop DeepSeek Harness session',
    description: 'Gracefully shut down the local DeepSeek Harness runtime if it is running.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: { type: 'object' },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
]

function log(message) {
  process.stderr.write(`[deepseek-harness-plugin] ${message}\n`)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`)
  return value.trim()
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive safe integer`)
  return value
}

function parseArgs(value) {
  if (value === undefined || value.trim() === '') return undefined
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch (error) {
    throw new TypeError(`DSH_RUNTIME_ARGS must be a JSON array: ${error.message}`)
  }
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
    throw new TypeError('DSH_RUNTIME_ARGS must be a JSON array of strings')
  }
  return parsed
}

function workspaceCwd() {
  return resolve(process.env.DSH_CWD?.trim() || process.cwd())
}

function findRepoRoot(start) {
  let current = resolve(start)
  while (true) {
    if (existsSync(join(current, 'packages', 'sdk', 'server'))
      && existsSync(join(current, 'examples', 'jsonrpc-agent', 'cordis.yml'))) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function runtimeLaunch() {
  const cwd = workspaceCwd()
  const configuredRoot = process.env.DSH_REPO_ROOT?.trim()
  const root = configuredRoot
    ? resolve(configuredRoot)
    : [
      findRepoRoot(cwd),
      findRepoRoot(join(cwd, 'products', 'deepseek-harness')),
      findRepoRoot(join(cwd, '..', 'products', 'deepseek-harness')),
      findRepoRoot(PLUGIN_ROOT),
    ].find(Boolean)
  const configuredConfig = process.env.DSH_CORDIS_CONFIG?.trim()
  const configPath = configuredConfig
    ? resolve(cwd, configuredConfig)
    : root === undefined ? undefined : join(root, 'examples', 'jsonrpc-agent', 'cordis.yml')
  const explicitCommand = process.env.DSH_RUNTIME_COMMAND?.trim()
  const explicitArgs = parseArgs(process.env.DSH_RUNTIME_ARGS)

  if (explicitCommand) {
    if (explicitArgs !== undefined) return { command: explicitCommand, args: explicitArgs, cwd, configPath }
    if (configPath !== undefined) return { command: explicitCommand, args: [configPath], cwd, configPath }
    throw new Error('DSH_RUNTIME_COMMAND is set but no DSH_RUNTIME_ARGS or DSH_CORDIS_CONFIG was provided')
  }

  if (root === undefined || configPath === undefined || !existsSync(configPath)) {
    throw new Error(
      'DeepSeek Harness runtime was not found; set DSH_REPO_ROOT and optionally DSH_CORDIS_CONFIG, or configure DSH_RUNTIME_COMMAND/DSH_RUNTIME_ARGS',
    )
  }

  const builtBin = join(root, 'packages', 'examples', 'jsonrpc-demo', 'lib', 'bin.js')
  if (existsSync(builtBin)) return { command: process.execPath, args: [builtBin, configPath], cwd: root, configPath }

  const sourceBin = join(root, 'packages', 'examples', 'jsonrpc-demo', 'src', 'bin.ts')
  if (existsSync(sourceBin)) {
    return { command: process.execPath, args: ['--import', 'tsx/esm', sourceBin, configPath], cwd: root, configPath }
  }

  throw new Error(`DeepSeek Harness runtime entrypoint is missing under ${root}`)
}

function finalAssistantText(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!isRecord(event) || event.type !== 'assistant/message' || !isRecord(event.data)) continue
    const content = event.data.message?.content
    if (!Array.isArray(content)) continue
    const text = content
      .filter(block => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
      .map(block => block.text)
      .join('')
      .trim()
    if (text) return text
  }
  return null
}

class RuntimeClient {
  constructor() {
    this.state = 'stopped'
    this.child = undefined
    this.launch = undefined
    this.serverInfo = undefined
    this.buffer = ''
    this.sequence = 0
    this.notifications = []
    this.waiters = new Set()
    this.pending = new Map()
    this.exitPromise = undefined
    this.resolveExit = undefined
    this.rejectExit = undefined
  }

  async initialize() {
    if (this.state === 'running' && this.serverInfo !== undefined) return this.serverInfo
    await this.start()
    try {
      const result = await this.request('initialize', {
        cwd: workspaceCwd(),
        provider: 'deepseek-official',
        model: process.env.DSH_MODEL?.trim() || DEFAULT_MODEL,
        ...(process.env.DSH_MAX_TOKENS?.trim() === undefined || process.env.DSH_MAX_TOKENS?.trim() === ''
          ? {}
          : { maxTokens: positiveInteger(Number(process.env.DSH_MAX_TOKENS), 'DSH_MAX_TOKENS') }),
      })
      if (!isRecord(result) || !isRecord(result.serverInfo)) throw new Error('DeepSeek Harness initialize returned no serverInfo')
      this.serverInfo = result.serverInfo
      return this.serverInfo
    } catch (error) {
      await this.close()
      throw error
    }
  }

  async start() {
    if (this.state === 'running') return
    if (this.state === 'closing') throw new Error('DeepSeek Harness runtime is closing')
    const launch = runtimeLaunch()
    this.launch = launch
    let child
    try {
      child = spawn(launch.command, launch.args, {
        cwd: launch.cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (error) {
      throw new Error(`failed to spawn DeepSeek Harness runtime: ${error.message}`)
    }
    this.child = child
    this.state = 'running'
    this.exitPromise = new Promise((resolveExit, rejectExit) => {
      this.resolveExit = resolveExit
      this.rejectExit = rejectExit
    })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => this.consume(chunk))
    child.stderr.on('data', chunk => {
      const text = String(chunk).trim()
      if (text) log(`runtime: ${text}`)
    })
    child.once('error', error => {
      const message = `runtime process error: ${error.message}`
      log(message)
      for (const pending of this.pending.values()) pending.reject(new Error(message))
      this.pending.clear()
    })
    child.once('exit', (code, signal) => {
      const message = `runtime exited${code === null ? ` with ${signal ?? 'unknown signal'}` : ` with code ${code}`}`
      this.state = 'stopped'
      this.child = undefined
      this.serverInfo = undefined
      for (const pending of this.pending.values()) pending.reject(new Error(message))
      this.pending.clear()
      this.recordNotification({ method: 'runtime.exit', params: { code, signal, message } })
      this.resolveExit?.({ code, signal })
      this.resolveExit = undefined
      this.rejectExit = undefined
    })
    log(`started runtime: ${launch.command} ${launch.args.join(' ')}`)
  }

  consume(chunk) {
    this.buffer += String(chunk)
    while (true) {
      const newline = this.buffer.indexOf('\n')
      if (newline < 0) return
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (line === '') continue
      let frame
      try {
        frame = JSON.parse(line)
      } catch (error) {
        log(`ignored non-JSON runtime stdout: ${error.message}`)
        continue
      }
      if (!isRecord(frame)) continue
      if (Object.prototype.hasOwnProperty.call(frame, 'id')) {
        const pending = this.pending.get(frame.id)
        if (pending === undefined) continue
        this.pending.delete(frame.id)
        clearTimeout(pending.timer)
        if (isRecord(frame.error)) pending.reject(new Error(frame.error.message || 'runtime JSON-RPC error'))
        else pending.resolve(frame.result)
        continue
      }
      if (typeof frame.method === 'string') this.recordNotification({ method: frame.method, params: frame.params })
    }
  }

  recordNotification(notification) {
    const entry = { sequence: ++this.sequence, ...notification }
    this.notifications.push(entry)
    if (this.notifications.length > 1000) this.notifications.shift()
    for (const waiter of [...this.waiters]) {
      try {
        waiter(entry)
      } catch (error) {
        log(`notification waiter failed: ${error.message}`)
      }
    }
  }

  request(method, params, timeoutMs = this.timeoutMs()) {
    if (this.child === undefined || !['running', 'closing'].includes(this.state)) throw new Error('DeepSeek Harness runtime is not running')
    const id = randomUUID()
    const frame = { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) }
    return new Promise((resolveResult, rejectResult) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        rejectResult(new Error(`runtime request timed out: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolveResult, reject: rejectResult, timer })
      try {
        this.child.stdin.write(`${JSON.stringify(frame)}\n`)
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        rejectResult(error)
      }
    })
  }

  timeoutMs() {
    const raw = process.env.DSH_RUNTIME_TIMEOUT_MS?.trim()
    if (raw === undefined || raw === '') return DEFAULT_TIMEOUT_MS
    return positiveInteger(Number(raw), 'DSH_RUNTIME_TIMEOUT_MS')
  }

  waitForIdle(sessionId, afterSequence, timeoutMs = this.timeoutMs()) {
    const events = []
    let activitySeen = false
    let settled = false
    let timer
    let resolveResult
    let rejectResult

    const result = new Promise((resolvePromise, rejectPromise) => {
      resolveResult = resolvePromise
      rejectResult = rejectPromise
    })

    const finish = error => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      this.waiters.delete(onNotification)
      if (error !== undefined) rejectResult(error)
      else resolveResult({ events, finalResponse: finalAssistantText(events) })
    }

    const scan = notification => {
      if (notification.sequence <= afterSequence || !isRecord(notification.params)) return
      if (notification.params.sessionId !== sessionId) return
      if (notification.method === 'session.event') {
        activitySeen = true
        if (notification.params.event !== undefined) events.push(notification.params.event)
      } else if (notification.method === 'session.status') {
        if (notification.params.status === 'running') activitySeen = true
        if (notification.params.status === 'idle' && activitySeen) finish()
      }
    }

    const onNotification = notification => scan(notification)
    this.waiters.add(onNotification)
    for (const notification of this.notifications) scan(notification)
    timer = setTimeout(() => finish(new Error(`timed out waiting for DeepSeek Harness session ${sessionId} to become idle`)), timeoutMs)
    return result
  }

  async runPrompt(sessionId, prompt) {
    const afterSequence = this.sequence
    const receipt = await this.request('session/prompt', {
      sessionId,
      contentBlocks: [{ type: 'text', text: prompt }],
    })
    const idle = this.waitForIdle(sessionId, afterSequence)
    const activity = await idle
    return { messageId: receipt?.messageId ?? null, ...activity }
  }

  async close() {
    if (this.child === undefined) {
      this.state = 'stopped'
      return
    }
    if (this.state === 'closing') return this.exitPromise
    this.state = 'closing'
    const child = this.child
    try {
      await this.request('shutdown', undefined, Math.min(this.timeoutMs(), 5000))
    } catch (error) {
      log(`graceful runtime shutdown failed: ${error.message}`)
    }
    try {
      child.stdin.end()
    } catch {
      // The process may already have closed its input.
    }
    await Promise.race([this.exitPromise, new Promise(resolvePromise => setTimeout(resolvePromise, 3000))])
    if (this.child !== undefined) {
      try {
        this.child.kill()
      } catch {
        // The process may already be gone between the check and kill.
      }
      await Promise.race([this.exitPromise, new Promise(resolvePromise => setTimeout(resolvePromise, 1000))])
    }
    if (this.child !== undefined) {
      this.child = undefined
      this.state = 'stopped'
      this.serverInfo = undefined
    }
  }
}

function freshPlan() {
  return { active: false, approved: false, objective: null, plan: null, items: [] }
}

function normalizeItems(value) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new TypeError('plan items must be an array')
  return value.map((item, index) => {
    if (!isRecord(item)) throw new TypeError(`plan item ${index + 1} must be an object`)
    return {
      id: nonEmptyString(item.id, `plan item ${index + 1}.id`),
      title: nonEmptyString(item.title, `plan item ${index + 1}.title`),
      status: item.status === undefined ? 'pending' : item.status,
    }
  }).map(item => {
    if (!['pending', 'in_progress', 'completed'].includes(item.status)) throw new TypeError(`invalid plan item status: ${item.status}`)
    return item
  })
}

class PlanStore {
  constructor() {
    this.file = resolve(workspaceCwd(), process.env.DSH_PLAN_FILE?.trim() || join('.dsh', 'codex-plan.json'))
    this.state = this.load()
  }

  load() {
    if (!existsSync(this.file)) return freshPlan()
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8'))
      if (!isRecord(parsed)) return freshPlan()
      return {
        active: parsed.active === true,
        approved: parsed.approved === true,
        objective: typeof parsed.objective === 'string' ? parsed.objective : null,
        plan: typeof parsed.plan === 'string' ? parsed.plan : null,
        items: normalizeItems(parsed.items),
      }
    } catch (error) {
      log(`ignored invalid plan file ${this.file}: ${error.message}`)
      return freshPlan()
    }
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state))
  }

  save() {
    mkdirSync(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.tmp-${process.pid}-${randomUUID()}`
    const content = `${JSON.stringify(this.state, null, 2)}\n`
    writeFileSync(temporary, content, 'utf8')
    try {
      renameSync(temporary, this.file)
    } catch (error) {
      try {
        writeFileSync(this.file, content, 'utf8')
        unlinkSync(temporary)
      } catch {
        throw error
      }
    }
  }

  update(args) {
    const action = nonEmptyString(args.action, 'plan action')
    if (action === 'status') return this.snapshot()
    if (action === 'clear') {
      this.state = freshPlan()
      this.save()
      return this.snapshot()
    }
    if (action === 'start') {
      this.state = {
        active: true,
        approved: false,
        objective: nonEmptyString(args.objective, 'plan objective'),
        plan: typeof args.plan === 'string' && args.plan.trim() !== '' ? args.plan.trim() : null,
        items: normalizeItems(args.items),
      }
      this.save()
      return this.snapshot()
    }
    if (action === 'update') {
      if (!this.state.active) throw new Error('cannot update a plan that is not active')
      const plan = nonEmptyString(args.plan, 'plan')
      this.state = {
        ...this.state,
        approved: false,
        objective: args.objective === undefined ? this.state.objective : nonEmptyString(args.objective, 'plan objective'),
        plan,
        items: args.items === undefined ? this.state.items : normalizeItems(args.items),
      }
      this.save()
      return this.snapshot()
    }
    if (action === 'approve') {
      if (!this.state.active) throw new Error('cannot approve a plan that is not active')
      if (typeof this.state.plan !== 'string' || !this.state.plan.startsWith('#')) {
        throw new Error('plan must be a complete Markdown document beginning with # before approval')
      }
      this.state = { ...this.state, active: false, approved: true }
      this.save()
      return this.snapshot()
    }
    throw new Error(`unsupported plan action: ${action}`)
  }
}

function success(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    isError: false,
  }
}

function failure(error) {
  const message = error instanceof Error ? error.message : String(error)
  return { content: [{ type: 'text', text: `DeepSeek Harness error: ${message}` }], isError: true }
}

const runtime = new RuntimeClient()
const plan = new PlanStore()
let sessionId
let promptInFlight = false

async function callTool(name, args = {}) {
  if (!isRecord(args)) throw new TypeError('tool arguments must be an object')
  switch (name) {
    case 'dsh_status':
      return success({
        runtime: { state: runtime.state, serverInfo: runtime.serverInfo ?? null },
        sessionId: sessionId ?? null,
        model: process.env.DSH_MODEL?.trim() || DEFAULT_MODEL,
        plan: plan.snapshot(),
        planFile: plan.file,
      })
    case 'dsh_start_session': {
      sessionId = args.sessionId === undefined ? sessionId ?? randomUUID() : nonEmptyString(args.sessionId, 'sessionId')
      const serverInfo = await runtime.initialize()
      return success({ sessionId, serverInfo, runtimeState: runtime.state, cwd: workspaceCwd() })
    }
    case 'dsh_plan':
      return success(plan.update(args))
    case 'dsh_prompt': {
      if (plan.state.active) throw new Error('plan mode is active; update the plan, obtain explicit user approval, then call dsh_plan approve')
      const prompt = nonEmptyString(args.prompt, 'prompt')
      if (promptInFlight) throw new Error('another DeepSeek Harness prompt is already in flight')
      sessionId = args.sessionId === undefined ? sessionId ?? randomUUID() : nonEmptyString(args.sessionId, 'sessionId')
      promptInFlight = true
      try {
        await runtime.initialize()
        const result = await runtime.runPrompt(sessionId, prompt)
        return success({ sessionId, finalResponse: result.finalResponse, messageId: result.messageId, eventCount: result.events.length })
      } finally {
        promptInFlight = false
      }
    }
    case 'dsh_stop':
      await runtime.close()
      return success({ stopped: true, runtimeState: runtime.state, sessionId: sessionId ?? null })
    default:
      throw new Error(`unknown DeepSeek Harness tool: ${name}`)
  }
}

function send(frame) {
  process.stdout.write(`${JSON.stringify(frame)}\n`)
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

async function handleMessage(frame) {
  if (!isRecord(frame) || frame.jsonrpc !== '2.0' || typeof frame.method !== 'string') {
    sendError(null, -32600, 'invalid JSON-RPC request')
    return
  }
  const hasId = Object.prototype.hasOwnProperty.call(frame, 'id')
  if (!hasId) return
  try {
    let result
    if (frame.method === 'initialize') {
      result = {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'deepseek-harness', version: VERSION },
        instructions: 'Use dsh_status, then dsh_plan for mutating work. Do not call dsh_prompt while an active plan is unapproved.',
      }
    } else if (frame.method === 'ping') {
      result = {}
    } else if (frame.method === 'tools/list') {
      result = { tools }
    } else if (frame.method === 'tools/call') {
      const params = isRecord(frame.params) ? frame.params : {}
      result = await callTool(params.name, params.arguments ?? {})
    } else if (frame.method === 'shutdown') {
      await runtime.close()
      result = {}
    } else {
      sendError(frame.id, -32601, `method not found: ${frame.method}`)
      return
    }
    send({ jsonrpc: '2.0', id: frame.id, result })
  } catch (error) {
    if (frame.method === 'tools/call') {
      send({ jsonrpc: '2.0', id: frame.id, result: failure(error) })
    } else {
      sendError(frame.id, -32000, error instanceof Error ? error.message : String(error))
    }
  }
}

let inputBuffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => {
  inputBuffer += String(chunk)
  while (true) {
    const newline = inputBuffer.indexOf('\n')
    if (newline < 0) break
    const line = inputBuffer.slice(0, newline).trim()
    inputBuffer = inputBuffer.slice(newline + 1)
    if (line === '') continue
    let frame
    try {
      frame = JSON.parse(line)
    } catch (error) {
      sendError(null, -32700, `parse error: ${error.message}`)
      continue
    }
    void handleMessage(frame)
  }
})

async function dispose() {
  await runtime.close()
}

process.stdin.on('end', () => { void dispose().finally(() => process.exit(0)) })
process.on('SIGTERM', () => { void dispose().finally(() => process.exit(0)) })
process.on('SIGINT', () => { void dispose().finally(() => process.exit(130)) })
