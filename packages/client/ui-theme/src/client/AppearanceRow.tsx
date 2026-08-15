/**
 * Appearance preference row registered into the General section item slot
 * (figma 501:30012 'Frame 2117131228'): title + three preference cubes and
 * locally generated image-skin controls.
 * Registered by this package — the theme feature owns its own settings
 * surface. Selection follows the persisted preference, never the resolved
 * active theme.
 */
import clsx from 'clsx'
import { useRef, useState, type CSSProperties } from 'react'
import {
  IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { CustomSkinSettings, ThemePreference, ThemeSkin } from '../theme-settings.ts'
import { generateCustomSkin } from '../custom-skin.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
  /** Switch the visual skin. */
  setSkin: (id: ThemeSkin) => void
  /** Persist a skin generated from a local image. */
  setCustomSkin: (custom: CustomSkinSettings) => void
  /** Remove the generated image skin and its persisted payload. */
  clearCustomSkin: () => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** Cube order and icons (figma 501:30015-30017: Light, Dark, System). */
const CUBES: readonly { id: ThemePreference; labelKey: ThemeKey; Icon: typeof IconLightOutline16 }[] = [
  { id: 'light', labelKey: 'appearance.light', Icon: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Icon: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Icon: IconFollowsystemOutline16 },
]

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({
  t, setTheme, setSkin, setCustomSkin, clearCustomSkin, useStore,
}: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  const skin = useStore(s => s.skin)
  const custom = useStore(s => s.custom)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const onImageSelected = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    setBusy(true)
    setError(undefined)
    try {
      const generated = await generateCustomSkin(file)
      setCustomSkin(generated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '图片皮肤生成失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={css.group}>
      <div className={css.title}>{t('appearance.title')}</div>
      <div className={css.cubeRow}>
        {CUBES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx(css.themeCube, preference === id && css.selected)}
            aria-pressed={preference === id}
            onClick={() => { setTheme(id) }}
          >
            <Icon />
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div className={css.skinTitle}>{t('skin.title')}</div>
      <div className={css.skinRow}>
        {custom !== undefined && (
          <button
            type="button"
            className={clsx(css.skinCard, skin === 'custom' && css.selected)}
            aria-pressed={skin === 'custom'}
            style={{
              '--appearance-skin-preview': custom.preview,
              '--appearance-skin-image': custom.image === '' ? 'none' : `url("${custom.image}")`,
            } as CSSProperties}
            onClick={() => { setSkin('custom') }}
          >
            <span className={css.skinImageSwatch} aria-hidden="true" />
            <span>{custom.name}</span>
          </button>
        )}
        <button
          type="button"
          className={css.uploadCard}
          aria-label={busy ? t('skin.generating') : t('skin.upload')}
          disabled={busy}
          onClick={() => { inputRef.current?.click() }}
        >
          <span className={css.uploadIcon} aria-hidden="true">{busy ? '…' : '+'}</span>
          <span>{busy ? t('skin.generating') : t('skin.upload')}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        className={css.fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={t('skin.upload')}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          void onImageSelected(file)
        }}
      />
      {(custom !== undefined || error !== undefined) && (
        <div className={css.skinActions}>
          {custom !== undefined && (
            <button type="button" className={css.removeButton} onClick={() => { clearCustomSkin() }}>
              {t('skin.remove')}
            </button>
          )}
          {error !== undefined && <span className={css.error} role="alert">{error}</span>}
        </div>
      )}
    </div>
  )
}
