---
name: deepseek-harness-plan
description: Run DeepSeek Harness work in an explicit plan-first mode. Use when a task changes files, configuration, runtime behavior, or external state, or when the user asks for a plan before execution.
---

# DeepSeek Harness plan mode

Treat the plan as an approval boundary, not as a progress note.

1. Call `dsh_plan` with `action: "status"`.
2. Call `dsh_plan` with `action: "start"` and a concrete objective.
3. Explore the repository and runtime with read-only operations. Do not use `dsh_prompt` while the plan is being designed.
4. Call `dsh_plan` with `action: "update"` and a decision-complete Markdown plan beginning with `#`. Include success criteria, affected subsystems, protocol/config changes, data flow, edge cases, failure handling, tests, acceptance checks, and assumptions.
5. Present the plan to the user and wait for explicit approval. A casual “yes” answering a different question is not approval.
6. After explicit approval, call `dsh_plan` with `action: "approve"`, then start the runtime and call `dsh_prompt`.
7. If the scope changes, update the plan and obtain approval again. If the user cancels, call `dsh_plan` with `action: "clear"`.

The bridge rejects execution while an active plan is unapproved. It cannot prevent unrelated native Codex tools from modifying files, so native Codex plan-mode restrictions still apply during exploration. Never claim approval, execution, or completion without the corresponding tool result and workspace evidence.
