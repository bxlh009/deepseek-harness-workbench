import { spawn as defaultSpawn } from 'node:child_process'
import { createServer, get as httpGet } from 'node:http'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 7_000
const DEFAULT_FORCE_SHUTDOWN_TIMEOUT_MS = 3_000
const DEFAULT_POLL_INTERVAL_MS = 100
const DEFAULT_STARTUP_STABILITY_MS = 300
const MAX_LOG_LINES = 80

/**
 * Resolve the built or source dsh entry that the desktop host can launch.
 * @param {string} sourceRoot - Repository root containing apps/cli.
 * @returns {{kind: 'built'|'source', entry: string}}
 */
export function resolveHostEntry(sourceRoot) {
  const root = resolve(sourceRoot)
  const builtEntry = join(root, 'apps', 'cli', 'lib', 'bin.js')
  if (existsSync(builtEntry)) return { kind: 'built', entry: builtEntry }

  const installedEntry = join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (existsSync(installedEntry)) return { kind: 'built', entry: installedEntry }

  const sourceEntry = join(root, 'apps', 'cli', 'src', 'bin.ts')
  if (existsSync(sourceEntry)) return { kind: 'source', entry: sourceEntry }

  throw new Error(`DeepSeek Harness CLI entry not found under ${root}. Run pnpm run build first.`)
}

/**
 * Check whether a directory is a supported Host runtime root.
 * @param {string} sourceRoot - Repository or packaged runtime root.
 * @returns {boolean}
 */
export function isHostRuntimeRoot(sourceRoot) {
  try {
    resolveHostEntry(sourceRoot)
    return true
  } catch {
    return false
  }
}

/**
 * Prefer a bundled Node runtime when the desktop package carries one.
 * @param {string} sourceRoot - Repository or packaged runtime root.
 * @param {string|undefined} configuredCommand - Explicit command override.
 * @returns {string}
 */
export function resolveNodeCommand(sourceRoot, configuredCommand = undefined) {
  if (configuredCommand !== undefined) return configuredCommand
  const bundledName = process.platform === 'win32' ? 'node.exe' : 'node'
  const bundledCommand = join(resolve(sourceRoot), bundledName)
  if (existsSync(bundledCommand)) return bundledCommand
  return bundledName
}

/**
 * Build a direct Node launch command so the desktop shell does not depend on a
 * PowerShell pnpm shim or create an extra package-manager process.
 * @param {{kind: 'built'|'source', entry: string}} hostEntry - Resolved CLI entry.
 * @param {{host: string, port: number}} options - Web bind options.
 * @returns {string[]}
 */
export function buildHostArguments(hostEntry, { host, port }) {
  const prefix = hostEntry.kind === 'built' ? [] : ['--import', 'tsx/esm']
  return [
    ...prefix,
    hostEntry.entry,
    'web',
    '--host',
    host,
    '--port',
    String(port),
  ]
}

/**
 * Build the environment for the owned Host process.
 * @param {{dshHome?: string, baseEnvironment?: NodeJS.ProcessEnv}} options - Desktop Host environment options.
 * @returns {NodeJS.ProcessEnv}
 */
export function buildHostEnvironment({ dshHome, runAsNode = false, baseEnvironment = process.env } = {}) {
  const environment = {
    ...baseEnvironment,
    DSH_TELEMETRY_DISABLED: baseEnvironment.DSH_TELEMETRY_DISABLED ?? '1',
  }
  if (dshHome !== undefined) environment.DSH_HOME = resolve(dshHome)
  if (runAsNode) environment.ELECTRON_RUN_AS_NODE = '1'
  return environment
}

/**
 * Reserve an unused loopback port for the child host.
 * @param {string} host - Loopback address to bind.
 * @returns {Promise<number>}
 */
export async function findFreePort(host = DEFAULT_HOST) {
  const server = createServer()
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, host, resolvePromise)
  })

  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : undefined
  await new Promise((resolvePromise, reject) => {
    server.close((error) => (error === undefined ? resolvePromise() : reject(error)))
  })
  if (typeof port !== 'number' || port <= 0) throw new Error('The operating system did not provide a loopback port.')
  return port
}

/**
 * Probe one local HTTP endpoint without following redirects or touching the network.
 * @param {string} url - Loopback URL to probe.
 * @returns {Promise<number>}
 */
export function requestHttpStatus(url) {
  return new Promise((resolvePromise, reject) => {
    const request = httpGet(url, (response) => {
      response.resume()
      response.once('end', () => resolvePromise(response.statusCode ?? 0))
    })
    request.setTimeout(1_000, () => request.destroy(new Error('HTTP readiness probe timed out.')))
    request.once('error', reject)
  })
}

/**
 * Wait until a local HTTP host accepts connections.
 * @param {string} url - Loopback URL to probe.
 * @param {{timeoutMs?: number, pollIntervalMs?: number, isAlive?: () => boolean}} options - Wait policy.
 * @returns {Promise<number>}
 */
export async function waitForHttp(url, {
  timeoutMs = DEFAULT_STARTUP_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  isAlive = () => true,
} = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    if (!isAlive()) throw new Error(`Host exited before it became ready at ${url}.`)
    try {
      const status = await requestHttpStatus(url)
      if (status >= 200 && status < 500) return status
      lastError = new Error(`Host readiness returned HTTP ${status}.`)
    } catch (error) {
      lastError = error
    }
    await delay(pollIntervalMs)
  }
  const suffix = lastError instanceof Error ? ` ${lastError.message}` : ''
  throw new Error(`Timed out waiting for the local Host at ${url}.${suffix}`)
}

function appendLog(lines, chunk) {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line.length === 0) continue
    lines.push(line)
    if (lines.length > MAX_LOG_LINES) lines.shift()
  }
}

function captureOutput(child, lines) {
  child.stdout?.on('data', (chunk) => appendLog(lines, chunk))
  child.stderr?.on('data', (chunk) => appendLog(lines, chunk))
}

function hasExited(child) {
  return child.exitCode !== null && child.exitCode !== undefined
    || child.signalCode !== null && child.signalCode !== undefined
}

function waitForExit(child, timeoutMs) {
  if (hasExited(child)) return Promise.resolve(true)
  return Promise.race([
    new Promise((resolvePromise) => child.once('close', () => resolvePromise(true))),
    delay(timeoutMs).then(() => false),
  ])
}

function forceKillTree(child, spawnProcess) {
  if (process.platform !== 'win32' || typeof child.pid !== 'number') {
    child.kill('SIGKILL')
    return Promise.resolve()
  }

  return new Promise((resolvePromise) => {
    const killer = spawnProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    })
    killer.once('close', resolvePromise)
    killer.once('error', resolvePromise)
  })
}

function formatStartupFailure(error, sourceRoot, lines) {
  const reason = error instanceof Error ? error.message : String(error)
  const output = lines.length === 0 ? '' : `\n\nHost output:\n${lines.join('\n')}`
  return new Error(`DeepSeek Harness desktop Host failed to start from ${sourceRoot}: ${reason}${output}`, {
    cause: error,
  })
}

/**
 * Own the local dsh Host process used by the Electron window.
 * The supervisor owns startup readiness and waits for graceful shutdown before
 * allowing the desktop process to exit.
 */
export class HostSupervisor {
  #child
  #stopPromise

  /**
   * @param {{sourceRoot: string, host?: string, nodeCommand?: string, workingDirectory?: string, runAsNode?: boolean, dshHome?: string, baseEnvironment?: NodeJS.ProcessEnv, spawnProcess?: typeof defaultSpawn, startupTimeoutMs?: number, shutdownTimeoutMs?: number, forceShutdownTimeoutMs?: number}} options - Host launch policy.
   */
  constructor({
    sourceRoot,
    host = DEFAULT_HOST,
    nodeCommand,
    workingDirectory,
    runAsNode = false,
    dshHome,
    baseEnvironment = process.env,
    spawnProcess = defaultSpawn,
    startupTimeoutMs = DEFAULT_STARTUP_TIMEOUT_MS,
    startupStabilityMs = DEFAULT_STARTUP_STABILITY_MS,
    shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
    forceShutdownTimeoutMs = DEFAULT_FORCE_SHUTDOWN_TIMEOUT_MS,
  }) {
    if (typeof sourceRoot !== 'string' || sourceRoot.length === 0) throw new TypeError('sourceRoot is required.')
    this.sourceRoot = resolve(sourceRoot)
    this.host = host
    this.nodeCommand = resolveNodeCommand(this.sourceRoot, nodeCommand)
    this.workingDirectory = workingDirectory === undefined ? this.sourceRoot : resolve(workingDirectory)
    this.runAsNode = runAsNode
    this.dshHome = dshHome === undefined ? undefined : resolve(dshHome)
    this.baseEnvironment = baseEnvironment
    this.spawnProcess = spawnProcess
    this.startupTimeoutMs = startupTimeoutMs
    this.startupStabilityMs = startupStabilityMs
    this.shutdownTimeoutMs = shutdownTimeoutMs
    this.forceShutdownTimeoutMs = forceShutdownTimeoutMs
    this.#child = undefined
    this.#stopPromise = undefined
    this.outputLines = []
  }

  /** @returns {boolean} Whether the Host process is still owned by this supervisor. */
  get running() {
    return this.#child !== undefined && !hasExited(this.#child)
  }

  /** Append captured Host output to an error raised after readiness. */
  enrichError(error) {
    return formatStartupFailure(error, this.sourceRoot, this.outputLines)
  }

  /**
   * Start the Host and wait for its Web UI to accept loopback requests.
   * @returns {Promise<{url: string, port: number, pid: number|null}>}
   */
  async start() {
    if (this.#child !== undefined) throw new Error('The desktop Host is already running.')
    const port = await findFreePort(this.host)
    const hostEntry = resolveHostEntry(this.sourceRoot)
    const args = buildHostArguments(hostEntry, { host: this.host, port })
    const lines = []
    this.outputLines = lines
    const child = this.spawnProcess(this.nodeCommand, args, {
      cwd: this.workingDirectory,
      env: buildHostEnvironment({
        dshHome: this.dshHome,
        runAsNode: this.runAsNode,
        baseEnvironment: this.baseEnvironment,
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    })
    this.#child = child
    captureOutput(child, lines)
    let spawnError
    child.once('error', (error) => { spawnError = error })

    const url = `http://${this.host}:${port}`
    try {
      await waitForHttp(url, {
        timeoutMs: this.startupTimeoutMs,
        isAlive: () => spawnError === undefined && !hasExited(child),
      })
      await delay(this.startupStabilityMs)
      if (spawnError !== undefined || hasExited(child)) {
        throw spawnError ?? new Error('Host exited immediately after its readiness probe succeeded.')
      }
      return { url, port, pid: typeof child.pid === 'number' ? child.pid : null }
    } catch (error) {
      await this.stop()
      throw formatStartupFailure(error, this.sourceRoot, lines)
    }
  }

  /**
   * Stop the Host and wait for the child process to exit.
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.#stopPromise !== undefined) return this.#stopPromise
    const child = this.#child
    if (child === undefined) return

    this.#stopPromise = (async () => {
      if (!hasExited(child)) child.kill('SIGTERM')
      const stoppedGracefully = await waitForExit(child, this.shutdownTimeoutMs)
      if (!stoppedGracefully) {
        await forceKillTree(child, this.spawnProcess)
        await waitForExit(child, this.forceShutdownTimeoutMs)
      }
    })().finally(() => {
      if (this.#child === child) this.#child = undefined
      this.#stopPromise = undefined
    })
    return this.#stopPromise
  }
}
