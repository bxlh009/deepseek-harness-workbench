# `@deepseek-ai/dsh-client-ui-writing`

English | [中文](README.zh.md)

The Writing surface is a local-first long-form editor that reuses the Harness model catalog. A person explicitly chooses the provider/model route; the product never silently substitutes another model. The manuscript supports live chapter/selection character counts, quoted selections, selection-scoped rewriting, and polishing. Generated text lands in a preview and enters the manuscript only after confirmation.

Projects, structured story memory, chapters, manuscript text, assistant conversations, and the selected model persist in browser-local storage. Structured memory covers world rules, semantic map locations/connections, character dossiers, and character relationships, with timeline and outline notes. Markdown export is a user-triggered local download. Model generation uses the existing text-only `llm.arena` route with one explicitly selected route and no coding Session history or tools.

## Model Experience

### Previewed writing request

#### What the model sees

The one manually selected `llm.arena` route receives a single text prompt containing the writing mode, relevant structured memory, project synopsis, timeline, outline, chapter title and summary, current manuscript, optional selected passage, and the person's instruction. Assistant chat also receives the ten most recent writing messages and the current quoted passage. It receives no coding Session history or tools. Prompts require consistency with confirmed story memory.

#### Token effect

One request prompt is created only when the person clicks Generate preview or sends an assistant message. Relevant structured memory is selected by query keywords, with a bounded fallback. Story context, recent conversation, and manuscript text are capped together at 16,000 characters; the response budget is 4,096 tokens.

#### KV Cache effect

The writing prompt is assembled from mutable local project state and therefore is not a stable reusable prefix across requests. This package does not add anything to the coding agent's persistent system prompt.

## Known Limitations and Deferred Work

- Projects currently persist in browser-local storage rather than the workspace filesystem, so they do not synchronize between machines.
- Export is Markdown only. Import, DOCX/EPUB export, version history, and multi-document search are deferred.
- Generation is non-streaming and uses one explicit route. A provider failure is shown directly and never triggers an automatic fallback.
- Map memory is currently semantic (location nodes and named connections), not a graphical canvas or geographic renderer.
