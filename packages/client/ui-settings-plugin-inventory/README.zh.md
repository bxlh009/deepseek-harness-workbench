# @deepseek-ai/dsh-client-ui-settings-plugin-inventory

[English](README.md) | 中文

Web 设置中的可管理**已安装插件**标签页。浏览器插件注册一个 id 为 `all` 的本地化 `settings.plugins.tab` 贡献；“插件”分区拥有导航入口与标签栏。插件激活期间不会读取 Remote；选择标签页后才挂载带搜索、筛选、中文能力介绍和无障碍启停开关的目录。列表懒调用 `ctx.remote.pluginInventory.list()`；可切换条目的开关调用仅限本机的 `ctx.remote.pluginInventory.setEnabled()`，并用返回的权威快照更新界面。受保护的运行时骨架仍会显示，但开关不可操作。

该标签页以可搜索的双列紧凑折叠卡片展示清单。每张收起的卡片包含模块短名称、中文能力介绍、有效启停开关以及根 Fiber 状态圆点。展开后展示介绍、准确模块标识、Loader 树条目 id、有效配置状态与 Cordis 状态。条目 id 仍作为 React key、展开标识、详情值与额外搜索目标。加载、空结果、无匹配、通用读取失败和逐条修改失败都只属于已挂载组件，不暴露传输细节。注册使用 `ctx.slots.inject()`，因此能跟随标签 slot 的延迟声明、重新声明、本地化变化与 teardown，而无需 import 分区拥有方。

## 模型体验

无，因为本包只在浏览器设置中展示 Host 拥有的部署快照，不注册任何模型接口。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **每次 Settings 挂载或重试只读取一份快照** —— 标签页不订阅 Loader 变化，也不会在重连后自动重新读取；切换标签页会保留当前快照，重新打开 Settings 则会取得新快照。
- **尚无插件市场来源信息** —— Loader 视图可以管理可选运行条目，但尚未按可安装包、来源、发布者或权限集合分组。
