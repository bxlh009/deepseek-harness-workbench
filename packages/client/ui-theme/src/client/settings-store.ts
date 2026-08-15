/**
 * Appearance row slot store: a mirror of the theme service snapshot. The
 * plugin's apply-world change listener is the only writer; the row component
 * reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import {
  DEFAULT_PREFERENCE, DEFAULT_SKIN, type ThemePreference, type ThemeSkin,
} from '../theme-settings.ts'
import type { ThemeSkinDefinition } from '../skin-definitions.ts'

/** Small UI-only mirror of the generated skin; token payload stays in the theme service. */
export interface AppearanceRowCustomSkin {
  name: string
  preview: string
  image: string
}

/** Store state mirrored from the theme snapshot. */
export interface AppearanceRowState {
  /** Persisted preference (selection state reads this, never the resolved active theme). */
  preference: ThemePreference
  /** Persisted visual skin selected by the Appearance row. */
  skin: ThemeSkin
  /** Generated skin preview, when a local image skin has been saved. */
  custom?: AppearanceRowCustomSkin
  /** Service revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
}

/** Declared action shape giving the exported factory a stable return type. */
type AppearanceRowActions = {
  /** The 3-argument form remains accepted for existing slot tests and callers. */
  sync: (
    draft: AppearanceRowState,
    preference: ThemePreference,
    skin: ThemeSkin,
    customOrRevision: ThemeSkinDefinition | number | undefined,
    revision?: number,
  ) => void
}

/**
 * Declares the Appearance row state and write surface.
 * @returns the store handle.
 */
export function createAppearanceRowStore(): EngineStoreHandle<AppearanceRowState, AppearanceRowActions> {
  return defineStore({
    init: (): AppearanceRowState => ({ preference: DEFAULT_PREFERENCE, skin: DEFAULT_SKIN, revision: -1 }),
    actions: {
      sync: (
        d,
        preference: ThemePreference,
        skin: ThemeSkin,
        customOrRevision: ThemeSkinDefinition | number | undefined,
        revision?: number,
      ) => {
        const nextRevision = typeof customOrRevision === 'number' ? customOrRevision : (revision ?? -1)
        const custom = typeof customOrRevision === 'object'
          ? {
            name: customOrRevision.name ?? '图片皮肤',
            preview: customOrRevision.previewValue ?? `var(${customOrRevision.previewToken})`,
            image: customOrRevision.backgroundImage ?? '',
          }
          : undefined
        if (nextRevision <= d.revision) return
        d.preference = preference
        d.skin = skin
        if (custom === undefined) delete d.custom
        else d.custom = custom
        d.revision = nextRevision
      },
    },
  })
}
