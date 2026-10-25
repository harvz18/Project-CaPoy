export interface UpdateNotificationLike {
  category?: string
  isRead?: boolean
  resourceId?: string
  resourceType?: string
}

const normalized = (value?: string) => value?.trim().toLowerCase() ?? ''

const hasResourceFragment = (notification: UpdateNotificationLike, fragments: string[]) => {
  const resourceType = normalized(notification.resourceType)
  return fragments.some((fragment) => resourceType.includes(fragment))
}

export const isUnreadUpdate = (notification: UpdateNotificationLike) => notification.isRead !== true

export const isMessageUpdate = (notification: UpdateNotificationLike) =>
  normalized(notification.category) === 'message'
  || hasResourceFragment(notification, ['message', 'conversation'])

export const isBookingUpdate = (notification: UpdateNotificationLike) =>
  hasResourceFragment(notification, [
    'booking',
    'event',
    'food_tasting',
    'payment',
  ])

export const isBookingTrackerUpdate = (notification: UpdateNotificationLike) =>
  hasResourceFragment(notification, [
    'booking',
    'event',
    'food_tasting',
  ])

export const isEventUpdate = (notification: UpdateNotificationLike) =>
  isBookingUpdate(notification) || hasResourceFragment(notification, ['remittance'])

export const isTaskUpdate = (notification: UpdateNotificationLike) =>
  hasResourceFragment(notification, ['task', 'instruction'])

export const unreadBookingTrackerResourceIds = (
  notifications: UpdateNotificationLike[]
) => new Set(
  notifications
    .filter((notification) => isUnreadUpdate(notification) && isBookingTrackerUpdate(notification))
    .map((notification) => notification.resourceId?.trim())
    .filter((resourceId): resourceId is string => Boolean(resourceId))
)
