import type { ToastPayload } from '../../../preload'

export interface Toast extends ToastPayload {
  id: number
}

let counter = 0
let toasts: Toast[] = []
const listeners = new Set<(toasts: Toast[]) => void>()

function emit(): void {
  for (const listener of listeners) listener(toasts)
}

export function pushToast(payload: ToastPayload): void {
  const id = ++counter
  toasts = [...toasts, { ...payload, id }].slice(-4)
  emit()
  setTimeout(() => dismissToast(id), payload.kind === 'error' ? 6000 : 3800)
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function subscribeToasts(listener: (toasts: Toast[]) => void): () => void {
  listeners.add(listener)
  listener(toasts)
  return () => listeners.delete(listener)
}
