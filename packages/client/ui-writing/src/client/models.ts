import type { IApiClient, ModelProviderGroup } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

export interface WritingModelsState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  groups: readonly ModelProviderGroup[]
  error: string | null
}

/** Host-backed model catalog for the manual writing selector. */
export class WritingModelsController {
  readonly store: SnapshotStore<WritingModelsState> = createSnapshotStore({ status: 'idle', groups: [], error: null })
  private generation = 0

  constructor(private readonly api: Pick<IApiClient, 'llm'>) {}

  /** Load all currently configured model routes without choosing one. */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((state) => { state.status = 'loading'; state.error = null })
    try {
      const response = await this.api.llm.models({})
      const result = response.result
      if (!result.ok) throw new Error(result.error.message)
      if (generation !== this.generation) return
      this.store.update((state) => { state.status = 'ready'; state.groups = result.value.groups; state.error = null })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((state) => { state.status = 'error'; state.error = error instanceof Error ? error.message : String(error) })
    }
  }
}
