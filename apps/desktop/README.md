# DeepSeek Harness Workbench desktop application

English | [中文](README.zh.md)

This package is the Windows Electron desktop application for DeepSeek Harness Workbench. It bundles the existing Node Host, Web UI, and local runtime as a standalone desktop product, starts the Host on a private loopback port, and loads the workbench in a hardened Electron window. Users do not need to install Node.js or pnpm separately.

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

This builds the repository, creates a clean runtime from the workspace package tarballs, bundles a Windows `node.exe`, and invokes Electron Builder. The portable executable and NSIS installer are written to `dist/desktop/artifacts/` with names beginning with `DeepSeek-Harness-Workbench-`. The installed application does not require the user to install Node.js or pnpm separately.

## Publish an update to installed users

The desktop application uses GitHub Releases from the independent `bxlh009/deepseek-harness-workbench` repository as its update channel. It checks 15 seconds after startup and then every 6 hours. When a newer version is available, it prompts instead of downloading silently. After the download, the user can restart and install immediately or defer it. Program files are replaced, while models, API keys, sessions, and skin settings stored in the user-data directory remain intact.

To publish a new version:

1. Change `version` in `apps/desktop/package.json`, for example to `0.1.0-rc.6`.
2. Commit the source and create an exactly matching tag such as `desktop-v0.1.0-rc.6`.
3. Push the tag. `.github/workflows/desktop-release.yml` builds on Windows and publishes the NSIS installer, `latest.yml`, and `.blockmap`.
4. Installed older versions discover the release metadata and apply the update after user confirmation.

The same version never updates itself, and published versions must not be overwritten. Publish a higher version to correct a release. The package is currently unsigned, so Windows SmartScreen may show an unrecognized-publisher warning. Configure a trusted Windows code-signing certificate before broad public distribution.

The shell denies renderer Node access and external window navigation, keeps the Host on `127.0.0.1`, and waits for the Host process to exit before allowing Electron to quit.

Each desktop instance uses a writable Harness home below Electron's user-data directory instead of inheriting the CLI's `~/.dsh` profile links. Set `DSH_DESKTOP_HOME` before launching if an operator needs to select another home explicitly. The isolated home means CLI credentials and settings are not copied automatically; configure them through the desktop UI on first launch.
