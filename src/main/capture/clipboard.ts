import { clipboard } from 'electron'

export function readClipboardText(): string {
  return clipboard.readText().trim()
}

export function readClipboardImage(): string | null {
  const image = clipboard.readImage()
  if (image.isEmpty()) return null
  return image.toDataURL()
}
