import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { CaptureInput, ItemFilter, ItemPatch, Settings } from '@shared/types'
import { classifyText, getAiStatus } from './ai/classify'
import { readClipboardImage, readClipboardText } from './capture/clipboard'
import { ingestCapture } from './capture/ingest'
import { captureDisplay, cropDataUrl, type DisplayCapture } from './capture/screenshot'
import * as items from './db/items'
import { getSettings, setSettings } from './db/settings'
import { createLogger } from './util/logger'
import {
  broadcast,
  closeOverlay,
  focusOrb,
  getOrb,
  openMain,
  openOverlayWindow,
  setOrbExpanded,
  setOrbVisible
} from './windows'

const log = createLogger('ipc')

let pending: DisplayCapture | null = null

export async function startScreenshot(): Promise<void> {
  const capture = await captureDisplay()
  if (!capture) {
    broadcast(IPC.toast, { message: 'Screen capture unavailable', kind: 'error' })
    return
  }
  setOrbExpanded(false)
  getOrb()?.hide()
  pending = capture
  openOverlayWindow()
}

function restoreOrb(): void {
  if (getSettings().orbVisible) getOrb()?.showInactive()
}

export async function captureClipboard(): Promise<void> {
  const text = readClipboardText()
  if (text) {
    const detail = await ingestCapture({ text, source: 'clipboard' })
    openMain({ command: 'open-item', id: detail.item.id })
    return
  }
  const image = readClipboardImage()
  if (image) {
    const detail = await ingestCapture({
      text: '',
      source: 'clipboard',
      imageDataUrl: image
    })
    openMain({ command: 'open-item', id: detail.item.id })
    return
  }
  broadcast(IPC.toast, { message: 'Clipboard is empty', kind: 'error' })
}

export interface IpcDeps {
  applySettings: (settings: Settings) => void
}

export function registerIpc(deps: IpcDeps): void {
  ipcMain.handle(IPC.captureSubmit, (_e, input: CaptureInput) => ingestCapture(input))
  ipcMain.handle(IPC.captureClipboard, async () => {
    setOrbExpanded(false)
    await captureClipboard()
    return true
  })

  ipcMain.handle(IPC.itemsList, (_e, filter: ItemFilter) => items.listItems(filter ?? {}))
  ipcMain.handle(IPC.itemsGet, (_e, id: number) => items.getItem(id))
  ipcMain.handle(IPC.itemsStats, () => items.stats())

  ipcMain.handle(IPC.itemsUpdate, (_e, id: number, patch: ItemPatch) => {
    const item = items.updateItem(id, patch)
    broadcast(IPC.itemsChanged, { reason: 'updated', id })
    return item
  })

  ipcMain.handle(IPC.itemsDelete, (_e, id: number) => {
    items.deleteItem(id)
    broadcast(IPC.itemsChanged, { reason: 'deleted', id })
    return true
  })

  ipcMain.handle(IPC.itemsComplete, (_e, id: number, done: boolean) => {
    const item = items.updateItem(id, { status: done ? 'done' : 'active' })
    broadcast(IPC.itemsChanged, { reason: 'completed', id })
    return item
  })

  ipcMain.handle(IPC.settingsGet, () => getSettings())
  ipcMain.handle(IPC.settingsSet, (_e, patch: Partial<Settings>) => {
    const next = setSettings(patch)
    deps.applySettings(next)
    return next
  })

  ipcMain.handle(IPC.aiStatus, () => getAiStatus(getSettings()))
  ipcMain.handle(IPC.aiClassify, (_e, text: string) => classifyText(text, getSettings()))
  ipcMain.handle(IPC.aiRecheck, async (_e, id: number) => {
    const detail = items.getItem(id)
    if (!detail) return null
    const text = detail.item.body || detail.item.title
    const { classification } = await classifyText(text, getSettings())
    const item = items.updateItem(id, {
      kind: classification.kind,
      title: classification.title || detail.item.title,
      tags: classification.tags,
      priority: classification.priority,
      dueAt: classification.dueAt
    })
    broadcast(IPC.itemsChanged, { reason: 'reclassified', id })
    return item
  })

  ipcMain.handle(IPC.windowResizeOrb, (_e, expanded: boolean) => {
    setOrbExpanded(expanded)
    return true
  })
  ipcMain.handle(IPC.windowCollapseOrb, () => {
    setOrbExpanded(false)
    return true
  })
  ipcMain.handle(IPC.windowOpenMain, (_e, command?: Record<string, unknown>) => {
    openMain(command)
    return true
  })
  ipcMain.handle(IPC.windowHideOrb, () => {
    setOrbVisible(false)
    return true
  })
  ipcMain.handle(IPC.windowShowOrb, () => {
    setOrbVisible(true)
    return true
  })
  ipcMain.handle(IPC.orbitFocusCapture, () => {
    focusOrb()
    return true
  })

  ipcMain.handle(IPC.windowMainCommand, (event, command: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (command === 'minimize') win.minimize()
    else if (command === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
    else if (command === 'close') win.close()
    return true
  })

  ipcMain.handle(IPC.windowCloseSelf, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
    return true
  })

  ipcMain.handle(IPC.screenshotBegin, async () => {
    await startScreenshot()
    return true
  })
  ipcMain.handle(IPC.screenshotGetImage, () =>
    pending
      ? {
          dataUrl: pending.dataUrl,
          logicalWidth: pending.logicalWidth,
          logicalHeight: pending.logicalHeight
        }
      : null
  )
  ipcMain.handle(IPC.screenshotComplete, async (_e, rect: DisplayRect) => {
    const capture = pending
    pending = null
    closeOverlay()
    restoreOrb()
    if (!capture) return null
    const scaleX = capture.imageWidth / capture.logicalWidth
    const scaleY = capture.imageHeight / capture.logicalHeight
    const cropped = cropDataUrl(capture.dataUrl, {
      x: rect.x * scaleX,
      y: rect.y * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY
    })
    if (!cropped) return null
    const detail = await ingestCapture({
      text: '',
      source: 'screenshot',
      imageDataUrl: cropped,
      sourceMeta: { displayId: capture.displayId }
    })
    openMain({ command: 'open-item', id: detail.item.id })
    return detail
  })
  ipcMain.handle(IPC.screenshotCancel, () => {
    pending = null
    closeOverlay()
    restoreOrb()
    return true
  })

  ipcMain.handle(IPC.appQuit, () => {
    app.quit()
    return true
  })
  ipcMain.handle(IPC.toast, (_e, payload: unknown) => {
    broadcast(IPC.toast, payload)
    return true
  })

  log.info('ipc handlers registered')
}

interface DisplayRect {
  x: number
  y: number
  width: number
  height: number
}
