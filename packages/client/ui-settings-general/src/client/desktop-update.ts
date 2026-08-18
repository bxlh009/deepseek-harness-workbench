export type DesktopUpdateStatus =
  | { status: 'idle'; currentVersion: string }
  | { status: 'development'; currentVersion: string }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; currentVersion: string; version: string; unread: boolean }
  | { status: 'error'; currentVersion: string; message: string }

export interface DesktopUpdateBridge {
  packaged: boolean
  checkForUpdates?: () => Promise<DesktopUpdateStatus>
  getUpdateStatus?: () => Promise<DesktopUpdateStatus>
  acknowledgeUpdate?: () => Promise<DesktopUpdateStatus>
  downloadUpdate?: () => Promise<DesktopUpdateStatus>
  onUpdateStatus?: (listener: (status: DesktopUpdateStatus) => void) => () => void
}

declare global {
  interface Window {
    dshDesktop?: DesktopUpdateBridge
  }
}
