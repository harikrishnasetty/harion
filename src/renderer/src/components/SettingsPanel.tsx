import { useState } from 'react'
import type { AiStatus, Settings } from '@shared/types'
import { Icon } from './Icons'
import { pushToast } from '../lib/toast'

interface SettingsPanelProps {
  settings: Settings
  aiStatus: AiStatus | null
  onSaved: (settings: Settings) => void
  onRefreshAi: () => void
}

export function SettingsPanel({
  settings,
  aiStatus,
  onSaved,
  onRefreshAi
}: SettingsPanelProps): JSX.Element {
  const [url, setUrl] = useState(settings.ollamaUrl)
  const [model, setModel] = useState(settings.ollamaModel)
  const [busy, setBusy] = useState(false)

  async function patch(update: Partial<Settings>, note?: string): Promise<void> {
    const next = await window.harion.settings.set(update)
    onSaved(next)
    if (note) pushToast({ message: note, kind: 'success' })
  }

  async function saveOllama(): Promise<void> {
    setBusy(true)
    try {
      await patch({ ollamaUrl: url.trim(), ollamaModel: model.trim() }, 'Ollama settings saved')
      onRefreshAi()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings">
      <h1>Settings</h1>
      <p className="settings__sub">
        Harion runs entirely on your machine. Classification is powered by a local Ollama model when
        available, and falls back to a built-in rule engine otherwise.
      </p>

      <div className="settings__card">
        <h3>Assistant behaviour</h3>
        <div className="switch">
          <div className="switch__label">
            <strong>Use AI classification</strong>
            <span>Send captured text to your local Ollama model to auto-file it.</span>
          </div>
          <button
            className={`toggle ${settings.aiEnabled ? 'on' : ''}`}
            onClick={() => void patch({ aiEnabled: !settings.aiEnabled })}
            aria-label="Toggle AI classification"
          />
        </div>
        <div className="switch">
          <div className="switch__label">
            <strong>Show floating orb</strong>
            <span>Keep the always-on-top capture orb on screen.</span>
          </div>
          <button
            className={`toggle ${settings.orbVisible ? 'on' : ''}`}
            onClick={() => void patch({ orbVisible: !settings.orbVisible })}
            aria-label="Toggle floating orb"
          />
        </div>
        <div className="switch">
          <div className="switch__label">
            <strong>Launch at startup</strong>
            <span>Start Harion automatically when you sign in.</span>
          </div>
          <button
            className={`toggle ${settings.launchOnStartup ? 'on' : ''}`}
            onClick={() => void patch({ launchOnStartup: !settings.launchOnStartup })}
            aria-label="Toggle launch at startup"
          />
        </div>
      </div>

      <div className="settings__card">
        <h3>Local AI (Ollama)</h3>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Ollama endpoint</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Model</label>
          <input
            className="input"
            value={model}
            placeholder="llama3.2"
            onChange={(e) => setModel(e.target.value)}
            list="harion-models"
          />
          <datalist id="harion-models">
            {(aiStatus?.models ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="detail__ai" style={{ marginBottom: 12 }}>
          <span className={`status-dot ${aiStatus?.reachable ? 'ok' : 'bad'}`} />
          <span>{aiStatus?.message ?? 'Checking…'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--primary btn--sm" onClick={() => void saveOllama()} disabled={busy}>
            <Icon name="save" size={15} />
            Save
          </button>
          <button className="btn btn--sm" onClick={onRefreshAi}>
            <Icon name="refresh" size={15} />
            Reconnect
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.6 }}>
          Install Ollama from ollama.com, then run <span className="kbd">ollama pull {model || 'llama3.2'}</span>.
          No data leaves your device.
        </p>
      </div>

      <div className="settings__card">
        <h3>Global hotkeys</h3>
        {(
          [
            ['Quick capture', settings.hotkeys.quickCapture],
            ['Capture clipboard', settings.hotkeys.clipboardCapture],
            ['Capture screenshot', settings.hotkeys.screenshot],
            ['Show / hide Harion', settings.hotkeys.toggleMain]
          ] as [string, string][]
        ).map(([label, accel]) => (
          <div className="switch" key={label}>
            <div className="switch__label">
              <strong>{label}</strong>
            </div>
            <span className="kbd">{accel.replace(/CommandOrControl/g, 'Ctrl')}</span>
          </div>
        ))}
      </div>

      <div className="settings__card">
        <h3>About</h3>
        <div className="switch">
          <div className="switch__label">
            <strong>Harion 0.1.0</strong>
            <span>Local-first capture assistant — orb, clipboard, screenshot, drag &amp; drop.</span>
            <span>Built by Hari Krishna Setty</span>
            <span>github.com/harikrishnasetty/harion</span>
          </div>
          <button
            className="btn btn--sm detail__danger"
            onClick={() => void window.harion.app.quit()}
          >
            <Icon name="power" size={15} />
            Quit Harion
          </button>
        </div>
      </div>
    </div>
  )
}
