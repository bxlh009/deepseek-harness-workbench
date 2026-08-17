# Agent Note: Fusion virtual models

Status: implemented

English | [中文](2026-08-15-fusion-virtual-models.zh.md)

## Problem

The Models settings page could configure provider routes but could not expose a reusable multi-model workflow as a model. A hidden tool would make invocation model-dependent and would not put the combined route in the conversation model selector.

## Decision

Add the settings-driven `@deepseek-ai/dsh-llm-fusion` adapter. Each profile advertises one model under the fixed `fusion` provider, runs two to four distinct candidate routes concurrently without tools, and sends their bounded text drafts to a configured synthesizer route. The synthesizer receives the original tools and streams its answer through the normal agent loop.

The Models page reads the live model catalog, provides a first-class Fusion models editor, and writes profiles to the `llm-fusion` namespace. The adapter registers the provider only while at least one valid profile exists, so the existing model directory and selector need no fusion-specific branch.

A profile may select an image-capable vision sidecar. Such a profile advertises image input, sends each distinct attachment set to the sidecar once, replaces every image block with a text marker, and gives the bounded visual report to the candidate and synthesizer routes as fallible evidence. Profiles without a sidecar remain text-only. This keeps image bytes away from text-only providers while allowing direct paste and upload through the ordinary conversation input.

The custom-provider card offers hosted-vision shortcuts for Groq and the Gemini OpenAI-compatible endpoint. Each shortcut declares an image-capable model and requires an API key, stored through the existing write-only credential service rather than settings. Free quotas and data handling remain provider-controlled. Before any fusion profile can use a vision route, both the UI and adapter validation require a persisted acknowledgement that uploaded image bytes leave the local application for that provider.

The adapter also owns an optional global vision fallback through the `llm/stream` waterfall. It inspects only requests that contain images, bypasses models that declare native image input, and otherwise performs the same cached image-to-report transformation before redispatching the original provider/model request. Internal vision calls carry a process-local bypass identity so they cannot recursively trigger the fallback. The settings page requires the same persisted image-sharing acknowledgement before enabling it.

The same page owns a blind arena for evidence gathering. The host `llm.arena` RPC runs a profile's candidates plus its fusion route concurrently with one identical prompt, no tools, and no Session history. The browser hides route identity until the user selects a winner, then reveals latency and token usage and keeps an in-memory win tally.

## Alternatives considered

**Model-facing committee tool.** Rejected because it is not a selectable model and the language model can choose not to invoke it.

**Core agent-loop branching.** Rejected because composition belongs behind the provider-neutral LLM adapter seam and should not change ordinary single-model sessions.

**Recursive fusion.** Rejected to keep request count bounded and prevent cycles.

**Install a vision MCP server only.** Rejected as the conversation path because an MCP tool cannot intercept an image pasted before a text-only model receives the turn. The sidecar follows the same image-to-text pattern as [`vision-mcp`](https://github.com/Pelican0126/vision-mcp) inside the selectable adapter route instead.

## Consequences

- A fusion profile costs `candidate count + 1` model calls per inference and may be slower than one model.
- Candidate tools are disabled; only the synthesizer can emit executable tool calls.
- Arena rounds cost one call per candidate plus one complete fusion inference; they are intentionally user-judged rather than judged by one of the compared models.
- A sidecar-enabled inference with a new attachment set adds one vision-model call; repeated agent steps reuse the in-memory report.
- The settings UI lists only models that declare image input as vision-sidecar choices and explains that uploaded images are sent to that route.
- Groq and Gemini shortcuts reduce hosted-vision setup to a key and a review of the declared route; dynamic aggregators remain available through the generic custom-provider form rather than a stale hard-coded free-model choice.
- A vision profile cannot be saved or loaded unless `shareImagesWithVisionProvider` is explicitly `true`; this is disclosure and consent, not a claim about a provider's retention policy.
- A global fallback applies only to image-bearing calls whose selected model does not declare image input; native vision routes remain unchanged.
- Configuration refuses duplicate ids, duplicate routes, recursive fusion routes, and candidate counts outside two through four.

## Testing

Adapter tests cover catalog registration, candidate isolation, one-call visual preprocessing, image removal, synthesis context, tool forwarding, consent enforcement, and invalid definitions. Host and component tests cover hosted-provider presets, credential gating, consent gating, tool-free arena dispatch, anonymous presentation, reveal, metrics, and voting.
