import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

export type PayoutEarningsPeriod = '7d' | '30d' | '90d' | 'year'
export type PayoutTransactionStatus = 'completed' | 'pending' | 'failed'
export type PayoutTransactionType = 'booking' | 'payout' | 'refund' | 'adjustment'

export interface PayoutAccount {
  accountName: string
  accountNumberLast4: string
  bankName: string
  isVerified: boolean
}

export interface EarningsDataPoint {
  amount: number
  label: string
}

export interface PayoutEarningsSummary {
  availableBalance: number
  currency: string
  lifetimeEarnings: number
  nextPayoutDate?: string
  pendingBalance: number
  periodEarnings: number
}

export interface PayoutTransaction {
  amount: number
  createdAt: string
  id: string
  label: string
  reference: string
  status: PayoutTransactionStatus
  type: PayoutTransactionType
}

interface PayoutEarningsScreenProps {
  earningsTrend?: EarningsDataPoint[]
  initialPeriod?: PayoutEarningsPeriod
  isRequestingPayout?: boolean
  onBack?: () => void
  onManagePayoutAccount?: () => void
  onPeriodChange?: (period: PayoutEarningsPeriod) => void
  onRequestPayout?: (amount: number) => void
  onSelectTransaction?: (transaction: PayoutTransaction) => void
  payoutAccount?: PayoutAccount | null
  summary?: Partial<PayoutEarningsSummary>
  transactions?: PayoutTransaction[]
}

const defaultSummary: PayoutEarningsSummary = {
  availableBalance: 32750,
  currency: 'PHP',
  lifetimeEarnings: 286500,
  nextPayoutDate: '2026-09-06',
  pendingBalance: 15500,
  periodEarnings: 48250,
}

const defaultAccount: PayoutAccount = {
  accountName: 'Floral Arts',
  accountNumberLast4: '4821',
  bankName: 'BDO Unibank',
  isVerified: true,
}

const defaultTrend: EarningsDataPoint[] = [
  { amount: 7200, label: 'Aug 4' },
  { amount: 10600, label: 'Aug 11' },
  { amount: 8400, label: 'Aug 18' },
  { amount: 12600, label: 'Aug 25' },
  { amount: 9450, label: 'Sep 1' },
]

const defaultTransactions: PayoutTransaction[] = [
  {
    amount: 24500,
    createdAt: '2026-09-02T10:30:00+08:00',
    id: 'transaction-1048',
    label: 'Premium Floral Design',
    reference: 'Booking #MV-1048',
    status: 'completed',
    type: 'booking',
  },
  {
    amount: -30000,
    createdAt: '2026-08-29T09:00:00+08:00',
    id: 'transaction-po-184',
    label: 'Payout to BDO •••• 4821',
    reference: 'Payout #PO-184',
    status: 'completed',
    type: 'payout',
  },
  {
    amount: 18750,
    createdAt: '2026-08-25T16:15:00+08:00',
    id: 'transaction-1031',
    label: 'Intimate Wedding Package',
    reference: 'Booking #MV-1031',
    status: 'pending',
    type: 'booking',
  },
  {
    amount: -5000,
    createdAt: '2026-08-21T13:45:00+08:00',
    id: 'transaction-rf-092',
    label: 'Client refund',
    reference: 'Refund #RF-092',
    status: 'completed',
    type: 'refund',
  },
]

const periodOptions: Array<{ id: PayoutEarningsPeriod; label: string }> = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'year', label: '1 year' },
]

const transactionLabels: Record<PayoutTransactionType, string> = {
  adjustment: 'Adjustment',
  booking: 'Booking earning',
  payout: 'Bank payout',
  refund: 'Refund',
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-PH', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(amount)

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const WalletIcon = () => (
  <View style={styles.walletIcon}>
    <View style={styles.walletFlap} />
    <View style={styles.walletDot} />
  </View>
)

export const PayoutEarningsScreen: React.FC<PayoutEarningsScreenProps> = ({
  earningsTrend = defaultTrend,
  initialPeriod = '30d',
  isRequestingPayout = false,
  onBack,
  onManagePayoutAccount,
  onPeriodChange,
  onRequestPayout,
  onSelectTransaction,
  payoutAccount = defaultAccount,
  summary,
  transactions = defaultTransactions,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 820
  const isCompact = width < 390
  const [period, setPeriod] = React.useState<PayoutEarningsPeriod>(initialPeriod)
  const value = { ...defaultSummary, ...summary }
  const maxTrendAmount = Math.max(...earningsTrend.map((point) => point.amount), 1)
  const canRequestPayout =
    value.availableBalance > 0 && payoutAccount?.isVerified === true && !isRequestingPayout

  const selectPeriod = (nextPeriod: PayoutEarningsPeriod) => {
    setPeriod(nextPeriod)
    onPeriodChange?.(nextPeriod)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to merchant profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressedSurface]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            Payouts & Earnings
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
        <View style={styles.intro}>
          <Text style={styles.title}>Your earnings</Text>
          <Text style={styles.subtitle}>
            Track booking income, manage your payout account, and review every transaction.
          </Text>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceGlow} />
          <View style={styles.balanceHeader}>
            <View>
              <Text style={styles.balanceLabel}>AVAILABLE TO PAY OUT</Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={styles.balanceValue}
              >
                {formatCurrency(value.availableBalance, value.currency)}
              </Text>
            </View>
            <View style={styles.walletIconContainer}>
              <WalletIcon />
            </View>
          </View>
          <Text style={styles.balanceCaption}>
            Cleared earnings can be transferred to your verified payout account.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isRequestingPayout, disabled: !canRequestPayout }}
            disabled={!canRequestPayout}
            onPress={() => onRequestPayout?.(value.availableBalance)}
            style={({ pressed }) => [
              styles.payoutButton,
              !canRequestPayout && styles.payoutButtonDisabled,
              pressed && styles.payoutButtonPressed,
            ]}
          >
            <Text style={styles.payoutButtonText}>
              {isRequestingPayout ? 'Requesting...' : 'Request payout'}
            </Text>
            <Text style={styles.payoutButtonArrow}>{'\u2192'}</Text>
          </Pressable>
        </View>

        <View style={[styles.statGrid, isCompact && styles.statGridCompact]}>
          <SummaryCard
            accent="positive"
            label="EARNED THIS PERIOD"
            value={formatCurrency(value.periodEarnings, value.currency)}
          />
          <SummaryCard
            accent="pending"
            label="PENDING CLEARANCE"
            value={formatCurrency(value.pendingBalance, value.currency)}
          />
          <SummaryCard
            accent="neutral"
            label="LIFETIME EARNINGS"
            value={formatCurrency(value.lifetimeEarnings, value.currency)}
          />
        </View>

        <View style={[styles.dashboardGrid, isWide && styles.dashboardGridWide]}>
          <View style={[styles.mainColumn, isWide && styles.mainColumnWide]}>
            <View style={styles.card}>
              <View style={styles.earningsHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Earnings overview</Text>
                  <Text style={styles.sectionSubtitle}>Gross earnings before completed payouts</Text>
                </View>
                <Text style={styles.periodTotal}>
                  {formatCurrency(value.periodEarnings, value.currency)}
                </Text>
              </View>

              <View style={styles.periodSelector}>
                {periodOptions.map((option) => {
                  const selected = period === option.id
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => selectPeriod(option.id)}
                      style={({ pressed }) => [
                        styles.periodButton,
                        selected && styles.periodButtonSelected,
                        pressed && styles.periodButtonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.periodButtonText,
                          selected && styles.periodButtonTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              {earningsTrend.length ? (
                <View style={styles.chart}>
                  {earningsTrend.map((point, index) => {
                    const height = Math.max((point.amount / maxTrendAmount) * 100, 7)
                    return (
                      <View key={`${point.label}-${index}`} style={styles.chartColumn}>
                        <Text numberOfLines={1} style={styles.chartValue}>
                          {formatCurrency(point.amount, value.currency).replace('.00', '')}
                        </Text>
                        <View style={styles.chartTrack}>
                          <View style={[styles.chartBar, { height: `${height}%` }]} />
                        </View>
                        <Text numberOfLines={1} style={styles.chartLabel}>
                          {point.label}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              ) : (
                <View style={styles.emptyChart}>
                  <Text style={styles.emptyTitle}>No earnings in this period</Text>
                  <Text style={styles.emptyText}>Completed booking payments will appear here.</Text>
                </View>
              )}
            </View>

            {!isWide ? (
              <PayoutDestination
                account={payoutAccount}
                currency={value.currency}
                nextPayoutDate={value.nextPayoutDate}
                onManage={onManagePayoutAccount}
              />
            ) : null}

            <View style={styles.card}>
              <View style={styles.transactionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Recent transactions</Text>
                  <Text style={styles.sectionSubtitle}>Your latest earnings and payouts</Text>
                </View>
                <View style={styles.transactionCountBadge}>
                  <Text style={styles.transactionCount}>{transactions.length}</Text>
                </View>
              </View>

              {transactions.length ? (
                <View style={styles.transactionList}>
                  {transactions.map((transaction, index) => (
                    <TransactionRow
                      currency={value.currency}
                      isCompact={isCompact}
                      key={transaction.id}
                      last={index === transactions.length - 1}
                      onPress={onSelectTransaction}
                      transaction={transaction}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyTransactions}>
                  <Text style={styles.emptyTitle}>No transactions yet</Text>
                  <Text style={styles.emptyText}>Your booking earnings will be listed here.</Text>
                </View>
              )}
            </View>
          </View>

          {isWide ? (
            <View style={styles.sideColumn}>
              <PayoutDestination
                account={payoutAccount}
                currency={value.currency}
                nextPayoutDate={value.nextPayoutDate}
                onManage={onManagePayoutAccount}
              />
              <PayoutNotice />
            </View>
          ) : null}
        </View>

        {!isWide ? <PayoutNotice /> : null}
      </ScrollView>
    </View>
  )
}

const SummaryCard = ({
  accent,
  label,
  value,
}: {
  accent: 'positive' | 'pending' | 'neutral'
  label: string
  value: string
}) => (
  <View style={styles.summaryCard}>
    <View
      style={[
        styles.summaryAccent,
        accent === 'positive' && styles.summaryAccentPositive,
        accent === 'pending' && styles.summaryAccentPending,
      ]}
    />
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.summaryValue}>
      {value}
    </Text>
  </View>
)

const PayoutDestination = ({
  account,
  currency,
  nextPayoutDate,
  onManage,
}: {
  account: PayoutAccount | null
  currency: string
  nextPayoutDate?: string
  onManage?: () => void
}) => (
  <View style={styles.card}>
    <View style={styles.destinationHeader}>
      <Text style={styles.sectionTitle}>Payout destination</Text>
      {account?.isVerified ? (
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
        </View>
      ) : null}
    </View>

    {account ? (
      <View style={styles.bankAccount}>
        <View style={styles.bankIcon}>
          <Text style={styles.bankIconText}>B</Text>
        </View>
        <View style={styles.bankDetails}>
          <Text style={styles.bankName}>{account.bankName}</Text>
          <Text style={styles.bankNumber}>
            {account.accountName} · •••• {account.accountNumberLast4}
          </Text>
        </View>
      </View>
    ) : (
      <View style={styles.noAccount}>
        <Text style={styles.noAccountTitle}>No payout account</Text>
        <Text style={styles.noAccountText}>Add a bank account before requesting a payout.</Text>
      </View>
    )}

    {nextPayoutDate ? (
      <View style={styles.payoutSchedule}>
        <Text style={styles.payoutScheduleLabel}>NEXT AUTOMATIC PAYOUT</Text>
        <Text style={styles.payoutScheduleValue}>
          {formatDate(nextPayoutDate)} · {currency}
        </Text>
      </View>
    ) : null}

    <Pressable
      accessibilityRole="button"
      onPress={onManage}
      style={({ pressed }) => [styles.manageButton, pressed && styles.manageButtonPressed]}
    >
      <Text style={styles.manageButtonText}>{account ? 'Manage payout account' : 'Add bank account'}</Text>
    </Pressable>
  </View>
)

const TransactionRow = ({
  currency,
  isCompact,
  last,
  onPress,
  transaction,
}: {
  currency: string
  isCompact: boolean
  last: boolean
  onPress?: (transaction: PayoutTransaction) => void
  transaction: PayoutTransaction
}) => {
  const isCredit = transaction.amount >= 0
  const icon =
    transaction.type === 'booking'
      ? '\u2193'
      : transaction.type === 'payout'
        ? '\u2197'
        : transaction.type === 'refund'
          ? '\u21A9'
          : '\u00B1'

  return (
    <Pressable
      accessibilityLabel={`${transactionLabels[transaction.type]}. ${transaction.label}. ${formatCurrency(transaction.amount, currency)}`}
      accessibilityRole="button"
      onPress={() => onPress?.(transaction)}
      style={({ pressed }) => [
        styles.transactionRow,
        !last && styles.transactionRowBorder,
        pressed && styles.transactionRowPressed,
      ]}
    >
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
          {icon}
        </Text>
      </View>
      <View style={styles.transactionCopy}>
        <Text numberOfLines={1} style={styles.transactionLabel}>
          {transaction.label}
        </Text>
        <Text numberOfLines={1} style={styles.transactionMeta}>
          {isCompact ? formatDate(transaction.createdAt) : `${transaction.reference} · ${formatDate(transaction.createdAt)}`}
        </Text>
      </View>
      <View style={styles.transactionAmountColumn}>
        <Text
          numberOfLines={1}
          style={[
            styles.transactionAmount,
            isCredit ? styles.transactionAmountCredit : styles.transactionAmountDebit,
          ]}
        >
          {isCredit ? '+' : '−'}
          {formatCurrency(Math.abs(transaction.amount), currency)}
        </Text>
        <Text
          style={[
            styles.transactionStatus,
            transaction.status === 'completed' && styles.transactionStatusCompleted,
            transaction.status === 'failed' && styles.transactionStatusFailed,
          ]}
        >
          {transaction.status.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  )
}

const PayoutNotice = () => (
  <View style={styles.infoNotice}>
    <View style={styles.infoIcon}>
      <Text style={styles.infoIconText}>i</Text>
    </View>
    <View style={styles.infoCopy}>
      <Text style={styles.infoTitle}>About payout timing</Text>
      <Text style={styles.infoText}>
        Booking payments become available after the service is completed. Bank processing may take
        1–3 business days.
      </Text>
    </View>
  </View>
)

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  error: '#BA1A1A',
  errorSoft: '#FCEDEB',
  muted: '#777879',
  onPrimary: '#FFFFFF',
  pending: '#8B6117',
  pendingSoft: '#FFF3D6',
  positive: '#2F6B46',
  positiveSoft: '#E7F3EB',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainer: '#EEECEC',
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
    maxWidth: 980,
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
  pressedSurface: { backgroundColor: palette.surfaceContainerLow, opacity: 0.76 },
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
  content: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 56 },
  intro: { marginBottom: 20 },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: {
    maxWidth: 640,
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  balanceCard: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: palette.primary,
    padding: 22,
    marginBottom: 14,
  },
  balanceGlow: {
    position: 'absolute',
    width: 210,
    height: 210,
    top: -115,
    right: -45,
    borderRadius: 105,
    backgroundColor: palette.primaryContainer,
    opacity: 0.75,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  balanceLabel: {
    color: '#E4C9D0',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  balanceValue: {
    maxWidth: 500,
    color: palette.white,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  balanceCaption: {
    maxWidth: 540,
    color: '#E4C9D0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  walletIconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  walletIcon: {
    width: 24,
    height: 18,
    borderWidth: 1.6,
    borderColor: palette.white,
    borderRadius: 4,
  },
  walletFlap: {
    position: 'absolute',
    width: 10,
    height: 8,
    right: -2,
    top: 4,
    borderWidth: 1.5,
    borderColor: palette.white,
    borderRadius: 3,
    backgroundColor: palette.primaryContainer,
  },
  walletDot: {
    position: 'absolute',
    width: 2.5,
    height: 2.5,
    right: 2,
    top: 7,
    borderRadius: 2,
    backgroundColor: palette.white,
  },
  payoutButton: {
    minHeight: 46,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 999,
    backgroundColor: palette.white,
    paddingHorizontal: 19,
    marginTop: 20,
  },
  payoutButtonDisabled: { opacity: 0.48 },
  payoutButtonPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  payoutButtonText: {
    color: palette.primary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  payoutButtonArrow: { color: palette.primary, fontSize: 18, lineHeight: 20 },
  statGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statGridCompact: { flexDirection: 'column' },
  summaryCard: {
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
    padding: 14,
  },
  summaryAccent: {
    position: 'absolute',
    width: 3,
    height: '100%',
    left: 0,
    top: 0,
    backgroundColor: palette.muted,
  },
  summaryAccentPositive: { backgroundColor: palette.positive },
  summaryAccentPending: { backgroundColor: palette.pending },
  summaryLabel: {
    color: palette.muted,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.55,
  },
  summaryValue: {
    color: palette.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 4,
  },
  dashboardGrid: { gap: 14 },
  dashboardGridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { gap: 14 },
  mainColumnWide: { minWidth: 0, flex: 1 },
  sideColumn: { width: 286, gap: 14 },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    padding: 16,
  },
  sectionTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  sectionSubtitle: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 2 },
  periodTotal: { color: palette.primaryContainer, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  periodSelector: {
    flexDirection: 'row',
    gap: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceContainerLow,
    padding: 8,
  },
  periodButton: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 7,
  },
  periodButtonSelected: { backgroundColor: palette.white },
  periodButtonPressed: { opacity: 0.7 },
  periodButtonText: { color: palette.secondary, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  periodButtonTextSelected: { color: palette.primaryContainer },
  chart: {
    height: 205,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 26,
    paddingBottom: 13,
  },
  chartColumn: { height: '100%', minWidth: 0, flex: 1, alignItems: 'center' },
  chartValue: { width: '100%', color: palette.secondary, fontSize: 8, lineHeight: 12, textAlign: 'center' },
  chartTrack: {
    minHeight: 0,
    flex: 1,
    width: '62%',
    maxWidth: 44,
    justifyContent: 'flex-end',
    borderRadius: 4,
    backgroundColor: palette.surfaceContainerLow,
    marginVertical: 6,
  },
  chartBar: { width: '100%', borderRadius: 4, backgroundColor: palette.primaryContainer },
  chartLabel: { width: '100%', color: palette.muted, fontSize: 8, lineHeight: 12, textAlign: 'center' },
  emptyChart: { minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { color: palette.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  emptyText: { color: palette.secondary, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 3 },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  verifiedBadge: { borderRadius: 999, backgroundColor: palette.positiveSoft, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedBadgeText: { color: palette.positive, fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.5 },
  bankAccount: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16 },
  bankIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: palette.primarySoft },
  bankIconText: { color: palette.primaryContainer, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  bankDetails: { minWidth: 0, flex: 1 },
  bankName: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  bankNumber: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 1 },
  noAccount: { paddingHorizontal: 16, paddingTop: 14 },
  noAccountTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  noAccountText: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 2 },
  payoutSchedule: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surfaceContainerLow, paddingHorizontal: 16, paddingVertical: 11 },
  payoutScheduleLabel: { color: palette.muted, fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.55 },
  payoutScheduleValue: { color: palette.text, fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  manageButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: palette.border, paddingHorizontal: 14 },
  manageButtonPressed: { backgroundColor: palette.primarySoft },
  manageButtonText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  transactionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 },
  transactionCountBadge: { minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: palette.primarySoft, paddingHorizontal: 7 },
  transactionCount: { color: palette.primaryContainer, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  transactionList: { paddingHorizontal: 16 },
  transactionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  transactionRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  transactionRowPressed: { opacity: 0.68 },
  transactionIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  transactionIconCredit: { backgroundColor: palette.positiveSoft },
  transactionIconDebit: { backgroundColor: palette.primarySoft },
  transactionIconText: { fontSize: 17, lineHeight: 20, fontWeight: '700' },
  transactionIconTextCredit: { color: palette.positive },
  transactionIconTextDebit: { color: palette.primaryContainer },
  transactionCopy: { minWidth: 0, flex: 1 },
  transactionLabel: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  transactionMeta: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: 2 },
  transactionAmountColumn: { alignItems: 'flex-end', marginLeft: 2 },
  transactionAmount: { maxWidth: 128, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  transactionAmountCredit: { color: palette.positive },
  transactionAmountDebit: { color: palette.primaryContainer },
  transactionStatus: { color: palette.pending, fontSize: 7, lineHeight: 11, fontWeight: '700', letterSpacing: 0.45, marginTop: 2 },
  transactionStatusCompleted: { color: palette.positive },
  transactionStatusFailed: { color: palette.error },
  emptyTransactions: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 30 },
  infoNotice: { flexDirection: 'row', gap: 10, borderRadius: 9, backgroundColor: palette.primarySoft, padding: 14 },
  infoIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.primaryContainer, borderRadius: 12 },
  infoIconText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  infoCopy: { minWidth: 0, flex: 1 },
  infoTitle: { color: palette.primaryContainer, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  infoText: { color: palette.secondary, fontSize: 9, lineHeight: 15, marginTop: 2 },
})
