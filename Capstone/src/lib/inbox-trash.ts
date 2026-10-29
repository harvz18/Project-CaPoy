import { supabase, supabaseConfig } from './supabase'

export type InboxItemType = 'conversation' | 'message' | 'notification'

export interface InboxItemState {
  itemId: string
  itemType: InboxItemType
  trashedAt?: string
}

export interface InboxTrashItem {
  createdAt: string
  id: string
  itemType: InboxItemType
  preview: string
  title: string
}

export interface InboxTrashResult {
  items?: InboxTrashItem[]
  message?: string
  ok: boolean
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = (value: string) => UUID_PATTERN.test(value)
const textFrom = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback
const messageFrom = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback

const getClientAndUser = async () => {
  if (!supabase || !supabaseConfig.isConfigured) return undefined
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user.id) return undefined
  return { client: supabase, userId: data.session.user.id }
}

const normalizeIds = (ids: string[]) => Array.from(new Set(ids.filter(isUuid))).slice(0, 100)

export const fetchMyInboxItemStates = async (): Promise<{
  message?: string
  ok: boolean
  states: InboxItemState[]
}> => {
  try {
    const context = await getClientAndUser()
    if (!context) return { ok: true, states: [] }

    const { data, error } = await context.client
      .from('user_inbox_item_states')
      .select('item_id, item_type, trashed_at, permanently_hidden_at')
      .eq('user_id', context.userId)
      .is('permanently_hidden_at', null)

    if (error) return { message: messageFrom(error, 'Unable to load Inbox state.'), ok: false, states: [] }

    return {
      ok: true,
      states: (data ?? []).flatMap((row) => {
        const itemType = textFrom(row.item_type)
        const itemId = textFrom(row.item_id)
        if (!isUuid(itemId) || !['conversation', 'message', 'notification'].includes(itemType)) return []
        return [{
          itemId,
          itemType: itemType as InboxItemType,
          trashedAt: textFrom(row.trashed_at) || undefined,
        }]
      }),
    }
  } catch (error) {
    return { message: messageFrom(error, 'Unable to load Inbox state.'), ok: false, states: [] }
  }
}

const mutateInboxItems = async (
  operation: 'clear' | 'restore' | 'trash',
  itemType: InboxItemType,
  ids: string[]
): Promise<InboxTrashResult> => {
  try {
    const targetIds = normalizeIds(ids)
    if (!targetIds.length) return { message: 'Choose at least one Inbox item.', ok: false }
    const context = await getClientAndUser()
    if (!context) return { message: 'Please sign in to manage Inbox items.', ok: false }

    const functionName = operation === 'trash'
      ? 'move_my_inbox_items_to_trash'
      : operation === 'restore'
        ? 'restore_my_inbox_items'
        : 'clear_my_inbox_items'
    const { error } = await context.client.rpc(functionName, {
      target_item_ids: targetIds,
      target_item_type: itemType,
    })
    return error
      ? { message: error.message, ok: false }
      : { ok: true }
  } catch (error) {
    return { message: messageFrom(error, 'Unable to update Inbox items.'), ok: false }
  }
}

export const moveMyInboxItemsToTrash = (itemType: InboxItemType, ids: string[]) =>
  mutateInboxItems('trash', itemType, ids)

export const restoreMyInboxItems = (itemType: InboxItemType, ids: string[]) =>
  mutateInboxItems('restore', itemType, ids)

export const clearMyInboxItems = (itemType: InboxItemType, ids: string[]) =>
  mutateInboxItems('clear', itemType, ids)

export const loadMyInboxTrash = async (): Promise<InboxTrashResult> => {
  try {
    const context = await getClientAndUser()
    if (!context) return { items: [], ok: true }
    const stateResult = await fetchMyInboxItemStates()
    if (!stateResult.ok) return { message: stateResult.message, ok: false }

    const idsByType = stateResult.states.reduce<Record<InboxItemType, string[]>>(
      (result, state) => {
        if (state.trashedAt) result[state.itemType].push(state.itemId)
        return result
      },
      { conversation: [], message: [], notification: [] }
    )
    const [conversationResult, messageResult, notificationResult] = await Promise.all([
      idsByType.conversation.length
        ? context.client.from('conversations').select('id, title, updated_at').in('id', idsByType.conversation)
        : Promise.resolve({ data: [], error: null }),
      idsByType.message.length
        ? context.client.from('messages').select('id, body, created_at').in('id', idsByType.message)
        : Promise.resolve({ data: [], error: null }),
      idsByType.notification.length
        ? context.client.from('notifications').select('id, title, body, created_at').eq('user_id', context.userId).in('id', idsByType.notification)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (conversationResult.error || messageResult.error || notificationResult.error) {
      return { message: 'Unable to load Inbox Trash.', ok: false }
    }

    const items: InboxTrashItem[] = [
      ...(conversationResult.data ?? []).map((row) => ({
        createdAt: textFrom(row.updated_at, new Date(0).toISOString()),
        id: textFrom(row.id),
        itemType: 'conversation' as const,
        preview: 'Conversation history',
        title: textFrom(row.title, 'Conversation'),
      })),
      ...(messageResult.data ?? []).map((row) => ({
        createdAt: textFrom(row.created_at, new Date(0).toISOString()),
        id: textFrom(row.id),
        itemType: 'message' as const,
        preview: textFrom(row.body, 'Message'),
        title: 'Message',
      })),
      ...(notificationResult.data ?? []).map((row) => ({
        createdAt: textFrom(row.created_at, new Date(0).toISOString()),
        id: textFrom(row.id),
        itemType: 'notification' as const,
        preview: textFrom(row.body),
        title: textFrom(row.title, 'Notification'),
      })),
    ].filter((item) => Boolean(item.id)).sort((left, right) => (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ))

    return { items, ok: true }
  } catch (error) {
    return { message: messageFrom(error, 'Unable to load Inbox Trash.'), ok: false }
  }
}
