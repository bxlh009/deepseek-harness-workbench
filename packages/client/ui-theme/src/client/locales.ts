/** `settings.theme` namespace dictionaries (the Appearance row's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'appearance.title': '外观',
  'appearance.light': '浅色',
  'appearance.dark': '深色',
  'appearance.system': '跟随系统',
  'skin.title': '皮肤',
  'skin.classic': '经典',
  'skin.ocean': '海洋',
  'skin.forest': '森林',
  'skin.sunset': '日落',
  'skin.custom': '图片皮肤',
  'skin.upload': '从图片生成',
  'skin.generating': '生成中…',
  'skin.remove': '移除图片皮肤',
} satisfies Record<string, string>

/** The settings.theme namespace key union. */
export type ThemeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
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
} satisfies Record<ThemeKey, string>
