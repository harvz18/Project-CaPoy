import React from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

export interface ConfirmationLineItem {
  detail?: string
  id: string
  name: string
  price: number
}

export interface ConfirmationReceipt {
  currencySymbol: string
  eventDate: string
  items: ConfirmationLineItem[]
  referenceNumber: string
  serviceFee: number
}

interface ConfirmationScreenProps {
  receipt?: ConfirmationReceipt
  onBackHome?: () => void
  onViewBookings?: () => void
}

const defaultReceipt: ConfirmationReceipt = {
  referenceNumber: '#MV-2026-8821',
  eventDate: 'Oct 24, 2026',
  currencySymbol: '$',
  items: [
    {
      id: 'djPackage',
      name: 'Premium DJ Package',
      detail: '4 hours of playtime',
      price: 1200,
    },
    {
      id: 'lighting',
      name: 'Lighting Setup add-on',
      price: 350,
    },
  ],
  serviceFee: 45,
}

const formatMoney = (symbol: string, value: number) =>
  `${symbol}${Math.max(0, Math.round(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({
  receipt = defaultReceipt,
  onBackHome,
  onViewBookings,
}) => {
  const iconOpacity = React.useRef(new Animated.Value(0)).current
  const iconScale = React.useRef(new Animated.Value(0.8)).current
  const totalPaid = receipt.items.reduce((total, item) => total + item.price, 0)
    + receipt.serviceFee

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(iconOpacity, {
        duration: 500,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        damping: 12,
        stiffness: 150,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start()
  }, [iconOpacity, iconScale])

  return (
    <View style={styles.screen}>
      <View style={styles.successBanner}>
        <Animated.View
          style={[
            styles.successIconCircle,
            { opacity: iconOpacity, transform: [{ scale: iconScale }] },
          ]}
        >
          <Text style={styles.successCheck}>{'\u2713'}</Text>
        </Animated.View>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>Thank you for your booking.</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <ReceiptMeta label="Reference No." value={receipt.referenceNumber} />
            <ReceiptMeta label="Event Date" value={receipt.eventDate} />
          </View>

          <View style={styles.receiptBody}>
            {receipt.items.map((item) => (
              <View key={item.id} style={styles.lineItemGroup}>
                <View style={styles.lineItem}>
                  <Text style={styles.lineItemName}>{item.name}</Text>
                  <Text style={styles.lineItemPrice}>
                    {formatMoney(receipt.currencySymbol, item.price)}
                  </Text>
                </View>
                {item.detail && (
                  <View style={styles.itemDetail}>
                    <Text style={styles.itemDetailText}>{item.detail}</Text>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.serviceFeeRow}>
              <Text style={styles.serviceFeeText}>Service Fee</Text>
              <Text style={styles.serviceFeeText}>
                {formatMoney(receipt.currencySymbol, receipt.serviceFee)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>
                {formatMoney(receipt.currencySymbol, totalPaid)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onViewBookings}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>View My Bookings</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onBackHome}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

interface ReceiptMetaProps {
  label: string
  value: string
}

const ReceiptMeta: React.FC<ReceiptMetaProps> = ({ label, value }) => (
  <View style={styles.metaRow}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue}>{value}</Text>
  </View>
)

const palette = {
  background: '#FFFFFF',
  border: '#E3E2E2',
  burgundy: '#6B1E2E',
  muted: '#5E5E5E',
  surface: '#F9F9F9',
  surfaceContainer: '#EEEEEE',
  surfaceLow: '#F3F3F4',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  successBanner: {
    width: '100%',
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: palette.surfaceContainer,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 32,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    backgroundColor: palette.background,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  successCheck: { color: palette.burgundy, fontSize: 40, lineHeight: 44, fontWeight: '700' },
  title: {
    color: palette.burgundy,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: { color: palette.muted, fontSize: 16, lineHeight: 26, textAlign: 'center' },
  content: {
    width: '100%',
    maxWidth: 448,
    minHeight: 520,
    flexGrow: 1,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  receiptCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.background,
    marginBottom: 32,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.03,
    shadowRadius: 15,
    elevation: 2,
  },
  receiptHeader: {
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surfaceLow,
    padding: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  metaLabel: { color: palette.muted, fontSize: 16, lineHeight: 24 },
  metaValue: {
    flexShrink: 1,
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'right',
  },
  receiptBody: { padding: 20 },
  lineItemGroup: { marginBottom: 16 },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  lineItemName: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  lineItemPrice: { color: palette.text, fontSize: 16, lineHeight: 24 },
  itemDetail: {
    borderLeftWidth: 2,
    borderLeftColor: palette.border,
    paddingLeft: 14,
    marginTop: 12,
  },
  itemDetailText: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  serviceFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  serviceFeeText: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: 16 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  totalLabel: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  totalValue: { color: palette.burgundy, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  actions: { gap: 3, marginTop: 'auto' },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  primaryButtonText: { color: palette.background, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  primaryButtonPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  secondaryButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.58 },
})
