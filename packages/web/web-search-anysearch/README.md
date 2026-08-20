# @deepseek-ai/dsh-web-search-anysearch

AnySearch-backed `WebSearchProvider` for the Harness `ctx.web` seam. The base
desktop bundle selects it as `searchProvider: anysearch` and calls the
JSON-RPC `tools/call` search method at `POST https://api.anysearch.com/mcp`.

`ANYSEARCH_API_KEY` is optional: anonymous AnySearch access works with lower
limits, while a key from the launching environment or Harness credentials
service increases the quota. The provider never ships a key.

The endpoint can be changed with `ANYSEARCH_BASE_URL` (a root URL is normalized
to `/mcp`). The provider parses the JSON-RPC `result.content` search response
and deduplicates citeable URLs before returning them to `ctx.web`.
