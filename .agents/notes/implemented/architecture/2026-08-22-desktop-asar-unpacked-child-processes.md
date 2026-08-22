# Agent Note: Desktop asar-unpacked child processes

Status: implemented

## Problem

The packaged Windows desktop runtime executes the DSH host inside an Electron
utility process. Two child-process seams broke under that host:

- The windows-acl runner invocation is `[process.execPath, runner.js, ...]`.
  Inside Electron `process.execPath` is the Workbench binary, so the "runner"
  launch opened a second GUI instance; its single-instance lock exited 0 with
  no output, which the runner-failure classifier accepted as a successful
  empty result. Every confined command (`pwsh`, and glob/grep through their
  denial path) surfaced as silent empty output.
- The packaged ripgrep path resolves into the asar virtual tree
  (`require.resolve('@vscode/ripgrep-win32-x64/bin/rg.exe')`), and search
  children spawned through the subprocess seam cannot read asar paths.
  Separately, keeping only `*.node/*.exe/*.dll` on disk stripped platform
  packages down to bare binaries: without `package.json` and loader files
  even an existing binary could not be required as a module.

## Decision

`sandbox-local` maps a built runner entry that resolves inside an asar archive
onto its sibling `<archive>.unpacked` mirror plus the bundled real Node
executable (`<unpacked root>/node.exe`), and uses that pair when both exist.
`tool-fs-search` applies the same mapping to the resolved ripgrep path,
keeping the original resolution whenever no mirror exists. The desktop
packaging script unpacks the runner's complete dependency closure (`koffi`,
`@koromix`, `@vscode/ripgrep-win32-x64`, and
`@deepseek-ai/dsh-sandbox-windows-acl`) as whole packages so metadata travels
with the binaries and plain Node can resolve them from disk.

## Alternatives considered

### Why not run the host as a plain Node sidecar?

Spawning `runtime.asar.unpacked/node.exe` with the composed profile would give
every child a real `process.execPath` for free. It lost because the desktop
owns HostSupervisor/utility-process integration (IPC, lifecycle, window
wiring) that assumes the runtime rides inside the Electron process tree;
re-parenting the host is an architecture change far beyond restoring the
sandbox contract.

### Why not keep `execPath` and set `ELECTRON_RUN_AS_NODE`?

The runner would then execute, but it would still receive the asar-virtual
runner entry, which only Electron's patched fs can read — a plain Node child
would fail with `MODULE_NOT_FOUND`. It also pins the child to whatever Node
version Electron embeds instead of the pinned runtime beside the archive.

### Why not add a Config field for the runner executable?

`windowsAclRunnerArgs` already exists as a test hook, and promoting it to
public configuration adds surface whose only current consumer is the desktop
build itself. Deriving the invocation from the resolved entry keeps CLI and
desktop on one code path with zero operator configuration.

## Consequences

The unpacked mirror duplicates a few megabytes beside the archive, and the
packaging script now owns four extra `unpackDir` entries that must follow the
runner's import closure. In exchange, every sandboxed command and both search
tools execute correctly inside the packaged desktop, failures keep surfacing
loudly through the existing classification paths, and CLI, headless, and
development launches keep byte-identical behavior because the mapping only
fires for entries inside an existing `.asar` layout.

## Testing

Unit specs cover the mapping algebra for both consumers (mirror present,
mirror absent, non-asar passthrough) plus the memoized `resolveRgPath`
integration against a mocked platform package. Verified end-to-end on a real
installation by rebuilding the chain standalone (bundled node.exe + unpacked
runner + ACL token + PowerShell 5.1 fallback) and by tool calls after applying
the equivalent built-output patch.

## Related

- [Windows ACL restricted-token sandbox](../../feature/2026-08-08-windows-acl-restricted-token-sandbox.md)
- [Packaged ripgrep search](2026-08-01-packaged-ripgrep-search.md)
