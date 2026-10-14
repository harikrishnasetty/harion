import { KIND_META, type ItemKind, type Stats } from '@shared/types'
import { Icon, type IconName } from './Icons'

export type Selection =
  | { type: 'inbox' }
  | { type: 'all' }
  | { type: 'done' }
  | { type: 'archive' }
  | { type: 'kind'; kind: ItemKind }

const KINDS: ItemKind[] = ['todo', 'reminder', 'knowledge', 'idea', 'contact', 'link', 'note']

interface SidebarProps {
  selection: Selection
  onSelect: (selection: Selection) => void
  stats: Stats | null
  onOpenSettings: () => void
  settingsActive: boolean
}

function isActive(a: Selection, b: Selection): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'kind' && b.type === 'kind') return a.kind === b.kind
  return true
}

export function Sidebar({
  selection,
  onSelect,
  stats,
  onOpenSettings,
  settingsActive
}: SidebarProps): JSX.Element {
  const countFor = (kind: ItemKind): number =>
    stats?.byKind.find((k) => k.kind === kind)?.count ?? 0

  return (
    <aside className="sidebar">
      <button
        className={`sidebar__item ${isActive(selection, { type: 'inbox' }) && !settingsActive ? 'active' : ''}`}
        onClick={() => onSelect({ type: 'inbox' })}
      >
        <span className="sidebar__glyph">
          <Icon name="inbox" size={17} />
        </span>
        Inbox
        {stats && stats.inbox > 0 && <span className="sidebar__count">{stats.inbox}</span>}
      </button>

      <button
        className={`sidebar__item ${isActive(selection, { type: 'all' }) && !settingsActive ? 'active' : ''}`}
        onClick={() => onSelect({ type: 'all' })}
      >
        <span className="sidebar__glyph">
          <Icon name="list" size={17} />
        </span>
        All items
      </button>

      <div className="sidebar__section">Collections</div>

      {KINDS.map((kind) => {
        const meta = KIND_META[kind]
        const count = countFor(kind)
        return (
          <button
            key={kind}
            className={`sidebar__item ${isActive(selection, { type: 'kind', kind }) && !settingsActive ? 'active' : ''}`}
            onClick={() => onSelect({ type: 'kind', kind })}
          >
            <span className="sidebar__glyph" style={{ color: meta.accent }}>
              <Icon name={meta.icon as IconName} size={17} />
            </span>
            {meta.label}
            {count > 0 && <span className="sidebar__count">{count}</span>}
          </button>
        )
      })}

      <button
        className={`sidebar__item ${isActive(selection, { type: 'done' }) && !settingsActive ? 'active' : ''}`}
        onClick={() => onSelect({ type: 'done' })}
      >
        <span className="sidebar__glyph">
          <Icon name="check" size={17} />
        </span>
        Completed
      </button>

      <button
        className={`sidebar__item ${isActive(selection, { type: 'archive' }) && !settingsActive ? 'active' : ''}`}
        onClick={() => onSelect({ type: 'archive' })}
      >
        <span className="sidebar__glyph">
          <Icon name="archive" size={17} />
        </span>
        Archive
      </button>

      <div className="sidebar__spacer" />

      <button
        className={`sidebar__item ${settingsActive ? 'active' : ''}`}
        onClick={onOpenSettings}
      >
        <span className="sidebar__glyph">
          <Icon name="settings" size={17} />
        </span>
        Settings
      </button>

      <div className="sidebar__foot">
        Harion captures anything and files it locally. Nothing leaves your machine.
      </div>
    </aside>
  )
}
