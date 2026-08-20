# @deepseek-ai/dsh-web-search-anysearch

面向 Harness `ctx.web` 能力缝隙的 AnySearch 搜索提供方。桌面基础 bundle
默认选择 `searchProvider: anysearch`，通过
`POST https://api.anysearch.com/mcp` 的 JSON-RPC `tools/call` 调用 `search`。

`ANYSEARCH_API_KEY` 是可选的：没有密钥时使用 AnySearch 的匿名额度，有密钥时通过
Harness 凭据服务或启动环境提高额度。项目不会写入或随发布携带 API Key。

可用 `ANYSEARCH_BASE_URL` 更换接口地址（根地址会自动补成 `/mcp`）。提供方会读取
JSON-RPC `result.content` 中的 AnySearch 搜索结果，按 URL 去重后交给 `ctx.web`。
