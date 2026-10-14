import { desktopCapturer, nativeImage, screen } from 'electron'
import { createLogger } from '../util/logger'

const log = createLogger('screenshot')

export interface DisplayCapture {
  displayId: number
  dataUrl: string
  imageWidth: number
  imageHeight: number
  logicalWidth: number
  logicalHeight: number
  scaleFactor: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export async function captureDisplay(displayId?: number): Promise<DisplayCapture | null> {
  const displays = screen.getAllDisplays()
  let target = displayId != null ? displays.find((d) => d.id === displayId) : undefined
  if (!target) {
    target = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  }
  if (!target) target = screen.getPrimaryDisplay()

  const thumbnailSize = {
    width: Math.round(target.size.width * target.scaleFactor),
    height: Math.round(target.size.height * target.scaleFactor)
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize
  })

  const source =
    sources.find((s) => String(s.display_id) === String(target?.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) {
    log.warn('no screen source available')
    return null
  }

  const image = source.thumbnail
  const size = image.getSize()
  return {
    displayId: target.id,
    dataUrl: image.toDataURL(),
    imageWidth: size.width,
    imageHeight: size.height,
    logicalWidth: target.bounds.width,
    logicalHeight: target.bounds.height,
    scaleFactor: target.scaleFactor
  }
}

export function cropDataUrl(dataUrl: string, rect: Rect): string | null {
  const image = nativeImage.createFromDataURL(dataUrl)
  if (image.isEmpty()) return null
  const size = image.getSize()
  const x = Math.max(0, Math.min(Math.round(rect.x), size.width - 1))
  const y = Math.max(0, Math.min(Math.round(rect.y), size.height - 1))
  const width = Math.max(1, Math.min(Math.round(rect.width), size.width - x))
  const height = Math.max(1, Math.min(Math.round(rect.height), size.height - y))
  return image.crop({ x, y, width, height }).toDataURL()
}
