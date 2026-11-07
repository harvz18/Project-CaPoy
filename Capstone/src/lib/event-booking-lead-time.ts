export const EVENT_BOOKING_MINIMUM_LEAD_DAYS = 7
export const EVENT_BOOKING_LEAD_TIME_MESSAGE = 'Events must be scheduled at least 7 days in advance.'

type CalendarDate = { day: number; month: number; year: number }

const calendarDateInManila = (now: Date): CalendarDate => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Manila',
    year: 'numeric',
  }).formatToParts(now)
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => (
    Number(parts.find((part) => part.type === type)?.value)
  )

  return { day: valueFor('day'), month: valueFor('month'), year: valueFor('year') }
}

const calendarDateFromValue = (value: string | Date | undefined): CalendarDate | undefined => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined
    return { day: value.getDate(), month: value.getMonth() + 1, year: value.getFullYear() }
  }

  const match = typeof value === 'string'
    ? /^(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4}))$/.exec(value.trim())
    : null
  if (!match) return undefined

  const year = Number(match[1] ?? match[6])
  const month = Number(match[2] ?? match[4])
  const day = Number(match[3] ?? match[5])
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? { day, month, year }
    : undefined
}

const asLocalCalendarDate = ({ day, month, year }: CalendarDate) => new Date(year, month - 1, day)

export const minimumEventBookingDate = (now = new Date()) => {
  const manilaToday = calendarDateInManila(now)
  const date = asLocalCalendarDate(manilaToday)
  date.setDate(date.getDate() + EVENT_BOOKING_MINIMUM_LEAD_DAYS)
  return date
}

export const isEventDateBookable = (value: string | Date | undefined, now = new Date()) => {
  const candidate = calendarDateFromValue(value)
  return Boolean(candidate && asLocalCalendarDate(candidate) >= minimumEventBookingDate(now))
}

export const minimumEventBookingDateLabel = (now = new Date()) => new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(minimumEventBookingDate(now))
