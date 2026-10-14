import { getDb } from './index'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'

const KEY = 'app'

function safeParse(value: string): Partial<Settings> {
  try {
    return JSON.parse(value) as Partial<Settings>
  } catch {
    return {}
  }
}

function merge(base: Settings, patch: Partial<Settings>): Settings {
  return {
    ...base,
    ...patch,
    hotkeys: { ...base.hotkeys, ...(patch.hotkeys ?? {}) },
    orbPosition: patch.orbPosition !== undefined ? patch.orbPosition : base.orbPosition
  }
}

export function getSettings(): Settings {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as
    | { value: string }
    | undefined
  if (!row) return structuredClone(DEFAULT_SETTINGS)
  return merge(structuredClone(DEFAULT_SETTINGS), safeParse(row.value))
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = merge(getSettings(), patch)
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(KEY, JSON.stringify(next))
  return next
}
