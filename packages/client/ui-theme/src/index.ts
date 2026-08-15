/** Host registration for the browser theme preference and pre-plugin palette. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { injectBootTheme } from './boot-theme.ts'
import {
  DEFAULT_PREFERENCE, DEFAULT_SKIN, isCustomSkinSettings, isThemePreference, isThemeSkin,
  THEME_SETTINGS_NAMESPACE, ThemeSettingsSchema,
  type ThemeSettings,
} from './theme-settings.ts'
export { BUILTIN_SKINS } from './skin-definitions.ts'
export type { ThemeSkinDefinition } from './skin-definitions.ts'

export {
  DEFAULT_PREFERENCE, DEFAULT_SKIN, THEME_PREFERENCE_FIELD, THEME_PREFERENCES,
  THEME_CUSTOM_SKIN_FIELD, THEME_SKIN_FIELD, THEME_SKINS, THEME_SETTINGS_NAMESPACE,
  type CustomSkinSettings, type ThemePreference, type ThemeSettings, type ThemeSkin,
  type ThemeTokenModes, type ThemeTokenOverrides,
} from './theme-settings.ts'

const THEME_NAMESPACE = settingsNamespace(THEME_SETTINGS_NAMESPACE)

/** Read the registered settings or use schema defaults without a settings provider. */
function readSettings(ctx: Context): ThemeSettings {
  const settings = ctx.get('settings')
  if (settings === undefined) return { preference: DEFAULT_PREFERENCE, skin: DEFAULT_SKIN }
  const section = settings.get(THEME_NAMESPACE) as Partial<ThemeSettings> | undefined
  const custom = isCustomSkinSettings(section?.custom) ? section.custom : undefined
  const selectedSkin = isThemeSkin(section?.skin) ? section.skin : DEFAULT_SKIN
  const skin = selectedSkin === 'custom' && custom === undefined
    ? DEFAULT_SKIN
    : custom?.active === true ? 'custom' : selectedSkin
  return {
    preference: isThemePreference(section?.preference) ? section.preference : DEFAULT_PREFERENCE,
    skin,
    ...(custom === undefined ? {} : { custom }),
  }
}

/**
 * Register the durable theme section and initial-theme index transform when
 * their optional Host services are composed.
 * @param ctx - Host context that may acquire settings and HTTP services.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(THEME_NAMESPACE, ThemeSettingsSchema)
  })
  ctx.inject(['webServer'], (httpCtx) => {
    httpCtx.effect(
      () => httpCtx.webServer.tapIndex((html) => {
        const settings = readSettings(ctx)
        return injectBootTheme(html, settings.preference, settings.skin, settings.custom)
      }),
      'client-ui-theme: initial theme bootstrap',
    )
  })
}
