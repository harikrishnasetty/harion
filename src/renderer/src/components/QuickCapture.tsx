import { useEffect, useRef, useState } from 'react'
import type { Classification } from '@shared/types'
import { KIND_META } from '@shared/types'
import { Icon, type IconName } from './Icons'
import { pushToast } from '../lib/toast'
import { formatDue } from '../lib/format'

interface QuickCaptureProps {
  onDone: () => void
  onCancel: () => void
}

export function QuickCapture({ onDone, onCancel }: QuickCaptureProps): JSX.Element {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Classification | null>(null)
  const [thinking, setThinking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    areaRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = text.trim()
    if (!trimmed) {
      setPreview(null)
      setThinking(false)
      return
    }
    setThinking(true)
    const timer = setTimeout(async () => {
      try {
        const result = await window.harion.ai.classify(trimmed)
        setPreview(result.classification)
      } catch {
        setPreview(null)
      } finally {
        setThinking(false)
      }
    }, 750)
    return () => clearTimeout(timer)
  }, [text])

  async function save(): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await window.harion.capture.submit({ text: trimmed, source: 'text' })
      setFlash(true)
      pushToast({ message: 'Captured & filed', kind: 'success' })
      setText('')
      setPreview(null)
      setTimeout(() => {
        setFlash(false)
        onDone()
      }, 380)
    } catch (err) {
      pushToast({ message: `Capture failed: ${(err as Error).message}`, kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const meta = preview ? KIND_META[preview.kind] : null

  return (
    <div className="qc drag">
      {flash && <div className="qc__flasher" />}
      <div className="qc__head">
        <div className="qc__brand">
          <span className="qc__dot" />
          <span className="qc__label">Harion Capture</span>
        </div>
        <button className="qc__iconbtn no-drag" onClick={onCancel} title="Close (Esc)">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="qc__body">
        <div className="qc__preview">
          {thinking && <span className="chip">classifying…</span>}
          {meta && !thinking && (
            <>
              <span
                className="chip"
                style={{ color: meta.accent, borderColor: `${meta.accent}55` }}
              >
                <Icon name={meta.icon as IconName} size={12} />
                {meta.label}
              </span>
              {preview && (
                <span className="chip">
                  <span className={`prio ${preview.priority}`} />
                  {preview.priority}
                </span>
              )}
              {preview?.dueAt && (
                <span className="chip">
                  <Icon name="clock" size={12} />
                  {formatDue(preview.dueAt)}
                </span>
              )}
              {preview?.tags.slice(0, 3).map((tag) => (
                <span className="chip" key={tag}>
                  #{tag}
                </span>
              ))}
            </>
          )}
        </div>

        <textarea
          ref={areaRef}
          className="qc__text no-drag"
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Dump anything — a task, a reminder, a link, a thought, a person…  Harion will file it."
        />

        <div className="qc__hint">
          {preview?.summary && !thinking ? preview.summary : 'Enter to file · Shift+Enter for a new line · Esc to close'}
        </div>
      </div>

      <div className="qc__foot">
        <button
          className="qc__btn no-drag"
          onClick={() => void window.harion.capture.clipboard()}
          title="Capture from clipboard  (Ctrl+Shift+V)"
        >
          <Icon name="clipboard" size={15} />
          Clipboard
        </button>
        <button
          className="qc__btn no-drag"
          onClick={() => {
            onDone()
            void window.harion.screenshot.begin()
          }}
          title="Capture a screen region  (Ctrl+Shift+S)"
        >
          <Icon name="camera" size={15} />
          Screenshot
        </button>
        <button
          className="qc__btn qc__btn--primary no-drag"
          disabled={!text.trim() || saving}
          onClick={() => void save()}
        >
          <Icon name="bolt" size={15} />
          {saving ? 'Filing…' : 'Capture'}
        </button>
      </div>
    </div>
  )
}
