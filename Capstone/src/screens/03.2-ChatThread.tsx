import React from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

export type ChatAttachmentKind = 'file' | 'image'
export type ChatDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
export type ChatMessageSender = 'currentUser' | 'participant' | 'system'

export interface ChatAttachment {
  id: string
  kind: ChatAttachmentKind
  name: string
  sizeLabel?: string
  uri?: string
}

export interface ChatBookingContext {
  eventDate: string
  id: string
  serviceName: string
  status: 'inquiry' | 'pending' | 'confirmed' | 'completed'
}

export interface ChatMessage {
  attachments?: ChatAttachment[]
  createdAt: string
  id: string
  sender: ChatMessageSender
  status?: ChatDeliveryStatus
  text?: string
}

export interface ChatParticipant {
  avatarUrl?: string
  id: string
  isOnline?: boolean
  lastSeen?: string
  name: string
  role: string
}

export interface ChatSendValue {
  attachments: ChatAttachment[]
  text: string
}

interface ChatThreadScreenProps {
  booking?: ChatBookingContext | null
  draftValue?: string
  isParticipantTyping?: boolean
  isSending?: boolean
  messages?: ChatMessage[]
  onAttach?: () => void
  onBack?: () => void
  onCall?: (participant: ChatParticipant) => void
  onDraftChange?: (value: string) => void
  onOpenAttachment?: (attachment: ChatAttachment) => void
  onOpenBooking?: (booking: ChatBookingContext) => void
  onOpenInfo?: (participant: ChatParticipant) => void
  onRemovePendingAttachment?: (attachment: ChatAttachment) => void
  onRetryMessage?: (message: ChatMessage) => void
  onSend?: (value: ChatSendValue) => void
  participant?: Partial<ChatParticipant>
  pendingAttachments?: ChatAttachment[]
}

const defaultParticipant: ChatParticipant = {
  id: 'provider-floral-arts',
  isOnline: true,
  name: 'Floral Arts',
  role: 'Floral Designer',
}

const defaultBooking: ChatBookingContext = {
  eventDate: 'September 28, 2026',
  id: 'MV-1048',
  serviceName: 'Premium Floral Design',
  status: 'pending',
}

const defaultMessages: ChatMessage[] = [
  {
    createdAt: '2026-09-02T09:12:00+08:00',
    id: 'message-system-start',
    sender: 'system',
    text: 'Conversation started from your Premium Floral Design inquiry.',
  },
  {
    createdAt: '2026-09-02T09:14:00+08:00',
    id: 'message-provider-greeting',
    sender: 'participant',
    text: 'Hi Maria! Thank you for reaching out. I would love to learn more about your event.',
  },
  {
    createdAt: '2026-09-02T09:20:00+08:00',
    id: 'message-client-details',
    sender: 'currentUser',
    status: 'read',
    text: 'Hi! We are planning an intimate wedding for 80 guests. Our colors are burgundy and blush.',
  },
  {
    attachments: [
      {
        id: 'attachment-inspiration',
        kind: 'image',
        name: 'floral-inspiration.jpg',
        sizeLabel: '1.8 MB',
      },
    ],
    createdAt: '2026-09-02T09:22:00+08:00',
    id: 'message-client-inspiration',
    sender: 'currentUser',
    status: 'read',
    text: 'This is the look we have in mind.',
  },
  {
    createdAt: '2026-09-03T10:42:00+08:00',
    id: 'message-provider-confirmation',
    sender: 'participant',
    text: 'We can match the arrangements to your burgundy and blush palette. I attached a preliminary quote for you.',
  },
  {
    attachments: [
      {
        id: 'attachment-quote',
        kind: 'file',
        name: 'Floral-Arts-Quote-MV1048.pdf',
        sizeLabel: '624 KB',
      },
    ],
    createdAt: '2026-09-03T10:43:00+08:00',
    id: 'message-provider-quote',
    sender: 'participant',
  },
]

const bookingStatusLabels: Record<ChatBookingContext['status'], string> = {
  completed: 'Completed',
  confirmed: 'Confirmed',
  inquiry: 'Inquiry',
  pending: 'Pending confirmation',
}

const deliveryLabels: Record<ChatDeliveryStatus, string> = {
  delivered: 'Delivered',
  failed: 'Not sent',
  read: 'Read',
  sending: 'Sending',
  sent: 'Sent',
}

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'M'

const toLocalDateKey = (value: string) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const formatMessageDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))

const formatMessageTime = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const PhoneIcon = () => (
  <View style={styles.phoneIcon}>
    <View style={styles.phoneReceiver} />
  </View>
)

export const ChatThreadScreen: React.FC<ChatThreadScreenProps> = ({
  booking = defaultBooking,
  draftValue,
  isParticipantTyping = false,
  isSending = false,
  messages = defaultMessages,
  onAttach,
  onBack,
  onCall,
  onDraftChange,
  onOpenAttachment,
  onOpenBooking,
  onOpenInfo,
  onRemovePendingAttachment,
  onRetryMessage,
  onSend,
  participant,
  pendingAttachments = [],
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 760
  const scrollViewRef = React.useRef<ScrollView>(null)
  const [internalDraft, setInternalDraft] = React.useState('')
  const value = { ...defaultParticipant, ...participant }
  const draft = draftValue ?? internalDraft
  const normalizedDraft = draft.trim()
  const canSend = Boolean(normalizedDraft || pendingAttachments.length) && !isSending

  const changeDraft = (nextDraft: string) => {
    if (draftValue === undefined) setInternalDraft(nextDraft)
    onDraftChange?.(nextDraft)
  }

  const sendMessage = () => {
    if (!canSend) return
    onSend?.({ attachments: pendingAttachments, text: normalizedDraft })
    if (draftValue === undefined) setInternalDraft('')
    onDraftChange?.('')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
          <Pressable
            accessibilityLabel="Back to messages"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.surfacePressed]}
          >
            <BackIcon />
          </Pressable>

          <Pressable
            accessibilityLabel={`Open information about ${value.name}`}
            accessibilityRole="button"
            onPress={() => onOpenInfo?.(value)}
            style={({ pressed }) => [styles.participantHeader, pressed && styles.headerPressed]}
          >
            <Avatar participant={value} size="small" />
            <View style={styles.participantCopy}>
              <Text numberOfLines={1} style={styles.participantName}>
                {value.name}
              </Text>
              <Text numberOfLines={1} style={styles.presenceText}>
                {value.isOnline ? 'Online now' : value.lastSeen ?? value.role}
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={`Call ${value.name}`}
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => onCall?.(value)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.surfacePressed]}
            >
              <PhoneIcon />
            </Pressable>
            <Pressable
              accessibilityLabel={`Open ${value.name} conversation details`}
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => onOpenInfo?.(value)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.surfacePressed]}
            >
              <View style={styles.infoIcon}>
                <Text style={styles.infoIconText}>i</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      {booking ? (
        <View style={styles.bookingBar}>
          <Pressable
            accessibilityLabel={`Open ${booking.serviceName}, ${bookingStatusLabels[booking.status]}`}
            accessibilityRole="button"
            onPress={() => onOpenBooking?.(booking)}
            style={({ pressed }) => [
              styles.bookingBarContent,
              isWide && styles.horizontalPaddingWide,
              pressed && styles.bookingBarPressed,
            ]}
          >
            <View style={styles.bookingIcon}>
              <Text style={styles.bookingIconText}>{'\u25A6'}</Text>
            </View>
            <View style={styles.bookingCopy}>
              <Text numberOfLines={1} style={styles.bookingTitle}>
                {booking.serviceName}
              </Text>
              <Text numberOfLines={1} style={styles.bookingMeta}>
                #{booking.id} · {booking.eventDate}
              </Text>
            </View>
            <View
              style={[
                styles.bookingStatus,
                booking.status === 'confirmed' && styles.bookingStatusConfirmed,
                booking.status === 'completed' && styles.bookingStatusCompleted,
              ]}
            >
              <Text
                style={[
                  styles.bookingStatusText,
                  booking.status === 'confirmed' && styles.bookingStatusTextConfirmed,
                  booking.status === 'completed' && styles.bookingStatusTextCompleted,
                ]}
              >
                {bookingStatusLabels[booking.status]}
              </Text>
            </View>
            <Text style={styles.bookingChevron}>{'\u203A'}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.messageContent,
          isWide && styles.messageContentWide,
          !messages.length && styles.messageContentEmpty,
        ]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.messageScroll}
      >
        {messages.length ? (
          messages.map((message, index) => {
            const previousMessage = messages[index - 1]
            const nextMessage = messages[index + 1]
            const showDate =
              !previousMessage ||
              toLocalDateKey(previousMessage.createdAt) !== toLocalDateKey(message.createdAt)
            const showParticipantAvatar =
              message.sender === 'participant' && nextMessage?.sender !== 'participant'

            return (
              <React.Fragment key={message.id}>
                {showDate ? <DateSeparator value={message.createdAt} /> : null}
                <MessageBubble
                  message={message}
                  onOpenAttachment={onOpenAttachment}
                  onRetry={onRetryMessage}
                  participant={value}
                  showParticipantAvatar={showParticipantAvatar}
                />
              </React.Fragment>
            )
          })
        ) : (
          <View style={styles.emptyConversation}>
            <Avatar participant={value} size="large" />
            <Text style={styles.emptyTitle}>Start a conversation with {value.name}</Text>
            <Text style={styles.emptyText}>
              Ask about availability, pricing, packages, or details for your event.
            </Text>
          </View>
        )}

        {isParticipantTyping ? (
          <View style={styles.typingRow}>
            <Avatar participant={value} size="tiny" />
            <View style={styles.typingBubble}>
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
            </View>
            <Text style={styles.typingLabel}>{value.name} is typing</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composerContainer}>
        <View style={[styles.composerContent, isWide && styles.horizontalPaddingWide]}>
          {pendingAttachments.length ? (
            <ScrollView
              contentContainerStyle={styles.pendingAttachmentList}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {pendingAttachments.map((attachment) => (
                <View key={attachment.id} style={styles.pendingAttachment}>
                  <Text numberOfLines={1} style={styles.pendingAttachmentName}>
                    {attachment.name}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Remove ${attachment.name}`}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => onRemovePendingAttachment?.(attachment)}
                  >
                    <Text style={styles.removeAttachment}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.composerRow}>
            <Pressable
              accessibilityLabel="Attach a photo or file"
              accessibilityRole="button"
              hitSlop={6}
              onPress={onAttach}
              style={({ pressed }) => [styles.attachButton, pressed && styles.surfacePressed]}
            >
              <Text style={styles.attachButtonText}>+</Text>
            </Pressable>
            <View style={styles.inputShell}>
              <TextInput
                accessibilityLabel="Message"
                maxLength={2000}
                multiline
                onChangeText={changeDraft}
                onSubmitEditing={sendMessage}
                placeholder={`Message ${value.name}`}
                placeholderTextColor={palette.muted}
                returnKeyType="send"
                style={styles.messageInput}
                value={draft}
              />
            </View>
            <Pressable
              accessibilityLabel="Send message"
              accessibilityRole="button"
              accessibilityState={{ busy: isSending, disabled: !canSend }}
              disabled={!canSend}
              onPress={sendMessage}
              style={({ pressed }) => [
                styles.sendButton,
                !canSend && styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
            >
              <Text style={styles.sendButtonText}>{isSending ? '…' : '\u2191'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const Avatar = ({
  participant,
  size,
}: {
  participant: ChatParticipant
  size: 'large' | 'small' | 'tiny'
}) => {
  const avatarStyle =
    size === 'large'
      ? styles.avatarLarge
      : size === 'tiny'
        ? styles.avatarTiny
        : styles.avatarSmall
  const textStyle = size === 'large' ? styles.avatarTextLarge : styles.avatarText

  return (
    <View style={[styles.avatar, avatarStyle]}>
      {participant.avatarUrl ? (
        <Image
          accessibilityLabel={`${participant.name} profile photo`}
          source={{ uri: participant.avatarUrl }}
          style={styles.avatarImage}
        />
      ) : (
        <Text style={textStyle}>{getInitials(participant.name)}</Text>
      )}
      {participant.isOnline && size !== 'tiny' ? <View style={styles.onlineDot} /> : null}
    </View>
  )
}

const DateSeparator = ({ value }: { value: string }) => (
  <View style={styles.dateSeparator}>
    <View style={styles.dateLine} />
    <Text style={styles.dateLabel}>{formatMessageDate(value)}</Text>
    <View style={styles.dateLine} />
  </View>
)

const MessageBubble = ({
  message,
  onOpenAttachment,
  onRetry,
  participant,
  showParticipantAvatar,
}: {
  message: ChatMessage
  onOpenAttachment?: (attachment: ChatAttachment) => void
  onRetry?: (message: ChatMessage) => void
  participant: ChatParticipant
  showParticipantAvatar: boolean
}) => {
  if (message.sender === 'system') {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemMessageText}>{message.text}</Text>
      </View>
    )
  }

  const isCurrentUser = message.sender === 'currentUser'
  const failed = message.status === 'failed'

  return (
    <View style={[styles.messageRow, isCurrentUser && styles.messageRowCurrentUser]}>
      {!isCurrentUser ? (
        showParticipantAvatar ? (
          <Avatar participant={participant} size="tiny" />
        ) : (
          <View style={styles.avatarTinySpacer} />
        )
      ) : null}
      <View style={[styles.messageStack, isCurrentUser && styles.messageStackCurrentUser]}>
        <View
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.messageBubbleCurrentUser : styles.messageBubbleParticipant,
            failed && styles.messageBubbleFailed,
          ]}
        >
          {message.text ? (
            <Text
              selectable
              style={[
                styles.messageText,
                isCurrentUser && styles.messageTextCurrentUser,
                failed && styles.messageTextFailed,
              ]}
            >
              {message.text}
            </Text>
          ) : null}
          {message.attachments?.length ? (
            <View style={[styles.attachmentList, message.text && styles.attachmentListWithText]}>
              {message.attachments.map((attachment) => (
                <AttachmentCard
                  attachment={attachment}
                  isCurrentUser={isCurrentUser}
                  key={attachment.id}
                  onPress={onOpenAttachment}
                />
              ))}
            </View>
          ) : null}
        </View>
        <View style={[styles.messageMeta, isCurrentUser && styles.messageMetaCurrentUser]}>
          <Text style={styles.messageTime}>{formatMessageTime(message.createdAt)}</Text>
          {isCurrentUser && message.status ? (
            <Text style={[styles.deliveryStatus, failed && styles.deliveryStatusFailed]}>
              {message.status === 'read' ? '\u2713\u2713 ' : ''}
              {deliveryLabels[message.status]}
            </Text>
          ) : null}
          {failed ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={5}
              onPress={() => onRetry?.(message)}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const AttachmentCard = ({
  attachment,
  isCurrentUser,
  onPress,
}: {
  attachment: ChatAttachment
  isCurrentUser: boolean
  onPress?: (attachment: ChatAttachment) => void
}) => (
  <Pressable
    accessibilityLabel={`Open attachment ${attachment.name}`}
    accessibilityRole="button"
    onPress={() => onPress?.(attachment)}
    style={({ pressed }) => [styles.attachmentCard, pressed && styles.attachmentPressed]}
  >
    {attachment.kind === 'image' ? (
      attachment.uri ? (
        <Image
          accessibilityLabel={attachment.name}
          resizeMode="cover"
          source={{ uri: attachment.uri }}
          style={styles.attachmentImage}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <View style={styles.imageMountain} />
          <View style={styles.imageSun} />
        </View>
      )
    ) : (
      <View style={[styles.fileIcon, isCurrentUser && styles.fileIconCurrentUser]}>
        <Text style={[styles.fileIconText, isCurrentUser && styles.fileIconTextCurrentUser]}>
          PDF
        </Text>
      </View>
    )}
    <View style={styles.attachmentCopy}>
      <Text
        numberOfLines={1}
        style={[styles.attachmentName, isCurrentUser && styles.attachmentNameCurrentUser]}
      >
        {attachment.name}
      </Text>
      {attachment.sizeLabel ? (
        <Text
          style={[styles.attachmentSize, isCurrentUser && styles.attachmentSizeCurrentUser]}
        >
          {attachment.sizeLabel}
        </Text>
      ) : null}
    </View>
    <Text style={[styles.attachmentArrow, isCurrentUser && styles.attachmentArrowCurrentUser]}>
      {'\u203A'}
    </Text>
  </Pressable>
)

const palette = {
  background: '#F5F3F3',
  border: '#E3E2E2',
  error: '#BA1A1A',
  errorSoft: '#FCEDEB',
  muted: '#777879',
  onPrimary: '#FFFFFF',
  pending: '#8B6117',
  pendingSoft: '#FFF3D6',
  positive: '#2F6B46',
  positiveSoft: '#E7F3EB',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  text: '#1B1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: { zIndex: 30, minHeight: 66, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.white },
  topAppBarContent: { width: '100%', maxWidth: 820, minHeight: 66, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  horizontalPaddingWide: { paddingHorizontal: 24 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  surfacePressed: { opacity: 0.58, backgroundColor: palette.background },
  backIcon: { width: 23, height: 23, justifyContent: 'center' },
  backIconHead: { position: 'absolute', left: 4, width: 10, height: 10, borderBottomWidth: 1.8, borderLeftWidth: 1.8, borderColor: palette.primary, transform: [{ rotate: '45deg' }] },
  backIconShaft: { width: 16, height: 1.8, marginLeft: 4, borderRadius: 1, backgroundColor: palette.primary },
  participantHeader: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 4 },
  headerPressed: { opacity: 0.65 },
  participantCopy: { minWidth: 0, flex: 1 },
  participantName: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  presenceText: { color: palette.positive, fontSize: 8, lineHeight: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row' },
  phoneIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-25deg' }] },
  phoneReceiver: { width: 9, height: 18, borderWidth: 2, borderColor: palette.primaryContainer, borderRadius: 6 },
  infoIcon: { width: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: palette.primaryContainer, borderRadius: 10 },
  infoIconText: { color: palette.primaryContainer, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  avatar: { overflow: 'visible', alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: palette.primarySoft },
  avatarSmall: { width: 38, height: 38 },
  avatarTiny: { width: 26, height: 26 },
  avatarLarge: { width: 64, height: 64 },
  avatarText: { color: palette.primaryContainer, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  avatarTextLarge: { color: palette.primaryContainer, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 999 },
  onlineDot: { position: 'absolute', width: 10, height: 10, right: -1, bottom: -1, borderWidth: 2, borderColor: palette.white, borderRadius: 5, backgroundColor: palette.positive },
  bookingBar: { zIndex: 20, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.white },
  bookingBarContent: { width: '100%', maxWidth: 820, minHeight: 62, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 9 },
  bookingBarPressed: { backgroundColor: '#FCFAFA' },
  bookingIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: palette.primarySoft },
  bookingIconText: { color: palette.primaryContainer, fontSize: 15, lineHeight: 19 },
  bookingCopy: { minWidth: 0, flex: 1 },
  bookingTitle: { color: palette.text, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  bookingMeta: { color: palette.secondary, fontSize: 8, lineHeight: 12, marginTop: 1 },
  bookingStatus: { borderRadius: 999, backgroundColor: palette.pendingSoft, paddingHorizontal: 8, paddingVertical: 4 },
  bookingStatusConfirmed: { backgroundColor: palette.primarySoft },
  bookingStatusCompleted: { backgroundColor: palette.positiveSoft },
  bookingStatusText: { color: palette.pending, fontSize: 7, lineHeight: 10, fontWeight: '700' },
  bookingStatusTextConfirmed: { color: palette.primaryContainer },
  bookingStatusTextCompleted: { color: palette.positive },
  bookingChevron: { color: palette.secondary, fontSize: 22, lineHeight: 24 },
  messageScroll: { flex: 1 },
  messageContent: { width: '100%', maxWidth: 820, alignSelf: 'center', flexGrow: 1, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 18 },
  messageContentWide: { paddingHorizontal: 24, paddingTop: 20 },
  messageContentEmpty: { justifyContent: 'center' },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  dateLine: { height: 1, flex: 1, backgroundColor: palette.border },
  dateLabel: { color: palette.muted, fontSize: 8, lineHeight: 12, fontWeight: '600' },
  systemMessage: { alignSelf: 'center', maxWidth: '82%', borderRadius: 999, backgroundColor: '#E9E7E7', paddingHorizontal: 12, paddingVertical: 6, marginVertical: 6 },
  systemMessageText: { color: palette.secondary, fontSize: 8, lineHeight: 13, textAlign: 'center' },
  messageRow: { maxWidth: '84%', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginVertical: 3 },
  messageRowCurrentUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  avatarTinySpacer: { width: 26 },
  messageStack: { minWidth: 0, alignItems: 'flex-start' },
  messageStackCurrentUser: { alignItems: 'flex-end' },
  messageBubble: { overflow: 'hidden', maxWidth: 540, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  messageBubbleParticipant: { borderBottomLeftRadius: 4, backgroundColor: palette.white },
  messageBubbleCurrentUser: { borderBottomRightRadius: 4, backgroundColor: palette.primaryContainer },
  messageBubbleFailed: { borderWidth: 1, borderColor: palette.error, backgroundColor: palette.errorSoft },
  messageText: { color: palette.text, fontSize: 11, lineHeight: 17 },
  messageTextCurrentUser: { color: palette.onPrimary },
  messageTextFailed: { color: palette.error },
  messageMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2, marginTop: 3 },
  messageMetaCurrentUser: { justifyContent: 'flex-end' },
  messageTime: { color: palette.muted, fontSize: 7, lineHeight: 10 },
  deliveryStatus: { color: palette.muted, fontSize: 7, lineHeight: 10 },
  deliveryStatusFailed: { color: palette.error },
  retryText: { color: palette.error, fontSize: 7, lineHeight: 10, fontWeight: '700' },
  attachmentList: { gap: 6 },
  attachmentListWithText: { marginTop: 8 },
  attachmentCard: { minWidth: 190, maxWidth: 310, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)', padding: 7 },
  attachmentPressed: { opacity: 0.68 },
  attachmentImage: { width: 44, height: 40, borderRadius: 5 },
  imagePlaceholder: { width: 44, height: 40, overflow: 'hidden', borderRadius: 5, backgroundColor: '#E4D6DA' },
  imageMountain: { position: 'absolute', width: 30, height: 30, left: 7, bottom: -15, backgroundColor: palette.primaryContainer, opacity: 0.45, transform: [{ rotate: '45deg' }] },
  imageSun: { position: 'absolute', width: 7, height: 7, right: 7, top: 7, borderRadius: 4, backgroundColor: palette.primaryContainer, opacity: 0.6 },
  fileIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: palette.primarySoft },
  fileIconCurrentUser: { backgroundColor: 'rgba(255,255,255,0.9)' },
  fileIconText: { color: palette.primaryContainer, fontSize: 7, lineHeight: 10, fontWeight: '800' },
  fileIconTextCurrentUser: { color: palette.primaryContainer },
  attachmentCopy: { minWidth: 0, flex: 1 },
  attachmentName: { color: palette.text, fontSize: 9, lineHeight: 14, fontWeight: '600' },
  attachmentNameCurrentUser: { color: palette.onPrimary },
  attachmentSize: { color: palette.secondary, fontSize: 7, lineHeight: 10, marginTop: 1 },
  attachmentSizeCurrentUser: { color: '#E5CDD3' },
  attachmentArrow: { color: palette.secondary, fontSize: 18, lineHeight: 20 },
  attachmentArrowCurrentUser: { color: palette.onPrimary },
  emptyConversation: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 36 },
  emptyTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center', marginTop: 13 },
  emptyText: { maxWidth: 390, color: palette.secondary, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 12, borderBottomLeftRadius: 4, backgroundColor: palette.white, paddingHorizontal: 10, paddingVertical: 9 },
  typingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.secondary },
  typingLabel: { color: palette.muted, fontSize: 7, lineHeight: 10 },
  composerContainer: { zIndex: 40, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.white },
  composerContent: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 9, paddingBottom: 11 },
  pendingAttachmentList: { gap: 7, paddingBottom: 8 },
  pendingAttachment: { maxWidth: 230, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 7, backgroundColor: palette.primarySoft, paddingLeft: 10, paddingRight: 7, paddingVertical: 5 },
  pendingAttachmentName: { minWidth: 0, flex: 1, color: palette.primaryContainer, fontSize: 8, lineHeight: 12, fontWeight: '600' },
  removeAttachment: { color: palette.primaryContainer, fontSize: 17, lineHeight: 18 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: palette.primarySoft },
  attachButtonText: { color: palette.primaryContainer, fontSize: 24, lineHeight: 26, fontWeight: '300' },
  inputShell: { minWidth: 0, minHeight: 42, flex: 1, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 21, backgroundColor: palette.background, paddingHorizontal: 13 },
  messageInput: { maxHeight: 104, color: palette.text, fontSize: 11, lineHeight: 17, paddingVertical: 9 },
  sendButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: palette.primaryContainer },
  sendButtonDisabled: { opacity: 0.38 },
  sendButtonPressed: { opacity: 0.86, transform: [{ scale: 0.97 }] },
  sendButtonText: { color: palette.onPrimary, fontSize: 20, lineHeight: 22, fontWeight: '700' },
})
