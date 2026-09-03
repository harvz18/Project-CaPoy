import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import type { MerchantBookingRequest } from './19-BookingRequest'

export interface MerchantBookingRequestDetails {
  clientNotes: string
  eventName: string
  eventType: string
  guestCount?: number
  packageInclusions: string[]
  requestedTime: string
  submittedAt: string
  venue: string
}

export type BookingRequestDecision = 'accepted' | 'declined'

export interface BookingRequestDecisionValue {
  decision: BookingRequestDecision
  providerNote: string
  request: MerchantBookingRequest
}

interface BookingRequestDetailsScreenProps {
  details?: Partial<MerchantBookingRequestDetails>
  initialProviderNote?: string
  onAccept?: (value: BookingRequestDecisionValue) => void
  onBack?: () => void
  onDecline?: (value: BookingRequestDecisionValue) => void
  onMessageClient?: (request: MerchantBookingRequest) => void
  onProviderNoteChange?: (note: string) => void
  processingAction?: BookingRequestDecision
  request?: MerchantBookingRequest
}

const defaultRequest: MerchantBookingRequest = {
  amount: 3500,
  clientName: 'Eleanor Vance',
  currency: 'PHP',
  eventDate: '2026-10-12',
  id: 'eleanor-vance',
  packageName: 'Premium Photography Package',
  status: 'new',
}

const defaultDetails: MerchantBookingRequestDetails = {
  clientNotes:
    'We would love a mix of candid moments and formal family portraits. The ceremony and reception are at the same venue.',
  eventName: 'Vance Wedding',
  eventType: 'Wedding',
  guestCount: 120,
  packageInclusions: [
    'Up to 8 hours of event coverage',
    'Two professional photographers',
    'Edited high-resolution digital gallery',
  ],
  requestedTime: '3:00 PM',
  submittedAt: '2026-08-30T14:30:00+08:00',
  venue: 'The Ruins, Talisay City',
}

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const MessageIcon = () => (
  <View style={styles.messageIcon}>
    <View style={styles.messageTail} />
  </View>
)

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'C'

const formatPrice = (request: MerchantBookingRequest) =>
  new Intl.NumberFormat('en-PH', {
    currency: request.currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(request.amount)

const formatDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(date)
}

const formatSubmittedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const statusLabels: Record<MerchantBookingRequest['status'], string> = {
  new: 'New Request',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const BookingRequestDetailsScreen: React.FC<BookingRequestDetailsScreenProps> = ({
  details,
  initialProviderNote = '',
  onAccept,
  onBack,
  onDecline,
  onMessageClient,
  onProviderNoteChange,
  processingAction,
  request = defaultRequest,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const value: MerchantBookingRequestDetails = { ...defaultDetails, ...details }
  const [providerNote, setProviderNote] = React.useState(initialProviderNote)
  const [showDeclineConfirmation, setShowDeclineConfirmation] = React.useState(false)
  const isProcessing = Boolean(processingAction)
  const canReview = request.status === 'new'

  const handleProviderNoteChange = (note: string) => {
    setProviderNote(note)
    onProviderNoteChange?.(note)
  }

  const buildDecision = (
    decision: BookingRequestDecision
  ): BookingRequestDecisionValue => ({
    decision,
    providerNote: providerNote.trim(),
    request: {
      ...request,
      status: decision === 'accepted' ? 'confirmed' : 'cancelled',
    },
  })

  const handleAccept = () => onAccept?.(buildDecision('accepted'))
  const handleDecline = () => onDecline?.(buildDecision('declined'))

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to booking requests"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            Booking Request
          </Text>
          <View style={styles.headerSpacer} />
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
        <View style={styles.clientHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(request.clientName)}</Text>
          </View>
          <View style={styles.clientCopy}>
            <View style={styles.clientNameRow}>
              <Text numberOfLines={2} style={styles.clientName}>
                {request.clientName}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  request.status === 'confirmed' && styles.statusBadgeConfirmed,
                  request.status === 'completed' && styles.statusBadgeCompleted,
                  request.status === 'cancelled' && styles.statusBadgeCancelled,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    request.status === 'confirmed' && styles.statusTextConfirmed,
                    request.status === 'completed' && styles.statusTextCompleted,
                    request.status === 'cancelled' && styles.statusTextCancelled,
                  ]}
                >
                  {statusLabels[request.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.submittedText}>
              Requested {formatSubmittedAt(value.submittedAt)}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={`Message ${request.clientName}`}
            accessibilityRole="button"
            onPress={() => onMessageClient?.(request)}
            style={({ pressed }) => [styles.messageButton, pressed && styles.messageButtonPressed]}
          >
            <MessageIcon />
            <Text style={styles.messageButtonText}>Message</Text>
          </Pressable>
        </View>

        <View style={[styles.detailsWorkspace, isWide && styles.detailsWorkspaceWide]}>
          <View style={styles.primaryColumn}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Event Details</Text>
              <DetailRow label="EVENT" value={value.eventName} />
              <DetailRow label="EVENT TYPE" value={value.eventType} />
              <DetailRow
                label="DATE & TIME"
                value={`${formatDate(request.eventDate)}\n${value.requestedTime}`}
              />
              <DetailRow label="VENUE" value={value.venue} />
              <DetailRow
                last
                label="EXPECTED GUESTS"
                value={value.guestCount ? `${value.guestCount} guests` : 'Not specified'}
              />
            </View>

            <View style={styles.notesCard}>
              <Text style={styles.cardTitle}>Client Notes</Text>
              <Text style={styles.clientNotes}>
                {value.clientNotes.trim() || 'The client did not add any notes.'}
              </Text>
            </View>
          </View>

          <View style={styles.secondaryColumn}>
            <View style={styles.packageCard}>
              <Text style={styles.cardEyebrow}>SELECTED PACKAGE</Text>
              <Text style={styles.packageName}>{request.packageName}</Text>
              <Text style={styles.packagePrice}>{formatPrice(request)}</Text>

              {value.packageInclusions.length > 0 ? (
                <View style={styles.inclusionList}>
                  {value.packageInclusions.map((inclusion, index) => (
                    <View key={`${inclusion}-${index}`} style={styles.inclusionRow}>
                      <View style={styles.inclusionCheck}>
                        <Text style={styles.inclusionCheckText}>{'\u2713'}</Text>
                      </View>
                      <Text style={styles.inclusionText}>{inclusion}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {canReview ? (
              <View style={styles.responseCard}>
                <View style={styles.responseHeading}>
                  <Text style={styles.cardTitle}>Response Note</Text>
                  <Text style={styles.optionalText}>Optional</Text>
                </View>
                <Text style={styles.responseHelp}>
                  Share a short confirmation or explain any next steps to the client.
                </Text>
                <TextInput
                  accessibilityLabel="Response note to client"
                  maxLength={300}
                  multiline
                  onChangeText={handleProviderNoteChange}
                  placeholder="Add a note for the client..."
                  placeholderTextColor={palette.placeholder}
                  style={styles.responseInput}
                  textAlignVertical="top"
                  value={providerNote}
                />
                <Text style={styles.characterCount}>{providerNote.length} / 300</Text>
              </View>
            ) : (
              <View style={styles.reviewedNotice}>
                <Text style={styles.reviewedNoticeTitle}>
                  This request is {statusLabels[request.status].toLowerCase()}.
                </Text>
                <Text style={styles.reviewedNoticeText}>
                  You can still message the client to discuss event details.
                </Text>
              </View>
            )}
          </View>
        </View>

        {showDeclineConfirmation && canReview ? (
          <View style={styles.declineConfirmation}>
            <View style={styles.warningIcon}>
              <Text style={styles.warningIconText}>!</Text>
            </View>
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Decline this booking request?</Text>
              <Text style={styles.warningText}>
                The client will be notified and this date will remain available for other requests.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {canReview ? (
        <View style={styles.footer}>
          <View style={[styles.footerContent, isWide && styles.wideHorizontalPadding]}>
            {showDeclineConfirmation ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={isProcessing}
                  onPress={() => setShowDeclineConfirmation(false)}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    isProcessing && styles.buttonDisabled,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Keep Request</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Confirm decline booking request"
                  accessibilityRole="button"
                  disabled={isProcessing}
                  onPress={handleDecline}
                  style={({ pressed }) => [
                    styles.declineConfirmButton,
                    isProcessing && styles.buttonDisabled,
                    pressed && styles.declineConfirmButtonPressed,
                  ]}
                >
                  <Text style={styles.declineConfirmButtonText}>
                    {processingAction === 'declined' ? 'Declining...' : 'Confirm Decline'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityLabel="Decline booking request"
                  accessibilityRole="button"
                  disabled={isProcessing}
                  onPress={() => setShowDeclineConfirmation(true)}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    isProcessing && styles.buttonDisabled,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Decline</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Accept booking request"
                  accessibilityRole="button"
                  disabled={isProcessing}
                  onPress={handleAccept}
                  style={({ pressed }) => [
                    styles.acceptButton,
                    isProcessing && styles.buttonDisabled,
                    pressed && styles.acceptButtonPressed,
                  ]}
                >
                  <Text style={styles.acceptButtonText}>
                    {processingAction === 'accepted' ? 'Accepting...' : 'Accept Request'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const DetailRow = ({
  label,
  last = false,
  value,
}: {
  label: string
  last?: boolean
  value: string
}) => (
  <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
)

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  completed: '#145133',
  completedSoft: '#E7F3EB',
  error: '#93000A',
  errorSoft: '#FFDAD6',
  onPrimary: '#FFFFFF',
  placeholder: '#A8A8A9',
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
  topAppBar: {
    zIndex: 30,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.72 },
  backIcon: { width: 24, height: 24, justifyContent: 'center' },
  backIconHead: {
    position: 'absolute',
    left: 4,
    width: 10,
    height: 10,
    borderBottomWidth: 1.8,
    borderLeftWidth: 1.8,
    borderColor: palette.primary,
    transform: [{ rotate: '45deg' }],
  },
  backIconShaft: {
    width: 16,
    height: 1.8,
    marginLeft: 4,
    borderRadius: 1,
    backgroundColor: palette.primary,
  },
  headerTitle: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  content: { width: '100%', maxWidth: 1024, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 120 },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingBottom: 24,
    marginBottom: 24,
  },
  avatar: {
    width: 54,
    height: 54,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: palette.primarySoft,
  },
  avatarText: { color: palette.primaryContainer, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  clientCopy: { minWidth: 0, flex: 1 },
  clientNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  clientName: { color: palette.text, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  submittedText: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  statusBadge: { borderRadius: 999, backgroundColor: palette.primarySoft, paddingHorizontal: 9, paddingVertical: 4 },
  statusBadgeConfirmed: { backgroundColor: palette.primarySoft },
  statusBadgeCompleted: { backgroundColor: palette.completedSoft },
  statusBadgeCancelled: { backgroundColor: palette.errorSoft },
  statusBadgeText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  statusTextConfirmed: { color: palette.primaryContainer },
  statusTextCompleted: { color: palette.completed },
  statusTextCancelled: { color: palette.error },
  messageButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageButtonPressed: { backgroundColor: palette.surfaceContainerLow },
  messageButtonText: { color: palette.primaryContainer, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  messageIcon: { width: 17, height: 14, borderWidth: 1.4, borderColor: palette.primaryContainer, borderRadius: 4 },
  messageTail: {
    position: 'absolute',
    bottom: -4,
    left: 2,
    width: 6,
    height: 6,
    borderLeftWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: palette.primaryContainer,
    transform: [{ skewY: '-35deg' }],
    backgroundColor: palette.background,
  },
  detailsWorkspace: { gap: 20 },
  detailsWorkspaceWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  primaryColumn: { minWidth: 0, flex: 1.15, gap: 20 },
  secondaryColumn: { minWidth: 0, flex: 0.85, gap: 20 },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  cardTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 14 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  detailLabel: { width: 112, color: palette.secondary, fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4 },
  detailValue: { minWidth: 0, flex: 1, color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  notesCard: { borderRadius: 10, backgroundColor: palette.surfaceContainerLow, padding: 18 },
  clientNotes: { color: palette.secondary, fontSize: 14, lineHeight: 21, marginTop: 10 },
  packageCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
    padding: 18,
  },
  cardEyebrow: { color: palette.secondary, fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.7 },
  packageName: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '600', marginTop: 5 },
  packagePrice: { color: palette.primaryContainer, fontSize: 22, lineHeight: 28, fontWeight: '700', marginTop: 6 },
  inclusionList: { gap: 9, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 15, marginTop: 16 },
  inclusionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  inclusionCheck: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: palette.primarySoft,
  },
  inclusionCheckText: { color: palette.primaryContainer, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  inclusionText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  responseCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 18 },
  responseHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionalText: { color: palette.placeholder, fontSize: 11, lineHeight: 15 },
  responseHelp: { color: palette.secondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  responseInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.white,
    color: palette.text,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  characterCount: { alignSelf: 'flex-end', color: palette.placeholder, fontSize: 11, lineHeight: 15, marginTop: 4 },
  reviewedNotice: { borderRadius: 10, backgroundColor: palette.surfaceContainerLow, padding: 18 },
  reviewedNoticeTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  reviewedNoticeText: { color: palette.secondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  declineConfirmation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8A9A4',
    borderRadius: 10,
    backgroundColor: palette.errorSoft,
    padding: 16,
    marginTop: 20,
  },
  warningIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.error,
  },
  warningIconText: { color: palette.onPrimary, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  warningCopy: { minWidth: 0, flex: 1 },
  warningTitle: { color: palette.error, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  warningText: { color: palette.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
  footer: {
    zIndex: 40,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
  },
  footerContent: {
    width: '100%',
    maxWidth: 1024,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  secondaryButton: {
    minWidth: 116,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.primaryContainer,
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  secondaryButtonPressed: { backgroundColor: palette.primarySoft },
  secondaryButtonText: { color: palette.primaryContainer, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  acceptButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 20,
  },
  acceptButtonPressed: { opacity: 0.86 },
  acceptButtonText: { color: palette.onPrimary, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  declineConfirmButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: palette.error,
    paddingHorizontal: 20,
  },
  declineConfirmButtonPressed: { opacity: 0.86 },
  declineConfirmButtonText: { color: palette.onPrimary, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
})
