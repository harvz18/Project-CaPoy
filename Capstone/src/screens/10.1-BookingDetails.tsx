import React from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { BookingItem } from './10-BookingScreen'

export interface BookingDetailValue {
  confirmedDate: string
  coverage: string
  date: string
  paymentStatus: string
  price: string
  requestedDate: string
  service: string
  time: string
}

interface BookingDetailsScreenProps {
  booking?: BookingItem
  details?: Partial<BookingDetailValue>
  onBack?: () => void
  onCancelOrReschedule?: () => void
  onMessageProvider?: () => void
}

const defaultProvider: Pick<
  BookingItem,
  'category' | 'image' | 'imageLabel' | 'name'
> = {
  name: 'Lumina Studios',
  category: 'Photography',
  imageLabel: 'Premium camera lens on a white marble surface',
  image:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA0Fb2-g7_vlAPClrrgdTM3UGNmnrPIMQgSRE3sgb8csRiqWdSuk2PrdPzC-05cAJr_nZtTzaMFyk--FHj1W1F9xJrbW9s_mwRvqTEFDUhEiRZUV65A9EWz-gKyplEfphrN-FFv1sW9g5lNDJyLuUwPqRvFPkP-RHF84OmkJ5CQc-RJs6xkqoH8S5hoYXjmOGTiyntWNIrQRoS8R0vNP38s05VrAZeE-wSrMTdT476tUrn7jLiuN4X4Vg',
}

const defaultDetails: BookingDetailValue = {
  requestedDate: 'Oct 10, 2024',
  confirmedDate: 'Oct 12, 2024',
  service: 'Wedding Photography',
  date: 'Oct 24, 2025',
  time: '1:00 PM',
  coverage: 'Full Day',
  price: '$3,200',
  paymentStatus: 'Paid',
}

const serviceNames: Record<string, string> = {
  Catering: 'Wedding Catering',
  Florist: 'Wedding Floral Design',
  Photography: 'Wedding Photography',
}

export const BookingDetailsScreen: React.FC<BookingDetailsScreenProps> = ({
  booking,
  details,
  onBack,
  onCancelOrReschedule,
  onMessageProvider,
}) => {
  const provider = booking ?? defaultProvider
  const value = {
    ...defaultDetails,
    ...(booking
      ? {
          service: serviceNames[booking.category] ?? booking.category,
          date: booking.date,
        }
      : {}),
    ...details,
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarContent}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Booking Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.providerHeader}>
          <Image
            accessibilityLabel={provider.imageLabel}
            resizeMode="cover"
            source={{ uri: provider.image }}
            style={styles.providerImage}
          />
          <View style={styles.providerCopy}>
            <Text numberOfLines={2} style={styles.providerName}>
              {provider.name}
            </Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{provider.category}</Text>
            </View>
          </View>
        </View>

        <View style={styles.timeline}>
          <View style={styles.timelineLine} />
          <TimelineStep
            complete
            date={value.requestedDate}
            label="Requested"
          />
          <TimelineStep
            complete
            date={value.confirmedDate}
            label="Confirmed"
          />
          <TimelineStep label="Completed" />
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Booking Details</Text>
          <DetailRow label="SERVICE" value={value.service} />
          <DetailRow
            label="DATE & TIME"
            value={`${value.date}\n${value.time}`}
          />
          <DetailRow label="COVERAGE" value={value.coverage} />
          <DetailRow label="PRICE" last price value={value.price} />
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.paymentLabel}>Payment Status</Text>
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentBadgeText}>{value.paymentStatus}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onMessageProvider}
            style={({ pressed }) => [
              styles.messageButton,
              pressed && styles.messageButtonPressed,
            ]}
          >
            <View style={styles.messageIcon}>
              <View style={styles.messageIconTail} />
            </View>
            <Text style={styles.messageButtonText}>Message Provider</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onCancelOrReschedule}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>CANCEL OR RESCHEDULE</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

interface TimelineStepProps {
  complete?: boolean
  date?: string
  label: string
}

const TimelineStep: React.FC<TimelineStepProps> = ({ complete = false, date, label }) => (
  <View style={styles.timelineStep}>
    <View style={[styles.stepOuter, !complete && styles.stepOuterPending]}>
      {complete ? (
        <View style={styles.stepComplete}>
          <Text style={styles.stepCheck}>{'\u2713'}</Text>
        </View>
      ) : (
        <View style={styles.stepPending} />
      )}
    </View>
    <View style={styles.stepCopy}>
      <Text style={[styles.stepLabel, !complete && styles.stepLabelPending]}>{label}</Text>
      {date && <Text style={styles.stepDate}>{date}</Text>}
    </View>
  </View>
)

interface DetailRowProps {
  label: string
  last?: boolean
  price?: boolean
  value: string
}

const DetailRow: React.FC<DetailRowProps> = ({ label, last = false, price = false, value }) => (
  <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, price && styles.priceValue]}>{value}</Text>
  </View>
)

const palette = {
  background: '#F9F9F9',
  border: '#E2E2E2',
  burgundy: '#6B1E2E',
  card: '#EEEEEE',
  muted: '#5E5E5E',
  surface: '#FFFFFF',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 50,
    borderBottomWidth: 1,
    borderBottomColor: palette.card,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 600,
    minHeight: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backIcon: { color: palette.muted, fontSize: 25, lineHeight: 28 },
  headerTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: { width: 40, height: 40 },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 96,
  },
  providerHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
  providerImage: {
    width: 64,
    height: 64,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: palette.card,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  providerCopy: { flex: 1, alignItems: 'flex-start' },
  providerName: { color: palette.text, fontSize: 24, lineHeight: 32, fontWeight: '600', marginBottom: 4 },
  categoryBadge: {
    borderRadius: 14,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    color: palette.surface,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timeline: { position: 'relative', gap: 24, paddingLeft: 8, marginBottom: 32 },
  timelineLine: {
    position: 'absolute',
    top: 16,
    bottom: 16,
    left: 22,
    width: 2,
    backgroundColor: palette.border,
  },
  timelineStep: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start' },
  stepOuter: {
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.background,
    borderRadius: 16,
    backgroundColor: palette.background,
  },
  stepOuterPending: { borderColor: palette.border },
  stepComplete: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.burgundy,
  },
  stepCheck: { color: palette.surface, fontSize: 15, lineHeight: 17, fontWeight: '800' },
  stepPending: { width: 16, height: 16, borderRadius: 8, backgroundColor: palette.border },
  stepCopy: { flex: 1, paddingTop: 2, marginLeft: 8 },
  stepLabel: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  stepLabelPending: { color: palette.muted },
  stepDate: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  detailsCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.card,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: { color: palette.text, fontSize: 20, lineHeight: 25, fontWeight: '600', marginBottom: 16 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 13,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  detailLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  detailValue: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'right',
  },
  priceValue: { color: palette.burgundy, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.background,
    padding: 16,
    marginBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  paymentLabel: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  paymentBadge: {
    borderRadius: 14,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  paymentBadgeText: {
    color: palette.surface,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  actions: { alignItems: 'center', gap: 16, paddingTop: 16 },
  messageButton: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: palette.burgundy,
    borderRadius: 12,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  messageButtonPressed: { backgroundColor: '#F8F1F3', transform: [{ scale: 0.98 }] },
  messageIcon: {
    width: 19,
    height: 15,
    borderWidth: 2,
    borderColor: palette.burgundy,
    borderRadius: 5,
  },
  messageIconTail: {
    position: 'absolute',
    bottom: -5,
    left: 3,
    width: 6,
    height: 6,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: palette.burgundy,
    transform: [{ rotate: '-20deg' }],
  },
  messageButtonText: { color: palette.burgundy, fontSize: 18, lineHeight: 28, fontWeight: '700' },
  secondaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryButtonText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  pressed: { opacity: 0.58 },
})
