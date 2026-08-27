import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

export type LedgerTransactionStatus = 'fullyPaid' | 'depositPaid' | 'refunded'

export interface LedgerCategory {
  amount: number
  color: string
  id: string
  label: string
}

export interface LedgerTransaction {
  amount: number
  category: string
  date: string
  id: string
  merchant: string
  status: LedgerTransactionStatus
}

interface EventLedgerScreenProps {
  budget?: number
  categories?: LedgerCategory[]
  transactions?: LedgerTransaction[]
  onBack?: () => void
  onExportPdf?: () => void
  onShare?: () => void
  onViewAll?: () => void
}

const defaultCategories: LedgerCategory[] = [
  { id: 'venue', label: 'Venue', amount: 5000, color: '#6B1E2E' },
  { id: 'catering', label: 'Catering', amount: 2400, color: '#994251' },
  { id: 'photography', label: 'Photography', amount: 1050, color: '#DAC0C2' },
]

const defaultTransactions: LedgerTransaction[] = [
  {
    id: 'eliteCatering',
    merchant: 'Elite Catering',
    category: 'Catering',
    amount: 2400,
    date: 'Oct 12, 2023',
    status: 'fullyPaid',
  },
  {
    id: 'grandBallroom',
    merchant: 'Grand Ballroom',
    category: 'Venue',
    amount: 5000,
    date: 'Oct 10, 2023',
    status: 'depositPaid',
  },
  {
    id: 'luminaVisuals',
    merchant: 'Lumina Visuals',
    category: 'Photography',
    amount: 1050,
    date: 'Oct 05, 2023',
    status: 'refunded',
  },
]

const formatCurrency = (value: number) =>
  `$${Math.max(0, Math.round(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

export const EventLedgerScreen: React.FC<EventLedgerScreenProps> = ({
  budget = 15000,
  categories = defaultCategories,
  transactions = defaultTransactions,
  onBack,
  onExportPdf,
  onShare,
  onViewAll,
}) => {
  const totalSpent = categories.reduce((total, category) => total + category.amount, 0)
  const remaining = Math.max(0, budget - totalSpent)
  const allocatedPercent = budget > 0
    ? Math.min(100, Math.round((totalSpent / budget) * 100))
    : 0
  const legendItems = [
    ...categories,
    {
      id: 'unallocated',
      label: 'Unallocated',
      amount: remaining,
      color: palette.chartTrack,
    },
  ]

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <View style={styles.topAppBar}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Event Ledger</Text>
          <Pressable
            accessibilityLabel="Share event ledger"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onShare}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.shareIcon}>{'\u21E7'}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <SummaryAmount label="TOTAL BUDGET" value={formatCurrency(budget)} />
              <SummaryAmount
                alignRight
                label="TOTAL SPENT"
                value={formatCurrency(totalSpent)}
              />
            </View>
            <View style={styles.remainingBlock}>
              <Text style={styles.summaryLabel}>REMAINING</Text>
              <Text style={styles.remainingAmount}>{formatCurrency(remaining)}</Text>
            </View>
            <View
              accessibilityLabel={`${allocatedPercent}% of the budget allocated`}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: allocatedPercent }}
              style={styles.progressTrack}
            >
              <View style={[styles.progressFill, { width: `${allocatedPercent}%` }]} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending by Category</Text>
            <View style={styles.chartArea}>
              <DonutChart
                allocatedPercent={allocatedPercent}
                budget={budget}
                categories={categories}
                remaining={remaining}
              />
              <View style={styles.legend}>
                {legendItems.map((item) => (
                  <View key={item.id} style={styles.legendRow}>
                    <View style={styles.legendLabelGroup}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendLabel}>{item.label.toUpperCase()}</Text>
                    </View>
                    <Text
                      style={[
                        styles.legendValue,
                        item.id === 'unallocated' && styles.legendValueMuted,
                      ]}
                    >
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.transactionsSection}>
            <View style={styles.transactionsHeader}>
              <Text style={styles.sectionTitle}>Transactions</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onViewAll}
                style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}
              >
                <Text style={styles.viewAllText}>VIEW ALL</Text>
              </Pressable>
            </View>
            <View style={styles.transactionList}>
              {transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={onExportPdf}
            style={({ pressed }) => [
              styles.exportButton,
              pressed && styles.exportButtonPressed,
            ]}
          >
            <View style={styles.pdfIcon}>
              <Text style={styles.pdfIconText}>PDF</Text>
            </View>
            <Text style={styles.exportButtonText}>Export as PDF</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

interface SummaryAmountProps {
  alignRight?: boolean
  label: string
  value: string
}

const SummaryAmount: React.FC<SummaryAmountProps> = ({
  alignRight = false,
  label,
  value,
}) => (
  <View style={alignRight && styles.alignRight}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryAmount, alignRight && styles.spentAmount]}>{value}</Text>
  </View>
)

interface DonutChartProps {
  allocatedPercent: number
  budget: number
  categories: LedgerCategory[]
  remaining: number
}

const DonutChart: React.FC<DonutChartProps> = ({
  allocatedPercent,
  budget,
  categories,
  remaining,
}) => {
  const segmentCount = 72
  const radius = 78
  const center = 96
  const chartValues = [...categories.map((category) => category.amount), remaining]
  const chartColors = [...categories.map((category) => category.color), palette.chartTrack]

  return (
    <View
      accessibilityLabel={`Budget chart, ${allocatedPercent}% allocated`}
      accessibilityRole="image"
      style={styles.donut}
    >
      {Array.from({ length: segmentCount }, (_, index) => {
        const amountAtSegment = ((index + 0.5) / segmentCount) * budget
        let cumulative = 0
        let color: string = palette.chartTrack

        for (let valueIndex = 0; valueIndex < chartValues.length; valueIndex += 1) {
          cumulative += chartValues[valueIndex]
          if (amountAtSegment <= cumulative) {
            color = chartColors[valueIndex]
            break
          }
        }

        const angle = (index / segmentCount) * 360 - 90
        const radians = (angle * Math.PI) / 180

        return (
          <View
            key={index}
            style={[
              styles.donutSegment,
              {
                backgroundColor: color,
                left: center + radius * Math.cos(radians) - 3,
                top: center + radius * Math.sin(radians) - 9,
                transform: [{ rotate: `${angle + 90}deg` }],
              },
            ]}
          />
        )
      })}
      <View style={styles.donutCenter}>
        <Text style={styles.donutLabel}>ALLOCATED</Text>
        <Text style={styles.donutValue}>{allocatedPercent}%</Text>
      </View>
    </View>
  )
}

interface TransactionCardProps {
  transaction: LedgerTransaction
}

const statusLabels: Record<LedgerTransactionStatus, string> = {
  fullyPaid: 'FULLY PAID',
  depositPaid: 'DEPOSIT PAID',
  refunded: 'REFUNDED',
}

const TransactionCard: React.FC<TransactionCardProps> = ({ transaction }) => (
  <View style={styles.transactionCard}>
    <View style={styles.transactionHeading}>
      <View style={styles.transactionCopy}>
        <Text style={styles.transactionMerchant}>{transaction.merchant}</Text>
        <Text style={styles.transactionCategory}>{transaction.category.toUpperCase()}</Text>
      </View>
      <View style={styles.transactionAmountGroup}>
        <Text style={styles.transactionAmount}>{formatCurrency(transaction.amount)}</Text>
        <Text style={styles.transactionDate}>{transaction.date.toUpperCase()}</Text>
      </View>
    </View>
    <View
      style={[
        styles.statusBadge,
        transaction.status === 'fullyPaid' && styles.statusBadgePaid,
        transaction.status === 'depositPaid' && styles.statusBadgeDeposit,
        transaction.status === 'refunded' && styles.statusBadgeRefunded,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          transaction.status === 'fullyPaid' && styles.statusTextPaid,
          transaction.status === 'refunded' && styles.statusTextRefunded,
        ]}
      >
        {statusLabels[transaction.status]}
      </Text>
    </View>
  </View>
)

const palette = {
  background: '#F3F3F4',
  border: '#DAC0C2',
  burgundy: '#6B1E2E',
  burgundyDark: '#4E061A',
  chartTrack: '#E8E8E8',
  muted: '#5E5E5E',
  surface: '#F9F9F9',
  surfaceVariant: '#E2E2E2',
  text: '#1A1C1C',
  tint: '#994251',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', backgroundColor: palette.background },
  panel: {
    width: '100%',
    maxWidth: 480,
    flex: 1,
    backgroundColor: palette.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  topAppBar: {
    zIndex: 50,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 20,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  backIcon: { color: palette.burgundyDark, fontSize: 26, lineHeight: 29 },
  shareIcon: { color: palette.burgundy, fontSize: 24, lineHeight: 27, fontWeight: '600' },
  headerTitle: { color: palette.burgundyDark, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  summaryCard: { gap: 16, borderRadius: 12, backgroundColor: palette.surfaceVariant, padding: 20 },
  summaryTopRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(218,192,194,0.35)', paddingBottom: 16 },
  alignRight: { alignItems: 'flex-end' },
  summaryLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1, marginBottom: 4 },
  summaryAmount: { color: palette.burgundy, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  spentAmount: { opacity: 0.8 },
  remainingBlock: { alignItems: 'center', paddingTop: 8 },
  remainingAmount: { color: palette.burgundy, fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.3 },
  progressTrack: { width: '100%', height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: palette.chartTrack, marginTop: 2 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: palette.burgundy },
  section: { gap: 24, marginTop: 32 },
  sectionTitle: { color: palette.burgundyDark, fontSize: 18, lineHeight: 28, fontWeight: '600' },
  chartArea: { alignItems: 'center', gap: 28 },
  donut: { width: 192, height: 192, position: 'relative' },
  donutSegment: { position: 'absolute', width: 6, height: 18, borderRadius: 3 },
  donutCenter: {
    position: 'absolute',
    top: 34,
    right: 34,
    bottom: 34,
    left: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 62,
    backgroundColor: palette.surface,
  },
  donutLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1 },
  donutValue: { color: palette.burgundy, fontSize: 18, lineHeight: 28, fontWeight: '700' },
  legend: { width: '100%', gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  legendLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1 },
  legendValue: { color: palette.burgundy, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  legendValueMuted: { color: palette.muted },
  transactionsSection: { marginTop: 32, paddingBottom: 32 },
  transactionsHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  viewAllButton: { minHeight: 32, justifyContent: 'center' },
  viewAllText: { color: palette.burgundy, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1 },
  transactionList: { gap: 12 },
  transactionCard: { gap: 12, borderWidth: 1, borderColor: 'rgba(218,192,194,0.2)', borderRadius: 8, backgroundColor: palette.surfaceVariant, padding: 16 },
  transactionHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  transactionCopy: { flex: 1 },
  transactionMerchant: { color: palette.burgundyDark, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  transactionCategory: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1, marginTop: 4 },
  transactionAmountGroup: { alignItems: 'flex-end' },
  transactionAmount: { color: palette.burgundy, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  transactionDate: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7, marginTop: 4 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgePaid: { backgroundColor: palette.burgundy },
  statusBadgeDeposit: { backgroundColor: '#E2E2E2' },
  statusBadgeRefunded: { borderWidth: 1, borderColor: palette.burgundy, backgroundColor: 'transparent' },
  statusText: { color: palette.muted, fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.6 },
  statusTextPaid: { color: palette.white },
  statusTextRefunded: { color: palette.burgundy },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 40, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: 'rgba(249,249,249,0.96)', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  exportButton: { width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: palette.burgundy, borderRadius: 8, backgroundColor: palette.surface, paddingHorizontal: 20 },
  exportButtonPressed: { backgroundColor: '#F8F1F3', transform: [{ scale: 0.98 }] },
  pdfIcon: { width: 25, height: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.burgundy, borderRadius: 3 },
  pdfIconText: { color: palette.burgundy, fontSize: 7, lineHeight: 9, fontWeight: '800' },
  exportButtonText: { color: palette.burgundy, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  pressed: { opacity: 0.58 },
})
