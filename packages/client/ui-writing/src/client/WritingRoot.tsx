import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { InjectFace, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { WritingModelsState } from './models.ts'
import {
  countWritingCharacters,
  type AssistantMessage,
  type createWritingStore,
  type MemoryKind,
  type TextSelection,
  type WritingChapter,
  type WritingMode,
  type WritingProject,
  type WritingState,
} from './store.ts'
import css from './WritingRoot.module.css'

export interface GenerateWritingRequest {
  project: WritingProject
  chapter: WritingChapter
  mode: WritingMode
  instruction: string
  selection: TextSelection | null
  provider: string
  model: string
}
export interface ChatWritingRequest {
  project: WritingProject
  chapter: WritingChapter
  messages: AssistantMessage[]
  message: string
  quote: string
  provider: string
  model: string
}
export interface WritingRootInjected {
  hooks: { models: SnapshotStore<WritingModelsState> }
  loadModels: () => Promise<void>
  generate: (request: GenerateWritingRequest) => Promise<string>
  chat: (request: ChatWritingRequest) => Promise<string>
  download: (project: WritingProject) => void
}
export type WritingRootProps = PropsRuntime<'writing'> & PropsStore<ReturnType<typeof createWritingStore>> & InjectFace<WritingRootInjected>

const MODE_LABELS: Array<[WritingMode, string]> = [['continue', '续写'], ['rewrite', '改写'], ['polish', '润色'], ['check', '检查']]
const MEMORY_TABS: Array<[MemoryKind | 'timeline' | 'outline', string]> = [
  ['world', '世界观'], ['locations', '地图地点'], ['characters', '人物'], ['relationships', '人物关系'], ['timeline', '时间线'], ['outline', '大纲'],
]

function selectedProject(state: WritingState): WritingProject {
  const project = state.projects.find(item => item.id === state.activeProjectId) ?? state.projects[0]
  if (project === undefined) throw new Error('Writing state must contain at least one project')
  return project
}
function selectedChapter(state: WritingState, project: WritingProject): WritingChapter {
  const chapter = project.chapters.find(item => item.id === state.activeChapterId) ?? project.chapters[0]
  if (chapter === undefined) throw new Error('Writing project must contain at least one chapter')
  return chapter
}

/** Complete local-first writing studio. */
export function WritingRoot({ useStore, actions, useModels, loadModels, generate, chat, download }: WritingRootProps) {
  const state = useStore(snapshot => snapshot)
  const models = useModels(snapshot => snapshot)
  const project = selectedProject(state)
  const chapter = selectedChapter(state, project)
  const memory = project.memory
  const messages = project.assistantMessages
  const [rightMode, setRightMode] = useState<'chat' | 'memory'>('chat')
  const [memoryTab, setMemoryTab] = useState<MemoryKind | 'timeline' | 'outline'>('world')
  useEffect(() => { void loadModels() }, [loadModels])

  const modelValue = state.selectedModel === null ? '' : `${state.selectedModel.provider}\u0000${state.selectedModel.model}`
  const words = useMemo(() => countWritingCharacters(chapter.content), [chapter.content])
  const selectedWords = useMemo(() => countWritingCharacters(state.selection?.text ?? ''), [state.selection])

  const run = async (mode = state.mode, instruction = state.instruction): Promise<void> => {
    if (state.selectedModel === null || state.generating) return
    actions.setGenerating(true); actions.setError(null)
    try {
      const text = await generate({ project, chapter, mode, instruction, selection: state.selection, ...state.selectedModel })
      const range = state.selection !== null && (mode === 'rewrite' || mode === 'polish')
        ? { start: state.selection.start, end: state.selection.end }
        : null
      actions.setPreview(text, mode, range)
    } catch (error) { actions.setError(error instanceof Error ? error.message : String(error)) }
    finally { actions.setGenerating(false) }
  }

  const quoteSelection = (): void => {
    if (state.selection === null) return
    actions.setAssistantDraft(`引用原文：\n「${state.selection.text}」\n\n请帮我分析并给出修改方案。`)
    setRightMode('chat')
  }

  const sendMessage = async (): Promise<void> => {
    const message = state.assistantDraft.trim()
    if (message === '' || state.selectedModel === null || state.generating) return
    const quote = state.selection?.text ?? ''
    actions.addAssistantMessage('user', message); actions.setAssistantDraft(''); actions.setGenerating(true); actions.setError(null)
    try {
      const response = await chat({ project, chapter, messages, message, quote, ...state.selectedModel })
      actions.addAssistantMessage('assistant', response)
    } catch (error) { actions.setError(error instanceof Error ? error.message : String(error)) }
    finally { actions.setGenerating(false) }
  }

  const updateMemory = (kind: MemoryKind, id: string, field: string, value: string): void => {
    actions.updateMemoryItem(kind, id, field, value)
  }

  return (
    <main className={css.root} aria-label="写作工作台">
      <aside className={css.library}>
        <div className={css.libraryHeader}><strong>我的作品</strong><button type="button" className={css.iconButton} aria-label="新建作品" onClick={() => { actions.newProject() }}>＋</button></div>
        <select className={css.projectSelect} value={project.id} onChange={(event) => { actions.selectProject(event.target.value) }}>
          {state.projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <label className={css.compactField}>作品名<input value={project.title} onChange={(event) => { actions.updateProject('title', event.target.value) }} /></label>
        <label className={css.compactField}>类型<input value={project.genre} placeholder="科幻、悬疑、都市……" onChange={(event) => { actions.updateProject('genre', event.target.value) }} /></label>
        <div className={css.chapterHeader}><span>章节目录</span><button type="button" onClick={() => { actions.addChapter() }}>＋ 新建章节</button></div>
        <div className={css.chapterList}>{project.chapters.map(item => (
          <button key={item.id} type="button" className={item.id === chapter.id ? css.activeChapter : undefined} onClick={() => { actions.selectChapter(item.id) }}>{item.title}</button>
        ))}</div>
      </aside>

      <section className={css.editorPane}>
        <header className={css.toolbar}>
          <label className={css.modelField}>模型<select aria-label="选择模型" value={modelValue} onChange={(event) => {
            const [provider, model] = event.target.value.split('\u0000'); if (provider !== undefined && model !== undefined) actions.selectModel(provider, model)
          }}><option value="">请选择模型</option>{models.groups.map(group => (
              <optgroup key={group.id} label={group.name}>{group.models.map(item => <option key={`${group.id}/${item.id}`} value={`${group.id}\u0000${item.id}`}>{item.name}</option>)}</optgroup>
            ))}</select></label>
          <span className={css.saveState}>已自动保存</span><button type="button" className={css.secondaryButton} onClick={() => { download(project) }}>导出 Markdown</button>
        </header>
        {models.error !== null && <p className={css.error} role="alert">模型目录加载失败：{models.error}</p>}
        <div className={css.editorScroll}>
          <input className={css.chapterTitle} aria-label="章节标题" value={chapter.title} onChange={(event) => { actions.updateChapter('title', event.target.value) }} />
          <input className={css.chapterSummary} aria-label="章节摘要" value={chapter.summary} placeholder="本章摘要（会提供给模型保持连贯）" onChange={(event) => { actions.updateChapter('summary', event.target.value) }} />
          {state.selection !== null && <div className={css.selectionBar} role="toolbar" aria-label="选中文字工具">
            <strong>已选 {selectedWords} 字</strong>
            <button type="button" aria-label="引用到助手" onClick={quoteSelection}>引用到助手</button>
            <button type="button" disabled={state.selectedModel === null || state.generating} onClick={() => { void run('rewrite', '重写选中文字，保持事实和人物语气一致。') }}>改写选中</button>
            <button type="button" disabled={state.selectedModel === null || state.generating} onClick={() => { void run('polish', '润色选中文字，不改变情节事实。') }}>润色选中</button>
          </div>}
          <textarea className={css.manuscript} aria-label="正文" value={chapter.content} placeholder="从这里开始写正文……"
            onChange={(event) => { actions.updateChapter('content', event.target.value); actions.clearSelection() }}
            onSelect={(event) => {
              const target = event.currentTarget; const start = target.selectionStart; const end = target.selectionEnd
              actions.setSelection(start, end, target.value.slice(start, end))
            }} />
          <div className={css.wordCount}><span>本章 {words} 字</span>{state.selection !== null && <span>选中 {selectedWords} 字</span>}</div>
        </div>
        <section className={css.commandDock} aria-label="AI 写作工具">
          <div className={css.modeTabs}>{MODE_LABELS.map(([mode, label]) => <button key={mode} type="button" className={state.mode === mode ? css.activeMode : undefined} onClick={() => { actions.setMode(mode) }}>{label}</button>)}</div>
          <div className={css.commandRow}><textarea value={state.instruction} aria-label="写作指令" placeholder="例如：续写 1200 字，让主角发现新的线索……" onChange={(event) => { actions.setInstruction(event.target.value) }} />
            <button type="button" className={css.primaryButton} disabled={state.selectedModel === null || state.generating} onClick={() => { void run() }}>{state.generating ? '生成中…' : '生成预览'}</button></div>
          {state.selectedModel === null && <p className={css.notice}>请先手动选择模型；工作台不会替你切换模型。</p>}
          {state.error !== null && <p className={css.error} role="alert">{state.error}</p>}
        </section>
      </section>

      <aside className={css.assistant}>
        <div className={css.assistantHeader}><h2>写作助手</h2><div className={css.primaryTabs} role="tablist">
          <button type="button" className={rightMode === 'chat' ? css.activePrimaryTab : undefined} onClick={() => { setRightMode('chat') }}>对话</button>
          <button type="button" className={rightMode === 'memory' ? css.activePrimaryTab : undefined} onClick={() => { setRightMode('memory') }}>记忆库</button>
        </div></div>

        {rightMode === 'chat' && <div className={css.chatPanel}>
          <div className={css.messages} aria-live="polite">{messages.length === 0
            ? <div className={css.emptyState}><strong>和助手讨论你的正文</strong><span>选中文字引用过来，助手会结合世界观、人物和关系记忆回答。</span></div>
            : messages.map((item, index) => <article key={item.id} className={item.role === 'user' ? css.userMessage : css.assistantMessage}>
              <span>{item.role === 'user' ? '你' : '助手'}</span><p>{item.content}</p>
              {item.role === 'assistant' && index === messages.length - 1 && <div className={css.messageActions}>
                <button type="button" disabled={state.selection === null} onClick={() => { if (state.selection !== null) actions.setPreview(item.content, 'rewrite', state.selection) }}>替换选区预览</button>
                <button type="button" onClick={() => { actions.setPreview(item.content, 'continue') }}>追加正文预览</button>
              </div>}
            </article>)}</div>
          <div className={css.chatComposer}><textarea aria-label="给写作助手发消息" value={state.assistantDraft} placeholder="询问情节、讨论改法，或先从正文引用一段……" onChange={(event) => { actions.setAssistantDraft(event.target.value) }}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} />
          <button type="button" className={css.primaryButton} aria-label="发送消息" disabled={state.selectedModel === null || state.generating || state.assistantDraft.trim() === ''} onClick={() => { void sendMessage() }}>{state.generating ? '思考中…' : '发送'}</button></div>
          {state.selectedModel === null && <p className={css.notice}>对话也使用你在顶部手动选择的模型。</p>}
        </div>}

        {rightMode === 'memory' && <div className={css.memoryPanel}>
          <div className={css.memoryTabs}>{MEMORY_TABS.map(([id, label]) => <button key={id} type="button" className={memoryTab === id ? css.activeMemoryTab : undefined} onClick={() => { setMemoryTab(id) }}>{label}</button>)}</div>
          {memoryTab === 'world' && <MemorySection title="世界规则" addLabel="新增规则" onAdd={() => { actions.addMemoryItem('world') }}>{memory.world.map(item => <MemoryCard key={item.id} onRemove={() => { actions.removeMemoryItem('world', item.id) }}>
            <input aria-label="世界观名称" value={item.title} placeholder="规则、势力或禁忌" onChange={(event) => { updateMemory('world', item.id, 'title', event.target.value) }} />
            <textarea aria-label="世界观详情" value={item.detail} placeholder="写清适用范围、限制和代价" onChange={(event) => { updateMemory('world', item.id, 'detail', event.target.value) }} />
          </MemoryCard>)}</MemorySection>}
          {memoryTab === 'locations' && <MemorySection title="语义地图" addLabel="新增地点" onAdd={() => { actions.addMemoryItem('locations') }}>{memory.locations.map(item => <MemoryCard key={item.id} onRemove={() => { actions.removeMemoryItem('locations', item.id) }}>
            <input aria-label="地点名称" value={item.name} placeholder="地点名称" onChange={(event) => { updateMemory('locations', item.id, 'name', event.target.value) }} />
            <textarea aria-label="地点详情" value={item.detail} placeholder="地貌、功能、氛围、危险" onChange={(event) => { updateMemory('locations', item.id, 'detail', event.target.value) }} />
            <input aria-label="相连地点" value={item.connections} placeholder="相连地点，用逗号分隔" onChange={(event) => { updateMemory('locations', item.id, 'connections', event.target.value) }} />
          </MemoryCard>)}</MemorySection>}
          {memoryTab === 'characters' && <MemorySection title="人物档案" addLabel="新增人物" onAdd={() => { actions.addMemoryItem('characters') }}>{memory.characters.map(item => <MemoryCard key={item.id} onRemove={() => { actions.removeMemoryItem('characters', item.id) }}>
            <input aria-label="人物姓名" value={item.name} placeholder="人物姓名" onChange={(event) => { updateMemory('characters', item.id, 'name', event.target.value) }} />
            <input aria-label="人物身份" value={item.identity} placeholder="身份 / 阵营" onChange={(event) => { updateMemory('characters', item.id, 'identity', event.target.value) }} />
            <textarea aria-label="人物特征" value={item.traits} placeholder="性格、能力、秘密" onChange={(event) => { updateMemory('characters', item.id, 'traits', event.target.value) }} />
            <input aria-label="人物目标" value={item.goal} placeholder="当前目标" onChange={(event) => { updateMemory('characters', item.id, 'goal', event.target.value) }} />
          </MemoryCard>)}</MemorySection>}
          {memoryTab === 'relationships' && <MemorySection title="人物关系" addLabel="新增关系" onAdd={() => { actions.addMemoryItem('relationships') }}>{memory.relationships.map(item => <MemoryCard key={item.id} onRemove={() => { actions.removeMemoryItem('relationships', item.id) }}>
            <div className={css.twoColumns}><input aria-label="关系起点" value={item.source} placeholder="人物 A" onChange={(event) => { updateMemory('relationships', item.id, 'source', event.target.value) }} /><input aria-label="关系终点" value={item.target} placeholder="人物 B" onChange={(event) => { updateMemory('relationships', item.id, 'target', event.target.value) }} /></div>
            <input aria-label="关系类型" value={item.type} placeholder="盟友、师徒、敌对……" onChange={(event) => { updateMemory('relationships', item.id, 'type', event.target.value) }} />
            <textarea aria-label="关系详情" value={item.detail} placeholder="关系变化、共同秘密、冲突" onChange={(event) => { updateMemory('relationships', item.id, 'detail', event.target.value) }} />
          </MemoryCard>)}</MemorySection>}
          {memoryTab === 'timeline' && <label className={css.longMemory}>时间线<textarea aria-label="时间线" value={project.timeline} placeholder="按顺序记录已经发生和计划发生的事件" onChange={(event) => { actions.updateProject('timeline', event.target.value) }} /></label>}
          {memoryTab === 'outline' && <div><label className={css.longMemory}>故事梗概<textarea aria-label="故事梗概" value={project.synopsis} onChange={(event) => { actions.updateProject('synopsis', event.target.value) }} /></label><label className={css.longMemory}>全书大纲<textarea aria-label="大纲" value={project.outline} onChange={(event) => { actions.updateProject('outline', event.target.value) }} /></label></div>}
        </div>}

        {state.preview !== '' && <section className={css.preview} aria-live="polite">
          <div className={css.previewHeader}><strong>{state.previewMode === 'check' ? '检查结果' : state.previewRange === null ? '追加预览' : '选区替换预览'}</strong><button type="button" onClick={() => { actions.clearPreview() }}>关闭</button></div>
          <div className={css.previewText}>{state.preview}</div>
          {state.previewMode !== 'check' && <button type="button" className={css.primaryButton} onClick={() => { actions.acceptPreview() }}>{state.previewRange === null ? '确认写入正文' : '确认替换选区'}</button>}
        </section>}
      </aside>
    </main>
  )
}

function MemorySection({ title, addLabel, onAdd, children }: { title: string; addLabel: string; onAdd: () => void; children: ReactNode }) {
  return <section className={css.memorySection}><header><strong>{title}</strong><button type="button" onClick={onAdd}>＋ {addLabel}</button></header>{children}<p className={css.memoryHint}>保存后，相关内容会在写作和对话时按关键词加入模型上下文。</p></section>
}
function MemoryCard({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return <article className={css.memoryCard}>{children}<button type="button" className={css.removeButton} onClick={onRemove}>删除</button></article>
}
