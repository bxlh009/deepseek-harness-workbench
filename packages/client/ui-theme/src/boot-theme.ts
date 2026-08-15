/**
 * Host-rendered theme bootstrap for the browser's pre-plugin interval. Each
 * index response embeds the current durable built-in preference and skin; the
 * browser resolves only `system`, then writes the same DOM fields ui-layout's
 * ThemePresenter owns after the client plugin tree activates.
 */

import {
  DEFAULT_PREFERENCE, DEFAULT_SKIN, isCustomSkinSettings,
  type CustomSkinSettings, type ThemePreference, type ThemeSkin,
} from './theme-settings.ts'
import { BUILTIN_SKINS, customSkinDefinition } from './skin-definitions.ts'

/** Marker consumed by ThemePresenter when it takes ownership of the body style. */
export const BOOTSTRAP_BACKGROUND_ATTRIBUTE = 'data-ds-theme-bootstrap-background'

/** Build the inline script for one schema-validated preference and skin. */
function bootThemeScript(
  preference: ThemePreference,
  skin: ThemeSkin,
  custom: CustomSkinSettings | undefined,
): string {
  const definition = skin === 'custom' && custom !== undefined
    ? customSkinDefinition(custom)
    : BUILTIN_SKINS.find(candidate => candidate.id === skin) ?? BUILTIN_SKINS[0]
  const tokens = definition?.tokens ?? {}
  const backgroundImage = definition?.backgroundImage
  return `<script>(() => {
  const preference = ${JSON.stringify(preference)}
  const skin = ${JSON.stringify(skin)}
  const skinTokens = ${JSON.stringify(tokens)}
  const backgroundImage = ${JSON.stringify(backgroundImage ?? null)}
  const systemDark = preference === 'system'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || systemDark
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  document.body.setAttribute('data-ds-skin', skin)
  document.body.setAttribute('data-ds-theme-bootstrap-tokens', Object.keys(skinTokens).join(' '))
  for (const [name, modes] of Object.entries(skinTokens)) {
    document.body.style.setProperty(name, dark ? modes.dark : modes.light)
  }
  if (backgroundImage === null) {
    document.body.style.removeProperty('background-image')
    document.body.style.removeProperty('background-size')
    document.body.style.removeProperty('background-position')
    document.body.style.removeProperty('background-attachment')
    document.body.style.removeProperty('--dsh-custom-skin-image')
  } else {
    const overlay = dark
      ? 'linear-gradient(rgba(6, 10, 18, 0.30), rgba(6, 10, 18, 0.50))'
      : 'linear-gradient(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.28))'
    document.body.style.backgroundImage = overlay + ', url("' + backgroundImage + '")'
    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundAttachment = 'fixed'
    document.body.style.setProperty('--dsh-custom-skin-image', 'url("' + backgroundImage + '")')
    document.body.setAttribute('${BOOTSTRAP_BACKGROUND_ATTRIBUTE}', '')
  }
})()</script>`
}

/**
 * Insert the theme bootstrap immediately after the opening body tag, before
 * the shell mount and module script. Body-less fragments receive it at the
 * end, where the HTML parser has already synthesized a body.
 * @param html - Raw application index HTML.
 * @param preference - Current Host-backed built-in preference.
 * @param skin - Current Host-backed built-in visual skin.
 * @param custom - Current locally generated image skin, when present.
 * @returns HTML containing the theme bootstrap.
 */
export function injectBootTheme(
  html: string,
  preference: ThemePreference = DEFAULT_PREFERENCE,
  skin: ThemeSkin = DEFAULT_SKIN,
  custom?: CustomSkinSettings,
): string {
  const script = bootThemeScript(preference, skin, isCustomSkinSettings(custom) ? custom : undefined)
  const body = /<body(?:\s[^>]*)?>/i.exec(html)
  if (body === null) return `${html}${script}`
  const at = body.index + body[0].length
  return `${html.slice(0, at)}${script}${html.slice(at)}`
}
