# Agent Note: Windows Electron 桌面壳

Status: implemented

English | [English](2026-08-14-electron-desktop-shell.md)

## Problem

DeepSeek Harness 已经提供本机 Node Host 和浏览器 UI，但 Windows 用户仍需自己启动 CLI 并打开环回地址，进程归属、窗口生命周期和渲染器权限没有进入产品表面。

## Decision

仓库新增 `apps/desktop` Electron 桌面壳和 Windows 分发路径。桌面壳拥有一个 `HostSupervisor`：直接通过 Node 启动现有构建后的 CLI 入口，分配私有环回端口，等待 HTTP 就绪，在开启上下文隔离和沙箱的窗口中加载现有 Web UI，并在退出时等待 Host 进程结束。桌面壳是现有 Host/Web seam 上的 adapter，不复制 agent runtime，也不新增第二套 UI 实现。

分发脚本会把 DSH 和 vendor workspace 家族打成 tarball，再安装到干净运行时中，让 workspace link 和 peer dependency 按真实发布闭包解析，同时保留 Windows 平台所需的 optional 原生依赖，随后把 Windows `node.exe` 复制到运行时旁边。Electron Builder 会把该运行时作为 extra resource 嵌入，并生成便携版和 NSIS 两种目标。

默认拒绝外部导航和渲染器 Node 权限。只有调用方没有明确选择遥测模式时，桌面壳才设置关闭遥测；API 凭据仍由现有 Harness settings 和 credentials 提供方管理。

桌面进程会把一个位于 Electron 用户数据目录下、可写且独立的 `DSH_HOME` 传给子 Host。`DSH_DESKTOP_HOME` 可作为显式覆盖，供需要使用其他 home 的运维场景使用；桌面包不会自动复制或暴露 CLI 已有的凭据。

## Alternatives considered

**浏览器快捷方式或第二个本地 Web Server。** 否决，因为两者都不拥有子进程，也无法给渲染器提供桌面权限姿态。桌面壳必须拥有生命周期，同时复用现有 Host。

**第一版直接使用 Tauri。** 延后，因为现有 Host 是 Node/TypeScript，并且已经拥有 Windows shell、文件系统和子进程能力。在 Electron seam 尚未验证前增加 Rust Host 集成，只会引入第二套宿主接入。

**把 Harness UI 重写成原生控件。** 否决，因为这会复制已经交付的 Web UI；对于这个 MVP，没有足够用户价值抵消由此产生的客户端协议分叉。

## Consequences

开发模式依赖仓库 checkout、已构建的 Host/Web 产物，或通过 `tsx` 使用源码入口运行。打包版本使用内置运行时，不要求系统另外安装 Node.js 或 pnpm。当前桌面包没有代码签名，也没有自动更新渠道。Host 仍然只绑定环回地址，Electron 必须在退出前等待子进程完全停稳。

## Testing

`apps/desktop/test/host-supervisor.test.mjs` 通过真实的 supervisor 接口覆盖入口选择、启动参数、环回就绪、子进程优雅关闭和独立 `DSH_HOME` 传递。根目录的 `desktop:test` 脚本运行这组聚焦测试。本地发布验证还会运行仓库构建，用 `node_modules/@deepseek-ai/dsh/lib/bin.js --version` 检查打包运行时，使用独立 home 启动打包后的 Windows runtime，并检查 Electron Builder 产物。代码签名、干净机器安装和图形界面验收仍属于外部发布检查。
