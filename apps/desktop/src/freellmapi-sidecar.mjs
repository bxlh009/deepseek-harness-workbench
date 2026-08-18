import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const runtimeRoot = resolve(process.env.DSH_FREELLMAPI_RUNTIME_ROOT ?? '')
const dataDirectory = resolve(process.env.DSH_FREELLMAPI_DATA_DIRECTORY ?? '')
if (!existsSync(runtimeRoot)) throw new Error(`FreeLLMAPI runtime is missing at ${runtimeRoot}.`)
mkdirSync(dataDirectory, { recursive: true })

const keyFile = join(dataDirectory, '.encryption-key')
const encryptionKey = existsSync(keyFile)
  ? readFileSync(keyFile, 'utf8').trim()
  : randomBytes(32).toString('hex')
if (!existsSync(keyFile)) writeFileSync(keyFile, `${encryptionKey}\n`, { mode: 0o600 })

process.env.NODE_ENV = 'production'
process.env.ENCRYPTION_KEY = encryptionKey
process.env.FREEAPI_VERSION = process.env.DSH_DESKTOP_VERSION ?? 'embedded'

const serverModule = await import(pathToFileURL(join(runtimeRoot, 'server.mjs')).href)
const handle = await serverModule.startServer({
  dbPath: join(dataDirectory, 'freellmapi.db'),
  clientDist: join(runtimeRoot, 'client-dist'),
  host: '127.0.0.1',
  preferredPort: 31_415,
})
if (handle.port !== 31_415) {
  handle.server.close()
  throw new Error('Port 31415 is already in use. Close the conflicting program and restart DeepSeek Harness.')
}

const dashboardToken = serverModule.ensureSessionToken()
const apiKey = serverModule.getUnifiedApiKey()
process.send?.({
  type: 'freellmapi-ready',
  port: handle.port,
  dashboardURL: `http://127.0.0.1:${String(handle.port)}`,
  dashboardToken,
  apiKey,
})

function shutdown() {
  handle.server.close(() => process.exit(0))
}
process.on('disconnect', shutdown)
process.on('SIGTERM', shutdown)
