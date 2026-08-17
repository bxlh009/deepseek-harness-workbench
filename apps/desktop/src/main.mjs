import { app, BrowserWindow, dialog, ipcMain, utilityProcess } from 'electron'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HostSupervisor, isHostRuntimeRoot } from './host-supervisor.mjs'
import { registerDesktopUpdater } from './updater.mjs'
import { createUtilityProcessSpawner } from './utility-process-spawner.mjs'

const DESKTOP_DIR = fileURLToPath(new URL('.', import.meta.url))
const PRODUCT_NAME = 'DeepSeek Harness 工作台'
const PRODUCT_ICON = join(DESKTOP_DIR, '..', 'build', 'deepseek-icon.png')
let mainWindow
let hostSupervisor
let hostInfo
let quitting = false

function resolveSourceRoot() {
  const configuredRoot = process.env.DSH_DESKTOP_SOURCE_ROOT
  if (configuredRoot !== undefined) return resolve(configuredRoot)
  if (app.isPackaged) return resolve(process.resourcesPath, 'runtime.asar')
  return resolve(join(DESKTOP_DIR, '..', '..'))
}

function assertSourceRoot(sourceRoot) {
  if (!isHostRuntimeRoot(sourceRoot)) {
    throw new Error(
      `DeepSeek Harness Host runtime was not found at ${sourceRoot}. `
      + 'Set DSH_DESKTOP_SOURCE_ROOT to the repository root or reinstall the desktop package.',
    )
  }
}

function resolveDshHome() {
  const configuredHome = process.env.DSH_DESKTOP_HOME?.trim()
  if (configuredHome !== undefined && configuredHome.length > 0) return resolve(configuredHome)
  return join(app.getPath('userData'), 'dsh')
}

async function ensureHost() {
  if (hostInfo !== undefined) return hostInfo
  const sourceRoot = resolveSourceRoot()
  assertSourceRoot(sourceRoot)
  hostSupervisor = new HostSupervisor({
    sourceRoot,
    dshHome: resolveDshHome(),
    ...(app.isPackaged ? {
      nodeCommand: 'electron-utility-process',
      workingDirectory: process.resourcesPath,
      spawnProcess: createUtilityProcessSpawner(utilityProcess),
    } : {}),
  })
  hostInfo = await hostSupervisor.start()
  return hostInfo
}

async function createMainWindow() {
  const host = await ensureHost()
  const allowedOrigin = new URL(host.url).origin
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#101114',
    title: PRODUCT_NAME,
    icon: PRODUCT_ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(DESKTOP_DIR, 'preload.cjs'),
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== allowedOrigin) event.preventDefault()
  })
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  try {
    await window.loadURL(host.url)
  } catch (error) {
    throw hostSupervisor.enrichError(error)
  }
  mainWindow = window
}

async function shutdown() {
  await hostSupervisor?.stop()
  hostSupervisor = undefined
  hostInfo = undefined
}

async function start() {
  try {
    await createMainWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox(`${PRODUCT_NAME}启动失败`, message)
    app.quit()
  }
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    void shutdown().finally(() => app.quit())
  })

  app.whenReady().then(() => {
    registerDesktopUpdater({ app, dialog, ipcMain, getWindow: () => mainWindow })
    return start()
  })

  app.on('activate', () => {
    if (mainWindow === undefined) void createMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
