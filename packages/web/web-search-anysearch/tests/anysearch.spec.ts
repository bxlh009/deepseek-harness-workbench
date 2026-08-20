import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as anySearchPlugin from '@deepseek-ai/dsh-web-search-anysearch'
import {
  ANYSEARCH_PROVIDER_ID,
  AnySearchProvider,
} from '@deepseek-ai/dsh-web-search-anysearch'

function jsonRpcResponse(text: string, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: { content: [{ type: 'text', text }] },
  }), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AnySearch provider', () => {
  it('registers in ctx.web and maps the native response', async () => {
    const fetchMock = vi.fn(async () => jsonRpcResponse(`## Search Results (2 results, 10ms)

### 1. A
- **URL**: https://example.com/a
- snippet A

### 2. B
- **URL**: https://example.com/b
- snippet B`))
    vi.stubGlobal('fetch', fetchMock)

    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: ANYSEARCH_PROVIDER_ID })
    const fiber = await ctx.plugin(anySearchPlugin, {
      apiKey: 'anysearch-key',
      baseURL: 'https://api.anysearch.test',
      maxResults: 7,
    })

    await expect(ctx.web.search({ query: 'DeepSeek Harness', maxResults: 2 })).resolves.toEqual({
      sources: [
        { url: 'https://example.com/a', title: 'A', snippet: 'snippet A' },
        { url: 'https://example.com/b', title: 'B', snippet: 'snippet B' },
      ],
      truncated: false,
      content: expect.stringContaining('Search Results'),
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anysearch.test/mcp')
    expect(init.headers).toMatchObject({ authorization: 'Bearer anysearch-key' })
    expect(JSON.parse(init.body as string)).toMatchObject({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: {
          query: 'DeepSeek Harness',
          max_results: 2,
        },
      },
    })
    await fiber.dispose()
  })

  it('allows anonymous search without making the API key mandatory', async () => {
    const fetchMock = vi.fn(async () => jsonRpcResponse('## Search Results (0 results, 1ms)'))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: ANYSEARCH_PROVIDER_ID })
    const fiber = await ctx.plugin(anySearchPlugin, { baseURL: 'https://api.anysearch.test' })

    await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({ sources: [] })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.headers).not.toHaveProperty('authorization')
    await fiber.dispose()
  })

  it('keeps the provider seam implementation independently constructible', () => {
    expect(new AnySearchProvider(() => ({
      apiKey: 'key',
      baseURL: 'https://api.anysearch.test',
      maxResults: 10,
    })).available()).toBe(true)
  })
})
