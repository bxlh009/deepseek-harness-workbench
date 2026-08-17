# DeepSeek Harness 工作台桌面端

[English](README.md) | 中文

这个包是 DeepSeek Harness 工作台的 Windows Electron 桌面应用。它把现有 Node Host、Web UI 和本地运行时封装成独立桌面产品，在私有环回端口启动 Host，再把工作台加载进受限的 Electron 窗口。用户不需要单独安装 Node.js 或 pnpm。

## 在仓库中运行

```powershell
pnpm.cmd run build
pnpm.cmd --filter @deepseek-ai/dsh-desktop dev
```

桌面端会直接用 Node 启动已构建的 `apps/cli/lib/bin.js`。如果构建产物不存在，则通过 `tsx` 回退到 TypeScript 源码入口。从仓库外启动时，设置 `DSH_DESKTOP_SOURCE_ROOT` 指向仓库根目录。

## 构建 Windows 桌面包

```powershell
pnpm.cmd run desktop:dist
```

这个命令会先构建仓库，再从 workspace 包 tarball 创建干净运行时，打包 Windows `node.exe`，最后调用 Electron Builder。便携版可执行文件和 NSIS 安装包会写入 `dist/desktop/artifacts/`，文件名以 `DeepSeek-Harness-Workbench-` 开头。安装后的应用不要求用户另外安装 Node.js 或 pnpm。

## 向已安装用户发布更新

桌面端使用独立仓库 `bxlh009/deepseek-harness-workbench` 的 GitHub Releases 作为更新渠道。软件启动 15 秒后检查一次，之后每 6 小时检查；发现新版本时只显示提示，由用户决定是否下载。下载完成后，用户可以立即重启安装或稍后处理。更新覆盖程序文件，但用户数据目录中的模型、API 密钥、会话和皮肤配置会保留。

发布新版本时：

1. 修改 `apps/desktop/package.json` 的 `version`，例如 `0.1.0-rc.6`。
2. 提交代码并创建完全匹配的标签，例如 `desktop-v0.1.0-rc.6`。
3. 推送标签后，`.github/workflows/desktop-release.yml` 会在 Windows 构建并发布 NSIS 安装包、`latest.yml` 和 `.blockmap`。
4. 已安装的旧版本会从 Release 元数据发现新版本，并在用户确认后完成覆盖更新。

同一个版本号不会触发更新；不得覆盖或重新上传已经发布的版本。发现有问题时应发布更高版本。当前桌面包仍没有代码签名，因此 Windows SmartScreen 可能显示“未知发布者”警告；面向公众正式分发前应配置可信的 Windows 代码签名证书。

桌面壳关闭渲染器的 Node 权限，拒绝外部窗口导航，只让 Host 绑定到 `127.0.0.1`，并等待 Host 进程退出后才允许 Electron 结束。

每个桌面实例会使用 Electron 用户数据目录下可写的独立 Harness home，不再继承 CLI 的 `~/.dsh` profile 链接。若需要显式指定其他目录，可在启动前设置 `DSH_DESKTOP_HOME`。独立 home 不会自动复制 CLI 的凭据和设置，首次启动时请在桌面 UI 中完成配置。
