# Codex-style plugin center, phase one

English | [中文](2026-08-15-codex-style-plugin-center.zh.md)

## Context

The Plugins settings surface previously exposed configuration forms and a flat
Loader inventory without the navigation or catalog affordances users expect
from a desktop coding agent. OpenAI's plugin model separates discovery and
installation from the capabilities contributed by an installed plugin.

DeepSeek Harness does not yet have an application-level plugin catalog or a
transactional installation API. Its existing Host remote is deliberately a
read-only projection of current Cordis Loader entries. Presenting an Install
button on top of that remote would therefore create a false capability.

## Decision

The first pass presented a plugin center with two truthful views:

- Configuration contains settings contributed by configurable local plugins.
- Installed contains the current Host Loader inventory, with search, enabled
  state filtering, status totals, module identity, and expandable runtime
  details.

The follow-up adds management without pretending the Loader inventory is a
download marketplace. Optional entries have accessible switches backed by a
loopback-only `pluginInventory/setEnabled` Remote. The Host persists the direct
disabled flag and returns a fresh snapshot after Cordis applies the change.
Runtime-spine entries are marked non-toggleable so the connection, settings,
shell, and inventory cannot disable their own management path.
The Typert Loader and registry are part of that spine as well: disabling either
would remove the bridge that exposes Loader-backed capabilities. Protected
cards therefore use an explicit core-component description and a disabled
switch instead of attempting a mutation that the Host must reject.

Cards now include localized capability-category descriptions while retaining
the exact module specifier and Loader id in their details. Search and filters
use native controls with visible focus state and pressed-state semantics, and
the toolbar stacks on narrow settings panels.

## Follow-up boundary

Codex-style Browse and Install require a separate trusted catalog service plus
Host operations for package installation, removal, progress, permission
disclosure, restart/reload, and rollback. The existing CLI `dsh plugin` command
is useful installation machinery, but it must not be invoked directly from the
browser renderer or represented as a completed desktop workflow.
