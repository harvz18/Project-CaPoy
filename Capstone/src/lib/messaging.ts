import { supabase, supabaseConfig } from './supabase'
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

const toNotificationCategory = (value: unknown): MerchantNotificationCategory => {
  const category = textFrom(value).toLowerCase()
  if (category.includes('booking')) return 'booking'
  if (category.includes('message') || category.includes('conversation')) return 'message'
  if (category.includes('payment') || category.includes('payout')) return 'payment'
  if (category.includes('review')) return 'review'
  return 'system'
}

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
  const [{ data: conversationRows }, { data: participantRows }, { data: messageRows }] =
    await Promise.all([
      client
        .from('conversations')
        .select(
          'id, title, booking_id, updated_at, bookings(id, status, requested_date, services(name))'
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
    ])

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
  const participantsByConversation = new Map<string, Array<Record<string, unknown>>>()
  for (const row of participantRows ?? []) {
    const conversationId = row.conversation_id as string
    const participants = participantsByConversation.get(conversationId) ?? []
    participants.push(row as Record<string, unknown>)
    participantsByConversation.set(conversationId, participants)
  }

  return (conversationRows ?? [])
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
      const service = nested(booking?.services) as Record<string, unknown> | undefined
      const messages = (messageRows ?? []).filter(
        (message) => message.conversation_id === conversationId
      )
      const lastMessage = messages[messages.length - 1]
      const participantName = textFrom(
        provider?.business_name,
        textFrom(profile?.full_name, 'Multivent member')
      )

      return {
        avatarUrl: textFrom(profile?.avatar_url) || undefined,
        bookingDate: textFrom(booking?.requested_date) || undefined,
        bookingId: textFrom(booking?.id) || undefined,
        bookingReference: booking?.id
          ? `Booking #${textFrom(booking.id).slice(0, 8).toUpperCase()}`
          : undefined,
        bookingStatus: booking ? toBookingStatus(booking.status) : undefined,
        id: conversationId,
        lastMessage: textFrom(lastMessage?.body, 'Conversation started.'),
        lastMessageAt: textFrom(lastMessage?.created_at, textFrom(record.updated_at)),
        participantName,
        participantRole: textFrom(
          provider?.description,
          textFrom(profile?.default_role, 'Service provider').replaceAll('_', ' ')
        ),
        participantUserId: textFrom(participant?.user_id) || undefined,
        serviceName: textFrom(service?.name, textFrom(record.title, 'Service inquiry')),
        unreadCount: messages.filter(
          (message) => message.sender_id !== userId && !message.read_at
        ).length,
      } satisfies ClientConversation
    })
    .sort(
      (left, right) =>
        new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
    )
}

export const openCoordinatorProviderConversation = async (
  bookingId: string
): Promise<OpenConversationResult> => {
  const client = getClient()
  if (!client || !bookingId) {
    return { error: 'Unable to open this provider conversation.', ok: false }
  }

  const { data, error } = await client.rpc('open_coordinator_provider_conversation', {
    target_booking_id: bookingId,
  })

  if (error) return { error: error.message, ok: false }

  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {}
  const conversationId = textFrom(payload.conversation_id)

  return conversationId
    ? { conversationId, ok: true }
    : { error: 'The provider conversation could not be opened.', ok: false }
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

  return data.map((row) => ({
    createdAt: row.created_at,
    id: row.id,
    sender: row.sender_id === userId ? 'currentUser' : 'participant',
    status: row.sender_id === userId ? (row.read_at ? 'read' : 'delivered') : undefined,
    text: row.body,
  }))
}

export const markConversationRead = async (conversationId: string) => {
  const client = getClient()
  const userId = await getCurrentUserId()
  if (!client || !userId || !conversationId) return false

  const { error } = await client
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null)

  return !error
}

export const sendConversationMessage = async (
  conversationId: string,
  body: string
): Promise<MessageResult> => {
  const client = getClient()
  const userId = await getCurrentUserId()
  const normalizedBody = body.trim()

  if (!client || !userId || !conversationId || !normalizedBody) {
    return { ok: false, error: 'Unable to send this message.' }
  }

  const { data, error } = await client
    .from('messages')
    .insert({ body: normalizedBody, conversation_id: conversationId, sender_id: userId })
    .select('id, body, created_at')
    .single()

  if (error || !data) return { ok: false, error: error?.message }

  await client
    .from('conversations')
    .update({ updated_at: data.created_at })
    .eq('id', conversationId)

  const { data: recipients } = await client
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', userId)

  if (recipients?.length) {
    await client.from('notifications').insert(
      recipients.map((recipient) => ({
        body: normalizedBody.slice(0, 180),
        resource_id: conversationId,
        resource_type: 'message',
        title: 'New message',
        user_id: recipient.user_id,
      }))
    )
  }

  return {
    message: {
      createdAt: data.created_at,
      id: data.id,
      sender: 'currentUser',
      status: 'sent',
      text: data.body,
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
    .select('id, title, body, resource_type, status, created_at')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => ({
    actionLabel: 'View details',
    category: toNotificationCategory(row.resource_type),
    createdAt: row.created_at,
    id: row.id,
    isRead: row.status === 'read',
    message: textFrom(row.body),
    title: row.title,
  }))
}
