import { useState } from 'react'
import css from './DesktopUpdateRow.module.css'

type UpdateResult =
  | { status: 'development'; currentVersion: string }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; currentVersion: string; version: string }
  | { status: 'error'; currentVersion: string; message: string }

declare global {
  interface Window {
    dshDesktop?: {
      packaged: boolean
      checkForUpdates?: () => Promise<UpdateResult>
    }
  }
}

function resultText(result: UpdateResult | undefined): string {
  if (result === undefined) return '从独立 GitHub Releases 获取桌面更新。'
  if (result.status === 'development') return `开发模式 · 当前 ${result.currentVersion}`
  if (result.status === 'up-to-date') return `已是最新版 ${result.currentVersion}`
  if (result.status === 'available') return `发现新版本 ${result.version}，请在提示框中选择是否下载。`
  return `检查失败：${result.message}`
}

export function DesktopUpdateRow() {
  const bridge = window.dshDesktop
  const checkForUpdates = bridge?.checkForUpdates
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateResult>()

  if (bridge?.packaged !== true || checkForUpdates === undefined) return null

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>软件更新</div>
        <div className={css.description} role="status">{resultText(result)}</div>
      </div>
      <button
        type="button"
        className={css.button}
        disabled={checking}
        onClick={() => {
          setChecking(true)
          void checkForUpdates()
            .then(setResult)
            .finally(() => { setChecking(false) })
        }}
      >
        {checking ? '检查中…' : '检查更新'}
      </button>
    </div>
  )
}
