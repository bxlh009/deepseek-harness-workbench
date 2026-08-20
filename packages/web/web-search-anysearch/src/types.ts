/** Provider-private wire types for AnySearch's JSON-RPC MCP endpoint. */

export interface AnySearchJsonRpcError {
  code?: unknown
  message?: unknown
  data?: unknown
}

export interface AnySearchContentBlock {
  type?: unknown
  text?: unknown
}

export interface AnySearchJsonRpcResult {
  content?: unknown
  isError?: unknown
  structuredContent?: unknown
}

export interface AnySearchResultItem {
  title?: unknown
  url?: unknown
  snippet?: unknown
  publishedAt?: unknown
}

export interface AnySearchEnvelope {
  jsonrpc?: unknown
  id?: unknown
  result?: AnySearchJsonRpcResult
  error?: AnySearchJsonRpcError
}
