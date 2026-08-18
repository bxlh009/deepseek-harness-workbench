import { app, BrowserWindow, dialog, ipcMain, utilityProcess } from 'electron'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HostSupervisor, isHostRuntimeRoot } from './host-supervisor.mjs'
import { FreeLlmSupervisor } from './freellmapi-supervisor.mjs'
import { ensureFreeLlmProfile } from './freellmapi-profile.mjs'
import { registerDesktopUpdater } from './updater.mjs'
import { createUtilityProcessSpawner } from './utility-process-spawner.mjs'

const DESKTOP_DIR = fileURLToPath(new URL('.', import.meta.url))
const PRODUCT_NAME = 'DeepSeek Harness Workbench'
const PRODUCT_ICON = join(DESKTOP_DIR, '..', 'build', 'deepseek-icon.png')
let mainWindow
let hostSupervisor
let hostInfo
let freeLlmSupervisor
let freeLlmInfo
let freeLlmFailure
let freeLlmWindow
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

function resolveFreeLlmRuntime() {
  const configured = process.env.DSH_FREELLMAPI_RUNTIME_ROOT?.trim()
  if (configured !== undefined && configured.length > 0) return resolve(configured)
  return app.isPackaged
    ? resolve(process.resourcesPath, 'freellmapi')
    : resolve(join(DESKTOP_DIR, '..', '..', '..', '..', 'freellmapi-upstream', 'desktop', 'build'))
}

async function ensureFreeLlm() {
  if (freeLlmInfo !== undefined) return freeLlmInfo
  freeLlmFailure = undefined
  const runtimeRoot = resolveFreeLlmRuntime()
  freeLlmSupervisor = new FreeLlmSupervisor({
    entry: app.isPackaged
      ? resolve(process.resourcesPath, 'freellmapi-sidecar.mjs')
      : join(DESKTOP_DIR, 'freellmapi-sidecar.mjs'),
    runtimeRoot,
    dataDirectory: join(app.getPath('userData'), 'freellmapi'),
    nodeCommand: app.isPackaged
      ? resolve(process.resourcesPath, 'runtime.asar.unpacked', 'node.exe')
      : process.env.DSH_DESKTOP_NODE_RUNTIME ?? 'node',
  })
  try {
    freeLlmInfo = await freeLlmSupervisor.start()
    return freeLlmInfo
  } catch (error) {
    freeLlmFailure = error instanceof Error ? error.message : String(error)
    freeLlmSupervisor = undefined
    throw error
  }
}

function freeLlmStatus() {
  if (freeLlmInfo !== undefined) return { status: 'running', baseURL: freeLlmInfo.baseURL }
  if (freeLlmFailure !== undefined) return { status: 'error', message: freeLlmFailure }
  return { status: 'starting' }
}

async function openFreeLlmDashboard() {
  const info = await ensureFreeLlm()
  if (freeLlmWindow !== undefined && !freeLlmWindow.isDestroyed()) {
    freeLlmWindow.show()
    freeLlmWindow.focus()
    return freeLlmStatus()
  }
  const origin = new URL(info.dashboardURL).origin
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    title: 'FreeLLMAPI',
    parent: mainWindow,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(DESKTOP_DIR, 'freellmapi-preload.cjs'),
      additionalArguments: [`--freellmapi-dashboard-token=${info.dashboardToken}`],
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault()
  })
  window.on('closed', () => {
    if (freeLlmWindow === window) freeLlmWindow = undefined
  })
  await window.loadURL(info.dashboardURL)
  freeLlmWindow = window
  return freeLlmStatus()
}

async function ensureHost() {
  if (hostInfo !== undefined) return hostInfo
  const freeLlm = await ensureFreeLlm()
  const dshHome = resolveDshHome()
  await ensureFreeLlmProfile({
    settingsPath: join(dshHome, 'settings.yaml'),
    connection: freeLlm,
  })
  const sourceRoot = resolveSourceRoot()
  assertSourceRoot(sourceRoot)
  hostSupervisor = new HostSupervisor({
    sourceRoot,
    dshHome,
    baseEnvironment: { ...process.env, FREELLMAPI_API_KEY: freeLlm.apiKey },
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
  freeLlmWindow?.destroy()
  freeLlmWindow = undefined
  await freeLlmSupervisor?.stop()
  freeLlmSupervisor = undefined
  freeLlmInfo = undefined
  await hostSupervisor?.stop()
  hostSupervisor = undefined
  hostInfo = undefined
}

async function start() {
  try {
    await createMainWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[desktop-startup] ${message}`)
    dialog.showErrorBox(`${PRODUCT_NAME} failed to start`, message)
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
    ipcMain.handle('dsh:freellmapi:status', () => freeLlmStatus())
    ipcMain.handle('dsh:freellmapi:open-dashboard', () => openFreeLlmDashboard())
    return start()
  })

  app.on('activate', () => {
    if (mainWindow === undefined) void createMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
