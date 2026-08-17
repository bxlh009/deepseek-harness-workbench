import { EventEmitter } from 'node:events'
import { createServer } from 'node:http'
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  HostSupervisor,
  buildHostArguments,
  findFreePort,
  isHostRuntimeRoot,
  resolveHostEntry,
  resolveNodeCommand,
  waitForHttp,
} from '../src/host-supervisor.mjs'

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))

test('resolves the built CLI entry and its direct Node arguments', () => {
  const entry = resolveHostEntry(repositoryRoot)
  assert.equal(entry.kind, 'built')
  assert.deepEqual(buildHostArguments(entry, { host: '127.0.0.1', port: 43123 }), [
    entry.entry,
    'web',
    '--host',
    '127.0.0.1',
    '--port',
    '43123',
  ])
})

test('recognizes repository Host roots and supports a bundled Node override', () => {
  assert.equal(isHostRuntimeRoot(repositoryRoot), true)
  assert.equal(resolveNodeCommand(repositoryRoot, 'custom-node'), 'custom-node')
  const defaultCommand = resolveNodeCommand(repositoryRoot)
  assert.equal(defaultCommand === 'node' || defaultCommand.endsWith('node.exe'), true)
})

test('finds an unused loopback port and waits for an HTTP host', async () => {
  const port = await findFreePort()
  assert.ok(port > 0)
  const server = createServer((_request, response) => response.end('ready'))
  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise))
  try {
    assert.equal(await waitForHttp(`http://127.0.0.1:${port}`, { timeoutMs: 2_000 }), 200)
  } finally {
    await new Promise((resolvePromise, reject) => server.close((error) => (error ? reject(error) : resolvePromise())))
  }
})

test('starts and stops the Host through one owned child process', async () => {
  let server
  let child
  const spawnProcess = (_command, args) => {
    const port = Number(args.at(-1))
    child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.exitCode = null
    child.signalCode = null
    child.pid = 12345
    child.kill = () => {
      void new Promise((resolvePromise, reject) => server.close((error) => (error ? reject(error) : resolvePromise())))
        .then(() => {
          child.exitCode = 0
          child.emit('close', 0, null)
        })
      return true
    }
    server = createServer((_request, response) => response.end('ready'))
    void server.listen(port, '127.0.0.1')
    return child
  }

  const supervisor = new HostSupervisor({
    sourceRoot: repositoryRoot,
    spawnProcess,
    startupTimeoutMs: 2_000,
    shutdownTimeoutMs: 2_000,
  })
  const host = await supervisor.start()
  assert.equal(host.pid, 12345)
  assert.equal(supervisor.running, true)
  await supervisor.stop()
  assert.equal(supervisor.running, false)
})

test('passes the configured desktop DSH_HOME to the owned Host process', async () => {
  let server
  let child
  let spawnOptions
  const dshHome = resolve('D:/codex/.codex/desktop-host-test-home')
  const spawnProcess = (_command, args, options) => {
    spawnOptions = options
    const port = Number(args.at(-1))
    child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.exitCode = null
    child.signalCode = null
    child.pid = 12346
    child.kill = () => {
      void new Promise((resolvePromise, reject) => server.close((error) => (error ? reject(error) : resolvePromise())))
        .then(() => {
          child.exitCode = 0
          child.emit('close', 0, null)
        })
      return true
    }
    server = createServer((_request, response) => response.end('ready'))
    void server.listen(port, '127.0.0.1')
    return child
  }

  const supervisor = new HostSupervisor({
    sourceRoot: repositoryRoot,
    dshHome,
    runAsNode: true,
    spawnProcess,
    startupTimeoutMs: 2_000,
    shutdownTimeoutMs: 2_000,
  })
  await supervisor.start()
  assert.equal(spawnOptions.env.DSH_HOME, dshHome)
  assert.equal(spawnOptions.env.ELECTRON_RUN_AS_NODE, '1')
  await supervisor.stop()
})
