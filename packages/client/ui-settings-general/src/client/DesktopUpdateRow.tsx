import { useEffect, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import './desktop-update.ts'
import type { DesktopUpdateStatus } from './desktop-update.ts'
import css from './DesktopUpdateRow.module.css'

function resultText(t: TranslateNS<'settings'>, result: DesktopUpdateStatus | undefined): string {
  if (result === undefined) return t('update.source')
  if (result.status === 'idle') return t('update.source')
  if (result.status === 'development') return t('update.development', { version: result.currentVersion })
  if (result.status === 'up-to-date') return t('update.current')
  if (result.status === 'available') return t('update.available')
  return t('update.failed', { message: result.message })
}

function checkedAtText(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
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
  const latestVersion = result?.status === 'available'
    ? result.version
    : result?.status === 'up-to-date' ? result.latestVersion ?? result.currentVersion : undefined
  const checkedAt = result?.status === 'available' || result?.status === 'up-to-date' || result?.status === 'error'
    ? result.checkedAt
    : undefined

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
        <div className={css.description} role="status">
          <span>{resultText(t, result)}</span>
          {result === undefined ? null : (
            <span className={css.versionFacts}>
              <span>{t('update.currentVersion')} {result.currentVersion}</span>
              {latestVersion === undefined ? null : <span>{t('update.latestVersion')} {latestVersion}</span>}
              {checkedAt === undefined ? null : <span>{t('update.lastChecked')} {checkedAtText(checkedAt)}</span>}
            </span>
          )}
        </div>
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
