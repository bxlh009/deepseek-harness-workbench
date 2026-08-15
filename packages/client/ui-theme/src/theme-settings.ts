/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Built-in visual skins plus the persisted image-generated skin. */
export const THEME_SKINS = ['classic', 'ocean', 'forest', 'sunset', 'custom'] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Field carrying the selected visual skin. */
export const THEME_SKIN_FIELD = 'skin'

/** Field carrying the locally generated image skin pack. */
export const THEME_CUSTOM_SKIN_FIELD = 'custom'

/** Keep the settings document bounded even when the source image is large. */
export const MAX_CUSTOM_SKIN_DATA_URL_LENGTH = 450_000

/** Theme preference persisted by the product Appearance row. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Visual skin persisted by the product Appearance row. */
export type ThemeSkin = typeof THEME_SKINS[number]

/** One semantic token's light/dark values in a serializable theme pack. */
export interface ThemeTokenModes {
  /** Value used with the light base palette. */
  light: string
  /** Value used with the dark base palette. */
  dark: string
}

/** Semantic token overrides used by built-in and extension theme packs. */
export type ThemeTokenOverrides = Record<string, ThemeTokenModes>

/**
 * Durable payload produced by the local image-to-skin analyser.
 *
 * The image is a resized data URL, never the original file path. Keeping the
 * token pack beside it makes the result deterministic on the next launch and
 * avoids re-running canvas analysis during first paint.
 */
export interface CustomSkinSettings {
  /** Human-readable label derived from the selected filename. */
  name: string
  /** Resized local image used as the restrained application background. */
  image: string
  /** CSS color/gradient used by the Appearance row swatch. */
  preview: string
  /** Light/dark semantic token pack generated from sampled pixels. */
  tokens: ThemeTokenOverrides
  /**
   * Whether this image is the active skin. This marker keeps selection
   * durable while an older Host still accepts only the built-in skin ids;
   * newer Hosts also persist the canonical `skin: "custom"` field.
   */
  active?: boolean
}

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Default skin, preserving the product's existing DeepSeek palette. */
export const DEFAULT_SKIN: ThemeSkin = 'classic'

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected color-scheme preference. */
  preference: ThemePreference
  /** Selected visual skin. */
  skin: ThemeSkin
  /** Optional locally generated image skin. */
  custom?: CustomSkinSettings
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
  [THEME_SKIN_FIELD]: z.union([...THEME_SKINS]).default(DEFAULT_SKIN),
  // Schemastery's object schema has an implicit `{}` default. The custom
  // payload is validated by isCustomSkinSettings at the Host/client boundary,
  // so `any().required(false)` preserves true absence instead of inventing a
  // phantom empty skin in every existing settings document.
  [THEME_CUSTOM_SKIN_FIELD]: z.any().required(false),
})

/**
 * Narrow one wire or registry value to a persistable preference.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in preference.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some(preference => preference === value)
}

/**
 * Narrow one wire or registry value to a persistable visual skin.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in skin.
 */
export function isThemeSkin(value: unknown): value is ThemeSkin {
  return THEME_SKINS.some(skin => skin === value)
}

/** Narrow a value crossing the settings transport to a valid custom skin. */
export function isCustomSkinSettings(value: unknown): value is CustomSkinSettings {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.name !== 'string' || candidate.name.length === 0 || candidate.name.length > 80) return false
  if (candidate.active !== undefined && typeof candidate.active !== 'boolean') return false
  if (typeof candidate.image !== 'string' || candidate.image.length > MAX_CUSTOM_SKIN_DATA_URL_LENGTH) return false
  if (!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(candidate.image)) return false
  if (!isSafeCssValue(candidate.preview, 240)) return false
  if (typeof candidate.tokens !== 'object' || candidate.tokens === null) return false
  const entries = Object.entries(candidate.tokens)
  if (entries.length > 120) return false
  return entries.every(([name, modes]) => {
    const tokenModes = modes as Record<string, unknown>
    return /^--[a-z0-9-]+$/i.test(name)
      && typeof modes === 'object' && modes !== null
      && isSafeCssValue(tokenModes.light, 240)
      && isSafeCssValue(tokenModes.dark, 240)
  })
}

function isSafeCssValue(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && !/[;{}<>]/.test(value)
}
