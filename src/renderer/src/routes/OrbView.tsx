import { useCallback, useEffect, useState } from 'react'
import { Orb } from '../components/Orb'
import { QuickCapture } from '../components/QuickCapture'

export default function OrbView(): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const expand = useCallback((): void => {
    setExpanded(true)
    void window.harion.orb.setExpanded(true)
  }, [])

  const collapse = useCallback((): void => {
    setExpanded(false)
    void window.harion.orb.setExpanded(false)
  }, [])

  useEffect(() => {
    const off = window.harion.events.onOrbitFocus(() => expand())
    return off
  }, [expand])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (expanded) collapse()
        else void window.harion.orb.openMain()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, collapse])

  if (!expanded) return <Orb onClick={expand} listening />
  return <QuickCapture onDone={collapse} onCancel={collapse} />
}
