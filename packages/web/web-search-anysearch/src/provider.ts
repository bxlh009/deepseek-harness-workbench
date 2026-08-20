/** AnySearch JSON-RPC implementation for the provider-neutral web seam. */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
} from '@deepseek-ai/dsh-web'
import { anySearchErrorDetail, clampMaxResults, mapAnySearchResponse } from './map.ts'
import type { AnySearchEnvelope } from './types.ts'

export const ANYSEARCH_PROVIDER_ID = 'anysearch'
export const ANYSEARCH_DEFAULT_BASE_URL = 'https://api.anysearch.com/mcp'
export const ANYSEARCH_DEFAULT_API_KEY_ENV = 'ANYSEARCH_API_KEY'
export const ANYSEARCH_DEFAULT_MAX_RESULTS = 10
export const ANYSEARCH_MAX_RESULTS_LIMIT = 10

const ANYSEARCH_CLIENT_HEADER = 'skill/3.0.1'
const USER_AGENT = 'deepseek-harness-web-search-anysearch/0.1.0'

export interface AnySearchProviderOptions {
  apiKey?: string
  resolveApiKey?: () => Promise<string | undefined>
  apiKeyEnv?: string
  baseURL: string
  maxResults: number
}

/** A credential-aware AnySearch provider; configuration is snapshotted per search. */
export class AnySearchProvider implements WebSearchProvider {
  readonly id = ANYSEARCH_PROVIDER_ID

  constructor(private readonly resolveOptions: () => AnySearchProviderOptions) {}

  available(): boolean {
    const options = this.resolveOptions()
    return URL.canParse(options.baseURL)
      && Number.isInteger(options.maxResults)
      && options.maxResults >= 1
      && options.maxResults <= ANYSEARCH_MAX_RESULTS_LIMIT
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const options = this.resolveOptions()
    const apiKey = await this.apiKey(options, signal)
    throwIfSearchAborted(signal)
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: {
          query: request.query,
          max_results: clampMaxResults(request.maxResults, options.maxResults, ANYSEARCH_MAX_RESULTS_LIMIT),
        },
      },
    }

    let response: Response
    try {
      response = await fetch(normalizeEndpoint(options.baseURL), {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-anysearch-client': ANYSEARCH_CLIENT_HEADER,
          'user-agent': USER_AGENT,
          ...apiKey === undefined ? {} : { authorization: `Bearer ${apiKey}` },
        },
        body: JSON.stringify(body),
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error)
      throw new WebError(`AnySearch search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      const text = await safeReadBody(response, signal)
      throw new WebError(anySearchErrorDetail(text, response.status), 'WEB_PROVIDER_ERROR')
    }

    try {
      return mapAnySearchResponse(await response.json() as AnySearchEnvelope)
    } catch (error: unknown) {
      if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error)
      if (error instanceof WebError) throw error
      throw new WebError(`AnySearch returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }

  private async apiKey(options: AnySearchProviderOptions, signal?: AbortSignal): Promise<string | undefined> {
    throwIfSearchAborted(signal)
    if (options.apiKey !== undefined && options.apiKey.length > 0) return options.apiKey
    let resolved: string | undefined
    try {
      resolved = await abortable(options.resolveApiKey?.() ?? Promise.resolve(undefined), signal)
    } catch (error: unknown) {
      if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error)
      throw new WebError(`AnySearch search credential resolution failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
    return resolved !== undefined && resolved.length > 0 ? resolved : undefined
  }
}

function normalizeEndpoint(baseURL: string): string {
  const url = new URL(baseURL)
  if (!url.pathname.replace(/\/+$/u, '').endsWith('/mcp')) {
    url.pathname = `${url.pathname.replace(/\/+$/u, '')}/mcp`
  }
  return url.toString()
}

async function safeReadBody(response: Response, signal?: AbortSignal): Promise<string> {
  try {
    return await response.text()
  } catch (error: unknown) {
    if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error)
    return ''
  }
}

function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return operation
  if (signal.aborted) return Promise.reject(searchAborted(signal))
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => { reject(searchAborted(signal)) }
    signal.addEventListener('abort', onAbort, { once: true })
    void operation.then(
      value => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', onAbort)
        reject(new Error(String(error).replace(/^Error: /u, ''), { cause: error }))
      },
    )
  })
}

function throwIfSearchAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw searchAborted(signal)
}

function searchAborted(signal?: AbortSignal, fallback?: unknown): WebError {
  return new WebError('AnySearch search aborted', 'WEB_ABORTED', {
    cause: signal?.aborted === true ? signal.reason : fallback,
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
