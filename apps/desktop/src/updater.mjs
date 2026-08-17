import updaterPackage from 'electron-updater'

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
  let updatePromptOpen = false

  autoUpdater.on('update-available', (info) => {
    if (updatePromptOpen) return
    updatePromptOpen = true
    void messageBox(dialog, getWindow, {
      type: 'info',
      title: '发现新版本',
      message: `DeepSeek Harness 工作台 ${info.version} 可以更新`,
      detail: '由你决定是否下载。更新会覆盖程序文件，但不会删除模型、API 密钥、会话和皮肤配置。',
      buttons: ['下载并安装', '稍后'],
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
          title: '更新下载失败',
          message: errorMessage(error),
          buttons: ['知道了'],
        })
      }
    }).finally(() => {
      updatePromptOpen = false
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    void messageBox(dialog, getWindow, {
      type: 'info',
      title: '更新已下载',
      message: `DeepSeek Harness 工作台 ${info.version} 已准备好`,
      detail: '现在重启即可安装更新。',
      buttons: ['重启并安装', '稍后'],
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
