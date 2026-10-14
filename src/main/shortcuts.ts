import { globalShortcut } from 'electron'
import type { Settings } from '@shared/types'
import { createLogger } from './util/logger'

const log = createLogger('shortcuts')

export interface ShortcutActions {
  quickCapture: () => void
  clipboardCapture: () => void
  screenshot: () => void
  toggleMain: () => void
}

export function registerShortcuts(settings: Settings, actions: ShortcutActions): void {
  globalShortcut.unregisterAll()

  const bindings: [string, () => void][] = [
    [settings.hotkeys.quickCapture, actions.quickCapture],
    [settings.hotkeys.clipboardCapture, actions.clipboardCapture],
    [settings.hotkeys.screenshot, actions.screenshot],
    [settings.hotkeys.toggleMain, actions.toggleMain]
  ]

  for (const [accelerator, handler] of bindings) {
    if (!accelerator) continue
    try {
      const ok = globalShortcut.register(accelerator, handler)
      if (!ok) log.warn('could not register hotkey (already in use?):', accelerator)
    } catch (err) {
      log.warn('invalid accelerator:', accelerator, (err as Error).message)
    }
  }
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
