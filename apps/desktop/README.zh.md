# 深寻工作台桌面端

[English](README.md) | 中文

这个包是深寻工作台的 Windows Electron 桌面应用。它把现有 Node Host、Web UI 和本地运行时封装成独立桌面产品，在私有环回端口启动 Host，再把工作台加载进受限的 Electron 窗口。用户不需要单独安装 Node.js 或 pnpm。

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

这个命令会先构建仓库，再从 workspace 包 tarball 创建干净运行时，打包 Windows `node.exe`，最后调用 Electron Builder。便携版可执行文件和 NSIS 安装包会写入 `dist/desktop/artifacts/`，文件名以 `ShenXun-Workbench-` 开头。安装后的应用不要求用户另外安装 Node.js 或 pnpm。

当前桌面包没有代码签名，也没有自动更新渠道。因此 Windows SmartScreen 可能显示“未知发布者”警告；正式发布的签名和更新仍是独立的发布工作。

桌面壳关闭渲染器的 Node 权限，拒绝外部窗口导航，只让 Host 绑定到 `127.0.0.1`，并等待 Host 进程退出后才允许 Electron 结束。

每个桌面实例会使用 Electron 用户数据目录下可写的独立 Harness home，不再继承 CLI 的 `~/.dsh` profile 链接。若需要显式指定其他目录，可在启动前设置 `DSH_DESKTOP_HOME`。独立 home 不会自动复制 CLI 的凭据和设置，首次启动时请在桌面 UI 中完成配置。
