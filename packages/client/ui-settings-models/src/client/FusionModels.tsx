import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  IApiClient, ModelProviderGroup, SettingsNamespaceView,
} from '@deepseek-ai/dsh-api-remotes/client'
import { IconPlusOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ModelsSettingsStore } from './store.ts'
import type { en } from './locales.ts'
import { ModelArena } from './ModelArena.tsx'
import styles from './ModelsSection.module.css'

interface Route { provider: string; model: string }
interface GlobalVision extends Route { shareImagesWithProvider: boolean }
interface FusionProfile {
  id: string
  name: string
  candidates: Route[]
  synthesizer: Route
  visionProvider?: string
  visionModel?: string
  shareImagesWithVisionProvider?: boolean
}
interface Props {
  groups: readonly ModelProviderGroup[]
  namespace: SettingsNamespaceView | undefined
  writable: boolean
  api: Pick<IApiClient, 'settings' | 'llm'>
  controller: ModelsSettingsStore
  t: (key: keyof typeof en) => string
}

const keyOf = (route: Route): string => `${route.provider}\u0000${route.model}`
const labelOf = (route: Route): string => `${route.provider}/${route.model}`
const routeOf = (key: string): Route => {
  const [provider = '', model = ''] = key.split('\u0000')
  return { provider, model }
}

function profilesOf(value: unknown): FusionProfile[] {
  if (typeof value !== 'object' || value === null) return []
  const models = (value as { models?: unknown }).models
  return Array.isArray(models) ? models as FusionProfile[] : []
}

function globalVisionOf(value: unknown): GlobalVision | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const config = value as { globalVisionProvider?: unknown; globalVisionModel?: unknown; shareImagesWithGlobalVisionProvider?: unknown }
  return typeof config.globalVisionProvider === 'string' && typeof config.globalVisionModel === 'string'
    && config.shareImagesWithGlobalVisionProvider === true
    ? { provider: config.globalVisionProvider, model: config.globalVisionModel, shareImagesWithProvider: true }
    : undefined
}

export function FusionModels({ groups, namespace, writable, api, controller, t }: Props): ReactNode {
  const profiles = profilesOf(namespace?.value)
  const configuredGlobalVision = globalVisionOf(namespace?.value)
  const configuredGlobalVisionKey = configuredGlobalVision === undefined ? '' : keyOf(configuredGlobalVision)
  const available = groups.filter(group => group.id !== 'fusion')
  const visionCapable = available.flatMap(group => group.models.filter(model => model.inputModalities?.includes('image')))
  const first = available.flatMap(group => group.models.map(model => ({ provider: group.id, model: model.id })))[0]
  const [editing, setEditing] = useState<number | 'new' | undefined>(undefined)
  const [id, setId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [synthesizer, setSynthesizer] = useState('')
  const [vision, setVision] = useState('')
  const [shareImages, setShareImages] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [globalVision, setGlobalVision] = useState(() => configuredGlobalVisionKey)
  const [globalConsent, setGlobalConsent] = useState(configuredGlobalVision !== undefined)
  const [globalBusy, setGlobalBusy] = useState(false)
  const [globalFailure, setGlobalFailure] = useState<string | undefined>(undefined)
  const [globalSaved, setGlobalSaved] = useState(false)

  const visionOptions = available.flatMap(group => group.models.map((model) => {
    const route = keyOf({ provider: group.id, model: model.id })
    const supportsImages = model.inputModalities?.includes('image') === true
    return (
      <option key={route} value={route} disabled={!supportsImages}>
        {group.name} / {model.name}{supportsImages ? '' : ` — ${t('visionCapabilityMissing')}`}
      </option>
    )
  }))

  useEffect(() => {
    setGlobalVision(configuredGlobalVisionKey)
    setGlobalConsent(configuredGlobalVisionKey.length > 0)
  }, [configuredGlobalVisionKey])

  const saveGlobalVision = async (): Promise<void> => {
    if (namespace === undefined) { setGlobalFailure(t('fusionUnavailable')); return }
    if (globalVision.length > 0 && !globalConsent) return
    setGlobalBusy(true)
    setGlobalFailure(undefined)
    setGlobalSaved(false)
    try {
      const response = await api.settings.mutate({
        ns: 'llm-fusion',
        ops: globalVision.length === 0
          ? [
            { op: 'unset', path: ['globalVisionProvider'] },
            { op: 'unset', path: ['globalVisionModel'] },
            { op: 'unset', path: ['shareImagesWithGlobalVisionProvider'] },
          ]
          : [
            { op: 'set', path: ['globalVisionProvider'], value: routeOf(globalVision).provider },
            { op: 'set', path: ['globalVisionModel'], value: routeOf(globalVision).model },
            { op: 'set', path: ['shareImagesWithGlobalVisionProvider'], value: true },
          ],
        expectedRevision: namespace.revision,
      })
      if (!response.result.ok) { setGlobalFailure(response.result.error.message); return }
      setGlobalSaved(true)
      await controller.load()
    } catch (error) {
      setGlobalFailure(error instanceof Error ? error.message : String(error))
    } finally { setGlobalBusy(false) }
  }

  const open = (target: number | 'new'): void => {
    const profile = target === 'new' ? undefined : profiles[target]
    setEditing(target)
    setId(profile?.id ?? '')
    setDisplayName(profile?.name ?? '')
    setSelected(new Set(profile?.candidates.map(keyOf) ?? []))
    setSynthesizer(profile === undefined ? (first === undefined ? '' : keyOf(first)) : keyOf(profile.synthesizer))
    setVision(profile?.visionProvider === undefined || profile.visionModel === undefined ? '' : keyOf({ provider: profile.visionProvider, model: profile.visionModel }))
    setShareImages(profile?.shareImagesWithVisionProvider === true)
    setFailure(undefined)
  }

  const write = async (next: FusionProfile[]): Promise<void> => {
    if (namespace === undefined) {
      setFailure(t('fusionUnavailable'))
      return
    }
    setBusy(true)
    setFailure(undefined)
    try {
      const response = await api.settings.mutate({
        ns: 'llm-fusion',
        ops: [{ op: 'set', path: ['models'], value: next }],
        expectedRevision: namespace.revision,
      })
      if (!response.result.ok) { setFailure(response.result.error.message); return }
      setEditing(undefined)
      await controller.load()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false) }
  }

  const save = (): void => {
    const candidateRoutes = [...selected].map(routeOf)
    const normalizedId = id.trim()
    if (!/^[a-z][a-z0-9-]*$/.test(normalizedId)) { setFailure(t('fusionIdInvalid')); return }
    if (profiles.some((profile, index) => profile.id === normalizedId && index !== editing)) {
      setFailure(t('fusionIdDuplicate')); return
    }
    if (displayName.trim().length === 0) { setFailure(t('fusionNameRequired')); return }
    if (candidateRoutes.length < 2 || candidateRoutes.length > 4) { setFailure(t('fusionCandidatesInvalid')); return }
    if (synthesizer.length === 0) { setFailure(t('fusionSynthRequired')); return }
    if (vision.length > 0 && !shareImages) { setFailure(t('fusionVisionConsentRequired')); return }
    const profile: FusionProfile = {
      id: normalizedId,
      name: displayName.trim(),
      candidates: candidateRoutes,
      synthesizer: routeOf(synthesizer),
      ...vision.length === 0
        ? {}
        : {
          visionProvider: routeOf(vision).provider,
          visionModel: routeOf(vision).model,
          shareImagesWithVisionProvider: true,
        },
    }
    const next = [...profiles]
    if (editing === 'new') next.push(profile)
    else if (typeof editing === 'number') next[editing] = profile
    void write(next)
  }

  return (
    <>
      <section className={styles['fusionSection']} aria-labelledby="global-vision-title">
        <div className={styles['fusionHeading']}>
          <div><h3 id="global-vision-title" className={styles['fusionTitle']}>{t('globalVisionTitle')}</h3><p className={styles['intro']}>{t('globalVisionIntro')}</p></div>
        </div>
        <div className={styles['editor']}>
          <label className={styles['field']}><span className={styles['fieldLabel']}>{t('globalVision')}</span><select className={`${styles['input']} ${styles['selectInput']}`} value={globalVision} disabled={!writable || globalBusy} onChange={(event) => { setGlobalVision(event.target.value); setGlobalConsent(false); setGlobalSaved(false) }}><option value="">{t('globalVisionOff')}</option>{visionOptions}</select>{visionCapable.length === 0 ? <span className={styles['modelFieldHint']}>{t('globalVisionEmpty')}</span> : null}</label>
          {globalVision.length === 0 ? null : <label className={styles['candidateLabel']}><input type="checkbox" checked={globalConsent} disabled={!writable || globalBusy} onChange={(event) => { setGlobalConsent(event.target.checked); setGlobalSaved(false) }} /><span>{t('globalVisionConsent')}</span></label>}
          {globalFailure === undefined ? null : <p className={styles['error']}>{globalFailure}</p>}
          {globalSaved ? <p className={styles['notice']} role="status">{t('globalVisionSaved')}</p> : null}
          <div className={styles['editorFooter']}><button type="button" className={styles['primaryButton']} disabled={!writable || globalBusy || (globalVision.length > 0 && !globalConsent)} onClick={() => { void saveGlobalVision() }}>{globalBusy ? t('applying') : t('globalVisionSave')}</button></div>
        </div>
      </section>
      <section className={styles['fusionSection']} aria-labelledby="fusion-models-title">
        <div className={styles['fusionHeading']}>
          <div>
            <h3 id="fusion-models-title" className={styles['fusionTitle']}>{t('fusionTitle')}</h3>
            <p className={styles['intro']}>{t('fusionIntro')}</p>
          </div>
          {editing === undefined ? (
            <button type="button" className={styles['addModelButton']} disabled={!writable || first === undefined} onClick={() => { open('new') }}>
              <IconPlusOutline16 size={14} />{t('fusionAdd')}
            </button>
          ) : null}
        </div>
        {profiles.length === 0 && editing === undefined ? <p className={styles['modelEmpty']}>{t('fusionEmpty')}</p> : null}
        <ul className={styles['rows']}>
          {profiles.map((profile, index) => (
            <li key={profile.id} className={styles['rowCard']}>
              <div className={styles['rowHead']}>
                <span className={styles['rowIdentity']}><span className={styles['rowName']}>{profile.name}</span><span className={styles['rowTag']}>{profile.id}</span></span>
                <span className={styles['rowActions']}>
                  <button type="button" className={styles['secondaryButton']} onClick={() => { open(index) }}>{t('edit')}</button>
                  <button type="button" className={styles['dangerButton']} disabled={!writable || busy} onClick={() => { void write(profiles.filter((_, current) => current !== index)) }}>{t('remove')}</button>
                </span>
              </div>
              <p className={styles['fusionRoute']}>{profile.candidates.map(labelOf).join(' + ')} → {labelOf(profile.synthesizer)}{profile.visionProvider === undefined || profile.visionModel === undefined ? '' : ` · ${t('fusionVisionBadge')} ${labelOf({ provider: profile.visionProvider, model: profile.visionModel })}`}</p>
            </li>
          ))}
        </ul>
        {editing === undefined ? null : (
          <div className={styles['editor']}>
            <div className={styles['modelAdvanced']}>
              <label className={styles['modelField']}><span className={styles['modelFieldLabel']}>{t('fusionId')}</span><input className={styles['input']} value={id} disabled={busy} onChange={(event) => { setId(event.target.value) }} /></label>
              <label className={styles['modelField']}><span className={styles['modelFieldLabel']}>{t('fusionName')}</span><input className={styles['input']} value={displayName} disabled={busy} onChange={(event) => { setDisplayName(event.target.value) }} /></label>
            </div>
            <fieldset className={styles['fusionChoices']} disabled={busy}>
              <legend className={styles['fieldLabel']}>{t('fusionCandidates')}</legend>
              {available.map(group => (
                <div key={group.id} className={styles['fusionGroup']}><span className={styles['modelFieldLabel']}>{group.name}</span>{group.models.map((model) => {
                  const key = keyOf({ provider: group.id, model: model.id })
                  return <label key={key} className={styles['candidateLabel']}><input type="checkbox" checked={selected.has(key)} onChange={(event) => { setSelected((current) => {
                    const next = new Set(current)
                    if (event.target.checked) next.add(key)
                    else next.delete(key)
                    return next
                  }) }} /><span>{model.name}</span><span className={styles['rowTag']}>{model.id}</span></label>
                })}</div>
              ))}
            </fieldset>
            <label className={styles['field']}><span className={styles['fieldLabel']}>{t('fusionSynth')}</span><select className={`${styles['input']} ${styles['selectInput']}`} value={synthesizer} disabled={busy} onChange={(event) => { setSynthesizer(event.target.value) }}>{available.flatMap(group => group.models.map(model => <option key={keyOf({ provider: group.id, model: model.id })} value={keyOf({ provider: group.id, model: model.id })}>{group.name} / {model.name}</option>))}</select></label>
            <label className={styles['field']}><span className={styles['fieldLabel']}>{t('fusionVision')}</span><select className={`${styles['input']} ${styles['selectInput']}`} value={vision} disabled={busy} onChange={(event) => { setVision(event.target.value); if (event.target.value.length === 0) setShareImages(false) }}><option value="">{t('fusionVisionOff')}</option>{visionOptions}</select><span className={styles['modelFieldHint']}>{t('fusionVisionHint')}</span></label>
            {vision.length === 0 ? null : <label className={styles['candidateLabel']}><input type="checkbox" checked={shareImages} disabled={busy} onChange={(event) => { setShareImages(event.target.checked) }} /><span>{t('fusionVisionConsent')}</span></label>}
            {failure === undefined ? null : <p className={styles['error']}>{failure}</p>}
            <div className={styles['editorFooter']}><button type="button" className={styles['secondaryButton']} disabled={busy} onClick={() => { setEditing(undefined) }}>{t('cancel')}</button><button type="button" className={styles['primaryButton']} disabled={busy} onClick={save}>{busy ? t('applying') : t('apply')}</button></div>
          </div>
        )}
      </section>
      <ModelArena profiles={profiles} api={api} t={t} />
    </>
  )
}
