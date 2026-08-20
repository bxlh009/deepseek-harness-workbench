/** Register AnySearch's JSON-RPC search API in `ctx.web`. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-web'
import {
  AnySearchProvider,
  ANYSEARCH_DEFAULT_API_KEY_ENV,
  ANYSEARCH_DEFAULT_BASE_URL,
  ANYSEARCH_DEFAULT_MAX_RESULTS,
  ANYSEARCH_MAX_RESULTS_LIMIT,
} from './provider.ts'
import type { AnySearchProviderOptions } from './provider.ts'

export {
  AnySearchProvider,
  ANYSEARCH_DEFAULT_API_KEY_ENV,
  ANYSEARCH_DEFAULT_BASE_URL,
  ANYSEARCH_DEFAULT_MAX_RESULTS,
  ANYSEARCH_MAX_RESULTS_LIMIT,
  ANYSEARCH_PROVIDER_ID,
} from './provider.ts'
export type { AnySearchProviderOptions } from './provider.ts'
export { anySearchErrorDetail, clampMaxResults, mapAnySearchResponse } from './map.ts'

export const name = 'web-search-anysearch'
export const inject = ['web']

export interface Config {
  apiKey?: string
  apiKeyEnv?: string
  baseURL?: string
  maxResults?: number
}

export const Config: z<Config> = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(ANYSEARCH_DEFAULT_API_KEY_ENV),
  baseURL: z.string(),
  maxResults: z.number().step(1).min(1).max(ANYSEARCH_MAX_RESULTS_LIMIT).default(ANYSEARCH_DEFAULT_MAX_RESULTS),
})

export const WEB_SEARCH_ANYSEARCH_SETTINGS_NAMESPACE = settingsNamespace('web-search-anysearch')

function resolveOptions(ctx: Context, config: Config): AnySearchProviderOptions {
  const apiKeyEnv = credentialRef(config.apiKeyEnv ?? ANYSEARCH_DEFAULT_API_KEY_ENV)
  const literalApiKey = config.apiKey !== undefined && config.apiKey.length > 0 ? config.apiKey : undefined
  return {
    ...literalApiKey === undefined ? {} : { apiKey: literalApiKey },
    resolveApiKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value
      const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    apiKeyEnv: String(apiKeyEnv),
    baseURL: config.baseURL?.trim()
      || launchEnvironmentOf(ctx).get('ANYSEARCH_BASE_URL')?.value
      || ANYSEARCH_DEFAULT_BASE_URL,
    maxResults: config.maxResults ?? ANYSEARCH_DEFAULT_MAX_RESULTS,
  }
}

export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  installSettingsSection(ctx, WEB_SEARCH_ANYSEARCH_SETTINGS_NAMESPACE, Config, config, {
    setSource: source => {
      current = source
    },
    onChange: () => {},
  })
  ctx.web.registerSearchProvider(new AnySearchProvider(() => resolveOptions(ctx, current())))
}
