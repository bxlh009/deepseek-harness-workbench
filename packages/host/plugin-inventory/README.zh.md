# @deepseek-ai/dsh-host-plugin-inventory

[English](README.md) | 中文

当前 Cordis Loader 树的可管理 Host 投影。`PluginInventoryGateway` 注册 `pluginInventory` 服务，并发布由 Typert 生成的 `pluginInventory/list` 与 `pluginInventory/setEnabled` 直接 Remote。列表直接读取 `ctx.loader.entries()`，跳过结构性 group 行，返回 Loader 标识、模块名、有效启用状态、是否允许切换以及根 Fiber 阶段。`setEnabled` 通过条目所属 Loader 树持久化直接 `disabled` 标志，等待 Cordis 挂载或卸载 Fiber 后返回新快照。运行时骨架被保护，管理通道不能关闭自身。

阶段为 `pending`、`loading`、`active`、`failed` 或 `unloading`；条目没有存活的根 Fiber 时则为 `null`。该快照刻意只表示调用当下：Loader 仍是唯一的生命周期权威，本包不拥有缓存、历史、来源模型或事件流。公开 payload 类型位于 `./types`，Typert 生成由 `./typert` 与 `./remote` 导出的 Host 和 Client Remote 产物。

该服务仅供 Remote 使用，刻意不声明同进程 Cordis `Context` merge。Client 包通过显式的 [`api-remotes`](../../api/remotes/README.md) 组合消费它，而不导入 Host 实现。

## 模型体验

无，因为这个仅限 Host 的清单投影不注册提示词、工具、消息或提供方请求。

#### KV Cache 影响

无；本包从不组装模型输入。

## 已知限制与暂缓事项

- **仅表示调用当下** —— 结果不包含持久的失败历史或订阅；只要不存在存活的根 Fiber，就会报告 `null`，而不区分其原因。
- **无来源与修改能力** —— 服务不识别条目由哪个 bundle、profile 或 override 引入，也不能启用、停用、添加或移除插件。
