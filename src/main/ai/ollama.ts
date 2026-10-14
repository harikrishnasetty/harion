import type { Classification, ItemKind, Priority, Settings } from '@shared/types'
import { createLogger } from '../util/logger'

const log = createLogger('ollama')

const KINDS: ItemKind[] = ['todo', 'reminder', 'knowledge', 'idea', 'contact', 'link', 'note']
const PRIORITIES: Priority[] = ['low', 'medium', 'high']

export interface OllamaStatus {
  reachable: boolean
  models: string[]
  message: string
}

export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

export async function ollamaStatus(url: string, timeoutMs = 2000): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${normalizeUrl(url)}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!res.ok) {
      return { reachable: false, models: [], message: `HTTP ${res.status}` }
    }
    const data = (await res.json()) as { models?: { name: string }[] }
    const models = (data.models ?? []).map((m) => m.name)
    return { reachable: true, models, message: 'ok' }
  } catch (err) {
    return { reachable: false, models: [], message: (err as Error).message }
  }
}

function buildSystemPrompt(now: Date): string {
  const offsetMin = -now.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const offset = `${sign}${String(Math.floor(absMin / 60)).padStart(2, '0')}:${String(
    absMin % 60
  ).padStart(2, '0')}`
  return [
    'You are the classification engine for a personal capture assistant called Harion.',
    'The user dumps an unstructured thought. You file it.',
    'Respond with ONLY a JSON object, no prose, with exactly these keys:',
    '{',
    '  "kind": one of ["todo","reminder","knowledge","idea","contact","link","note"],',
    '  "title": short 3-8 word headline (no trailing period),',
    '  "summary": one-sentence clean restatement of the item,',
    '  "tags": array of 1-5 short lowercase topic tags,',
    '  "priority": one of ["low","medium","high"],',
    '  "dueAt": ISO-8601 datetime string if a date/time is implied or stated, else null,',
    '  "confidence": number between 0 and 1,',
    '  "entities": object mapping entity types to arrays, e.g. {"url":[],"email":[],"person":[],"date":[]},',
    '  "suggestedActions": array of 0-3 short imperative next steps',
    '}',
    `Current local time: ${now.toISOString()} (UTC offset ${offset}).`,
    'Resolve relative dates ("tomorrow", "next friday", "at 5pm") against the current local time.',
    'Guidance for "kind":',
    '- reminder: something to be alerted about at a time (has a due date/time).',
    '- todo: an actionable task, often without a strict time.',
    '- knowledge: a fact, definition, reference, or "how to".',
    '- idea: a concept, brainstorm, or "what if".',
    '- contact: a person with contact details or a person-centric note.',
    '- link: primarily a URL or resource bookmark.',
    '- note: anything else.'
  ].join('\n')
}

interface RawResult {
  kind?: unknown
  title?: unknown
  summary?: unknown
  tags?: unknown
  priority?: unknown
  dueAt?: unknown
  confidence?: unknown
  entities?: unknown
  suggestedActions?: unknown
}

function asStringArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max)
}

function asEntities(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const arr = asStringArray(v, 20)
    if (arr.length) out[k] = arr
  }
  return out
}

function parseDueAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function coerceClassification(raw: RawResult): Classification {
  const kind = KINDS.includes(raw.kind as ItemKind) ? (raw.kind as ItemKind) : 'note'
  const priority = PRIORITIES.includes(raw.priority as Priority)
    ? (raw.priority as Priority)
    : 'medium'
  let confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.7
  if (confidence > 1) confidence = confidence / 100
  confidence = Math.min(Math.max(confidence, 0), 1)
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim().slice(0, 120)
      : 'Untitled'
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : ''
  return {
    kind,
    title,
    summary,
    tags: asStringArray(raw.tags).map((t) => t.toLowerCase()),
    priority,
    dueAt: parseDueAt(raw.dueAt),
    confidence,
    entities: asEntities(raw.entities),
    suggestedActions: asStringArray(raw.suggestedActions, 3)
  }
}

export async function ollamaClassify(
  text: string,
  settings: Settings
): Promise<Classification | null> {
  const url = normalizeUrl(settings.ollamaUrl)
  const body = {
    model: settings.ollamaModel,
    stream: false,
    format: 'json',
    options: { temperature: 0.2 },
    messages: [
      { role: 'system', content: buildSystemPrompt(new Date()) },
      { role: 'user', content: text }
    ]
  }

  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000)
  })

  if (!res.ok) {
    log.warn('chat request failed', res.status, res.statusText)
    return null
  }

  const data = (await res.json()) as { message?: { content?: string } }
  const content = data.message?.content
  if (!content) {
    log.warn('empty completion')
    return null
  }

  try {
    return coerceClassification(JSON.parse(content) as RawResult)
  } catch (err) {
    log.warn('failed to parse model JSON', (err as Error).message)
    return null
  }
}
