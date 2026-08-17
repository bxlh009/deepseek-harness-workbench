# @deepseek-ai/dsh-host-plugin-inventory

English | [中文](README.zh.md)

Manageable Host projection of the current Cordis Loader tree. `PluginInventoryGateway` registers the `pluginInventory` service and publishes generated direct Remotes for `pluginInventory/list` and `pluginInventory/setEnabled`. Listing reads `ctx.loader.entries()` directly, skips structural group rows, and returns Loader identity, module specifier, effective enablement, toggle eligibility, and root Fiber phase. `setEnabled` persists the entry's direct `disabled` flag through its owning Loader tree and returns a fresh snapshot after Cordis mounts or disposes the Fiber. The runtime spine is protected so the management channel cannot disable itself.

The phase is `pending`, `loading`, `active`, `failed`, or `unloading`; it is `null` when the entry has no live root Fiber. The snapshot is intentionally point-in-time: Loader remains the sole lifecycle authority, while this package owns no cache, history, provenance model, or event stream. Its public payload types live under `./types`, and Typert generates the Host and Client Remote artifacts exposed by `./typert` and `./remote`.

The service is Remote-only and deliberately declares no same-process Cordis `Context` merge. Client packages consume it through the explicit [`api-remotes`](../../api/remotes/README.md) assembly rather than importing the Host implementation.

## Model Experience

None, as this Host-only inventory projection registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Point-in-time state only** — the result contains no durable failure history or subscription; a missing root Fiber is reported as `null`, regardless of why no live root exists.
- **No provenance or mutation** — the service does not identify which bundle, profile, or override introduced an entry, and it cannot enable, disable, add, or remove plugins.
