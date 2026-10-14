import { IPC } from '@shared/ipc'
import type { CaptureInput, Classification, ItemDetail } from '@shared/types'
import { classifyText } from '../ai/classify'
import { addAttachment, createItem, getItem } from '../db/items'
import { getSettings } from '../db/settings'
import { broadcast } from '../windows'
import { saveDataUrlImage } from './save'

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? text
  const cleaned = line.replace(/\s+/g, ' ').trim()
  return cleaned.length <= 72 ? cleaned : `${cleaned.slice(0, 69).trimEnd()}...`
}

function defaultTitle(input: CaptureInput): string {
  const stamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
  switch (input.source) {
    case 'screenshot':
      return `Screenshot ${stamp}`
    case 'clipboard':
      return `Clipboard capture ${stamp}`
    case 'drop':
      return `Dropped item ${stamp}`
    default:
      return `Capture ${stamp}`
  }
}

const EMPTY: Classification = {
  kind: 'note',
  title: '',
  summary: '',
  tags: [],
  priority: 'medium',
  dueAt: null,
  confidence: 0,
  entities: {},
  suggestedActions: []
}

export async function ingestCapture(input: CaptureInput): Promise<ItemDetail> {
  const settings = getSettings()
  const text = (input.text ?? '').trim()

  let classification: Classification = { ...EMPTY }
  let aiUsed = false

  if (!input.skipAi && text) {
    const result = await classifyText(text, settings)
    classification = result.classification
    aiUsed = result.aiUsed
  } else if (!text && input.imageDataUrl) {
    classification = { ...EMPTY, kind: 'knowledge' }
  }

  const item = createItem({
    kind: classification.kind,
    title: classification.title || (text ? firstLine(text) : defaultTitle(input)),
    body: text || classification.summary,
    tags: classification.tags,
    priority: classification.priority,
    dueAt: classification.dueAt,
    status: 'inbox',
    source: input.source,
    sourceMeta: {
      ...(input.sourceMeta ?? {}),
      aiUsed,
      entities: classification.entities,
      suggestedActions: classification.suggestedActions
    },
    confidence: classification.confidence
  })

  if (input.imageDataUrl) {
    const saved = saveDataUrlImage(input.imageDataUrl, 'shot')
    if (saved) addAttachment(item.id, 'image', saved.path, saved.mime, saved.size)
  }

  const detail = getItem(item.id)
  broadcast(IPC.itemsChanged, { reason: 'created', id: item.id })
  return detail ?? { item, attachments: [] }
}
