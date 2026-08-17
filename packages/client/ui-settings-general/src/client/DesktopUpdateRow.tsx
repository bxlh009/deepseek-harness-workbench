import { useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
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

function resultText(t: TranslateNS<'settings'>, result: UpdateResult | undefined): string {
  if (result === undefined) return t('update.source')
  if (result.status === 'development') return t('update.development', { version: result.currentVersion })
  if (result.status === 'up-to-date') return t('update.current', { version: result.currentVersion })
  if (result.status === 'available') return t('update.available', { version: result.version })
  return t('update.failed', { message: result.message })
}

/** Desktop update row copy follows the settings locale seat. */
export function DesktopUpdateRow({ t }: { t: TranslateNS<'settings'> }) {
  const bridge = window.dshDesktop
  const checkForUpdates = bridge?.checkForUpdates
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateResult>()

  if (bridge?.packaged !== true || checkForUpdates === undefined) return null

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('update.title')}</div>
        <div className={css.description} role="status">{resultText(t, result)}</div>
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
        {checking ? t('update.checking') : t('update.check')}
      </button>
    </div>
  )
}
