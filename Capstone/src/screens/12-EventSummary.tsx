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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { BlurTargetView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'
import { PolicyDocumentOverlay } from '../components/PolicyDocumentOverlay'
import { clientTermsAndConditions, privacyPolicy } from '../content/clientLegalDocuments'
import { formatPeso } from '../lib/catalog'
import { calculatePaymentBreakdown } from '../lib/pricing'
import type { SavedPlanReview } from '../lib/planning'
import { warningNotice } from '../theme/notices'

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
  isSavedPlan?: boolean
  isSavingPlan?: boolean
  isSubmittingRequests?: boolean
  items: EventSummaryOrderItem[]
  onBack?: () => void
  onBrandPress?: () => void
  onEditEventDetails?: () => void
  onModifyServices?: () => void
  onReviewSavedPlan?: () => void
  onSavePlan?: () => void
  onSubmitRequests?: () => void
  savedPlanReview?: SavedPlanReview
}

const formatCurrency = formatPeso
type LegalDocument = 'terms' | 'privacy'

const formatSummaryDate = (value: string) => {
  const trimmedValue = value.trim()
  const isoDate = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmedValue)
  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmedValue)
  const dateParts = isoDate
    ? { day: Number(isoDate[3]), month: Number(isoDate[2]), year: Number(isoDate[1]) }
    : slashDate
      ? { day: Number(slashDate[2]), month: Number(slashDate[1]), year: Number(slashDate[3]) }
      : undefined

  if (dateParts) {
    const date = new Date(dateParts.year, dateParts.month - 1, dateParts.day)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' })
    }
  }

  return trimmedValue
}

const formatSummaryTime = (value: string) => {
  const trimmedValue = value.trim()
  const time = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmedValue)
  if (!time) return trimmedValue

  const hours = Number(time[1])
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return trimmedValue

  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${time[2]} ${period}`
}

export const EventSummaryScreen: React.FC<EventSummaryScreenProps> = ({
  event,
  isSavedPlan = false,
  isSavingPlan = false,
  isSubmittingRequests = false,
  items,
  onBack,
  onBrandPress,
  onEditEventDetails,
  onModifyServices,
  onReviewSavedPlan,
  onSavePlan,
  onSubmitRequests,
  savedPlanReview,
}) => {
  const { width } = useWindowDimensions()
  const safeAreaInsets = useSafeAreaInsets()
  const isWide = width >= 640
  const usesSingleColumnDetails = width < 380
  const summaryScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null)
  const policyBlurTargetRef = React.useRef<React.ComponentRef<typeof View>>(null)
  const legalAcceptanceOffset = React.useRef(0)
  const [isSavePlanConfirmationVisible, setIsSavePlanConfirmationVisible] = React.useState(false)
  const [isSubmitConfirmationVisible, setIsSubmitConfirmationVisible] = React.useState(false)
  const [isServiceChooserVisible, setIsServiceChooserVisible] = React.useState(false)
  const [acceptedLegalTerms, setAcceptedLegalTerms] = React.useState(false)
  const [showLegalAcceptanceError, setShowLegalAcceptanceError] = React.useState(false)
  const [legalDocument, setLegalDocument] = React.useState<LegalDocument | null>(null)
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
    if (!acceptedLegalTerms) {
      setShowLegalAcceptanceError(true)
      requestAnimationFrame(() => {
        summaryScrollRef.current?.scrollTo({
          animated: true,
          y: Math.max(0, legalAcceptanceOffset.current - 18),
        })
      })
      return
    }
    setIsSubmitConfirmationVisible(true)
  }

  const toggleLegalAcceptance = () => {
    setAcceptedLegalTerms((accepted) => {
      const nextAccepted = !accepted
      if (nextAccepted) setShowLegalAcceptanceError(false)
      return nextAccepted
    })
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
      <BlurTargetView ref={policyBlurTargetRef} style={styles.screen}>
      <PlanningScreenHeader
        brandTitle
        currentStep={5}
        label="Event Summary"
        neumorphicNavigation
        nextAccessibilityLabel="Event summary is the final planning step"
        onBack={onBack}
        onBrandPress={onBrandPress}
        showProgress={!isSavedPlan}
        title="Event Summary"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 174 + safeAreaInsets.bottom },
        ]}
        ref={summaryScrollRef}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          {isSavedPlan ? <Text style={styles.eyebrow}>SAVED PLAN</Text> : null}
          <Text style={styles.heading}>{isSavedPlan ? 'Review Your Saved Plan' : 'Review Your Event Plan'}</Text>
          <Text style={styles.introCopy}>
            {isSavedPlan
              ? 'This plan remains saved after booking. Current availability and prices are rechecked before requests are sent.'
              : 'Review your wedding details and selected services before sending your booking requests.'}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.cardTitle}>Event details</Text>
            {isSavedPlan ? (
              <Pressable accessibilityRole="button" onPress={onEditEventDetails} style={({ pressed }) => [styles.modifyButton, pressed && styles.buttonPressed]}>
                <Text style={styles.modifyButtonText}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.eventNameBlock}>
            <Text style={styles.eventDetailLabel}>EVENT NAME</Text>
            <Text style={styles.eventName}>{event.name}</Text>
          </View>
          <View style={styles.eventGrid}>
            <EventDetail label="EVENT TYPE" value={event.eventType} wide={usesSingleColumnDetails} />
            <EventDetail label="NUMBER OF GUESTS" value={`${event.guestCount} guests`} wide={usesSingleColumnDetails} />
            <EventDetail label="WEDDING DATE" value={formatSummaryDate(event.date)} wide={usesSingleColumnDetails} />
            <EventDetail label="WEDDING TIME" value={formatSummaryTime(event.time)} wide={usesSingleColumnDetails} />
            <EventDetail label="EVENT LOCATION" value={event.location} wide />
            {event.churchWedding ? <EventDetail label="CHURCH CEREMONY" value={event.churchWedding} wide /> : null}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <View>
              <Text style={styles.cardTitle}>Selected services</Text>
              <Text style={styles.cardSubtitle}>
                {items.length === 1 ? '1 booking request will be sent.' : `${items.length} booking requests will be sent.`}
              </Text>
            </View>
            <View style={styles.selectionActions}>
              {isSavedPlan ? (
                <Pressable accessibilityRole="button" onPress={() => setIsServiceChooserVisible(true)} style={({ pressed }) => [styles.modifyButton, pressed && styles.buttonPressed]}>
                  <Text style={styles.modifyButtonText}>Modify</Text>
                </Pressable>
              ) : null}
              <MaterialCommunityIcons color={palette.burgundy} name="clipboard-check-outline" size={24} />
            </View>
          </View>
          {items.length ? items.map((item, index) => (
            <View key={item.id} style={[styles.orderItem, index > 0 && styles.orderItemBorder]}>
              <View style={styles.orderItemTopRow}>
                <Text style={styles.orderItemCategory}>{item.category}</Text>
                <Text style={styles.orderItemPrice}>{formatCurrency(item.price)}</Text>
              </View>
              <Text style={styles.orderItemName}>{item.name}</Text>
              <Text style={styles.orderItemProvider}>
                {item.isCoordinator ? 'Selected coordinator' : item.providerName}
              </Text>
              {!item.isCoordinator && item.detail.trim().length > 0 ? (
                <Text style={styles.orderItemDetail}>{item.detail}</Text>
              ) : null}
            </View>
          )) : (
            <Text style={styles.emptyText}>Add a service or coordinator before submitting booking requests.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Financial summary</Text>
          <View style={styles.financialTotal}>
            <Text style={styles.financialTotalLabel}>Total Event Cost</Text>
            <Text style={styles.financialTotalValue}>{formatCurrency(breakdown.clientTotal)}</Text>
          </View>
          <View style={styles.divider} />
          <BreakdownRow label="Estimated Initial Payment" value={formatCurrency(breakdown.initialPayment)} />
          <BreakdownRow label="Remaining Balance" value={formatCurrency(breakdown.providerBalance)} />
        </View>

        <View style={[styles.bookingNotice, isWide && styles.bookingNoticeWide]}>
          <MaterialCommunityIcons color={palette.burgundy} name="information-outline" size={22} />
          <Text style={styles.bookingNoticeText}>
            Your selected providers will receive booking requests. Payment becomes available after all required providers accept.
          </Text>
        </View>

        <View
          onLayout={(event) => { legalAcceptanceOffset.current = event.nativeEvent.layout.y }}
          style={styles.legalAcceptanceCard}
        >
          <Text style={styles.legalAcceptanceTitle}>Booking terms and privacy</Text>
          <View style={styles.legalAcceptanceRow}>
            <Pressable
              accessibilityLabel="Accept Terms & Conditions and acknowledge Privacy Policy for this booking"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedLegalTerms }}
              hitSlop={6}
              onPress={toggleLegalAcceptance}
              style={styles.legalCheckboxTouchTarget}
            >
              {({ pressed }) => (
                <View style={[
                  styles.legalCheckbox,
                  acceptedLegalTerms && styles.legalCheckboxChecked,
                  showLegalAcceptanceError && !acceptedLegalTerms && styles.legalCheckboxError,
                  pressed && styles.buttonPressed,
                ]}>
                  {acceptedLegalTerms ? (
                    <MaterialCommunityIcons color="#FFFFFF" name="check" size={16} />
                  ) : null}
                </View>
              )}
            </Pressable>
            <Text style={styles.legalAcceptanceCopy}>
              I have read and agree to the{' '}
              <Text accessibilityRole="link" onPress={() => setLegalDocument('terms')} style={styles.legalLink}>
                Terms &amp; Conditions
              </Text>
              {' '}and acknowledge the{' '}
              <Text accessibilityRole="link" onPress={() => setLegalDocument('privacy')} style={styles.legalLink}>
                Privacy Policy
              </Text>
              {' '}for this booking.
            </Text>
          </View>
          {showLegalAcceptanceError && !acceptedLegalTerms ? (
            <View accessibilityRole="alert" style={styles.legalAcceptanceWarning}>
              <MaterialCommunityIcons color={warningNotice.icon} name="alert-circle-outline" size={18} />
              <Text style={styles.legalAcceptanceWarningText}>
                Accept the Terms &amp; Conditions and acknowledge the Privacy Policy before sending booking requests.
              </Text>
            </View>
          ) : null}
        </View>

        {savedPlanReview ? (
          <SavedPlanReviewNotice
            needsReview={needsSavedPlanReview}
            review={savedPlanReview}
            onReview={onReviewSavedPlan}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, safeAreaInsets.bottom + 8) }]}>
        <View style={[styles.footerContent, isWide && styles.footerContentWide]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            onPress={() => setIsSavePlanConfirmationVisible(true)}
            style={({ pressed }) => [
              styles.saveButton,
              isBusy && styles.buttonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
          >
            <Text style={styles.saveButtonText}>{isSavingPlan ? 'Saving…' : isSavedPlan ? 'Save Changes' : 'Save for Later'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy || items.length === 0 }}
            disabled={isBusy || items.length === 0}
            onPress={handleBookNow}
            style={({ pressed }) => [
              styles.bookButton,
              (isBusy || items.length === 0) && styles.buttonDisabled,
              pressed && styles.bookButtonPressed,
            ]}
          >
            {isSubmittingRequests ? <ActivityIndicator color={palette.onBurgundy} size="small" /> : null}
            <Text style={styles.bookButtonText}>
              {isSubmittingRequests
                ? 'Sending Booking Requests…'
                : needsSavedPlanReview
                  ? 'Review Changes'
                  : 'Send Booking Requests'}
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
        animationType="slide"
        onRequestClose={() => setIsServiceChooserVisible(false)}
        transparent
        visible={isServiceChooserVisible}
      >
        <Pressable
          accessibilityLabel="Close service chooser"
          onPress={() => setIsServiceChooserVisible(false)}
          style={styles.serviceChooserBackdrop}
        >
          <Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.serviceChooserSheet}>
            <View style={styles.serviceChooserHandle} />
            <Text style={styles.serviceChooserTitle}>Modify selected services</Text>
            <Text style={styles.serviceChooserCopy}>
              Choose a service to update its package or options. Your current selections remain until you save changes.
            </Text>
            <ScrollView contentContainerStyle={styles.serviceChooserList} showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <View key={item.id} style={styles.serviceChooserItem}>
                  <Text numberOfLines={1} style={styles.serviceChooserItemName}>{item.name}</Text>
                  <Text numberOfLines={1} style={styles.serviceChooserItemMeta}>{item.category}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsServiceChooserVisible(false)
                onModifyServices?.()
              }}
              style={({ pressed }) => [styles.serviceChooserButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.serviceChooserButtonText}>Choose Services</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
      </BlurTargetView>

      {legalDocument ? (
        <PolicyDocumentOverlay
          blurTarget={policyBlurTargetRef}
          content={legalDocument === 'terms' ? clientTermsAndConditions : privacyPolicy}
          onClose={() => setLegalDocument(null)}
          title={legalDocument === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
        />
      ) : null}
    </View>
  )
}

const EventDetail: React.FC<{ label: string; value: string; wide?: boolean }> = ({ label, value, wide = false }) => (
  <View style={[styles.eventDetail, wide && styles.eventDetailWide]}>
    <Text style={styles.eventDetailLabel}>{label}</Text>
    <Text style={styles.eventDetailValue}>{value}</Text>
  </View>
)

const BreakdownRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.breakdownRow}>
    <Text style={styles.breakdownLabel}>{label}</Text>
    <Text style={styles.breakdownValue}>{value}</Text>
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
        color={needsReview ? warningNotice.icon : palette.success}
        name={needsReview ? 'alert-circle-outline' : 'check-circle-outline'}
        size={23}
      />
      <View style={styles.savedPlanCopy}>
        <Text style={[styles.savedPlanTitle, needsReview && styles.savedPlanTitleAttention]}>
          {needsReview ? 'Saved plan needs review' : 'Saved plan rechecked'}
        </Text>
        <Text style={[styles.savedPlanText, needsReview && styles.savedPlanTextAttention]}>{copy}</Text>
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
  background: '#E9EDF0',
  border: 'rgba(255, 255, 255, 0.72)',
  burgundy: '#6B1E2E',
  muted: '#66727B',
  onBurgundy: '#FFFFFF',
  success: '#2E7D57',
  surface: '#E9EDF0',
  surfaceMuted: '#E9EDF0',
  text: '#263139',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 22 },
  intro: { marginBottom: 20 },
  eyebrow: { color: palette.burgundy, fontSize: 12, lineHeight: 17, fontWeight: '800', letterSpacing: 1.1 },
  heading: { color: palette.text, fontSize: 25, lineHeight: 32, fontWeight: '800', marginTop: 3 },
  introCopy: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.surface,
    padding: 17,
    marginBottom: 16,
    boxShadow: '6px 6px 13px rgba(160, 171, 180, 0.46), -6px -6px 13px rgba(255, 255, 255, 0.92)',
  },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: palette.text, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  cardSubtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  selectionActions: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  modifyButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  modifyButtonText: { color: palette.burgundy, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  eventNameBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(135, 146, 154, 0.34)', paddingTop: 14, paddingBottom: 14 },
  eventName: { color: palette.text, fontSize: 20, lineHeight: 27, fontWeight: '800', marginTop: 3 },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 14, paddingTop: 15 },
  eventDetail: { minWidth: 138, flexBasis: '47%', flexGrow: 1 },
  eventDetailWide: { flexBasis: '100%' },
  eventDetailLabel: { color: palette.muted, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7 },
  eventDetailValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 3 },
  orderItem: { gap: 3, paddingVertical: 14 },
  orderItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(135, 146, 154, 0.34)' },
  orderItemTopRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  orderItemCategory: { minWidth: 0, flex: 1, color: palette.burgundy, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  orderItemName: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 1 },
  orderItemProvider: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  orderItemDetail: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  orderItemPrice: { maxWidth: '48%', flexShrink: 0, color: palette.burgundy, fontSize: 15, lineHeight: 21, fontWeight: '800', textAlign: 'right' },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20, paddingTop: 10 },
  financialTotal: { paddingTop: 14, paddingBottom: 4 },
  financialTotalLabel: { color: palette.muted, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.8 },
  financialTotalValue: { color: palette.burgundy, fontSize: 28, lineHeight: 35, fontWeight: '800', marginTop: 2 },
  breakdownRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  breakdownLabel: { flex: 1, color: palette.muted, fontSize: 14, lineHeight: 20 },
  breakdownValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(135, 146, 154, 0.38)', marginTop: 12 },
  bookingNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(107, 30, 46, 0.16)', borderRadius: 14, backgroundColor: 'rgba(107, 30, 46, 0.07)', padding: 14, marginBottom: 16 },
  bookingNoticeWide: { marginHorizontal: 0 },
  bookingNoticeText: { flex: 1, color: '#52202D', fontSize: 13, lineHeight: 19 },
  legalAcceptanceCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.surface,
    padding: 17,
    marginBottom: 16,
    boxShadow: '6px 6px 13px rgba(160, 171, 180, 0.46), -6px -6px 13px rgba(255, 255, 255, 0.92)',
  },
  legalAcceptanceTitle: { color: palette.text, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  legalAcceptanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 11 },
  legalCheckboxTouchTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -9, marginTop: -9 },
  legalCheckbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(103, 115, 124, 0.42)',
    borderRadius: 7,
    backgroundColor: palette.surface,
    boxShadow: 'inset 2px 2px 5px rgba(160, 171, 180, 0.48), inset -2px -2px 5px rgba(255, 255, 255, 0.92)',
  },
  legalCheckboxChecked: { borderColor: palette.burgundy, backgroundColor: palette.burgundy, boxShadow: 'none' },
  legalCheckboxError: { borderColor: warningNotice.icon },
  legalAcceptanceCopy: { minWidth: 0, flex: 1, color: palette.muted, fontSize: 13, lineHeight: 20 },
  legalLink: { color: palette.burgundy, fontWeight: '800', textDecorationLine: 'underline' },
  legalAcceptanceWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: warningNotice.border,
    borderRadius: 12,
    backgroundColor: warningNotice.background,
    padding: 11,
    marginTop: 10,
  },
  legalAcceptanceWarningText: { minWidth: 0, flex: 1, color: warningNotice.text, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  savedPlanCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#B7D9C6', borderRadius: 14, backgroundColor: '#F2FAF5', padding: 15, marginBottom: 14 },
  savedPlanCardAttention: { borderColor: warningNotice.border, backgroundColor: warningNotice.background },
  savedPlanCopy: { flex: 1 },
  savedPlanTitle: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  savedPlanTitleAttention: { color: warningNotice.text },
  savedPlanText: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  savedPlanTextAttention: { color: warningNotice.mutedText },
  reviewButton: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: 6 },
  reviewButtonText: { color: palette.burgundy, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: 'rgba(233,237,240,0.98)', paddingHorizontal: 20, paddingTop: 12 },
  footerContent: { width: '100%', maxWidth: 728, alignSelf: 'center', gap: 9 },
  footerContentWide: { flexDirection: 'row', justifyContent: 'flex-end' },
  saveButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 23, backgroundColor: palette.surface, paddingHorizontal: 20, boxShadow: '5px 5px 11px rgba(160, 171, 180, 0.48), -5px -5px 11px rgba(255, 255, 255, 0.94)' },
  saveButtonText: { color: palette.burgundy, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  bookButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.18)', borderRadius: 26, backgroundColor: palette.burgundy, paddingHorizontal: 22 },
  bookButtonText: { color: palette.onBurgundy, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  saveButtonPressed: { boxShadow: 'inset 3px 3px 7px rgba(160, 171, 180, 0.54), inset -3px -3px 7px rgba(255, 255, 255, 0.92)', transform: [{ scale: 0.99 }] },
  bookButtonPressed: { boxShadow: 'inset 3px 3px 7px rgba(44, 3, 15, 0.66), inset -3px -3px 7px rgba(143, 48, 72, 0.46)', transform: [{ scale: 0.99 }] },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(32, 17, 22, 0.56)', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 18, backgroundColor: palette.surface, padding: 23 },
  modalTitle: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: '800', marginTop: 14 },
  modalCopy: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 23 },
  modalCancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 15 },
  modalCancelText: { color: palette.burgundy, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  modalConfirmButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: palette.burgundy, paddingHorizontal: 18 },
  modalConfirmText: { color: palette.onBurgundy, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  serviceChooserBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 17, 22, 0.42)' },
  serviceChooserSheet: { maxHeight: '78%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: palette.surface, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  serviceChooserHandle: { width: 38, height: 4, alignSelf: 'center', borderRadius: 2, backgroundColor: '#C9BEC1', marginBottom: 17 },
  serviceChooserTitle: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: '800' },
  serviceChooserCopy: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  serviceChooserList: { gap: 8, paddingTop: 16, paddingBottom: 16 },
  serviceChooserItem: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surfaceMuted, paddingHorizontal: 13, paddingVertical: 10 },
  serviceChooserItemName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  serviceChooserItemMeta: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 1 },
  serviceChooserButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: palette.burgundy },
  serviceChooserButtonText: { color: palette.onBurgundy, fontSize: 16, lineHeight: 22, fontWeight: '800' },
})
