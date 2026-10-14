import { app, BrowserWindow, Menu, protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import type { Settings } from '@shared/types'
import { closeDb, initDb } from './db'
import { getAttachmentById } from './db/items'
import { getSettings } from './db/settings'
import { captureClipboard, registerIpc, startScreenshot } from './ipc'
import { startReminders, stopReminders } from './reminders'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { destroyTray, initTray } from './tray'
import { createLogger } from './util/logger'
import {
  broadcast,
  createOrbWindow,
  focusOrb,
  getMain,
  openMain,
  setOrbVisible
} from './windows'

const log = createLogger('app')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setName('Harion')
  app.setPath('userData', join(app.getPath('appData'), 'Harion'))
  app.setAppUserModelId('com.harion.capture')

  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'harion-attach',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])

  app.on('second-instance', () => {
    openMain()
  })

  const actions = {
    quickCapture: (): void => focusOrb(),
    clipboardCapture: (): void => {
      void captureClipboard()
    },
    screenshot: (): void => {
      void startScreenshot()
    },
    toggleMain: (): void => {
      const win = getMain()
      if (win && win.isVisible() && !win.isMinimized()) {
        win.hide()
      } else {
        openMain()
      }
    }
  }

  function applySettings(settings: Settings): void {
    registerShortcuts(settings, actions)
    setOrbVisible(settings.orbVisible)
    try {
      app.setLoginItemSettings({ openAtLogin: settings.launchOnStartup })
    } catch (err) {
      log.warn('setLoginItemSettings failed', (err as Error).message)
    }
  }

  app.whenReady().then(() => {
    initDb()
    const settings = getSettings()

    Menu.setApplicationMenu(null)

    protocol.handle('harion-attach', async (request) => {
      try {
        const id = Number(new URL(request.url).pathname.replace(/^\//, ''))
        const attachment = Number.isFinite(id) ? getAttachmentById(id) : null
        if (!attachment) return new Response('Not found', { status: 404 })
        const data = await readFile(attachment.path)
        return new Response(new Uint8Array(data), {
          headers: { 'Content-Type': attachment.mime ?? 'application/octet-stream' }
        })
      } catch (err) {
        log.warn('attachment fetch failed', (err as Error).message)
        return new Response('Error', { status: 500 })
      }
    })

    registerIpc({ applySettings })
    registerShortcuts(settings, actions)

    initTray(
      {
        quickCapture: actions.quickCapture,
        captureClipboard: actions.clipboardCapture,
        captureScreenshot: actions.screenshot,
        openMain: (): void => openMain(),
        toggleOrb: (visible: boolean): void => setOrbVisible(visible)
      },
      settings.orbVisible
    )

    createOrbWindow()
    startReminders()

    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createOrbWindow()
    })

    log.info('Harion started')
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    stopReminders()
    unregisterShortcuts()
    destroyTray()
    closeDb()
  })

  process.on('uncaughtException', (err) => {
    log.error('uncaught exception', err)
    broadcast(IPC.toast, { message: `Error: ${err.message}`, kind: 'error' })
  })
}
