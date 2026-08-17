import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { BlockAssembler, createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import * as Fusion from '../src/index.ts'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'

class MemorySettings extends SettingsProvider {
  get writable(): boolean { return true }
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> { return Promise.resolve() }
}

class ReplyAdapter extends LlmAdapter {
  readonly calls: GenerateOptions[] = []
  constructor(private readonly answer: (request: GenerateOptions) => string) { super() }
  override async * stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.calls.push(request)
    const text = this.answer(request)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

class ImageReplyAdapter extends ReplyAdapter {
  override resolveModel(provider: string, model: string) {
    return Promise.resolve({ provider, id: model, name: model, inputModalities: ['text', 'image'] as const })
  }
}

const contexts: Context[] = []
afterEach(async () => { while (contexts.length > 0) await contexts.pop()!.fiber.dispose() })

describe('fusion virtual model', () => {
  it('registers its settings namespace from a dormant bare mount', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(MemorySettings)
    await ctx.plugin(Fusion, {})
    expect(ctx.settings.describe().map(row => String(row.ns))).toContain('llm-fusion')
    expect(ctx.llm.listConfigurableProviders()).toContainEqual({
      provider: 'fusion', displayName: '融合模型', settingsNs: 'llm-fusion', settingsPath: [],
    })
  })

  it('stays dormant when the loader mounts it without configuration', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(LlmRuntime)

    expect(() => { Fusion.apply(ctx, undefined as unknown as Fusion.Config) }).not.toThrow()
    expect(ctx.llm.listProviders().some(provider => provider.id === 'fusion')).toBe(false)
  })

  it('advertises one model, runs candidates without tools, then streams the synthesizer with tools', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(LlmRuntime)
    const candidateA = new ReplyAdapter(() => 'draft A')
    const candidateB = new ReplyAdapter(() => 'draft B')
    const judge = new ReplyAdapter(request => request.system?.includes('draft A') && request.system.includes('draft B') ? 'combined' : 'missing')
    ctx.llm.registerAdapter(['agnes'], candidateA)
    ctx.llm.registerAdapter(['longcat'], candidateB)
    ctx.llm.registerAdapter(['deepseek-official'], judge)
    await ctx.plugin(Fusion, { models: [{
      id: 'smart-mix', name: 'Smart Mix',
      candidates: [{ provider: 'agnes', model: 'agnes-1' }, { provider: 'longcat', model: 'longcat-1' }],
      synthesizer: { provider: 'deepseek-official', model: 'deepseek-chat' },
    }] })

    expect(ctx.llm.listProviders().find(provider => provider.id === 'fusion')?.name).toBe('融合模型')
    await expect(ctx.llm.listModels('fusion')).resolves.toContainEqual(expect.objectContaining({ id: 'smart-mix', name: 'Smart Mix' }))
    const assembler = new BlockAssembler()
    for await (const chunk of ctx.llm.stream({
      provider: 'fusion', model: 'smart-mix', messages: [],
      tools: [{ name: 'search', description: 'search', parameters: { type: 'object' } }],
    })) assembler.push(chunk)

    expect(assembler.blocks()).toEqual([{ type: 'text', text: 'combined' }])
    expect(candidateA.calls[0]?.tools).toEqual([])
    expect(candidateB.calls[0]?.tools).toEqual([])
    expect(judge.calls[0]?.tools?.[0]?.name).toBe('search')
    expect(judge.calls[0]?.system).toContain('Candidate 1 (agnes/agnes-1)')
  })

  it('rejects recursive, duplicate, and undersized definitions', () => {
    expect(() => Fusion.validateConfig({ models: [{ id: 'x', name: 'X', candidates: [{ provider: 'a', model: 'm' }], synthesizer: { provider: 'a', model: 'm' } }] })).toThrow(/2 to 4/)
    expect(() => Fusion.validateConfig({ models: [{ id: 'x', name: 'X', candidates: [{ provider: 'fusion', model: 'x' }, { provider: 'a', model: 'm' }], synthesizer: { provider: 'a', model: 'm' } }] })).toThrow(/cannot include/)
    expect(() => Fusion.validateConfig({ models: [{ id: 'x', name: 'X', candidates: [{ provider: 'a', model: 'm' }, { provider: 'b', model: 'm' }], synthesizer: { provider: 'a', model: 'm' }, visionProvider: 'fusion', visionModel: 'x' }] })).toThrow(/vision route/)
    expect(() => Fusion.validateConfig({ models: [{ id: 'x', name: 'X', candidates: [{ provider: 'a', model: 'm' }, { provider: 'b', model: 'm' }], synthesizer: { provider: 'a', model: 'm' }, visionProvider: 'groq-vision', visionModel: 'qwen', shareImagesWithVisionProvider: false }] })).toThrow(/image sharing acknowledgement/)
    expect(() => Fusion.validateConfig({ globalVisionProvider: 'agnes-ai', globalVisionModel: 'agnes-2.5-flash', shareImagesWithGlobalVisionProvider: false })).toThrow(/global image sharing acknowledgement/)
  })

  it('uses the global vision route for an image sent to an ordinary text model', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(LlmRuntime)
    const vision = new ImageReplyAdapter(() => 'OCR: global report')
    const text = new ReplyAdapter(request => request.system?.includes('OCR: global report')
      && !request.messages.some(message => message.content.some(block => block.type === 'image'))
      ? 'answered with eyes'
      : 'missing vision')
    ctx.llm.registerAdapter(['agnes-ai'], vision)
    ctx.llm.registerAdapter(['longcat'], text)
    await ctx.plugin(Fusion, {
      globalVisionProvider: 'agnes-ai',
      globalVisionModel: 'agnes-2.5-flash',
      shareImagesWithGlobalVisionProvider: true,
    })
    await expect(ctx.llm.acceptsInput('longcat', 'LongCat-2.0', 'image')).resolves.toBe(true)
    await expect(ctx.llm.acceptsInput('agnes-ai', 'agnes-2.5-flash', 'image')).resolves.toBe(true)
    const image = { type: 'image' as const, attachment: { attachmentId: 'sha256:global' as never, mediaType: 'image/png' as const, bytes: 10, width: 2, height: 2 } }
    const assembler = new BlockAssembler()
    for await (const chunk of ctx.llm.stream({
      provider: 'longcat', model: 'LongCat-2.0',
      messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'what is this?' }, image] })],
    })) assembler.push(chunk)

    expect(assembler.blocks()).toEqual([{ type: 'text', text: 'answered with eyes' }])
    expect(vision.calls).toHaveLength(1)
    expect(text.calls).toHaveLength(1)
    expect(text.calls[0]?.messages[0]?.content).not.toContainEqual(expect.objectContaining({ type: 'image' }))
  })

  it('does not intercept a model that already declares native image input', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(LlmRuntime)
    const vision = new ReplyAdapter(() => 'should not run')
    const native = new ImageReplyAdapter(request => request.messages.some(message => message.content.some(block => block.type === 'image')) ? 'native image' : 'missing image')
    ctx.llm.registerAdapter(['agnes-ai'], vision)
    ctx.llm.registerAdapter(['native'], native)
    await ctx.plugin(Fusion, {
      globalVisionProvider: 'agnes-ai', globalVisionModel: 'agnes-2.5-flash', shareImagesWithGlobalVisionProvider: true,
    })
    const image = { type: 'image' as const, attachment: { attachmentId: 'sha256:native' as never, mediaType: 'image/png' as const, bytes: 10, width: 2, height: 2 } }
    const assembler = new BlockAssembler()
    for await (const chunk of ctx.llm.stream({
      provider: 'native', model: 'native-vl',
      messages: [createUserMessage({ source: { kind: 'user' }, content: [image] })],
    })) assembler.push(chunk)

    expect(assembler.blocks()).toEqual([{ type: 'text', text: 'native image' }])
    expect(vision.calls).toHaveLength(0)
  })

  it('uses one vision report and sends text-only history to every reasoning route', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(LlmRuntime)
    const vision = new ReplyAdapter(() => 'OCR: TypeError on line 23')
    const candidateA = new ReplyAdapter(request => request.messages.some(message => message.content.some(block => block.type === 'image')) ? 'saw image' : 'draft A')
    const candidateB = new ReplyAdapter(() => 'draft B')
    const judge = new ReplyAdapter(request => request.system?.includes('OCR: TypeError on line 23') ? 'fixed' : 'missing')
    ctx.llm.registerAdapter(['visual'], vision)
    ctx.llm.registerAdapter(['a'], candidateA)
    ctx.llm.registerAdapter(['b'], candidateB)
    ctx.llm.registerAdapter(['judge'], judge)
    await ctx.plugin(Fusion, { models: [{
      id: 'with-eyes', name: 'With eyes',
      candidates: [{ provider: 'a', model: 'one' }, { provider: 'b', model: 'two' }],
      synthesizer: { provider: 'judge', model: 'final' },
      visionProvider: 'visual', visionModel: 'eyes',
      shareImagesWithVisionProvider: true,
    }] })
    await expect(ctx.llm.resolveModelInfo('fusion', 'with-eyes')).resolves.toMatchObject({ inputModalities: ['text', 'image'] })
    const image = { type: 'image' as const, attachment: { attachmentId: 'sha256:test' as never, mediaType: 'image/png' as const, bytes: 10, width: 2, height: 2 } }
    const request = { provider: 'fusion', model: 'with-eyes', messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'fix this' }, image] })] }
    for (let run = 0; run < 2; run++) for await (const _chunk of ctx.llm.stream(request)) { /* consume */ }
    expect(vision.calls).toHaveLength(1)
    expect(candidateA.calls[0]?.messages[0]?.content).not.toContainEqual(expect.objectContaining({ type: 'image' }))
    expect(judge.calls[0]?.system).toContain('OCR: TypeError on line 23')
  })
})
