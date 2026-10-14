import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AiStatus,
  CaptureInput,
  Classification,
  Item,
  ItemDetail,
  ItemFilter,
  ItemPatch,
  Settings,
  Stats
} from '@shared/types'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ToastPayload {
  message: string
  kind?: 'info' | 'success' | 'error' | 'reminder'
}

export interface ScreenshotImage {
  dataUrl: string
  logicalWidth: number
  logicalHeight: number
}

export interface MainCommand {
  command: string
  id?: number
  query?: string
}

type Unsubscribe = () => void

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api = {
  capture: {
    submit: (input: CaptureInput): Promise<ItemDetail> =>
      ipcRenderer.invoke(IPC.captureSubmit, input),
    clipboard: (): Promise<boolean> => ipcRenderer.invoke(IPC.captureClipboard)
  },
  items: {
    list: (filter: ItemFilter = {}): Promise<Item[]> =>
      ipcRenderer.invoke(IPC.itemsList, filter),
    get: (id: number): Promise<ItemDetail | null> => ipcRenderer.invoke(IPC.itemsGet, id),
    stats: (): Promise<Stats> => ipcRenderer.invoke(IPC.itemsStats),
    update: (id: number, patch: ItemPatch): Promise<Item | null> =>
      ipcRenderer.invoke(IPC.itemsUpdate, id, patch),
    remove: (id: number): Promise<boolean> => ipcRenderer.invoke(IPC.itemsDelete, id),
    complete: (id: number, done: boolean): Promise<Item | null> =>
      ipcRenderer.invoke(IPC.itemsComplete, id, done)
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch: Partial<Settings>): Promise<Settings> =>
      ipcRenderer.invoke(IPC.settingsSet, patch)
  },
  ai: {
    status: (): Promise<AiStatus> => ipcRenderer.invoke(IPC.aiStatus),
    classify: (text: string): Promise<{ classification: Classification; aiUsed: boolean }> =>
      ipcRenderer.invoke(IPC.aiClassify, text),
    recheck: (id: number): Promise<Item | null> => ipcRenderer.invoke(IPC.aiRecheck, id)
  },
  orb: {
    setExpanded: (expanded: boolean): Promise<boolean> =>
      ipcRenderer.invoke(IPC.windowResizeOrb, expanded),
    collapse: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowCollapseOrb),
    openMain: (command?: Record<string, unknown>): Promise<boolean> =>
      ipcRenderer.invoke(IPC.windowOpenMain, command),
    hide: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowHideOrb),
    show: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowShowOrb)
  },
  window: {
    command: (command: 'minimize' | 'maximize' | 'close'): Promise<boolean> =>
      ipcRenderer.invoke(IPC.windowMainCommand, command),
    closeSelf: (): Promise<boolean> => ipcRenderer.invoke(IPC.windowCloseSelf)
  },
  screenshot: {
    begin: (): Promise<boolean> => ipcRenderer.invoke(IPC.screenshotBegin),
    getImage: (): Promise<ScreenshotImage | null> => ipcRenderer.invoke(IPC.screenshotGetImage),
    complete: (rect: Rect): Promise<ItemDetail | null> =>
      ipcRenderer.invoke(IPC.screenshotComplete, rect),
    cancel: (): Promise<boolean> => ipcRenderer.invoke(IPC.screenshotCancel)
  },
  app: {
    quit: (): Promise<boolean> => ipcRenderer.invoke(IPC.appQuit)
  },
  events: {
    onItemsChanged: (cb: (payload: unknown) => void): Unsubscribe =>
      subscribe(IPC.itemsChanged, cb),
    onToast: (cb: (payload: ToastPayload) => void): Unsubscribe => subscribe(IPC.toast, cb),
    onOrbitFocus: (cb: () => void): Unsubscribe =>
      subscribe(IPC.orbitFocusCapture, () => cb()),
    onMainCommand: (cb: (payload: MainCommand) => void): Unsubscribe =>
      subscribe(IPC.windowMainCommand, cb)
  }
}

export type HarionApi = typeof api

contextBridge.exposeInMainWorld('harion', api)
