import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import type { MerchantBookingRequest } from './19-BookingRequest'

export interface MerchantBookingDetailValue {
  clientEmail: string
  clientImage: string
  clientImageLabel: string
  clientMessage: string
  eventType: string
  guestCount: string
  packageDescription: string
  packageInclusions: string[]
  requestedTime: string
  venueAddress: string
  venueName: string
}

interface MerchantBookingDetailScreenProps {
  details?: Partial<MerchantBookingDetailValue>
  onAccept?: (request: MerchantBookingRequest) => void
  onBack?: () => void
  onDecline?: (request: MerchantBookingRequest) => void
  onEmailClient?: (email: string) => void
  processingAction?: 'accept' | 'decline'
  request?: MerchantBookingRequest
}

const defaultRequest: MerchantBookingRequest = {
  amount: 3500,
  clientName: 'Eleanor Vance',
  currency: 'PHP',
  eventDate: '2026-08-24',
  id: 'eleanor-vance',
  packageName: 'Premium Photography Package',
  status: 'new',
}

const defaultDetails: MerchantBookingDetailValue = {
  clientEmail: 'eleanor.v@example.com',
  clientImage:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDBjDqSTEQoQpsBPtVqc8fsZkFY8tLVtZQNwO7dtbe3wJ2hIumaWByzEBOu9CQ4xEzVgkeVsjWguz9ErGJK_cMX0x8AZ6ojb4RAwlxPEb79Gc2HjFshzAfF-MnoOpYSfVOA_27FwR0756iW_DiqNKEqlRJsbJH67_5tec5sE6wnH85CzPoNOfH8TYptMEiuvigfjVQRruUZJZpqWd1jNqZka9jYvSMCWroOivDsWJ6blPPeGblFMfKcHw',
  clientImageLabel: 'Eleanor Vance profile photo',
  clientMessage:
    'We are absolutely in love with your candid style! We are hoping for a relaxed, documentary feel for our wedding day, focusing on unposed moments with our family and friends. Our venue is mostly outdoors in a garden setting, so natural light will be abundant. Looking forward to discussing this further if you have availability!',
  eventType: 'Summer Wedding',
  guestCount: '150 - 200',
  packageDescription: 'Full-day coverage with dual photographers',
  packageInclusions: [
    '8 hours of continuous coverage',
    'Second photographer for multiple angles',
    'High-resolution edited digital gallery (500+ images)',
    '1-hour engagement session included',
  ],
  requestedTime: '2:00 PM - 10:00 PM',
  venueAddress: '123 Conservatory Way, Bacolod City',
  venueName: 'The Grand Botanical Gardens',
}

const statusLabels: Record<MerchantBookingRequest['status'], string> = {
  new: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

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
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export const MerchantBookingDetailScreen: React.FC<MerchantBookingDetailScreenProps> = ({
  details,
  onAccept,
  onBack,
  onDecline,
  onEmailClient,
  processingAction,
  request = defaultRequest,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const value: MerchantBookingDetailValue = { ...defaultDetails, ...details }
  const isProcessing = Boolean(processingAction)
  const isPending = request.status === 'new'

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <View style={styles.headerTitleGroup}>
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
              Request Details
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              request.status === 'confirmed' && styles.statusBadgeConfirmed,
              request.status === 'completed' && styles.statusBadgeCompleted,
              request.status === 'cancelled' && styles.statusBadgeCancelled,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                request.status === 'confirmed' && styles.statusDotConfirmed,
                request.status === 'completed' && styles.statusDotCompleted,
                request.status === 'cancelled' && styles.statusDotCancelled,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                request.status === 'confirmed' && styles.statusTextConfirmed,
                request.status === 'completed' && styles.statusTextCompleted,
                request.status === 'cancelled' && styles.statusTextCancelled,
              ]}
            >
              {statusLabels[request.status]}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide && styles.wideHorizontalPadding,
          isPending ? styles.contentWithActions : styles.contentWithoutActions,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.clientHero}>
          <Image
            accessibilityLabel={value.clientImageLabel}
            resizeMode="cover"
            source={{ uri: value.clientImage }}
            style={styles.clientImage}
          />
          <Text style={styles.clientName}>{request.clientName}</Text>
          <Pressable
            accessibilityLabel={`Email ${request.clientName} at ${value.clientEmail}`}
            accessibilityRole="link"
            onPress={() => onEmailClient?.(value.clientEmail)}
            style={({ pressed }) => [styles.emailRow, pressed && styles.emailRowPressed]}
          >
            <MailIcon />
            <Text style={styles.clientEmail}>{value.clientEmail}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Overview</Text>
          <View style={[styles.overviewGrid, isWide && styles.overviewGridWide]}>
            <OverviewCard
              icon="event"
              label="Event Type"
              value={value.eventType}
              wide={isWide}
            />
            <OverviewCard
              detail={value.requestedTime}
              icon="calendar"
              label="Date & Time"
              value={formatDate(request.eventDate)}
              wide={isWide}
            />
            <OverviewCard
              icon="guests"
              label="Guest Count"
              value={value.guestCount}
              wide={isWide}
            />
          </View>

          <View style={styles.venueCard}>
            <View style={styles.overviewIconCircle}>
              <OverviewIcon name="location" />
            </View>
            <View style={styles.venueCopy}>
              <Text style={styles.overviewLabel}>VENUE LOCATION</Text>
              <Text style={styles.overviewValue}>{value.venueName}</Text>
              <Text style={styles.overviewDetail}>{value.venueAddress}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.sectionBorder]}>
          <Text style={styles.sectionTitle}>Requested Services</Text>
          <View style={styles.serviceCard}>
            <View style={styles.serviceHeader}>
              <View style={styles.serviceCopy}>
                <Text style={styles.packageName}>{request.packageName}</Text>
                <Text style={styles.packageDescription}>{value.packageDescription}</Text>
              </View>
              <View style={styles.priceGroup}>
                <Text style={styles.price}>{formatPrice(request)}</Text>
                <Text style={styles.priceCaption}>Estimated</Text>
              </View>
            </View>

            <View style={styles.inclusionSection}>
              <Text style={styles.inclusionHeading}>PACKAGE INCLUSIONS</Text>
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
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.sectionBorder]}>
          <Text style={styles.sectionTitle}>Message from {request.clientName.split(' ')[0]}</Text>
          <View style={styles.messageCard}>
            <Text style={styles.quoteMark}>{'\u201C'}</Text>
            <Text style={styles.clientMessage}>{value.clientMessage}</Text>
          </View>
        </View>
      </ScrollView>

      {isPending ? (
        <View style={styles.footer}>
          <View style={[styles.footerContent, isWide && styles.wideHorizontalPadding]}>
            <Pressable
              accessibilityLabel="Decline booking request"
              accessibilityRole="button"
              disabled={isProcessing}
              onPress={() => onDecline?.(request)}
              style={({ pressed }) => [
                styles.declineButton,
                isProcessing && styles.buttonDisabled,
                pressed && styles.declineButtonPressed,
              ]}
            >
              <Text style={styles.declineButtonText}>
                {processingAction === 'decline' ? 'Declining...' : 'Decline'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Accept booking request"
              accessibilityRole="button"
              disabled={isProcessing}
              onPress={() => onAccept?.({ ...request, status: 'confirmed' })}
              style={({ pressed }) => [
                styles.acceptButton,
                isProcessing && styles.buttonDisabled,
                pressed && styles.acceptButtonPressed,
              ]}
            >
              <Text style={styles.acceptCheck}>{'\u2713'}</Text>
              <Text style={styles.acceptButtonText}>
                {processingAction === 'accept' ? 'Accepting...' : 'Accept Request'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const MailIcon = () => (
  <View style={styles.mailIcon}>
    <View style={styles.mailFoldLeft} />
    <View style={styles.mailFoldRight} />
  </View>
)

type OverviewIconName = 'event' | 'calendar' | 'guests' | 'location'

const OverviewCard = ({
  detail,
  icon,
  label,
  value,
  wide,
}: {
  detail?: string
  icon: OverviewIconName
  label: string
  value: string
  wide: boolean
}) => (
  <View style={[styles.overviewCard, wide && styles.overviewCardWide]}>
    <View style={styles.overviewIconCircle}>
      <OverviewIcon name={icon} />
    </View>
    <View style={styles.overviewCopy}>
      <Text style={styles.overviewLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.overviewValue}>{value}</Text>
      {detail ? <Text style={styles.overviewDetail}>{detail}</Text> : null}
    </View>
  </View>
)

const OverviewIcon = ({ name }: { name: OverviewIconName }) => {
  if (name === 'calendar') {
    return (
      <View style={styles.calendarIcon}>
        <View style={styles.calendarRule} />
        <View style={styles.calendarDots}>
          <View style={styles.calendarDot} />
          <View style={styles.calendarDot} />
        </View>
      </View>
    )
  }

  if (name === 'guests') {
    return (
      <View style={styles.guestsIcon}>
        <View style={[styles.guestHead, styles.guestHeadLeft]} />
        <View style={[styles.guestHead, styles.guestHeadRight]} />
        <View style={styles.guestShoulders} />
      </View>
    )
  }

  if (name === 'location') {
    return (
      <View style={styles.locationIcon}>
        <View style={styles.locationDot} />
      </View>
    )
  }

  return <Text style={styles.eventIcon}>{'\u2726'}</Text>
}

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  completed: '#145133',
  completedSoft: '#E7F3EB',
  error: '#93000A',
  errorSoft: '#FFDAD6',
  onPrimary: '#FFFFFF',
  outline: '#877274',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerHigh: '#E9E8E8',
  surfaceContainerLow: '#F5F3F3',
  surfaceDim: '#DBDAD9',
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
    borderBottomColor: palette.surfaceContainerHigh,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 768,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
  },
  wideHorizontalPadding: { paddingHorizontal: 24 },
  headerTitleGroup: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backButtonPressed: { backgroundColor: palette.surfaceContainerHigh, opacity: 0.72 },
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
  headerTitle: { minWidth: 0, flex: 1, color: palette.primary, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusBadgeConfirmed: { backgroundColor: palette.primarySoft },
  statusBadgeCompleted: { backgroundColor: palette.completedSoft },
  statusBadgeCancelled: { backgroundColor: palette.errorSoft },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.outline },
  statusDotConfirmed: { backgroundColor: palette.primaryContainer },
  statusDotCompleted: { backgroundColor: palette.completed },
  statusDotCancelled: { backgroundColor: palette.error },
  statusText: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  statusTextConfirmed: { color: palette.primaryContainer },
  statusTextCompleted: { color: palette.completed },
  statusTextCancelled: { color: palette.error },
  content: { width: '100%', maxWidth: 768, alignSelf: 'center' },
  contentWithActions: { paddingBottom: 112 },
  contentWithoutActions: { paddingBottom: 40 },
  clientHero: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  clientImage: {
    width: 96,
    height: 96,
    borderWidth: 4,
    borderColor: palette.background,
    borderRadius: 48,
    backgroundColor: palette.surfaceContainerHigh,
  },
  clientName: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700', marginTop: 12 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, padding: 3, marginTop: 2 },
  emailRowPressed: { backgroundColor: palette.surfaceContainerLow },
  clientEmail: { color: palette.secondary, fontSize: 14, lineHeight: 20 },
  mailIcon: { width: 16, height: 12, overflow: 'hidden', borderWidth: 1.3, borderColor: palette.secondary, borderRadius: 2 },
  mailFoldLeft: {
    position: 'absolute',
    top: 3,
    left: -1,
    width: 10,
    height: 1.2,
    backgroundColor: palette.secondary,
    transform: [{ rotate: '31deg' }],
  },
  mailFoldRight: {
    position: 'absolute',
    top: 3,
    right: -1,
    width: 10,
    height: 1.2,
    backgroundColor: palette.secondary,
    transform: [{ rotate: '-31deg' }],
  },
  section: { paddingHorizontal: 16, paddingVertical: 24 },
  sectionBorder: { borderTopWidth: 1, borderTopColor: palette.border },
  sectionTitle: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '600', marginBottom: 16 },
  overviewGrid: { gap: 16 },
  overviewGridWide: { flexDirection: 'row' },
  overviewCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 4,
    backgroundColor: palette.surfaceContainerLow,
    padding: 16,
  },
  overviewCardWide: { minWidth: 0, flex: 1 },
  overviewIconCircle: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: palette.background,
  },
  overviewCopy: { minWidth: 0, flex: 1 },
  overviewLabel: { color: palette.secondary, fontSize: 11, lineHeight: 15, letterSpacing: 0.7, marginBottom: 3 },
  overviewValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  overviewDetail: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 4,
    backgroundColor: palette.surfaceContainerLow,
    padding: 16,
    marginTop: 16,
  },
  venueCopy: { minWidth: 0, flex: 1 },
  eventIcon: { color: palette.primaryContainer, fontSize: 24, lineHeight: 28 },
  calendarIcon: { width: 20, height: 19, overflow: 'hidden', borderWidth: 1.5, borderColor: palette.primaryContainer, borderRadius: 3 },
  calendarRule: { width: '100%', height: 1.4, backgroundColor: palette.primaryContainer, marginTop: 5 },
  calendarDots: { flexDirection: 'row', gap: 4, marginTop: 4, marginLeft: 4 },
  calendarDot: { width: 3, height: 3, borderRadius: 1, backgroundColor: palette.primaryContainer },
  guestsIcon: { width: 24, height: 23 },
  guestHead: { position: 'absolute', top: 2, width: 7, height: 7, borderWidth: 1.4, borderColor: palette.primaryContainer, borderRadius: 4 },
  guestHeadLeft: { left: 3 },
  guestHeadRight: { right: 3 },
  guestShoulders: {
    position: 'absolute',
    bottom: 2,
    width: 24,
    height: 11,
    borderWidth: 1.4,
    borderBottomWidth: 0,
    borderColor: palette.primaryContainer,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  locationIcon: {
    width: 18,
    height: 22,
    alignItems: 'center',
    borderWidth: 1.6,
    borderColor: palette.primaryContainer,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 9,
    transform: [{ rotate: '45deg' }],
  },
  locationDot: {
    width: 5,
    height: 5,
    borderWidth: 1.2,
    borderColor: palette.primaryContainer,
    borderRadius: 3,
    marginTop: 4,
  },
  serviceCard: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 8 },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surfaceContainerLow,
    padding: 16,
  },
  serviceCopy: { minWidth: 0, flex: 1 },
  packageName: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  packageDescription: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  priceGroup: { alignItems: 'flex-end' },
  price: { color: palette.primaryContainer, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  priceCaption: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 3 },
  inclusionSection: { padding: 16 },
  inclusionHeading: { color: palette.secondary, fontSize: 11, lineHeight: 15, letterSpacing: 0.7, marginBottom: 12 },
  inclusionList: { gap: 12 },
  inclusionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  inclusionCheck: {
    width: 20,
    height: 20,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: palette.primarySoft,
  },
  inclusionCheckText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  inclusionText: { minWidth: 0, flex: 1, color: palette.text, fontSize: 14, lineHeight: 20 },
  messageCard: {
    position: 'relative',
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: palette.primaryContainer,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: palette.surfaceContainerLow,
    padding: 24,
  },
  quoteMark: {
    position: 'absolute',
    top: -2,
    right: 12,
    color: palette.surfaceDim,
    fontSize: 58,
    lineHeight: 66,
    fontWeight: '700',
    opacity: 0.5,
  },
  clientMessage: { color: palette.text, fontSize: 16, lineHeight: 26, fontStyle: 'italic', paddingRight: 16 },
  footer: {
    zIndex: 40,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
  },
  footerContent: {
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  declineButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 4,
    paddingHorizontal: 20,
  },
  declineButtonPressed: { backgroundColor: palette.surfaceContainerLow },
  declineButtonText: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  acceptButton: {
    minHeight: 50,
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 20,
  },
  acceptButtonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  acceptCheck: { color: palette.onPrimary, fontSize: 18, lineHeight: 22, fontWeight: '700' },
  acceptButtonText: { color: palette.onPrimary, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
})
