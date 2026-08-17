import updaterPackage from 'electron-updater'
import { updateCopy } from './update-copy.mjs'

const { autoUpdater } = updaterPackage
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
export function registerDesktopUpdater({ app, dialog, ipcMain, getWindow }) {
  // Updates are discovered automatically, but downloading remains a person's
  // choice. A background check must never silently replace their application.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  const copy = updateCopy(app.getLocale())
  let updatePromptOpen = false

  autoUpdater.on('update-available', (info) => {
    if (updatePromptOpen) return
    updatePromptOpen = true
    void messageBox(dialog, getWindow, {
      type: 'info',
      title: copy.availableTitle,
      message: copy.availableMessage(info.version),
      detail: copy.availableDetail,
      buttons: [copy.downloadButton, copy.laterButton],
      defaultId: 0,
      cancelId: 1,
    }).then(async ({ response }) => {
      if (response !== 0) return
      try {
        await autoUpdater.downloadUpdate()
      } catch (error) {
        console.error('[desktop-updater] download failed', error)
        await messageBox(dialog, getWindow, {
          type: 'error',
          title: copy.downloadFailedTitle,
          message: errorMessage(error),
          buttons: [copy.acknowledgeButton],
        })
      }
    }).finally(() => {
      updatePromptOpen = false
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    void messageBox(dialog, getWindow, {
      type: 'info',
      title: copy.downloadedTitle,
      message: copy.downloadedMessage(info.version),
      detail: copy.downloadedDetail,
      buttons: [copy.restartButton, copy.laterButton],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true)
    })
  })

  autoUpdater.on('error', (error) => {
    console.error('[desktop-updater]', error)
  })

  ipcMain.handle('dsh:updates:check', async () => {
    const currentVersion = app.getVersion()
    if (!app.isPackaged) return { status: 'development', currentVersion }

    try {
      const result = await autoUpdater.checkForUpdates()
      const version = result?.updateInfo.version
      if (version === undefined || version === currentVersion) {
        return { status: 'up-to-date', currentVersion }
      }
      return { status: 'available', currentVersion, version }
    } catch (error) {
      return { status: 'error', currentVersion, message: errorMessage(error) }
    }
  })

  if (!app.isPackaged) return

  const checkSilently = () => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error('[desktop-updater] scheduled check failed', error)
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
