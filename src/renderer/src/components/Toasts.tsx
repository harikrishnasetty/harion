import { useEffect, useState } from 'react'
import { Icon, type IconName } from './Icons'
import { subscribeToasts, type Toast } from '../lib/toast'

const ICONS: Record<string, IconName> = {
  info: 'spark',
  success: 'check',
  error: 'close',
  reminder: 'bell'
}

export function Toasts(): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => subscribeToasts(setToasts), [])

  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div className={`toast ${t.kind ?? 'info'}`} key={t.id}>
          <Icon name={ICONS[t.kind ?? 'info']} size={15} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
