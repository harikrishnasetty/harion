import { Notification } from 'electron'
import { IPC } from '@shared/ipc'
import type { ItemKind } from '@shared/types'
import { dueReminders, markReminderFired } from './db/items'
import { broadcast, openMain } from './windows'
import { createLogger } from './util/logger'

const log = createLogger('reminders')
const CHECK_INTERVAL = 30_000
const FIRST_CHECK_DELAY = 5_000

let timer: NodeJS.Timeout | null = null
let firstTimer: NodeJS.Timeout | null = null

const LABELS: Record<ItemKind, string> = {
  todo: 'To-Do',
  reminder: 'Reminder',
  knowledge: 'Knowledge',
  idea: 'Idea',
  contact: 'Contact',
  link: 'Link',
  note: 'Note'
}

function tick(): void {
  try {
    const due = dueReminders(new Date().toISOString())
    if (!due.length) return

    for (const item of due) {
      try {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: `Harion - ${LABELS[item.kind]}`,
            body: item.title,
            urgency: item.priority === 'high' ? 'critical' : 'normal'
          })
          notification.on('click', () =>
            openMain({ command: 'open-item', id: item.id })
          )
          notification.show()
        }
      } catch (err) {
        log.warn('notification failed', (err as Error).message)
      }
      markReminderFired(item.id)
    }

    broadcast(IPC.toast, {
      message:
        due.length === 1 ? `Reminder: ${due[0].title}` : `${due.length} reminders are due`,
      kind: 'reminder'
    })
    broadcast(IPC.itemsChanged, { reason: 'reminders' })
  } catch (err) {
    log.error('reminder tick failed', err)
  }
}

export function startReminders(): void {
  firstTimer = setTimeout(tick, FIRST_CHECK_DELAY)
  timer = setInterval(tick, CHECK_INTERVAL)
  log.info('reminder scheduler started')
}

export function stopReminders(): void {
  if (timer) clearInterval(timer)
  if (firstTimer) clearTimeout(firstTimer)
  timer = null
  firstTimer = null
}
