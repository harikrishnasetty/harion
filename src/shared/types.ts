export type ItemKind =
  | 'todo'
  | 'reminder'
  | 'knowledge'
  | 'idea'
  | 'contact'
  | 'link'
  | 'note'

export type ItemStatus = 'inbox' | 'active' | 'done' | 'archived'

export type Priority = 'low' | 'medium' | 'high'

export type CaptureSource =
  | 'text'
  | 'clipboard'
  | 'screenshot'
  | 'drop'
  | 'manual'

export interface Classification {
  kind: ItemKind
  title: string
  summary: string
  tags: string[]
  priority: Priority
  dueAt: string | null
  confidence: number
  entities: Record<string, string[]>
  suggestedActions: string[]
}

export interface Item {
  id: number
  kind: ItemKind
  title: string
  body: string
  tags: string[]
  priority: Priority
  dueAt: string | null
  status: ItemStatus
  source: CaptureSource
  sourceMeta: Record<string, unknown> | null
  confidence: number | null
  aiRaw: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface Attachment {
  id: number
  itemId: number
  kind: 'image' | 'file' | 'link'
  path: string
  mime: string | null
  size: number | null
  createdAt: string
}

export interface ItemDetail {
  item: Item
  attachments: Attachment[]
}

export interface CaptureInput {
  text: string
  source: CaptureSource
  sourceMeta?: Record<string, unknown>
  imageDataUrl?: string
  skipAi?: boolean
}

export interface ItemFilter {
  query?: string
  kind?: ItemKind | 'all'
  status?: ItemStatus | 'all'
  limit?: number
  offset?: number
}

export interface ItemPatch {
  kind?: ItemKind
  title?: string
  body?: string
  tags?: string[]
  priority?: Priority
  dueAt?: string | null
  status?: ItemStatus
}

export interface KindStat {
  kind: ItemKind
  count: number
}

export interface Stats {
  total: number
  inbox: number
  dueSoon: number
  byKind: KindStat[]
}

export interface Settings {
  ollamaUrl: string
  ollamaModel: string
  aiEnabled: boolean
  orbPosition: { x: number; y: number } | null
  orbVisible: boolean
  launchOnStartup: boolean
  hotkeys: {
    quickCapture: string
    clipboardCapture: string
    screenshot: string
    toggleMain: string
  }
}

export interface AiStatus {
  enabled: boolean
  reachable: boolean
  model: string
  models: string[]
  message: string
}

export const DEFAULT_SETTINGS: Settings = {
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'llama3.2',
  aiEnabled: true,
  orbPosition: null,
  orbVisible: true,
  launchOnStartup: false,
  hotkeys: {
    quickCapture: 'CommandOrControl+Shift+Space',
    clipboardCapture: 'CommandOrControl+Shift+V',
    screenshot: 'CommandOrControl+Shift+S',
    toggleMain: 'CommandOrControl+Shift+N'
  }
}

export const KIND_META: Record<
  ItemKind,
  { label: string; icon: string; accent: string }
> = {
  todo: { label: 'To-Do', icon: 'check', accent: '#22d3ee' },
  reminder: { label: 'Reminder', icon: 'bell', accent: '#f59e0b' },
  knowledge: { label: 'Knowledge', icon: 'book', accent: '#34d399' },
  idea: { label: 'Idea', icon: 'spark', accent: '#f472b6' },
  contact: { label: 'Contact', icon: 'user', accent: '#60a5fa' },
  link: { label: 'Link', icon: 'link', accent: '#a855f7' },
  note: { label: 'Note', icon: 'note', accent: '#94a3b8' }
}
