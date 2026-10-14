import { app, Menu, nativeImage, Tray } from 'electron'
import { iconPath } from './util/paths'
import { createLogger } from './util/logger'

const log = createLogger('tray')

export interface TrayActions {
  quickCapture: () => void
  captureClipboard: () => void
  captureScreenshot: () => void
  openMain: () => void
  toggleOrb: (visible: boolean) => void
}

let tray: Tray | null = null

export function initTray(actions: TrayActions, orbVisible: boolean): Tray {
  let image = nativeImage.createFromPath(iconPath('tray.png'))
  if (image.isEmpty()) image = nativeImage.createFromPath(iconPath('icon.png'))

  tray = new Tray(image.resize({ width: 16, height: 16 }))
  tray.setToolTip('Harion - capture anything')

  const menu = Menu.buildFromTemplate([
    { label: 'Quick capture', click: actions.quickCapture },
    { label: 'Capture clipboard', click: actions.captureClipboard },
    { label: 'Capture screenshot', click: actions.captureScreenshot },
    { type: 'separator' },
    { label: 'Open Harion', click: actions.openMain },
    {
      label: 'Show floating orb',
      type: 'checkbox',
      checked: orbVisible,
      click: (item) => actions.toggleOrb(item.checked)
    },
    { type: 'separator' },
    { label: 'Quit Harion', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', actions.openMain)
  log.info('tray ready')
  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
