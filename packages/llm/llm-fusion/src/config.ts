import z from '@deepseek-ai/schemastery'

/** One concrete provider/model route used by a fusion profile. */
export interface ModelRoute {
  /** Registered provider route. */
  provider: string
  /** Provider-owned model identifier. */
  model: string
}
/** One virtual model and the real routes that produce its response. */
export interface FusionModelProfile {
  /** Stable lowercase identifier advertised under the `fusion` provider. */
  id: string
  /** Human-readable name shown in model selectors. */
  name: string
  /** Two to four distinct routes invoked concurrently without tools. */
  candidates: ModelRoute[]
  /** Route that receives the candidate drafts and emits the final response. */
  synthesizer: ModelRoute
  /** Provider of the optional image-capable preprocessing route. */
  visionProvider?: string
  /** Model of the optional image-capable preprocessing route. */
  visionModel?: string
  /** Explicit acknowledgement that image bytes leave Harness for the selected route. */
  shareImagesWithVisionProvider?: boolean
}
/** One image-capable route used transparently for text-only models. */
export interface GlobalVisionConfig extends ModelRoute {
  /** Explicit acknowledgement that image bytes leave Harness for this provider. */
  shareImagesWithProvider: boolean
}
/** Settings-driven fusion adapter configuration. */
export interface Config {
  /** Virtual models advertised when the list is non-empty. */
  models?: FusionModelProfile[]
  /** Provider of the optional global image preprocessor. */
  globalVisionProvider?: string
  /** Model of the optional global image preprocessor. */
  globalVisionModel?: string
  /** Explicit acknowledgement for the global image preprocessor. */
  shareImagesWithGlobalVisionProvider?: boolean
}

const route: z<ModelRoute> = z.object({ provider: z.string().required(), model: z.string().required() })
const profile: z<FusionModelProfile> = z.object({
  id: z.string().required(),
  name: z.string().required(),
  candidates: z.array(route),
  synthesizer: route,
  visionProvider: z.string(),
  visionModel: z.string(),
  shareImagesWithVisionProvider: z.boolean(),
})
export const Config: z<Config> = z.object({
  models: z.array(profile).default([]),
  globalVisionProvider: z.string(),
  globalVisionModel: z.string(),
  shareImagesWithGlobalVisionProvider: z.boolean(),
})

export function validateConfig(config: Config): void {
  if ((config.globalVisionProvider === undefined) !== (config.globalVisionModel === undefined)) {
    throw new Error('llm-fusion: global vision must set both provider and model')
  }
  if (config.globalVisionProvider === 'fusion') {
    throw new Error('llm-fusion: the global vision route cannot be a fusion model')
  }
  if (config.globalVisionProvider !== undefined && config.shareImagesWithGlobalVisionProvider !== true) {
    throw new Error('llm-fusion: global image sharing acknowledgement is required')
  }
  const ids = new Set<string>()
  for (const model of config.models ?? []) {
    if (!/^[a-z][a-z0-9-]*$/.test(model.id)) throw new Error(`llm-fusion: invalid model id "${model.id}"`)
    if (ids.has(model.id)) throw new Error(`llm-fusion: duplicate model id "${model.id}"`)
    ids.add(model.id)
    if (model.candidates.length < 2 || model.candidates.length > 4) {
      throw new Error(`llm-fusion: model "${model.id}" must select 2 to 4 candidates`)
    }
    const routes = new Set<string>()
    for (const candidate of model.candidates) {
      if (candidate.provider === 'fusion') throw new Error('llm-fusion: a fusion model cannot include another fusion model')
      const key = `${candidate.provider}\u0000${candidate.model}`
      if (routes.has(key)) throw new Error(`llm-fusion: model "${model.id}" repeats a candidate`)
      routes.add(key)
    }
    if (model.synthesizer.provider === 'fusion') throw new Error('llm-fusion: the synthesizer cannot be a fusion model')
    if ((model.visionProvider === undefined) !== (model.visionModel === undefined)) {
      throw new Error(`llm-fusion: model "${model.id}" must set both visionProvider and visionModel`)
    }
    if (model.visionProvider === 'fusion') throw new Error('llm-fusion: the vision route cannot be a fusion model')
    if (model.visionProvider !== undefined && model.shareImagesWithVisionProvider !== true) {
      throw new Error(`llm-fusion: model "${model.id}" requires an image sharing acknowledgement`)
    }
  }
}
