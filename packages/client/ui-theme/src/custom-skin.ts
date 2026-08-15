/** Local image-to-skin generation. No network, model call, or file path leaves the browser. */

import {
  MAX_CUSTOM_SKIN_DATA_URL_LENGTH,
  type CustomSkinSettings,
  type ThemeTokenModes,
  type ThemeTokenOverrides,
} from './theme-settings.ts'

/** One RGB sample used by the deterministic palette analyser. */
export interface PixelSample {
  r: number
  g: number
  b: number
  /** Optional weight, useful when callers pre-bucket pixels. */
  weight?: number
}

interface Rgb {
  r: number
  g: number
  b: number
}

interface Hsl {
  h: number
  s: number
  l: number
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const BLACK: Rgb = { r: 8, g: 12, b: 18 }

/**
 * Convert one user-selected image into a compact, persisted skin pack.
 * This is intentionally a palette operation: the original pixels are never
 * sent to a service and the image is resized before it enters settings.
 */
export async function generateCustomSkin(file: File): Promise<CustomSkinSettings> {
  if (!isSupportedImage(file)) {
    throw new Error('请选择 PNG、JPG 或 WebP 图片')
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('图片不能超过 20 MB')
  }
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('当前环境不支持本地图片解析')
  }

  const source = await readFileAsDataUrl(file)
  const image = await loadImage(source)
  const samples = sampleImage(image)
  const compactImage = compressImage(image)
  if (compactImage.length > MAX_CUSTOM_SKIN_DATA_URL_LENGTH) {
    throw new Error('图片压缩后仍然过大，请选择尺寸更小的图片')
  }
  return createCustomSkinFromPixels(samples, compactImage, skinName(file.name))
}

/**
 * Pure analyser exposed separately so the palette contract can be tested
 * without a browser canvas.
 */
export function createCustomSkinFromPixels(
  samples: readonly PixelSample[],
  image: string,
  name = '图片皮肤',
): CustomSkinSettings {
  if (samples.length === 0) throw new Error('图片没有可分析的像素')
  const average = weightedAverage(samples)
  const hsl = rgbToHsl(average)
  // Low-saturation photos still get a clear accent, while keeping the hue
  // derived from the image instead of falling back to a hard-coded blue.
  const saturation = clamp(Math.max(hsl.s, 0.38), 0.38, 0.82)
  const accent = hslToRgb(hsl.h, saturation, 0.44)
  const accentLight = hslToRgb(hsl.h, Math.max(saturation * 0.82, 0.44), 0.66)
  const accentText = contrastText(accent)
  const lightBase = mix(average, WHITE, 0.9)
  const lightLayer = mix(average, WHITE, 0.96)
  const lightLayer2 = mix(average, WHITE, 0.86)
  const darkBase = mix(average, BLACK, 0.82)
  const darkLayer = mix(average, BLACK, 0.72)
  const darkLayer2 = mix(average, BLACK, 0.58)
  const lightText = mix(accent, BLACK, 0.72)
  const darkText = mix(accentLight, WHITE, 0.72)
  const lightSecondary = mix(lightText, WHITE, 0.36)
  const darkSecondary = mix(darkText, BLACK, 0.36)
  const lightTertiary = mix(lightText, WHITE, 0.58)
  const darkTertiary = mix(darkText, BLACK, 0.56)
  const lightAccentSurface = mix(accent, WHITE, 0.86)
  const darkAccentSurface = mix(accent, BLACK, 0.58)
  const errorLight = { r: 220, g: 38, b: 38 }
  const errorDark = { r: 248, g: 113, b: 113 }
  const successLight = { r: 22, g: 163, b: 74 }
  const successDark = { r: 74, g: 222, b: 128 }
  const warnLight = { r: 180, g: 83, b: 9 }
  const warnDark = { r: 251, g: 146, b: 60 }

  const tokens: ThemeTokenOverrides = {
    '--dsw-alias-bg-base': mode(rgba(lightBase, 0.42), rgba(darkBase, 0.54)),
    '--dsw-alias-bg-layer-1': mode(rgba(lightLayer, 0.58), rgba(darkLayer, 0.68)),
    '--dsw-alias-bg-layer-2': mode(rgba(lightLayer2, 0.5), rgba(darkLayer2, 0.64)),
    '--dsw-alias-bg-layer-3': mode(rgb(lightAccentSurface), rgb(darkAccentSurface)),
    '--dsw-alias-bg-module-platform': mode(rgba(lightAccentSurface, 0.52), rgba(darkAccentSurface, 0.64)),
    '--dsw-alias-bg-multi-select': mode(rgba(lightAccentSurface, 0.6), rgba(darkAccentSurface, 0.8)),
    '--dsw-alias-bg-overlay': mode(rgba(WHITE, 0.9), rgba(darkLayer2, 0.94)),
    '--dsw-alias-bg-skeleton': mode(rgba(accent, 0.08), rgba(accentLight, 0.1)),
    '--dsw-alias-border-l1': mode(rgba(accent, 0.1), rgba(accentLight, 0.12)),
    '--dsw-alias-border-l2': mode(rgba(accent, 0.17), rgba(accentLight, 0.18)),
    '--dsw-alias-border-l3': mode(rgba(accent, 0.24), rgba(accentLight, 0.26)),
    '--dsw-alias-border-l4': mode(rgba(accent, 0.34), rgba(accentLight, 0.34)),
    '--dsw-alias-brand-primary': mode(rgb(accent), rgb(accentLight)),
    '--dsw-alias-brand-primary-new-colorprimary-new-color': mode(rgb(accent), rgb(accentLight)),
    '--dsw-alias-brand-primary-invert': mode(rgb(accentText), rgb(contrastText(accentLight))),
    '--dsw-alias-brand-text': mode(rgb(lightText), rgb(darkText)),
    '--dsw-alias-button-elevated-fill': mode(rgba(WHITE, 0.84), rgba(darkLayer, 0.92)),
    '--dsw-alias-button-floating-fill': mode(rgba(WHITE, 0.9), rgba(darkLayer2, 0.94)),
    '--dsw-alias-button-floating-hover': mode(rgb(lightAccentSurface), rgb(darkAccentSurface)),
    '--dsw-alias-button-ghost-active-border': mode(rgb(accent), rgb(accentLight)),
    '--dsw-alias-button-ghost-active-fill': mode(rgba(accent, 0.16), rgba(accentLight, 0.2)),
    '--dsw-alias-button-ghost-active-hover': mode(rgba(accent, 0.22), rgba(accentLight, 0.28)),
    '--dsw-alias-button-info-fill': mode(rgb(accent), rgb(accentLight)),
    '--dsw-alias-button-info-hover': mode(rgb(darken(accent, 0.12)), rgb(lighten(accentLight, 0.12))),
    '--dsw-alias-button-primary-dimmed': mode(rgb(lightAccentSurface), rgb(darkAccentSurface)),
    '--dsw-alias-button-primary-hover': mode(rgb(darken(accent, 0.12)), rgb(lighten(accentLight, 0.12))),
    '--dsw-alias-interactive-bg-active': mode(rgba(accent, 0.14), rgba(accentLight, 0.18)),
    '--dsw-alias-interactive-bg-hover': mode(rgba(accent, 0.07), rgba(accentLight, 0.1)),
    '--dsw-alias-interactive-bg-hover-accent': mode(rgba(accent, 0.14), rgba(accentLight, 0.2)),
    '--dsw-alias-interactive-bg-hover-solid': mode(rgb(lightAccentSurface), rgb(darkAccentSurface)),
    '--dsw-alias-label-caption': mode(rgb(lightTertiary), rgb(darkTertiary)),
    '--dsw-alias-label-dimmed': mode(rgb(lightTertiary), rgb(darkTertiary)),
    '--dsw-alias-label-primary': mode(rgb(lightText), rgb(darkText)),
    '--dsw-alias-label-primary-bluish': mode(rgb(lightText), rgb(darkText)),
    '--dsw-alias-label-primary-dimmed': mode(rgb(lightSecondary), rgb(darkSecondary)),
    '--dsw-alias-label-primary-foreground': mode(rgb(accentText), rgb(contrastText(accentLight))),
    '--dsw-alias-label-primary-inverted': mode(rgb(lightLayer), rgb(darkLayer)),
    '--dsw-alias-label-secondary': mode(rgb(lightSecondary), rgb(darkSecondary)),
    '--dsw-alias-label-tertiary': mode(rgb(lightTertiary), rgb(darkTertiary)),
    '--dsw-alias-markdown-citation': mode(rgba(accent, 0.18), rgba(accentLight, 0.22)),
    '--dsw-alias-markdown-code-block': mode(rgba(lightLayer2, 0.9), rgba(darkBase, 0.96)),
    '--dsw-alias-markdown-code-block-banner': mode(rgba(lightAccentSurface, 0.72), rgba(darkLayer, 0.94)),
    '--dsw-alias-markdown-inline-code': mode(rgba(lightAccentSurface, 0.7), rgba(darkAccentSurface, 0.82)),
    '--dsw-alias-scrollbar-bg-l1': mode(rgb(mix(accent, WHITE, 0.55)), rgb(mix(accentLight, BLACK, 0.34))),
    '--dsw-alias-scrollbar-bg-l2': mode(rgb(accentLight), rgb(accentLight)),
    '--dsw-alias-scrollbar-hover-l1': mode(rgb(accentLight), rgb(lighten(accentLight, 0.12))),
    '--dsw-alias-scrollbar-hover-l2': mode(rgb(accent), rgb(mix(accentLight, WHITE, 0.24))),
    '--dsw-alias-state-business-primary': mode(rgb(accent), rgb(accentLight)),
    '--dsw-alias-state-business-tertiary': mode(rgba(accent, 0.15), rgba(accentLight, 0.22)),
    '--dsw-alias-state-error-primary': mode(rgb(errorLight), rgb(errorDark)),
    '--dsw-alias-state-success-primary': mode(rgb(successLight), rgb(successDark)),
    '--dsw-alias-state-warn-primary': mode(rgb(warnLight), rgb(warnDark)),
    '--dsw-specific-bubble-highlight': mode(rgb(mix(accent, WHITE, 0.6)), rgb(darkAccentSurface)),
    '--dsw-specific-bubble': mode(rgba(lightAccentSurface, 0.76), rgba(darkAccentSurface, 0.86)),
    '--dsw-specific-input-major': mode(rgba(WHITE, 0.86), rgba(darkLayer, 0.92)),
    '--dsw-specific-login-input': mode(rgba(lightLayer, 0.88), rgba(darkBase, 0.9)),
    '--dsw-specific-menu': mode(rgba(WHITE, 0.92), rgba(darkLayer2, 0.96)),
    '--dsw-specific-selector': mode(rgba(lightAccentSurface, 0.8), rgba(darkAccentSurface, 0.9)),
    '--dsw-specific-sidebar-fill': mode(rgba(lightAccentSurface, 0.54), rgba(darkLayer, 0.64)),
    '--dsw-specific-sidebar-nav-item-active': mode(rgba(lightAccentSurface, 0.84), rgba(darkAccentSurface, 0.92)),
    '--dsw-specific-sidebar-nav-item-active-accent': mode(rgba(accent, 0.18), rgba(accentLight, 0.26)),
    '--dsw-specific-sidebar-nav-item-hover': mode(rgba(lightAccentSurface, 0.58), rgba(darkAccentSurface, 0.72)),
    '--dsw-specific-tip': mode(rgba(lightAccentSurface, 0.72), rgba(darkAccentSurface, 0.86)),
  }

  return {
    name: name.trim().slice(0, 80) || '图片皮肤',
    image,
    preview: `linear-gradient(135deg, ${rgb(accent)}, ${rgb(accentLight)})`,
    tokens,
  }
}

function mode(light: string, dark: string): ThemeTokenModes {
  return { light, dark }
}

function isSupportedImage(file: File): boolean {
  if (file.type !== '') return ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
  return /\.(?:png|jpe?g|webp)$/i.test(file.name)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => { reject(new Error('读取图片失败')) }
    reader.onload = () => {
      if (typeof reader.result !== 'string') reject(new Error('读取图片失败'))
      else resolve(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => { resolve(image) }
    image.onerror = () => { reject(new Error('图片无法解析')) }
    image.src = source
  })
}

function sampleImage(image: HTMLImageElement): PixelSample[] {
  const width = Math.max(1, Math.min(96, image.naturalWidth || image.width))
  const height = Math.max(1, Math.min(96, image.naturalHeight || image.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) throw new Error('当前环境无法读取图片像素')
  context.drawImage(image, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height).data
  const samples: PixelSample[] = []
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0
    if (alpha < 32) continue
    const alphaWeight = alpha / 255
    samples.push({
      r: pixels[index] ?? 0,
      g: pixels[index + 1] ?? 0,
      b: pixels[index + 2] ?? 0,
      weight: alphaWeight,
    })
  }
  return samples
}

function compressImage(image: HTMLImageElement): string {
  const originalWidth = image.naturalWidth || image.width
  const originalHeight = image.naturalHeight || image.height
  const scale = Math.min(1, 640 / Math.max(originalWidth, originalHeight, 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(originalWidth * scale))
  canvas.height = Math.max(1, Math.round(originalHeight * scale))
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('当前环境无法压缩图片')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  let result = canvas.toDataURL('image/webp', 0.78)
  if (!result.startsWith('data:image/webp')) result = canvas.toDataURL('image/jpeg', 0.76)
  if (result.length > MAX_CUSTOM_SKIN_DATA_URL_LENGTH) result = canvas.toDataURL('image/jpeg', 0.58)
  return result
}

function skinName(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '').trim()
  return withoutExtension.slice(0, 32) || '图片皮肤'
}

function weightedAverage(samples: readonly PixelSample[]): Rgb {
  let r = 0
  let g = 0
  let b = 0
  let total = 0
  for (const sample of samples) {
    const weight = sample.weight === undefined ? 1 : Math.max(0, sample.weight)
    r += clamp(sample.r, 0, 255) * weight
    g += clamp(sample.g, 0, 255) * weight
    b += clamp(sample.b, 0, 255) * weight
    total += weight
  }
  if (total === 0) throw new Error('图片没有可分析的像素')
  return { r: r / total, g: g / total, b: b / total }
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: lightness }
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue: number
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0)
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return { h: hue / 6, s: saturation, l: lightness }
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const h = ((hue % 1) + 1) % 1
  if (saturation === 0) {
    const gray = lightness * 255
    return { r: gray, g: gray, b: gray }
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  return {
    r: hueToChannel(p, q, h + 1 / 3) * 255,
    g: hueToChannel(p, q, h) * 255,
    b: hueToChannel(p, q, h - 1 / 3) * 255,
  }
}

function hueToChannel(p: number, q: number, value: number): number {
  let t = value
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function mix(left: Rgb, right: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1)
  return {
    r: left.r + (right.r - left.r) * t,
    g: left.g + (right.g - left.g) * t,
    b: left.b + (right.b - left.b) * t,
  }
}

function darken(color: Rgb, amount: number): Rgb {
  return mix(color, BLACK, amount)
}

function lighten(color: Rgb, amount: number): Rgb {
  return mix(color, WHITE, amount)
}

function contrastText(color: Rgb): Rgb {
  return relativeLuma(color) > 0.56 ? BLACK : WHITE
}

function relativeLuma({ r, g, b }: Rgb): number {
  const channel = (value: number): number => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function rgb(color: Rgb): string {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
