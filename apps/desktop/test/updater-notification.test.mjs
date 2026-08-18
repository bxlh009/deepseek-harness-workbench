import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { registerDesktopUpdater } from '../src/updater.mjs'

function harness() {
  const updater = new EventEmitter()
  updater.checkForUpdates = async () => ({ updateInfo: { version: '0.1.0-rc.10' } })
  updater.downloadUpdate = async () => {}
  updater.quitAndInstall = () => {}
  const handlers = new Map()
  const sent = []
  const dialogs = []
  registerDesktopUpdater({
    updater,
    app: {
      getLocale: () => 'zh-CN',
      getVersion: () => '0.1.0-rc.9',
      isPackaged: true,
      once: () => {},
    },
    dialog: { showMessageBox: async (...args) => { dialogs.push(args); return { response: 1 } } },
    ipcMain: { handle: (channel, handler) => { handlers.set(channel, handler) } },
    getWindow: () => ({
      isDestroyed: () => false,
      webContents: { send: (...args) => { sent.push(args) } },
    }),
  })
  return { updater, handlers, sent, dialogs }
}

test('available updates publish an unread badge without opening a discovery dialog', async () => {
  const { updater, handlers, dialogs, sent } = harness()
  updater.emit('update-available', { version: '0.1.0-rc.10' })

  assert.deepEqual(await handlers.get('dsh:updates:status')(), {
    status: 'available', currentVersion: '0.1.0-rc.9', version: '0.1.0-rc.10', unread: true,
  })
  assert.equal(dialogs.length, 0)
  assert.deepEqual(sent.at(-1), ['dsh:updates:status', {
    status: 'available', currentVersion: '0.1.0-rc.9', version: '0.1.0-rc.10', unread: true,
  }])
})

test('acknowledging clears the badge for this process but a new process rearms it', async () => {
  const first = harness()
  first.updater.emit('update-available', { version: '0.1.0-rc.10' })
  assert.deepEqual(await first.handlers.get('dsh:updates:acknowledge')(), {
    status: 'available', currentVersion: '0.1.0-rc.9', version: '0.1.0-rc.10', unread: false,
  })

  await first.handlers.get('dsh:updates:check')()
  assert.equal((await first.handlers.get('dsh:updates:status')()).unread, false)

  const restarted = harness()
  restarted.updater.emit('update-available', { version: '0.1.0-rc.10' })
  assert.equal((await restarted.handlers.get('dsh:updates:status')()).unread, true)
})
