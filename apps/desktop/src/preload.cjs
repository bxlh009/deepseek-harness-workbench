const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshDesktop', Object.freeze({
  platform: process.platform,
  packaged: process.defaultApp !== true,
  checkForUpdates: () => ipcRenderer.invoke('dsh:updates:check'),
}))
