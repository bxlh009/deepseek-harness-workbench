import { fork as defaultFork } from 'node:child_process'

const DEFAULT_STARTUP_TIMEOUT_MS = 30_000
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/** Own the private FreeLLMAPI process used by the desktop application. */
export class FreeLlmSupervisor {
  #child
  #info

  constructor({
    entry,
    runtimeRoot,
    dataDirectory,
    nodeCommand,
    forkProcess = defaultFork,
    startupTimeoutMs = DEFAULT_STARTUP_TIMEOUT_MS,
  }) {
    this.entry = entry
    this.runtimeRoot = runtimeRoot
    this.dataDirectory = dataDirectory
    this.nodeCommand = nodeCommand
    this.forkProcess = forkProcess
    this.startupTimeoutMs = startupTimeoutMs
  }

  get running() {
    return this.#child !== undefined && this.#child.exitCode === null
  }

  async start() {
    if (this.#info !== undefined && this.running) return this.#info
    if (this.#child !== undefined) throw new Error('The FreeLLMAPI sidecar is already starting.')

    const child = this.forkProcess(this.entry, [], {
      execPath: this.nodeCommand,
      cwd: this.runtimeRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DSH_FREELLMAPI_RUNTIME_ROOT: this.runtimeRoot,
        DSH_FREELLMAPI_DATA_DIRECTORY: this.dataDirectory,
      },
      silent: true,
      windowsHide: true,
    })
    this.#child = child
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-8_000)
    })

    try {
      this.#info = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out starting the embedded FreeLLMAPI gateway.')), this.startupTimeoutMs)
        const settle = (callback) => (value) => {
          clearTimeout(timer)
          callback(value)
        }
        child.once('error', settle(reject))
        child.once('exit', settle((code) => reject(new Error(
          `FreeLLMAPI exited before readiness with code ${String(code)}.${stderr.length === 0 ? '' : `\n${stderr}`}`,
        ))))
        child.on('message', (message) => {
          if (message?.type !== 'freellmapi-ready') return
          const port = Number(message.port)
          if (!Number.isInteger(port) || port < 1 || port > 65_535) {
            settle(reject)(new Error('FreeLLMAPI reported an invalid loopback port.'))
            return
          }
          settle(resolve)({
            port,
            baseURL: `http://127.0.0.1:${String(port)}/v1`,
            dashboardURL: String(message.dashboardURL),
            dashboardToken: String(message.dashboardToken),
            apiKey: String(message.apiKey),
          })
        })
      })
      return this.#info
    } catch (error) {
      child.kill()
      this.#child = undefined
      throw error
    }
  }

  async stop() {
    const child = this.#child
    this.#child = undefined
    this.#info = undefined
    if (child === undefined || child.exitCode !== null) return
    child.disconnect?.()
    await waitForExit(child, DEFAULT_SHUTDOWN_TIMEOUT_MS)
    if (child.exitCode === null) child.kill()
  }
}
