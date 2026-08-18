// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { WritingRoot } from '../src/client/WritingRoot.tsx'
import { createWritingStore } from '../src/client/store.ts'

afterEach(cleanup)

function hookOf<T>(store: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(selector: (state: T) => S): S {
    return selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  }
}

function mountWriting() {
  const writing = createWritingStore().create()
  const models = createSnapshotStore({
    status: 'ready' as const,
    error: null,
    groups: [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }] }],
  })
  const generate = vi.fn(async () => '风暴之后，新的信号亮了起来。')
  const chat = vi.fn(async () => '可以把“旧灯”改成更具体的“北港信号灯”。')
  const download = vi.fn()
  const neverHook = (() => { throw new Error('writing root must not read global lists') }) as never
  render(
    <WritingRoot
      useStore={hookOf(writing)} actions={writing.actions}
      useModels={hookOf(models)} loadModels={vi.fn(async () => {})}
      generate={generate} chat={chat} download={download}
      useSessions={neverHook} useWorkspaces={neverHook}
    />,
  )
  return { writing, generate, chat, download }
}

describe('WritingRoot', () => {
  it('requires an explicit model, previews generation, and writes only after confirmation', async () => {
    const { generate } = mountWriting()
    const generateButton = screen.getByRole('button', { name: '生成预览' })
    expect((generateButton as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('请先手动选择模型；工作台不会替你切换模型。')).toBeTruthy()

    fireEvent.change(screen.getByRole('combobox', { name: '选择模型' }), { target: { value: 'deepseek-official\u0000deepseek-chat' } })
    fireEvent.change(screen.getByRole('textbox', { name: '写作指令' }), { target: { value: '推进冲突' } })
    fireEvent.click(generateButton)

    await waitFor(() => { expect(screen.getByText('风暴之后，新的信号亮了起来。')).toBeTruthy() })
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'deepseek-official', model: 'deepseek-chat', instruction: '推进冲突', mode: 'continue',
    }))
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '正文' }).value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '确认写入正文' }))
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '正文' }).value).toBe('风暴之后，新的信号亮了起来。')
  })

  it('exports the active project only on the explicit button', () => {
    const { download } = mountWriting()
    fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }))
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ title: '未命名作品' }))
  })

  it('quotes a manuscript selection into a multi-turn assistant conversation', async () => {
    const { chat } = mountWriting()
    fireEvent.change(screen.getByRole('combobox', { name: '选择模型' }), { target: { value: 'deepseek-official\u0000deepseek-chat' } })
    const manuscript = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '正文' })
    fireEvent.change(manuscript, { target: { value: '风暴逼近。旧灯熄灭。黎明到来。' } })
    manuscript.setSelectionRange(5, 10)
    fireEvent.select(manuscript)

    expect(screen.getByText('已选 5 字')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '引用到助手' }))
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '给写作助手发消息' }).value).toContain('旧灯熄灭。')

    fireEvent.click(screen.getByRole('button', { name: '发送消息' }))
    await waitFor(() => { expect(chat).toHaveBeenCalled() })
    expect(await screen.findByText('可以把“旧灯”改成更具体的“北港信号灯”。')).toBeTruthy()
  })

  it('shows live chapter and selected character counts', () => {
    mountWriting()
    const manuscript = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '正文' })
    fireEvent.change(manuscript, { target: { value: '第一章\nHello world' } })
    expect(screen.getByText('本章 13 字')).toBeTruthy()
  })
})
