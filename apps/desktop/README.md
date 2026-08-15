# ShenXun Workbench desktop application

English | [中文](README.zh.md)

This package is the Windows Electron desktop application for ShenXun Workbench. It bundles the existing Node Host, Web UI, and local runtime as a standalone desktop product, starts the Host on a private loopback port, and loads the workbench in a hardened Electron window. Users do not need to install Node.js or pnpm separately.

## Run from the repository

```powershell
pnpm.cmd run build
pnpm.cmd --filter @deepseek-ai/dsh-desktop dev
```

The desktop application launches the built `apps/cli/lib/bin.js` entry directly with Node. If the build output is absent, it falls back to the TypeScript source entry through `tsx`. Set `DSH_DESKTOP_SOURCE_ROOT` when launching it from outside this repository.

## Build a Windows desktop package

```powershell
pnpm.cmd run desktop:dist
```

This builds the repository, creates a clean runtime from the workspace package tarballs, bundles a Windows `node.exe`, and invokes Electron Builder. The portable executable and NSIS installer are written to `dist/desktop/artifacts/` with names beginning with `ShenXun-Workbench-`. The installed application does not require the user to install Node.js or pnpm separately.

The package is currently unsigned and has no auto-update channel. Windows SmartScreen may therefore show an unrecognized-publisher warning, and release signing/updates remain separate release work.

The shell denies renderer Node access and external window navigation, keeps the Host on `127.0.0.1`, and waits for the Host process to exit before allowing Electron to quit.

Each desktop instance uses a writable Harness home below Electron's user-data directory instead of inheriting the CLI's `~/.dsh` profile links. Set `DSH_DESKTOP_HOME` before launching if an operator needs to select another home explicitly. The isolated home means CLI credentials and settings are not copied automatically; configure them through the desktop UI on first launch.
