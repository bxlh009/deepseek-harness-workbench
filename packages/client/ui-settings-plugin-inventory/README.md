# @deepseek-ai/dsh-client-ui-settings-plugin-inventory

English | [中文](README.zh.md)

Manageable **Installed plugins** tab for Web Settings. The browser plugin registers one localized `settings.plugins.tab` contribution with id `all`; the Plugins section owns the navigation entry and tab chrome. It performs no Remote read during plugin activation. Selecting the tab mounts a searchable, filterable catalog with localized capability descriptions and accessible enablement switches. Listing lazily calls `ctx.remote.pluginInventory.list()`; an eligible switch calls the loopback-only `ctx.remote.pluginInventory.setEnabled()` and replaces the view with the returned authoritative snapshot. Protected runtime-spine entries remain visible with disabled switches.

The tab renders a searchable two-column catalog of compact disclosure cards. Each collapsed card uses the short module name, a localized capability description, an effective-enablement switch, and the live root-fiber status dot. Expanding a card reveals its description, exact module specifier, Loader-tree entry id, effective configuration, and Cordis status. The entry id remains the React key, disclosure identity, detail value, and an additional search target. Loading, empty, no-match, generic read failure, and per-entry mutation failure states stay local to the mounted component without exposing transport details. The registration uses `ctx.slots.inject()`, so it follows late tab declaration, redeclaration, locale changes, and teardown without importing the section owner.

## Model Experience

None, as this package only visualizes a Host-owned deployment snapshot in browser Settings and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **One snapshot per Settings mount or retry** — the tab does not subscribe to Loader changes or automatically refetch after reconnect; switching tabs preserves the current snapshot, while reopening Settings obtains a new one.
- **No marketplace provenance** — the Loader view can manage optional runtime entries but does not yet group them by installable package, source, publisher, or permission set.
