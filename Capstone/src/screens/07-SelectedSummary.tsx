import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

export type SelectedServiceId = 'venue' | 'catering' | 'photography'
export type SelectedSummaryTab = 'plan' | 'guestList' | 'budget' | 'settings'

interface SelectedSummaryScreenProps {
  budget?: number
  totalEstimatedCost?: number
  onAddService?: () => void
  onOpenMenu?: () => void
  onOpenProfile?: () => void
  onSelectService?: (service: SelectedServiceId) => void
  onSelectTab?: (tab: SelectedSummaryTab) => void
}

const selectedServices = [
  {
    id: 'venue' as const,
    category: 'VENUE',
    icon: '⌖',
    name: 'The Grand Conservatory',
    detail: 'Oct 14, 2024',
    price: 12000,
    status: 'Confirmed',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCX-ehN8BLlOGoLq_bEhy07E7ZeMmWgegvejl2t7WtAONGw9tE3QthWUVJFOMfryiiW6kOhZ6OIwnG3C643RThpEZq4No8T_BW4gK_S0Kcr7_j2CRoHnOdSwLn1hyw2ynrFpxK9w9DAXo83S7x2vUdqXIrPyDY96Rt6LKfOnheRb2nAf284rZ122pj_HbX_fZujdcHuz0ZL6wZdEP8XWd9x-xAT_EFYO9NMFjTfSUQ5ezx6VnqoM8M48A',
    imageLabel: 'The Grand Conservatory wedding venue',
  },
  {
    id: 'catering' as const,
    category: 'CATERING',
    icon: '♨',
    name: 'Lumina Culinary Studio',
    detail: '150 Guests',
    price: 8500,
    status: 'Pending Deposit',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDFKKZ_pGWf1GNo_5rCTt3BED1-msImpIkD2qsB3PVsgS4uEZkEkObxVJWkjOnJCspuWGPnoLnYWrkoUOewMJZKL09xIA8xCWpuq5zrFVmGzq-xEAMytJgflHcUmcwGjZn3NjeqP0KBX_sIP8hj94BXNOOxgJwCa8OFjFHJD5JBxxdm9nbzjV8yyupIZ9PrrbNrAGPmKNpfRpW2TdEJ_I2CFSv9MiDt_O8vFEObVnaNFQVxetgGJZAbwA',
    imageLabel: 'Lumina Culinary Studio plated meal',
  },
  {
    id: 'photography' as const,
    category: 'PHOTOGRAPHY',
    icon: '◉',
    name: 'Aura Visuals',
    detail: '8 Hours Coverage',
    price: 4200,
    status: 'Confirmed',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDrJFtJiWJrT0olBrPJR7Ox-O0GyZkOvCCU07hfEHndctW9g2xm2W3MvVb5yxhR-lgnGprCzEhAwusqkueWJHyjkdluNAklXfSCuxcvJDPCeROyeejNxaK8UPlNrJ4wf2Jkm62iwQRJv5wPth82dcNnOeJPxWMzj8GD5DtBLTzqdXRoksUJCx1EsRm-G8tRkBCFpsKVOPgoq3DDm6IUZfPv7BvIFhcP4ktXwXEgrRg0OuwktMbNNN8G0w',
    imageLabel: 'Aura Visuals vintage wedding camera',
  },
] as const

const navigationTabs = [
  { id: 'plan' as const, icon: '▣', label: 'Plan' },
  { id: 'guestList' as const, icon: '○', label: 'Guest List' },
  { id: 'budget' as const, icon: '$', label: 'Budget' },
  { id: 'settings' as const, icon: '◈', label: 'Settings' },
] as const

const formatCurrency = (value: number) =>
  Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const SelectedSummaryScreen: React.FC<SelectedSummaryScreenProps> = ({
  budget = 40000,
  totalEstimatedCost = 34500,
  onAddService,
  onOpenMenu,
  onOpenProfile,
  onSelectService,
  onSelectTab,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const isDesktop = width >= 1024
  const allocationPercent = budget > 0
    ? Math.min(100, Math.round((totalEstimatedCost / budget) * 100))
    : 0

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
          <Pressable
            accessibilityLabel="Open menu"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenMenu}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </Pressable>

          <Text style={styles.headerTitle}>Your Event Plan</Text>

          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenProfile}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <View style={styles.profileIcon}>
              <View style={styles.profileHead} />
              <View style={styles.profileBody} />
            </View>
          </Pressable>
        </View>
      </View>

      <View style={[styles.budgetSection, isWide && styles.horizontalPaddingWide]}>
        <View style={[styles.budgetCard, isWide && styles.budgetCardWide]}>
          <View style={styles.totalCopy}>
            <Text style={styles.totalLabel}>TOTAL ESTIMATED COST</Text>
            <Text style={[styles.totalValue, isWide && styles.totalValueWide]}>
              ${formatCurrency(totalEstimatedCost)}
            </Text>
          </View>

          <View style={[styles.allocationBlock, isWide && styles.allocationBlockWide]}>
            <View style={styles.allocationLabels}>
              <Text style={styles.budgetLabel}>Budget: ${formatCurrency(budget)}</Text>
              <Text style={styles.allocatedLabel}>{allocationPercent}% Allocated</Text>
            </View>
            <View
              accessibilityLabel={`${allocationPercent} percent of budget allocated`}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: allocationPercent }}
              style={styles.progressTrack}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${allocationPercent}%` as `${number}%` },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.horizontalPaddingWide : styles.horizontalPaddingMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>Selected Services</Text>

        <View style={styles.serviceGrid}>
          {selectedServices.map((service) => (
            <Pressable
              key={service.id}
              accessibilityLabel={`Open ${service.name}, ${service.status}`}
              accessibilityRole="button"
              onPress={() => onSelectService?.(service.id)}
              style={({ pressed }) => [
                styles.serviceCard,
                isWide && styles.serviceCardTablet,
                isDesktop && styles.serviceCardDesktop,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{service.status}</Text>
              </View>

              <Image
                accessibilityLabel={service.imageLabel}
                resizeMode="cover"
                source={{ uri: service.image }}
                style={styles.serviceImage}
              />

              <View style={styles.serviceCopy}>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryIcon}>{service.icon}</Text>
                  <Text style={styles.categoryLabel}>{service.category}</Text>
                </View>
                <Text style={styles.serviceName}>{service.name}</Text>

                <View style={styles.serviceFooter}>
                  <Text style={styles.serviceDetail}>{service.detail}</Text>
                  <Text style={styles.servicePrice}>${formatCurrency(service.price)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.addServiceSection}>
          <Pressable
            accessibilityLabel="Add another service"
            accessibilityRole="button"
            onPress={onAddService}
            style={({ pressed }) => [styles.addServiceButton, pressed && styles.addPressed]}
          >
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addServiceText}>Add Service</Text>
          </Pressable>
        </View>
      </ScrollView>

      {!isWide ? (
        <View style={styles.bottomNavigation}>
          {navigationTabs.map((tab) => {
            const isActive = tab.id === 'plan'

            return (
              <Pressable
                key={tab.id}
                accessibilityLabel={`Open ${tab.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => onSelectTab?.(tab.id)}
                style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
              >
                <Text style={[styles.navIcon, isActive && styles.navActive]}>{tab.icon}</Text>
                <Text style={[styles.navLabel, isActive && styles.navActive]}>{tab.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  surfaceHigh: '#E8E8E8',
  surfaceHighest: '#E2E2E2',
  surfaceVariant: '#E2E2E2',
  surfaceLowest: '#FFFFFF',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  text: '#1A1C1C',
  white: '#FFFFFF',
  outlineVariant: '#DAC0C2',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 40,
    height: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.outlineVariant,
    backgroundColor: palette.surfaceLowest,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  horizontalPaddingMobile: { paddingHorizontal: 20 },
  horizontalPaddingWide: { paddingHorizontal: 64 },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  menuLine: {
    width: 19,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.primary,
    marginVertical: 2,
  },
  headerTitle: {
    flex: 1,
    color: palette.primary,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  profileIcon: { width: 26, height: 26, alignItems: 'center' },
  profileHead: {
    width: 9,
    height: 9,
    borderWidth: 2,
    borderColor: palette.primary,
    borderRadius: 5,
  },
  profileBody: {
    width: 21,
    height: 11,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: palette.primary,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    marginTop: 3,
  },
  budgetSection: {
    zIndex: 30,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: palette.background,
  },
  budgetCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 24,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  budgetCardWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 48,
  },
  totalCopy: { alignItems: 'center' },
  totalLabel: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  totalValue: {
    color: palette.primaryContainer,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.32,
  },
  totalValueWide: { fontSize: 48, lineHeight: 56 },
  allocationBlock: { width: '100%', marginTop: 20 },
  allocationBlockWide: { width: '50%', marginTop: 0 },
  allocationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  budgetLabel: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  allocatedLabel: {
    color: palette.primaryContainer,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: palette.surfaceHighest,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingTop: 24,
    paddingBottom: 112,
  },
  sectionHeading: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    marginBottom: 32,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  serviceCard: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surfaceLowest,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  serviceCardTablet: { width: '48%' },
  serviceCardDesktop: { width: '31%' },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 16,
    backgroundColor: palette.surfaceLowest,
    paddingHorizontal: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  serviceImage: { width: '100%', height: 192 },
  serviceCopy: { flex: 1, padding: 24 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  categoryIcon: { color: palette.primaryContainer, fontSize: 16, lineHeight: 18, fontWeight: '700' },
  categoryLabel: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  serviceName: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    marginBottom: 16,
  },
  serviceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceVariant,
    paddingTop: 16,
    marginTop: 'auto',
  },
  serviceDetail: { flex: 1, color: palette.secondary, fontSize: 16, lineHeight: 24 },
  servicePrice: { color: palette.primaryContainer, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  addServiceSection: { alignItems: 'center', paddingVertical: 64 },
  addServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 32,
    paddingVertical: 13,
  },
  addIcon: { color: palette.white, fontSize: 22, lineHeight: 24 },
  addServiceText: { color: palette.white, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
    backgroundColor: palette.surfaceLowest,
    paddingHorizontal: 8,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 8,
  },
  navItem: {
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  navIcon: { color: palette.secondary, fontSize: 20, lineHeight: 22, fontWeight: '500' },
  navLabel: { color: palette.secondary, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  navActive: { color: palette.primary, fontWeight: '700' },
  cardPressed: {
    borderColor: palette.primaryContainer,
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  addPressed: {
    backgroundColor: palette.primary,
    transform: [{ scale: 0.98 }],
  },
  pressed: { opacity: 0.55, transform: [{ scale: 0.95 }] },
})
