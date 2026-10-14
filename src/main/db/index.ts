import Database from 'better-sqlite3'
import { SCHEMA } from './schema'
import { dbPath } from '../util/paths'
import { createLogger } from '../util/logger'

const log = createLogger('db')
let db: Database.Database | null = null

export function initDb(): Database.Database {
  if (db) return db
  const file = dbPath()
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  log.info('database ready:', file)
  return db
}

export function getDb(): Database.Database {
  return db ?? initDb()
}

export function closeDb(): void {
  if (db) {
    try {
      db.close()
    } catch (err) {
      log.warn('close failed', err)
    }
    db = null
  }
}
