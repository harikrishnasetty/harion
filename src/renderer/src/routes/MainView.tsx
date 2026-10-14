import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  KIND_META,
  type AiStatus,
  type CaptureSource,
  type Item,
  type ItemDetail as ItemDetailType,
  type ItemKind,
  type Settings,
  type Stats
} from '@shared/types'
import { Icon } from '../components/Icons'
import { ItemCard } from '../components/ItemCard'
import { ItemDetail } from '../components/ItemDetail'
import { SettingsPanel } from '../components/SettingsPanel'
import { Sidebar, type Selection } from '../components/Sidebar'
import { Toasts } from '../components/Toasts'
import { pushToast } from '../lib/toast'

interface FilterShape {
  kind: ItemKind | 'all'
  status: 'inbox' | 'all' | 'done' | 'archived'
}

function selectionToFilter(selection: Selection): FilterShape {
  switch (selection.type) {
    case 'inbox':
      return { kind: 'all', status: 'inbox' }
    case 'all':
      return { kind: 'all', status: 'all' }
    case 'done':
      return { kind: 'all', status: 'done' }
    case 'archive':
      return { kind: 'all', status: 'archived' }
    case 'kind':
      return { kind: selection.kind, status: 'all' }
  }
}

function selectionTitle(selection: Selection): string {
  if (selection.type === 'kind') return KIND_META[selection.kind].label
  if (selection.type === 'inbox') return 'Inbox'
  if (selection.type === 'all') return 'All items'
  if (selection.type === 'done') return 'Completed'
  return 'Archive'
}

export default function MainView(): JSX.Element {
  const [selection, setSelection] = useState<Selection>({ type: 'inbox' })
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'items' | 'settings'>('items')
  const [items, setItems] = useState<Item[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [detail, setDetail] = useState<ItemDetailType | null>(null)
  const [composerText, setComposerText] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const selectedIdRef = useRef<number | null>(null)
  const filter = useMemo(() => selectionToFilter(selection), [selection])

  const refresh = useCallback(async (): Promise<void> => {
    const [list, st] = await Promise.all([
      window.harion.items.list({ kind: filter.kind, status: filter.status, query }),
      window.harion.items.stats()
    ])
    let next = list
    if (selection.type === 'kind') next = list.filter((i) => i.status !== 'archived')
    if (selection.type === 'inbox')
      next = list.filter((i) => i.status === 'inbox' || i.status === 'active')
    setItems(next)
    setStats(st)
  }, [filter, query, selection.type])

  const refreshAi = useCallback(async (): Promise<void> => {
    setAiStatus(await window.harion.ai.status())
  }, [])

  useEffect(() => {
    void window.harion.settings.get().then(setSettings)
    void refreshAi()
  }, [refreshAi])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectItem = useCallback(async (id: number | null): Promise<void> => {
    selectedIdRef.current = id
    if (id == null) {
      setDetail(null)
      return
    }
    setDetail(await window.harion.items.get(id))
  }, [])

  useEffect(() => {
    const off = window.harion.events.onItemsChanged(async () => {
      await refresh()
      if (selectedIdRef.current != null) {
        setDetail(await window.harion.items.get(selectedIdRef.current))
      }
    })
    return off
  }, [refresh])

  useEffect(() => {
    const off = window.harion.events.onToast((payload) => pushToast(payload))
    return off
  }, [])

  useEffect(() => {
    const off = window.harion.events.onMainCommand((cmd) => {
      if (cmd.command === 'open-item' && typeof cmd.id === 'number') {
        setView('items')
        void selectItem(cmd.id)
      }
    })
    return off
  }, [selectItem])

  async function submit(
    text: string,
    source: CaptureSource = 'text',
    sourceMeta?: Record<string, unknown>
  ): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      await window.harion.capture.submit({ text: trimmed, source, sourceMeta })
      setComposerText('')
      pushToast({ message: 'Captured & filed', kind: 'success' })
    } catch (err) {
      pushToast({ message: `Capture failed: ${(err as Error).message}`, kind: 'error' })
    }
  }

  function onDrop(e: React.DragEvent): void {
    e.preventDefault()
    setDragOver(false)
    const text =
      e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || ''
    const files = Array.from(e.dataTransfer.files)
    if (text.trim()) {
      void submit(text, 'drop')
      return
    }
    if (files.length) {
      const body = files.map((f) => f.name).join('\n')
      void submit(
        body,
        'drop',
        { files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })) }
      )
      return
    }
    pushToast({ message: 'Nothing to capture from that drop', kind: 'error' })
  }

  async function toggleItem(item: Item): Promise<void> {
    await window.harion.items.complete(item.id, item.status !== 'done')
  }

  return (
    <div
      className="app-root"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="titlebar">
        <div className="titlebar__brand">
          <span className="titlebar__orb" />
          Harion
        </div>
        <span className="titlebar__status">
          {aiStatus?.reachable
            ? `AI · ${settings?.ollamaModel ?? ''}`
            : settings?.aiEnabled
              ? 'AI offline · rules active'
              : 'rules-only mode'}
        </span>
        <div className="titlebar__spacer" />
        <div className="wctl">
          <button onClick={() => void window.harion.window.command('minimize')} title="Minimize">
            <Icon name="minimize" size={16} />
          </button>
          <button onClick={() => void window.harion.window.command('maximize')} title="Maximize">
            <Icon name="maximize" size={14} />
          </button>
          <button
            className="close"
            onClick={() => void window.harion.window.command('close')}
            title="Close"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      <div className="app-main">
        <Sidebar
          selection={selection}
          onSelect={(s) => {
            setSelection(s)
            setView('items')
            void selectItem(null)
          }}
          stats={stats}
          onOpenSettings={() => setView('settings')}
          settingsActive={view === 'settings'}
        />

        <div className="content">
          <div className="topbar">
            <div className="search">
              <Icon name="search" size={17} />
              <input
                placeholder="Search titles, notes and tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="btn btn--sm"
              onClick={() => void window.harion.capture.clipboard()}
              title="Capture clipboard  (Ctrl+Shift+V)"
            >
              <Icon name="clipboard" size={15} />
              Clipboard
            </button>
            <button
              className="btn btn--sm"
              onClick={() => void window.harion.screenshot.begin()}
              title="Capture screenshot  (Ctrl+Shift+S)"
            >
              <Icon name="camera" size={15} />
              Screenshot
            </button>
          </div>

          <div className="board">
            {view === 'settings' && settings ? (
              <SettingsPanel
                settings={settings}
                aiStatus={aiStatus}
                onSaved={setSettings}
                onRefreshAi={refreshAi}
              />
            ) : (
              <>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div className="composer">
                    <textarea
                      placeholder="Capture anything…  (Enter to file)"
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void submit(composerText)
                        }
                      }}
                    />
                    <button
                      className="btn btn--primary"
                      onClick={() => void submit(composerText)}
                      disabled={!composerText.trim()}
                    >
                      <Icon name="bolt" size={16} />
                      Capture
                    </button>
                  </div>

                  <div className="list">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                        color: 'var(--muted)',
                        fontSize: 12,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase'
                      }}
                    >
                      <span>{selectionTitle(selection)}</span>
                      <span className="mono">{items.length} items</span>
                    </div>

                    {items.length === 0 ? (
                      <div className="empty">
                        <div className="empty__orb" />
                        <h3>Nothing here yet</h3>
                        <p>
                          Tap the floating orb, press{' '}
                          <span className="kbd">Ctrl+Shift+Space</span>, or type above. Harion will
                          sort it into the right bucket automatically.
                        </p>
                      </div>
                    ) : (
                      items.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          selected={detail?.item.id === item.id}
                          onSelect={(id) => void selectItem(id)}
                          onToggle={(it) => void toggleItem(it)}
                        />
                      ))
                    )}
                  </div>
                </div>

                {detail && (
                  <ItemDetail
                    detail={detail}
                    onChanged={(item) => setDetail({ ...detail, item })}
                    onDeleted={() => {
                      void selectItem(null)
                    }}
                    onClose={() => void selectItem(null)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {dragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 40,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(6, 10, 20, 0.72)',
            backdropFilter: 'blur(6px)',
            border: '2px dashed var(--stroke-strong)',
            borderRadius: 0,
            fontSize: 16,
            color: 'var(--text)',
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Icon name="bolt" size={30} />
            Drop to capture
          </div>
        </div>
      )}

      <Toasts />
    </div>
  )
}
