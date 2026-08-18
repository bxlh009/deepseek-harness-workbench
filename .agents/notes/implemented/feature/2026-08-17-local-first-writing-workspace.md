# Agent Note: Local-first writing workspace

Status: implemented

## Decision

The Web workbench adds a root-scoped `writing` slot beside the existing session-aware conversation slot. The layout keeps both surfaces mounted and exposes one observable `coding | writing` selection through `ctx.layout`; the sidebar changes that selection without turning writing documents into coding Sessions.

The writing plugin owns projects, story memory, chapters, manuscript text, preview state, and a manually selected model route in one browser-local persisted store. It reads the host-scoped `llm.models` catalog but never chooses a route. Generation sends one bounded Agnes-style prompt through `llm.arena` with exactly the selected route, no Session history, and no tools. Provider failure is shown directly and never triggers a fallback model.

Generated text remains preview-only. Continue appends after confirmation, rewrite and polish replace the current chapter after confirmation, and consistency checks never write into the manuscript. Markdown export is an explicit browser download.

## Consequences

Theme changes apply automatically because the entire surface uses shared `--dsw-*` aliases. Coding sessions retain their component state while the writing surface is visible. Browser-local persistence is not cross-device sync or a filesystem backup; Markdown export is the portable escape hatch for this first version.
