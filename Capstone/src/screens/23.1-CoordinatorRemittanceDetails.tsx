import { Text } from '../components/AppText'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import type { CoordinatorRemittanceDetails } from '../lib/coordinator'

interface CoordinatorRemittanceDetailsScreenProps {
  data: CoordinatorRemittanceDetails
  errorMessage?: string
  isLoading?: boolean
  isRefreshing?: boolean
  onBack?: () => void
  onRefresh?: () => void
}

const money = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(amount)

const dateTime = (value?: string) => {
  if (!value) return 'Not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? 'Not recorded'
    : new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed)
}

const humanize = (value: string) => value.replaceAll('_', ' ')

export const CoordinatorRemittanceDetailsScreen: React.FC<
  CoordinatorRemittanceDetailsScreenProps
> = ({ data, errorMessage, isLoading = false, isRefreshing = false, onBack, onRefresh }) => (
  <View style={styles.screen}>
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Back to notifications"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.backButton}
      >
        <Text style={styles.backGlyph}>{'\u2039'}</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.headerTitle}>Remittance details</Text>
      <View style={styles.headerSpacer} />
    </View>

    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={palette.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.muted}>Loading the recorded remittance...</Text>
        </View>
      ) : null}

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>EVENT CASH HANDOFF</Text>
        <Text style={styles.title}>{data.event.name}</Text>
        <Text style={styles.subtitle}>
          {data.event.eventDate ? dateTime(`${data.event.eventDate}T00:00:00`) : 'Event date unavailable'}
        </Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL RECEIVED BY MULTIVENT</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.totalValue}>
          {money(data.summary.amountReceived)}
        </Text>
        <View style={styles.totalMeta}>
          <View>
            <Text style={styles.metaLabel}>SERVICES</Text>
            <Text style={styles.metaValue}>{data.summary.serviceCount}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>RECORDED</Text>
            <Text style={styles.metaValue}>{dateTime(data.summary.recordedAt)}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>STATUS</Text>
            <Text style={styles.metaValue}>{humanize(data.summary.status)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Service breakdown</Text>
      {data.breakdown.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No remittance items found</Text>
          <Text style={styles.muted}>Pull down to refresh after the Assistant records the handoff.</Text>
        </View>
      ) : data.breakdown.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemTitle}>{item.serviceName}</Text>
              <Text style={styles.muted}>{item.providerName}</Text>
            </View>
            <Text style={styles.itemAmount}>{money(item.amountReceived)}</Text>
          </View>
          <View style={styles.itemGrid}>
            <View>
              <Text style={styles.metaLabel}>EXPECTED</Text>
              <Text style={styles.itemMetaValue}>{money(item.amountExpected)}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>RECORDED BY</Text>
              <Text style={styles.itemMetaValue}>{item.recordedBy}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>REFERENCE</Text>
              <Text style={styles.itemMetaValue}>{item.referenceNumber || 'No reference'}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>STATUS</Text>
              <Text style={styles.itemMetaValue}>{humanize(item.status)}</Text>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Each service remains a separate accounting record even though the handoff is shown as one event total.
        </Text>
      </View>
    </ScrollView>
  </View>
)

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  error: '#BA1A1A',
  muted: '#777879',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  positive: '#2F6B46',
  text: '#1B1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingHorizontal: 16,
  },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { color: palette.primary, fontSize: 34, lineHeight: 36 },
  headerTitle: { flex: 1, color: palette.primary, fontSize: 19, lineHeight: 25, fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 42 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  error: { color: palette.error, borderRadius: 8, backgroundColor: '#FCEDEB', padding: 12, marginBottom: 14 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  intro: { marginBottom: 18 },
  eyebrow: { color: palette.primaryContainer, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 1.1 },
  title: { color: palette.text, fontSize: 23, lineHeight: 30, fontWeight: '700', marginTop: 3 },
  subtitle: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  totalCard: { borderRadius: 14, backgroundColor: palette.primary, padding: 20, marginBottom: 22 },
  totalLabel: { color: '#E4C9D0', fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.8 },
  totalValue: { color: palette.white, fontSize: 32, lineHeight: 40, fontWeight: '700', marginTop: 4 },
  totalMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.16)', paddingTop: 14, marginTop: 15 },
  metaLabel: { color: palette.muted, fontSize: 8, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5 },
  metaValue: { color: palette.white, fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  sectionTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700', marginBottom: 10 },
  itemCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 11, backgroundColor: palette.white, padding: 15, marginBottom: 10 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemCopy: { minWidth: 0, flex: 1 },
  itemTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  itemAmount: { color: palette.positive, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12, marginTop: 12 },
  itemMetaValue: { color: palette.text, fontSize: 9, lineHeight: 14, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  muted: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 2 },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 11, backgroundColor: palette.white, padding: 24 },
  emptyTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  notice: { borderRadius: 9, backgroundColor: palette.primarySoft, padding: 13, marginTop: 6 },
  noticeText: { color: palette.primaryContainer, fontSize: 10, lineHeight: 16 },
})
