const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshDesktop', Object.freeze({
  platform: process.platform,
  packaged: process.defaultApp !== true,
  checkForUpdates: () => ipcRenderer.invoke('dsh:updates:check'),
  getUpdateStatus: () => ipcRenderer.invoke('dsh:updates:status'),
  acknowledgeUpdate: () => ipcRenderer.invoke('dsh:updates:acknowledge'),
  downloadUpdate: () => ipcRenderer.invoke('dsh:updates:download'),
  onUpdateStatus: (listener) => {
    const wrapped = (_event, status) => { listener(status) }
    ipcRenderer.on('dsh:updates:status', wrapped)
    return () => { ipcRenderer.removeListener('dsh:updates:status', wrapped) }
  },
}))
