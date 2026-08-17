/** `sidebar` namespace dictionaries: shell controls (brand row, New Session, fold toggle). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'brand.name': 'DeepSeek Harness 工作台',
  'brand.tagline': '本地优先编码代理',
  'session.new': '新会话',
  'session.new.label': '新建会话',
  'nav.label': '工作台导航',
  'nav.tasks': '编码任务',
  'nav.writing': '写作',
  'nav.pullRequests': '拉取请求',
  'nav.sites': '站点',
  'nav.scheduled': '已安排',
  'nav.plugins': '插件',
  'nav.planned': '规划中',
  'toggle.open': '打开侧边栏',
  'toggle.collapse': '收起侧边栏',
} satisfies Record<string, string>

/** The sidebar namespace key union. */
export type SidebarKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'brand.name': 'DeepSeek Harness Workbench',
  'brand.tagline': 'Local-first coding agent',
  'session.new': 'New Session',
  'session.new.label': 'New session',
  'nav.label': 'Workbench navigation',
  'nav.tasks': 'Coding tasks',
  'nav.writing': 'Writing',
  'nav.pullRequests': 'Pull requests',
  'nav.sites': 'Sites',
  'nav.scheduled': 'Scheduled',
  'nav.plugins': 'Plugins',
  'nav.planned': 'Planned',
  'toggle.open': 'Open sidebar',
  'toggle.collapse': 'Collapse sidebar',
} satisfies Record<SidebarKey, string>
