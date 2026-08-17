# Settings section navigation service

English | [中文](2026-08-15-settings-section-navigation-service.zh.md)

## Problem

The sidebar advertised Pull Requests, Sites, Scheduled, and Plugins as product
navigation, but rendered every one as a non-interactive placeholder. Plugins
already has a real settings surface, so leaving it dead made implemented
functionality inaccessible and made unimplemented products look broken.

## Decision

`ui-settings` now provides `ctx.settingsNavigation`, a small Cordis service that
routes a stable section id to the currently mounted settings shell. The shell
attaches its component-local `openSection` callback during its React lifecycle.
The sidebar depends on that service and opens the real `plugins` section.

Only implemented destinations are rendered. Pull Requests, Sites, and
Scheduled remain absent until their owning services and product surfaces exist.
This avoids false affordances without inventing empty pages.

## Boundary

No presentation package imports another plugin's runtime values. Context shape
arrives through a type-only client import, runtime collaboration uses Cordis,
and the settings shell remains the sole owner of modal and active-section state.
DOM custom events were rejected because they hide dependency ordering and
cannot fail clearly when the settings shell is absent.

## Verification

- Navigation service routing, replacement, and disposal unit tests.
- Settings shell test opening the Plugins section through the attachment.
- Sidebar test proving Plugins is a button and unimplemented entries are absent.
