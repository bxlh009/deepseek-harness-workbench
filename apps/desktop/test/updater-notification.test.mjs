import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { registerDesktopUpdater } from '../src/updater.mjs'

function harness(options = {}) {
  const updater = new EventEmitter()
  updater.checkForUpdates = options.checkForUpdates ?? (async () => ({ updateInfo: { version: '0.1.0-rc.10' } }))
  updater.downloadUpdate = async () => {}
  updater.quitAndInstall = () => {}
  const handlers = new Map()
  const sent = []
  const dialogs = []
  registerDesktopUpdater({
    updater,
    app: {
      getLocale: () => 'zh-CN',
      getVersion: () => options.currentVersion ?? '0.1.0-rc.9',
      isPackaged: true,
      once: () => {},
    },
    dialog: { showMessageBox: async (...args) => { dialogs.push(args); return { response: 1 } } },
    ipcMain: { handle: (channel, handler) => { handlers.set(channel, handler) } },
    getWindow: () => ({
      isDestroyed: () => false,
      webContents: { send: (...args) => { sent.push(args) } },
    }),
    now: options.now ?? (() => '2026-08-18T08:30:00.000Z'),
    sleep: options.sleep,
    manualRetryDelays: options.manualRetryDelays,
  })
  return { updater, handlers, sent, dialogs }
}

test('available updates publish an unread badge without opening a discovery dialog', async () => {
  const { updater, handlers, dialogs, sent } = harness()
  updater.emit('update-available', { version: '0.1.0-rc.10' })

  assert.deepEqual(await handlers.get('dsh:updates:status')(), {
    status: 'available', currentVersion: '0.1.0-rc.9', version: '0.1.0-rc.10', unread: true,
    checkedAt: '2026-08-18T08:30:00.000Z',
  })
  assert.equal(dialogs.length, 0)
  assert.deepEqual(sent.at(-1), ['dsh:updates:status', {
    status: 'available', currentVersion: '0.1.0-rc.9', version: '0.1.0-rc.10', unread: true,
    checkedAt: '2026-08-18T08:30:00.000Z',
  }])
})

test('acknowledging clears the badge for this process but a new process rearms it', async () => {
  const first = harness()
  first.updater.emit('update-available', { version: '0.1.0-rc.10' })
  assert.deepEqual(await first.handlers.get('dsh:updates:acknowledge')(), {
    status: 'available', currentVersion: '0.1.0-rc.9', version: '0.1.0-rc.10', unread: false,
    checkedAt: '2026-08-18T08:30:00.000Z',
  })

  await first.handlers.get('dsh:updates:check')()
  assert.equal((await first.handlers.get('dsh:updates:status')()).unread, false)

  const restarted = harness()
  restarted.updater.emit('update-available', { version: '0.1.0-rc.10' })
  assert.equal((await restarted.handlers.get('dsh:updates:status')()).unread, true)
})

test('a manual check bypasses a stale latest result and reports the remote version with check time', async () => {
  const replies = ['0.1.0-rc.10', '0.1.0-rc.11']
  const checkForUpdates = async () => ({ updateInfo: { version: replies.shift() } })
  const sleep = async () => {}
  const app = harness({
    checkForUpdates,
    sleep,
    manualRetryDelays: [1],
    currentVersion: '0.1.0-rc.10',
    now: () => '2026-08-18T08:40:00.000Z',
  })

  const result = await app.handlers.get('dsh:updates:check')()

  assert.deepEqual(result, {
    status: 'available',
    currentVersion: '0.1.0-rc.10',
    version: '0.1.0-rc.11',
    unread: true,
    checkedAt: '2026-08-18T08:40:00.000Z',
  })
  assert.equal(app.updater.requestHeaders, undefined)
})
