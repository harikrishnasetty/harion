import { useEffect, useRef, useState } from 'react'
import type { Rect, ScreenshotImage } from '../../../preload'
import { Icon } from '../components/Icons'

interface Point {
  x: number
  y: number
}

export default function OverlayView(): JSX.Element {
  const [image, setImage] = useState<ScreenshotImage | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<Point | null>(null)
  const rectRef = useRef<Rect | null>(null)

  useEffect(() => {
    void window.harion.screenshot.getImage().then(setImage)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') void window.harion.screenshot.cancel()
      if (e.key === 'Enter' && rectRef.current && rectRef.current.width > 4) {
        void window.harion.screenshot.complete(rectRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function update(next: Rect | null): void {
    rectRef.current = next
    setRect(next)
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (e.button !== 0) return
    startRef.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
    update({ x: e.clientX, y: e.clientY, width: 0, height: 0 })
  }

  function onMouseMove(e: React.MouseEvent): void {
    const start = startRef.current
    if (!dragging || !start) return
    update({
      x: Math.min(start.x, e.clientX),
      y: Math.min(start.y, e.clientY),
      width: Math.abs(e.clientX - start.x),
      height: Math.abs(e.clientY - start.y)
    })
  }

  function onMouseUp(): void {
    if (!dragging) return
    setDragging(false)
    const current = rectRef.current
    if (current && (current.width < 8 || current.height < 8)) update(null)
  }

  function confirm(): void {
    const current = rectRef.current
    if (current && current.width > 4) void window.harion.screenshot.complete(current)
  }

  const hasSelection = !!rect && rect.width > 4 && rect.height > 4

  return (
    <div
      className="ov-root"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {image && <img className="ov-shot" src={image.dataUrl} alt="" draggable={false} />}

      {!hasSelection && <div className="ov-dim" />}

      {rect && rect.width > 0 && rect.height > 0 && (
        <div
          className="ov-selection"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height
          }}
        >
          <span className="ov-size">
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </span>
        </div>
      )}

      <div className="ov-hint">
        {hasSelection ? (
          <>
            Release to keep · <b>Enter</b> to capture · <b>Esc</b> to cancel
          </>
        ) : (
          <>
            Drag to select a region · <b>Esc</b> to cancel
          </>
        )}
      </div>

      {hasSelection && !dragging && (
        <div className="ov-actions" onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={() => void window.harion.screenshot.cancel()}>
            Cancel
          </button>
          <button className="primary" onClick={confirm}>
            <Icon name="camera" size={15} />
            Capture
          </button>
        </div>
      )}
    </div>
  )
}
