import { Text } from '../components/AppText'
import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  
  useWindowDimensions,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'
import { calculatePaymentBreakdown } from '../lib/pricing'

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
  items?: PaymentOrderItem[]
  onBack?: () => void
  onOpenCancellationPolicy?: () => void
  onOpenTerms?: () => void
  onPay?: (value: PaymentValue) => void
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

const formatCurrency = (value: number) =>
  `\u20B1 ${Math.max(0, Math.round(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  event = defaultEvent,
  isProcessing = false,
  items = defaultItems,
  onBack,
  onOpenCancellationPolicy,
  onOpenTerms,
  onPay,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 640
  const [summaryExpanded, setSummaryExpanded] = React.useState(true)
  const paymentType: PaymentType = 'deposit'
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('eWallet')
  const [termsAccepted, setTermsAccepted] = React.useState(false)
  const [showTermsError, setShowTermsError] = React.useState(false)
  const breakdown = calculatePaymentBreakdown(items)
  const commissionRates = Array.from(new Set(items.map((item) => item.commissionRate)))
  const feeLabel = commissionRates.length === 1
    ? `MULTIVENT Service Fee (${Math.round(commissionRates[0] * 100)}%)`
    : 'MULTIVENT Service Fee'
  const amountDue = breakdown.initialPayment

  const handlePay = () => {
    if (isProcessing) return

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

  return (
    <View style={styles.screen}>
      <PlanningScreenHeader
        currentStep={5}
        label="Payment"
        nextAccessibilityLabel="Payment is the final step"
        onBack={onBack}
        title="Payment"
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
              onPress={() => undefined}
              price={formatCurrency(breakdown.initialPayment)}
              selected
            />
            <PaymentTypeCard
              description="The complete service amount will be distributed to each provider after confirmation. MULTIVENT's included 5% service fee is credited to the platform."
              detail="Coming later"
              disabled
              label="Pay in Full"
              onPress={() => undefined}
              price={formatCurrency(breakdown.clientTotal)}
              selected={false}
            />
          </View>
        </View>

        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Payment Breakdown</Text>
          <BreakdownRow label="Service Subtotal" value={formatCurrency(breakdown.serviceSubtotal)} />
          <BreakdownRow label="Client Total" value={formatCurrency(breakdown.clientTotal)} />
          <BreakdownRow
            muted
            label="Provider Downpayments (30%, held until acceptance)"
            value={formatCurrency(breakdown.providerInitialAllocation)}
          />
          <BreakdownRow
            muted
            label={`${feeLabel} · Collected now`}
            value={formatCurrency(breakdown.platformFee)}
          />
          <View style={styles.breakdownDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Downpayment Due Now (35%)
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(amountDue)}</Text>
          </View>
          <Text style={styles.balanceText}>
            Remaining 70% paid directly to providers: {formatCurrency(breakdown.providerBalance)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          <View style={styles.methodList}>
            {paymentMethods.map((method) => {
              const selected = paymentMethod === method.id
              return (
                <Pressable
                  key={method.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setPaymentMethod(method.id)}
                  style={({ pressed }) => [
                    styles.methodCard,
                    selected && styles.selectableCardActive,
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
            . I understand that deposits are non-refundable.
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
              <Text style={styles.footerLabel}>Total Due Now</Text>
              <Text style={styles.footerAmount}>{formatCurrency(amountDue)}</Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isProcessing }}
            disabled={isProcessing}
            onPress={handlePay}
            style={({ pressed }) => [
              styles.payButton,
              isWide && styles.payButtonWide,
              isProcessing && styles.payButtonDisabled,
              pressed && styles.payButtonPressed,
            ]}
          >
            <Text style={styles.payButtonText}>
              {isProcessing
                ? 'Finalizing booking...'
                : `Pay 35% Downpayment · ${formatCurrency(amountDue).replace(' ', '')}`}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
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
    paddingBottom: 152,
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
  payButtonWide: { flex: 0, width: 330 },
  payButtonText: { color: palette.surface, fontSize: 18, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  payButtonDisabled: { opacity: 0.6 },
  payButtonPressed: { backgroundColor: '#7B2B3A', transform: [{ scale: 0.98 }] },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  pressed: { opacity: 0.58 },
})
