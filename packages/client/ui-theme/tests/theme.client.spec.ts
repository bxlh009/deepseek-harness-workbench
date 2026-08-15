// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { stubSettingsScope, type StubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  ThemeSettings,
  ThemeSnapshot,
  ThemeTokenOverrides,
} from '@deepseek-ai/dsh-client-ui-theme/client'
import { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { createCustomSkinFromPixels } from '../src/custom-skin.ts'

const make = (host = stubSettingsScope<ThemeSettings>()): {
  ctx: Context
  theme: ThemeRuntime
  events: ThemeSnapshot[]
  host: StubSettingsScope<ThemeSettings>
} => {
  const ctx = new Context()
  const events: ThemeSnapshot[] = []
  ctx.on('theme/change', (snapshot) => { events.push(snapshot) })
  return { ctx, theme: new ThemeRuntime(ctx, host.scope), events, host }
}

describe('ThemeRuntime', () => {
  it('defaults to the system preference resolved against prefers-color-scheme', () => {
    const { theme } = make()
    const snapshot = theme.getTheme()
    expect(snapshot.preference).toBe('system')
    expect(snapshot.skin).toBe('classic')
    // jsdom matchMedia is absent; system resolves to light.
    expect(snapshot.active.id).toBe('light')
    expect(snapshot.active.colorScheme).toBe('light')
    expect(snapshot.themes.map(t => t.id)).toEqual(['light', 'dark'])
    expect(snapshot.skins.map(skin => skin.id)).toEqual(['classic', 'ocean', 'forest', 'sunset'])
  })

  it('setTheme switches, writes through the scope, republishes, and keeps DOM untouched', () => {
    const { theme, events, host } = make()
    theme.setTheme('dark')
    expect(theme.getTheme().preference).toBe('dark')
    expect(theme.getTheme().active.colorScheme).toBe('dark')
    expect(host.set).toHaveBeenCalledWith('preference', 'dark')
    expect(events).toHaveLength(1)
    expect(events[0]).toBe(theme.getTheme())
    // The service never touches presentation state.
    expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(false)
    // Same-value set is a no-op (no extra event).
    theme.setTheme('dark')
    expect(events).toHaveLength(1)
    expect(host.set).toHaveBeenCalledOnce()
  })

  it('setSkin switches independently, writes through the scope, and republishes', () => {
    const { theme, events, host } = make()
    theme.setSkin('ocean')
    expect(theme.getTheme().skin).toBe('ocean')
    expect(theme.getTheme().preference).toBe('system')
    expect(host.set).toHaveBeenCalledWith('skin', 'ocean')
    expect(events).toHaveLength(1)
    theme.setSkin('ocean')
    expect(events).toHaveLength(1)
    expect(host.set).toHaveBeenCalledOnce()
  })

  it('applies, persists, and clears an image-generated skin', () => {
    const { theme, events, host } = make()
    const custom = createCustomSkinFromPixels([
      { r: 176, g: 56, b: 92 },
      { r: 236, g: 138, b: 82, weight: 2 },
    ], 'data:image/png;base64,AA==', '夕阳照片')

    theme.setCustomSkin(custom)
    expect(theme.getTheme().skin).toBe('custom')
    expect(theme.getTheme().backgroundImage).toBe(custom.image)
    expect(theme.getTheme().skins.map(skin => skin.id)).toEqual(['classic', 'ocean', 'forest', 'sunset', 'custom'])
    expect(theme.getTheme().active.tokens['--dsw-alias-brand-primary']).toBe(custom.tokens['--dsw-alias-brand-primary']?.light)
    expect(host.set).toHaveBeenCalledWith('custom', expect.objectContaining({ name: '夕阳照片', active: true }))
    expect(host.set).toHaveBeenCalledWith('skin', 'custom')

    theme.setTheme('dark')
    expect(theme.getTheme().active.tokens['--dsw-alias-brand-primary']).toBe(custom.tokens['--dsw-alias-brand-primary']?.dark)
    theme.clearCustomSkin()
    expect(theme.getTheme().skin).toBe('classic')
    expect(theme.getTheme().backgroundImage).toBeUndefined()
    expect(host.unset).toHaveBeenCalledWith('custom')
    expect(events.length).toBe(3)
  })

  it('does not let an intermediate Host snapshot undo a just-applied image skin', () => {
    const host = stubSettingsScope<ThemeSettings>()
    const { theme } = make(host)
    const custom = createCustomSkinFromPixels([{ r: 30, g: 130, b: 100 }], 'data:image/png;base64,AA==', '森林照片')

    theme.setCustomSkin(custom)
    // The two field writes can be observed as separate accepted snapshots:
    // the image payload is present before the selected skin field catches up.
    host.publish({
      status: 'ready',
      value: { preference: 'system', skin: 'classic', custom },
      revision: 1,
      writable: true,
    })

    expect(theme.getTheme().skin).toBe('custom')
    expect(theme.getTheme().backgroundImage).toBe(custom.image)
  })

  it('keeps an explicit built-in selection while an older custom snapshot is in flight', () => {
    const host = stubSettingsScope<ThemeSettings>()
    const { theme } = make(host)
    const custom = createCustomSkinFromPixels([{ r: 30, g: 130, b: 100 }], 'data:image/png;base64,AA==', '森林照片')

    host.publish({ status: 'ready', value: { preference: 'system', skin: 'custom', custom }, revision: 1, writable: true })
    expect(theme.getTheme().backgroundImage).toBe(custom.image)
    theme.setSkin('classic')
    expect(theme.getTheme().skins.find(skin => skin.id === 'custom')?.backgroundImage).toBe(custom.image)
    host.publish({ value: { preference: 'system', skin: 'custom', custom }, revision: 2 })

    expect(theme.getTheme().skin).toBe('classic')
    expect(theme.getTheme().skins.find(skin => skin.id === 'custom')?.backgroundImage).toBe(custom.image)
  })

  it('adopts a valid persisted custom skin without writing it back', () => {
    const custom = createCustomSkinFromPixels([{ r: 30, g: 130, b: 100 }], 'data:image/png;base64,AA==', '森林照片')
    const host = stubSettingsScope<ThemeSettings>()
    host.publish({
      status: 'ready',
      value: { preference: 'light', skin: 'custom', custom },
      revision: 1,
      writable: true,
    })
    const { theme } = make(host)
    expect(theme.getTheme().skin).toBe('custom')
    expect(theme.getTheme().backgroundImage).toBe(custom.image)
    expect(host.set).not.toHaveBeenCalled()
  })

  it('adopts the active image marker when an older Host still reports a built-in skin', () => {
    const custom = createCustomSkinFromPixels([{ r: 30, g: 130, b: 100 }], 'data:image/png;base64,AA==', '森林照片')
    const host = stubSettingsScope<ThemeSettings>()
    host.publish({
      status: 'ready',
      value: { preference: 'light', skin: 'classic', custom: { ...custom, active: true } },
      revision: 1,
      writable: true,
    })
    const { theme } = make(host)
    expect(theme.getTheme().skin).toBe('custom')
    expect(theme.getTheme().backgroundImage).toBe(custom.image)
    expect(host.set).not.toHaveBeenCalled()
  })

  it('resolves the selected skin into semantic tokens for both color schemes', () => {
    const { theme } = make()
    theme.setSkin('sunset')
    expect(theme.getTheme().active.tokens['--dsw-alias-bg-base']).toBe('rgb(255, 248, 241)')
    expect(theme.getTheme().active.tokens['--dsw-alias-label-primary']).toBe('rgb(74, 37, 23)')
    expect(theme.getTheme().active.tokens['--dsw-alias-brand-primary']).toBe('rgb(194, 65, 12)')
    theme.setTheme('dark')
    expect(theme.getTheme().active.tokens['--dsw-alias-bg-base']).toBe('rgb(31, 18, 12)')
    expect(theme.getTheme().active.tokens['--dsw-alias-label-primary']).toBe('rgb(255, 241, 230)')
    expect(theme.getTheme().active.tokens['--dsw-alias-brand-primary']).toBe('rgb(251, 146, 60)')
  })

  it('adopts a published Host section without writing it back', () => {
    const { theme, events, host } = make()
    host.publish({ status: 'ready', value: { preference: 'dark', skin: 'classic' }, revision: 1, writable: true })
    expect(theme.getTheme().preference).toBe('dark')
    expect(events).toHaveLength(1)
    expect(host.set).not.toHaveBeenCalled()
    host.publish({ value: { preference: 'dark', skin: 'classic' }, revision: 2 })
    expect(events).toHaveLength(1)
  })

  it('adopts a section already standing at construction', () => {
    const host = stubSettingsScope<ThemeSettings>()
    host.publish({ status: 'ready', value: { preference: 'dark', skin: 'classic' }, revision: 1, writable: true })
    const { theme } = make(host)
    expect(theme.getTheme().preference).toBe('dark')
  })

  it('throws on unknown setTheme ids, duplicate registration, and the system id', () => {
    const { theme } = make()
    expect(() => { theme.setTheme('sepia') }).toThrow('not registered')
    expect(() => { theme.setSkin('sepia') }).toThrow('not registered')
    expect(() => theme.register({ id: 'light', colorScheme: 'light', tokens: {} })).toThrow('already registered')
    expect(() => theme.register({ id: 'system', colorScheme: 'light', tokens: {} })).toThrow('preference')
  })

  it('registered themes join the snapshot; disposing the active one resets to default', () => {
    const { theme, events, host } = make()
    const dispose = theme.register({ id: 'sepia', colorScheme: 'light', tokens: { '--dsw-alias-bg-base': 'red' } })
    expect(theme.getTheme().themes.map(t => t.id)).toEqual(['light', 'dark', 'sepia'])
    theme.setTheme('sepia')
    expect(theme.getTheme().active.tokens['--dsw-alias-bg-base']).toBe('red')
    dispose()
    expect(theme.getTheme().preference).toBe('system')
    expect(theme.getTheme().themes.map(t => t.id)).toEqual(['light', 'dark'])
    // Custom ids are in-process extension themes; only the built-in product
    // preferences cross the Host settings schema.
    expect(host.set).not.toHaveBeenCalled()
    // register + set + dispose = three publishes; disposer is idempotent.
    expect(events.length).toBe(3)
    dispose()
    expect(events.length).toBe(3)
  })

  it('disposing an inactive theme keeps the active preference', () => {
    const { theme } = make()
    const dispose = theme.register({ id: 'sepia', colorScheme: 'light', tokens: {} })
    theme.setTheme('dark')
    dispose()
    expect(theme.getTheme().preference).toBe('dark')
  })

  it('revision increases monotonically across every publish', () => {
    const { theme, events } = make()
    theme.setTheme('dark')
    theme.setTheme('light')
    const dispose = theme.register({ id: 'sepia', colorScheme: 'dark', tokens: {} })
    dispose()
    expect(events.map(e => e.revision)).toEqual([1, 2, 3, 4])
  })

  it('stacks reversible token overrides in call order and selects the active palette value', () => {
    const { theme } = make()
    const firstTokens: ThemeTokenOverrides = {
      '--shared': { light: 'first-light', dark: 'first-dark' },
      '--first': { light: 'first-only-light', dark: 'first-only-dark' },
    }
    const disposeFirst = theme.overrideTokens('first', firstTokens)
    firstTokens['--shared']!.light = 'mutated-after-call'
    const disposeSecond = theme.overrideTokens('second', {
      '--shared': { light: 'second-light', dark: 'second-dark' },
    })

    expect(theme.getTheme().active.tokens).toMatchObject({
      '--first': 'first-only-light',
      '--shared': 'second-light',
    })
    theme.setTheme('dark')
    expect(theme.getTheme().active.tokens).toMatchObject({
      '--first': 'first-only-dark',
      '--shared': 'second-dark',
    })

    disposeSecond()
    expect(theme.getTheme().active.tokens['--shared']).toBe('first-dark')
    disposeFirst()
    expect(theme.getTheme().active.tokens['--shared']).toBeUndefined()
  })

  it('replacing one source leaves its stale disposer harmless', () => {
    const { theme, events } = make()
    const stale = theme.overrideTokens('package', {
      '--old': { light: 'old-light', dark: 'old-dark' },
    })
    const current = theme.overrideTokens('package', {
      '--new': { light: 'new-light', dark: 'new-dark' },
    })
    stale()
    expect(theme.getTheme().active.tokens).toEqual({ '--new': 'new-light' })
    current()
    current()
    expect(theme.getTheme().active.tokens).toEqual({})
    expect(events).toHaveLength(3)
  })

  it('exports sorted built-in, registered, and override-only token descriptions as copies', () => {
    const { theme } = make()
    theme.register({
      id: 'custom',
      colorScheme: 'light',
      tokens: {
        '--dsw-alias-bg-base': 'duplicate-built-in',
        '--registered': 'registered',
      },
    })
    theme.overrideTokens('package', {
      '--registered': { light: 'duplicate-registered', dark: 'duplicate-registered' },
      semanticAccent: { light: 'pink', dark: 'red' },
    })

    const tokens = theme.exportInspectTokens()
    expect(tokens.map(token => token.name)).toEqual([...tokens.map(token => token.name)].sort())
    expect(tokens.find(token => token.name === '--registered')).toMatchObject({
      valueType: 'CSS value',
      cssVariable: '--registered',
    })
    const semantic = tokens.find(token => token.name === 'semanticAccent')
    expect(semantic).toMatchObject({ valueType: 'CSS value' })
    expect(semantic).not.toHaveProperty('cssVariable')
    expect(tokens.filter(token => token.name === '--dsw-alias-bg-base')).toHaveLength(1)

    tokens[0]!.description = 'caller mutation'
    expect(theme.exportInspectTokens()[0]!.description).not.toBe('caller mutation')
  })

  it('rejects every malformed token override value with a teaching error', () => {
    const { theme } = make()
    const override = (value: unknown): void => {
      theme.overrideTokens('package', { '--bad': value } as unknown as ThemeTokenOverrides)
    }
    expect(() => { override('red') }).toThrow(/bare string.*light.*dark/)
    for (const value of [1, null, {}, { light: 1, dark: 'dark' }, { light: 'light' }]) {
      expect(() => { override(value) }).toThrow(/must map to a \{ light, dark \} pair/)
    }
  })

  it('context dispose releases the scope subscription', async () => {
    const { ctx, host } = make()
    expect(host.listenerCount()).toBe(1)
    await ctx.fiber.dispose()
    expect(host.listenerCount()).toBe(0)
  })

  describe('prefers-color-scheme resolution (stubbed matchMedia)', () => {
    type Listener = () => void
    const stubMedia = (initialMatches: boolean) => {
      const listeners = new Set<Listener>()
      const media = {
        matches: initialMatches,
        addEventListener: (_: 'change', fn: Listener) => { listeners.add(fn) },
        removeEventListener: (_: 'change', fn: Listener) => { listeners.delete(fn) },
        flip() {
          this.matches = !this.matches
          for (const fn of listeners) fn()
        },
        listenerCount: () => listeners.size,
      }
      vi.stubGlobal('matchMedia', () => media)
      return media
    }

    afterEach(() => { vi.unstubAllGlobals() })

    it('system resolves against the media query and follows OS flips', () => {
      const media = stubMedia(true)
      const { theme, events } = make()
      expect(theme.getTheme().preference).toBe('system')
      expect(theme.getTheme().active.id).toBe('dark')
      media.flip()
      expect(theme.getTheme().active.id).toBe('light')
      expect(events).toHaveLength(1)
    })

    it('OS flips do not republish while a concrete preference is set', () => {
      const media = stubMedia(false)
      const { theme, events } = make()
      theme.setTheme('light')
      expect(events).toHaveLength(1)
      media.flip()
      expect(events).toHaveLength(1)
      expect(theme.getTheme().active.id).toBe('light')
    })

    it('context dispose releases the media listener', async () => {
      const media = stubMedia(false)
      const { ctx } = make()
      expect(media.listenerCount()).toBe(1)
      await ctx.fiber.dispose()
      expect(media.listenerCount()).toBe(0)
    })
  })
})
