import updaterPackage from 'electron-updater'
import { updateCopy } from './update-copy.mjs'

const INITIAL_UPDATE_CHECK_DELAY_MS = 15_000
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

function messageBox(dialog, getWindow, options) {
  const window = getWindow()
  return window === undefined || window.isDestroyed()
    ? dialog.showMessageBox(options)
    : dialog.showMessageBox(window, options)
}

function errorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Register the packaged-app update bridge and lifecycle prompts.
 * Releases are read from the independent GitHub repository declared in package.json.
 */
export function registerDesktopUpdater({ app, dialog, ipcMain, getWindow, updater = updaterPackage.autoUpdater }) {
  // Updates are discovered automatically, but downloading remains a person's
  // choice. A background check must never silently replace their application.
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  const copy = updateCopy(app.getLocale())
  const currentVersion = app.getVersion()
  let updateStatus = app.isPackaged
    ? { status: 'idle', currentVersion }
    : { status: 'development', currentVersion }

  const publishStatus = (status) => {
    updateStatus = status
    const window = getWindow()
    if (window !== undefined && !window.isDestroyed()) {
      window.webContents?.send('dsh:updates:status', status)
    }
    return status
  }

  const publishAvailable = (version) => {
    const unread = updateStatus.status === 'available' && updateStatus.version === version
      ? updateStatus.unread
      : true
    return publishStatus({ status: 'available', currentVersion, version, unread })
  }

  // Discovery is deliberately quiet. The renderer owns the persistent badge
  // and Settings surface; a native dialog appears only after a chosen download.
  updater.on('update-available', (info) => { publishAvailable(info.version) })

  updater.on('update-not-available', () => {
    publishStatus({ status: 'up-to-date', currentVersion })
  })

  updater.on('update-downloaded', (info) => {
    void messageBox(dialog, getWindow, {
      type: 'info',
      title: copy.downloadedTitle,
      message: copy.downloadedMessage(info.version),
      detail: copy.downloadedDetail,
      buttons: [copy.restartButton, copy.laterButton],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) updater.quitAndInstall(false, true)
    })
  })

  updater.on('error', (error) => {
    console.error('[desktop-updater]', error)
    if (updateStatus.status !== 'available') {
      publishStatus({ status: 'error', currentVersion, message: errorMessage(error) })
    }
  })

  ipcMain.handle('dsh:updates:status', async () => updateStatus)

  ipcMain.handle('dsh:updates:acknowledge', async () => {
    if (updateStatus.status !== 'available' || updateStatus.unread === false) return updateStatus
    return publishStatus({ ...updateStatus, unread: false })
  })

  ipcMain.handle('dsh:updates:download', async () => {
    if (updateStatus.status !== 'available') return updateStatus
    publishStatus({ ...updateStatus, unread: false })
    try {
      await updater.downloadUpdate()
      return updateStatus
    } catch (error) {
      console.error('[desktop-updater] download failed', error)
      return publishStatus({ status: 'error', currentVersion, message: errorMessage(error) })
    }
  })

  ipcMain.handle('dsh:updates:check', async () => {
    if (!app.isPackaged) return { status: 'development', currentVersion }

    try {
      const result = await updater.checkForUpdates()
      const version = result?.updateInfo.version
      if (version === undefined || version === currentVersion) {
        return publishStatus({ status: 'up-to-date', currentVersion })
      }
      return publishAvailable(version)
    } catch (error) {
      if (updateStatus.status === 'available') return updateStatus
      return publishStatus({ status: 'error', currentVersion, message: errorMessage(error) })
    }
  })

  if (!app.isPackaged) return

  const checkSilently = () => {
    void updater.checkForUpdates().catch((error) => {
      console.error('[desktop-updater] scheduled check failed', error)
      if (updateStatus.status !== 'available') {
        publishStatus({ status: 'error', currentVersion, message: errorMessage(error) })
      }
    })
  }
  const initialTimer = setTimeout(checkSilently, INITIAL_UPDATE_CHECK_DELAY_MS)
  const intervalTimer = setInterval(checkSilently, UPDATE_CHECK_INTERVAL_MS)
  initialTimer.unref?.()
  intervalTimer.unref?.()
  app.once('before-quit', () => {
    clearTimeout(initialTimer)
    clearInterval(intervalTimer)
  })
}
