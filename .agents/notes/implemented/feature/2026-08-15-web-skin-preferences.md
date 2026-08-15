# Agent Note: Web skin preferences

Status: implemented

English | [中文](2026-08-15-web-skin-preferences.zh.md)

## Problem

The Web UI had a durable light/dark/system preference, but users could not change the product accent palette without changing the entire color scheme. A skin feature needs to survive reloads and loopback reconnects, apply before the shell paints, and remain separate from the light/dark choice.

## Decision

Extend the existing `ui-theme` settings namespace with a schema-defaulted `skin` field. Ship four built-in skins: `classic`, `ocean`, `forest`, and `sunset`; `classic` preserves the current palette. ThemeRuntime publishes the selected skin in `ThemeSnapshot` and exposes `setSkin`, while ThemePresenter projects it to `body[data-ds-skin]`. The Host index transform writes the same attribute during the pre-plugin interval.

The global `design-platform.css` sheet owns skin-specific semantic alias overrides. The Appearance row adds accessible skin cards with `aria-pressed`, visible `:focus-visible` rings, keyboard-native buttons, and preview swatches that reference existing static tokens. Skin selection never changes the `light`/`dark`/`system` preference.

## Alternatives considered

**Independent localStorage preference.** Rejected because it would break the existing Host-backed persistence contract and cross-port loopback behavior.

**Separate UI plugin.** Rejected because the current `ui-theme` plugin already owns the settings schema, bootstrap transform, runtime snapshot, and global color tokens.

**Coupling skin to light/dark.** Rejected because a user should be able to keep the same skin while switching between light, dark, and system modes.

## Consequences

- Existing settings documents remain valid because `skin` defaults to `classic`.
- The first HTML response paints both the color scheme and skin before client plugins load.
- Feature CSS continues to consume semantic `--dsw-*` aliases; skin selectors stay in the theme owner.
- The four built-in skins are intentionally fixed product presets. Third-party registered ThemeRuntime themes remain a separate extension surface.

## Testing

Focused UI theme/layout tests pass: 10 files and 75 tests. The Web settings snapshot and browser flow now cover the skin row, persistence, reload, and cross-port state.
