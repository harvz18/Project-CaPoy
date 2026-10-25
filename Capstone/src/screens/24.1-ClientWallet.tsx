import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../components/AppText'
import { BrandIdentity } from '../components/BrandIdentity'
import type {
  ClientRefundOverview,
  ClientRefundRecord,
  HistoricalRefundRecord,
} from '../lib/client-wallet'
import { colors } from '../theme/tokens'

type ClientRefundsScreenProps = {
  error?: string
  isLoading?: boolean
  isRefreshing?: boolean
  onBack: () => void
  onRefresh?: () => void
  overview?: ClientRefundOverview
}

const emptyOverview: ClientRefundOverview = {
  historicalRecords: [],
  refunds: [],
  summary: {
    completedRefunds: 0,
    currency: 'PHP',
    historicalWalletCredits: 0,
    pendingExternalDisbursements: 0,
    requiresReconciliation: 0,
  },
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-PH', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(amount)

const formatDate = (value?: string) => {
  if (!value) return 'Refund recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Refund recorded'
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const refundReasonLabel = (reason: ClientRefundRecord['reason']) =>
  reason === 'recipient_declined'
    ? 'Provider or coordinator declined'
    : reason === 'client_cancellation'
      ? 'Eligible event cancellation'
      : 'Refund obligation'

const refundStatusLabel = (status: ClientRefundRecord['status']) => ({
  cancelled: 'CANCELLED',
  completed: 'COMPLETED',
  failed: 'NEEDS ATTENTION',
  pending_destination: 'AWAITING DESTINATION',
  pending_disbursement: 'READY FOR PAYOUT',
  processing: 'PROCESSING',
  requires_reconciliation: 'RECONCILIATION REQUIRED',
}[status])

export const ClientRefundsScreen: React.FC<ClientRefundsScreenProps> = ({
  error,
  isLoading = false,
  isRefreshing = false,
  onBack,
  onRefresh,
  overview = emptyOverview,
}) => {
  const { historicalRecords, refunds, summary } = overview

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back to account"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MaterialIcons color={colors.primaryDark} name="arrow-back" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <BrandIdentity markSize={22} style={styles.brandIdentity} />
          <Text style={styles.headerTitle}>Refunds & Disbursements</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={onRefresh ? (
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        ) : undefined}
      >
        <View style={styles.balanceCard}>
          <View style={styles.refundIcon}>
            <MaterialIcons color={colors.textInverse} name="account-balance" size={24} />
          </View>
          <Text style={styles.balanceLabel}>PENDING EXTERNAL REFUNDS</Text>
          <Text style={styles.balanceAmount}>
            {formatCurrency(summary.pendingExternalDisbursements, summary.currency)}
          </Text>
          <Text style={styles.balanceCopy}>
            Refunds are recorded for bank or e-wallet disbursement. This is not an in-app cash balance.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <MaterialIcons color={colors.primary} name="info-outline" size={20} />
          <Text style={styles.infoCopy}>
            MULTIVENT tracks refund obligations and external transfer outcomes. A reference or proof never confirms a payment or refund on its own.
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>External refund activity</Text>
            <Text style={styles.sectionCopy}>
              {formatCurrency(summary.completedRefunds, summary.currency)} completed externally
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{refunds.length}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading refund records...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons color={colors.error} name="error-outline" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : refunds.length ? (
          <View style={styles.transactionCard}>
            {refunds.map((transaction, index) => (
              <RefundTransactionRow
                isLast={index === refunds.length - 1}
                key={transaction.id}
                transaction={transaction}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons color={colors.primary} name="receipt-long" size={24} />
            </View>
            <Text style={styles.emptyTitle}>No refund records yet</Text>
            <Text style={styles.emptyCopy}>
              Eligible refunds are recorded here after a cancellation or provider/coordinator decline, then completed through an external payout process.
            </Text>
          </View>
        )}

        {summary.requiresReconciliation > 0 ? (
          <View style={styles.reconciliationCard}>
            <MaterialIcons color={colors.warning} name="pending-actions" size={20} />
            <Text style={styles.reconciliationCopy}>
              {formatCurrency(summary.requiresReconciliation, summary.currency)} requires financial reconciliation before an external disbursement can be completed.
            </Text>
          </View>
        ) : null}

        {historicalRecords.length ? (
          <View style={styles.historicalSection}>
            <Text style={styles.historicalTitle}>Historical records</Text>
            <Text style={styles.historicalCopy}>
              Earlier wallet credits are preserved for history. They are not automatically converted into bank or e-wallet funds.
            </Text>
            <View style={styles.transactionCard}>
              {historicalRecords.map((transaction, index) => (
                <HistoricalTransactionRow
                  isLast={index === historicalRecords.length - 1}
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const RefundTransactionRow = ({
  isLast,
  transaction,
}: {
  isLast: boolean
  transaction: ClientRefundRecord
}) => (
  <View style={[styles.transactionRow, !isLast && styles.transactionRowBorder]}>
    <View style={styles.transactionIcon}>
      <MaterialIcons color={colors.primary} name="reply" size={20} />
    </View>
    <View style={styles.transactionCopy}>
      <Text numberOfLines={1} style={styles.transactionTitle}>{transaction.eventName}</Text>
      <Text numberOfLines={1} style={styles.transactionSubtitle}>
        {transaction.serviceName} · {refundReasonLabel(transaction.reason)}
      </Text>
      <Text style={styles.transactionMeta}>
        {formatDate(transaction.processedAt ?? transaction.createdAt)} · {transaction.reference || 'External transfer pending'}
      </Text>
    </View>
    <View style={styles.transactionAmountBlock}>
      <Text style={styles.transactionAmount}>{formatCurrency(transaction.amount, transaction.currency)}</Text>
      <Text style={[styles.status, transaction.status === 'completed' ? styles.completedStatus : styles.pendingStatus]}>
        {refundStatusLabel(transaction.status)}
      </Text>
    </View>
  </View>
)

const HistoricalTransactionRow = ({
  isLast,
  transaction,
}: {
  isLast: boolean
  transaction: HistoricalRefundRecord
}) => (
  <View style={[styles.transactionRow, !isLast && styles.transactionRowBorder]}>
    <View style={styles.transactionIcon}>
      <MaterialIcons color={colors.textSecondary} name="history" size={20} />
    </View>
    <View style={styles.transactionCopy}>
      <Text numberOfLines={1} style={styles.transactionTitle}>{transaction.eventName}</Text>
      <Text numberOfLines={1} style={styles.transactionSubtitle}>{transaction.serviceName} · Historical refund record</Text>
      <Text style={styles.transactionMeta}>{formatDate(transaction.createdAt)} · {transaction.reference}</Text>
    </View>
    <Text style={styles.historicalAmount}>{formatCurrency(transaction.amount, transaction.currency)}</Text>
  </View>
)

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  balanceAmount: { color: colors.textInverse, fontFamily: 'Inter_700Bold', fontSize: 30, marginTop: 5 },
  balanceCard: { backgroundColor: colors.primaryDark, borderRadius: 20, marginBottom: 14, overflow: 'hidden', padding: 22 },
  balanceCopy: { color: '#F4DFE2', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 10, maxWidth: 300 },
  balanceLabel: { color: '#F1C7CF', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, marginTop: 18 },
  brandIdentity: { marginBottom: 2 },
  completedStatus: { color: '#237646' },
  content: { paddingBottom: 58, paddingHorizontal: 18, paddingTop: 22 },
  countBadge: { alignItems: 'center', backgroundColor: '#F4E4E7', borderRadius: 14, justifyContent: 'center', minHeight: 28, minWidth: 28, paddingHorizontal: 8 },
  countText: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 12 },
  emptyCard: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 26, paddingVertical: 34 },
  emptyCopy: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 7, maxWidth: 330, textAlign: 'center' },
  emptyIcon: { alignItems: 'center', backgroundColor: '#F4E4E7', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  emptyTitle: { color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 14 },
  errorCard: { alignItems: 'flex-start', backgroundColor: '#FFF0F0', borderColor: '#E9B6B6', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 14 },
  errorText: { color: colors.error, flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  header: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 13 },
  headerCopy: { alignItems: 'center', flex: 1 },
  headerSpacer: { width: 40 },
  headerTitle: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 2 },
  historicalAmount: { color: colors.textSecondary, fontFamily: 'Inter_700Bold', fontSize: 13, marginLeft: 10, textAlign: 'right' },
  historicalCopy: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 10, marginTop: 4 },
  historicalSection: { marginTop: 26 },
  historicalTitle: { color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 16 },
  infoCard: { alignItems: 'flex-start', backgroundColor: '#FFF7F8', borderColor: '#E9C9CE', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 26, padding: 14 },
  infoCopy: { color: colors.textSecondary, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  loadingCard: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: 10, paddingVertical: 38 },
  loadingText: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13 },
  pendingStatus: { color: colors.primaryDark },
  pressed: { opacity: 0.72 },
  reconciliationCard: { alignItems: 'flex-start', backgroundColor: '#FFF8E8', borderColor: '#E6CEA1', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 14, padding: 14 },
  reconciliationCopy: { color: colors.textSecondary, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  refundIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  screen: { backgroundColor: colors.backgroundSecondary, flex: 1 },
  sectionCopy: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 18 },
  status: { fontFamily: 'Inter_700Bold', fontSize: 10, marginTop: 4, textAlign: 'right' },
  transactionAmount: { color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 13, textAlign: 'right' },
  transactionAmountBlock: { alignItems: 'flex-end', marginLeft: 10, maxWidth: 112 },
  transactionCard: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  transactionCopy: { flex: 1, minWidth: 0 },
  transactionIcon: { alignItems: 'center', backgroundColor: '#F4E4E7', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  transactionMeta: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
  transactionRow: { alignItems: 'center', flexDirection: 'row', gap: 11, padding: 15 },
  transactionRowBorder: { borderBottomColor: colors.divider, borderBottomWidth: 1 },
  transactionSubtitle: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  transactionTitle: { color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 14 },
})
