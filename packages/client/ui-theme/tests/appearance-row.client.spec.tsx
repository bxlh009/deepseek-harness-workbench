// @vitest-environment jsdom
/** AppearanceRow behavior: color cubes and skin cards follow persisted state;
 * clicks drive the injected writes. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { AppearanceRow } from '../src/client/AppearanceRow.tsx'
import type { AppearanceRowComponentProps } from '../src/client/AppearanceRow.tsx'
import { createAppearanceRowStore } from '../src/client/settings-store.ts'
import type { ThemePreference, ThemeSkin, ThemeSkinDefinition } from '../src/client/index.ts'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
  'skin.title': 'Skin',
  'skin.classic': 'Classic',
  'skin.ocean': 'Ocean',
  'skin.forest': 'Forest',
  'skin.sunset': 'Sunset',
  'skin.custom': 'Image skin',
  'skin.upload': 'Generate from image',
  'skin.generating': 'Generating…',
  'skin.remove': 'Remove image skin',
}

/** Empty global standard-kit hooks (the row reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(preference: ThemePreference = 'system', skin: ThemeSkin = 'classic', custom?: ThemeSkinDefinition) {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createAppearanceRowStore().create()
  if (custom === undefined) store.actions.sync(preference, skin, 0)
  else store.actions.sync(preference, skin, custom, 1)
  const setTheme = vi.fn()
  const setSkin = vi.fn()
  const setCustomSkin = vi.fn()
  const clearCustomSkin = vi.fn()
  const props: AppearanceRowComponentProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => COPY[key] ?? key,
    setTheme,
    setSkin,
    setCustomSkin,
    clearCustomSkin,
  }
  render(<AppearanceRow {...props} />)
  return { store, setTheme, setSkin }
}

const pressed = (name: RegExp): string | null =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed')

describe('AppearanceRow', () => {
  it('renders the title, three cubes, and only image-skin controls', () => {
    mount('dark', 'ocean')
    expect(screen.getByText('Appearance')).toBeDefined()
    expect(pressed(/Dark/)).toBe('true')
    expect(pressed(/Light/)).toBe('false')
    expect(pressed(/System/)).toBe('false')
    expect(screen.getByText('Skin')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Classic/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Ocean/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Forest/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Sunset/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Generate from image/ })).toBeDefined()
  })

  it('click drives setTheme; selection follows the store mirror, not the click echo', () => {
    const b = mount('dark')
    fireEvent.click(screen.getByRole('button', { name: /Light/ }))
    expect(b.setTheme).toHaveBeenCalledWith('light')
    // No store write yet: selection is unchanged.
    expect(pressed(/Dark/)).toBe('true')
    act(() => { b.store.actions.sync('light', 'classic', 1) })
    expect(pressed(/Light/)).toBe('true')
    expect(pressed(/Dark/)).toBe('false')
  })

  it('renders an uploaded image skin as selected and routes its card click', () => {
    const custom: ThemeSkinDefinition = {
      id: 'custom',
      labelKey: 'skin.custom',
      previewToken: '--ds-custom-preview',
      previewValue: 'linear-gradient(135deg, rgb(30, 130, 100), rgb(90, 190, 150))',
      name: '微信图片_20260714132020_1_18',
      backgroundImage: 'data:image/png;base64,AA==',
      tokens: {},
    }
    const b = mount('light', 'custom', custom)

    expect(pressed(/微信图片/)).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /微信图片/ }))
    expect(b.setSkin).toHaveBeenCalledWith('custom')
  })
})
