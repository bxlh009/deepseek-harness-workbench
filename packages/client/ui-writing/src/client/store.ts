import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

export type WritingMode = 'continue' | 'rewrite' | 'polish' | 'check'
export type MemoryKind = 'world' | 'locations' | 'characters' | 'relationships'
export interface WritingModelSelection {
  provider: string
  model: string
}
export interface WritingChapter {
  id: string
  title: string
  summary: string
  content: string
}
export interface TextRange {
  start: number
  end: number
}
export interface TextSelection extends TextRange {
  text: string
}
export interface WorldMemory {
  id: string
  title: string
  detail: string
}
export interface LocationMemory {
  id: string
  name: string
  detail: string
  connections: string
}
export interface CharacterMemory {
  id: string
  name: string
  identity: string
  traits: string
  goal: string
}
export interface RelationshipMemory {
  id: string
  source: string
  target: string
  type: string
  detail: string
}
export interface StoryMemory {
  world: WorldMemory[]
  locations: LocationMemory[]
  characters: CharacterMemory[]
  relationships: RelationshipMemory[]
}
export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}
export interface WritingProject {
  id: string
  title: string
  genre: string
  synopsis: string
  world: string
  characters: string
  timeline: string
  outline: string
  memory: StoryMemory
  assistantMessages: AssistantMessage[]
  chapters: WritingChapter[]
}

export interface WritingState {
  projects: WritingProject[]
  activeProjectId: string
  activeChapterId: string
  selectedModel: WritingModelSelection | null
  selection: TextSelection | null
  assistantDraft: string
  mode: WritingMode
  instruction: string
  preview: string
  previewMode: WritingMode | null
  previewRange: TextRange | null
  generating: boolean
  error: string | null
}

type ProjectField = 'title' | 'genre' | 'synopsis' | 'world' | 'characters' | 'timeline' | 'outline'
type ChapterField = 'title' | 'summary' | 'content'

function emptyMemory(): StoryMemory { return { world: [], locations: [], characters: [], relationships: [] } }
function emptyProject(index = 1): WritingProject {
  const projectId = `project-${index}`
  return {
    id: projectId, title: index === 1 ? '未命名作品' : `未命名作品 ${index}`,
    genre: '', synopsis: '', world: '', characters: '', timeline: '', outline: '', memory: emptyMemory(), assistantMessages: [],
    chapters: [{ id: `${projectId}-chapter-1`, title: '第一章', summary: '', content: '' }],
  }
}

type LegacyProject = Omit<WritingProject, 'memory' | 'assistantMessages'>
  & Partial<Pick<WritingProject, 'memory' | 'assistantMessages'>>
type LegacyWritingState = Partial<Omit<WritingState, 'projects'>> & { projects?: LegacyProject[] }

function initialWritingState(initial: WritingProject): WritingState {
  const fallback: WritingState = {
    projects: [initial],
    activeProjectId: initial.id,
    activeChapterId: initial.chapters[0]?.id ?? '',
    selectedModel: null,
    selection: null,
    assistantDraft: '',
    mode: 'continue',
    instruction: '',
    preview: '',
    previewMode: null,
    previewRange: null,
    generating: false,
    error: null,
  }
  if (typeof localStorage === 'undefined' || localStorage.getItem('dsh.writing.projects.v2') !== null) return fallback
  try {
    const raw = localStorage.getItem('dsh.writing.projects.v1')
    if (raw === null) return fallback
    const legacy = JSON.parse(raw) as LegacyWritingState
    if (!Array.isArray(legacy.projects) || legacy.projects.length === 0) return fallback
    const projects = legacy.projects.map(project => ({
      ...project,
      memory: project.memory ?? emptyMemory(),
      assistantMessages: project.assistantMessages ?? [],
    }))
    return {
      ...fallback,
      ...legacy,
      projects,
      selection: null,
      assistantDraft: '',
      previewRange: null,
      generating: false,
    }
  } catch {
    return fallback
  }
}
function activeProject(state: WritingState): WritingProject | undefined {
  return state.projects.find(project => project.id === state.activeProjectId)
}
function activeChapter(state: WritingState): WritingChapter | undefined {
  return activeProject(state)?.chapters.find(chapter => chapter.id === state.activeChapterId)
}
function memoryItem(kind: MemoryKind, index: number): WorldMemory | LocationMemory | CharacterMemory | RelationshipMemory {
  const id = `${kind}-${Date.now()}-${index}`
  if (kind === 'world') return { id, title: '', detail: '' }
  if (kind === 'locations') return { id, name: '', detail: '', connections: '' }
  if (kind === 'characters') return { id, name: '', identity: '', traits: '', goal: '' }
  return { id, source: '', target: '', type: '', detail: '' }
}

type WritingActions = {
  newProject: (draft: WritingState) => void
  selectProject: (draft: WritingState, id: string) => void
  updateProject: (draft: WritingState, field: ProjectField, value: string) => void
  addChapter: (draft: WritingState) => void
  selectChapter: (draft: WritingState, id: string) => void
  updateChapter: (draft: WritingState, field: ChapterField, value: string) => void
  selectModel: (draft: WritingState, provider: string, model: string) => void
  setSelection: (draft: WritingState, start: number, end: number, text: string) => void
  clearSelection: (draft: WritingState) => void
  setAssistantDraft: (draft: WritingState, value: string) => void
  addAssistantMessage: (draft: WritingState, role: AssistantMessage['role'], content: string) => void
  addMemoryItem: (draft: WritingState, kind: MemoryKind) => void
  updateMemoryItem: (draft: WritingState, kind: MemoryKind, id: string, field: string, value: string) => void
  removeMemoryItem: (draft: WritingState, kind: MemoryKind, id: string) => void
  setMode: (draft: WritingState, mode: WritingMode) => void
  setInstruction: (draft: WritingState, value: string) => void
  setGenerating: (draft: WritingState, value: boolean) => void
  setError: (draft: WritingState, value: string | null) => void
  setPreview: (draft: WritingState, text: string, mode: WritingMode, range?: TextRange | null) => void
  clearPreview: (draft: WritingState) => void
  acceptPreview: (draft: WritingState) => void
}

/** Create the persisted, local-first writing workspace store. */
export function createWritingStore(): EngineStoreHandle<WritingState, WritingActions> {
  const initial = emptyProject()
  return defineStore({
    persist: 'dsh.writing.projects.v2',
    init: (): WritingState => initialWritingState(initial),
    actions: {
      newProject: (draft) => {
        const project = emptyProject(draft.projects.length + 1); draft.projects.push(project)
        draft.activeProjectId = project.id; draft.activeChapterId = project.chapters[0]?.id ?? ''; draft.selection = null
        draft.preview = ''; draft.previewMode = null; draft.previewRange = null
      },
      selectProject: (draft, id) => {
        const project = draft.projects.find(candidate => candidate.id === id); if (project === undefined) return
        draft.activeProjectId = id; draft.activeChapterId = project.chapters[0]?.id ?? ''; draft.selection = null
        draft.preview = ''; draft.previewMode = null; draft.previewRange = null
      },
      updateProject: (draft, field, value) => { const project = activeProject(draft); if (project !== undefined) project[field] = value },
      addChapter: (draft) => {
        const project = activeProject(draft); if (project === undefined) return
        const number = project.chapters.length + 1; const chapter = { id: `${project.id}-chapter-${number}`, title: `第${number}章`, summary: '', content: '' }
        project.chapters.push(chapter); draft.activeChapterId = chapter.id; draft.selection = null; draft.preview = ''; draft.previewMode = null; draft.previewRange = null
      },
      selectChapter: (draft, id) => {
        if (activeProject(draft)?.chapters.some(chapter => chapter.id === id) !== true) return
        draft.activeChapterId = id; draft.selection = null; draft.preview = ''; draft.previewMode = null; draft.previewRange = null
      },
      updateChapter: (draft, field, value) => { const chapter = activeChapter(draft); if (chapter !== undefined) chapter[field] = value },
      selectModel: (draft, provider, model) => { draft.selectedModel = { provider, model } },
      setSelection: (draft, start, end, text) => { draft.selection = start < end && text !== '' ? { start, end, text } : null },
      clearSelection: (draft) => { draft.selection = null }, setAssistantDraft: (draft, value) => { draft.assistantDraft = value },
      addAssistantMessage: (draft, role, content) => {
        const project = activeProject(draft); if (project === undefined || content.trim() === '') return
        project.assistantMessages.push({ id: `message-${Date.now()}-${project.assistantMessages.length}`, role, content: content.trim() })
      },
      addMemoryItem: (draft, kind) => {
        const project = activeProject(draft); if (project === undefined) return
        const list = project.memory[kind] as unknown as Array<Record<string, string>>
        list.push(memoryItem(kind, list.length) as unknown as Record<string, string>)
      },
      updateMemoryItem: (draft, kind, id, field, value) => {
        const project = activeProject(draft); if (project === undefined) return
        const item = (project.memory[kind] as unknown as Array<Record<string, string>>).find(candidate => candidate.id === id)
        if (item !== undefined && field !== 'id' && Object.hasOwn(item, field)) item[field] = value
      },
      removeMemoryItem: (draft, kind, id) => {
        const project = activeProject(draft); if (project === undefined) return
        const list = project.memory[kind] as unknown as Array<Record<string, string>>
        const index = list.findIndex(item => item.id === id)
        if (index >= 0) list.splice(index, 1)
      },
      setMode: (draft, mode) => { draft.mode = mode }, setInstruction: (draft, value) => { draft.instruction = value },
      setGenerating: (draft, value) => { draft.generating = value }, setError: (draft, value) => { draft.error = value },
      setPreview: (draft, text, mode, range = null) => {
        draft.preview = text
        draft.previewMode = mode
        draft.previewRange = range
        draft.error = null
      },
      clearPreview: (draft) => { draft.preview = ''; draft.previewMode = null; draft.previewRange = null },
      acceptPreview: (draft) => {
        const chapter = activeChapter(draft); if (chapter === undefined || draft.preview === '' || draft.previewMode === 'check') return
        if (draft.previewRange !== null && draft.previewRange.start >= 0 && draft.previewRange.end <= chapter.content.length) {
          chapter.content = `${chapter.content.slice(0, draft.previewRange.start)}${draft.preview.trim()}${chapter.content.slice(draft.previewRange.end)}`
        } else {
          chapter.content = draft.previewMode === 'continue' && chapter.content.trim() !== '' ? `${chapter.content.trimEnd()}\n\n${draft.preview.trim()}` : draft.preview.trim()
        }
        draft.selection = null; draft.preview = ''; draft.previewMode = null; draft.previewRange = null
      },
    },
  })
}

const MODE_INSTRUCTION: Record<WritingMode, string> = {
  continue: '续写当前章节，保持人物、视角、语气和既有事实一致。', rewrite: '按用户要求改写指定选段；如果没有选段，则改写当前章节。只输出改写正文。',
  polish: '润色指定选段；如果没有选段，则润色当前章节。改善节奏、措辞和画面，但不得改动情节事实。',
  check: '检查人物、时间线、设定与伏笔冲突。只输出问题清单；没有硬冲突时明确写“未发现硬冲突”。',
}
export function countWritingCharacters(text: string): number { return text.replace(/\s/g, '').length }

function structuredMemory(project: WritingProject, query: string): string {
  const memory = project.memory
  const records = [
    ...memory.world.map(item => `世界观｜${item.title}｜${item.detail}`),
    ...memory.locations.map(item => `地点｜${item.name}｜${item.detail}｜相连：${item.connections}`),
    ...memory.characters.map(item => `人物｜${item.name}｜身份：${item.identity}｜特征：${item.traits}｜目标：${item.goal}`),
    ...memory.relationships.map(item => `关系｜${item.source} → ${item.target}｜${item.type}｜${item.detail}`),
  ].filter(record => record.replace(/[｜：→]/g, '').trim() !== '')
  const terms = query.toLocaleLowerCase().split(/[\s，。！？、：；“”‘’（）()]+/).filter(term => term.length >= 2)
  const relevant = records.filter(record => terms.length === 0 || terms.some(term => record.toLocaleLowerCase().includes(term)))
  return (relevant.length > 0 ? relevant : records.slice(0, 12)).join('\n').slice(0, 4_000)
}
function storyContext(project: WritingProject, query: string): string {
  return [`作品：${project.title}\n类型：${project.genre}\n故事梗概：${project.synopsis}`, `结构化记忆：\n${structuredMemory(project, query)}`,
    `故事设定（补充笔记）：\n${project.world}`,
    `补充人物笔记：\n${project.characters}`,
    `时间线：\n${project.timeline}`,
    `全书大纲：\n${project.outline}`,
  ].join('\n\n')
}
/** Build a bounded model prompt from story memory and an optional selected passage. */
export function buildWritingPrompt(
  project: WritingProject,
  chapter: WritingChapter,
  mode: WritingMode,
  instruction: string,
  selection?: TextSelection | null,
): string {
  return ['你是 DeepSeek Harness 写作工作台中的中文小说写作助手。', '第一责任是尊重已经确认的故事记忆，不得默默覆盖人物设定、时间线和既有事实。',
    MODE_INSTRUCTION[mode], '只输出可直接使用的中文结果，不解释工作过程。', `用户要求：${instruction.trim() || '按当前模式处理本章'}`,
    storyContext(project, `${instruction} ${selection?.text ?? ''}`), selection == null ? '' : `本次选中的原文：\n${selection.text}`,
    `当前章节：${chapter.title}\n章节摘要：${chapter.summary}\n当前正文：\n${chapter.content}`].filter(Boolean).join('\n\n').slice(0, 16_000)
}
/** Build a bounded multi-turn assistant prompt with relevant project memory. */
export function buildAssistantPrompt(
  project: WritingProject,
  chapter: WritingChapter,
  messages: AssistantMessage[],
  message: string,
  quote: string,
): string {
  const history = messages.slice(-10).map(item => `${item.role === 'user' ? '作者' : '助手'}：${item.content}`).join('\n')
  return ['你是中文长篇小说的协作写作助手。与作者讨论并给出可执行的修改建议，不得擅自改稿。', '回答必须遵守已确认的作品记忆；发现冲突时先指出冲突。',
    storyContext(project, `${message} ${quote}`), `当前章节：${chapter.title}\n章节摘要：${chapter.summary}\n当前正文：\n${chapter.content}`,
    quote === '' ? '' : `作者引用的原文：\n${quote}`, history === '' ? '' : `最近对话：\n${history}`, `作者的新消息：${message}`].filter(Boolean).join('\n\n').slice(0, 16_000)
}
/** Serialize one writing project as a portable Markdown manuscript. */
export function projectMarkdown(project: WritingProject): string {
  const meta = [`# ${project.title}`, project.genre === '' ? '' : `> 类型：${project.genre}`, project.synopsis === '' ? '' : `## 故事梗概\n\n${project.synopsis}`,
    project.outline === '' ? '' : `## 全书大纲\n\n${project.outline}`].filter(Boolean)
  const chapters = project.chapters.map(chapter => `## ${chapter.title}\n\n${chapter.content.trim()}\n`)
  return `${[...meta, ...chapters].join('\n\n')}\n`
}
