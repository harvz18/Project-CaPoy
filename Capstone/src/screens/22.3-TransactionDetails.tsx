import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import type {
  PayoutTransaction,
  PayoutTransactionStatus,
  PayoutTransactionType,
} from './22.2-PayoutEarnings'

export interface TransactionBreakdownItem {
  amount: number
  label: string
}

export interface TransactionDetailItem {
  label: string
  value: string
}

export interface MerchantTransactionDetails extends PayoutTransaction {
  breakdown: TransactionBreakdownItem[]
  currency: string
  details: TransactionDetailItem[]
  processedAt?: string
}

interface TransactionDetailsScreenProps {
  isDownloadingReceipt?: boolean
  onBack?: () => void
  onContactSupport?: (transaction: MerchantTransactionDetails) => void
  onDownloadReceipt?: (transaction: MerchantTransactionDetails) => void
  onOpenRelatedRecord?: (transaction: MerchantTransactionDetails) => void
  transaction?: Partial<MerchantTransactionDetails>
}

const defaultTransaction: MerchantTransactionDetails = {
  amount: 24500,
  breakdown: [
    { amount: 26000, label: 'Client payment' },
    { amount: -1300, label: 'Multivent service fee' },
    { amount: -200, label: 'Payment processing fee' },
  ],
  createdAt: '2026-09-02T10:30:00+08:00',
  currency: 'PHP',
  details: [
    { label: 'Booking', value: '#MV-1048' },
    { label: 'Client', value: 'Maria Santos' },
    { label: 'Service', value: 'Premium Floral Design' },
    { label: 'Event date', value: 'September 12, 2026' },
    { label: 'Payment method', value: 'GCash' },
  ],
  id: 'transaction-1048',
  label: 'Premium Floral Design',
  processedAt: '2026-09-02T10:32:00+08:00',
  reference: 'Booking #MV-1048',
  status: 'completed',
  type: 'booking',
}

const typeLabels: Record<PayoutTransactionType, string> = {
  adjustment: 'Balance adjustment',
  booking: 'Booking earning',
  payout: 'Bank payout',
  refund: 'Client refund',
}

const relatedRecordLabels: Partial<Record<PayoutTransactionType, string>> = {
  booking: 'View booking',
  payout: 'View payout',
  refund: 'View refund',
}

const statusContent: Record<
  PayoutTransactionStatus,
  { description: string; label: string }
> = {
  completed: {
    description: 'This transaction was processed successfully.',
    label: 'Completed',
  },
  failed: {
    description: 'This transaction could not be completed. Contact support if you need help.',
    label: 'Failed',
  },
  pending: {
    description: 'This transaction is still being processed. No action is needed right now.',
    label: 'Pending',
  },
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-PH', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(amount)

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const ReceiptIcon = () => (
  <View style={styles.receiptIcon}>
    <View style={styles.receiptLineLong} />
    <View style={styles.receiptLineShort} />
    <View style={styles.receiptLineLong} />
  </View>
)

export const TransactionDetailsScreen: React.FC<TransactionDetailsScreenProps> = ({
  isDownloadingReceipt = false,
  onBack,
  onContactSupport,
  onDownloadReceipt,
  onOpenRelatedRecord,
  transaction,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 760
  const value: MerchantTransactionDetails = {
    ...defaultTransaction,
    ...transaction,
    breakdown: transaction?.breakdown ?? defaultTransaction.breakdown,
    details: transaction?.details ?? defaultTransaction.details,
  }
  const isCredit = value.amount >= 0
  const status = statusContent[value.status]
  const relatedRecordLabel = relatedRecordLabels[value.type]

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to payouts and earnings"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            Transaction Details
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.transactionHero}>
          <View
            style={[
              styles.transactionIcon,
              isCredit ? styles.transactionIconCredit : styles.transactionIconDebit,
            ]}
          >
            <Text
              style={[
                styles.transactionIconText,
                isCredit ? styles.transactionIconTextCredit : styles.transactionIconTextDebit,
              ]}
            >
              {isCredit ? '\u2193' : '\u2197'}
            </Text>
          </View>
          <Text style={styles.typeLabel}>{typeLabels[value.type].toUpperCase()}</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={[styles.amount, !isCredit && styles.amountDebit]}
          >
            {isCredit ? '+' : '−'}
            {formatCurrency(Math.abs(value.amount), value.currency)}
          </Text>
          <Text numberOfLines={2} style={styles.transactionLabel}>
            {value.label}
          </Text>
          <View
            style={[
              styles.statusBadge,
              value.status === 'pending' && styles.statusBadgePending,
              value.status === 'failed' && styles.statusBadgeFailed,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                value.status === 'pending' && styles.statusDotPending,
                value.status === 'failed' && styles.statusDotFailed,
              ]}
            />
            <Text
              style={[
                styles.statusBadgeText,
                value.status === 'pending' && styles.statusBadgeTextPending,
                value.status === 'failed' && styles.statusBadgeTextFailed,
              ]}
            >
              {status.label}
            </Text>
          </View>
        </View>

        <View style={[styles.detailGrid, isWide && styles.detailGridWide]}>
          <View style={[styles.primaryColumn, isWide && styles.primaryColumnWide]}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>Amount breakdown</Text>
                <Text style={styles.reference}>{value.reference}</Text>
              </View>
              <View style={styles.breakdownList}>
                {value.breakdown.map((item, index) => (
                  <View key={`${item.label}-${index}`} style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                    <Text
                      style={[
                        styles.breakdownValue,
                        item.amount < 0 && styles.breakdownFee,
                      ]}
                    >
                      {item.amount < 0 ? '−' : ''}
                      {formatCurrency(Math.abs(item.amount), value.currency)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>{isCredit ? 'Net earned' : 'Total amount'}</Text>
                  <Text style={styles.totalCaption}>
                    {isCredit ? 'Added to your merchant balance' : 'Deducted from your balance'}
                  </Text>
                </View>
                <Text style={[styles.totalValue, !isCredit && styles.amountDebit]}>
                  {formatCurrency(Math.abs(value.amount), value.currency)}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>Transaction information</Text>
              </View>
              <View style={styles.informationList}>
                {value.details.map((detail, index) => (
                  <InformationRow
                    key={`${detail.label}-${index}`}
                    label={detail.label}
                    last={index === value.details.length - 1}
                    value={detail.value}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.secondaryColumn, isWide && styles.secondaryColumnWide]}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>Processing status</Text>
              </View>
              <View style={styles.statusPanel}>
                <View style={styles.timelineRail}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineLine} />
                  <View
                    style={[
                      styles.timelineDot,
                      value.status === 'pending' && styles.timelineDotPending,
                      value.status === 'failed' && styles.timelineDotFailed,
                    ]}
                  />
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineTitle}>Transaction created</Text>
                    <Text style={styles.timelineDate}>{formatTimestamp(value.createdAt)}</Text>
                  </View>
                  <View style={styles.timelineItem}>
                    <Text style={styles.timelineTitle}>{status.label}</Text>
                    <Text style={styles.timelineDate}>
                      {value.processedAt ? formatTimestamp(value.processedAt) : 'Processing'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.statusMessage}>
                <Text style={styles.statusMessageText}>{status.description}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>Actions</Text>
              </View>
              <View style={styles.actionList}>
                <ActionButton
                  glyph={<ReceiptIcon />}
                  label={isDownloadingReceipt ? 'Preparing receipt...' : 'Download receipt'}
                  disabled={isDownloadingReceipt}
                  onPress={() => onDownloadReceipt?.(value)}
                />
                {relatedRecordLabel ? (
                  <ActionButton
                    glyph={<Text style={styles.actionGlyph}>{'\u25A3'}</Text>}
                    label={relatedRecordLabel}
                    onPress={() => onOpenRelatedRecord?.(value)}
                  />
                ) : null}
                <ActionButton
                  glyph={<Text style={styles.actionGlyph}>?</Text>}
                  label="Get help with this transaction"
                  last
                  onPress={() => onContactSupport?.(value)}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.securityNotice}>
          <View style={styles.lockIcon}>
            <View style={styles.lockShackle} />
            <View style={styles.lockBody} />
          </View>
          <Text style={styles.securityText}>
            Transaction records are securely stored and cannot be edited after processing.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const InformationRow = ({
  label,
  last,
  value,
}: {
  label: string
  last: boolean
  value: string
}) => (
  <View style={[styles.informationRow, !last && styles.informationRowBorder]}>
    <Text style={styles.informationLabel}>{label}</Text>
    <Text selectable style={styles.informationValue}>
      {value}
    </Text>
  </View>
)

const ActionButton = ({
  disabled = false,
  glyph,
  label,
  last = false,
  onPress,
}: {
  disabled?: boolean
  glyph: React.ReactNode
  label: string
  last?: boolean
  onPress: () => void
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.actionButton,
      !last && styles.actionButtonBorder,
      disabled && styles.actionButtonDisabled,
      pressed && styles.actionButtonPressed,
    ]}
  >
    <View style={styles.actionIcon}>{glyph}</View>
    <Text style={styles.actionLabel}>{label}</Text>
    <Text style={styles.actionChevron}>{'\u203A'}</Text>
  </Pressable>
)

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  error: '#BA1A1A',
  errorSoft: '#FCEDEB',
  muted: '#777879',
  pending: '#8B6117',
  pendingSoft: '#FFF3D6',
  positive: '#2F6B46',
  positiveSoft: '#E7F3EB',
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
    maxWidth: 860,
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
  backButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.75 },
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
  content: { width: '100%', maxWidth: 860, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 56 },
  transactionHero: { alignItems: 'center', paddingBottom: 24 },
  transactionIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
  },
  transactionIconCredit: { backgroundColor: palette.positiveSoft },
  transactionIconDebit: { backgroundColor: palette.primarySoft },
  transactionIconText: { fontSize: 25, lineHeight: 29, fontWeight: '700' },
  transactionIconTextCredit: { color: palette.positive },
  transactionIconTextDebit: { color: palette.primaryContainer },
  typeLabel: {
    color: palette.muted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.85,
    marginTop: 13,
  },
  amount: {
    maxWidth: '92%',
    color: palette.positive,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  amountDebit: { color: palette.primaryContainer },
  transactionLabel: {
    maxWidth: 520,
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: palette.positiveSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  statusBadgePending: { backgroundColor: palette.pendingSoft },
  statusBadgeFailed: { backgroundColor: palette.errorSoft },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.positive },
  statusDotPending: { backgroundColor: palette.pending },
  statusDotFailed: { backgroundColor: palette.error },
  statusBadgeText: { color: palette.positive, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  statusBadgeTextPending: { color: palette.pending },
  statusBadgeTextFailed: { color: palette.error },
  detailGrid: { gap: 14 },
  detailGridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  primaryColumn: { gap: 14 },
  primaryColumnWide: { minWidth: 0, flex: 1 },
  secondaryColumn: { gap: 14 },
  secondaryColumnWide: { width: 292 },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  reference: { color: palette.muted, fontSize: 9, lineHeight: 14, textAlign: 'right' },
  breakdownList: { paddingHorizontal: 16, paddingVertical: 9 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  breakdownLabel: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 11, lineHeight: 16 },
  breakdownValue: { color: palette.text, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  breakdownFee: { color: palette.secondary },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surfaceContainerLow,
    padding: 16,
  },
  totalLabel: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  totalCaption: { color: palette.muted, fontSize: 8, lineHeight: 12, marginTop: 1 },
  totalValue: { color: palette.positive, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  informationList: { paddingHorizontal: 16 },
  informationRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, paddingVertical: 12 },
  informationRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  informationLabel: { color: palette.secondary, fontSize: 10, lineHeight: 15 },
  informationValue: { minWidth: 0, flex: 1, color: palette.text, fontSize: 10, lineHeight: 15, fontWeight: '600', textAlign: 'right' },
  statusPanel: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  timelineRail: { width: 12, alignItems: 'center', paddingVertical: 4 },
  timelineDot: { zIndex: 2, width: 9, height: 9, borderRadius: 5, backgroundColor: palette.positive },
  timelineLine: { width: 1.5, minHeight: 35, flex: 1, backgroundColor: palette.border },
  timelineDotPending: { backgroundColor: palette.pending },
  timelineDotFailed: { backgroundColor: palette.error },
  timelineContent: { minWidth: 0, flex: 1, gap: 18 },
  timelineItem: { minHeight: 31 },
  timelineTitle: { color: palette.text, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  timelineDate: { color: palette.muted, fontSize: 8, lineHeight: 13, marginTop: 1 },
  statusMessage: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surfaceContainerLow, padding: 13 },
  statusMessageText: { color: palette.secondary, fontSize: 9, lineHeight: 15 },
  actionList: { paddingHorizontal: 16 },
  actionButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionButtonBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonPressed: { opacity: 0.62 },
  actionIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: palette.primarySoft },
  actionGlyph: { color: palette.primaryContainer, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  actionLabel: { minWidth: 0, flex: 1, color: palette.text, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  actionChevron: { color: palette.secondary, fontSize: 22, lineHeight: 24 },
  receiptIcon: { width: 12, height: 15, justifyContent: 'center', gap: 2, borderWidth: 1.3, borderColor: palette.primaryContainer, borderRadius: 1, paddingHorizontal: 2 },
  receiptLineLong: { width: 6, height: 1, borderRadius: 1, backgroundColor: palette.primaryContainer },
  receiptLineShort: { width: 4, height: 1, borderRadius: 1, backgroundColor: palette.primaryContainer },
  securityNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 17 },
  securityText: { maxWidth: 560, color: palette.muted, fontSize: 9, lineHeight: 14, textAlign: 'center' },
  lockIcon: { width: 13, height: 15, alignItems: 'center' },
  lockShackle: { width: 8, height: 8, borderWidth: 1.2, borderColor: palette.muted, borderRadius: 5 },
  lockBody: { position: 'absolute', width: 12, height: 9, bottom: 0, borderRadius: 2, backgroundColor: palette.muted },
})
