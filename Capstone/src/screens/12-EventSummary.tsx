import { Text } from '../components/AppText'
import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'
import { formatPeso } from '../lib/catalog'
import { calculatePaymentBreakdown } from '../lib/pricing'
import type { SavedPlanReview } from '../lib/planning'

export interface EventSummaryDetails {
  churchWedding?: string
  coordinatorPreference: string
  date: string
  eventType: string
  guestCount: number
  location: string
  name: string
  time: string
}

export interface EventSummaryOrderItem {
  category: string
  commissionAmount: number
  commissionRate: number
  detail: string
  id: string
  isCoordinator?: boolean
  name: string
  price: number
  providerName: string
  providerPrice: number
}

interface EventSummaryScreenProps {
  event: EventSummaryDetails
  isSavingPlan?: boolean
  isSubmittingRequests?: boolean
  items: EventSummaryOrderItem[]
  onBack?: () => void
  onReviewSavedPlan?: () => void
  onSavePlan?: () => void
  onSubmitRequests?: () => void
  savedPlanReview?: SavedPlanReview
}

const formatCurrency = formatPeso

export const EventSummaryScreen: React.FC<EventSummaryScreenProps> = ({
  event,
  isSavingPlan = false,
  isSubmittingRequests = false,
  items,
  onBack,
  onReviewSavedPlan,
  onSavePlan,
  onSubmitRequests,
  savedPlanReview,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 640
  const [isSavePlanConfirmationVisible, setIsSavePlanConfirmationVisible] = React.useState(false)
  const [isSubmitConfirmationVisible, setIsSubmitConfirmationVisible] = React.useState(false)
  const breakdown = calculatePaymentBreakdown(items)
  const needsSavedPlanReview = Boolean(
    savedPlanReview?.hasPriceChanges || savedPlanReview?.hasUnavailableServices
  )
  const isBusy = isSavingPlan || isSubmittingRequests

  const handleBookNow = () => {
    if (isBusy) return
    if (needsSavedPlanReview) {
      onReviewSavedPlan?.()
      return
    }
    if (items.length === 0) return
    setIsSubmitConfirmationVisible(true)
  }

  const confirmSavePlan = () => {
    if (isBusy) return
    setIsSavePlanConfirmationVisible(false)
    onSavePlan?.()
  }

  const confirmSubmitRequests = () => {
    if (isBusy) return
    setIsSubmitConfirmationVisible(false)
    onSubmitRequests?.()
  }

  return (
    <View style={styles.screen}>
      <PlanningScreenHeader
        currentStep={5}
        label="Event Summary"
        nextAccessibilityLabel="Event summary is the final planning step"
        onBack={onBack}
        title="Event Summary"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>STEP 5 OF 5</Text>
          <Text style={styles.heading}>Review your event plan</Text>
          <Text style={styles.introCopy}>
            Submitting sends booking requests only. Payment becomes available after every required provider accepts.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Event details</Text>
          <View style={styles.eventGrid}>
            <EventDetail label="EVENT" value={event.name} wide />
            <EventDetail label="TYPE" value={event.eventType} />
            <EventDetail label="GUESTS" value={`${event.guestCount} guests`} />
            <EventDetail label="DATE" value={event.date} />
            <EventDetail label="TIME" value={event.time} />
            <EventDetail label="LOCATION" value={event.location} wide />
            <EventDetail label="COORDINATOR" value={event.coordinatorPreference} wide />
            {event.churchWedding ? <EventDetail label="CHURCH CEREMONY" value={event.churchWedding} wide /> : null}
          </View>
        </View>

        {savedPlanReview ? (
          <SavedPlanReviewNotice
            needsReview={needsSavedPlanReview}
            review={savedPlanReview}
            onReview={onReviewSavedPlan}
          />
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <View>
              <Text style={styles.cardTitle}>Selected services</Text>
              <Text style={styles.cardSubtitle}>
                {items.length === 1 ? '1 booking request will be sent.' : `${items.length} booking requests will be sent.`}
              </Text>
            </View>
            <MaterialCommunityIcons color={palette.burgundy} name="clipboard-check-outline" size={24} />
          </View>
          {items.length ? items.map((item, index) => (
            <View key={item.id} style={[styles.orderItem, index > 0 && styles.orderItemBorder]}>
              <View style={styles.orderItemCopy}>
                <Text style={styles.orderItemCategory}>{item.category}</Text>
                <Text style={styles.orderItemName}>{item.name}</Text>
                <Text style={styles.orderItemProvider}>
                  {item.isCoordinator ? 'Selected coordinator' : `Provider: ${item.providerName}`}
                </Text>
                <Text style={styles.orderItemDetail}>{item.detail}</Text>
                <Text style={styles.providerPriceText}>
                  Provider booking price: {formatCurrency(item.providerPrice)}
                </Text>
              </View>
              <Text style={styles.orderItemPrice}>{formatCurrency(item.price)}</Text>
            </View>
          )) : (
            <Text style={styles.emptyText}>Add a service or coordinator before submitting booking requests.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Financial summary</Text>
          <BreakdownRow label="Provider service subtotal" value={formatCurrency(breakdown.serviceSubtotal)} />
          <BreakdownRow label="MULTIVENT service fee" value={formatCurrency(breakdown.platformFee)} />
          <View style={styles.divider} />
          <BreakdownRow emphasis label="Total Event Cost" value={formatCurrency(breakdown.clientTotal)} />
          <BreakdownRow label="Required Down Payment (35%)" value={formatCurrency(breakdown.initialPayment)} />
          <BreakdownRow label="Remaining Balance" value={formatCurrency(breakdown.providerBalance)} />
          <Text style={styles.financialNote}>
            This is a summary only. No payment is collected when you submit booking requests.
          </Text>
        </View>

        <View style={[styles.bookingNotice, isWide && styles.bookingNoticeWide]}>
          <MaterialCommunityIcons color={palette.burgundy} name="information-outline" size={22} />
          <Text style={styles.bookingNoticeText}>
            Your selected providers will be notified. You can pay to reserve once all required booking requests are accepted.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.footerContent, isWide && styles.footerContentWide]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            onPress={() => setIsSavePlanConfirmationVisible(true)}
            style={({ pressed }) => [
              styles.saveButton,
              isBusy && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.saveButtonText}>{isSavingPlan ? 'Saving…' : 'Save for Later'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy || items.length === 0 }}
            disabled={isBusy || items.length === 0}
            onPress={handleBookNow}
            style={({ pressed }) => [
              styles.bookButton,
              (isBusy || items.length === 0) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {isSubmittingRequests ? <ActivityIndicator color={palette.surface} size="small" /> : null}
            <Text style={styles.bookButtonText}>
              {isSubmittingRequests
                ? 'Submitting Requests…'
                : needsSavedPlanReview
                  ? 'Review Changes'
                  : 'Book Now'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsSavePlanConfirmationVisible(false)}
        transparent
        visible={isSavePlanConfirmationVisible}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <MaterialCommunityIcons color={palette.burgundy} name="bookmark-outline" size={28} />
            <Text style={styles.modalTitle}>Save your event plan?</Text>
            <Text style={styles.modalCopy}>
              Your event details and selected services will remain editable. No provider booking request or availability reservation will be created.
            </Text>
            <ModalActions
              confirmLabel="Save Plan"
              disabled={isBusy}
              onCancel={() => setIsSavePlanConfirmationVisible(false)}
              onConfirm={confirmSavePlan}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsSubmitConfirmationVisible(false)}
        transparent
        visible={isSubmitConfirmationVisible}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <MaterialCommunityIcons color={palette.burgundy} name="send-check-outline" size={28} />
            <Text style={styles.modalTitle}>Submit Booking Requests?</Text>
            <Text style={styles.modalCopy}>
              Your selected service providers will be notified. Payment will become available once all required providers have accepted your booking requests.
            </Text>
            <ModalActions
              confirmLabel="Submit Requests"
              disabled={isBusy}
              onCancel={() => setIsSubmitConfirmationVisible(false)}
              onConfirm={confirmSubmitRequests}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const EventDetail: React.FC<{ label: string; value: string; wide?: boolean }> = ({ label, value, wide = false }) => (
  <View style={[styles.eventDetail, wide && styles.eventDetailWide]}>
    <Text style={styles.eventDetailLabel}>{label}</Text>
    <Text style={styles.eventDetailValue}>{value}</Text>
  </View>
)

const BreakdownRow: React.FC<{ emphasis?: boolean; label: string; value: string }> = ({
  emphasis = false,
  label,
  value,
}) => (
  <View style={styles.breakdownRow}>
    <Text style={[styles.breakdownLabel, emphasis && styles.breakdownLabelEmphasis]}>{label}</Text>
    <Text style={[styles.breakdownValue, emphasis && styles.breakdownValueEmphasis]}>{value}</Text>
  </View>
)

const SavedPlanReviewNotice: React.FC<{
  needsReview: boolean
  onReview?: () => void
  review: SavedPlanReview
}> = ({ needsReview, onReview, review }) => {
  const difference = Math.round((review.currentEstimatedTotal - review.savedEstimatedTotal) * 100) / 100
  const copy = review.hasUnavailableServices
    ? 'One or more saved services are no longer available. Review your selections before booking.'
    : review.hasPriceChanges
      ? `Your current estimate is ${difference > 0 ? `${formatCurrency(difference)} higher` : `${formatCurrency(Math.abs(difference))} lower`} than when you saved this plan.`
      : 'Current prices and availability match your saved estimate.'

  return (
    <View style={[styles.savedPlanCard, needsReview && styles.savedPlanCardAttention]}>
      <MaterialCommunityIcons
        color={needsReview ? palette.burgundy : palette.success}
        name={needsReview ? 'alert-circle-outline' : 'check-circle-outline'}
        size={23}
      />
      <View style={styles.savedPlanCopy}>
        <Text style={styles.savedPlanTitle}>
          {needsReview ? 'Saved plan needs review' : 'Saved plan rechecked'}
        </Text>
        <Text style={styles.savedPlanText}>{copy}</Text>
        {needsReview ? (
          <Pressable accessibilityRole="button" onPress={onReview} style={({ pressed }) => [styles.reviewButton, pressed && styles.buttonPressed]}>
            <Text style={styles.reviewButtonText}>Review changes</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const ModalActions: React.FC<{
  confirmLabel: string
  disabled: boolean
  onCancel: () => void
  onConfirm: () => void
}> = ({ confirmLabel, disabled, onCancel, onConfirm }) => (
  <View style={styles.modalActions}>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onCancel} style={({ pressed }) => [styles.modalCancelButton, pressed && styles.buttonPressed]}>
      <Text style={styles.modalCancelText}>Cancel</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onConfirm} style={({ pressed }) => [styles.modalConfirmButton, disabled && styles.buttonDisabled, pressed && styles.buttonPressed]}>
      <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
    </Pressable>
  </View>
)

const palette = {
  background: '#F9F9F9',
  border: '#E4D8DA',
  burgundy: '#6B1E2E',
  muted: '#686166',
  success: '#2E7D57',
  surface: '#FFFFFF',
  surfaceMuted: '#FCF7F8',
  text: '#21191C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 182 },
  intro: { marginBottom: 22 },
  eyebrow: { color: palette.burgundy, fontSize: 12, lineHeight: 17, fontWeight: '800', letterSpacing: 1.1 },
  heading: { color: palette.text, fontSize: 25, lineHeight: 32, fontWeight: '800', marginTop: 4 },
  introCopy: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
  card: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.surface, padding: 18, marginBottom: 14 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  cardTitle: { color: palette.text, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  cardSubtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  eventDetail: { width: '50%', paddingRight: 12, marginBottom: 16 },
  eventDetailWide: { width: '100%' },
  eventDetailLabel: { color: palette.muted, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7 },
  eventDetailValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 3 },
  orderItem: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 15 },
  orderItemBorder: { borderTopWidth: 1, borderTopColor: '#EEE8E9' },
  orderItemCopy: { flex: 1, minWidth: 0 },
  orderItemCategory: { color: palette.burgundy, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  orderItemName: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 2 },
  orderItemProvider: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 1 },
  orderItemDetail: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  providerPriceText: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  orderItemPrice: { color: palette.burgundy, fontSize: 15, lineHeight: 21, fontWeight: '800', textAlign: 'right' },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20, paddingTop: 10 },
  breakdownRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  breakdownLabel: { flex: 1, color: palette.muted, fontSize: 14, lineHeight: 20 },
  breakdownValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  breakdownLabelEmphasis: { color: palette.text, fontSize: 16, fontWeight: '800' },
  breakdownValueEmphasis: { color: palette.burgundy, fontSize: 17, fontWeight: '800' },
  divider: { height: 1, backgroundColor: palette.border, marginTop: 16 },
  financialNote: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 15 },
  bookingNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, backgroundColor: '#F4E7E9', padding: 15, marginBottom: 12 },
  bookingNoticeWide: { marginHorizontal: 0 },
  bookingNoticeText: { flex: 1, color: '#52202D', fontSize: 13, lineHeight: 19 },
  savedPlanCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#B7D9C6', borderRadius: 14, backgroundColor: '#F2FAF5', padding: 15, marginBottom: 14 },
  savedPlanCardAttention: { borderColor: palette.border, backgroundColor: '#FCF4F5' },
  savedPlanCopy: { flex: 1 },
  savedPlanTitle: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  savedPlanText: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  reviewButton: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: 6 },
  reviewButtonText: { color: palette.burgundy, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: 'rgba(249,249,249,0.98)', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  footerContent: { width: '100%', maxWidth: 728, alignSelf: 'center', gap: 9 },
  footerContentWide: { flexDirection: 'row', justifyContent: 'flex-end' },
  saveButton: { minHeight: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.burgundy, borderRadius: 23, backgroundColor: palette.surface, paddingHorizontal: 20 },
  saveButtonText: { color: palette.burgundy, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  bookButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 26, backgroundColor: palette.burgundy, paddingHorizontal: 22 },
  bookButtonText: { color: palette.surface, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(32, 17, 22, 0.56)', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 18, backgroundColor: palette.surface, padding: 23 },
  modalTitle: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: '800', marginTop: 14 },
  modalCopy: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 23 },
  modalCancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 15 },
  modalCancelText: { color: palette.burgundy, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  modalConfirmButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: palette.burgundy, paddingHorizontal: 18 },
  modalConfirmText: { color: palette.surface, fontSize: 14, lineHeight: 20, fontWeight: '800' },
})
