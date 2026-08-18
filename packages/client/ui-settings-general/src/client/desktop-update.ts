export type DesktopUpdateStatus =
  | { status: 'idle'; currentVersion: string }
  | { status: 'development'; currentVersion: string }
  | { status: 'up-to-date'; currentVersion: string; latestVersion?: string; checkedAt?: string }
  | { status: 'available'; currentVersion: string; version: string; unread: boolean; checkedAt?: string }
  | { status: 'error'; currentVersion: string; message: string; checkedAt?: string }

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
