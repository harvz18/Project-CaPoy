import { Text } from '../components/AppText'
import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

export type PayoutEarningsPeriod = '7d' | '30d' | '90d' | 'year'
export type PayoutTransactionStatus = 'completed' | 'pending' | 'failed'
export type PayoutTransactionType = 'booking' | 'payout' | 'refund' | 'adjustment'

export interface PayoutAccount {
  accountName: string
  accountNumberLast4: string
  accountType?: 'bank_transfer' | 'e_wallet'
  bankName: string
  isVerified: boolean
}

export interface PayoutAccountInput {
  accountName: string
  accountNumber: string
  accountType: 'bank_transfer' | 'e_wallet'
  confirmOwnership: boolean
  institutionName: string
}

export interface EarningsDataPoint {
  amount: number
  label: string
}

export interface PayoutEarningsSummary {
  availableBalance: number
  currency: string
  heldBalance: number
  lifetimeEarnings: number
  nextPayoutDate?: string
  pendingBalance: number
  periodEarnings: number
  remainingReceivable: number
}

export interface ProviderPaymentConfirmation {
  amountEarned: number
  amountHeld: number
  amountPaidOut: number
  amountWithdrawable: number
  balanceStatus: string
  bookingId: string
  creditedAt?: string
  eventId: string
  eventName: string
  eventStatus: string
  fundsStatus: string
  initialProviderShare: number
  paidAt?: string
  paymentStatus: string
  payoutStatus: string
  remainingServiceBalance: number
  serviceAmount: number
  serviceName: string
}

export interface PayoutTransaction {
  amount: number
  breakdown?: Array<{ amount: number; label: string }>
  createdAt: string
  currency?: string
  details?: Array<{ label: string; value: string }>
  id: string
  label: string
  processedAt?: string
  reference: string
  relatedRecordId?: string
  status: PayoutTransactionStatus
  type: PayoutTransactionType
}

interface PayoutEarningsScreenProps {
  earningsTrend?: EarningsDataPoint[]
  errorMessage?: string
  initialPeriod?: PayoutEarningsPeriod
  isLoading?: boolean
  isRefreshing?: boolean
  isRequestingPayout?: boolean
  isSavingPayoutAccount?: boolean
  onBack?: () => void
  onPeriodChange?: (period: PayoutEarningsPeriod) => void
  onRefresh?: () => void
  onRequestPayout?: (amount: number) => void
  onSavePayoutAccount?: (value: PayoutAccountInput) => Promise<boolean>
  onSelectTransaction?: (transaction: PayoutTransaction) => void
  paymentConfirmations?: ProviderPaymentConfirmation[]
  payoutAccount?: PayoutAccount | null
  summary?: Partial<PayoutEarningsSummary>
  transactions?: PayoutTransaction[]
}

const defaultSummary: PayoutEarningsSummary = {
  availableBalance: 0,
  currency: 'PHP',
  heldBalance: 0,
  lifetimeEarnings: 0,
  pendingBalance: 0,
  periodEarnings: 0,
  remainingReceivable: 0,
}

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
  earningsTrend = [],
  errorMessage,
  initialPeriod = '30d',
  isLoading = false,
  isRefreshing = false,
  isRequestingPayout = false,
  isSavingPayoutAccount = false,
  onBack,
  onPeriodChange,
  onRefresh,
  onRequestPayout,
  onSavePayoutAccount,
  onSelectTransaction,
  paymentConfirmations = [],
  payoutAccount = null,
  summary,
  transactions = [],
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 820
  const isCompact = width < 390
  const [period, setPeriod] = React.useState<PayoutEarningsPeriod>(initialPeriod)
  const [isAccountModalVisible, setIsAccountModalVisible] = React.useState(false)
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
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={isRefreshing}
            tintColor={palette.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
        {isLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.loadingText}>Loading recorded earnings...</Text>
          </View>
        ) : null}
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
            Cleared earnings can be transferred to your confirmed payout account.
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
                  <Text style={styles.sectionSubtitle}>Provider earnings recorded for this period</Text>
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

            <View style={[styles.card, styles.confirmationSection]}>
              <View style={styles.transactionHeader}>
                <View style={styles.confirmationHeaderCopy}>
                  <Text style={styles.sectionTitle}>Payment confirmations</Text>
                  <Text style={styles.sectionSubtitle}>
                    Tap an event to view its payment breakdown
                  </Text>
                </View>
                <View style={styles.transactionCountBadge}>
                  <Text style={styles.transactionCount}>{paymentConfirmations.length}</Text>
                </View>
              </View>

              <View style={styles.confirmationTotals}>
                <View style={styles.confirmationTotalItem}>
                  <Text style={styles.confirmationTotalLabel}>HELD BY MULTIVENT</Text>
                  <Text style={styles.confirmationTotalValue}>
                    {formatCurrency(value.heldBalance, value.currency)}
                  </Text>
                </View>
                <View style={styles.confirmationTotalItem}>
                  <Text style={styles.confirmationTotalLabel}>REMAINING RECEIVABLE</Text>
                  <Text style={styles.confirmationTotalValue}>
                    {formatCurrency(value.remainingReceivable, value.currency)}
                  </Text>
                </View>
              </View>

              {paymentConfirmations.length ? (
                <View style={styles.confirmationList}>
                  {paymentConfirmations.map((confirmation, index) => (
                    <PaymentConfirmationCard
                      confirmation={confirmation}
                      currency={value.currency}
                      key={confirmation.bookingId}
                      last={index === paymentConfirmations.length - 1}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyTransactions}>
                  <Text style={styles.emptyTitle}>No confirmed client payments yet</Text>
                  <Text style={styles.emptyText}>
                    Paid booking requests and their held or credited amounts will appear here.
                  </Text>
                </View>
              )}
            </View>

            {!isWide ? (
              <PayoutDestination
                account={payoutAccount}
                currency={value.currency}
                nextPayoutDate={value.nextPayoutDate}
                onManage={() => setIsAccountModalVisible(true)}
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
                onManage={() => setIsAccountModalVisible(true)}
              />
              <PayoutNotice />
            </View>
          ) : null}
        </View>

        {!isWide ? <PayoutNotice /> : null}
      </ScrollView>
      <PayoutAccountModal
        account={payoutAccount}
        isSaving={isSavingPayoutAccount}
        onClose={() => setIsAccountModalVisible(false)}
        onSave={async (accountValue) => (await onSavePayoutAccount?.(accountValue)) ?? false}
        visible={isAccountModalVisible}
      />
    </View>
  )
}

const PayoutAccountModal = ({
  account,
  isSaving,
  onClose,
  onSave,
  visible,
}: {
  account: PayoutAccount | null
  isSaving: boolean
  onClose: () => void
  onSave: (value: PayoutAccountInput) => Promise<boolean>
  visible: boolean
}) => {
  const [accountType, setAccountType] = React.useState<'bank_transfer' | 'e_wallet'>(
    account?.accountType ?? 'bank_transfer'
  )
  const [institutionName, setInstitutionName] = React.useState(account?.bankName ?? '')
  const [accountName, setAccountName] = React.useState(account?.accountName ?? '')
  const [accountNumber, setAccountNumber] = React.useState('')
  const [confirmOwnership, setConfirmOwnership] = React.useState(false)

  React.useEffect(() => {
    if (!visible) return
    setAccountType(account?.accountType ?? 'bank_transfer')
    setInstitutionName(account?.bankName ?? '')
    setAccountName(account?.accountName ?? '')
    setAccountNumber('')
    setConfirmOwnership(false)
  }, [account, visible])

  const canSave =
    institutionName.trim().length >= 2 &&
    accountName.trim().length >= 2 &&
    accountNumber.replace(/\s/g, '').length >= 4 &&
    confirmOwnership &&
    !isSaving

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>
                {account ? 'Update payout account' : 'Add payout account'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Enter the account that should receive your approved payouts.
              </Text>
            </View>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose}>
              <Text style={styles.modalClose}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>ACCOUNT TYPE</Text>
          <View style={styles.accountTypeRow}>
            {([
              ['bank_transfer', 'Bank account'],
              ['e_wallet', 'E-wallet'],
            ] as const).map(([id, label]) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: accountType === id }}
                key={id}
                onPress={() => setAccountType(id)}
                style={[
                  styles.accountTypeButton,
                  accountType === id && styles.accountTypeButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.accountTypeText,
                    accountType === id && styles.accountTypeTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>
            {accountType === 'e_wallet' ? 'E-WALLET PROVIDER' : 'BANK NAME'}
          </Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setInstitutionName}
            placeholder={accountType === 'e_wallet' ? 'Example: GCash' : 'Example: BDO Unibank'}
            placeholderTextColor={palette.muted}
            style={styles.accountInput}
            value={institutionName}
          />
          <Text style={styles.inputLabel}>ACCOUNT NAME</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setAccountName}
            placeholder="Name registered on the account"
            placeholderTextColor={palette.muted}
            style={styles.accountInput}
            value={accountName}
          />
          <Text style={styles.inputLabel}>ACCOUNT NUMBER</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setAccountNumber}
            placeholder={account ? `Re-enter account ending in ${account.accountNumberLast4}` : 'Account number'}
            placeholderTextColor={palette.muted}
            style={styles.accountInput}
            value={accountNumber}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmOwnership }}
            onPress={() => setConfirmOwnership((current) => !current)}
            style={styles.confirmationRow}
          >
            <View style={[styles.checkbox, confirmOwnership && styles.checkboxChecked]}>
              {confirmOwnership ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.confirmationText}>
              I confirm this payout account belongs to me or my registered business.
            </Text>
          </Pressable>

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityState={{ busy: isSaving, disabled: !canSave }}
              disabled={!canSave}
              onPress={async () => {
                const saved = await onSave({
                  accountName: accountName.trim(),
                  accountNumber: accountNumber.trim(),
                  accountType,
                  confirmOwnership,
                  institutionName: institutionName.trim(),
                })
                if (saved) onClose()
              }}
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save account'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

const PaymentConfirmationCard = ({
  confirmation,
  currency,
  last,
}: {
  confirmation: ProviderPaymentConfirmation
  currency: string
  last: boolean
}) => {
  const [expanded, setExpanded] = React.useState(false)

  return (
  <View style={[styles.confirmationCard, !last && styles.confirmationCardBorder]}>
    <Pressable
      accessibilityLabel={`${expanded ? 'Hide' : 'Show'} payment breakdown for ${confirmation.eventName}`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((current) => !current)}
      style={({ pressed }) => [styles.confirmationHeading, pressed && styles.pressedSurface]}
    >
      <View style={styles.confirmationHeadingCopy}>
        <Text numberOfLines={1} style={styles.confirmationEvent}>{confirmation.eventName}</Text>
        <Text numberOfLines={1} style={styles.confirmationService}>{confirmation.serviceName}</Text>
        <Text style={styles.confirmationEventStatus}>
          Event status: {confirmation.eventStatus.replace(/\b\w/g, (letter) => letter.toUpperCase())}
        </Text>
      </View>
      <View style={styles.confirmationHeadingAction}>
        <View style={styles.fundsBadge}>
          <Text style={styles.fundsBadgeText}>{confirmation.fundsStatus.toUpperCase()}</Text>
        </View>
        <Text style={styles.confirmationChevron}>{expanded ? '\u2303' : '\u2304'}</Text>
      </View>
    </Pressable>
    {expanded ? (
    <View style={styles.confirmationBreakdown}>
    <View style={styles.confirmationAmounts}>
      <ConfirmationAmount
        currency={currency}
        label="SERVICE AMOUNT"
        value={confirmation.serviceAmount}
      />
      <ConfirmationAmount
        currency={currency}
        label="INITIAL PROVIDER SHARE"
        value={confirmation.initialProviderShare}
      />
      <ConfirmationAmount
        currency={currency}
        label="REMAINING SERVICE BALANCE"
        value={confirmation.remainingServiceBalance}
      />
    </View>
    <Text style={styles.accountBreakdownLabel}>MULTIVENT ACCOUNT BREAKDOWN</Text>
    <View style={styles.confirmationAmounts}>
      <ConfirmationAmount currency={currency} label="AMOUNT EARNED" value={confirmation.amountEarned} />
      <ConfirmationAmount currency={currency} label="AMOUNT HELD" value={confirmation.amountHeld} />
    </View>
    <View style={styles.confirmationStatuses}>
      <Text style={styles.confirmationStatusText}>{confirmation.paymentStatus}</Text>
      <Text style={styles.confirmationStatusDot}>•</Text>
      <Text style={styles.confirmationStatusText}>{confirmation.balanceStatus}</Text>
      <Text style={styles.confirmationStatusDot}>•</Text>
      <Text style={styles.confirmationStatusText}>{confirmation.payoutStatus}</Text>
    </View>
    </View>
    ) : null}
  </View>
  )
}

const ConfirmationAmount = ({
  currency,
  label,
  value,
}: {
  currency: string
  label: string
  value: number
}) => (
  <View style={styles.confirmationAmountItem}>
    <Text style={styles.confirmationAmountLabel}>{label}</Text>
    <Text
      adjustsFontSizeToFit
      minimumFontScale={0.72}
      numberOfLines={1}
      style={styles.confirmationAmountValue}
    >
      {formatCurrency(value, currency)}
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
          <Text style={styles.verifiedBadgeText}>CONFIRMED</Text>
        </View>
      ) : null}
    </View>

    {account ? (
      <View style={styles.bankAccount}>
        <View style={styles.bankIcon}>
          <Text style={styles.bankIconText}>{account.accountType === 'e_wallet' ? 'E' : 'B'}</Text>
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
        Your eligible initial share becomes available after the client payment is confirmed and you
        accept the booking. Remaining service balances follow the final-payment workflow. Bank
        processing may take 1–3 business days.
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
  errorBanner: {
    borderWidth: 1,
    borderColor: '#E8B4AE',
    borderRadius: 9,
    backgroundColor: palette.errorSoft,
    padding: 12,
    marginBottom: 14,
  },
  errorBannerText: { color: palette.error, fontSize: 11, lineHeight: 17 },
  loadingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 9,
    backgroundColor: palette.surfaceContainerLow,
    padding: 12,
    marginBottom: 14,
  },
  loadingText: { color: palette.secondary, fontSize: 11, lineHeight: 17 },
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
  confirmationSection: { marginBottom: 14 },
  confirmationHeaderCopy: { minWidth: 0, flex: 1 },
  confirmationTotals: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceContainerLow,
    padding: 12,
  },
  confirmationTotalItem: { minWidth: 0, flex: 1 },
  confirmationTotalLabel: {
    color: palette.muted,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 0.45,
  },
  confirmationTotalValue: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 3,
  },
  confirmationList: { paddingHorizontal: 16 },
  confirmationCard: { paddingVertical: 14 },
  confirmationCardBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  confirmationHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  confirmationHeadingCopy: { minWidth: 0, flex: 1 },
  confirmationHeadingAction: { maxWidth: '50%', alignItems: 'flex-end', gap: 4 },
  confirmationChevron: { color: palette.secondary, fontSize: 18, lineHeight: 20, fontWeight: '700' },
  confirmationBreakdown: { paddingTop: 2 },
  confirmationEvent: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  confirmationService: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 1 },
  fundsBadge: {
    maxWidth: '48%',
    borderRadius: 999,
    backgroundColor: palette.pendingSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fundsBadgeText: {
    color: palette.pending,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '800',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  confirmationAmounts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  accountBreakdownLabel: {
    color: palette.muted,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 12,
  },
  confirmationAmountItem: {
    minWidth: 0,
    flex: 1,
    borderRadius: 7,
    backgroundColor: palette.surfaceContainerLow,
    padding: 9,
  },
  confirmationAmountLabel: {
    minHeight: 20,
    color: palette.muted,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  confirmationAmountValue: {
    color: palette.text,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 3,
  },
  confirmationStatuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  confirmationStatusText: { color: palette.secondary, fontSize: 9, lineHeight: 13 },
  confirmationStatusDot: { color: palette.muted, fontSize: 9, lineHeight: 13 },
  confirmationEventStatus: { color: palette.muted, fontSize: 9, lineHeight: 13, marginTop: 5 },
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(27, 28, 28, 0.48)',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 14,
    backgroundColor: palette.white,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  modalHeaderCopy: { minWidth: 0, flex: 1 },
  modalTitle: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  modalSubtitle: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 3 },
  modalClose: { color: palette.secondary, fontSize: 28, lineHeight: 30 },
  inputLabel: {
    color: palette.muted,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  accountTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  accountTypeButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    padding: 10,
  },
  accountTypeButtonSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primarySoft },
  accountTypeText: { color: palette.secondary, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  accountTypeTextSelected: { color: palette.primaryContainer },
  accountInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    color: palette.text,
    fontSize: 12,
    paddingHorizontal: 12,
    marginBottom: 13,
  },
  confirmationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 2 },
  checkbox: {
    width: 19,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 4,
  },
  checkboxChecked: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryContainer },
  checkboxMark: { color: palette.white, fontSize: 12, lineHeight: 15, fontWeight: '700' },
  confirmationText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 10, lineHeight: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 20 },
  cancelButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16 },
  cancelButtonText: { color: palette.secondary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  saveButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 18,
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: palette.white, fontSize: 12, lineHeight: 17, fontWeight: '700' },
})
