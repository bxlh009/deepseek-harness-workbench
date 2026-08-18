import { describe, expect, it } from 'vitest'
import { buildAssistantPrompt, buildWritingPrompt, countWritingCharacters, createWritingStore } from '../src/client/store.ts'

describe('writing store', () => {
  it('keeps the model selection manual and accepts a continuation preview explicitly', () => {
    const store = createWritingStore().create()
    store.actions.selectModel('deepseek-official', 'deepseek-chat')
    store.actions.setPreview('续写后的正文', 'continue')

    expect(store.getSnapshot().selectedModel).toEqual({
      provider: 'deepseek-official', model: 'deepseek-chat',
    })
    expect(store.getSnapshot().projects[0]?.chapters[0]?.content).toBe('')

    store.actions.acceptPreview()
    expect(store.getSnapshot().projects[0]?.chapters[0]?.content).toBe('续写后的正文')
  })

  it('builds a bounded Agnes-style prompt from story memory and the selected mode', () => {
    const state = createWritingStore().create().getSnapshot()
    const prompt = buildWritingPrompt(state.projects[0]!, state.projects[0]!.chapters[0]!, 'continue', '推进冲突')
    expect(prompt).toContain('故事设定')
    expect(prompt).toContain('推进冲突')
    expect(prompt).toContain('只输出可直接使用的中文结果')
    expect(prompt.length).toBeLessThanOrEqual(16_000)
  })

  it('replaces only the selected manuscript range after explicit confirmation', () => {
    const store = createWritingStore().create()
    store.actions.updateChapter('content', '风暴逼近。旧灯熄灭。黎明到来。')
    store.actions.setSelection(5, 10, '旧灯熄灭。')
    store.actions.setPreview('信号灯突然熄灭。', 'rewrite', { start: 5, end: 10 })

    store.actions.acceptPreview()

    expect(store.getSnapshot().projects[0]?.chapters[0]?.content).toBe('风暴逼近。信号灯突然熄灭。黎明到来。')
  })

  it('stores structured story memory and includes relevant records in assistant context', () => {
    const store = createWritingStore().create()
    store.actions.addMemoryItem('characters')
    const character = store.getSnapshot().projects[0]?.memory.characters[0]
    expect(character).toBeDefined()
    store.actions.updateMemoryItem('characters', character!.id, 'name', '沈星')
    store.actions.updateMemoryItem('characters', character!.id, 'goal', '找到北港失踪的姐姐')

    const state = store.getSnapshot()
    const project = state.projects[0]!
    const prompt = buildAssistantPrompt(project, project.chapters[0]!, [], '沈星为什么去北港？', '')

    expect(prompt).toContain('沈星')
    expect(prompt).toContain('北港')
    expect(prompt.length).toBeLessThanOrEqual(16_000)
  })

  it('counts manuscript and selection characters without whitespace', () => {
    expect(countWritingCharacters('第一章\nHello world')).toBe(13)
  })
})
