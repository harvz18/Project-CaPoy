import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import type { ClientHomeTab } from './03-ClientHome'

export type ClientConversationFilter = 'all' | 'unread' | 'bookings'

export interface ClientConversation {
  avatarUrl?: string
  bookingReference?: string
  id: string
  isOnline?: boolean
  isPinned?: boolean
  lastMessage: string
  lastMessageAt: string
  participantName: string
  participantRole: string
  unreadCount: number
}

interface MessagesScreenProps {
  conversations?: ClientConversation[]
  hasUnreadNotifications?: boolean
  initialFilter?: ClientConversationFilter
  onMarkRead?: (conversation: ClientConversation) => void
  onNewMessage?: () => void
  onOpenNotifications?: () => void
  onOpenProfile?: () => void
  onSearchChange?: (value: string) => void
  onSelectConversation?: (conversation: ClientConversation) => void
  onSelectTab?: (tab: ClientHomeTab) => void
  searchValue?: string
  userName?: string
}

const defaultConversations: ClientConversation[] = [
  {
    bookingReference: 'Booking #MV-1048',
    id: 'conversation-floral-arts',
    isOnline: true,
    isPinned: true,
    lastMessage: 'We can match the arrangements to your burgundy and blush palette.',
    lastMessageAt: '2026-09-03T10:42:00+08:00',
    participantName: 'Floral Arts',
    participantRole: 'Floral Designer',
    unreadCount: 2,
  },
  {
    bookingReference: 'Quote #QT-209',
    id: 'conversation-lens-light',
    isOnline: true,
    lastMessage: 'I sent the revised photography package for your review.',
    lastMessageAt: '2026-09-03T09:18:00+08:00',
    participantName: 'Lens & Light Studio',
    participantRole: 'Photographer',
    unreadCount: 1,
  },
  {
    bookingReference: 'Booking #MV-1027',
    id: 'conversation-grand-vista',
    lastMessage: 'You: Thank you! We will confirm the final guest count this week.',
    lastMessageAt: '2026-09-02T16:05:00+08:00',
    participantName: 'Grand Vista Events Place',
    participantRole: 'Venue',
    unreadCount: 0,
  },
  {
    id: 'conversation-sweet-canvas',
    lastMessage: 'The tasting schedule is available on Friday afternoon.',
    lastMessageAt: '2026-08-31T14:30:00+08:00',
    participantName: 'Sweet Canvas Cakes',
    participantRole: 'Cakes & Desserts',
    unreadCount: 0,
  },
  {
    bookingReference: 'Inquiry #IN-088',
    id: 'conversation-eventful',
    lastMessage: 'You: Is the buffet package available for 120 guests?',
    lastMessageAt: '2026-08-27T11:12:00+08:00',
    participantName: 'Eventful Catering',
    participantRole: 'Catering',
    unreadCount: 0,
  },
]

const filterOptions: Array<{ id: ClientConversationFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'bookings', label: 'Bookings' },
]

const navigationTabs: Array<{ glyph: string; id: ClientHomeTab; label: string }> = [
  { glyph: '\u2302', id: 'home', label: 'Home' },
  { glyph: '\u25C7', id: 'explore', label: 'Explore' },
  { glyph: '\u25A6', id: 'bookings', label: 'Bookings' },
  { glyph: '\u2709', id: 'messages', label: 'Messages' },
  { glyph: '\u25CB', id: 'profile', label: 'Profile' },
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

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  conversations = defaultConversations,
  hasUnreadNotifications = false,
  initialFilter = 'all',
  onMarkRead,
  onNewMessage,
  onOpenNotifications,
  onOpenProfile,
  onSearchChange,
  onSelectConversation,
  onSelectTab,
  searchValue,
  userName = 'Planner',
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 760
  const isCompact = width < 390
  const [filter, setFilter] = React.useState<ClientConversationFilter>(initialFilter)
  const [internalSearch, setInternalSearch] = React.useState('')
  const [readIds, setReadIds] = React.useState(
    () => new Set(conversations.filter((item) => item.unreadCount === 0).map((item) => item.id))
  )
  const query = searchValue ?? internalSearch
  const normalizedQuery = query.trim().toLowerCase()
  const unreadCount = conversations.reduce(
    (count, conversation) => count + (readIds.has(conversation.id) ? 0 : conversation.unreadCount),
    0
  )
  const visibleConversations = conversations.filter((conversation) => {
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
    if (!readIds.has(conversation.id) && conversation.unreadCount > 0) {
      const readConversation = { ...conversation, unreadCount: 0 }
      setReadIds((current) => new Set(current).add(conversation.id))
      onMarkRead?.(readConversation)
      onSelectConversation?.(readConversation)
      return
    }

    onSelectConversation?.(conversation)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenProfile}
            style={({ pressed }) => pressed && styles.surfacePressed}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{getInitials(userName).charAt(0)}</Text>
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
        </View>
      </View>

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
            <Text style={styles.subtitle}>Keep every provider conversation in one place.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onNewMessage}
            style={({ pressed }) => [styles.newMessageButton, pressed && styles.primaryPressed]}
          >
            <Text style={styles.newMessagePlus}>+</Text>
            <Text style={styles.newMessageText}>{isCompact ? 'New' : 'New message'}</Text>
          </Pressable>
        </View>

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

        {visibleConversations.length ? (
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
                ? 'Try a different provider, service, or booking reference.'
                : 'Your conversations with event providers will appear here.'}
            </Text>
            {!normalizedQuery && filter === 'all' ? (
              <Pressable
                accessibilityRole="button"
                onPress={onNewMessage}
                style={({ pressed }) => [styles.emptyButton, pressed && styles.primaryPressed]}
              >
                <Text style={styles.emptyButtonText}>Start a conversation</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNavigation}>
        <View style={[styles.bottomNavigationContent, isWide && styles.horizontalPaddingWide]}>
          {navigationTabs.map((tab) => {
            const selected = tab.id === 'messages'
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectTab?.(tab.id)}
                style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
              >
                <View style={[styles.tabIconWrap, selected && styles.tabIconWrapSelected]}>
                  <Text style={[styles.tabGlyph, selected && styles.tabGlyphSelected]}>
                    {tab.glyph}
                  </Text>
                  {tab.id === 'messages' && unreadCount ? <View style={styles.tabBadge} /> : null}
                </View>
                <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}

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
  topAppBarContent: { width: '100%', maxWidth: 820, minHeight: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  horizontalPaddingWide: { paddingHorizontal: 32 },
  userAvatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: palette.primaryContainer },
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
  bottomNavigation: { zIndex: 40, width: '100%', borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.background },
  bottomNavigationContent: { width: '100%', maxWidth: 820, minHeight: 72, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7 },
  tabButton: { minWidth: 0, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabPressed: { opacity: 0.58 },
  tabIconWrap: { minWidth: 38, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  tabIconWrapSelected: { backgroundColor: palette.primarySoft },
  tabGlyph: { color: palette.secondary, fontSize: 16, lineHeight: 20 },
  tabGlyphSelected: { color: palette.primaryContainer, fontWeight: '700' },
  tabBadge: { position: 'absolute', width: 7, height: 7, top: 3, right: 6, borderRadius: 4, backgroundColor: palette.primaryContainer },
  tabLabel: { color: palette.secondary, fontSize: 8, lineHeight: 11, fontWeight: '500' },
  tabLabelSelected: { color: palette.primaryContainer, fontWeight: '700' },
})
