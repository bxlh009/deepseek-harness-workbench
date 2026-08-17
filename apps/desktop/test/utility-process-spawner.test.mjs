import { EventEmitter } from 'node:events'
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { createUtilityProcessSpawner } from '../src/utility-process-spawner.mjs'

test('adapts Electron utilityProcess.fork for an archived Host entry', async () => {
  const utility = new EventEmitter()
  utility.pid = 24680
  utility.stdout = new EventEmitter()
  utility.stderr = new EventEmitter()
  utility.kill = () => true
  let forkCall
  const spawn = createUtilityProcessSpawner({
    fork(modulePath, args, options) {
      forkCall = { modulePath, args, options }
      return utility
    },
  })
  const child = spawn('ignored', ['D:\\app\\resources\\runtime.asar\\cli.js', 'web'], {
    cwd: 'D:\\app\\resources',
    env: { DSH_HOME: 'D:\\data' },
  })

  assert.equal(forkCall.modulePath, 'D:\\app\\resources\\runtime.asar\\cli.js')
  assert.deepEqual(forkCall.args, ['web'])
  assert.deepEqual(forkCall.options.stdio, ['ignore', 'pipe', 'pipe'])
  assert.equal(child.pid, 24680)
  const closed = new Promise((resolvePromise) => child.once('close', resolvePromise))
  utility.emit('exit', 0)
  assert.equal(await closed, 0)
  assert.equal(child.exitCode, 0)
})
