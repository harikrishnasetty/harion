import type { Classification, ItemKind, Priority } from '@shared/types'

const KIND_KEYWORDS: { kind: ItemKind; re: RegExp }[] = [
  {
    kind: 'reminder',
    re: /\b(remind(er)?|don'?t forget|dont forget|remember to|make sure to|ping me|nudge)\b/i
  },
  {
    kind: 'todo',
    re: /\b(todo|to-?do|task|need(s)? to|have to|must|should|action item|buy|purchase|call|email|send|reply|submit|pay|fix|finish|review|book|schedule|follow up|follow-up|prepare|draft)\b/i
  },
  {
    kind: 'idea',
    re: /\b(idea|what if|brainstorm|concept|someday|wouldn'?t it|imagine|perhaps we|maybe we|vision|innovate)\b/i
  },
  {
    kind: 'knowledge',
    re: /\b(note that|remember that|fyi|fact|definition|means that|how to|reference|learned|documented|as per|according to)\b/i
  }
]

const HIGH_PRIORITY_RE =
  /\b(urgent|asap|critical|immediately|important|high priority|today|eod|end of day|blocker|blocking)\b/i
const LOW_PRIORITY_RE = /\b(someday|low priority|eventually|whenever|no rush|maybe later)\b/i

const URL_RE = /\b(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)\b/gi
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g
const HASHTAG_RE = /#([A-Za-z0-9_-]{2,30})/g

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
]

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = []
  for (const m of text.matchAll(re)) out.push(m[0])
  return out
}

function nextWeekday(from: Date, target: number): Date {
  const d = new Date(from)
  const diff = (target - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d
}

export function parseDueDate(text: string, now = new Date()): string | null {
  const t = text.toLowerCase()
  let base: Date | null = null
  let defaultHour: number | null = null

  const isoMatch = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (isoMatch) {
    base = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    defaultHour = 9
  }

  const slashMatch = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/)
  if (!base && slashMatch) {
    let year = Number(slashMatch[3])
    if (year < 100) year += 2000
    base = new Date(year, Number(slashMatch[1]) - 1, Number(slashMatch[2]))
    defaultHour = 9
  }

  const monthMatch = t.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s*(\d{4}))?/
  )
  if (!base && monthMatch) {
    const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
      monthMatch[1]
    )
    const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear()
    base = new Date(year, monthIndex, Number(monthMatch[2]))
    defaultHour = 9
  }

  const inMatch = t.match(/\bin\s+(\d+)\s*(min|minute|minutes|hour|hours|day|days|week|weeks)\b/)
  if (!base && inMatch) {
    const n = parseInt(inMatch[1], 10)
    const unit = inMatch[2]
    base = new Date(now)
    if (unit.startsWith('min')) base.setMinutes(base.getMinutes() + n)
    else if (unit.startsWith('hour')) base.setHours(base.getHours() + n)
    else if (unit.startsWith('day')) base.setDate(base.getDate() + n)
    else base.setDate(base.getDate() + n * 7)
    if (unit.startsWith('day') || unit.startsWith('week')) defaultHour = 9
  }

  if (!base) {
    if (/\btomorrow\b/.test(t)) {
      base = new Date(now)
      base.setDate(base.getDate() + 1)
      defaultHour = 9
    } else if (/\btonight\b/.test(t)) {
      base = new Date(now)
      defaultHour = 20
    } else if (/\btoday\b/.test(t)) {
      base = new Date(now)
    } else if (/\bnext week\b/.test(t)) {
      base = new Date(now)
      base.setDate(base.getDate() + 7)
      defaultHour = 9
    }
  }

  if (!base) {
    const weekdayMatch = t.match(
      /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
    )
    if (weekdayMatch) {
      const target = WEEKDAYS.indexOf(weekdayMatch[2])
      base = nextWeekday(now, target)
      defaultHour = 9
    }
  }

  const timeMatch = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ||
    t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10)
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
    const ampm = timeMatch[3]
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    if (!base) {
      base = new Date(now)
      const candidate = new Date(base)
      candidate.setHours(hour, minute, 0, 0)
      if (candidate.getTime() < now.getTime()) candidate.setDate(candidate.getDate() + 1)
      base = candidate
    } else {
      base.setHours(hour, minute, 0, 0)
    }
    defaultHour = null
  }

  if (!base) return null
  if (defaultHour !== null) base.setHours(defaultHour, 0, 0, 0)
  base.setSeconds(0, 0)
  return base.toISOString()
}

function makeTitle(text: string, kind: ItemKind, urls: string[]): string {
  if (kind === 'link' && urls.length) {
    try {
      const u = new URL(urls[0].startsWith('http') ? urls[0] : `https://${urls[0]}`)
      return u.hostname.replace(/^www\./, '')
    } catch {
      return urls[0]
    }
  }
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? text
  const cleaned = firstLine.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 72) return cleaned
  return `${cleaned.slice(0, 69).trimEnd()}...`
}

export function ruleClassify(text: string, now = new Date()): Classification {
  const trimmed = text.trim()
  const urls = unique(matchAll(trimmed, URL_RE))
  const emails = unique(matchAll(trimmed, EMAIL_RE))
  const phones = unique(matchAll(trimmed, PHONE_RE)).filter(
    (p) => p.replace(/\D/g, '').length >= 7
  )
  const hashtags = matchAll(trimmed, HASHTAG_RE).map((h) => h.slice(1).toLowerCase())

  let kind: ItemKind = 'note'
  const urlOnly = /^\s*(https?:\/\/|www\.)\S+\s*$/i.test(trimmed)
  if (urlOnly) {
    kind = 'link'
  } else {
    for (const { kind: k, re } of KIND_KEYWORDS) {
      if (re.test(trimmed)) {
        kind = k
        break
      }
    }
    if (kind === 'note' && emails.length && trimmed.length < 80) kind = 'contact'
    if (kind === 'note' && urls.length && trimmed.length < 120) kind = 'link'
  }

  let priority: Priority = 'medium'
  if (HIGH_PRIORITY_RE.test(trimmed)) priority = 'high'
  else if (LOW_PRIORITY_RE.test(trimmed)) priority = 'low'

  const dueAt =
    kind === 'reminder' || kind === 'todo' ? parseDueDate(trimmed, now) : null

  const entities: Record<string, string[]> = {}
  if (urls.length) entities.url = urls
  if (emails.length) entities.email = emails
  if (phones.length) entities.phone = phones

  const tags = unique([...hashtags, kind === 'note' ? '' : kind]).slice(0, 8)

  const summary = trimmed.length > 200 ? `${trimmed.slice(0, 197).trimEnd()}...` : trimmed

  return {
    kind,
    title: makeTitle(trimmed, kind, urls),
    summary,
    tags,
    priority,
    dueAt,
    confidence: 0.42,
    entities,
    suggestedActions: []
  }
}
