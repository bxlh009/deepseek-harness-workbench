# Agent Note: Windows Electron desktop shell

Status: implemented

English | [中文](2026-08-14-electron-desktop-shell.zh.md)

## Problem

DeepSeek Harness exposes a local Node Host and browser UI, but Windows users must start the CLI and open the loopback URL themselves. That leaves process ownership, window lifecycle, and renderer permissions outside the product surface.

## Decision

The repository ships an `apps/desktop` Electron shell and a Windows distribution path. The shell owns a `HostSupervisor` that starts the existing built CLI entry directly through Node, allocates a private loopback port, waits for HTTP readiness, loads the existing Web UI in a context-isolated sandboxed window, and waits for the Host to exit during shutdown. The desktop shell is an adapter at the existing Host/Web seam; it does not fork the agent runtime or introduce a second UI implementation.

The distribution script packs the DSH and vendored workspace families into tarballs, installs them into a clean runtime so workspace links and peer dependencies are resolved as a real release closure, includes platform optional native dependencies, and copies a Windows `node.exe` beside that runtime. Electron Builder then embeds the runtime as an extra resource and emits portable and NSIS targets.

External navigation and renderer Node access are denied by default. The shell sets telemetry disablement only when the caller has not explicitly chosen a telemetry mode; API credentials remain owned by the existing Harness settings and credential providers.

The desktop process passes an isolated, writable `DSH_HOME` below Electron's user-data directory to the child Host. `DSH_DESKTOP_HOME` is an explicit override for operators who need another home; the desktop package does not copy or expose the CLI's existing credentials automatically.

## Alternatives considered

**A browser shortcut or a second local web server.** Rejected because neither owns the child process or gives the renderer a desktop permission posture. The desktop shell must be the lifecycle owner while reusing the existing Host.

**Tauri for the first Windows surface.** Deferred because the existing Host is Node/TypeScript and already owns Windows shell, filesystem, and subprocess capabilities. A Rust bridge would add a second host integration before the Electron seam has been validated.

**Rewriting the Harness UI as native controls.** Rejected because it duplicates the shipped Web UI and would split the client contract from the existing Web transport without user value for this MVP.

## Consequences

Development runs from a repository checkout with built Host and Web artifacts, or from the source entry through `tsx`. Packaged builds use the embedded runtime and do not require a system Node.js or pnpm installation. The package is currently unsigned and has no auto-update channel. The Host remains loopback-only and the Electron process must wait for child quiescence before exit.

## Testing

`apps/desktop/test/host-supervisor.test.mjs` covers entry selection, launch arguments, loopback readiness, graceful child shutdown, and propagation of the isolated `DSH_HOME` through the real supervisor interface. The root `desktop:test` script runs this focused suite. Local release verification also runs the repository build, checks the packaged runtime with `node_modules/@deepseek-ai/dsh/lib/bin.js --version`, starts the packaged Windows runtime against an isolated home, and inspects the Electron Builder artifacts. Code signing, clean-machine installation, and visual GUI acceptance remain external release checks.
