import type { BookingItem } from '../screens/11-BookingScreen'

export interface ClientBookingProgress {
  booking: BookingItem
  confirmedBookingRecipientCount: number
  confirmedServiceCount: number
  coordinatorIncluded: boolean
  daysRemaining?: number
  hasUnreadUpdate: boolean
  progressPercent: number
  statusLabel: string
  totalBookingRecipientCount: number
  totalActiveServiceCount: number
}

const getDaysLeft = (value: string, now = new Date()) => {
  if (!value) return null

  const eventDate = new Date(`${value}T00:00:00`)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  if (Number.isNaN(eventDate.getTime())) return null
  return Math.ceil((eventDate.getTime() - today.getTime()) / 86_400_000)
}

export const getClientBookingProgress = (
  bookings: BookingItem[],
  now = new Date(),
  unreadResourceIds: ReadonlySet<string> = new Set()
): ClientBookingProgress[] => bookings.flatMap((booking) => {
  if (['cancelled', 'completed'].includes(booking.rawStatus ?? '')) return []
  const activeServices = (booking.services ?? []).filter(
    (service) => !['cancelled', 'declined'].includes(service.status)
  )
  if (!activeServices.length) return []

  const confirmedServiceCount = activeServices.filter(
    (service) => ['confirmed', 'completed'].includes(service.status)
  ).length
  const totalActiveServiceCount = activeServices.length
  const coordinatorIncluded = Boolean(booking.coordinatorRequired)
  const coordinatorAccepted = booking.coordinatorAssignmentStatus === 'accepted'
  const confirmedBookingRecipientCount = confirmedServiceCount + (coordinatorIncluded && coordinatorAccepted ? 1 : 0)
  const totalBookingRecipientCount = totalActiveServiceCount + (coordinatorIncluded ? 1 : 0)
  const progressPercent = Math.round((confirmedBookingRecipientCount / totalBookingRecipientCount) * 100)
  const daysRemaining = getDaysLeft(booking.date, now)
  const outstandingProviderCount = totalActiveServiceCount - confirmedServiceCount
  const coordinatorOutstanding = coordinatorIncluded && !coordinatorAccepted
  const hasUnreadUpdate = [
    booking.id,
    booking.eventId,
    ...(booking.services ?? []).map((service) => service.bookingId),
  ].some((id) => Boolean(id && unreadResourceIds.has(id)))
  const statusLabel = daysRemaining === 0
    ? 'Event is today'
    : daysRemaining !== null && daysRemaining < 0
      ? booking.status === 'completed' ? 'Completed' : 'Event date has passed'
      : confirmedBookingRecipientCount === totalBookingRecipientCount
        ? 'All required bookings confirmed'
        : outstandingProviderCount > 0 && coordinatorOutstanding
          ? `${outstandingProviderCount} provider${outstandingProviderCount === 1 ? '' : 's'} and coordinator awaiting confirmation`
          : coordinatorOutstanding
            ? booking.coordinatorName
              ? 'Coordinator awaiting confirmation'
              : 'Coordinator assignment pending'
            : `${outstandingProviderCount} provider${outstandingProviderCount === 1 ? '' : 's'} awaiting confirmation`

  return [{
    booking,
    confirmedBookingRecipientCount,
    confirmedServiceCount,
    coordinatorIncluded,
    daysRemaining: daysRemaining === null ? undefined : daysRemaining,
    hasUnreadUpdate,
    progressPercent,
    statusLabel,
    totalBookingRecipientCount,
    totalActiveServiceCount,
  }]
}).sort((left, right) => {
  const nowStart = new Date(now)
  nowStart.setHours(0, 0, 0, 0)
  const dateTime = (booking: BookingItem) => {
    const date = new Date(`${booking.date}T00:00:00`).getTime()
    return Number.isFinite(date) ? date : Number.POSITIVE_INFINITY
  }
  const leftTime = dateTime(left.booking)
  const rightTime = dateTime(right.booking)
  const leftUpcoming = leftTime >= nowStart.getTime()
  const rightUpcoming = rightTime >= nowStart.getTime()

  if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1
  if (leftUpcoming) return leftTime - rightTime
  return rightTime - leftTime
})
