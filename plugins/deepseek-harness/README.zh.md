# DeepSeek Harness Codex 插件

[English](README.md) | 中文

这个本地插件通过无依赖的 MCP stdio 桥接，把 Codex 连接到 DeepSeek Harness 的 JSON-RPC 运行时，并提供计划先行的执行门禁。

工具包括：

- `dsh_status`：查看运行时、会话和计划状态。
- `dsh_start_session`：启动已配置的 DSH SDK 运行时。
- `dsh_plan`：创建、更新、审批、查看或清除计划。
- `dsh_prompt`：只向已审批的运行时发送一次任务提示。
- `dsh_stop`：停止运行时并关闭会话。

## 计划模式

计划处于 active 状态时，`dsh_prompt` 会被拒绝。正常顺序是：

1. 调用 `dsh_status` 查看当前状态。
2. 调用 `dsh_plan` 并以 `action: "start"` 创建目标。
3. 只读探索仓库，再以 `action: "update"` 写出以 `#` 开头的完整 Markdown 计划。
4. 把计划展示给用户，等待明确批准。
5. 以 `action: "approve"` 审批计划。
6. 启动会话，再调用 `dsh_prompt` 执行。
7. 单独验收工作区，然后调用 `dsh_stop`。

这是一层插件适配器门禁，不冒充 Codex 原生计划模式，也不把“运行时返回文本”冒充成“代码已经完成”。真正完成仍要检查工作区、测试和目标环境。

## 配置环境变量

- `DSH_CWD`：运行时工作区，默认是 MCP 进程当前目录。
- `DSH_REPO_ROOT`：DeepSeek Harness 源码根目录。
- `DSH_CORDIS_CONFIG`：Cordis 配置文件；默认使用 `examples/jsonrpc-agent/cordis.yml`。
- `DSH_RUNTIME_COMMAND`：显式指定运行时可执行文件。
- `DSH_RUNTIME_ARGS`：显式指定运行时的 JSON 数组参数。
- `DSH_MODEL`：默认 `deepseek-v4-flash`。
- `DSH_MAX_TOKENS`：可选的正整数 token 上限。
- `DSH_RUNTIME_TIMEOUT_MS`：请求超时时间，默认 120000 毫秒。
- `DSH_PLAN_FILE`：计划持久化文件，默认在 `DSH_CWD/.dsh/codex-plan.json`。

插件会继承 `DEEPSEEK_API_KEY` 和 `DEEPSEEK_BASE_URL`，但不会把密钥写入计划文件或协议输出。复制插件到其他位置后，建议显式设置 `DSH_REPO_ROOT`。

## 本地验收

在 DeepSeek Harness 根目录执行：

```powershell
node .\plugins\deepseek-harness\tests\server-smoke.mjs
```

该测试覆盖 MCP 握手、工具发现、计划门禁、审批持久化以及无 API 请求的运行时启停；不会真正发送模型任务。

目前插件只完成源码级本地接入，尚未安装到 Codex 用户插件缓存，也尚未发布到 GitHub。
