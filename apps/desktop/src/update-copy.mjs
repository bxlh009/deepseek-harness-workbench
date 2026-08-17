const ENGLISH = Object.freeze({
  availableTitle: 'Update available',
  availableMessage: version => `DeepSeek Harness Workbench ${version} is available`,
  availableDetail: 'You decide whether to download it. Updating replaces program files but keeps models, API keys, sessions, and skin settings.',
  downloadButton: 'Download and install',
  laterButton: 'Later',
  downloadFailedTitle: 'Update download failed',
  acknowledgeButton: 'OK',
  downloadedTitle: 'Update downloaded',
  downloadedMessage: version => `DeepSeek Harness Workbench ${version} is ready`,
  downloadedDetail: 'Restart now to install the update.',
  restartButton: 'Restart and install',
})

const CHINESE = Object.freeze({
  availableTitle: '发现新版本',
  availableMessage: version => `DeepSeek Harness Workbench ${version} 可以更新`,
  availableDetail: '由你决定是否下载。更新会覆盖程序文件，但不会删除模型、API 密钥、会话和皮肤配置。',
  downloadButton: '下载并安装',
  laterButton: '稍后',
  downloadFailedTitle: '更新下载失败',
  acknowledgeButton: '知道了',
  downloadedTitle: '更新已下载',
  downloadedMessage: version => `DeepSeek Harness Workbench ${version} 已准备好`,
  downloadedDetail: '现在重启即可安装更新。',
  restartButton: '重启并安装',
})

/**
 * Resolve native updater copy from Electron's application locale.
 * Chinese variants use Chinese; every other locale receives English.
 */
export function updateCopy(locale) {
  return String(locale).toLowerCase().split('-')[0] === 'zh' ? CHINESE : ENGLISH
}
