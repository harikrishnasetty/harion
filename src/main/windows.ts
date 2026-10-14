import { BrowserWindow, screen, shell } from 'electron'
import { IPC } from '@shared/ipc'
import { getSettings, setSettings } from './db/settings'
import { createLogger } from './util/logger'
import { iconPath, preloadPath, rendererIndexPath } from './util/paths'

const log = createLogger('windows')

const ORB_SIZE = 172
const ORB_EXPANDED_SIZE = { width: 480, height: 620 }
const ORB_MARGIN = 22

let orbWin: BrowserWindow | null = null
let mainWin: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let suppressOrbMove = false

function baseWebPreferences(): Electron.WebPreferences {
  return {
    preload: preloadPath(),
    sandbox: false,
    contextIsolation: true,
    nodeIntegration: false
  }
}

function loadRoute(win: BrowserWindow, route: string): void {
  attachDiagnostics(win)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}#/${route}`)
  } else {
    void win.loadFile(rendererIndexPath(), { hash: `/${route}` })
  }
}

function attachDiagnostics(win: BrowserWindow): void {
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) log.warn(`renderer[${level}] ${message} (${sourceId}:${line})`)
  })
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    log.error('did-fail-load', code, description, url)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('render process gone:', details.reason)
  })
}

function orbBounds(expanded: boolean): Electron.Rectangle {
  const display = screen.getPrimaryDisplay()
  const wa = display.workArea
  const size = expanded
    ? ORB_EXPANDED_SIZE
    : { width: ORB_SIZE, height: ORB_SIZE }

  const saved = getSettings().orbPosition
  if (saved && !expanded) {
    const x = Math.min(Math.max(saved.x, wa.x), wa.x + wa.width - size.width)
    const y = Math.min(Math.max(saved.y, wa.y), wa.y + wa.height - size.height)
    return { x, y, width: size.width, height: size.height }
  }

  return {
    x: wa.x + wa.width - size.width - ORB_MARGIN,
    y: wa.y + wa.height - size.height - ORB_MARGIN,
    width: size.width,
    height: size.height
  }
}

export function createOrbWindow(): BrowserWindow {
  if (orbWin && !orbWin.isDestroyed()) return orbWin

  orbWin = new BrowserWindow({
    ...orbBounds(false),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    title: 'Harion',
    icon: iconPath('icon.png'),
    webPreferences: baseWebPreferences()
  })

  orbWin.setAlwaysOnTop(true, 'screen-saver')
  orbWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadRoute(orbWin, 'orb')

  orbWin.once('ready-to-show', () => {
    if (getSettings().orbVisible) orbWin?.showInactive()
  })

  orbWin.on('move', () => {
    if (!orbWin || suppressOrbMove) return
    const [x, y] = orbWin.getPosition()
    setSettings({ orbPosition: { x, y } })
  })

  orbWin.on('closed', () => {
    orbWin = null
  })

  return orbWin
}

export function setOrbExpanded(expanded: boolean): void {
  if (!orbWin || orbWin.isDestroyed()) return
  suppressOrbMove = true
  orbWin.setBounds(orbBounds(expanded))
  setTimeout(() => {
    suppressOrbMove = false
  }, 400)
}

export function setOrbVisible(visible: boolean): void {
  setSettings({ orbVisible: visible })
  const win = createOrbWindow()
  if (visible) {
    win.showInactive()
  } else {
    win.hide()
  }
}

export function focusOrb(): void {
  const win = createOrbWindow()
  win.showInactive()
  win.webContents.send(IPC.orbitFocusCapture)
}

export function createMainWindow(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed()) return mainWin

  mainWin = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 920,
    minHeight: 580,
    show: false,
    frame: false,
    backgroundColor: '#05060a',
    title: 'Harion',
    icon: iconPath('icon.png'),
    webPreferences: baseWebPreferences()
  })

  loadRoute(mainWin, 'app')

  mainWin.once('ready-to-show', () => mainWin?.show())
  mainWin.on('closed', () => {
    mainWin = null
  })
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  return mainWin
}

export function openMain(command?: Record<string, unknown>): void {
  const win = createMainWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  if (command) {
    win.webContents.send(IPC.windowMainCommand, command)
  }
}

export function openOverlayWindow(): BrowserWindow {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const bounds = display.bounds

  overlayWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    enableLargerThanScreen: true,
    backgroundColor: '#00000000',
    title: 'Harion Capture',
    webPreferences: baseWebPreferences()
  })

  overlayWin.setAlwaysOnTop(true, 'screen-saver')
  loadRoute(overlayWin, 'overlay')

  overlayWin.once('ready-to-show', () => {
    overlayWin?.show()
    overlayWin?.focus()
  })
  overlayWin.on('closed', () => {
    overlayWin = null
  })

  return overlayWin
}

export function closeOverlay(): void {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.close()
}

export function getOverlay(): BrowserWindow | null {
  return overlayWin && !overlayWin.isDestroyed() ? overlayWin : null
}

export function getOrb(): BrowserWindow | null {
  return orbWin && !orbWin.isDestroyed() ? orbWin : null
}

export function getMain(): BrowserWindow | null {
  return mainWin && !mainWin.isDestroyed() ? mainWin : null
}

export function getFocusedOrSender(sender: Electron.WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(sender)
}

export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}
