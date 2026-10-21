import { Text } from '../components/AppText'
import {
  CoordinatorBottomNavigation,
  type CoordinatorMainTab,
} from '../components/CoordinatorBottomNavigation'
import { MerchantBottomNavigation } from '../components/MerchantBottomNavigation'
import { MerchantWorkspaceHeader } from '../components/MerchantWorkspaceHeader'
import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import type { ClientHomeTab } from './03-ClientHome'
import type { MerchantHomeTab } from './16-MerchantHome'
import type { BookingItem } from './11-BookingScreen'
import type { CoordinatorEvent } from '../lib/coordinator'

export type ClientConversationFilter = 'all' | 'unread' | 'bookings'

export interface ClientConversation {
  avatarUrl?: string
  bookingDate?: string
  bookingId?: string
  bookingReference?: string
  bookingStatus?: 'pending' | 'confirmed' | 'completed'
  conversationKind?: 'booking' | 'coordinator_provider' | 'event_coordinator'
  eventDate?: string
  eventId?: string
  eventName?: string
  eventStatus?: string
  id: string
  isOnline?: boolean
  isPinned?: boolean
  isReadOnly?: boolean
  lastMessage: string
  lastMessageAt: string
  participantName: string
  participantRole: string
  participantUserId?: string
  serviceName?: string
  unreadCount: number
  isVirtualCoordinator?: boolean
}

interface MessagesScreenProps {
  conversations?: ClientConversation[]
  clientBookings?: BookingItem[]
  coordinatorEvents?: CoordinatorEvent[]
  hasUnreadNotifications?: boolean
  initialFilter?: ClientConversationFilter
  showBottomNavigation?: boolean
  onMarkRead?: (conversation: ClientConversation) => void
  onBack?: () => void
  onNewMessage?: () => void
  onOpenNotifications?: () => void
  onOpenProfile?: () => void
  onOpenEventCoordinatorForEvent?: (eventId: string) => void
  onSelectCoordinatorTab?: (tab: CoordinatorMainTab) => void
  onSearchChange?: (value: string) => void
  onSelectConversation?: (conversation: ClientConversation) => void
  navigationVariant?: 'client' | 'coordinator' | 'merchant'
  onSelectTab?: (tab: ClientHomeTab | MerchantHomeTab) => void
  searchValue?: string
  userAvatarUrl?: string
  userName?: string
}

const filterOptions: Array<{ id: ClientConversationFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'bookings', label: 'Bookings' },
]

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'M'

const toLocalDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const formatConversationTime = (value: string) => {
  const date = new Date(value)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (toLocalDateKey(date) === toLocalDateKey(now)) {
    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  if (toLocalDateKey(date) === toLocalDateKey(yesterday)) return 'Yesterday'

  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

const BellIcon = () => (
  <View style={styles.bellIcon}>
    <View style={styles.bellDome} />
    <View style={styles.bellClapper} />
  </View>
)

const SearchIcon = () => (
  <View style={styles.searchIcon}>
    <View style={styles.searchLens} />
    <View style={styles.searchHandle} />
  </View>
)

type EventConversationGroup = {
  conversations: ClientConversation[]
  date?: string
  id: string
  name: string
}

const formatEventDate = (value?: string) => {
  if (!value) return 'Date to be confirmed'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  conversations = [],
  clientBookings = [],
  coordinatorEvents = [],
  hasUnreadNotifications = false,
  initialFilter = 'all',
  navigationVariant = 'client',
  showBottomNavigation = true,
  onBack,
  onMarkRead,
  onNewMessage,
  onOpenNotifications,
  onOpenProfile,
  onOpenEventCoordinatorForEvent,
  onSelectCoordinatorTab,
  onSearchChange,
  onSelectConversation,
  onSelectTab,
  searchValue,
  userAvatarUrl,
  userName = 'Planner',
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 760
  const isCompact = width < 390
  const [filter, setFilter] = React.useState<ClientConversationFilter>(initialFilter)
  const [internalSearch, setInternalSearch] = React.useState('')
  const [selectedEventId, setSelectedEventId] = React.useState<string>()
  const [readIds, setReadIds] = React.useState(
    () => new Set(conversations.filter((item) => item.unreadCount === 0).map((item) => item.id))
  )
  React.useEffect(() => {
    setReadIds((current) => {
      const next = new Set(current)
      conversations.forEach((conversation) => {
        if (conversation.unreadCount > 0) next.delete(conversation.id)
        else next.add(conversation.id)
      })
      return next
    })
  }, [conversations])
  const query = searchValue ?? internalSearch
  const normalizedQuery = query.trim().toLowerCase()
  // Every role works from event-scoped conversations. Providers may have
  // several direct threads for the same event, so grouping first keeps their
  // inbox consistent with the client and coordinator workspaces.
  const usesEventGroups = true
  const unreadCount = conversations.reduce(
    (count, conversation) => count + (readIds.has(conversation.id) ? 0 : conversation.unreadCount),
    0
  )
  const eventGroups = React.useMemo(() => {
    const groups = new Map<string, EventConversationGroup>()
    const addConversation = (conversation: ClientConversation) => {
      const eventId = conversation.eventId
      if (!eventId) return
      const current = groups.get(eventId) ?? {
        conversations: [],
        date: conversation.eventDate,
        id: eventId,
        name: conversation.eventName || 'Event',
      }
      current.conversations.push(conversation)
      if (!current.date && conversation.eventDate) current.date = conversation.eventDate
      if (current.name === 'Event' && conversation.eventName) current.name = conversation.eventName
      groups.set(eventId, current)
    }

    conversations.forEach(addConversation)

    for (const booking of clientBookings) {
      const eventId = booking.eventId
      const hasAcceptedCoordinator =
        booking.coordinatorAssignmentStatus === 'accepted' && Boolean(booking.coordinatorUserId)
      if (!eventId || !hasAcceptedCoordinator) continue

      const current = groups.get(eventId) ?? {
        conversations: [],
        date: booking.date,
        id: eventId,
        name: booking.name || 'Event',
      }
      const hasCoordinatorConversation = current.conversations.some(
        (conversation) => conversation.conversationKind === 'event_coordinator'
      )
      if (!hasCoordinatorConversation) {
        current.conversations.push({
          avatarUrl: booking.coordinatorAvatarUrl,
          bookingReference: 'Event coordinator',
          bookingStatus: 'confirmed',
          conversationKind: 'event_coordinator',
          eventDate: booking.date,
          eventId,
          eventName: booking.name,
          eventStatus: booking.rawStatus,
          id: `event-coordinator:${eventId}`,
          isVirtualCoordinator: true,
          lastMessage: 'Start a direct conversation with your event coordinator.',
          lastMessageAt: booking.updatedAt || booking.createdAt || new Date(0).toISOString(),
          participantName: booking.coordinatorName || 'Event Coordinator',
          participantRole: 'Event coordinator',
          participantUserId: booking.coordinatorUserId,
          serviceName: 'Event coordinator',
          unreadCount: 0,
        })
      }
      groups.set(eventId, current)
    }

    for (const event of coordinatorEvents) {
      const current = groups.get(event.id) ?? {
        conversations: [],
        date: event.date,
        id: event.id,
        name: event.name || 'Event',
      }
      const hasClientConversation = current.conversations.some(
        (conversation) => conversation.conversationKind === 'event_coordinator'
      )
      if (!hasClientConversation) {
        current.conversations.push({
          bookingReference: 'Event client',
          bookingStatus: 'confirmed',
          conversationKind: 'event_coordinator',
          eventDate: event.date,
          eventId: event.id,
          eventName: event.name,
          eventStatus: event.status,
          id: `event-coordinator:${event.id}`,
          isVirtualCoordinator: true,
          lastMessage: 'Start a direct conversation with this event client.',
          lastMessageAt: event.date || new Date(0).toISOString(),
          participantName: event.clientName || 'Event client',
          participantRole: 'Client',
          serviceName: 'Event client',
          unreadCount: 0,
        })
      }
      groups.set(event.id, current)
    }

    return Array.from(groups.values()).sort((left, right) => {
      const latestLeft = Math.max(...left.conversations.map((item) => new Date(item.lastMessageAt).getTime()))
      const latestRight = Math.max(...right.conversations.map((item) => new Date(item.lastMessageAt).getTime()))
      return latestRight - latestLeft
    })
  }, [clientBookings, conversations, coordinatorEvents])
  const selectedEvent = eventGroups.find((group) => group.id === selectedEventId)
  const conversationSource = usesEventGroups
    ? selectedEvent?.conversations ?? []
    : conversations
  const visibleConversations = conversationSource.filter((conversation) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && !readIds.has(conversation.id) && conversation.unreadCount > 0) ||
      (filter === 'bookings' && Boolean(conversation.bookingReference))
    const matchesSearch =
      !normalizedQuery ||
      conversation.participantName.toLowerCase().includes(normalizedQuery) ||
      conversation.participantRole.toLowerCase().includes(normalizedQuery) ||
      conversation.lastMessage.toLowerCase().includes(normalizedQuery) ||
      conversation.bookingReference?.toLowerCase().includes(normalizedQuery)

    return matchesFilter && matchesSearch
  })
  const changeSearch = (value: string) => {
    if (searchValue === undefined) setInternalSearch(value)
    onSearchChange?.(value)
  }

  const selectConversation = (conversation: ClientConversation) => {
    if (conversation.isVirtualCoordinator && conversation.eventId) {
      onOpenEventCoordinatorForEvent?.(conversation.eventId)
      return
    }
    if (!readIds.has(conversation.id) && conversation.unreadCount > 0) {
      const readConversation = { ...conversation, unreadCount: 0 }
      setReadIds((current) => new Set(current).add(conversation.id))
      onMarkRead?.(readConversation)
      onSelectConversation?.(readConversation)
      return
    }

    onSelectConversation?.(conversation)
  }

  const visibleEventGroups = eventGroups.filter((group) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && group.conversations.some(
        (conversation) => !readIds.has(conversation.id) && conversation.unreadCount > 0
      )) ||
      (filter === 'bookings' && group.conversations.some((conversation) => Boolean(conversation.bookingReference)))
    const matchesSearch =
      !normalizedQuery ||
      group.name.toLowerCase().includes(normalizedQuery) ||
      group.conversations.some((conversation) =>
        conversation.participantName.toLowerCase().includes(normalizedQuery) ||
        conversation.participantRole.toLowerCase().includes(normalizedQuery) ||
        conversation.serviceName?.toLowerCase().includes(normalizedQuery)
      )
    return matchesFilter && matchesSearch
  })

  return (
    <View style={styles.screen}>
      {navigationVariant === 'merchant' ? (
        <MerchantWorkspaceHeader
          hasUnreadNotifications={hasUnreadNotifications}
          onOpenNotifications={onOpenNotifications}
        />
      ) : (
        <View style={[
          styles.topAppBar,
          usesEventGroups && styles.clientTopAppBar,
        ]}>
          <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
            {usesEventGroups ? (
            <>
              {navigationVariant === 'coordinator' ? (
                <Pressable
                  accessibilityLabel="Back to coordinator workspace"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onBack}
                  style={({ pressed }) => [styles.clientHeaderButton, pressed && styles.surfacePressed]}
                >
                  <Text style={styles.coordinatorBackIcon}>{'\u2039'}</Text>
                </Pressable>
              ) : <View style={styles.clientHeaderButton} />}
              <Text style={styles.clientHeaderTitle}>MESSAGES</Text>
              {navigationVariant === 'coordinator' ? (
                <Pressable
                  accessibilityLabel="Open notifications"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onOpenNotifications}
                  style={({ pressed }) => [styles.clientHeaderButton, pressed && styles.surfacePressed]}
                >
                  <BellIcon />
                  {hasUnreadNotifications ? <View style={styles.notificationDot} /> : null}
                </Pressable>
              ) : <View style={styles.clientHeaderButton} />}
            </>
          ) : (
            <>
              <Pressable
                accessibilityLabel="Open profile"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onOpenProfile}
                style={({ pressed }) => pressed && styles.surfacePressed}
              >
                <View style={styles.userAvatar}>
                  {userAvatarUrl ? (
                    <Image
                      accessibilityLabel={`${userName} profile photo`}
                      resizeMode="cover"
                      source={{ uri: userAvatarUrl }}
                      style={styles.userAvatarImage}
                    />
                  ) : (
                    <Text style={styles.userAvatarText}>{getInitials(userName).charAt(0)}</Text>
                  )}
                </View>
              </Pressable>
              <Text style={styles.brand}>MULTIVENT</Text>
              <Pressable
                accessibilityLabel="Open notifications"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onOpenNotifications}
                style={({ pressed }) => [styles.notificationButton, pressed && styles.surfacePressed]}
              >
                <BellIcon />
                {hasUnreadNotifications ? <View style={styles.notificationDot} /> : null}
              </Pressable>
            </>
            )}
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Messages</Text>
              {unreadCount ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.subtitle}>
              {usesEventGroups
                ? selectedEvent
                  ? 'Direct conversations for this event.'
                  : navigationVariant === 'coordinator'
                    ? 'Choose an event to message its client or confirmed providers.'
                    : 'Choose an event to see its booked service conversations.'
                : 'Only people connected through a booking can message here.'}
            </Text>
          </View>
          {navigationVariant === 'merchant' ? (
            <Pressable
              accessibilityRole="button"
              onPress={onNewMessage}
              style={({ pressed }) => [styles.newMessageButton, pressed && styles.primaryPressed]}
            >
              <Text style={styles.newMessagePlus}>+</Text>
              <Text style={styles.newMessageText}>{isCompact ? 'New' : 'New message'}</Text>
            </Pressable>
          ) : null}
        </View>

        {usesEventGroups && selectedEvent ? (
          <Pressable
            accessibilityLabel="Back to events"
            accessibilityRole="button"
            onPress={() => setSelectedEventId(undefined)}
            style={({ pressed }) => [styles.eventBackButton, pressed && styles.surfacePressed]}
          >
            <Text style={styles.eventBackText}>{'\u2039'} All events</Text>
            <Text numberOfLines={1} style={styles.eventBackName}>{selectedEvent.name}</Text>
          </Pressable>
        ) : null}

        <View style={styles.searchShell}>
          <SearchIcon />
          <TextInput
            accessibilityLabel="Search conversations"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={changeSearch}
            placeholder="Search people, services, or bookings"
            placeholderTextColor={palette.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query.length ? (
            <Pressable
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => changeSearch('')}
              style={({ pressed }) => [styles.clearSearch, pressed && styles.surfacePressed]}
            >
              <Text style={styles.clearSearchText}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterBar}>
          {filterOptions.map((option) => {
            const selected = filter === option.id
            const count =
              option.id === 'unread'
                ? conversations.filter(
                    (conversation) =>
                      !readIds.has(conversation.id) && conversation.unreadCount > 0
                  ).length
                : undefined
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(option.id)}
                style={({ pressed }) => [
                  styles.filterButton,
                  selected && styles.filterButtonSelected,
                  pressed && styles.filterButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selected && styles.filterButtonTextSelected,
                  ]}
                >
                  {option.label}
                  {count !== undefined ? ` (${count})` : ''}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {usesEventGroups && !selectedEvent ? (
          visibleEventGroups.length ? (
            <View style={styles.eventCardList}>
              {visibleEventGroups.map((group) => {
                const unread = group.conversations.reduce(
                  (count, conversation) => count + (readIds.has(conversation.id) ? 0 : conversation.unreadCount),
                  0
                )
                return (
                  <Pressable
                    accessibilityLabel={`Open ${group.name} messages`}
                    accessibilityRole="button"
                    key={group.id}
                    onPress={() => setSelectedEventId(group.id)}
                    style={({ pressed }) => [styles.eventCard, pressed && styles.conversationRowPressed]}
                  >
                    <View style={styles.eventCardCopy}>
                      <Text numberOfLines={1} style={styles.eventName}>{group.name}</Text>
                      <Text style={styles.eventDate}>{formatEventDate(group.date)}</Text>
                      <Text style={styles.eventAvailability}>
                        {group.conversations.length} available conversation{group.conversations.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <View style={styles.eventOpenArea}>
                      {unread ? <View style={styles.eventUnreadBadge}><Text style={styles.eventUnreadText}>{unread}</Text></View> : null}
                      <Text style={styles.eventOpenText}>Open event ›</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <MessageEmptyState
              filter={filter}
              normalizedQuery={normalizedQuery}
              showAction={false}
            />
          )
        ) : visibleConversations.length ? (
          <View style={styles.conversationCard}>
            {visibleConversations.map((conversation, index) => (
              <ConversationRow
                conversation={conversation}
                isCompact={isCompact}
                isRead={readIds.has(conversation.id)}
                key={conversation.id}
                last={index === visibleConversations.length - 1}
                onPress={selectConversation}
              />
            ))}
          </View>
        ) : (
          <MessageEmptyState
            filter={filter}
            normalizedQuery={normalizedQuery}
            onAction={onNewMessage}
            showAction={navigationVariant === 'merchant'}
          />
        )}
      </ScrollView>

      {navigationVariant === 'coordinator' && showBottomNavigation && !isWide ? (
        <CoordinatorBottomNavigation
          activeTab="messages"
          onSelectTab={onSelectCoordinatorTab}
        />
      ) : navigationVariant === 'merchant' && showBottomNavigation && !isWide ? (
        <MerchantBottomNavigation
          activeTab="messages"
          onSelectTab={(tab) => onSelectTab?.(tab)}
        />
      ) : null}
    </View>
  )
}

const MessageEmptyState = ({
  filter,
  normalizedQuery,
  onAction,
  showAction,
}: {
  filter: ClientConversationFilter
  normalizedQuery: string
  onAction?: () => void
  showAction: boolean
}) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyMessageIcon}>
      <View style={styles.emptyMessageBody} />
      <View style={styles.emptyMessageTail} />
    </View>
    <Text style={styles.emptyTitle}>
      {normalizedQuery
        ? 'No conversations found'
        : filter === 'unread'
          ? 'You are all caught up'
          : filter === 'bookings'
            ? 'No booking conversations'
            : 'No messages yet'}
    </Text>
    <Text style={styles.emptyText}>
      {normalizedQuery
        ? 'Try a different event, provider, or service.'
        : 'Your authorized conversations will appear here after a booking is confirmed.'}
    </Text>
    {showAction && !normalizedQuery && filter === 'all' ? (
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.emptyButton, pressed && styles.primaryPressed]}
      >
        <Text style={styles.emptyButtonText}>View services</Text>
      </Pressable>
    ) : null}
  </View>
)

const ConversationRow = ({
  conversation,
  isCompact,
  isRead,
  last,
  onPress,
}: {
  conversation: ClientConversation
  isCompact: boolean
  isRead: boolean
  last: boolean
  onPress: (conversation: ClientConversation) => void
}) => {
  const isUnread = !isRead && conversation.unreadCount > 0

  return (
    <Pressable
      accessibilityLabel={`${isUnread ? `${conversation.unreadCount} unread. ` : ''}${conversation.participantName}. ${conversation.lastMessage}`}
      accessibilityRole="button"
      onPress={() => onPress(conversation)}
      style={({ pressed }) => [
        styles.conversationRow,
        isUnread && styles.conversationRowUnread,
        !last && styles.conversationRowBorder,
        pressed && styles.conversationRowPressed,
      ]}
    >
      <View style={styles.avatarContainer}>
        {conversation.avatarUrl ? (
          <Image
            accessibilityLabel={`${conversation.participantName} profile photo`}
            source={{ uri: conversation.avatarUrl }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{getInitials(conversation.participantName)}</Text>
          </View>
        )}
        {conversation.isOnline ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.conversationCopy}>
        <View style={styles.conversationTitleRow}>
          <Text
            numberOfLines={1}
            style={[styles.participantName, isUnread && styles.participantNameUnread]}
          >
            {conversation.participantName}
          </Text>
          <Text style={[styles.conversationTime, isUnread && styles.conversationTimeUnread]}>
            {formatConversationTime(conversation.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.roleRow}>
          <Text numberOfLines={1} style={styles.participantRole}>
            {conversation.participantRole}
          </Text>
          {conversation.isPinned ? <Text style={styles.pinGlyph}>{'\u25C6'}</Text> : null}
          {!isCompact && conversation.bookingReference ? (
            <View style={styles.bookingBadge}>
              <Text numberOfLines={1} style={styles.bookingBadgeText}>
                {conversation.bookingReference}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.previewRow}>
          <Text
            numberOfLines={1}
            style={[styles.lastMessage, isUnread && styles.lastMessageUnread]}
          >
            {conversation.lastMessage}
          </Text>
          {isUnread ? (
            <View style={styles.messageCountBadge}>
              <Text style={styles.messageCountText}>{conversation.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  muted: '#777879',
  onPrimary: '#FFFFFF',
  positive: '#2F6B46',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerLow: '#F5F3F3',
  text: '#1B1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: { zIndex: 30, minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.background },
  clientTopAppBar: { borderBottomColor: palette.primary, backgroundColor: palette.primaryContainer },
  topAppBarContent: { width: '100%', maxWidth: 1200, minHeight: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  horizontalPaddingWide: { paddingHorizontal: 64 },
  clientHeaderButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  clientHeaderTitle: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center' },
  coordinatorBackIcon: { color: palette.white, fontSize: 32, lineHeight: 34, fontWeight: '300' },
  userAvatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: palette.primaryContainer },
  userAvatarImage: { width: '100%', height: '100%', borderRadius: 19 },
  userAvatarText: { color: palette.onPrimary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  brand: { color: palette.primary, fontSize: 17, lineHeight: 23, fontWeight: '800', letterSpacing: 2.3 },
  notificationButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  surfacePressed: { opacity: 0.62, backgroundColor: palette.surfaceContainerLow },
  bellIcon: { width: 18, height: 20, alignItems: 'center' },
  bellDome: { width: 15, height: 16, borderWidth: 1.5, borderColor: palette.primary, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  bellClapper: { position: 'absolute', width: 6, height: 2, bottom: 1, borderRadius: 1, backgroundColor: palette.primary },
  notificationDot: { position: 'absolute', width: 9, height: 9, top: 5, right: 5, borderWidth: 2, borderColor: palette.background, borderRadius: 5, backgroundColor: palette.primaryContainer },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 108 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 112 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headingCopy: { minWidth: 0, flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: palette.text, fontSize: 24, lineHeight: 31, fontWeight: '700' },
  unreadBadge: { minWidth: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: palette.primaryContainer, paddingHorizontal: 6 },
  unreadBadgeText: { color: palette.onPrimary, fontSize: 9, lineHeight: 12, fontWeight: '700' },
  subtitle: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 3 },
  newMessageButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: palette.primaryContainer, paddingHorizontal: 15 },
  primaryPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  newMessagePlus: { color: palette.onPrimary, fontSize: 19, lineHeight: 21, fontWeight: '400' },
  newMessageText: { color: palette.onPrimary, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  eventBackButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingHorizontal: 4 },
  eventBackText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  eventBackName: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  searchShell: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 9, backgroundColor: palette.white, paddingHorizontal: 14, marginTop: 20 },
  searchIcon: { width: 18, height: 18 },
  searchLens: { width: 12, height: 12, borderWidth: 1.5, borderColor: palette.secondary, borderRadius: 6 },
  searchHandle: { position: 'absolute', width: 7, height: 1.5, right: 0, bottom: 3, borderRadius: 1, backgroundColor: palette.secondary, transform: [{ rotate: '45deg' }] },
  searchInput: { minWidth: 0, minHeight: 46, flex: 1, color: palette.text, fontSize: 11, lineHeight: 17, paddingVertical: 10 },
  clearSearch: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  clearSearchText: { color: palette.secondary, fontSize: 20, lineHeight: 22 },
  filterBar: { flexDirection: 'row', gap: 7, marginVertical: 14 },
  filterButton: { minWidth: 76, alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 999, backgroundColor: palette.white, paddingHorizontal: 13, paddingVertical: 7 },
  filterButtonSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primarySoft },
  filterButtonPressed: { opacity: 0.65 },
  filterButtonText: { color: palette.secondary, fontSize: 9, lineHeight: 14, fontWeight: '600' },
  filterButtonTextSelected: { color: palette.primaryContainer },
  eventCardList: { gap: 10 },
  eventCard: { minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white, paddingHorizontal: 16, paddingVertical: 15 },
  eventCardCopy: { minWidth: 0, flex: 1 },
  eventName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  eventDate: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 3 },
  eventAvailability: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: 8 },
  eventOpenArea: { alignItems: 'flex-end', gap: 7 },
  eventOpenText: { color: palette.primaryContainer, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  eventUnreadBadge: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.primaryContainer, paddingHorizontal: 5 },
  eventUnreadText: { color: palette.onPrimary, fontSize: 8, lineHeight: 11, fontWeight: '700' },
  conversationCard: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white },
  conversationRow: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  conversationRowUnread: { backgroundColor: '#FCF8F9' },
  conversationRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  conversationRowPressed: { opacity: 0.66 },
  avatarContainer: { width: 48, height: 48 },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: palette.primarySoft },
  avatarFallbackText: { color: palette.primaryContainer, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  onlineDot: { position: 'absolute', width: 12, height: 12, right: 0, bottom: 0, borderWidth: 2, borderColor: palette.white, borderRadius: 6, backgroundColor: palette.positive },
  conversationCopy: { minWidth: 0, flex: 1 },
  conversationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  participantName: { minWidth: 0, flex: 1, color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  participantNameUnread: { fontWeight: '700' },
  conversationTime: { color: palette.muted, fontSize: 8, lineHeight: 12 },
  conversationTimeUnread: { color: palette.primaryContainer, fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  participantRole: { color: palette.muted, fontSize: 8, lineHeight: 12 },
  pinGlyph: { color: palette.primaryContainer, fontSize: 6, lineHeight: 9 },
  bookingBadge: { minWidth: 0, maxWidth: 150, borderRadius: 999, backgroundColor: palette.surfaceContainerLow, paddingHorizontal: 6, paddingVertical: 2 },
  bookingBadgeText: { color: palette.secondary, fontSize: 7, lineHeight: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 },
  lastMessage: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  lastMessageUnread: { color: palette.text, fontWeight: '500' },
  messageCountBadge: { minWidth: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.primaryContainer, paddingHorizontal: 5 },
  messageCountText: { color: palette.onPrimary, fontSize: 8, lineHeight: 11, fontWeight: '700' },
  emptyState: { minHeight: 330, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white, padding: 28 },
  emptyMessageIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: palette.primarySoft, marginBottom: 14 },
  emptyMessageBody: { width: 24, height: 18, borderWidth: 1.5, borderColor: palette.primaryContainer, borderRadius: 5 },
  emptyMessageTail: { position: 'absolute', width: 7, height: 7, bottom: 16, left: 17, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: palette.primaryContainer, transform: [{ rotate: '-24deg' }] },
  emptyTitle: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  emptyText: { maxWidth: 380, color: palette.secondary, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  emptyButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: palette.primaryContainer, paddingHorizontal: 17, marginTop: 17 },
  emptyButtonText: { color: palette.onPrimary, fontSize: 10, lineHeight: 15, fontWeight: '700' },
})
