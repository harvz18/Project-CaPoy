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

export type BookingDeclineReason =
  | 'dateUnavailable'
  | 'scheduleConflict'
  | 'outsideServiceArea'
  | 'packageUnavailable'
  | 'requirementsUnsupported'
  | 'other'

export interface BookingRequestDeclineValue {
  blockRequestedDate: boolean
  message: string
  reason: BookingDeclineReason
  reasonLabel: string
  request: MerchantBookingRequest
}

interface BookingRequestDeclineScreenProps {
  blockDateByDefault?: boolean
  initialMessage?: string
  initialReason?: BookingDeclineReason
  isSubmitting?: boolean
  onBack?: () => void
  onBlockDateChange?: (blocked: boolean) => void
  onCancel?: () => void
  onConfirmDecline?: (value: BookingRequestDeclineValue) => void
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

const reasonOptions: Array<{
  description: string
  id: BookingDeclineReason
  label: string
}> = [
  {
    id: 'dateUnavailable',
    label: 'Date is unavailable',
    description: 'You cannot provide the service on the requested date.',
  },
  {
    id: 'scheduleConflict',
    label: 'Schedule conflict',
    description: 'Another commitment overlaps with this event.',
  },
  {
    id: 'outsideServiceArea',
    label: 'Outside service area',
    description: 'The venue is beyond the area your business serves.',
  },
  {
    id: 'packageUnavailable',
    label: 'Package is unavailable',
    description: 'The selected package cannot be provided for this event.',
  },
  {
    id: 'requirementsUnsupported',
    label: 'Cannot meet requirements',
    description: 'The request needs services or resources you cannot supply.',
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'Explain another reason in your message to the client.',
  },
]

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
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
    year: 'numeric',
  }).format(date)
}

export const BookingRequestDeclineScreen: React.FC<BookingRequestDeclineScreenProps> = ({
  blockDateByDefault = false,
  initialMessage = '',
  initialReason,
  isSubmitting = false,
  onBack,
  onBlockDateChange,
  onCancel,
  onConfirmDecline,
  request = defaultRequest,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [selectedReason, setSelectedReason] = React.useState<BookingDeclineReason | undefined>(
    initialReason
  )
  const [message, setMessage] = React.useState(initialMessage)
  const [blockRequestedDate, setBlockRequestedDate] = React.useState(blockDateByDefault)
  const [submitted, setSubmitted] = React.useState(false)

  const reasonMissing = submitted && !selectedReason
  const messageMissing = submitted && selectedReason === 'other' && message.trim().length === 0

  const handleBlockDateChange = () => {
    const nextValue = !blockRequestedDate
    setBlockRequestedDate(nextValue)
    onBlockDateChange?.(nextValue)
  }

  const handleConfirm = () => {
    setSubmitted(true)
    if (!selectedReason || (selectedReason === 'other' && !message.trim())) return

    const reason = reasonOptions.find((option) => option.id === selectedReason)
    if (!reason) return

    onConfirmDecline?.({
      blockRequestedDate,
      message: message.trim(),
      reason: selectedReason,
      reasonLabel: reason.label,
      request: { ...request, status: 'cancelled' },
    })
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to booking request"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            Decline Request
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
        <View style={styles.intro}>
          <View style={styles.warningIcon}>
            <Text style={styles.warningIconText}>!</Text>
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.title}>Decline this booking request?</Text>
            <Text style={styles.subtitle}>
              Tell the client why you cannot accept so they can choose another provider.
            </Text>
          </View>
        </View>

        <View style={styles.requestCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(request.clientName)}</Text>
          </View>
          <View style={styles.requestCopy}>
            <View style={styles.requestHeading}>
              <Text numberOfLines={1} style={styles.clientName}>
                {request.clientName}
              </Text>
              <Text style={styles.price}>{formatPrice(request)}</Text>
            </View>
            <Text style={styles.packageName}>{request.packageName}</Text>
            <Text style={styles.eventDate}>{formatDate(request.eventDate)}</Text>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionTitle}>Why are you declining?</Text>
            <Text style={styles.sectionHelp}>Select the reason that best fits this request.</Text>

            <View accessibilityRole="radiogroup" style={styles.reasonList}>
              {reasonOptions.map((option) => {
                const selected = selectedReason === option.id

                return (
                  <Pressable
                    key={option.id}
                    accessibilityLabel={`${option.label}. ${option.description}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    disabled={isSubmitting}
                    onPress={() => setSelectedReason(option.id)}
                    style={({ pressed }) => [
                      styles.reasonOption,
                      selected && styles.reasonOptionSelected,
                      pressed && styles.reasonOptionPressed,
                    ]}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.reasonCopy}>
                      <Text style={[styles.reasonLabel, selected && styles.reasonLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.reasonDescription}>{option.description}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>

            {reasonMissing ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                Select a reason before declining the request.
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionTitle}>Message to Client</Text>
              <Text style={styles.optionalText}>
                {selectedReason === 'other' ? 'Required' : 'Optional'}
              </Text>
            </View>
            <Text style={styles.sectionHelp}>
              This message will be included with the decline notification.
            </Text>
            <TextInput
              accessibilityLabel="Decline message to client"
              editable={!isSubmitting}
              maxLength={300}
              multiline
              onChangeText={setMessage}
              placeholder="Add a clear and courteous message..."
              placeholderTextColor={palette.placeholder}
              style={[styles.messageInput, messageMissing && styles.inputError]}
              textAlignVertical="top"
              value={message}
            />
            <View style={styles.messageFooter}>
              {messageMissing ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  Explain the other reason to the client.
                </Text>
              ) : (
                <View />
              )}
              <Text style={styles.characterCount}>{message.length} / 300</Text>
            </View>
          </View>

          <Pressable
            accessibilityLabel="Block requested date on availability calendar"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: blockRequestedDate, disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={handleBlockDateChange}
            style={({ pressed }) => [styles.blockDateCard, pressed && styles.blockDateCardPressed]}
          >
            <View style={[styles.checkbox, blockRequestedDate && styles.checkboxSelected]}>
              {blockRequestedDate ? <Text style={styles.checkboxCheck}>{'\u2713'}</Text> : null}
            </View>
            <View style={styles.blockDateCopy}>
              <Text style={styles.blockDateTitle}>Block this date on my calendar</Text>
              <Text style={styles.blockDateDescription}>
                Mark {formatDate(request.eventDate)} unavailable for new booking requests.
              </Text>
            </View>
          </Pressable>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>What happens next?</Text>
            <Text style={styles.noticeText}>
              The request moves to Cancelled and the client is notified immediately. This action
              cannot be undone from this screen.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.footerContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={onCancel ?? onBack}
            style={({ pressed }) => [
              styles.cancelButton,
              isSubmitting && styles.buttonDisabled,
              pressed && styles.cancelButtonPressed,
            ]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Confirm decline request"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.declineButton,
              isSubmitting && styles.buttonDisabled,
              pressed && styles.declineButtonPressed,
            ]}
          >
            <Text style={styles.declineButtonText}>
              {isSubmitting ? 'Declining...' : 'Decline Request'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
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
    maxWidth: 760,
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
  content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 120 },
  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24 },
  warningIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: palette.errorSoft,
  },
  warningIconText: { color: palette.error, fontSize: 18, lineHeight: 22, fontWeight: '700' },
  introCopy: { minWidth: 0, flex: 1 },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
    padding: 14,
    marginBottom: 28,
  },
  avatar: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: palette.primarySoft,
  },
  avatarText: { color: palette.primaryContainer, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  requestCopy: { minWidth: 0, flex: 1 },
  requestHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  clientName: { minWidth: 0, flex: 1, color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  price: { color: palette.primaryContainer, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  packageName: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  eventDate: { color: palette.primaryContainer, fontSize: 12, lineHeight: 17, fontWeight: '500', marginTop: 2 },
  form: { gap: 28 },
  fieldGroup: { gap: 6 },
  sectionTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '600' },
  sectionHelp: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  reasonList: { gap: 8, marginTop: 8 },
  reasonOption: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.white,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  reasonOptionSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primarySoft },
  reasonOptionPressed: { opacity: 0.72 },
  radio: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.placeholder,
    borderRadius: 10,
  },
  radioSelected: { borderColor: palette.primaryContainer },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primaryContainer },
  reasonCopy: { minWidth: 0, flex: 1 },
  reasonLabel: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  reasonLabelSelected: { color: palette.primaryContainer },
  reasonDescription: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 1 },
  errorText: { color: palette.error, fontSize: 12, lineHeight: 17 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionalText: { color: palette.placeholder, fontSize: 11, lineHeight: 15 },
  messageInput: {
    minHeight: 108,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.white,
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 6,
  },
  inputError: { borderColor: palette.error },
  messageFooter: { minHeight: 17, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  characterCount: { color: palette.placeholder, fontSize: 11, lineHeight: 15, marginLeft: 'auto' },
  blockDateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.white,
    padding: 14,
  },
  blockDateCardPressed: { backgroundColor: palette.surfaceContainerLow },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.placeholder,
    borderRadius: 4,
  },
  checkboxSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryContainer },
  checkboxCheck: { color: palette.onPrimary, fontSize: 12, lineHeight: 15, fontWeight: '700' },
  blockDateCopy: { minWidth: 0, flex: 1 },
  blockDateTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  blockDateDescription: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  notice: { borderRadius: 8, backgroundColor: palette.surfaceContainerLow, padding: 14 },
  noticeTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  noticeText: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  footer: {
    zIndex: 40,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
  },
  footerContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cancelButton: {
    minWidth: 104,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.primaryContainer,
    borderRadius: 8,
    paddingHorizontal: 18,
  },
  cancelButtonPressed: { backgroundColor: palette.primarySoft },
  cancelButtonText: { color: palette.primaryContainer, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  declineButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: palette.error,
    paddingHorizontal: 18,
  },
  declineButtonPressed: { opacity: 0.86 },
  declineButtonText: { color: palette.onPrimary, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
})
