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
import type { ClientWallet, ClientWalletTransaction } from '../lib/client-wallet'
import { colors } from '../theme/tokens'

type ClientWalletScreenProps = {
  error?: string
  isLoading?: boolean
  isRefreshing?: boolean
  onBack: () => void
  onRefresh?: () => void
  wallet?: ClientWallet
}

const emptyWallet: ClientWallet = {
  summary: { availableBalance: 0, currency: 'PHP', totalRefunded: 0 },
  transactions: [],
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-PH', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(amount)

const formatDate = (value?: string) => {
  if (!value) return 'Refund credited'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Refund credited'
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const refundReasonLabel = (transaction: ClientWalletTransaction) =>
  transaction.reason === 'recipient_declined'
    ? 'Provider or coordinator declined'
    : transaction.reason === 'client_cancellation'
      ? 'Eligible event cancellation'
      : 'Refund credit'

export const ClientWalletScreen: React.FC<ClientWalletScreenProps> = ({
  error,
  isLoading = false,
  isRefreshing = false,
  onBack,
  onRefresh,
  wallet = emptyWallet,
}) => {
  const { summary, transactions } = wallet

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
          <Text style={styles.headerTitle}>Wallet</Text>
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
          <View style={styles.walletIcon}>
            <MaterialIcons color={colors.textInverse} name="account-balance-wallet" size={24} />
          </View>
          <Text style={styles.balanceLabel}>AVAILABLE WALLET BALANCE</Text>
          <Text style={styles.balanceAmount}>
            {formatCurrency(summary.availableBalance, summary.currency)}
          </Text>
          <Text style={styles.balanceCopy}>
            Refund credits are kept safely in your MULTIVENT Wallet.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <MaterialIcons color={colors.primary} name="info-outline" size={20} />
          <Text style={styles.infoCopy}>
            Your available balance is ready for a future verified bank or e-wallet withdrawal flow. No external transfer is created from this screen.
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Refund activity</Text>
            <Text style={styles.sectionCopy}>
              {formatCurrency(summary.totalRefunded, summary.currency)} credited in total
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{transactions.length}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading wallet…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons color={colors.error} name="error-outline" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : transactions.length ? (
          <View style={styles.transactionCard}>
            {transactions.map((transaction, index) => (
              <WalletTransactionRow
                isLast={index === transactions.length - 1}
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
            <Text style={styles.emptyTitle}>No wallet credits yet</Text>
            <Text style={styles.emptyCopy}>
              Eligible refunds will appear here automatically after a cancellation or a provider/coordinator decline.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const WalletTransactionRow = ({
  isLast,
  transaction,
}: {
  isLast: boolean
  transaction: ClientWalletTransaction
}) => (
  <View style={[styles.transactionRow, !isLast && styles.transactionRowBorder]}>
    <View style={styles.transactionIcon}>
      <MaterialIcons color={colors.primary} name="reply" size={20} />
    </View>
    <View style={styles.transactionCopy}>
      <Text numberOfLines={1} style={styles.transactionTitle}>{transaction.eventName}</Text>
      <Text numberOfLines={1} style={styles.transactionSubtitle}>
        {transaction.serviceName} · {refundReasonLabel(transaction)}
      </Text>
      <Text style={styles.transactionMeta}>{formatDate(transaction.createdAt)} · {transaction.reference}</Text>
    </View>
    <View style={styles.transactionAmountBlock}>
      <Text style={styles.transactionAmount}>+{formatCurrency(transaction.amount, transaction.currency)}</Text>
      <Text style={styles.availableStatus}>AVAILABLE</Text>
    </View>
  </View>
)

const styles = StyleSheet.create({
  availableStatus: { color: '#237646', fontFamily: 'Inter_700Bold', fontSize: 11, marginTop: 4, textAlign: 'right' },
  backButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  balanceAmount: { color: colors.textInverse, fontFamily: 'Inter_700Bold', fontSize: 30, marginTop: 5 },
  balanceCard: { backgroundColor: colors.primaryDark, borderRadius: 20, marginBottom: 14, overflow: 'hidden', padding: 22 },
  balanceCopy: { color: '#F4DFE2', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 10, maxWidth: 290 },
  balanceLabel: { color: '#F1C7CF', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, marginTop: 18 },
  brandIdentity: { marginBottom: 2 },
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
  infoCard: { alignItems: 'flex-start', backgroundColor: '#FFF7F8', borderColor: '#E9C9CE', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 26, padding: 14 },
  infoCopy: { color: colors.textSecondary, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  loadingCard: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: 10, paddingVertical: 38 },
  loadingText: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13 },
  pressed: { opacity: 0.72 },
  screen: { backgroundColor: colors.backgroundSecondary, flex: 1 },
  sectionCopy: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 18 },
  transactionAmount: { color: '#237646', fontFamily: 'Inter_700Bold', fontSize: 13, textAlign: 'right' },
  transactionAmountBlock: { alignItems: 'flex-end', marginLeft: 10 },
  transactionCard: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  transactionCopy: { flex: 1, minWidth: 0 },
  transactionIcon: { alignItems: 'center', backgroundColor: '#F4E4E7', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  transactionMeta: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
  transactionRow: { alignItems: 'center', flexDirection: 'row', gap: 11, padding: 15 },
  transactionRowBorder: { borderBottomColor: colors.divider, borderBottomWidth: 1 },
  transactionSubtitle: { color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  transactionTitle: { color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 14 },
  walletIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
})
