# Agent Note: Vision input is visible and configurable

Status: implemented

English | [中文](2026-08-15-visible-vision-input-controls.zh.md)

## Problem

Web image input already accepted paste and page-wide drop, but the composer had no visible file picker. Custom pi-ai models could declare `input: [text, image]` only by editing `settings.yaml`, so the product told users to switch to a vision model without providing a reachable way to mark a hand-declared model as one.

## Decision

The composer keeps its command launcher and adds a separate image-picker button for PNG, JPEG, WebP, and GIF files. Selected files enter the existing draft attachment rail and therefore retain the established limits, durable upload, model-admission, and retry behavior.

Each custom pi-ai model row exposes an advanced `Supports image input` checkbox. It writes that row's existing `input` capability as `[text, image]` when enabled and `[text]` when disabled. The control is deliberately opt-in: model names are not capability evidence, and an image-generation endpoint is not automatically a visual-understanding endpoint.

## Consequences

Users can discover image input without knowing drag-and-drop or YAML, while the conservative text-only default remains unchanged. A checked capability is still a deployment claim; the provider remains authoritative and may reject a false claim.

## Testing

The conversation test selects a file through the new picker and verifies it reaches the existing intake callback. The model-settings test enables vision on one row, leaves its sibling unchanged, and verifies the exact settings mutation.
