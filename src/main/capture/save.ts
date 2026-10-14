import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { attachmentsDir } from '../util/paths'

export interface SavedImage {
  path: string
  mime: string
  size: number
}

export function saveDataUrlImage(dataUrl: string, prefix = 'shot'): SavedImage | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s)
  if (!match) return null
  const mime = match[1]
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
  const buffer = Buffer.from(match[2], 'base64')
  const name = `${prefix}-${Date.now()}.${ext}`
  const full = join(attachmentsDir(), name)
  writeFileSync(full, buffer)
  return { path: full, mime, size: buffer.length }
}
