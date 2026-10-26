import { Text } from '../components/AppText'
import React from 'react'
import {
  Animated,
  LayoutAnimation,
  Modal,
  PanResponder,
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
import type { PaymentBreakdown } from '../lib/pricing'
import type { SavedPlanReview, V14PaymentSettlementContext } from '../lib/planning'

export type PaymentType = 'deposit' | 'full'
export type PaymentMethod = 'eWallet' | 'bankTransfer'

export interface PaymentEventDetails {
  date: string
  guestCount: number
  name: string
  time: string
}

export interface PaymentOrderItem {
  commissionAmount: number
  commissionRate: number
  description: string
  id: string
  name: string
  price: number
  providerPrice: number
}

export interface PaymentValue {
  amount: number
  method: PaymentMethod
  paymentType: PaymentType
  termsAccepted: boolean
}

interface PaymentScreenProps {
  event?: PaymentEventDetails
  isProcessing?: boolean
  isSavingPlan?: boolean
  items?: PaymentOrderItem[]
  mode?: 'booking' | 'planning'
  paymentBreakdown?: Pick<
    PaymentBreakdown,
    'clientTotal' | 'initialPayment' | 'platformFee' | 'providerBalance' | 'providerInitialAllocation' | 'serviceSubtotal'
  >
  paymentSettlementContext?: V14PaymentSettlementContext
  onBack?: () => void
  onOpenCancellationPolicy?: () => void
  onOpenTerms?: () => void
  onPay?: (value: PaymentValue) => void
  onReviewSavedPlan?: () => void
  onSavePlan?: () => void
  savedPlanReview?: SavedPlanReview
}

const defaultEvent: PaymentEventDetails = {
  name: 'The Villa Wedding',
  date: 'Oct 24, 2024',
  time: '4:00 PM - 11:00 PM',
  guestCount: 150,
}

const defaultItems: PaymentOrderItem[] = [
  {
    id: 'venue',
    name: 'Venue Rental',
    description: 'Grand Hall & Gardens',
    price: 262500,
    providerPrice: 250000,
    commissionAmount: 12500,
    commissionRate: 0.05,
  },
  {
    id: 'catering',
    name: 'Catering Package',
    description: 'Premium 4-Course (150 pax)',
    price: 189000,
    providerPrice: 180000,
    commissionAmount: 9000,
    commissionRate: 0.05,
  },
  {
    id: 'photoVideo',
    name: 'Photography & Videography',
    description: 'Full Day Coverage',
    price: 89250,
    providerPrice: 85000,
    commissionAmount: 4250,
    commissionRate: 0.05,
  },
]

const paymentMethods = [
  { id: 'eWallet' as const, icon: 'wallet-outline' as const, label: 'E-Wallets' },
  { id: 'bankTransfer' as const, icon: 'bank-outline' as const, label: 'Bank Transfer' },
]

const formatCurrency = formatPeso

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  event = defaultEvent,
  isProcessing = false,
  isSavingPlan = false,
  items = defaultItems,
  mode = 'planning',
  paymentBreakdown,
  paymentSettlementContext,
  onBack,
  onOpenCancellationPolicy,
  onOpenTerms,
  onPay,
  onReviewSavedPlan,
  onSavePlan,
  savedPlanReview,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 640
  const [summaryExpanded, setSummaryExpanded] = React.useState(true)
  const [paymentType, setPaymentType] = React.useState<PaymentType>('deposit')
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('eWallet')
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [showTermsError, setShowTermsError] = React.useState(false)
  const [isSavePlanConfirmationVisible, setIsSavePlanConfirmationVisible] = React.useState(false)
  React.useEffect(() => {
    if (!paymentSettlementContext) return
    if (paymentMethod === 'eWallet' && !paymentSettlementContext.eWalletCheckout.enabled
      && paymentSettlementContext.manualBankTransfer.enabled) {
      setPaymentMethod('bankTransfer')
    }
    if (paymentMethod === 'bankTransfer' && !paymentSettlementContext.manualBankTransfer.enabled
      && paymentSettlementContext.eWalletCheckout.enabled) {
      setPaymentMethod('eWallet')
    }
  }, [paymentMethod, paymentSettlementContext])
  // Booking Details supplies the server-authoritative snapshot so a cent-level
  // difference between per-provider rounding and an aggregate preview cannot
  // change what the client sees at payment time.
  const breakdown = paymentBreakdown ?? calculatePaymentBreakdown(items)
  const commissionRates = Array.from(new Set(items.map((item) => item.commissionRate)))
  const feeLabel = commissionRates.length === 1
    ? `MULTIVENT Service Fee (${Math.round(commissionRates[0] * 100)}%)`
    : 'MULTIVENT Service Fee'
  const amountDue = paymentType === 'full' ? breakdown.clientTotal : breakdown.initialPayment
  const isFullPayment = paymentType === 'full'
  const selectedSettlement = paymentMethod === 'bankTransfer'
    ? paymentSettlementContext?.manualBankTransfer
    : paymentSettlementContext?.eWalletCheckout
  const selectedMethodEnabled = selectedSettlement?.enabled !== false
  const canSavePlan = mode === 'planning' && Boolean(onSavePlan)
  const needsSavedPlanReview = Boolean(
    savedPlanReview?.hasPriceChanges || savedPlanReview?.hasUnavailableServices
  )
  const savedPlanDifference = savedPlanReview
    ? Math.round((savedPlanReview.currentEstimatedTotal - savedPlanReview.savedEstimatedTotal) * 100) / 100
    : 0

  const handlePay = () => {
    if (isProcessing || !selectedMethodEnabled) return

    if (needsSavedPlanReview) {
      onReviewSavedPlan?.()
      return
    }

    if (!termsAccepted) {
      setShowTermsError(true)
      return
    }

    onPay?.({
      amount: amountDue,
      method: paymentMethod,
      paymentType,
      termsAccepted,
    })
  }

  const confirmSavePlan = () => {
    if (isSavingPlan) return
    setIsSavePlanConfirmationVisible(false)
    onSavePlan?.()
  }

  return (
    <View style={styles.screen}>
      <PlanningScreenHeader
        currentStep={5}
        label="Payment"
        nextAccessibilityLabel="Payment is the final booking step"
        onBack={onBack}
        title={mode === 'booking' ? 'Reserve Booking' : 'Payment'}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.eventCard}>
            <EventDetail label="EVENT NAME" value={event.name} />
            <EventDetail label="DATE" value={event.date} />
            <EventDetail label="TIME" value={event.time} />
            <EventDetail label="GUEST COUNT" value={`${event.guestCount} Guests`} />
          </View>

          {savedPlanReview && (
            <View
              accessibilityRole="summary"
              style={[
                styles.savedPlanReviewCard,
                needsSavedPlanReview && styles.savedPlanReviewCardAttention,
              ]}
            >
              <MaterialCommunityIcons
                color={needsSavedPlanReview ? palette.burgundy : '#2E7D57'}
                name={needsSavedPlanReview ? 'alert-circle-outline' : 'check-circle-outline'}
                size={23}
              />
              <View style={styles.savedPlanReviewCopy}>
                <Text style={styles.savedPlanReviewTitle}>
                  {savedPlanReview.hasUnavailableServices
                    ? 'Service update needed'
                    : savedPlanReview.hasPriceChanges
                      ? 'Price Updated'
                      : 'Saved plan rechecked'}
                </Text>
                <Text style={styles.savedPlanReviewText}>
                  {savedPlanReview.hasUnavailableServices
                    ? 'One or more saved services are no longer available. Review your selections before booking.'
                    : savedPlanReview.hasPriceChanges
                      ? `Your current estimate is ${savedPlanDifference > 0 ? `${formatCurrency(savedPlanDifference)} higher` : `${formatCurrency(Math.abs(savedPlanDifference))} lower`} than when you saved this plan.`
                      : 'Current prices and availability match your saved estimate.'}
                </Text>
                {needsSavedPlanReview && savedPlanReview.items
                  .filter((item) => !item.available || item.currentAmount === undefined || Math.abs(item.currentAmount - item.savedAmount) > 0.01)
                  .map((item) => (
                    <View key={item.serviceId} style={styles.savedPlanReviewItem}>
                      <Text numberOfLines={1} style={styles.savedPlanReviewItemName}>{item.serviceName}</Text>
                      <Text style={styles.savedPlanReviewItemDetail}>
                        {!item.available
                          ? 'Unavailable'
                          : `${formatCurrency(item.savedAmount)} → ${formatCurrency(item.currentAmount ?? 0)}`}
                      </Text>
                    </View>
                  ))}
                {needsSavedPlanReview && (
                  <Pressable
                    accessibilityLabel="Review saved plan changes"
                    accessibilityRole="button"
                    onPress={onReviewSavedPlan}
                    style={({ pressed }) => [styles.savedPlanReviewAction, pressed && styles.pressed]}
                  >
                    <Text style={styles.savedPlanReviewActionText}>Review Changes</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <View style={styles.summaryCard}>
            <Pressable
              accessibilityLabel={`${summaryExpanded ? 'Collapse' : 'Expand'} order summary`}
              accessibilityRole="button"
              onPress={() => setSummaryExpanded((current) => !current)}
              style={({ pressed }) => [styles.summaryHeader, pressed && styles.pressed]}
            >
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <Text style={styles.expandIcon}>{summaryExpanded ? '\u2303' : '\u2304'}</Text>
            </Pressable>

            {summaryExpanded && (
              <View style={styles.summaryContent}>
                {items.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.orderItem,
                      index < items.length - 1 && styles.orderItemBorder,
                    ]}
                  >
                    <View style={styles.orderItemCopy}>
                      <Text style={styles.orderItemName}>{item.name}</Text>
                      <Text style={styles.orderItemDescription}>{item.description}</Text>
                    </View>
                    <Text style={styles.orderItemPrice}>{formatCurrency(item.price)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose payment option</Text>
          <View style={[styles.paymentTypeGrid, isWide && styles.paymentTypeGridWide]}>
            <PaymentTypeCard
              description="Includes each provider's 30% required downpayment and MULTIVENT's 5% service fee. The remaining 70% is paid directly to each provider."
              detail="35% of provider service subtotal"
              label="Pay Required Downpayment"
              onPress={() => setPaymentType('deposit')}
              price={formatCurrency(breakdown.initialPayment)}
              selected={paymentType === 'deposit'}
            />
            <PaymentTypeCard
              description="Pay the complete booked-service amount now. Funds are not reserved or released until payment is successfully verified."
              detail="Full booked-service amount"
              label="Pay in Full"
              onPress={() => setPaymentType('full')}
              price={formatCurrency(breakdown.clientTotal)}
              selected={paymentType === 'full'}
            />
          </View>
        </View>

        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Payment Breakdown</Text>
          <BreakdownRow label="Service Subtotal" value={formatCurrency(breakdown.serviceSubtotal)} />
          <BreakdownRow label="Client Total" value={formatCurrency(breakdown.clientTotal)} />
          <BreakdownRow
            muted
            label={isFullPayment ? 'Provider service amount (held after verification)' : 'Provider Downpayments (30%, held after verification)'}
            value={formatCurrency(isFullPayment ? breakdown.serviceSubtotal : breakdown.providerInitialAllocation)}
          />
          <BreakdownRow
            muted
            label={`${feeLabel} · Collected now`}
            value={formatCurrency(breakdown.platformFee)}
          />
          <View style={styles.breakdownDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {isFullPayment ? 'Full Payment Due Now' : 'Downpayment Due Now (35%)'}
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(amountDue)}</Text>
          </View>
          <Text style={styles.balanceText}>
            {isFullPayment
              ? 'No remaining client balance after successful verification.'
              : `Remaining 70% paid directly to providers: ${formatCurrency(breakdown.providerBalance)}`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          <View style={styles.methodList}>
            {paymentMethods.map((method) => {
              const selected = paymentMethod === method.id
              const methodEnabled = paymentSettlementContext
                ? method.id === 'bankTransfer'
                  ? paymentSettlementContext.manualBankTransfer.enabled
                  : paymentSettlementContext.eWalletCheckout.enabled
                : true
              return (
                <Pressable
                  key={method.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  disabled={!methodEnabled}
                  onPress={() => setPaymentMethod(method.id)}
                  style={({ pressed }) => [
                    styles.methodCard,
                    selected && styles.selectableCardActive,
                    !methodEnabled && styles.methodCardDisabled,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.methodCopy}>
                    <View style={styles.methodIconCircle}>
                      <MaterialCommunityIcons
                        color={palette.burgundy}
                        name={method.icon}
                        size={21}
                      />
                    </View>
                    <Text style={styles.methodLabel}>{method.label}</Text>
                  </View>
                  <Radio selected={selected} />
                </Pressable>
              )
            })}
          </View>
          {mode === 'booking' && paymentSettlementContext ? (
            <SettlementInstructions
              context={paymentSettlementContext}
              method={paymentMethod}
            />
          ) : null}
        </View>

        <View style={styles.termsSection}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsAccepted }}
            hitSlop={6}
            onPress={() => {
              setTermsAccepted((current) => !current)
              setShowTermsError(false)
            }}
            style={({ pressed }) => [
              styles.checkbox,
              termsAccepted && styles.checkboxChecked,
              pressed && styles.pressed,
            ]}
          >
            {termsAccepted && <Text style={styles.checkboxMark}>{'\u2713'}</Text>}
          </Pressable>
          <Text style={styles.termsText}>
            I agree to the{' '}
            <Text onPress={onOpenCancellationPolicy} style={styles.termsLink}>
              Cancellation Policy
            </Text>{' '}
            and{' '}
            <Text onPress={onOpenTerms} style={styles.termsLink}>
              Terms of Service
            </Text>
            . I understand that funds are reserved only after payment is successfully verified.
          </Text>
        </View>
        {showTermsError && (
          <Text accessibilityRole="alert" style={styles.termsError}>
            Please accept the policies and terms before continuing.
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          {isWide && (
            <View>
              <Text style={styles.footerLabel}>{isFullPayment ? 'Full Payment Due' : 'Total Due Now'}</Text>
              <Text style={styles.footerAmount}>{formatCurrency(amountDue)}</Text>
            </View>
          )}
          <View style={[styles.footerActions, isWide && styles.footerActionsWide]}>
            {canSavePlan ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSavingPlan || isProcessing }}
                disabled={isSavingPlan || isProcessing}
                onPress={() => setIsSavePlanConfirmationVisible(true)}
                style={({ pressed }) => [
                  styles.savePlanButton,
                  (isSavingPlan || isProcessing) && styles.savePlanButtonDisabled,
                  pressed && styles.savePlanButtonPressed,
                ]}
              >
                <Text style={styles.savePlanButtonText}>
                  {isSavingPlan ? 'Saving plan...' : 'Save Plan for Later'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isProcessing || !selectedMethodEnabled }}
              disabled={isProcessing || !selectedMethodEnabled}
              onPress={handlePay}
              style={({ pressed }) => [
                styles.payButton,
                (isProcessing || !selectedMethodEnabled) && styles.payButtonDisabled,
                pressed && styles.payButtonPressed,
              ]}
            >
              <Text style={styles.payButtonText}>
                {isProcessing
                  ? 'Starting payment...'
                  : !selectedMethodEnabled
                    ? 'Payment method unavailable'
                    : needsSavedPlanReview
                    ? 'Review Changes Before Payment'
                    : isFullPayment
                      ? `Pay in Full · ${formatCurrency(amountDue)}`
                      : `Pay 35% Downpayment · ${formatCurrency(amountDue)}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsSavePlanConfirmationVisible(false)}
        transparent
        visible={canSavePlan && isSavePlanConfirmationVisible}
      >
        <View style={styles.savePlanModalBackdrop}>
          <View accessibilityViewIsModal style={styles.savePlanModalCard}>
            <View style={styles.savePlanModalIcon}>
              <MaterialCommunityIcons color={palette.burgundy} name="bookmark-outline" size={25} />
            </View>
            <Text style={styles.savePlanModalTitle}>Save Your Event Plan?</Text>
            <Text style={styles.savePlanModalText}>
              Your selected services and event details will be saved so you can return and book later. Service prices and availability may change before you complete your booking.
            </Text>
            <View style={styles.savePlanModalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSavingPlan}
                onPress={() => setIsSavePlanConfirmationVisible(false)}
                style={({ pressed }) => [styles.savePlanCancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.savePlanCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSavingPlan}
                onPress={confirmSavePlan}
                style={({ pressed }) => [styles.savePlanConfirmButton, pressed && styles.savePlanButtonPressed]}
              >
                <Text style={styles.savePlanConfirmButtonText}>Save Plan</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

interface BookingPaymentSheetProps {
  items?: PaymentOrderItem[]
  isLoading?: boolean
  isProcessing?: boolean
  onClose: () => void
  onPay: (value: PaymentValue) => void
  paymentBreakdown?: Pick<
    PaymentBreakdown,
    'clientTotal' | 'initialPayment' | 'platformFee' | 'providerBalance' | 'providerInitialAllocation' | 'serviceSubtotal'
  >
  paymentSettlementContext?: V14PaymentSettlementContext
  visible: boolean
}

export const BookingPaymentSheet: React.FC<BookingPaymentSheetProps> = ({
  items = [],
  isLoading = false,
  isProcessing = false,
  onClose,
  onPay,
  paymentBreakdown,
  paymentSettlementContext,
  visible,
}) => {
  const [paymentType, setPaymentType] = React.useState<PaymentType>('deposit')
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('eWallet')
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [showTermsError, setShowTermsError] = React.useState(false)
  const [summaryExpanded, setSummaryExpanded] = React.useState(false)
  const sheetTranslateY = React.useRef(new Animated.Value(480)).current
  const breakdown = paymentBreakdown ?? calculatePaymentBreakdown([])
  const amountDue = paymentType === 'full' ? breakdown.clientTotal : breakdown.initialPayment
  const selectedSettlement = paymentMethod === 'bankTransfer'
    ? paymentSettlementContext?.manualBankTransfer
    : paymentSettlementContext?.eWalletCheckout
  const selectedMethodEnabled = !isLoading && selectedSettlement?.enabled !== false

  const dismiss = React.useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: 480,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose()
    })
  }, [onClose, sheetTranslateY])

  const sheetPanResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => sheetTranslateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 84 || gesture.vy > 0.7) dismiss()
      else Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true }).start()
    },
    onPanResponderTerminate: () => Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true }).start(),
  }), [dismiss, sheetTranslateY])

  React.useEffect(() => {
    if (!visible) return
    setShowTermsError(false)
    sheetTranslateY.setValue(480)
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start()
  }, [sheetTranslateY, visible])

  React.useEffect(() => {
    if (!paymentSettlementContext) return
    if (paymentMethod === 'eWallet' && !paymentSettlementContext.eWalletCheckout.enabled
      && paymentSettlementContext.manualBankTransfer.enabled) {
      setPaymentMethod('bankTransfer')
    }
    if (paymentMethod === 'bankTransfer' && !paymentSettlementContext.manualBankTransfer.enabled
      && paymentSettlementContext.eWalletCheckout.enabled) {
      setPaymentMethod('eWallet')
    }
  }, [paymentMethod, paymentSettlementContext])

  const submit = () => {
    if (isProcessing || isLoading || !selectedMethodEnabled) return
    if (!termsAccepted) {
      setShowTermsError(true)
      return
    }
    onPay({ amount: amountDue, method: paymentMethod, paymentType, termsAccepted })
  }

  const toggleSummary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setSummaryExpanded((current) => !current)
  }

  return (
    <Modal animationType="fade" onRequestClose={dismiss} transparent visible={visible}>
      <View style={styles.bookingSheetBackdrop}>
        <Pressable accessibilityLabel="Close payment details" onPress={dismiss} style={styles.bookingSheetDismissArea} />
        <Animated.View accessibilityViewIsModal style={[styles.bookingSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View accessibilityLabel="Drag down to close payment details" accessibilityRole="adjustable" {...sheetPanResponder.panHandlers} style={styles.bookingSheetHandleTouchArea}>
            <View style={styles.bookingSheetHandle} />
          </View>
          <View style={styles.bookingSheetHeader}>
            <View>
              <Text style={styles.bookingSheetTitle}>Complete your booking</Text>
              <Text style={styles.bookingSheetSubtitle}>Review your payment without leaving this booking.</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.bookingSheetContent} showsVerticalScrollIndicator={false} style={styles.bookingSheetScroll}>
            <Pressable
              accessibilityLabel={`${summaryExpanded ? 'Hide' : 'Show'} payment receipt`}
              accessibilityRole="button"
              onPress={toggleSummary}
              style={styles.bookingSheetSummaryTrigger}
            >
              <Text style={styles.bookingSheetSummaryLabel}>Total event cost</Text>
              <View style={styles.bookingSheetSummaryValue}>
                <Text style={styles.bookingSheetSummaryAmount}>{formatCurrency(breakdown.clientTotal)}</Text>
                <MaterialCommunityIcons color={palette.muted} name={summaryExpanded ? 'chevron-up' : 'chevron-down'} size={21} />
              </View>
            </Pressable>
            {summaryExpanded ? (
              <View style={styles.bookingSheetReceipt}>
                <Text style={styles.bookingSheetReceiptTitle}>Payment receipt</Text>
                <Text style={styles.bookingSheetReceiptCaption}>Booked services</Text>
                {items.map((item) => (
                  <View key={item.id} style={styles.bookingSheetServiceRow}>
                    <View style={styles.bookingSheetServiceCopy}>
                      <Text numberOfLines={1} style={styles.bookingSheetServiceName}>{item.name}</Text>
                      {item.description ? <Text numberOfLines={1} style={styles.bookingSheetServiceDescription}>{item.description}</Text> : null}
                    </View>
                    <Text style={styles.bookingSheetServicePrice}>{formatCurrency(item.price)}</Text>
                  </View>
                ))}
                <BreakdownRow label="Total event cost" value={formatCurrency(breakdown.clientTotal)} />
                <BreakdownRow label="Required downpayment" value={formatCurrency(breakdown.initialPayment)} />
                <BreakdownRow label="Remaining after downpayment" value={formatCurrency(Math.max(0, breakdown.clientTotal - breakdown.initialPayment))} />
              </View>
            ) : null}
            {isLoading ? <Text style={styles.bookingSheetLoading}>Preparing your latest secure payment details…</Text> : <>
            <Text style={styles.bookingSheetSectionTitle}>Payment option</Text>
            <View style={styles.bookingSheetOptionRow}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: paymentType === 'deposit' }}
                onPress={() => setPaymentType('deposit')}
                style={[styles.bookingSheetOption, paymentType === 'deposit' && styles.bookingSheetOptionSelected]}
              >
                <Text style={styles.bookingSheetOptionLabel}>Required downpayment</Text>
                <Text style={styles.bookingSheetOptionValue}>{formatCurrency(breakdown.initialPayment)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: paymentType === 'full' }}
                onPress={() => setPaymentType('full')}
                style={[styles.bookingSheetOption, paymentType === 'full' && styles.bookingSheetOptionSelected]}
              >
                <Text style={styles.bookingSheetOptionLabel}>Pay in full</Text>
                <Text style={styles.bookingSheetOptionValue}>{formatCurrency(breakdown.clientTotal)}</Text>
              </Pressable>
            </View>
            <Text style={styles.bookingSheetSectionTitle}>Payment method</Text>
            <View style={styles.bookingSheetMethodRow}>
              {paymentMethods.map((method) => {
                const selected = paymentMethod === method.id
                const enabled = paymentSettlementContext
                  ? method.id === 'bankTransfer'
                    ? paymentSettlementContext.manualBankTransfer.enabled
                    : paymentSettlementContext.eWalletCheckout.enabled
                  : true
                return (
                  <Pressable
                    key={method.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: !enabled }}
                    disabled={!enabled}
                    onPress={() => setPaymentMethod(method.id)}
                    style={[styles.bookingSheetMethod, selected && styles.bookingSheetMethodSelected, !enabled && styles.bookingSheetMethodDisabled]}
                  >
                    <MaterialCommunityIcons color={palette.burgundy} name={method.icon} size={20} />
                    <Text style={styles.bookingSheetMethodText}>{method.label}</Text>
                  </Pressable>
                )
              })}
            </View>
            {paymentSettlementContext ? <SettlementInstructions context={paymentSettlementContext} method={paymentMethod} /> : null}
            </>}
          </ScrollView>
          <View style={styles.bookingSheetFooter}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              onPress={() => {
                setTermsAccepted((current) => !current)
                setShowTermsError(false)
              }}
              style={styles.bookingSheetTerms}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted ? <Text style={styles.checkboxMark}>{'\u2713'}</Text> : null}
              </View>
              <Text style={styles.bookingSheetTermsText}>I agree to the cancellation policy and terms of service.</Text>
            </Pressable>
            {showTermsError ? <Text accessibilityRole="alert" style={styles.termsError}>Please accept the policies and terms before continuing.</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isProcessing || isLoading || !selectedMethodEnabled }}
              disabled={isProcessing || isLoading || !selectedMethodEnabled}
              onPress={submit}
              style={({ pressed }) => [styles.payButton, (isProcessing || isLoading || !selectedMethodEnabled) && styles.payButtonDisabled, pressed && styles.payButtonPressed]}
            >
              <Text style={styles.payButtonText}>
                {isProcessing ? 'Starting payment...' : paymentType === 'full' ? 'Pay Full' : 'Confirm Downpayment'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

interface EventDetailProps {
  label: string
  value: string
}

const EventDetail: React.FC<EventDetailProps> = ({ label, value }) => (
  <View style={styles.eventDetail}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.eventDetailValue}>{value}</Text>
  </View>
)

interface PaymentTypeCardProps {
  description: string
  detail?: string
  disabled?: boolean
  label: string
  onPress: () => void
  price: string
  selected: boolean
}

const PaymentTypeCard: React.FC<PaymentTypeCardProps> = ({
  description,
  detail,
  disabled = false,
  label,
  onPress,
  price,
  selected,
}) => (
  <Pressable
    accessibilityRole="radio"
    accessibilityState={{ checked: selected, disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.paymentTypeCard,
      selected && styles.selectableCardActive,
      disabled && styles.paymentTypeCardDisabled,
      pressed && styles.cardPressed,
    ]}
  >
    <View style={styles.paymentTypeHeader}>
      <Text style={styles.paymentTypeLabel}>{label}</Text>
      <Radio disabled={disabled} selected={selected} />
    </View>
    <Text style={[styles.paymentTypePrice, !selected && styles.paymentTypePriceInactive]}>
      {price}{' '}
      {detail && <Text style={styles.paymentTypeDetail}>{'\u00B7'} {detail}</Text>}
    </Text>
    <Text style={styles.paymentTypeDescription}>{description}</Text>
  </Pressable>
)

interface RadioProps {
  disabled?: boolean
  selected: boolean
}

const Radio: React.FC<RadioProps> = ({ disabled = false, selected }) => (
  <View style={[styles.radioOuter, selected && styles.radioOuterSelected, disabled && styles.radioOuterDisabled]}>
    {selected && <View style={styles.radioInner} />}
  </View>
)

interface BreakdownRowProps {
  label: string
  muted?: boolean
  value: string
}

const BreakdownRow: React.FC<BreakdownRowProps> = ({ label, muted = false, value }) => (
  <View style={styles.breakdownRow}>
    <Text style={[styles.breakdownText, muted && styles.breakdownTextMuted]}>{label}</Text>
    <Text style={[styles.breakdownText, muted && styles.breakdownTextMuted]}>{value}</Text>
  </View>
)

const SettlementInstructions = ({
  context,
  method,
}: {
  context: V14PaymentSettlementContext
  method: PaymentMethod
}) => {
  const isBankTransfer = method === 'bankTransfer'
  const methodContext = isBankTransfer ? context.manualBankTransfer : context.eWalletCheckout
  const environmentLabel = context.environment === 'live'
    ? 'Live settlement'
    : context.environment === 'sandbox'
      ? 'Sandbox settlement'
      : 'Prototype settlement'

  return (
    <View style={styles.settlementCard}>
      <View style={styles.settlementHeading}>
        <MaterialCommunityIcons color={palette.burgundy} name="shield-check-outline" size={20} />
        <Text style={styles.settlementTitle}>{environmentLabel}</Text>
      </View>
      <Text style={styles.settlementCopy}>{methodContext.instructions}</Text>
      {isBankTransfer && context.manualBankTransfer.configured ? (
        <View style={styles.bankDetails}>
          <Text style={styles.bankDetailLabel}>{context.merchantLabel}</Text>
          <Text style={styles.bankDetailValue}>{context.manualBankTransfer.bankName}</Text>
          <Text style={styles.bankDetailValue}>{context.manualBankTransfer.accountName}</Text>
          <Text style={styles.bankDetailValue}>{context.manualBankTransfer.accountNumber}</Text>
        </View>
      ) : null}
      <Text style={styles.settlementNote}>
        Payment remains pending until MULTIVENT receives authoritative bank or processor confirmation. A screenshot or client-entered reference is not verification.
      </Text>
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  border: '#E2E2E2',
  burgundy: '#6B1E2E',
  burgundyDark: '#4E061A',
  error: '#BA1A1A',
  muted: '#5E5E5E',
  outline: '#DAC0C2',
  surface: '#FFFFFF',
  surfaceLow: '#F3F3F4',
  text: '#1A1C1C',
} as const

const cardShadow = {
  shadowColor: palette.burgundy,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 15,
  elevation: 3,
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#4E061A',
    backgroundColor: '#6B1E2E',
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1280,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  backIcon: { color: '#FFFFFF', fontSize: 26, lineHeight: 29 },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  headerSpacer: { width: 40, height: 40 },
  stepWrapper: {
    zIndex: 30,
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
    backgroundColor: palette.background,
  },
  content: {
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 192,
  },
  section: { gap: 24, marginBottom: 72 },
  eventCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 20,
    borderRadius: 12,
    backgroundColor: palette.surfaceLow,
    padding: 24,
    ...cardShadow,
  },
  savedPlanReviewCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#B7D9C6',
    borderRadius: 12,
    backgroundColor: '#F2FAF5',
    padding: 16,
  },
  savedPlanReviewCardAttention: { borderColor: palette.outline, backgroundColor: '#FCF5F6' },
  savedPlanReviewCopy: { flex: 1, minWidth: 0 },
  savedPlanReviewTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  savedPlanReviewText: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  savedPlanReviewItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#E7D7D9', paddingTop: 7, marginTop: 7 },
  savedPlanReviewItemName: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  savedPlanReviewItemDetail: { color: palette.burgundy, fontSize: 12, lineHeight: 18, fontWeight: '700', textAlign: 'right' },
  savedPlanReviewAction: { alignSelf: 'flex-start', paddingVertical: 8, marginTop: 6 },
  savedPlanReviewActionText: { color: palette.burgundy, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  eventDetail: { width: '50%', paddingRight: 12 },
  detailLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1, marginBottom: 4 },
  eventDetailValue: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  summaryCard: { overflow: 'hidden', borderRadius: 12, backgroundColor: palette.surfaceLow, ...cardShadow },
  summaryHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 18 },
  summaryTitle: { color: palette.text, fontSize: 18, lineHeight: 28, fontWeight: '600' },
  expandIcon: { color: palette.muted, fontSize: 24, lineHeight: 26 },
  summaryContent: { paddingHorizontal: 24, paddingBottom: 24 },
  orderItem: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingVertical: 16 },
  orderItemBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  orderItemCopy: { flex: 1 },
  orderItemName: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  orderItemDescription: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 2 },
  orderItemPrice: { color: palette.text, fontSize: 16, lineHeight: 24, textAlign: 'right' },
  sectionTitle: { color: palette.text, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  paymentTypeGrid: { gap: 16 },
  paymentTypeGridWide: { flexDirection: 'row' },
  paymentTypeCard: {
    flex: 1,
    minHeight: 188,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 16,
    backgroundColor: palette.surface,
    padding: 28,
    ...cardShadow,
  },
  paymentTypeCardDisabled: { opacity: 0.64 },
  selectableCardActive: { borderColor: palette.burgundy, backgroundColor: '#FCF8F9' },
  paymentTypeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  paymentTypeLabel: { color: palette.text, fontSize: 18, lineHeight: 28, fontWeight: '600' },
  radioOuter: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.muted, borderRadius: 12 },
  radioOuterSelected: { borderColor: palette.burgundy, backgroundColor: palette.burgundy },
  radioOuterDisabled: { borderColor: palette.border },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.surface },
  paymentTypePrice: { color: palette.burgundy, fontSize: 24, lineHeight: 32, fontWeight: '600', marginBottom: 8 },
  paymentTypePriceInactive: { color: palette.text },
  paymentTypeDetail: { color: palette.muted, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  paymentTypeDescription: { color: palette.muted, fontSize: 16, lineHeight: 24 },
  breakdownCard: { borderRadius: 12, backgroundColor: palette.surfaceLow, padding: 28, marginBottom: 72, ...cardShadow },
  breakdownTitle: { color: palette.text, fontSize: 18, lineHeight: 28, fontWeight: '600', marginBottom: 24 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  breakdownText: { color: palette.text, fontSize: 16, lineHeight: 24 },
  breakdownTextMuted: { color: palette.muted },
  breakdownDivider: { height: 1, backgroundColor: palette.border, marginVertical: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 16 },
  totalLabel: { flex: 1, color: palette.burgundy, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  totalValue: { color: palette.burgundy, fontSize: 24, lineHeight: 32, fontWeight: '600', textAlign: 'right' },
  balanceText: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'right', marginTop: 8 },
  methodList: { gap: 16 },
  methodCardDisabled: { opacity: 0.48 },
  methodCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface,
    paddingHorizontal: 24,
    paddingVertical: 16,
    ...cardShadow,
  },
  methodCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  methodIconCircle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F3E8EA' },
  methodLabel: { color: palette.text, fontSize: 16, lineHeight: 24 },
  settlementCard: { backgroundColor: '#FCF5F6', borderColor: '#E8D0D4', borderRadius: 12, borderWidth: 1, marginTop: 16, padding: 16 },
  settlementHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  settlementTitle: { color: palette.burgundy, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  settlementCopy: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  settlementNote: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  bankDetails: { backgroundColor: palette.surface, borderColor: '#E8D0D4', borderRadius: 8, borderWidth: 1, marginTop: 12, padding: 11 },
  bankDetailLabel: { color: palette.burgundy, fontSize: 12, fontWeight: '700', lineHeight: 17, marginBottom: 3 },
  bankDetailValue: { color: palette.text, fontSize: 13, lineHeight: 19 },
  termsSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  checkbox: { width: 24, height: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.muted, borderRadius: 5, backgroundColor: palette.surface, marginTop: 2 },
  checkboxChecked: { borderColor: palette.burgundy, backgroundColor: palette.burgundy },
  checkboxMark: { color: palette.surface, fontSize: 15, lineHeight: 17, fontWeight: '800' },
  termsText: { flex: 1, color: palette.muted, fontSize: 16, lineHeight: 24 },
  termsLink: { color: palette.burgundy, fontWeight: '600' },
  termsError: { color: palette.error, fontSize: 14, lineHeight: 20, marginTop: 10, marginLeft: 40 },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    backgroundColor: 'rgba(249,249,249,0.96)',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 7,
  },
  footerContent: { width: '100%', maxWidth: 768, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  footerActions: { flex: 1, gap: 8 },
  footerActionsWide: { flex: 0, width: 330 },
  footerLabel: { color: palette.muted, fontSize: 16, lineHeight: 22 },
  footerAmount: { color: palette.burgundy, fontSize: 24, lineHeight: 32, fontWeight: '700' },
  payButton: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 32,
    paddingVertical: 16,
    ...cardShadow,
  },
  savePlanButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.burgundy,
    borderRadius: 21,
    backgroundColor: palette.surface,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  savePlanButtonText: { color: palette.burgundy, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  savePlanButtonDisabled: { opacity: 0.5 },
  savePlanButtonPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  payButtonText: { color: palette.surface, fontSize: 18, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  payButtonDisabled: { opacity: 0.6 },
  payButtonPressed: { backgroundColor: '#7B2B3A', transform: [{ scale: 0.98 }] },
  bookingSheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(26, 28, 28, 0.28)' },
  bookingSheetDismissArea: { flex: 1 },
  bookingSheet: {
    width: '100%',
    maxHeight: '78%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  bookingSheetHandleTouchArea: { alignSelf: 'center', width: 64, height: 24, alignItems: 'center', justifyContent: 'center' },
  bookingSheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#B7B1B2' },
  bookingSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingTop: 15, paddingBottom: 12 },
  bookingSheetTitle: { color: palette.text, fontSize: 20, lineHeight: 27, fontWeight: '700' },
  bookingSheetSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  bookingSheetScroll: { flexShrink: 1 },
  bookingSheetContent: { gap: 14, paddingBottom: 16 },
  bookingSheetSummaryTrigger: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border, paddingVertical: 12 },
  bookingSheetSummaryLabel: { flex: 1, color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  bookingSheetSummaryValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bookingSheetSummaryAmount: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'right' },
  bookingSheetReceipt: { gap: 8, borderRadius: 10, backgroundColor: palette.surfaceLow, padding: 13 },
  bookingSheetReceiptTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700', marginBottom: 2 },
  bookingSheetReceiptCaption: { color: palette.muted, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, marginTop: 3 },
  bookingSheetServiceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 8 },
  bookingSheetServiceCopy: { flex: 1, minWidth: 0 },
  bookingSheetServiceName: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  bookingSheetServiceDescription: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 1 },
  bookingSheetServicePrice: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'right' },
  bookingSheetLoading: { color: palette.muted, fontSize: 13, lineHeight: 19, paddingVertical: 12, textAlign: 'center' },
  bookingSheetSectionTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 2 },
  bookingSheetOptionRow: { flexDirection: 'row', gap: 10 },
  bookingSheetOption: { flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.surface, padding: 12 },
  bookingSheetOptionSelected: { borderColor: palette.burgundy, backgroundColor: '#FCF5F6' },
  bookingSheetOptionLabel: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  bookingSheetOptionValue: { color: palette.burgundy, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 5 },
  bookingSheetMethodRow: { flexDirection: 'row', gap: 10 },
  bookingSheetMethod: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.surface, paddingHorizontal: 8 },
  bookingSheetMethodSelected: { borderColor: palette.burgundy, backgroundColor: '#FCF5F6' },
  bookingSheetMethodDisabled: { opacity: 0.48 },
  bookingSheetMethodText: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  bookingSheetTerms: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 2 },
  bookingSheetTermsText: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 17 },
  bookingSheetFooter: { gap: 10, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.background, paddingTop: 12 },
  bookingSheetPayButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.burgundy, marginTop: 2, paddingHorizontal: 16, paddingVertical: 12 },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  pressed: { opacity: 0.58 },
  savePlanModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32, 17, 22, 0.54)',
    padding: 24,
  },
  savePlanModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: palette.surface,
    padding: 24,
    ...cardShadow,
  },
  savePlanModalIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#F4E7E9',
  },
  savePlanModalTitle: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: '700', marginTop: 16 },
  savePlanModalText: { color: palette.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  savePlanModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  savePlanCancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  savePlanCancelButtonText: { color: palette.burgundy, fontSize: 15, fontWeight: '700' },
  savePlanConfirmButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: palette.burgundy, paddingHorizontal: 18 },
  savePlanConfirmButtonText: { color: palette.surface, fontSize: 15, fontWeight: '700' },
})
