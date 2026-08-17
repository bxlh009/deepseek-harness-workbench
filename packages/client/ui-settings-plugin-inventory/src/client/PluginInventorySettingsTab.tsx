import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconChevronDownOutline14,
  IconCordisPluginOutline14,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginInventoryLocaleKey } from './locales.ts'
import css from './PluginInventorySettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface PluginInventorySettingsTabInjected {
  /** Read a current Host inventory snapshot. */
  list: () => Promise<PluginInventorySnapshot>
  /** Persist one optional Loader plugin's enabled state. */
  setEnabled: (
    entryId: PluginInventorySnapshot['entries'][number]['entryId'],
    enabled: boolean,
  ) => Promise<PluginInventorySnapshot>
}

type PluginInventoryEntry = PluginInventorySnapshot['entries'][number]
type PluginFiberPhase = PluginInventoryEntry['fiberPhase']
type PluginFilter = 'all' | 'enabled' | 'disabled'

/** Full component props assembled by the Settings slot renderer. */
export type PluginInventorySettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginInventory'>
  & InjectFace<PluginInventorySettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: PluginInventorySnapshot }

const PHASE_KEYS = {
  pending: 'pending',
  loading: 'loadingPhase',
  active: 'active',
  failed: 'failed',
  unloading: 'unloading',
} satisfies Record<Exclude<PluginFiberPhase, null>, PluginInventoryLocaleKey>

/** Localized accessible label for one root Fiber phase. */
function phaseLabel(
  phase: PluginFiberPhase,
  t: PluginInventorySettingsTabProps['t'],
): string {
  return phase === null ? t('unobserved') : t(PHASE_KEYS[phase])
}

/** Compact a module specifier without guessing whether its Loader id was generated. */
function moduleShortName(moduleName: string): string {
  const unscoped = moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName
  return unscoped
    .replace(/^cordis:/, '')
    .replace(/^cordis-plugin-/, '')
    .replace(/^dsh-(?:host-|client-)?/, '')
}

/** Whether an inventory row matches the local catalog query. */
function matches(entry: PluginInventoryEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true
  return [entry.moduleName, entry.entryId]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}

/** Localized user-facing purpose inferred from the package's stable capability name. */
function moduleDescription(
  entry: PluginInventoryEntry,
  t: PluginInventorySettingsTabProps['t'],
): string {
  if (!entry.toggleable) return t('descriptionProtected')
  const { moduleName } = entry
  const value = moduleName.toLocaleLowerCase()
  if (/hmr|dev|debug|diagnostic|trajectory|lsp/.test(value)) return t('descriptionDevelopment')
  if (/llm|model|token/.test(value)) return t('descriptionModel')
  if (/(?:^|-)tool-|(?:^|-)command-/.test(value)) return t('descriptionTool')
  if (/ui-|client-|theme|sidebar|conversation/.test(value)) return t('descriptionInterface')
  if (/session|context|agent|goal|todo|job|plan/.test(value)) return t('descriptionSession')
  if (/storage|persistence|sqlite|jsonl|spill|attachment/.test(value)) return t('descriptionStorage')
  if (/sandbox|permission|guard|policy|approval|credential/.test(value)) return t('descriptionSecurity')
  if (/plugin|skill|mcp|hook|subagent|extension/.test(value)) return t('descriptionExtension')
  return t('descriptionRuntime')
}

/** Render and manage the current Loader inventory. */
export function PluginInventorySettingsTab({ list, setEnabled, t }: PluginInventorySettingsTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PluginFilter>('all')
  const [expanded, setExpanded] = useState<PluginInventoryEntry['entryId'] | null>(null)
  const [pending, setPending] = useState<PluginInventoryEntry['entryId'] | null>(null)
  const [mutationError, setMutationError] = useState<PluginInventoryEntry['entryId'] | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(
    () => state.status === 'ready'
      ? state.snapshot.entries.filter(entry =>
        matches(entry, normalizedQuery)
        && (filter === 'all' || entry.enabled === (filter === 'enabled')))
      : [],
    [filter, normalizedQuery, state],
  )

  useEffect(() => {
    if (expanded !== null && !filteredEntries.some(entry => entry.entryId === expanded)) {
      setExpanded(null)
    }
  }, [expanded, filteredEntries])

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const toggle = (entry: PluginInventoryEntry): void => {
    if (!entry.toggleable || pending !== null) return
    setPending(entry.entryId)
    setMutationError(null)
    void setEnabled(entry.entryId, !entry.enabled).then(
      (snapshot) => { setState({ status: 'ready', snapshot }) },
      () => { setMutationError(entry.entryId) },
    ).finally(() => { setPending(null) })
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className={css.catalog}>
          <div className={css.toolbar}>
            <label className={css.search}>
              <IconSearchOutline16 aria-hidden="true" />
              <span className={css.visuallyHidden}>{t('search')}</span>
              <input
                type="search"
                value={query}
                placeholder={t('search')}
                aria-label={t('search')}
                onChange={(event) => { setQuery(event.currentTarget.value) }}
              />
            </label>
            <div className={css.filters} role="group" aria-label={t('filterLabel')}>
              {([
                ['all', 'filterAll'],
                ['enabled', 'filterEnabled'],
                ['disabled', 'filterDisabled'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => { setFilter(value) }}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
          <div className={css.catalogHeading}>
            <div>
              <h3>{t('catalog')}</h3>
              <p>{t('installedSummary')
                .replace('{enabled}', String(state.snapshot.entries.filter(entry => entry.enabled).length))
                .replace('{total}', String(state.snapshot.entries.length))}</p>
            </div>
            <span data-plugin-count={filteredEntries.length}>{filteredEntries.length}</span>
          </div>
          {state.snapshot.entries.length === 0 ? <p className={css.status}>{t('empty')}</p> : null}
          {state.snapshot.entries.length > 0 && filteredEntries.length === 0
            ? <p className={css.status}>{t('emptySearch')}</p>
            : null}
          {filteredEntries.length > 0 ? (
            <ul className={css.cards}>
              {filteredEntries.map((entry) => {
                const status = phaseLabel(entry.fiberPhase, t)
                const title = moduleShortName(entry.moduleName)
                const configuration = t(entry.enabled ? 'enabledTag' : 'disabledTag')
                const description = moduleDescription(entry, t)
                const open = expanded === entry.entryId
                const busy = pending === entry.entryId
                const detailId = `${catalogId}-details-${encodeURIComponent(entry.entryId)}`
                return (
                  <li
                    className={css.card}
                    key={entry.entryId}
                    data-plugin-entry={entry.entryId}
                    data-open={open ? 'true' : undefined}
                  >
                    <div className={css.cardHeader}>
                      <button
                        className={css.cardContent}
                        type="button"
                        aria-expanded={open}
                        aria-controls={detailId}
                        aria-label={entry.enabled ? `${title}, ${status}, ${configuration}` : `${title}, ${configuration}`}
                        onClick={() => {
                          setExpanded(current => current === entry.entryId ? null : entry.entryId)
                        }}
                      >
                        <span className={css.pluginIdentity}>
                          <span className={css.pluginIcon} aria-hidden="true">
                            <IconCordisPluginOutline14 size={18} />
                          </span>
                          <span className={css.pluginCopy}>
                            <strong className={css.cardTitle} title={entry.moduleName}>{title}</strong>
                            <span className={css.pluginDescription}>{description}</span>
                          </span>
                        </span>
                        <span className={css.cardTrailing}>
                          {entry.enabled ? (
                            <span
                              className={css.statusDot}
                              data-phase={entry.fiberPhase ?? 'unobserved'}
                              role="img"
                              aria-label={status}
                              title={status}
                            />
                          ) : null}
                          <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
                        </span>
                      </button>
                      <button
                        className={css.toggle}
                        type="button"
                        role="switch"
                        aria-checked={entry.enabled}
                        aria-label={`${t(entry.enabled ? 'disable' : 'enable')} ${title}`}
                        title={entry.toggleable ? configuration : t('protected')}
                        disabled={!entry.toggleable || pending !== null}
                        data-busy={busy ? 'true' : undefined}
                        onClick={() => { toggle(entry) }}
                      >
                        <span aria-hidden="true" />
                      </button>
                    </div>
                    {mutationError === entry.entryId ? (
                      <p className={css.mutationError} role="alert">{t('toggleFailed')}</p>
                    ) : null}
                    {open ? (
                      <div className={css.cardDetails} id={detailId}>
                        <p className={css.detailDescription}>{description}</p>
                        <code className={css.moduleName}>{entry.moduleName}</code>
                        <code className={css.entryValue} data-loader-entry>{entry.entryId}</code>
                        <dl className={css.details}>
                          <div>
                            <dt>{t('configuration')}</dt>
                            <dd>{configuration}</dd>
                          </div>
                          {entry.enabled ? (
                            <div>
                              <dt>{t('cordis')}</dt>
                              <dd>{status}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
