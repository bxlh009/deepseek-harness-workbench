/** Declarative visual skin packs shared by Host bootstrap and the browser. */

import {
  type CustomSkinSettings,
  type ThemeSkin,
  type ThemeTokenModes,
  type ThemeTokenOverrides,
} from './theme-settings.ts'

/** A skin's metadata and semantic token layer. */
export interface ThemeSkinDefinition {
  /** Stable id persisted by the built-in settings schema. */
  id: ThemeSkin
  /** Settings locale key shown by the Appearance row. */
  labelKey: 'skin.classic' | 'skin.ocean' | 'skin.forest' | 'skin.sunset' | 'skin.custom'
  /** Static token used only to paint the selector preview. */
  previewToken: string
  /** Dynamic CSS preview used by an image-generated skin. */
  previewValue?: string
  /** Original filename-derived label for the image-generated skin. */
  name?: string
  /** Local image applied behind the translucent application surfaces. */
  backgroundImage?: string
  /** Per-scheme semantic token values applied by the runtime. */
  tokens: ThemeTokenOverrides
}

const mode = (light: string, dark: string): ThemeTokenModes => ({ light, dark })

/**
 * Surface alpha budget for image skins. Older persisted packs used nearly
 * opaque canvas fills, which made the image technically present but visually
 * absent. Keep the normalization in the shared definition so both the Host
 * bootstrap and the live Client fix existing saved packs without re-uploading.
 */
const CUSTOM_IMAGE_SURFACE_ALPHA: Readonly<Record<string, { light: number; dark: number }>> = Object.freeze({
  '--dsw-alias-bg-base': { light: 0.42, dark: 0.54 },
  '--dsw-alias-bg-layer-1': { light: 0.58, dark: 0.68 },
  '--dsw-alias-bg-layer-2': { light: 0.5, dark: 0.64 },
  '--dsw-alias-bg-module-platform': { light: 0.52, dark: 0.64 },
  '--dsw-specific-sidebar-fill': { light: 0.54, dark: 0.64 },
})

const skin = (
  id: ThemeSkin,
  labelKey: ThemeSkinDefinition['labelKey'],
  previewToken: string,
  tokens: ThemeTokenOverrides,
): ThemeSkinDefinition => Object.freeze({
  id,
  labelKey,
  previewToken,
  tokens: Object.freeze(tokens),
})

/**
 * Built-in skins are data, not CSS selectors. The same pack is consumed by
 * the Host bootstrap for first paint and by ThemeRuntime after activation.
 */
export const BUILTIN_SKINS: readonly ThemeSkinDefinition[] = Object.freeze([
  skin('classic', 'skin.classic', '--dsw-static-deepseek-500', {}),
  skin('ocean', 'skin.ocean', '--dsw-static-blue-500', {
    '--dsw-alias-bg-base': mode('rgb(244, 248, 255)', 'rgb(12, 22, 40)'),
    '--dsw-alias-bg-layer-1': mode('rgb(255, 255, 255)', 'rgb(17, 31, 53)'),
    '--dsw-alias-bg-layer-2': mode('rgb(237, 244, 255)', 'rgb(23, 41, 67)'),
    '--dsw-alias-bg-layer-3': mode('rgb(225, 236, 255)', 'rgb(32, 54, 85)'),
    '--dsw-alias-bg-module-platform': mode('rgb(240, 246, 255)', 'rgb(25, 45, 72)'),
    '--dsw-alias-bg-multi-select': mode('rgb(231, 240, 255)', 'rgb(28, 49, 78)'),
    '--dsw-alias-bg-overlay': mode('rgb(255, 255, 255)', 'rgb(29, 49, 77)'),
    '--dsw-alias-bg-skeleton': mode('rgba(37, 99, 235, 0.06)', 'rgba(147, 197, 253, 0.08)'),
    '--dsw-alias-border-l1': mode('rgba(30, 64, 175, 0.08)', 'rgba(147, 197, 253, 0.08)'),
    '--dsw-alias-border-l2': mode('rgba(30, 64, 175, 0.14)', 'rgba(147, 197, 253, 0.14)'),
    '--dsw-alias-border-l3': mode('rgba(30, 64, 175, 0.2)', 'rgba(147, 197, 253, 0.22)'),
    '--dsw-alias-border-l4': mode('rgba(30, 64, 175, 0.28)', 'rgba(147, 197, 253, 0.3)'),
    '--dsw-alias-brand-primary': mode('rgb(37, 99, 235)', 'rgb(96, 165, 250)'),
    '--dsw-alias-brand-primary-new-colorprimary-new-color': mode('rgb(37, 99, 235)', 'rgb(96, 165, 250)'),
    '--dsw-alias-brand-primary-invert': mode('rgb(255, 255, 255)', 'rgb(8, 17, 31)'),
    '--dsw-alias-brand-text': mode('rgb(29, 78, 216)', 'rgb(147, 197, 253)'),
    '--dsw-alias-button-elevated-fill': mode('rgb(255, 255, 255)', 'rgb(29, 49, 77)'),
    '--dsw-alias-button-floating-fill': mode('rgb(255, 255, 255)', 'rgb(29, 49, 77)'),
    '--dsw-alias-button-floating-hover': mode('rgb(239, 246, 255)', 'rgb(32, 54, 85)'),
    '--dsw-alias-button-ghost-active-border': mode('rgb(147, 197, 253)', 'rgb(96, 165, 250)'),
    '--dsw-alias-button-ghost-active-fill': mode('rgb(219, 234, 254)', 'rgb(30, 64, 175)'),
    '--dsw-alias-button-ghost-active-hover': mode('rgb(239, 246, 255)', 'rgb(37, 99, 235)'),
    '--dsw-alias-button-info-fill': mode('rgb(37, 99, 235)', 'rgb(37, 99, 235)'),
    '--dsw-alias-button-info-hover': mode('rgb(29, 78, 216)', 'rgb(96, 165, 250)'),
    '--dsw-alias-button-primary-dimmed': mode('rgb(219, 234, 254)', 'rgb(30, 64, 175)'),
    '--dsw-alias-button-primary-hover': mode('rgb(29, 78, 216)', 'rgb(147, 197, 253)'),
    '--dsw-alias-interactive-bg-active': mode('rgba(37, 99, 235, 0.12)', 'rgba(147, 197, 253, 0.16)'),
    '--dsw-alias-interactive-bg-hover': mode('rgba(37, 99, 235, 0.06)', 'rgba(147, 197, 253, 0.08)'),
    '--dsw-alias-interactive-bg-hover-accent': mode('rgba(37, 99, 235, 0.12)', 'rgba(147, 197, 253, 0.18)'),
    '--dsw-alias-interactive-bg-hover-solid': mode('rgb(231, 240, 255)', 'rgb(32, 54, 85)'),
    '--dsw-alias-label-caption': mode('rgb(113, 134, 160)', 'rgb(112, 137, 170)'),
    '--dsw-alias-label-dimmed': mode('rgb(129, 148, 172)', 'rgb(91, 116, 148)'),
    '--dsw-alias-label-primary': mode('rgb(22, 50, 92)', 'rgb(234, 242, 255)'),
    '--dsw-alias-label-primary-bluish': mode('rgb(29, 78, 216)', 'rgb(191, 219, 254)'),
    '--dsw-alias-label-primary-dimmed': mode('rgb(74, 99, 130)', 'rgb(184, 201, 224)'),
    '--dsw-alias-label-primary-foreground': mode('rgb(255, 255, 255)', 'rgb(8, 17, 31)'),
    '--dsw-alias-label-primary-inverted': mode('rgb(255, 255, 255)', 'rgb(17, 31, 53)'),
    '--dsw-alias-label-secondary': mode('rgb(74, 99, 130)', 'rgb(184, 201, 224)'),
    '--dsw-alias-label-tertiary': mode('rgb(113, 134, 160)', 'rgb(142, 166, 196)'),
    '--dsw-alias-markdown-citation': mode('rgb(219, 234, 254)', 'rgb(30, 64, 175)'),
    '--dsw-alias-markdown-code-block': mode('rgb(239, 246, 255)', 'rgb(8, 20, 36)'),
    '--dsw-alias-markdown-code-block-banner': mode('rgb(231, 240, 255)', 'rgb(17, 31, 53)'),
    '--dsw-alias-markdown-inline-code': mode('rgb(225, 236, 255)', 'rgb(23, 41, 67)'),
    '--dsw-alias-scrollbar-bg-l1': mode('rgb(191, 219, 254)', 'rgb(71, 111, 158)'),
    '--dsw-alias-scrollbar-bg-l2': mode('rgb(147, 197, 253)', 'rgb(96, 165, 250)'),
    '--dsw-alias-scrollbar-hover-l1': mode('rgb(96, 165, 250)', 'rgb(147, 197, 253)'),
    '--dsw-alias-scrollbar-hover-l2': mode('rgb(37, 99, 235)', 'rgb(191, 219, 254)'),
    '--dsw-alias-state-business-primary': mode('rgb(37, 99, 235)', 'rgb(96, 165, 250)'),
    '--dsw-alias-state-business-tertiary': mode('rgb(219, 234, 254)', 'rgb(30, 64, 175)'),
    '--dsw-specific-bubble-highlight': mode('rgb(191, 219, 254)', 'rgb(30, 64, 175)'),
    '--dsw-specific-bubble': mode('rgb(239, 246, 255)', 'rgb(23, 37, 84)'),
    '--dsw-specific-input-major': mode('rgb(255, 255, 255)', 'rgb(17, 31, 53)'),
    '--dsw-specific-login-input': mode('rgb(248, 251, 255)', 'rgb(12, 22, 40)'),
    '--dsw-specific-menu': mode('rgb(255, 255, 255)', 'rgb(29, 49, 77)'),
    '--dsw-specific-selector': mode('rgb(231, 240, 255)', 'rgb(32, 54, 85)'),
    '--dsw-specific-sidebar-fill': mode('rgb(237, 244, 255)', 'rgb(15, 29, 51)'),
    '--dsw-specific-sidebar-nav-item-active': mode('rgb(225, 236, 255)', 'rgb(23, 46, 77)'),
    '--dsw-specific-sidebar-nav-item-active-accent': mode('rgb(219, 234, 254)', 'rgb(30, 64, 175)'),
    '--dsw-specific-sidebar-nav-item-hover': mode('rgb(247, 251, 255)', 'rgb(20, 39, 68)'),
    '--dsw-specific-tip': mode('rgb(231, 240, 255)', 'rgb(32, 54, 85)'),
  }),
  skin('forest', 'skin.forest', '--dsw-static-green-500', {
    '--dsw-alias-bg-base': mode('rgb(243, 251, 245)', 'rgb(11, 27, 18)'),
    '--dsw-alias-bg-layer-1': mode('rgb(255, 255, 255)', 'rgb(17, 39, 26)'),
    '--dsw-alias-bg-layer-2': mode('rgb(236, 248, 239)', 'rgb(23, 55, 34)'),
    '--dsw-alias-bg-layer-3': mode('rgb(220, 245, 227)', 'rgb(33, 75, 45)'),
    '--dsw-alias-bg-module-platform': mode('rgb(239, 250, 242)', 'rgb(25, 62, 37)'),
    '--dsw-alias-bg-multi-select': mode('rgb(229, 247, 233)', 'rgb(29, 68, 40)'),
    '--dsw-alias-bg-overlay': mode('rgb(255, 255, 255)', 'rgb(27, 58, 37)'),
    '--dsw-alias-bg-skeleton': mode('rgba(21, 128, 61, 0.06)', 'rgba(134, 239, 172, 0.08)'),
    '--dsw-alias-border-l1': mode('rgba(21, 128, 61, 0.08)', 'rgba(134, 239, 172, 0.08)'),
    '--dsw-alias-border-l2': mode('rgba(21, 128, 61, 0.14)', 'rgba(134, 239, 172, 0.14)'),
    '--dsw-alias-border-l3': mode('rgba(21, 128, 61, 0.2)', 'rgba(134, 239, 172, 0.22)'),
    '--dsw-alias-border-l4': mode('rgba(21, 128, 61, 0.28)', 'rgba(134, 239, 172, 0.3)'),
    '--dsw-alias-brand-primary': mode('rgb(21, 128, 61)', 'rgb(74, 222, 128)'),
    '--dsw-alias-brand-primary-new-colorprimary-new-color': mode('rgb(21, 128, 61)', 'rgb(74, 222, 128)'),
    '--dsw-alias-brand-primary-invert': mode('rgb(255, 255, 255)', 'rgb(8, 22, 13)'),
    '--dsw-alias-brand-text': mode('rgb(22, 101, 52)', 'rgb(134, 239, 172)'),
    '--dsw-alias-button-elevated-fill': mode('rgb(255, 255, 255)', 'rgb(27, 58, 37)'),
    '--dsw-alias-button-floating-fill': mode('rgb(255, 255, 255)', 'rgb(27, 58, 37)'),
    '--dsw-alias-button-floating-hover': mode('rgb(240, 253, 244)', 'rgb(33, 75, 45)'),
    '--dsw-alias-button-ghost-active-border': mode('rgb(134, 239, 172)', 'rgb(74, 222, 128)'),
    '--dsw-alias-button-ghost-active-fill': mode('rgb(220, 252, 231)', 'rgb(20, 83, 45)'),
    '--dsw-alias-button-ghost-active-hover': mode('rgb(240, 253, 244)', 'rgb(21, 128, 61)'),
    '--dsw-alias-button-info-fill': mode('rgb(21, 128, 61)', 'rgb(21, 128, 61)'),
    '--dsw-alias-button-info-hover': mode('rgb(22, 101, 52)', 'rgb(34, 197, 94)'),
    '--dsw-alias-button-primary-dimmed': mode('rgb(220, 252, 231)', 'rgb(20, 83, 45)'),
    '--dsw-alias-button-primary-hover': mode('rgb(22, 101, 52)', 'rgb(134, 239, 172)'),
    '--dsw-alias-interactive-bg-active': mode('rgba(21, 128, 61, 0.12)', 'rgba(134, 239, 172, 0.16)'),
    '--dsw-alias-interactive-bg-hover': mode('rgba(21, 128, 61, 0.06)', 'rgba(134, 239, 172, 0.08)'),
    '--dsw-alias-interactive-bg-hover-accent': mode('rgba(21, 128, 61, 0.12)', 'rgba(134, 239, 172, 0.18)'),
    '--dsw-alias-interactive-bg-hover-solid': mode('rgb(229, 247, 233)', 'rgb(33, 75, 45)'),
    '--dsw-alias-label-caption': mode('rgb(104, 137, 113)', 'rgb(112, 153, 126)'),
    '--dsw-alias-label-dimmed': mode('rgb(126, 157, 134)', 'rgb(87, 124, 99)'),
    '--dsw-alias-label-primary': mode('rgb(21, 64, 35)', 'rgb(235, 250, 239)'),
    '--dsw-alias-label-primary-bluish': mode('rgb(22, 101, 52)', 'rgb(187, 247, 208)'),
    '--dsw-alias-label-primary-dimmed': mode('rgb(60, 105, 72)', 'rgb(188, 222, 197)'),
    '--dsw-alias-label-primary-foreground': mode('rgb(255, 255, 255)', 'rgb(8, 22, 13)'),
    '--dsw-alias-label-primary-inverted': mode('rgb(255, 255, 255)', 'rgb(17, 39, 26)'),
    '--dsw-alias-label-secondary': mode('rgb(60, 105, 72)', 'rgb(188, 222, 197)'),
    '--dsw-alias-label-tertiary': mode('rgb(104, 137, 113)', 'rgb(143, 183, 154)'),
    '--dsw-alias-markdown-citation': mode('rgb(220, 252, 231)', 'rgb(20, 83, 45)'),
    '--dsw-alias-markdown-code-block': mode('rgb(240, 253, 244)', 'rgb(8, 22, 13)'),
    '--dsw-alias-markdown-code-block-banner': mode('rgb(229, 247, 233)', 'rgb(17, 39, 26)'),
    '--dsw-alias-markdown-inline-code': mode('rgb(220, 245, 227)', 'rgb(23, 55, 34)'),
    '--dsw-alias-scrollbar-bg-l1': mode('rgb(187, 247, 208)', 'rgb(70, 130, 87)'),
    '--dsw-alias-scrollbar-bg-l2': mode('rgb(134, 239, 172)', 'rgb(74, 222, 128)'),
    '--dsw-alias-scrollbar-hover-l1': mode('rgb(74, 222, 128)', 'rgb(134, 239, 172)'),
    '--dsw-alias-scrollbar-hover-l2': mode('rgb(21, 128, 61)', 'rgb(187, 247, 208)'),
    '--dsw-alias-state-business-primary': mode('rgb(21, 128, 61)', 'rgb(74, 222, 128)'),
    '--dsw-alias-state-business-tertiary': mode('rgb(220, 252, 231)', 'rgb(20, 83, 45)'),
    '--dsw-specific-bubble-highlight': mode('rgb(187, 247, 208)', 'rgb(22, 101, 52)'),
    '--dsw-specific-bubble': mode('rgb(240, 253, 244)', 'rgb(20, 83, 45)'),
    '--dsw-specific-input-major': mode('rgb(255, 255, 255)', 'rgb(17, 39, 26)'),
    '--dsw-specific-login-input': mode('rgb(248, 255, 250)', 'rgb(11, 27, 18)'),
    '--dsw-specific-menu': mode('rgb(255, 255, 255)', 'rgb(27, 58, 37)'),
    '--dsw-specific-selector': mode('rgb(229, 247, 233)', 'rgb(33, 75, 45)'),
    '--dsw-specific-sidebar-fill': mode('rgb(236, 248, 239)', 'rgb(14, 34, 21)'),
    '--dsw-specific-sidebar-nav-item-active': mode('rgb(220, 245, 227)', 'rgb(24, 65, 39)'),
    '--dsw-specific-sidebar-nav-item-active-accent': mode('rgb(220, 252, 231)', 'rgb(22, 101, 52)'),
    '--dsw-specific-sidebar-nav-item-hover': mode('rgb(247, 253, 248)', 'rgb(20, 48, 29)'),
    '--dsw-specific-tip': mode('rgb(229, 247, 233)', 'rgb(33, 75, 45)'),
  }),
  skin('sunset', 'skin.sunset', '--dsw-static-amber-500', {
    '--dsw-alias-bg-base': mode('rgb(255, 248, 241)', 'rgb(31, 18, 12)'),
    '--dsw-alias-bg-layer-1': mode('rgb(255, 253, 249)', 'rgb(42, 23, 14)'),
    '--dsw-alias-bg-layer-2': mode('rgb(255, 241, 228)', 'rgb(58, 33, 20)'),
    '--dsw-alias-bg-layer-3': mode('rgb(255, 227, 202)', 'rgb(74, 41, 24)'),
    '--dsw-alias-bg-module-platform': mode('rgb(255, 247, 237)', 'rgb(61, 36, 22)'),
    '--dsw-alias-bg-multi-select': mode('rgb(255, 237, 213)', 'rgb(70, 39, 22)'),
    '--dsw-alias-bg-overlay': mode('rgb(255, 250, 245)', 'rgb(59, 36, 24)'),
    '--dsw-alias-bg-skeleton': mode('rgba(194, 65, 12, 0.06)', 'rgba(253, 186, 116, 0.08)'),
    '--dsw-alias-border-l1': mode('rgba(154, 52, 18, 0.08)', 'rgba(253, 186, 116, 0.08)'),
    '--dsw-alias-border-l2': mode('rgba(154, 52, 18, 0.14)', 'rgba(253, 186, 116, 0.14)'),
    '--dsw-alias-border-l3': mode('rgba(154, 52, 18, 0.2)', 'rgba(253, 186, 116, 0.22)'),
    '--dsw-alias-border-l4': mode('rgba(154, 52, 18, 0.28)', 'rgba(253, 186, 116, 0.3)'),
    '--dsw-alias-brand-primary': mode('rgb(194, 65, 12)', 'rgb(251, 146, 60)'),
    '--dsw-alias-brand-primary-new-colorprimary-new-color': mode('rgb(194, 65, 12)', 'rgb(251, 146, 60)'),
    '--dsw-alias-brand-primary-invert': mode('rgb(255, 255, 255)', 'rgb(31, 18, 12)'),
    '--dsw-alias-brand-text': mode('rgb(154, 52, 18)', 'rgb(253, 186, 116)'),
    '--dsw-alias-button-elevated-fill': mode('rgb(255, 253, 249)', 'rgb(59, 36, 24)'),
    '--dsw-alias-button-floating-fill': mode('rgb(255, 253, 249)', 'rgb(59, 36, 24)'),
    '--dsw-alias-button-floating-hover': mode('rgb(255, 247, 237)', 'rgb(74, 41, 24)'),
    '--dsw-alias-button-ghost-active-border': mode('rgb(253, 186, 116)', 'rgb(251, 146, 60)'),
    '--dsw-alias-button-ghost-active-fill': mode('rgb(255, 237, 213)', 'rgb(124, 45, 18)'),
    '--dsw-alias-button-ghost-active-hover': mode('rgb(255, 247, 237)', 'rgb(194, 65, 12)'),
    '--dsw-alias-button-info-fill': mode('rgb(194, 65, 12)', 'rgb(194, 65, 12)'),
    '--dsw-alias-button-info-hover': mode('rgb(154, 52, 18)', 'rgb(234, 88, 12)'),
    '--dsw-alias-button-primary-dimmed': mode('rgb(255, 237, 213)', 'rgb(124, 45, 18)'),
    '--dsw-alias-button-primary-hover': mode('rgb(154, 52, 18)', 'rgb(253, 186, 116)'),
    '--dsw-alias-interactive-bg-active': mode('rgba(194, 65, 12, 0.12)', 'rgba(253, 186, 116, 0.16)'),
    '--dsw-alias-interactive-bg-hover': mode('rgba(194, 65, 12, 0.06)', 'rgba(253, 186, 116, 0.08)'),
    '--dsw-alias-interactive-bg-hover-accent': mode('rgba(194, 65, 12, 0.12)', 'rgba(253, 186, 116, 0.18)'),
    '--dsw-alias-interactive-bg-hover-solid': mode('rgb(255, 237, 213)', 'rgb(74, 41, 24)'),
    '--dsw-alias-label-caption': mode('rgb(151, 105, 78)', 'rgb(173, 122, 87)'),
    '--dsw-alias-label-dimmed': mode('rgb(180, 132, 101)', 'rgb(132, 87, 59)'),
    '--dsw-alias-label-primary': mode('rgb(74, 37, 23)', 'rgb(255, 241, 230)'),
    '--dsw-alias-label-primary-bluish': mode('rgb(154, 52, 18)', 'rgb(254, 215, 170)'),
    '--dsw-alias-label-primary-dimmed': mode('rgb(123, 74, 52)', 'rgb(231, 190, 159)'),
    '--dsw-alias-label-primary-foreground': mode('rgb(255, 255, 255)', 'rgb(31, 18, 12)'),
    '--dsw-alias-label-primary-inverted': mode('rgb(255, 255, 255)', 'rgb(42, 23, 14)'),
    '--dsw-alias-label-secondary': mode('rgb(123, 74, 52)', 'rgb(231, 190, 159)'),
    '--dsw-alias-label-tertiary': mode('rgb(151, 105, 78)', 'rgb(196, 145, 110)'),
    '--dsw-alias-markdown-citation': mode('rgb(255, 237, 213)', 'rgb(124, 45, 18)'),
    '--dsw-alias-markdown-code-block': mode('rgb(255, 244, 232)', 'rgb(27, 15, 10)'),
    '--dsw-alias-markdown-code-block-banner': mode('rgb(255, 237, 213)', 'rgb(42, 23, 14)'),
    '--dsw-alias-markdown-inline-code': mode('rgb(255, 227, 202)', 'rgb(58, 33, 20)'),
    '--dsw-alias-scrollbar-bg-l1': mode('rgb(254, 215, 170)', 'rgb(170, 102, 58)'),
    '--dsw-alias-scrollbar-bg-l2': mode('rgb(253, 186, 116)', 'rgb(251, 146, 60)'),
    '--dsw-alias-scrollbar-hover-l1': mode('rgb(251, 146, 60)', 'rgb(253, 186, 116)'),
    '--dsw-alias-scrollbar-hover-l2': mode('rgb(194, 65, 12)', 'rgb(254, 215, 170)'),
    '--dsw-alias-state-business-primary': mode('rgb(194, 65, 12)', 'rgb(251, 146, 60)'),
    '--dsw-alias-state-business-tertiary': mode('rgb(255, 237, 213)', 'rgb(124, 45, 18)'),
    '--dsw-specific-bubble-highlight': mode('rgb(254, 215, 170)', 'rgb(154, 52, 18)'),
    '--dsw-specific-bubble': mode('rgb(255, 247, 237)', 'rgb(124, 45, 18)'),
    '--dsw-specific-input-major': mode('rgb(255, 253, 249)', 'rgb(42, 23, 14)'),
    '--dsw-specific-login-input': mode('rgb(255, 250, 245)', 'rgb(31, 18, 12)'),
    '--dsw-specific-menu': mode('rgb(255, 253, 249)', 'rgb(59, 36, 24)'),
    '--dsw-specific-selector': mode('rgb(255, 237, 213)', 'rgb(74, 41, 24)'),
    '--dsw-specific-sidebar-fill': mode('rgb(255, 241, 228)', 'rgb(36, 21, 14)'),
    '--dsw-specific-sidebar-nav-item-active': mode('rgb(255, 227, 202)', 'rgb(73, 40, 24)'),
    '--dsw-specific-sidebar-nav-item-active-accent': mode('rgb(255, 237, 213)', 'rgb(154, 52, 18)'),
    '--dsw-specific-sidebar-nav-item-hover': mode('rgb(255, 249, 243)', 'rgb(54, 31, 19)'),
    '--dsw-specific-tip': mode('rgb(255, 237, 213)', 'rgb(74, 41, 24)'),
  }),
])

/** Convert one durable custom payload into the same definition shape as built-ins. */
export function customSkinDefinition(custom: CustomSkinSettings): ThemeSkinDefinition {
  return Object.freeze({
    id: 'custom',
    labelKey: 'skin.custom',
    previewToken: '--dsw-alias-brand-primary',
    previewValue: custom.preview,
    name: custom.name,
    backgroundImage: custom.image,
    tokens: normalizeCustomImageTokens(custom.tokens),
  })
}

function normalizeCustomImageTokens(tokens: ThemeTokenOverrides): ThemeTokenOverrides {
  const normalized: ThemeTokenOverrides = {}
  for (const [name, modes] of Object.entries(tokens)) normalized[name] = { ...modes }
  for (const [name, alpha] of Object.entries(CUSTOM_IMAGE_SURFACE_ALPHA)) {
    const modes = normalized[name]
    if (modes === undefined) continue
    normalized[name] = {
      light: withAlpha(modes.light, alpha.light),
      dark: withAlpha(modes.dark, alpha.dark),
    }
  }
  return Object.freeze(normalized)
}

function withAlpha(value: string, alpha: number): string {
  const match = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[0-9.]+\s*\)$/i.exec(value)
  if (match === null) return value
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`
}
