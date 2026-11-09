import { Text } from '../components/AppText'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { InboxSelectionBox, InboxTrashButton } from '../components/InboxControls'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ClientHomeTab } from './03-ClientHome'
import type { MerchantHomeTab } from './16-MerchantHome'
import type { BookingItem } from './11-BookingScreen'
import type { CoordinatorEvent } from '../lib/coordinator'
import {
  NotificationScreen,
  type InboxSelectionToolbar,
  type MerchantNotification,
} from './22.5-Notification'
import type { InboxTrashScope } from '../lib/inbox-trash'

export type ClientConversationFilter = 'all' | 'unread' | 'bookings'
export type ClientInboxTab = 'messages' | 'notifications'

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
  serviceCategory?: string
  serviceName?: string
  unreadCount: number
  isVirtualCoordinator?: boolean
}

interface MessagesScreenProps {
  conversations?: ClientConversation[]
  clientBookings?: BookingItem[]
  coordinatorEvents?: CoordinatorEvent[]
  hasUnreadNotifications?: boolean
  initialInboxTab?: ClientInboxTab
  initialFilter?: ClientConversationFilter
  notifications?: MerchantNotification[]
  showBottomNavigation?: boolean
  onMarkAllNotificationsRead?: (notificationIds: string[]) => void
  onMarkRead?: (conversation: ClientConversation) => void
  onMarkNotificationRead?: (notification: MerchantNotification) => void
  onMoveConversationsToTrash?: (conversationIds: string[]) => Promise<boolean> | boolean
  onMoveNotificationsToTrash?: (notificationIds: string[]) => Promise<boolean> | boolean
  onBack?: () => void
  onNewMessage?: () => void
  onOpenNotifications?: () => void
  onOpenTrash?: (scope?: InboxTrashScope) => void
  onOpenProfile?: () => void
  onOpenEventCoordinatorForEvent?: (eventId: string) => void
  onSelectCoordinatorTab?: (tab: CoordinatorMainTab) => void
  onSearchChange?: (value: string) => void
  onSelectConversation?: (conversation: ClientConversation) => void
  onSelectNotification?: (notification: MerchantNotification) => void
  navigationVariant?: 'client' | 'coordinator' | 'merchant'
  onSelectTab?: (tab: ClientHomeTab | MerchantHomeTab) => void
  onScrollDirectionChange?: (direction: 'down' | 'up') => void
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
  initialInboxTab = 'messages',
  initialFilter = 'all',
  navigationVariant = 'client',
  notifications = [],
  showBottomNavigation = true,
  onBack,
  onMarkAllNotificationsRead,
  onMarkRead,
  onMarkNotificationRead,
  onMoveConversationsToTrash,
  onMoveNotificationsToTrash,
  onNewMessage,
  onOpenNotifications,
  onOpenTrash,
  onOpenProfile,
  onOpenEventCoordinatorForEvent,
  onSelectCoordinatorTab,
  onSearchChange,
  onSelectConversation,
  onSelectNotification,
  onSelectTab,
  onScrollDirectionChange,
  searchValue,
  userAvatarUrl,
  userName = 'Planner',
}) => {
  const { width } = useWindowDimensions()
  const safeAreaInsets = useSafeAreaInsets()
  const isWide = width >= 760
  const isCompact = width < 390
  const isClientInbox = navigationVariant === 'client'
  const [inboxTab, setInboxTab] = React.useState<ClientInboxTab>(initialInboxTab)
  const [filter, setFilter] = React.useState<ClientConversationFilter>(initialFilter)
  const [internalSearch, setInternalSearch] = React.useState('')
  const lastScrollY = React.useRef(0)
  const [selectedEventId, setSelectedEventId] = React.useState<string>()
  const [selectedConversationIds, setSelectedConversationIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [notificationSelectionToolbar, setNotificationSelectionToolbar] = React.useState<InboxSelectionToolbar>()
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
  React.useEffect(() => {
    if (isClientInbox) setInboxTab(initialInboxTab)
  }, [initialInboxTab, isClientInbox])
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
  const unreadInboxNotificationIds = notifications
    .filter((notification) => notification.category !== 'message' && !notification.isRead)
    .map((notification) => notification.id)
  const hasUnreadInboxNotifications = unreadInboxNotificationIds.length > 0
  const markAllInboxNotificationsRead = () => {
    if (!unreadInboxNotificationIds.length) return
    onMarkAllNotificationsRead?.(unreadInboxNotificationIds)
  }
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
          serviceCategory: 'Coordinator',
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
          serviceCategory: 'Coordinator',
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
  const orderedConversationSource = [...conversationSource].sort((left, right) => {
    const leftIsCoordinator = left.conversationKind === 'event_coordinator'
    const rightIsCoordinator = right.conversationKind === 'event_coordinator'
    if (leftIsCoordinator !== rightIsCoordinator) return leftIsCoordinator ? -1 : 1
    return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
  })
  const visibleConversations = orderedConversationSource.filter((conversation) => {
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
  const selectableConversationIds = (selectedEvent
    ? visibleConversations
    : visibleEventGroups.flatMap((group) => group.conversations)
  ).filter((conversation) => !conversation.isVirtualCoordinator).map((conversation) => conversation.id)
  const selectedConversationCount = selectedConversationIds.size
  const isConversationSelectionMode = selectedConversationCount > 0
  const allConversationsSelected = selectableConversationIds.length > 0
    && selectableConversationIds.every((id) => selectedConversationIds.has(id))
  const someConversationsSelected = selectedConversationCount > 0 && !allConversationsSelected
  const toggleConversationSelection = (ids: string[]) => setSelectedConversationIds((current) => {
    const next = new Set(current)
    const shouldSelect = ids.some((id) => !next.has(id))
    ids.forEach((id) => shouldSelect ? next.add(id) : next.delete(id))
    return next
  })
  const toggleAllConversations = () => setSelectedConversationIds(
    allConversationsSelected ? new Set() : new Set(selectableConversationIds)
  )
  const moveSelectedConversationsToTrash = async () => {
    if (!onMoveConversationsToTrash || !selectedConversationIds.size) return
    const moved = await onMoveConversationsToTrash?.(Array.from(selectedConversationIds))
    if (moved !== false) setSelectedConversationIds(new Set())
  }
  const activeSelectionToolbar = isClientInbox && inboxTab === 'notifications'
    ? notificationSelectionToolbar
    : undefined
  const activeSelectedCount = activeSelectionToolbar?.count ?? selectedConversationCount
  const isInboxSelectionMode = Boolean(activeSelectionToolbar) || isConversationSelectionMode
  const activeAllSelected = activeSelectionToolbar?.allSelected ?? allConversationsSelected
  const activeSomeSelected = activeSelectionToolbar?.someSelected ?? someConversationsSelected
  const toggleAllInboxItems = activeSelectionToolbar?.toggleAll ?? toggleAllConversations
  const moveSelectedInboxItemsToTrash = activeSelectionToolbar?.moveToTrash
    ?? (() => { void moveSelectedConversationsToTrash() })

  return (
    <View style={styles.screen}>
      {navigationVariant === 'merchant' ? (
        isConversationSelectionMode ? (
          <View style={styles.merchantSelectionHeader}>
            <Text style={styles.merchantSelectionTitle}>{selectedConversationCount} selected</Text>
            <Pressable accessibilityLabel={allConversationsSelected ? 'Deselect all conversations' : someConversationsSelected ? 'Select all remaining conversations' : 'Select all conversations'} accessibilityRole="checkbox" accessibilityState={{ checked: allConversationsSelected ? true : someConversationsSelected ? 'mixed' : false }} onPress={toggleAllConversations} style={styles.clientHeaderButton}><InboxSelectionBox color={palette.primaryContainer} state={allConversationsSelected ? 'checked' : someConversationsSelected ? 'mixed' : 'unchecked'} /></Pressable>
            <InboxTrashButton accessibilityLabel="Move selected conversations to Trash" color={palette.primaryContainer} onPress={() => void moveSelectedConversationsToTrash()} />
          </View>
        ) : <MerchantWorkspaceHeader
          hasUnreadNotifications={hasUnreadNotifications}
          onOpenNotifications={onOpenNotifications}
        />
      ) : (
        <View style={[
          styles.topAppBar,
          usesEventGroups && styles.clientTopAppBar,
          navigationVariant === 'coordinator' && styles.coordinatorTopAppBar,
        ]}>
          <View style={[
            styles.topAppBarContent,
            isWide && styles.horizontalPaddingWide,
            navigationVariant === 'coordinator' && styles.coordinatorTopAppBarContent,
            navigationVariant === 'coordinator' && isWide && styles.coordinatorTopAppBarContentWide,
          ]}>
            {usesEventGroups ? (
            <>
              {navigationVariant === 'coordinator' || navigationVariant === 'client' ? (
                <Pressable
                  accessibilityLabel={navigationVariant === 'client' ? 'Back to home' : 'Back to coordinator workspace'}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.clientHeaderButton,
                    styles.clientBackButtonNeumorphic,
                    navigationVariant === 'coordinator' && styles.coordinatorBackButton,
                    pressed && styles.clientBackButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons color="#FFFFFF" name="chevron-left" size={28} />
                </Pressable>
              ) : <View style={styles.clientHeaderButton} />}
              <Text style={[styles.clientHeaderTitle, navigationVariant === 'coordinator' && styles.coordinatorHeaderTitle, isClientInbox && styles.clientHeaderTitleCentered]}>
                {isInboxSelectionMode ? `${activeSelectedCount} selected` : (
                  <>{navigationVariant === 'client' ? 'INBOX' : 'MESSAGES'}</>
                )}
              </Text>
              {isClientInbox ? (
                <View style={styles.clientHeaderButton} />
              ) : isInboxSelectionMode ? (
                <View style={styles.selectionHeaderActions}>
                  <Pressable
                    accessibilityLabel={activeAllSelected ? 'Deselect all Inbox items' : activeSomeSelected ? 'Select all remaining Inbox items' : 'Select all Inbox items'}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: activeAllSelected ? true : activeSomeSelected ? 'mixed' : false }}
                    onPress={toggleAllInboxItems}
                  style={({ pressed }) => [
                    styles.clientHeaderButton,
                    navigationVariant === 'coordinator' && styles.coordinatorHeaderAction,
                    pressed && (navigationVariant === 'coordinator' ? styles.coordinatorHeaderActionPressed : styles.surfacePressed),
                  ]}
                  ><InboxSelectionBox color="#FFFFFF" state={activeAllSelected ? 'checked' : activeSomeSelected ? 'mixed' : 'unchecked'} /></Pressable>
                  <InboxTrashButton
                    accessibilityLabel="Move selected Inbox items to Trash"
                    color="#FFFFFF"
                    onPress={moveSelectedInboxItemsToTrash}
                    style={navigationVariant === 'coordinator' ? styles.coordinatorHeaderAction : undefined}
                  />
                </View>
              ) : navigationVariant === 'coordinator' ? (
                <Pressable
                  accessibilityLabel="Open notifications"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onOpenNotifications}
                  style={({ pressed }) => [styles.clientHeaderButton, styles.coordinatorHeaderAction, pressed && styles.coordinatorHeaderActionPressed]}
                >
                  <MaterialCommunityIcons color="#FFFFFF" name="bell-outline" size={22} />
                  {hasUnreadNotifications ? <View style={[styles.notificationDot, styles.coordinatorNotificationDot]} /> : null}
                </Pressable>
              ) : (
                <InboxTrashButton accessibilityLabel="Open Inbox Trash" color="#FFFFFF" onPress={() => onOpenTrash?.(inboxTab === 'notifications' ? 'notifications' : 'messages')} />
              )}
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

      {isClientInbox ? (
        <>
          <View style={[styles.inboxTabs, isWide && styles.inboxTabsWide]}>
            {(['messages', 'notifications'] as ClientInboxTab[]).map((tab) => {
              const selected = inboxTab === tab
              const hasUnread = tab === 'messages'
                ? unreadCount > 0
                : hasUnreadInboxNotifications
              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setInboxTab(tab)}
                  style={({ pressed }) => [
                    styles.inboxTab,
                    selected && styles.inboxTabSelected,
                    pressed && styles.inboxTabPressed,
                  ]}
                >
                  <View style={styles.inboxTabLabelRow}>
                    <Text style={[styles.inboxTabLabel, selected && styles.inboxTabLabelSelected]}>
                      {tab === 'messages' ? 'Messages' : 'Notifications'}
                    </Text>
                    {hasUnread ? <View style={styles.inboxTabUnreadDot} /> : null}
                  </View>
                  {selected ? <View style={styles.inboxTabIndicator} /> : null}
                </Pressable>
              )
            })}
          </View>
          <View style={[styles.inboxActionBar, isWide && styles.inboxActionBarWide]}>
            {isInboxSelectionMode ? (
              <>
                <Pressable
                  accessibilityLabel={activeAllSelected ? 'Deselect all Inbox items' : activeSomeSelected ? 'Select all remaining Inbox items' : 'Select all Inbox items'}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: activeAllSelected ? true : activeSomeSelected ? 'mixed' : false }}
                  onPress={toggleAllInboxItems}
                  style={({ pressed }) => [styles.inboxActionButton, pressed && styles.inboxActionButtonPressed]}
                >
                  <InboxSelectionBox color={palette.primaryContainer} state={activeAllSelected ? 'checked' : activeSomeSelected ? 'mixed' : 'unchecked'} />
                </Pressable>
                <InboxTrashButton
                  accessibilityLabel="Move selected Inbox items to Trash"
                  color={palette.primaryContainer}
                  onPress={moveSelectedInboxItemsToTrash}
                  style={styles.inboxActionButton}
                />
              </>
            ) : (
              <>
                {inboxTab === 'notifications' ? (
                  <Pressable
                    accessibilityLabel="Mark all notifications as read"
                    accessibilityRole="button"
                    disabled={!hasUnreadInboxNotifications || !onMarkAllNotificationsRead}
                    hitSlop={8}
                    onPress={markAllInboxNotificationsRead}
                    style={({ pressed }) => [
                      styles.headerReadAll,
                      (!hasUnreadInboxNotifications || !onMarkAllNotificationsRead) && styles.headerReadAllDisabled,
                      pressed && styles.inboxActionButtonPressed,
                    ]}
                  >
                    <Text style={styles.headerReadAllText}>Read all</Text>
                  </Pressable>
                ) : null}
                <InboxTrashButton
                  accessibilityLabel="Open Inbox Trash"
                  color={palette.primaryContainer}
                  onPress={() => onOpenTrash?.(inboxTab === 'notifications' ? 'notifications' : 'messages')}
                  style={styles.inboxActionButton}
                />
              </>
            )}
          </View>
        </>
      ) : null}

      {isClientInbox && inboxTab === 'notifications' ? (
        <NotificationScreen
          embedded
          notifications={notifications}
          onMoveToTrash={onMoveNotificationsToTrash}
          showTrashShortcut={false}
          onMarkAllRead={onMarkAllNotificationsRead}
          onEmbeddedSelectionChange={setNotificationSelectionToolbar}
          onMarkRead={onMarkNotificationRead}
          onScrollDirectionChange={onScrollDirectionChange}
          onSelectNotification={(notification) => {
            if (notification.category === 'message') setInboxTab('messages')
            onSelectNotification?.(notification)
          }}
          variant="client"
        />
      ) : (
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
          { paddingBottom: (isWide ? 112 : 108) + safeAreaInsets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          const scrollY = Math.max(0, event.nativeEvent.contentOffset.y)
          const delta = scrollY - lastScrollY.current
          if (Math.abs(delta) < 8) return
          lastScrollY.current = scrollY
          onScrollDirectionChange?.(delta > 0 ? 'down' : 'up')
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {!isClientInbox ? (
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
        ) : null}

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
                    onLongPress={() => toggleConversationSelection(group.conversations.filter((item) => !item.isVirtualCoordinator).map((item) => item.id))}
                    onPress={() => isConversationSelectionMode
                      ? toggleConversationSelection(group.conversations.filter((item) => !item.isVirtualCoordinator).map((item) => item.id))
                      : setSelectedEventId(group.id)}
                    style={({ pressed }) => [styles.eventCard, isConversationSelectionMode && group.conversations.some((item) => selectedConversationIds.has(item.id)) && styles.rowSelected, pressed && styles.conversationRowPressed]}
                  >
                    {isConversationSelectionMode ? <InboxSelectionBox color={palette.primaryContainer} state={group.conversations.every((item) => item.isVirtualCoordinator || selectedConversationIds.has(item.id)) ? 'checked' : 'unchecked'} /> : null}
                    <View style={styles.eventCardCopy}>
                      <Text numberOfLines={2} style={styles.eventName}>{group.name}</Text>
                      <Text style={styles.eventDate}>{formatEventDate(group.date)}</Text>
                      <Text style={styles.eventAvailability}>
                        {group.conversations.length} available conversation{group.conversations.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <View style={styles.eventOpenArea}>
                      {unread ? <View style={styles.eventUnreadBadge}><Text style={styles.eventUnreadText}>{unread}</Text></View> : null}
                      <View style={styles.eventOpenLabelRow}>
                        <Text style={styles.eventOpenText}>Open event</Text>
                        <Text style={styles.eventOpenChevron}>{'\u203A'}</Text>
                      </View>
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
                isRead={readIds.has(conversation.id)}
                key={conversation.id}
                last={index === visibleConversations.length - 1}
                selected={selectedConversationIds.has(conversation.id)}
                selectionMode={isConversationSelectionMode}
                onLongPress={() => toggleConversationSelection([conversation.id])}
                onPress={selectConversation}
                onToggleSelection={() => toggleConversationSelection([conversation.id])}
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
      )}

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
  isRead,
  last,
  onLongPress,
  onPress,
  onToggleSelection,
  selected = false,
  selectionMode = false,
}: {
  conversation: ClientConversation
  isRead: boolean
  last: boolean
  onLongPress?: () => void
  onPress: (conversation: ClientConversation) => void
  onToggleSelection?: () => void
  selected?: boolean
  selectionMode?: boolean
}) => {
  const isUnread = !isRead && conversation.unreadCount > 0
  const categoryLabel = conversation.serviceCategory
    ?? (conversation.conversationKind === 'event_coordinator' ? 'Coordinator' : 'Service')

  return (
    <Pressable
      accessibilityLabel={`${isUnread ? `${conversation.unreadCount} unread. ` : ''}${conversation.participantName}. ${conversation.lastMessage}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onLongPress={onLongPress}
      onPress={() => selectionMode ? onToggleSelection?.() : onPress(conversation)}
      style={({ pressed }) => [
        styles.conversationRow,
        isUnread && styles.conversationRowUnread,
        selected && styles.rowSelected,
        !last && styles.conversationRowBorder,
        pressed && styles.conversationRowPressed,
      ]}
    >
      {selectionMode ? <InboxSelectionBox color={palette.primaryContainer} state={selected ? 'checked' : 'unchecked'} /> : null}
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
        <Text
          numberOfLines={2}
          style={[styles.participantName, isUnread && styles.participantNameUnread]}
        >
          {conversation.participantName}
        </Text>
        <View style={styles.conversationContextRow}>
          <View style={styles.serviceCategoryBadge}>
            <Text numberOfLines={1} style={styles.serviceCategoryBadgeText}>{categoryLabel}</Text>
          </View>
          <Text numberOfLines={1} style={styles.participantRole}>
            {conversation.participantRole}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={[styles.lastMessage, isUnread && styles.lastMessageUnread]}
        >
          {conversation.lastMessage}
        </Text>
      </View>
      <View style={styles.conversationStatus}>
        <Text style={[styles.conversationTime, isUnread && styles.conversationTimeUnread]}>
          {formatConversationTime(conversation.lastMessageAt)}
        </Text>
        {conversation.isPinned ? <Text style={styles.pinGlyph}>{'\u25C6'}</Text> : null}
        {isUnread ? (
          <View style={styles.messageCountBadge}>
            <Text style={styles.messageCountText}>{conversation.unreadCount}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const palette = {
  background: '#E9EDF0',
  border: 'rgba(255, 255, 255, 0.76)',
  muted: '#87929A',
  onPrimary: '#FFFFFF',
  positive: '#2F6B46',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#6F7B84',
  surfaceContainerLow: '#E9EDF0',
  text: '#57636C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: { zIndex: 30, minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.background },
  clientTopAppBar: { borderBottomColor: palette.primary, backgroundColor: palette.primaryContainer },
  coordinatorTopAppBar: {
    borderBottomColor: palette.primaryContainer,
    backgroundColor: palette.primaryContainer,
    boxShadow: '0 5px 12px rgba(55, 4, 18, 0.34)',
    elevation: 6,
    shadowColor: '#350410',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
  },
  merchantSelectionHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.white, paddingHorizontal: 14 },
  merchantSelectionTitle: { minWidth: 0, flex: 1, color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  topAppBarContent: { position: 'relative', width: '100%', maxWidth: 1200, minHeight: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  horizontalPaddingWide: { paddingHorizontal: 64 },
  coordinatorTopAppBarContent: { maxWidth: 1024, paddingVertical: 12 },
  coordinatorTopAppBarContentWide: { paddingHorizontal: 32 },
  inboxTabs: { width: '100%', flexDirection: 'row', gap: 8, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 16, paddingVertical: 10 },
  inboxTabsWide: { paddingHorizontal: 64 },
  inboxTab: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.background, boxShadow: '4px 4px 9px rgba(161, 172, 180, 0.44), -4px -4px 9px rgba(255, 255, 255, 0.94)' },
  inboxTabSelected: { backgroundColor: palette.primaryContainer, boxShadow: '3px 4px 8px rgba(78, 6, 26, 0.32), -3px -3px 7px rgba(255, 255, 255, 0.72)' },
  inboxTabPressed: { boxShadow: 'inset 3px 3px 7px rgba(161, 172, 180, 0.45), inset -3px -3px 7px rgba(255, 255, 255, 0.88)' },
  inboxTabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inboxTabLabel: { color: palette.secondary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  inboxTabLabelSelected: { color: palette.white },
  inboxTabUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B3261E' },
  inboxTabIndicator: { display: 'none' },
  clientHeaderButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  clientBackButtonNeumorphic: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.16)', backgroundColor: palette.primaryContainer, boxShadow: '3px 3px 7px rgba(44, 3, 15, 0.58), -3px -3px 7px rgba(143, 48, 72, 0.46)' },
  coordinatorBackButton: { borderColor: 'rgba(255, 255, 255, 0.16)', backgroundColor: palette.primaryContainer, boxShadow: '3px 3px 7px rgba(44, 3, 15, 0.58), -3px -3px 7px rgba(143, 48, 72, 0.46)' },
  clientBackButtonPressed: { boxShadow: 'inset 3px 3px 7px rgba(44, 3, 15, 0.66), inset -3px -3px 7px rgba(143, 48, 72, 0.46)', transform: [{ scale: 0.96 }] },
  clientHeaderTitle: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center' },
  coordinatorHeaderTitle: { color: palette.white, fontSize: 16, lineHeight: 22, letterSpacing: 0.4 },
  coordinatorHeaderAction: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', backgroundColor: palette.primaryContainer, boxShadow: '3px 3px 7px rgba(44, 3, 15, 0.58), -3px -3px 7px rgba(143, 48, 72, 0.46)' },
  coordinatorHeaderActionPressed: { boxShadow: 'inset 3px 3px 6px rgba(42, 2, 13, 0.58), inset -3px -3px 6px rgba(151, 49, 74, 0.30)', opacity: 0.9 },
  clientHeaderTitleCentered: { position: 'absolute', right: 72, left: 72 },
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
  coordinatorNotificationDot: { top: 3, right: 3, borderColor: palette.primaryContainer, backgroundColor: palette.white },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 108 },
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
  eventBackButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 15, backgroundColor: palette.background, marginBottom: 12, paddingHorizontal: 14, boxShadow: '3px 3px 7px rgba(161, 172, 180, 0.4), -3px -3px 7px rgba(255, 255, 255, 0.9)' },
  eventBackText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  eventBackName: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  searchShell: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: 'rgba(174, 184, 192, 0.28)', borderRadius: 22, backgroundColor: '#E4E9ED', paddingHorizontal: 14, marginTop: 4, boxShadow: 'inset 3px 3px 7px rgba(160, 171, 180, 0.52), inset -3px -3px 7px rgba(255, 255, 255, 0.92)' },
  searchIcon: { width: 18, height: 18 },
  searchLens: { width: 12, height: 12, borderWidth: 1.5, borderColor: palette.secondary, borderRadius: 6 },
  searchHandle: { position: 'absolute', width: 7, height: 1.5, right: 0, bottom: 3, borderRadius: 1, backgroundColor: palette.secondary, transform: [{ rotate: '45deg' }] },
  searchInput: { minWidth: 0, minHeight: 40, flex: 1, color: palette.text, fontSize: 11, lineHeight: 17, paddingVertical: 8 },
  clearSearch: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  clearSearchText: { color: palette.secondary, fontSize: 20, lineHeight: 22 },
  filterBar: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  filterButton: { minWidth: 76, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 20, backgroundColor: palette.background, paddingHorizontal: 13, boxShadow: '3px 3px 7px rgba(161, 172, 180, 0.4), -3px -3px 7px rgba(255, 255, 255, 0.9)' },
  filterButtonSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryContainer, boxShadow: '3px 4px 7px rgba(78, 6, 26, 0.3), -3px -3px 7px rgba(255, 255, 255, 0.68)' },
  filterButtonPressed: { boxShadow: 'inset 3px 3px 6px rgba(161, 172, 180, 0.46), inset -3px -3px 6px rgba(255, 255, 255, 0.9)' },
  filterButtonText: { color: palette.secondary, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  filterButtonTextSelected: { color: palette.white },
  eventCardList: { borderTopWidth: 1, gap: 12, borderTopColor: 'transparent', backgroundColor: 'transparent', paddingTop: 1 },
  eventCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 18, backgroundColor: palette.background, paddingHorizontal: 16, paddingVertical: 14, boxShadow: '5px 5px 11px rgba(161, 172, 180, 0.44), -5px -5px 11px rgba(255, 255, 255, 0.94)' },
  eventCardCopy: { minWidth: 0, flex: 1 },
  eventName: { color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  eventDate: { color: palette.secondary, fontSize: 11, lineHeight: 15, marginTop: 3 },
  eventAvailability: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 6 },
  eventOpenArea: { minWidth: 86, alignItems: 'flex-end', gap: 9 },
  eventOpenLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventOpenText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  eventOpenChevron: { color: palette.primaryContainer, fontSize: 21, lineHeight: 21 },
  eventUnreadBadge: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.primaryContainer, paddingHorizontal: 5 },
  eventUnreadText: { color: palette.onPrimary, fontSize: 8, lineHeight: 11, fontWeight: '700' },
  conversationCard: { gap: 11, backgroundColor: 'transparent', borderTopWidth: 1, borderTopColor: 'transparent' },
  conversationRow: { minHeight: 104, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 18, backgroundColor: palette.background, paddingHorizontal: 14, paddingVertical: 13, boxShadow: '4px 4px 10px rgba(161, 172, 180, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.92)' },
  rowSelected: { backgroundColor: '#F7ECEE' },
  selectionHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  inboxActionBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, backgroundColor: palette.background, paddingHorizontal: 16, paddingBottom: 8 },
  inboxActionBarWide: { paddingHorizontal: 64 },
  inboxActionButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 21, backgroundColor: palette.background, boxShadow: '3px 3px 7px rgba(161, 172, 180, 0.42), -3px -3px 7px rgba(255, 255, 255, 0.92)' },
  inboxActionButtonPressed: { boxShadow: 'inset 3px 3px 7px rgba(161, 172, 180, 0.48), inset -3px -3px 7px rgba(255, 255, 255, 0.9)', transform: [{ scale: 0.97 }] },
  headerReadAll: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 21, backgroundColor: palette.background, paddingHorizontal: 14, boxShadow: '3px 3px 7px rgba(161, 172, 180, 0.42), -3px -3px 7px rgba(255, 255, 255, 0.92)' },
  headerReadAllDisabled: { opacity: 0.5 },
  headerReadAllText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  conversationRowUnread: { borderColor: 'rgba(107, 30, 46, 0.26)', backgroundColor: '#EDF0F2' },
  conversationRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  conversationRowPressed: { boxShadow: 'inset 4px 4px 9px rgba(161, 172, 180, 0.48), inset -4px -4px 9px rgba(255, 255, 255, 0.92)' },
  avatarContainer: { width: 46, height: 46, marginTop: 1 },
  avatarImage: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: palette.primarySoft },
  avatarFallbackText: { color: palette.primaryContainer, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  onlineDot: { position: 'absolute', width: 12, height: 12, right: 0, bottom: 0, borderWidth: 2, borderColor: palette.white, borderRadius: 6, backgroundColor: palette.positive },
  conversationCopy: { minWidth: 0, flex: 1 },
  participantName: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  participantNameUnread: { fontWeight: '700' },
  conversationContextRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  serviceCategoryBadge: { maxWidth: 112, borderRadius: 999, backgroundColor: 'rgba(107, 30, 46, 0.10)', paddingHorizontal: 7, paddingVertical: 3 },
  serviceCategoryBadgeText: { color: palette.primaryContainer, fontSize: 8, lineHeight: 11, fontWeight: '800', textTransform: 'uppercase' },
  conversationStatus: { width: 62, alignItems: 'flex-end', gap: 8, paddingTop: 1 },
  conversationTime: { color: palette.muted, fontSize: 9, lineHeight: 13, textAlign: 'right' },
  conversationTimeUnread: { color: palette.primaryContainer, fontWeight: '700' },
  participantRole: { minWidth: 0, flex: 1, color: palette.muted, fontSize: 9, lineHeight: 12 },
  pinGlyph: { color: palette.primaryContainer, fontSize: 6, lineHeight: 9 },
  lastMessage: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 7 },
  lastMessageUnread: { color: palette.text, fontWeight: '500' },
  messageCountBadge: { minWidth: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.primaryContainer, paddingHorizontal: 5 },
  messageCountText: { color: palette.onPrimary, fontSize: 8, lineHeight: 11, fontWeight: '700' },
  emptyState: { minHeight: 330, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 18, backgroundColor: palette.background, padding: 28, boxShadow: '5px 5px 11px rgba(161, 172, 180, 0.4), -5px -5px 11px rgba(255, 255, 255, 0.92)' },
  emptyMessageIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: palette.primarySoft, marginBottom: 14 },
  emptyMessageBody: { width: 24, height: 18, borderWidth: 1.5, borderColor: palette.primaryContainer, borderRadius: 5 },
  emptyMessageTail: { position: 'absolute', width: 7, height: 7, bottom: 16, left: 17, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: palette.primaryContainer, transform: [{ rotate: '-24deg' }] },
  emptyTitle: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  emptyText: { maxWidth: 380, color: palette.secondary, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  emptyButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: palette.primaryContainer, paddingHorizontal: 17, marginTop: 17 },
  emptyButtonText: { color: palette.onPrimary, fontSize: 10, lineHeight: 15, fontWeight: '700' },
})
