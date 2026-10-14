import { useEffect, useState } from 'react'
import {
  KIND_META,
  type Item,
  type ItemDetail as ItemDetailType,
  type ItemKind,
  type Priority
} from '@shared/types'
import { Icon } from './Icons'
import { fromLocalInputValue, relativeTime, toLocalInputValue } from '../lib/format'
import { pushToast } from '../lib/toast'

interface ItemDetailProps {
  detail: ItemDetailType
  onChanged: (item: Item) => void
  onDeleted: (id: number) => void
  onClose: () => void
}

const KINDS = Object.keys(KIND_META) as ItemKind[]

export function ItemDetail({
  detail,
  onChanged,
  onDeleted,
  onClose
}: ItemDetailProps): JSX.Element {
  const { item, attachments } = detail
  const [kind, setKind] = useState<ItemKind>(item.kind)
  const [title, setTitle] = useState(item.title)
  const [body, setBody] = useState(item.body)
  const [tags, setTags] = useState(item.tags.join(', '))
  const [priority, setPriority] = useState<Priority>(item.priority)
  const [dueAt, setDueAt] = useState(toLocalInputValue(item.dueAt))
  const [status, setStatus] = useState(item.status)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setKind(item.kind)
    setTitle(item.title)
    setBody(item.body)
    setTags(item.tags.join(', '))
    setPriority(item.priority)
    setDueAt(toLocalInputValue(item.dueAt))
    setStatus(item.status)
  }, [item.id, item.kind, item.title, item.body, item.tags, item.priority, item.dueAt, item.status])

  const aiUsed = Boolean((item.sourceMeta as Record<string, unknown> | null)?.aiUsed)
  const entities = ((item.sourceMeta as Record<string, unknown> | null)?.entities ?? {}) as Record<
    string,
    string[]
  >
  const suggestions = ((item.sourceMeta as Record<string, unknown> | null)
    ?.suggestedActions ?? []) as string[]

  async function save(): Promise<void> {
    setBusy(true)
    try {
      const updated = await window.harion.items.update(item.id, {
        kind,
        title,
        body,
        tags: tags
          .split(',')
          .map((t) => t.trim().replace(/^#/, '').toLowerCase())
          .filter(Boolean),
        priority,
        dueAt: fromLocalInputValue(dueAt),
        status
      })
      if (updated) onChanged(updated)
      pushToast({ message: 'Saved', kind: 'success' })
    } finally {
      setBusy(false)
    }
  }

  async function recheck(): Promise<void> {
    setBusy(true)
    try {
      const updated = await window.harion.ai.recheck(item.id)
      if (updated) onChanged(updated)
      pushToast({ message: 'Re-classified with AI', kind: 'success' })
    } catch (err) {
      pushToast({ message: `AI re-check failed: ${(err as Error).message}`, kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    await window.harion.items.remove(item.id)
    onDeleted(item.id)
    pushToast({ message: 'Deleted', kind: 'info' })
  }

  return (
    <div className="detail">
      <div className="detail__head">
        <h2>Item #{item.id}</h2>
        <button className="qc__iconbtn" onClick={onClose} title="Close">
          <Icon name="close" size={16} />
        </button>
      </div>

      {attachments
        .filter((a) => a.kind === 'image')
        .map((a) => (
          <img key={a.id} className="detail__thumb" src={`harion-attach://a/${a.id}`} alt="attachment" />
        ))}

      <div className="detail__ai">
        <Icon name="bolt" size={15} />
        <span>{aiUsed ? 'Classified by AI' : 'Classified by rules'}</span>
        <span className="conf-bar">
          <i style={{ width: `${Math.round((item.confidence ?? 0) * 100)}%` }} />
        </span>
        <span className="mono">{Math.round((item.confidence ?? 0) * 100)}%</span>
      </div>

      <div className="field">
        <label>Title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="field">
        <label>Content</label>
        <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div className="row">
        <div className="field">
          <label>Type</label>
          <select
            className="select"
            value={kind}
            onChange={(e) => setKind(e.target.value as ItemKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Priority</label>
          <select
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label>Due</label>
          <input
            className="input"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Status</label>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as Item['status'])}
          >
            <option value="inbox">Inbox</option>
            <option value="active">Active</option>
            <option value="done">Done</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Tags</label>
        <input
          className="input"
          value={tags}
          placeholder="comma, separated, tags"
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      {Object.keys(entities).length > 0 && (
        <div className="field">
          <label>Detected entities</label>
          <div className="card__meta">
            {Object.entries(entities).flatMap(([type, values]) =>
              values.map((v) => (
                <span className="tag" key={`${type}-${v}`} title={type}>
                  {type}: {v.length > 34 ? `${v.slice(0, 31)}…` : v}
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="field">
          <label>Suggested next steps</label>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>
            {suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        Created {relativeTime(item.createdAt)} · Updated {relativeTime(item.updatedAt)} · Source:{' '}
        {item.source}
      </div>

      <div className="detail__actions">
        <button className="btn btn--primary btn--sm" onClick={() => void save()} disabled={busy}>
          <Icon name="save" size={15} />
          Save
        </button>
        <button className="btn btn--sm" onClick={() => void recheck()} disabled={busy}>
          <Icon name="bolt" size={15} />
          Re-run AI
        </button>
        <button className="btn btn--sm detail__danger" onClick={() => void remove()} disabled={busy}>
          <Icon name="trash" size={15} />
          Delete
        </button>
      </div>
    </div>
  )
}
