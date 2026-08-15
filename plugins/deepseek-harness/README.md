# DeepSeek Harness Codex plugin

English | [中文](README.zh.md)

This local plugin connects Codex to the DeepSeek Harness JSON-RPC runtime through a dependency-free MCP stdio bridge. It adds two Codex skills and five focused tools:

- `dsh_status` — inspect the runtime and the persisted plan state.
- `dsh_start_session` — start the configured unattended DSH SDK runtime.
- `dsh_plan` — create, update, approve, inspect, or clear the execution plan.
- `dsh_prompt` — send one approved prompt to the running runtime.
- `dsh_stop` — stop the runtime and close the session.

## Plan-first contract

Mutating execution is blocked while a plan is active. The intended sequence is:

1. Call `dsh_status`.
2. Call `dsh_plan` with `action: "start"` and an objective.
3. Explore the repository with read-only operations and call `dsh_plan` with `action: "update"` and a complete Markdown plan beginning with `#`.
4. Show the plan to the user and wait for explicit approval.
5. Call `dsh_plan` with `action: "approve"`.
6. Start the session and call `dsh_prompt` for execution.
7. Verify the workspace separately, then call `dsh_stop`.

This is an adapter-level gate. It does not replace Codex's native plan-mode restrictions, and it does not claim that a local process has completed a real code change until the workspace is inspected.

## Runtime discovery

The bridge first honors explicit configuration and then looks for the checked-out DeepSeek Harness repository:

- `DSH_CWD` — workspace in which the runtime operates; defaults to the MCP process cwd.
- `DSH_REPO_ROOT` — DeepSeek Harness checkout containing the SDK runtime.
- `DSH_CORDIS_CONFIG` — Cordis config; defaults to `examples/jsonrpc-agent/cordis.yml`.
- `DSH_RUNTIME_COMMAND` — explicit runtime executable.
- `DSH_RUNTIME_ARGS` — JSON array of arguments for the explicit executable.
- `DSH_MODEL` — model passed to the SDK runtime; defaults to `deepseek-v4-flash`.
- `DSH_MAX_TOKENS` — optional positive token limit.
- `DSH_RUNTIME_TIMEOUT_MS` — request timeout; defaults to 120000 ms.
- `DSH_PLAN_FILE` — persisted plan path; defaults to `.dsh/codex-plan.json` under `DSH_CWD`.

If `DSH_REPO_ROOT` is not set, the bridge searches from `DSH_CWD` and the plugin directory. It prefers the built `packages/examples/jsonrpc-demo/lib/bin.js` and falls back to the source entrypoint through `tsx/esm`. A copied plugin should set `DSH_REPO_ROOT` explicitly.

The runtime inherits `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL` from its environment. The bridge never writes credentials into the plan file or its protocol output.

## Direct local smoke test

From the DeepSeek Harness checkout:

```powershell
node .\plugins\deepseek-harness\tests\server-smoke.mjs
```

The test exercises MCP initialization, tool discovery, plan blocking, approval persistence, and keyless runtime startup/shutdown. It does not send a model prompt.

The plugin is source-local at this stage. It has not been installed into the user Codex plugin cache and has not been published to GitHub.
