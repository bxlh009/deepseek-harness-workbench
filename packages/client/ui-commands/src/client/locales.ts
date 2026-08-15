/** `command` namespace dictionaries (the popupSelect shell's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'search.placeholder': '搜索…',
  'search.aria': '筛选选项',
  'status.loading': '正在加载选项…',
  'status.applying': '正在应用…',
  'status.empty': '无选项',
  'overlay.aria': '/{command} 选项',
  'listbox.aria': '/{command} 匹配项',
  'command.compact.description': '压缩较早的对话记录',
  'command.export.description': '将本次会话导出为 ZIP 文件',
  'command.feedback.description': '记录对本次会话的反馈',
  'command.goal.description': '设置或查看长期任务目标',
  'command.permission.description': '切换权限预设（沙箱模式 + 审批策略）',
  'command.plan.description': '进入或离开计划模式',
} satisfies Record<string, string>

/** The command namespace key union. */
export type CommandKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'search.placeholder': 'Search…',
  'search.aria': 'Filter options',
  'status.loading': 'Loading options…',
  'status.applying': 'Applying…',
  'status.empty': 'No options',
  'overlay.aria': '/{command} options',
  'listbox.aria': '/{command} matches',
  'command.compact.description': 'Compact older conversation history',
  'command.export.description': 'Download this Session log as a ZIP archive',
  'command.feedback.description': 'record feedback about this session',
  'command.goal.description': 'set or view the goal for a long-running task',
  'command.permission.description': 'Switch the permission preset (sandbox mode + approval policy)',
  'command.plan.description': 'Enter or leave plan mode',
} satisfies Record<CommandKey, string>
