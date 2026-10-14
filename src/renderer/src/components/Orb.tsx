import { Icon } from './Icons'

interface OrbProps {
  onClick: () => void
  listening?: boolean
}

export function Orb({ onClick, listening = false }: OrbProps): JSX.Element {
  return (
    <div className="orb-root drag">
      <div className="orb-stage">
        <div className="orb-glow" />
        <div className="orb-ring ring-3" />
        <div className="orb-ring ring-2" />
        <div className="orb-ring ring-1" />
        {listening && (
          <>
            <div className="orb-pulse" />
            <div className="orb-pulse delay" />
          </>
        )}
        <button
          className="orb-core no-drag"
          onClick={onClick}
          title="Capture anything  (Ctrl+Shift+Space)"
          aria-label="Open capture"
        >
          <span className="orb-core__glyph">
            <Icon name="plus" size={28} strokeWidth={2.3} />
          </span>
        </button>
        {listening && <span className="orb-core__hint">tap to capture</span>}
      </div>
    </div>
  )
}
