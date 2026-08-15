---
name: deepseek-harness
description: Use the local DeepSeek Harness MCP tools to inspect, start, plan, and execute work in a configured DeepSeek Harness runtime. Trigger when the user asks to use DeepSeek Harness, DeepSeek agent execution, DSH sessions, or run an approved task through DSH.
---

# DeepSeek Harness

Use the MCP tools as a controlled adapter around the local DSH runtime.

1. Call `dsh_status` before relying on an existing session or plan.
2. For any task that can change files, configuration, runtime behavior, or external state, use the `deepseek-harness-plan` skill and create an explicit plan with `dsh_plan`.
3. Start the runtime with `dsh_start_session` only when a session is needed.
4. Call `dsh_prompt` only after the user has explicitly approved the displayed plan, or when the request is clearly non-mutating.
5. Send one focused prompt at a time. Do not put API keys, tokens, or private credentials in prompts or plans.
6. When the work is over, call `dsh_stop` and separately inspect the workspace and test results.

The returned assistant text is evidence of what the DSH runtime reported for that activity interval. It is not proof that files, tests, browser behavior, devices, cloud services, or GitHub state changed successfully. If the runtime cannot start, report the exact configuration boundary and do not silently substitute another agent.

The desktop Electron shell and this Codex plugin are separate entry points. A working plugin does not prove the installed desktop executable is healthy.
