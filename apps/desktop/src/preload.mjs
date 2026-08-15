import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('dshDesktop', Object.freeze({
  platform: process.platform,
  packaged: process.defaultApp !== true,
}))
