/** Pure AnySearch response mapping and error helpers. */

import type { WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web'
import type { AnySearchEnvelope, AnySearchContentBlock, AnySearchJsonRpcError, AnySearchResultItem } from './types.ts'

/** Map AnySearch's JSON-RPC result envelope to the provider-neutral web seam shape. */
export function mapAnySearchResponse(parsed: AnySearchEnvelope): WebSearchResult {
  if (!isRecord(parsed)) {
    throw new Error('AnySearch returned an unexpected response body')
  }
  if (isRecord(parsed.error)) throw new Error(rpcErrorMessage(parsed.error))

  const result = isRecord(parsed.result) ? parsed.result : undefined
  const text = contentText(result?.content)
  if (result?.isError === true) throw new Error(text || 'AnySearch returned a tool error')

  const structured = result?.structuredContent
  const structuredSources = mapItems(findResultItems(structured))
  const textSources = mapItems(findResultItems(parseJson(text)))
  const markdownSources = parseMarkdownSources(text)
  const sources = dedupeSources([...structuredSources, ...textSources, ...markdownSources])

  return {
    ...text.length > 0 ? { content: text } : {},
    sources,
    truncated: false,
  }
}

/** Preserve provider error messages without inventing an authentication failure. */
export function anySearchErrorDetail(text: string, status: number): string {
  let parsed: unknown = null
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    // Non-JSON gateways are handled by the status fallback below.
  }
  if (isRecord(parsed)) {
    if (isRecord(parsed.error)) {
      const message = rpcErrorMessage(parsed.error)
      if (message.length > 0) return message
    }
    if (typeof parsed.message === 'string' && parsed.message.length > 0) return parsed.message
  }
  if (status === 401 || status === 403) return `AnySearch authentication failed (HTTP ${status})`
  if (status === 429) return `AnySearch request rate limited (HTTP ${status})`
  return `AnySearch API error (HTTP ${status})`
}

/** Keep the request inside AnySearch's documented result-count range. */
export function clampMaxResults(value: number | undefined, fallback: number, limit = 10): number {
  const n = Math.trunc(value ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, 1), limit)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function rpcErrorMessage(error: AnySearchJsonRpcError): string {
  if (typeof error.message === 'string' && error.message.length > 0) return error.message
  return typeof error.code === 'number' || typeof error.code === 'string'
    ? `AnySearch JSON-RPC error (code ${String(error.code)})`
    : 'AnySearch JSON-RPC error'
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .filter(isRecord)
    .map(item => item as AnySearchContentBlock)
    .filter(item => item.type === undefined || item.type === 'text')
    .map(item => typeof item.text === 'string' ? item.text : '')
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function parseJson(text: string): unknown {
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function findResultItems(value: unknown): AnySearchResultItem[] {
  if (Array.isArray(value)) return value.filter(isRecord) as AnySearchResultItem[]
  if (!isRecord(value)) return []
  for (const key of ['results', 'items']) {
    const candidate = value[key]
    if (Array.isArray(candidate)) return candidate.filter(isRecord) as AnySearchResultItem[]
  }
  const data = value.data
  return isRecord(data) ? findResultItems(data) : []
}

function mapItems(items: AnySearchResultItem[]): WebSearchSource[] {
  return items.flatMap(item => {
    const url = typeof item.url === 'string' ? cleanUrl(item.url) : ''
    if (url.length === 0) return []
    return [{
      url,
      ...typeof item.title === 'string' && item.title.length > 0 ? { title: item.title } : {},
      ...typeof item.snippet === 'string' && item.snippet.length > 0 ? { snippet: item.snippet } : {},
      ...typeof item.publishedAt === 'string' && item.publishedAt.length > 0 ? { publishedAt: item.publishedAt } : {},
    }]
  })
}

/** Parse the Markdown returned in AnySearch's `tools/call` text content. */
function parseMarkdownSources(text: string): WebSearchSource[] {
  const headings = [...text.matchAll(/^###\s+\d+\.\s+(.+?)\s*$/gmu)]
  const sources: WebSearchSource[] = []
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index]
    if (heading === undefined) continue
    const start = heading.index ?? 0
    const end = headings[index + 1]?.index ?? text.length
    const block = text.slice(start, end)
    const urlMatch = block.match(/^\s*-\s*\*\*URL\*\*:\s*(https?:\/\/\S+)/imu)
    const markdownLink = block.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/u)
    const url = cleanUrl(urlMatch?.[1] ?? markdownLink?.[2] ?? '')
    if (url.length === 0) continue
    const snippet = block
      .split(/\r?\n/u)
      .slice(1)
      .filter(line => !/^\s*-\s*\*\*URL\*\*:/iu.test(line))
      .map(line => line.replace(/^\s*-\s*/u, '').trim())
      .filter(line => line.length > 0 && !/^\*\*URL\*\*:/iu.test(line))
      .join(' ')
      .trim()
    sources.push({
      url,
      title: (heading[1] ?? '').trim(),
      ...snippet.length > 0 ? { snippet } : {},
    })
  }
  return sources
}

function cleanUrl(url: string): string {
  return url.replace(/[),.;]+$/u, '')
}

function dedupeSources(sources: WebSearchSource[]): WebSearchSource[] {
  const seen = new Set<string>()
  return sources.filter(source => {
    if (seen.has(source.url)) return false
    seen.add(source.url)
    return true
  })
}
