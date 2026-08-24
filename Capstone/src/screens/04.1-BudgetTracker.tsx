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

export type MerchantCategory = 'venues' | 'photography' | 'catering' | 'florists' | 'attire'
export type BudgetTrackerTab = 'home' | 'vendors' | 'planner' | 'chat'

interface BudgetTrackerScreenProps {
  remainingBudget?: number
  onOpenBudget?: () => void
  onOpenMenu?: () => void
  onOpenProfile?: () => void
  onSelectCategory?: (category: MerchantCategory) => void
  onSelectTab?: (tab: BudgetTrackerTab) => void
}

const PROFILE_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDudR_GFQ-ULKyh539LFLZ7-7iwyr9tbAaRCanoXn_RXRvDHm6ovtT4dtZOU_ALWUQM-j1x0m3EpLiOcGXV-Bpz8MDN6ehTCZk1nv6rSCJyzbPyuDoVRL1MmrMBsYVdM_j20XJosRm49XNB95u8HWAKP9H3J4ulqflbM9VySKeMebhUVkTdk03kOt5jXOrig6f1s4fTgWhGx1cDDDHSMtPe0B4h7gOTTWEPWPHgCL0iL1Nv-tiDt74GcQ'

const merchantCategories = [
  {
    id: 'venues' as const,
    title: 'Venues & Estates',
    subtitle: '',
    featured: true,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDcsG3q-fnP7YT8BoefsbQp-dsyHueshrdXDPYVSU30cc0CKsPEoEyrH7kqGV-DHCjy-dWdlW-hkOAzVwebQlrBC-0QcKZveHZHG8ljzAb5mXvNzyarrJSPRz7DRuvSol4tTtG2lObMjjD0sFK4-bJQLpGtO9R6vQjYZ3F3Bj4WMZwGY-N02BIvNED-SWAYXTHOYdIHw36Hvs_ibLOOujMX9mMhBGBSixszIl93YxJ0i_vTgECOmmZuLA',
    imageLabel: 'Luxurious wedding ballroom with chandeliers',
  },
  {
    id: 'photography' as const,
    title: 'Photography',
    subtitle: 'Capture every moment',
    featured: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC1ZIU6o-m0q6y4T4wQeXMLmoVAc9EZd1FfTiE46IJoR0_bz8RlR8qnb1nLYsv4_DvPB8OXhCtl1G4smTBFdmVmEuBJygUFyWyvNZnosGFxZeIzBkbqPbK1SOaBwnGInYFTA-V6SQzBKx2Hc-C8OaWlWG1GYcQzVT2SmHohIQK0SKGBSWpZf6Ch89DCzz_o5Wv63pUYfqCrrdqTKteTCjJiReWnKIHkhMkLpH7p3GME5EZreXJOeg2oXQ',
    imageLabel: 'Professional camera lens on marble',
  },
  {
    id: 'catering' as const,
    title: 'Catering',
    subtitle: 'Exquisite culinary experiences',
    featured: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBYIJtkALd6RZTKB793xTml6IliaeOS--YYb7nCOzBNZjzLtFYVWDdwGKaNi_mPRU62Wt5FYlQiePs93otpMlHT0Cz38RzlC3d9uE8YLt3QHL0UWZ7LIyp0KbmD3L_znUY9EmN9hQoR9B-lx0V67uiTAq-5yHzAUzVJILN2SSFLN5UQDT31rxBkUe0QDWuduZxbSt5LwtlVMwM8oiRRG1sicxmtQsmkFYNBkOwC-pbg7kcLpd-My6m3eg',
    imageLabel: 'Elegant gourmet catering plate',
  },
  {
    id: 'florists' as const,
    title: 'Florists',
    subtitle: 'Bespoke arrangements',
    featured: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAH1yFzMAgyLMN3JORx0DhYQQHFPAj422xzhrcKK6ChdPV6dm_0wrP_oDl9Wud3F6Ws72Z-cBpgyhY3teVPnpIQ2mgHrAh8W7sbZFz1FvzOb0sToO6FYRkDzvJB037uXyVHbTxArwHfkBN0XhoukCrPF-DmsRz4omO01orqJavqAoODiqwA0700gcX3zQfZI7gO7BXFuzIm6nPgFD4OOmQtKbqUJv7lmlIctJHEKtKFKCsLyttn0ZENJw',
    imageLabel: 'White and burgundy floral arrangement',
  },
  {
    id: 'attire' as const,
    title: 'Attire',
    subtitle: 'Elegance and style',
    featured: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAhOaMh7guHQRWcfJIcC56siy1CyThxFOSx7dyWh6AG-8PBqlKc_xoyX4MNRQVGxsTqI07SOOqSaAnPWyVfEsezhn5jGDzCSTrzP_KJPf53_4p93_h9ts4yBdtN6F_tO0EVIbisbn1TP21WJfuejQfbwEdWpEfNOPgr05R1vgUpl3-V2AJGmrxpqa8-KBWVbeiEDX4tAZyKo_8wc8RenWMhdYYFDzG3LsMBuKHMI2BDyqI8ih3zj7PzpA',
    imageLabel: 'Designer wedding gown and burgundy tuxedo',
  },
] as const

const navigationTabs = [
  { id: 'home' as const, icon: '⌂', label: 'Home' },
  { id: 'vendors' as const, icon: '◈', label: 'Vendors' },
  { id: 'planner' as const, icon: '▣', label: 'Planner' },
  { id: 'chat' as const, icon: '○', label: 'Chat' },
] as const

const formatCurrency = (value: number) =>
  Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const BudgetTrackerScreen: React.FC<BudgetTrackerScreenProps> = ({
  remainingBudget = 45000,
  onOpenBudget,
  onOpenMenu,
  onOpenProfile,
  onSelectCategory,
  onSelectTab,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
          {!isWide ? (
            <Pressable
              accessibilityLabel="Open menu"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onOpenMenu}
              style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
            >
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </Pressable>
          ) : null}

          <Text style={[styles.brand, isWide && styles.brandWide]}>MULTIVENT</Text>

          {isWide ? (
            <View style={styles.desktopNavigation}>
              {navigationTabs.map((tab) => {
                const isActive = tab.id === 'vendors'

                return (
                  <Pressable
                    key={tab.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => onSelectTab?.(tab.id)}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Text style={[styles.desktopNavLabel, isActive && styles.desktopNavActive]}>
                      {tab.label.toUpperCase()}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={onOpenProfile}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Image
              accessibilityLabel="User profile photo"
              source={{ uri: PROFILE_IMAGE }}
              style={styles.avatar}
            />
          </Pressable>
        </View>
      </View>

      <View style={[styles.budgetWrapper, isWide && styles.horizontalPaddingWide]}>
        <Pressable
          accessibilityLabel={`Remaining budget: ${formatCurrency(remainingBudget)} pesos`}
          accessibilityRole="button"
          onPress={onOpenBudget}
          style={({ pressed }) => [styles.budgetPill, pressed && styles.budgetPressed]}
        >
          <Text style={styles.budgetLabel}>REMAINING BUDGET</Text>
          <View style={styles.budgetValueGroup}>
            <Text style={styles.budgetValue}>₱{formatCurrency(remainingBudget)}</Text>
            <Text style={styles.budgetChevron}>⌄</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.horizontalPaddingWide : styles.horizontalPaddingMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headingSection, isWide && styles.headingSectionWide]}>
          <Text style={[styles.title, isWide && styles.titleWide]}>Find Merchants</Text>
          <Text style={styles.subtitle}>Discover premium vendors for your perfect day.</Text>
        </View>

        <View style={styles.categoryGrid}>
          {merchantCategories.map((category) => (
            <Pressable
              key={category.id}
              accessibilityLabel={`Browse ${category.title}`}
              accessibilityRole="button"
              onPress={() => onSelectCategory?.(category.id)}
              style={({ pressed }) => [
                styles.categoryCard,
                isWide &&
                  (category.featured ? styles.featuredCardWide : styles.standardCardWide),
                pressed && styles.cardPressed,
              ]}
            >
              <Image
                accessibilityLabel={category.imageLabel}
                resizeMode="cover"
                source={{ uri: category.image }}
                style={[styles.categoryImage, !category.featured && styles.standardImage]}
              />

              {category.featured ? (
                <>
                  <View style={styles.featuredTint} />
                  <View style={styles.featuredCopy}>
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeText}>FEATURED</Text>
                    </View>
                    <Text style={styles.featuredTitle}>{category.title}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.standardTint} />
                  <View style={styles.standardCopy}>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
                  </View>
                </>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {!isWide ? (
        <View style={styles.bottomNavigation}>
          {navigationTabs.map((tab) => {
            const isActive = tab.id === 'vendors'

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
  surface: '#FFFFFF',
  surfaceDim: '#DADADA',
  surfaceContainerHigh: '#E8E8E8',
  surfaceVariant: '#E2E2E2',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  white: '#FFFFFF',
  outlineVariant: '#DAC0C2',
} as const

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topAppBar: {
    zIndex: 30,
    height: 80,
    justifyContent: 'center',
    backgroundColor: palette.background,
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
  horizontalPaddingMobile: {
    paddingHorizontal: 20,
  },
  horizontalPaddingWide: {
    paddingHorizontal: 64,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 20,
  },
  menuLine: {
    width: 19,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.primary,
  },
  brand: {
    color: palette.primary,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  brandWide: {
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1,
  },
  desktopNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginLeft: 'auto',
    marginRight: 40,
  },
  desktopNavLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  desktopNavActive: {
    color: palette.primary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 20,
    backgroundColor: palette.surfaceVariant,
  },
  budgetWrapper: {
    zIndex: 20,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  budgetPill: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 27,
    backgroundColor: palette.surfaceContainerHigh,
    paddingHorizontal: 24,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  budgetLabel: {
    flexShrink: 1,
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  budgetValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetValue: {
    color: palette.primaryContainer,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  budgetChevron: {
    color: palette.secondary,
    fontSize: 17,
    lineHeight: 18,
    fontWeight: '700',
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingBottom: 112,
  },
  headingSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headingSectionWide: {
    alignItems: 'flex-start',
  },
  title: {
    color: palette.primary,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.32,
    textAlign: 'center',
    marginBottom: 8,
  },
  titleWide: {
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.96,
    textAlign: 'left',
  },
  subtitle: {
    color: palette.secondary,
    fontSize: 18,
    lineHeight: 30,
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  categoryCard: {
    width: '100%',
    height: 250,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 8,
    backgroundColor: palette.surface,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  featuredCardWide: {
    width: 'auto',
    flexBasis: '64.8%',
    flexGrow: 2,
  },
  standardCardWide: {
    width: 'auto',
    flexBasis: '30.7%',
    flexGrow: 1,
  },
  categoryImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  standardImage: {
    opacity: 0.82,
  },
  featuredTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  featuredCopy: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    left: 24,
    alignItems: 'flex-start',
  },
  featuredBadge: {
    borderRadius: 2,
    backgroundColor: 'rgba(249, 249, 249, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  featuredBadgeText: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  featuredTitle: {
    color: palette.white,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  standardTint: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 112,
    backgroundColor: 'rgba(218, 218, 218, 0.9)',
  },
  standardCopy: {
    position: 'absolute',
    right: 24,
    bottom: 22,
    left: 24,
  },
  categoryTitle: {
    color: palette.primary,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  categorySubtitle: {
    color: palette.secondary,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 4,
  },
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: 'rgba(249, 249, 249, 0.97)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 8,
  },
  navItem: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navIcon: {
    color: palette.secondary,
    fontSize: 23,
    lineHeight: 25,
    fontWeight: '400',
  },
  navLabel: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  navActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  budgetPressed: {
    backgroundColor: palette.surfaceVariant,
    transform: [{ scale: 0.995 }],
  },
  cardPressed: {
    borderColor: palette.primaryContainer,
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
})
