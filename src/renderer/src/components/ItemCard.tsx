import { KIND_META, type Item } from '@shared/types'
import { Icon, type IconName } from './Icons'
import { formatDue, isOverdue, relativeTime, truncate } from '../lib/format'

interface ItemCardProps {
  item: Item
  selected: boolean
  onSelect: (id: number) => void
  onToggle: (item: Item) => void
}

const SOURCE_LABEL: Record<string, string> = {
  text: 'typed',
  clipboard: 'clipboard',
  screenshot: 'screenshot',
  drop: 'dropped',
  manual: 'manual'
}

export function ItemCard({ item, selected, onSelect, onToggle }: ItemCardProps): JSX.Element {
  const meta = KIND_META[item.kind]
  const done = item.status === 'done'
  const overdue = !done && item.dueAt ? isOverdue(item.dueAt) : false

  return (
    <article
      className={`card ${selected ? 'selected' : ''} ${done ? 'done' : ''}`}
      style={{ '--accent': meta.accent } as React.CSSProperties}
      onClick={() => onSelect(item.id)}
    >
      <button
        className={`card__check ${done ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(item)
        }}
        title={done ? 'Mark as active' : 'Mark as done'}
      >
        <Icon name="check" size={14} strokeWidth={2.6} />
      </button>

      <div className="card__main">
        <div className="card__top">
          <span className="card__kind">
            <Icon name={meta.icon as IconName} size={12} />
            {meta.label}
          </span>
          <span className={`prio ${item.priority}`} title={`${item.priority} priority`} />
        </div>

        <h3 className="card__title">{item.title || 'Untitled'}</h3>
        {item.body && item.body !== item.title && (
          <p className="card__body">{truncate(item.body, 190)}</p>
        )}

        <div className="card__meta">
          {item.dueAt && (
            <span className={`meta-pill ${overdue ? 'overdue' : 'due'}`}>
              <Icon name="clock" size={12} />
              {formatDue(item.dueAt)}
            </span>
          )}
          {item.tags.slice(0, 4).map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
            </span>
          ))}
          <span className="meta-pill" style={{ marginLeft: 'auto' }}>
            {SOURCE_LABEL[item.source] ?? item.source} · {relativeTime(item.createdAt)}
          </span>
        </div>
      </div>
    </article>
  )
}
