import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function userDataDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function attachmentsDir(): string {
  const dir = join(userDataDir(), 'attachments')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function dbPath(): string {
  return join(userDataDir(), 'harion.db')
}

export function iconPath(file: string): string {
  return join(__dirname, '../../resources', file)
}

export function preloadPath(): string {
  const candidates = [
    join(__dirname, '../preload/index.js'),
    join(__dirname, '../preload/index.mjs'),
    join(__dirname, '../preload/index.cjs')
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

export function rendererIndexPath(): string {
  return join(__dirname, '../renderer/index.html')
}
