/** Shell chrome and General-nav dictionaries; feature rows own their copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger': '设置',
  'title': '设置',
  'close': '关闭',
  'openDocument': '打开配置文件',
  'openDocument.error': '无法打开配置文件',
  'general.nav': '通用设置',
  'update.title': '软件更新',
  'update.source': '从独立 GitHub Releases 获取桌面更新。',
  'update.development': '开发模式 · 当前 {version}',
  'update.current': '没有发现更新。',
  'update.available': '发现新版本。点击此项可清除本次提醒，或立即下载更新。',
  'update.currentVersion': '当前版本',
  'update.latestVersion': '最新版本',
  'update.lastChecked': '上次检查',
  'update.failed': '检查失败：{message}',
  'update.checking': '检查中…',
  'update.check': '检查更新',
  'update.download': '立即更新',
} satisfies Record<string, string>

/** The settings namespace key union. */
export type SettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger': 'Settings',
  'title': 'Settings',
  'close': 'Close',
  'openDocument': 'Open configuration file',
  'openDocument.error': 'Could not open configuration file',
  'general.nav': 'General',
  'update.title': 'Software update',
  'update.source': 'Get desktop updates from the independent GitHub Releases channel.',
  'update.development': 'Development mode · current {version}',
  'update.current': 'No update was found.',
  'update.available': 'A new version is available. Open this row to clear the reminder, or download it now.',
  'update.currentVersion': 'Current version',
  'update.latestVersion': 'Latest version',
  'update.lastChecked': 'Last checked',
  'update.failed': 'Update check failed: {message}',
  'update.checking': 'Checking…',
  'update.check': 'Check for updates',
  'update.download': 'Update now',
} satisfies Record<SettingsKey, string>
