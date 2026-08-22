# Agent Note: Desktop asar-unpacked child processes

English | [中文](2026-08-22-desktop-asar-unpacked-child-processes.md)

Status: implemented

## Problem

打包后的 Windows 桌面运行时在 Electron utility process 内执行 DSH 宿主。两条子进程链路在该宿主下损坏:

- windows-acl runner 的启动参数是 `[process.execPath, runner.js, ...]`。在 Electron 内 `process.execPath` 是 Workbench 二进制,于是 "runner" 启动打开了第二个 GUI 实例;其单实例锁以 0 退出且无输出,runner 失败分类器把它当作成功的空结果。所有被沙箱包装的命令(`pwsh`,以及经由拒绝路径的 glob/grep)表现为静默空输出。
- 打包版 ripgrep 路径解析进 asar 虚拟树(`require.resolve('@vscode/ripgrep-win32-x64/bin/rg.exe')`),而经 subprocess seam 启动的搜索子进程无法读取 asar 路径。此外,只保留 `*.node/*.exe/*.dll` 的落盘策略把平台包剥成裸二进制:缺少 `package.json` 和加载器文件时,即使二进制存在也无法作为模块被 require。

## Decision

`sandbox-local` 把解析到 asar 归档内部的 built runner 入口映射到同级的 `<archive>.unpacked` 镜像加上捆绑的真实 Node 可执行文件(`<unpacked root>/node.exe`),两者都存在时使用该组合。`tool-fs-search` 对解析出的 ripgrep 路径应用同一映射,镜像不存在时保留原解析结果。桌面打包脚本把 runner 的完整依赖闭包(`koffi`、`@koromix`、`@vscode/ripgrep-win32-x64`、`@deepseek-ai/dsh-sandbox-windows-acl`)按完整包解包到磁盘,使元数据随二进制一起落盘,纯 Node 可以从磁盘解析它们。

## Alternatives considered

### 为什么不让宿主作为纯 Node sidecar 运行?

用 `runtime.asar.unpacked/node.exe` 加组装好的 profile 直接启动宿主会让每个子进程天然获得真实的 `process.execPath`。它落败是因为桌面端拥有假定运行时驻留 Electron 进程树的 HostSupervisor/utility-process 集成(IPC、生命周期、窗口接线);重新安置宿主是远超恢复沙箱契约范围的架构变更。

### 为什么不保留 `execPath` 并设置 `ELECTRON_RUN_AS_NODE`?

runner 随后可以执行,但它收到的仍是 asar 虚拟入口,只有 Electron 补丁过的 fs 能读取——纯 Node 子进程会得到 `MODULE_NOT_FOUND`。它还把子进程钉在 Electron 内嵌的 Node 版本上,而不是归档旁固定的运行时版本。

### 为什么不给 runner 可执行文件加 Config 字段?

`windowsAclRunnerArgs` 已作为测试钩子存在;把它提升为公开配置等于为唯一当前消费者(桌面构建自身)增加接口面。从已解析入口推导启动参数让 CLI 与桌面共享一条代码路径,且无需操作者配置。

## Consequences

unpacked 镜像会在归档旁多占几兆字节,打包脚本现在持有四个必须跟随 runner import 闭包的 `unpackDir` 条目。作为交换,每条被沙箱包装的命令和两个搜索工具都能在打包桌面内正确执行,失败继续沿既有分类路径响亮浮现,而 CLI、headless 与开发态行为逐字节保持不变——映射只对存在于既有 `.asar` 布局中的入口触发。

## Testing

两个消费者的单元规格覆盖映射代数(镜像存在、镜像缺失、非 asar 直通),以及针对 mocked 平台包的 memoized `resolveRgPath` 集成。并在真实安装上端到端验证:独立重建整条链路(捆绑 node.exe + 磁盘 runner + ACL 令牌 + PowerShell 5.1 回退),应用等效构建产物补丁后进行工具调用。

## Related

- [Windows ACL restricted-token sandbox](../../feature/2026-08-08-windows-acl-restricted-token-sandbox.md)
- [Packaged ripgrep search](2026-08-01-packaged-ripgrep-search.md)
