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
import { ClientBottomNavigation, ClientMainTab } from '../components/ClientBottomNavigation'
import { PlanningStepIndicator } from '../components/PlanningStepIndicator'

export type SelectedServiceId = string
export type SelectedSummaryTab = ClientMainTab | 'plan' | 'guestList' | 'budget' | 'settings'

export interface SelectedSummaryService {
  category: string
  detail: string
  id: string
  imageLabel: string
  imageUrl: string
  name: string
  price: number
  status: string
}

interface SelectedSummaryScreenProps {
  budget?: number
  selectedServices?: SelectedSummaryService[]
  totalEstimatedCost?: number
  onAddService?: () => void
  onBack?: () => void
  onOpenMenu?: () => void
  onOpenProfile?: () => void
  onSelectService?: (service: SelectedServiceId) => void
  onSelectTab?: (tab: SelectedSummaryTab) => void
}

const formatCurrency = (value: number) =>
  Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const SelectedSummaryScreen: React.FC<SelectedSummaryScreenProps> = ({
  budget = 40000,
  selectedServices = [],
  totalEstimatedCost = 34500,
  onAddService,
  onBack,
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
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack ?? onOpenMenu}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>

          <Text style={styles.headerTitle}>REVIEW SERVICES</Text>

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

      <View style={[styles.stepWrapper, isWide && styles.horizontalPaddingWide]}>
        <PlanningStepIndicator currentStep={3} label="Review Services" />
      </View>

      <View style={[styles.budgetSection, isWide && styles.horizontalPaddingWide]}>
        <View style={[styles.budgetCard, isWide && styles.budgetCardWide]}>
          <View style={styles.totalCopy}>
            <Text style={styles.totalLabel}>TOTAL ESTIMATED COST</Text>
            <Text style={[styles.totalValue, isWide && styles.totalValueWide]}>
              PHP {formatCurrency(totalEstimatedCost)}
            </Text>
          </View>

          <View style={[styles.allocationBlock, isWide && styles.allocationBlockWide]}>
            <View style={styles.allocationLabels}>
              <Text style={styles.budgetLabel}>Budget: PHP {formatCurrency(budget)}</Text>
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
          {selectedServices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No services selected yet</Text>
              <Text style={styles.emptyCopy}>
                Add services from Explore and they will appear here.
              </Text>
            </View>
          ) : null}

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
                source={{ uri: service.imageUrl }}
                style={styles.serviceImage}
              />

              <View style={styles.serviceCopy}>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryIcon}>+</Text>
                  <Text style={styles.categoryLabel}>{service.category}</Text>
                </View>
                <Text style={styles.serviceName}>{service.name}</Text>

                <View style={styles.serviceFooter}>
                  <Text style={styles.serviceDetail}>{service.detail}</Text>
                  <Text style={styles.servicePrice}>PHP {formatCurrency(service.price)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.addServiceSection}>
          {selectedServices.length > 0 ? (
            <Pressable
              accessibilityLabel="Proceed"
              accessibilityRole="button"
              onPress={() => onSelectTab?.('plan')}
              style={({ pressed }) => [styles.continueButton, pressed && styles.addPressed]}
            >
              <Text style={styles.addServiceText}>Proceed</Text>
            </Pressable>
          ) : null}
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
        <ClientBottomNavigation activeTab="profile" onSelectTab={onSelectTab} />
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
  backIcon: { color: palette.primary, fontSize: 27, lineHeight: 29 },
  menuLine: {
    width: 19,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.primary,
    marginVertical: 2,
  },
  headerTitle: {
    flex: 1,
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
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
  stepWrapper: {
    zIndex: 30,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
    backgroundColor: palette.background,
  },
  budgetSection: {
    zIndex: 30,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
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
  emptyState: {
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surfaceLowest,
    padding: 32,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  emptyCopy: {
    maxWidth: 320,
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
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
  addServiceSection: { alignItems: 'center', gap: 12, paddingVertical: 64 },
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
  continueButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: palette.primary,
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
