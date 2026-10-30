import { supabase, supabaseConfig } from './supabase'
import { fetchMyInboxItemStates } from './inbox-trash'
import type { ClientConversation } from '../screens/03.1-Messages'
import type { ChatMessage } from '../screens/03.2-ChatThread'
import type {
  MerchantNotification,
  MerchantNotificationCategory,
} from '../screens/22.5-Notification'

type MessageResult = {
  message?: ChatMessage
  ok: boolean
  error?: string
}

type OpenConversationResult = {
  conversationId?: string
  error?: string
  ok: boolean
}

const getClient = () => {
  if (!supabase || !supabaseConfig.isConfigured) return null
  return supabase
}

const nested = (value: unknown) => (Array.isArray(value) ? value[0] : value)

const textFrom = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback

const getCurrentUserId = async () => {
  const client = getClient()
  if (!client) return null

  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

const toBookingStatus = (
  value: unknown
): ClientConversation['bookingStatus'] => {
  const status = textFrom(value)
  if (status === 'completed') return 'completed'
  if (['approved', 'paid', 'confirmed'].includes(status)) return 'confirmed'
  return 'pending'
}

const canSendBookingMessages = (value: unknown) =>
  ['confirmed', 'completed'].includes(textFrom(value).toLowerCase())

const canSendCoordinatorProviderMessages = (bookingStatus: unknown) =>
  ['requested', 'approved', 'payment_required', 'paid', 'confirmed', 'completed']
    .includes(textFrom(bookingStatus).toLowerCase())

const canSendEventCoordinatorMessages = (event: Record<string, unknown> | undefined) =>
  Boolean(
    event
      && textFrom(event.coordinator_assignment_status) === 'accepted'
      && textFrom(event.status) !== 'cancelled'
  )

const toNotificationCategory = (value: unknown): MerchantNotificationCategory => {
  const category = textFrom(value).toLowerCase()
  if (category.includes('booking')) return 'booking'
  if (category.includes('message') || category.includes('conversation')) return 'message'
  if (category.includes('payment') || category.includes('payout')) return 'payment'
  if (category.includes('remittance')) return 'payment'
  if (category.includes('review')) return 'review'
  return 'system'
}

export const mapNotificationRecord = (
  row: Record<string, unknown>
): MerchantNotification => ({
  actionLabel: 'View details',
  category: toNotificationCategory(row.resource_type),
  createdAt: textFrom(row.created_at, new Date().toISOString()),
  id: textFrom(row.id),
  // Older notification rows can contain differently-cased terminal statuses.
  // Normalize before deriving badges so a "Read" record never keeps Inbox lit.
  isRead: textFrom(row.status).trim().toLowerCase() === 'read',
  message: textFrom(row.body),
  resourceId: textFrom(row.resource_id) || undefined,
  resourceType: textFrom(row.resource_type) || undefined,
  title: textFrom(row.title, 'MULTIVENT update'),
})

export const fetchConversations = async (): Promise<ClientConversation[]> => {
  const client = getClient()
  const userId = await getCurrentUserId()
  if (!client || !userId) return []

  const { data: membershipRows, error: membershipError } = await client
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)

  if (membershipError || !membershipRows?.length) return []

  const conversationIds = membershipRows.map((row) => row.conversation_id as string)
  const [
    { data: conversationRows },
    { data: participantRows },
    { data: messageRows },
    { data: coordinatorBookingStatusRows },
  ] =
    await Promise.all([
      client
        .from('conversations')
        .select(
          'id, title, booking_id, conversation_kind, updated_at, bookings(id, status, requested_date, services(name, service_categories(name))), events(id, name, status, event_date, coordinator_id, coordinator_assignment_status, is_church_wedding)'
        )
        .in('id', conversationIds),
      client
        .from('conversation_participants')
        .select('conversation_id, user_id, profiles(full_name, avatar_url, default_role)')
        .in('conversation_id', conversationIds)
        .neq('user_id', userId),
      client
        .from('messages')
        .select('id, conversation_id, sender_id, body, read_at, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true }),
      // Coordinators deliberately receive booking status through this scoped
      // RPC. Their direct table access may not include the nested booking row
      // returned with a conversation, even when the server authorizes them to
      // message the selected provider.
      client.rpc('get_my_coordinator_booking_statuses'),
    ])

  const incomingMessageIds = (messageRows ?? []).flatMap((message) => (
    message.sender_id !== userId && typeof message.id === 'string' ? [message.id] : []
  ))
  // Read receipts are user-owned. Retain the legacy read_at fallback until
  // the additive receipt migration has been applied everywhere.
  const { data: receiptRows, error: receiptError } = incomingMessageIds.length
    ? await client
      .from('message_read_receipts')
      .select('message_id')
      .eq('user_id', userId)
      .in('message_id', incomingMessageIds)
    : { data: [], error: null }
  const readMessageIds = new Set(
    (receiptRows ?? []).flatMap((receipt) => (
      typeof receipt.message_id === 'string' ? [receipt.message_id] : []
    ))
  )
  const hasUserScopedReadReceipts = !receiptError
  const inboxStateResult = await fetchMyInboxItemStates()
  const trashedConversationIds = new Set(
    inboxStateResult.ok
      ? inboxStateResult.states
        .filter((state) => state.itemType === 'conversation' && Boolean(state.trashedAt))
        .map((state) => state.itemId)
      : []
  )
  const trashedMessageIds = new Set(
    inboxStateResult.ok
      ? inboxStateResult.states
        .filter((state) => state.itemType === 'message' && Boolean(state.trashedAt))
        .map((state) => state.itemId)
      : []
  )

  const participantUserIds = (participantRows ?? []).map((row) => row.user_id as string)
  const { data: providerRows } = participantUserIds.length
    ? await client
        .from('provider_profiles')
        .select('user_id, business_name, description')
        .in('user_id', participantUserIds)
    : { data: [] }

  const providersByUser = new Map(
    (providerRows ?? []).map((row) => [row.user_id as string, row as Record<string, unknown>])
  )
  const coordinatorBookingStatusesById = new Map<string, string>()
  for (const row of coordinatorBookingStatusRows ?? []) {
    const record = row as Record<string, unknown>
    const bookingId = textFrom(record.booking_id)
    if (bookingId) coordinatorBookingStatusesById.set(bookingId, textFrom(record.status))
  }
  const participantsByConversation = new Map<string, Array<Record<string, unknown>>>()
  for (const row of participantRows ?? []) {
    const conversationId = row.conversation_id as string
    const participants = participantsByConversation.get(conversationId) ?? []
    participants.push(row as Record<string, unknown>)
    participantsByConversation.set(conversationId, participants)
  }

  return (conversationRows ?? [])
    .filter((row) => !trashedConversationIds.has(textFrom((row as Record<string, unknown>).id)))
    .map((row) => {
      const record = row as Record<string, unknown>
      const conversationId = textFrom(record.id)
      const participants = participantsByConversation.get(conversationId) ?? []
      const participant =
        participants.find((candidate) => providersByUser.has(textFrom(candidate.user_id))) ??
        participants[0]
      const profile = nested(participant?.profiles) as Record<string, unknown> | undefined
      const provider = providersByUser.get(textFrom(participant?.user_id))
      const booking = nested(record.bookings) as Record<string, unknown> | undefined
      const event = nested(record.events) as Record<string, unknown> | undefined
      const service = nested(booking?.services) as Record<string, unknown> | undefined
      const serviceCategory = nested(service?.service_categories) as Record<string, unknown> | undefined
      const bookingId = textFrom(booking?.id, textFrom(record.booking_id))
      const bookingStatus = textFrom(
        booking?.status,
        coordinatorBookingStatusesById.get(bookingId)
      )
      const conversationKind = textFrom(record.conversation_kind)
      const isEventCoordinatorConversation = conversationKind === 'event_coordinator'
      const isCoordinatorProviderConversation = conversationKind === 'coordinator_provider'
      const isLegacyCoordinatorGroup = conversationKind === 'booking'
        && textFrom(event?.coordinator_id) === userId
      // Preserve the confirmed-booking rule for every provider conversation:
      // isReadOnly: booking ? !canSendBookingMessages(booking.status) : true
      const bookingReadOnly = bookingStatus ? !canSendBookingMessages(bookingStatus) : true
      const messages = (messageRows ?? []).filter(
        (message) => message.conversation_id === conversationId
          && !trashedMessageIds.has(textFrom(message.id))
      )
      const lastMessage = messages[messages.length - 1]
      const participantName = textFrom(
        provider?.business_name,
        textFrom(profile?.full_name, 'Multivent member')
      )

      return {
        avatarUrl: textFrom(profile?.avatar_url) || undefined,
        bookingDate: textFrom(booking?.requested_date, textFrom(event?.event_date)) || undefined,
        bookingId: bookingId || undefined,
        bookingReference: bookingId
          ? `Booking #${bookingId.slice(0, 8).toUpperCase()}`
          : isEventCoordinatorConversation ? 'Event coordinator' : undefined,
        bookingStatus: bookingStatus
          ? toBookingStatus(bookingStatus)
          : isEventCoordinatorConversation ? 'confirmed' : undefined,
        conversationKind: isEventCoordinatorConversation
          ? 'event_coordinator'
          : isCoordinatorProviderConversation
            ? 'coordinator_provider'
            : 'booking',
        eventDate: textFrom(event?.event_date) || undefined,
        eventId: textFrom(event?.id) || undefined,
        eventName: textFrom(event?.name, textFrom(record.title, 'Event')),
        eventStatus: textFrom(event?.status) || undefined,
        id: conversationId,
        isReadOnly: isEventCoordinatorConversation
          ? !canSendEventCoordinatorMessages(event)
          : isCoordinatorProviderConversation
            ? !canSendCoordinatorProviderMessages(bookingStatus)
            : bookingReadOnly || isLegacyCoordinatorGroup,
        lastMessage: textFrom(lastMessage?.body, 'Conversation started.'),
        lastMessageAt: textFrom(lastMessage?.created_at, textFrom(record.updated_at)),
        participantName,
        participantRole: textFrom(
          provider?.description,
          textFrom(profile?.default_role, 'Service provider').replaceAll('_', ' ')
        ),
        participantUserId: textFrom(participant?.user_id) || undefined,
        serviceCategory: isEventCoordinatorConversation
          ? 'Coordinator'
          : textFrom(serviceCategory?.name) || undefined,
        serviceName: isEventCoordinatorConversation
          ? 'Event coordinator'
          : textFrom(service?.name, textFrom(record.title, 'Service inquiry')),
        unreadCount: messages.filter(
          (message) => message.sender_id !== userId
            && (hasUserScopedReadReceipts
              ? !readMessageIds.has(textFrom(message.id))
              : !message.read_at)
        ).length,
      } satisfies ClientConversation
    })
    .sort(
      (left, right) =>
        new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
    )
}

export const openBookingConversation = async (
  bookingId: string
): Promise<OpenConversationResult> => {
  const client = getClient()
  if (!client || !bookingId) {
    return { error: 'Unable to open this booking conversation.', ok: false }
  }

  const { data, error } = await client.rpc('open_booking_conversation', {
    target_booking_id: bookingId,
  })

  if (error) return { error: error.message, ok: false }

  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {}
  const conversationId = textFrom(payload.conversation_id)

  return conversationId
    ? { conversationId, ok: true }
    : { error: 'The booking conversation could not be opened.', ok: false }
}

export const openEventCoordinatorConversation = async (
  eventId: string
): Promise<OpenConversationResult> => {
  const client = getClient()
  if (!client || !eventId) {
    return { error: 'Unable to open this event coordinator conversation.', ok: false }
  }

  const { data, error } = await client.rpc('open_event_coordinator_conversation', {
    target_event_id: eventId,
  })
  if (error) return { error: error.message, ok: false }
  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {}
  const conversationId = textFrom(payload.conversation_id)
  return conversationId
    ? { conversationId, ok: true }
    : { error: 'The event coordinator conversation could not be opened.', ok: false }
}

export const openCoordinatorProviderConversation = async (
  bookingId: string
): Promise<OpenConversationResult> => {
  const client = getClient()
  if (!client || !bookingId) {
    return { error: 'Unable to open this coordinator and provider conversation.', ok: false }
  }

  const { data, error } = await client.rpc('open_coordinator_provider_conversation', {
    target_booking_id: bookingId,
  })
  if (error) return { error: error.message, ok: false }
  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {}
  const conversationId = textFrom(payload.conversation_id)
  return conversationId
    ? { conversationId, ok: true }
    : { error: 'The coordinator and provider conversation could not be opened.', ok: false }
}

export const fetchConversationMessages = async (
  conversationId: string
): Promise<ChatMessage[]> => {
  const client = getClient()
  const userId = await getCurrentUserId()
  if (!client || !userId || !conversationId) return []

  const { data, error } = await client
    .from('messages')
    .select('id, sender_id, body, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  const inboxStateResult = await fetchMyInboxItemStates()
  const trashedMessageIds = new Set(
    inboxStateResult.ok
      ? inboxStateResult.states
        .filter((state) => state.itemType === 'message' && Boolean(state.trashedAt))
        .map((state) => state.itemId)
      : []
  )

  return data.filter((row) => !trashedMessageIds.has(textFrom(row.id))).map((row) => ({
    createdAt: row.created_at,
    id: row.id,
    sender: row.sender_id === userId ? 'currentUser' : 'participant',
    status: row.sender_id === userId ? (row.read_at ? 'read' : 'delivered') : undefined,
    text: row.body,
  }))
}

export const markConversationRead = async (conversationId: string) => {
  const client = getClient()
  if (!client || !conversationId) return false

  const { error } = await client.rpc('mark_booking_conversation_read', {
    target_conversation_id: conversationId,
  })

  return !error
}

export const markConversationMessageNotificationsRead = async (conversationId: string) => {
  const client = getClient()
  const userId = await getCurrentUserId()
  if (!client || !userId || !conversationId) return false

  // A conversation read only clears the matching recipient's duplicate
  // message alerts. Booking, payment, and every other notification remain
  // untouched for this and all other users.
  const { error } = await client
    .from('notifications')
    .update({ status: 'read' })
    .eq('user_id', userId)
    .eq('resource_id', conversationId)
    .in('resource_type', ['message', 'conversation'])
    .neq('status', 'read')

  return !error
}

export const sendConversationMessage = async (
  conversationId: string,
  body: string
): Promise<MessageResult> => {
  const client = getClient()
  const normalizedBody = body.trim()

  if (!client || !conversationId || !normalizedBody) {
    return { ok: false, error: 'Unable to send this message.' }
  }

  const { data, error } = await client.rpc('send_booking_message', {
    message_body: normalizedBody,
    target_conversation_id: conversationId,
  })

  if (error || !data) return { ok: false, error: error?.message }

  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {}
  const messageId = textFrom(payload.id)
  const messageBody = textFrom(payload.body)
  const createdAt = textFrom(payload.created_at)

  if (!messageId || !messageBody || !createdAt) {
    return { ok: false, error: 'The message was saved but its delivery details could not be loaded.' }
  }

  return {
    message: {
      createdAt,
      id: messageId,
      sender: 'currentUser',
      status: 'sent',
      text: messageBody,
    },
    ok: true,
  }
}

export const fetchNotifications = async (): Promise<MerchantNotification[]> => {
  const client = getClient()
  const userId = await getCurrentUserId()
  if (!client || !userId) return []

  const { data, error } = await client
    .from('notifications')
    .select('id, title, body, resource_type, resource_id, status, created_at')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const inboxStateResult = await fetchMyInboxItemStates()
  const trashedNotificationIds = new Set(
    inboxStateResult.ok
      ? inboxStateResult.states
        .filter((state) => state.itemType === 'notification' && Boolean(state.trashedAt))
        .map((state) => state.itemId)
      : []
  )

  return data
    .filter((row) => !trashedNotificationIds.has(textFrom(row.id)))
    .map((row) => mapNotificationRecord(row))
}
