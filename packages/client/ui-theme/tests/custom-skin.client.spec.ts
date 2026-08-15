import { describe, expect, it } from 'vitest'
import { createCustomSkinFromPixels } from '../src/custom-skin.ts'
import { customSkinDefinition } from '../src/skin-definitions.ts'
import { isCustomSkinSettings } from '../src/theme-settings.ts'

const IMAGE = 'data:image/png;base64,AA=='

describe('local image skin analyser', () => {
  it('turns sampled pixels into a durable light/dark token pack', () => {
    const result = createCustomSkinFromPixels([
      { r: 26, g: 86, b: 160 },
      { r: 44, g: 120, b: 190, weight: 2 },
      { r: 240, g: 248, b: 255 },
    ], IMAGE, '海边照片')

    expect(result.name).toBe('海边照片')
    expect(result.image).toBe(IMAGE)
    expect(result.preview).toContain('linear-gradient')
    expect(result.tokens['--dsw-alias-brand-primary']?.light).toMatch(/^rgb\(/)
    expect(result.tokens['--dsw-alias-brand-primary']?.dark).toMatch(/^rgb\(/)
    expect(result.tokens['--dsw-alias-bg-base']?.light).toContain('rgba')
    expect(result.tokens['--dsw-alias-bg-base']?.dark).toContain('rgba')
    expect(result.tokens['--dsw-alias-bg-base']?.light).toMatch(/0\.42\)$/)
    expect(result.tokens['--dsw-alias-bg-base']?.dark).toMatch(/0\.54\)$/)
    expect(Object.keys(result.tokens).length).toBeGreaterThan(40)
    expect(isCustomSkinSettings(result)).toBe(true)
  })

  it('lowers legacy surface opacity so an already-saved image skin remains visible', () => {
    const legacy = createCustomSkinFromPixels([{ r: 38, g: 105, b: 180 }], IMAGE, '旧图片')
    const definition = customSkinDefinition({
      ...legacy,
      tokens: {
        ...legacy.tokens,
        '--dsw-alias-bg-base': {
          light: 'rgba(252, 251, 250, 0.78)',
          dark: 'rgba(24, 30, 40, 0.82)',
        },
        '--dsw-specific-sidebar-fill': {
          light: 'rgba(240, 245, 250, 0.72)',
          dark: 'rgba(20, 26, 32, 0.82)',
        },
      },
    })
    expect(definition.tokens['--dsw-alias-bg-base']?.light).toBe('rgba(252, 251, 250, 0.42)')
    expect(definition.tokens['--dsw-alias-bg-base']?.dark).toBe('rgba(24, 30, 40, 0.54)')
    expect(definition.tokens['--dsw-specific-sidebar-fill']?.light).toBe('rgba(240, 245, 250, 0.54)')
  })

  it('rejects an empty image sample instead of inventing a palette', () => {
    expect(() => createCustomSkinFromPixels([], IMAGE)).toThrow('没有可分析的像素')
  })
})
