import { getDb } from './index'
import type {
  Attachment,
  CaptureSource,
  Item,
  ItemDetail,
  ItemFilter,
  ItemKind,
  ItemPatch,
  ItemStatus,
  Priority,
  Stats
} from '@shared/types'

interface ItemRow {
  id: number
  kind: string
  title: string
  body: string
  tags: string
  priority: string
  due_at: string | null
  status: string
  source: string
  source_meta: string | null
  confidence: number | null
  ai_raw: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface AttachRow {
  id: number
  item_id: number
  kind: string
  path: string
  mime: string | null
  size: number | null
  created_at: string
}

export interface NewItem {
  kind: ItemKind
  title: string
  body: string
  tags: string[]
  priority: Priority
  dueAt: string | null
  status: ItemStatus
  source: CaptureSource
  sourceMeta?: Record<string, unknown> | null
  confidence?: number | null
  aiRaw?: string | null
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (value == null) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    kind: row.kind as ItemKind,
    title: row.title,
    body: row.body,
    tags: safeParse<string[]>(row.tags, []),
    priority: row.priority as Priority,
    dueAt: row.due_at,
    status: row.status as ItemStatus,
    source: row.source as CaptureSource,
    sourceMeta: safeParse<Record<string, unknown> | null>(row.source_meta, null),
    confidence: row.confidence,
    aiRaw: row.ai_raw,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  }
}

function mapAttachment(row: AttachRow): Attachment {
  return {
    id: row.id,
    itemId: row.item_id,
    kind: row.kind as Attachment['kind'],
    path: row.path,
    mime: row.mime,
    size: row.size,
    createdAt: row.created_at
  }
}

export function createItem(input: NewItem): Item {
  const now = new Date().toISOString()
  const info = getDb()
    .prepare(
      `INSERT INTO items
        (kind, title, body, tags, priority, due_at, status, source, source_meta, confidence, ai_raw, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.kind,
      input.title,
      input.body,
      JSON.stringify(input.tags ?? []),
      input.priority,
      input.dueAt,
      input.status,
      input.source,
      input.sourceMeta ? JSON.stringify(input.sourceMeta) : null,
      input.confidence ?? null,
      input.aiRaw ?? null,
      now,
      now
    )
  return getItemById(Number(info.lastInsertRowid)) as Item
}

export function getItemRow(id: number): ItemRow | undefined {
  return getDb().prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined
}

export function getItemById(id: number): Item | null {
  const row = getItemRow(id)
  return row ? mapItem(row) : null
}

export function getItem(id: number): ItemDetail | null {
  const item = getItemById(id)
  if (!item) return null
  return { item, attachments: getAttachments(id) }
}

export function getAttachments(itemId: number): Attachment[] {
  const rows = getDb()
    .prepare('SELECT * FROM attachments WHERE item_id = ? ORDER BY id ASC')
    .all(itemId) as AttachRow[]
  return rows.map(mapAttachment)
}

export function getAttachmentById(id: number): Attachment | null {
  const row = getDb().prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
    | AttachRow
    | undefined
  return row ? mapAttachment(row) : null
}

export function addAttachment(
  itemId: number,
  kind: Attachment['kind'],
  path: string,
  mime: string | null = null,
  size: number | null = null
): Attachment {
  const info = getDb()
    .prepare(
      'INSERT INTO attachments (item_id, kind, path, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(itemId, kind, path, mime, size, new Date().toISOString())
  const row = getDb()
    .prepare('SELECT * FROM attachments WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as AttachRow
  return mapAttachment(row)
}

export function listItems(filter: ItemFilter = {}): Item[] {
  const clauses: string[] = []
  const params: unknown[] = []

  if (filter.kind && filter.kind !== 'all') {
    clauses.push('kind = ?')
    params.push(filter.kind)
  }

  if (filter.status && filter.status !== 'all') {
    if (filter.status === 'inbox') {
      clauses.push("status IN ('inbox', 'active')")
    } else {
      clauses.push('status = ?')
      params.push(filter.status)
    }
  }

  if (filter.query && filter.query.trim()) {
    clauses.push('(title LIKE ? OR body LIKE ? OR tags LIKE ?)')
    const q = `%${filter.query.trim()}%`
    params.push(q, q, q)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000)
  const offset = Math.max(filter.offset ?? 0, 0)

  const sql = `
    SELECT * FROM items
    ${where}
    ORDER BY
      CASE WHEN due_at IS NOT NULL AND status NOT IN ('done', 'archived') THEN 0 ELSE 1 END,
      due_at ASC,
      created_at DESC
    LIMIT ? OFFSET ?`

  const rows = getDb().prepare(sql).all(...params, limit, offset) as ItemRow[]
  return rows.map(mapItem)
}

export function updateItem(id: number, patch: ItemPatch): Item | null {
  const current = getItemRow(id)
  if (!current) return null

  const fields: string[] = []
  const params: unknown[] = []

  const set = (col: string, value: unknown): void => {
    fields.push(`${col} = ?`)
    params.push(value)
  }

  if (patch.kind !== undefined) set('kind', patch.kind)
  if (patch.title !== undefined) set('title', patch.title)
  if (patch.body !== undefined) set('body', patch.body)
  if (patch.tags !== undefined) set('tags', JSON.stringify(patch.tags))
  if (patch.priority !== undefined) set('priority', patch.priority)
  if (patch.dueAt !== undefined) set('due_at', patch.dueAt)
  if (patch.status !== undefined) {
    set('status', patch.status)
    set('completed_at', patch.status === 'done' ? new Date().toISOString() : null)
  }

  if (!fields.length) return getItemById(id)

  set('updated_at', new Date().toISOString())
  params.push(id)
  getDb().prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  return getItemById(id)
}

export function deleteItem(id: number): void {
  getDb().prepare('DELETE FROM items WHERE id = ?').run(id)
}

export function stats(): Stats {
  const db = getDb()
  const now = new Date()
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const total = (db
    .prepare("SELECT COUNT(*) AS c FROM items WHERE status != 'archived'")
    .get() as { c: number }).c
  const inbox = (db
    .prepare("SELECT COUNT(*) AS c FROM items WHERE status IN ('inbox', 'active')")
    .get() as { c: number }).c
  const dueSoon = (db
    .prepare(
      "SELECT COUNT(*) AS c FROM items WHERE status NOT IN ('done', 'archived') AND due_at IS NOT NULL AND due_at <= ?"
    )
    .get(soon) as { c: number }).c

  const kindRows = db
    .prepare(
      "SELECT kind, COUNT(*) AS c FROM items WHERE status != 'archived' GROUP BY kind"
    )
    .all() as { kind: string; c: number }[]

  return {
    total,
    inbox,
    dueSoon,
    byKind: kindRows.map((r) => ({ kind: r.kind as ItemKind, count: r.c }))
  }
}

export function dueReminders(nowIso: string): Item[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM items
       WHERE due_at IS NOT NULL
         AND due_at <= ?
         AND status NOT IN ('done', 'archived')
         AND id NOT IN (SELECT item_id FROM reminders_log)`
    )
    .all(nowIso) as ItemRow[]
  return rows.map(mapItem)
}

export function markReminderFired(itemId: number): void {
  getDb()
    .prepare(
      'INSERT INTO reminders_log (item_id, fired_at) VALUES (?, ?) ON CONFLICT(item_id) DO NOTHING'
    )
    .run(itemId, new Date().toISOString())
}
