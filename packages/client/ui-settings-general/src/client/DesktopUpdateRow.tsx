import { useEffect, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import './desktop-update.ts'
import type { DesktopUpdateStatus } from './desktop-update.ts'
import css from './DesktopUpdateRow.module.css'

function resultText(t: TranslateNS<'settings'>, result: DesktopUpdateStatus | undefined): string {
  if (result === undefined) return t('update.source')
  if (result.status === 'idle') return t('update.source')
  if (result.status === 'development') return t('update.development', { version: result.currentVersion })
  if (result.status === 'up-to-date') return t('update.current', { version: result.currentVersion })
  if (result.status === 'available') return t('update.available', { version: result.version })
  return t('update.failed', { message: result.message })
}

/** Desktop update row copy follows the settings locale seat. */
export function DesktopUpdateRow({ t }: { t: TranslateNS<'settings'> }) {
  const bridge = window.dshDesktop
  const checkForUpdates = bridge?.checkForUpdates
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DesktopUpdateStatus>()

  useEffect(() => {
    let mounted = true
    let eventObserved = false
    const accept = (status: DesktopUpdateStatus) => { if (mounted) setResult(status) }
    const unsubscribe = bridge?.onUpdateStatus?.((status) => {
      eventObserved = true
      accept(status)
    })
    void bridge?.getUpdateStatus?.().then((status) => {
      if (!eventObserved) accept(status)
    }).catch(() => {})
    return () => { mounted = false; unsubscribe?.() }
  }, [bridge])

  if (bridge?.packaged !== true || checkForUpdates === undefined) return null

  const unread = result?.status === 'available' && result.unread
  const acknowledge = () => {
    setResult(current => current?.status === 'available' ? { ...current, unread: false } : current)
    void bridge.acknowledgeUpdate?.().then(setResult).catch(() => {})
  }
  const available = result?.status === 'available'

  return (
    <div className={css.row}>
      <button
        type="button"
        className={css.rowText}
        data-update-unread={unread || undefined}
        onClick={acknowledge}
      >
        <div className={css.title}>
          {t('update.title')}
          {unread && <span className={css.updateDot} aria-hidden="true" />}
        </div>
        <div className={css.description} role="status">{resultText(t, result)}</div>
      </button>
      <button
        type="button"
        className={css.button}
        disabled={busy}
        onClick={() => {
          setBusy(true)
          const operation = available && bridge.downloadUpdate !== undefined
            ? bridge.downloadUpdate()
            : checkForUpdates()
          void operation
            .then(setResult)
            .finally(() => { setBusy(false) })
        }}
      >
        {busy ? t('update.checking') : available ? t('update.download') : t('update.check')}
      </button>
    </div>
  )
}
