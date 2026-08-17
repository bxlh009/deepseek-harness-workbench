// @vitest-environment jsdom
/** Host index injection and the resulting pre-plugin browser theme. */
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { injectBootTheme } from '../src/boot-theme.ts'
import { createCustomSkinFromPixels } from '../src/custom-skin.ts'
import type { CustomSkinSettings, ThemePreference, ThemeSkin } from '../src/theme-settings.ts'

const DARK_ATTRIBUTE = 'data-ds-dark-theme'
const SKIN_ATTRIBUTE = 'data-ds-skin'
const BOOTSTRAP_TOKENS_ATTRIBUTE = 'data-ds-theme-bootstrap-tokens'

function mockSystemDark(matches: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches }) as MediaQueryList))
}

function executeBootstrap(
  preference?: ThemePreference,
  html = '<html><body><div id="root"></div><script type="module"></script></body></html>',
  skin?: ThemeSkin,
  custom?: CustomSkinSettings,
): string {
  const injected = injectBootTheme(html, preference, skin, custom)
  const source = /<script>([\s\S]*?)<\/script>/.exec(injected)?.[1]
  if (source === undefined) throw new Error('theme bootstrap script missing')
  runInNewContext(source, { document, matchMedia: globalThis.matchMedia })
  return injected
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('color-scheme')
  document.body.removeAttribute(DARK_ATTRIBUTE)
  document.body.removeAttribute(SKIN_ATTRIBUTE)
  document.body.removeAttribute(BOOTSTRAP_TOKENS_ATTRIBUTE)
  document.body.removeAttribute('data-ds-theme-bootstrap-background')
  document.body.removeAttribute('style')
})

describe('theme boot index transform', () => {
  it('runs immediately inside the body before the shell mount', () => {
    mockSystemDark(false)
    const html = executeBootstrap('dark', '<html><body class="app"><div id="root"></div></body></html>', 'ocean')
    expect(html.indexOf('<script>')).toBeGreaterThan(html.indexOf('<body class="app">'))
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('<div id="root">'))
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(true)
    expect(document.body.getAttribute(SKIN_ATTRIBUTE)).toBe('ocean')
    expect(document.body.getAttribute(BOOTSTRAP_TOKENS_ATTRIBUTE)).toContain('--dsw-alias-brand-primary')
    expect(document.body.style.getPropertyValue('--dsw-alias-brand-primary')).toBe('rgb(96, 165, 250)')
  })

  it('lets durable light override a dark OS and clears stale dark state', () => {
    document.body.setAttribute(DARK_ATTRIBUTE, '')
    mockSystemDark(true)
    executeBootstrap('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(false)
    expect(document.body.getAttribute(SKIN_ATTRIBUTE)).toBe('classic')
  })

  it.each([
    [true, 'dark', true],
    [false, 'light', false],
  ] as const)('resolves system=%s to %s', (matches, colorScheme, dark) => {
    mockSystemDark(matches)
    executeBootstrap('system')
    expect(document.documentElement.style.colorScheme).toBe(colorScheme)
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(dark)
    expect(document.body.getAttribute(SKIN_ATTRIBUTE)).toBe('classic')
  })

  it('defaults to system and falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    executeBootstrap()
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(false)
    expect(document.body.getAttribute(SKIN_ATTRIBUTE)).toBe('classic')
  })

  it('appends the script to a body-less fragment', () => {
    const html = injectBootTheme('<main>loading</main>', 'dark')
    expect(html.startsWith('<main>loading</main><script>')).toBe(true)
  })

  it('publishes a persisted wallpaper before the client loads without owning page background geometry', () => {
    const custom = createCustomSkinFromPixels([{ r: 38, g: 105, b: 180 }], 'data:image/png;base64,AA==', '海边照片')
    document.body.style.backgroundImage = 'linear-gradient(red, blue)'
    document.body.style.backgroundSize = '12px 12px'
    mockSystemDark(false)
    executeBootstrap('light', '<html><body><div id="root"></div></body></html>', 'custom', custom)
    expect(document.body.getAttribute('data-ds-theme-bootstrap-background')).not.toBeNull()
    expect(document.body.style.backgroundImage).toBe('linear-gradient(red, blue)')
    expect(document.body.style.backgroundSize).toBe('12px 12px')
    expect(document.body.style.getPropertyValue('--dsh-custom-skin-image')).toContain('data:image/png;base64,AA==')
  })
})
