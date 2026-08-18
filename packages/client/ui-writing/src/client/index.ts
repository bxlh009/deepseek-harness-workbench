import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { WritingModelsController } from './models.ts'
import { buildAssistantPrompt, buildWritingPrompt, createWritingStore, projectMarkdown } from './store.ts'
import { WritingRoot, type ChatWritingRequest, type GenerateWritingRequest, type WritingRootInjected } from './WritingRoot.tsx'

export const inject = ['slots', 'connection']

/** Mount the complete writing studio into the layout-owned writing slot. */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as ConnectionHandle
  const models = new WritingModelsController(api)
  const store = createWritingStore()
  const generate = async (request: GenerateWritingRequest): Promise<string> => {
    const response = await api.llm.arena({
      prompt: buildWritingPrompt(request.project, request.chapter, request.mode, request.instruction, request.selection),
      routes: [{ provider: request.provider, model: request.model }],
      maxTokens: 4096,
      timeoutMs: 120_000,
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    const result = response.result.value.results[0]
    if (result === undefined) throw new Error('模型没有返回写作结果。')
    if (result.error !== undefined) throw new Error(result.error)
    if (result.text.trim() === '') throw new Error('模型返回了空内容。')
    return result.text
  }
  const chat = async (request: ChatWritingRequest): Promise<string> => {
    const response = await api.llm.arena({
      prompt: buildAssistantPrompt(request.project, request.chapter, request.messages, request.message, request.quote),
      routes: [{ provider: request.provider, model: request.model }],
      maxTokens: 4096,
      timeoutMs: 120_000,
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    const result = response.result.value.results[0]
    if (result === undefined) throw new Error('模型没有返回对话结果。')
    if (result.error !== undefined) throw new Error(result.error)
    if (result.text.trim() === '') throw new Error('模型返回了空内容。')
    return result.text
  }
  const injected = (): WritingRootInjected => ({
    hooks: { models: models.store },
    loadModels: () => models.load(),
    generate,
    chat,
    download: (project) => {
      const blob = new Blob([projectMarkdown(project)], { type: 'text/markdown;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `${project.title.trim() || '未命名作品'}.md`
      anchor.click()
      URL.revokeObjectURL(href)
    },
  })
  ctx.effect(() => ctx.slots.register({ name: 'writing', store, inject: injected }, WritingRoot), 'ui-writing: writing surface')
}
