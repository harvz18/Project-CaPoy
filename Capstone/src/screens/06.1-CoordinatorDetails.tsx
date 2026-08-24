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

interface CoordinatorDetailsScreenProps {
  initialFavorite?: boolean
  onBack?: () => void
  onFavoriteChange?: (favorite: boolean) => void
  onMessage?: () => void
  onOpenPortfolioItem?: (index: number) => void
  onSelectProvider?: () => void
  onViewAllPortfolio?: () => void
}

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAMolx6TH4BhgRocxCbRjbSCatJt2aGVS3t77tVpz9d-yRzcT-D_WkXdfKEe3CDaFNGpG4PZgObbO5JsXql4j6itPO9CmSYSKNOGeiP7jSpGaaTe0l0Uirc9Iu1KAJdADR3s4KZAMufwV3pxwvav4dBeJs_GDOIiGQN9yIh6hnrDXiAy4aoLQ0gcbJcvyBbwppYZFsVI8mGsLpbm3CwAcIek3hf9RphwC8jYZhUn5QFxgu1rO-KczhqYg'

const styleTags = ['EDITORIAL', 'MINIMALIST', 'MODERN ROMANTIC', 'LUXURY']

const portfolioImages = [
  {
    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXmfrm_tnK1yG0EyXXo__lP82vnC29P8X4KqidrwxALRIsYAMfQFci4jZfV_Mj-1aPNBKuNyAarvrJ8gJY4UommSqLAwMIWz1_goWJOehssh7yXH9zj9SlxC_uwz1Vw6Oq65Juv1dqdhN89BZ_w2gor3sOCqh8pv57Q0qLHpNuOUcjRUvO_7cyQR8rRg6XDgaD2y3yX4Kf8cprr0vjMKe_0me1cZniGnPKpWoaVhYxB6KhP0xil9yLFA',
    label: 'Elegant minimalist wedding table setting',
    height: 240,
  },
  {
    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZ3ZCCOqurniDsy8dSFaEAW0U8Z29LOesektdTgd2PWofQEAJPQfVXuziI0g_NMKXEdWI7prVCq_FXYqKq6_dNXX3FjaeuMkJugQBiSGZKjWehraw6lkcSq8E7imtuS8PNV3zwVhduR_sIjgus7cM1XXGacF9vlVX6s-RSseHtV6UUfNsdskKMaA7oJu3UplyN3t-s8ie8yTEHlXRSz8wdiXwDJ6V3yOLsy8ojEqgmZRNdsY95wrtHAQ',
    label: 'Outdoor wedding ceremony beneath an ancient tree',
    height: 330,
  },
  {
    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-sa_OmYI3DxAGomZWmMK12ckMiV8GdPdr-uRuGNDSN-s0iuQ9Um4LQJyS03Utso0X9j9gIdJYwXg77RuYs9fIPprLt8nJpuvaLCsDJDHu2Uc_doi0wmgSMfxEpsGHHoDbqrFkP2lJgk0_7R96hX8RYiSa-YIE_W5_Gl0fLn3VIwBnmXc5eVr9bW32E2SVyK4rJRe0QgTeUchcwD25eXmWA0Oe6nyAzi8cFbjSaWK9vniL_S1j9TiyMQ',
    label: 'Modern burgundy wedding invitation suite',
    height: 260,
  },
  {
    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBB3WksIYzlhL1l606umeQQnZUoSUK9nG5oMmsY_1NHJOaRoFKkFwp64WdWnMuexJZ8_iZ1A_UtlOobyJ_tpocJzMqNurb20UCwEdqy1mbq_bFxmq6mdVvTyVjn75wChm4Cc1ew3oTRM64trEyXyK7W9hGXhf8Jqm0oCztRjEujHkvLdsCCaJsfWfNzTlcxhvlqMsCb5vXMQDEjjSXDzCwdDw0nJiPE9Iog1V-PxzR02Lool9Na_aZ5Sg',
    label: 'Bride and groom dancing in a modern loft',
    height: 290,
  },
] as const

const pricingItems = [
  {
    icon: '✓',
    title: 'Full Planning',
    description: 'Comprehensive design and coordination',
  },
  {
    icon: '✓',
    title: 'Partial Planning',
    description: 'Assistance concluding the final months',
  },
  {
    icon: '⌖',
    title: 'Based in New York',
    description: 'Available for travel worldwide',
  },
] as const

export const CoordinatorDetailsScreen: React.FC<CoordinatorDetailsScreenProps> = ({
  initialFavorite = true,
  onBack,
  onFavoriteChange,
  onMessage,
  onOpenPortfolioItem,
  onSelectProvider,
  onViewAllPortfolio,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [favorite, setFavorite] = React.useState(initialFavorite)

  const toggleFavorite = () => {
    const nextFavorite = !favorite
    setFavorite(nextFavorite)
    onFavoriteChange?.(nextFavorite)
  }

  const renderPortfolioImage = (index: number) => {
    const image = portfolioImages[index]

    return (
      <Pressable
        key={image.uri}
        accessibilityLabel={`Open portfolio image: ${image.label}`}
        accessibilityRole="button"
        onPress={() => onOpenPortfolioItem?.(index)}
        style={({ pressed }) => [styles.portfolioItem, pressed && styles.imagePressed]}
      >
        <Image
          accessibilityLabel={image.label}
          resizeMode="cover"
          source={{ uri: image.uri }}
          style={[styles.portfolioImage, { height: image.height }]}
        />
      </Pressable>
    )
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>

          <Text numberOfLines={1} style={styles.headerTitle}>Provider Profile</Text>

          <Pressable
            accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
            accessibilityRole="button"
            accessibilityState={{ selected: favorite }}
            hitSlop={8}
            onPress={toggleFavorite}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.favoriteIcon}>{favorite ? '♥' : '♡'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, isWide && styles.heroWide]}>
          <Image
            accessibilityLabel="Elegant wedding reception designed by Lumina Event Design"
            resizeMode="cover"
            source={{ uri: HERO_IMAGE }}
            style={styles.heroImage}
          />

          <View style={[styles.profileCardWrapper, isWide && styles.horizontalPaddingWide]}>
            <View style={[styles.profileCard, isWide && styles.profileCardWide]}>
              <View style={[styles.profileCopy, isWide && styles.profileCopyWide]}>
                <Text style={[styles.providerName, isWide && styles.providerNameWide]}>
                  Lumina Event Design
                </Text>
                <Text style={styles.providerCategory}>
                  Full-Service Wedding Planning &amp; Styling
                </Text>
              </View>

              <View style={[styles.profileRating, isWide && styles.profileRatingWide]}>
                <View style={styles.ratingRow}>
                  <Text style={styles.star}>★</Text>
                  <Text style={styles.ratingValue}>4.9</Text>
                </View>
                <Text style={styles.reviewCount}>124 REVIEWS</Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.content,
            isWide ? styles.horizontalPaddingWide : styles.horizontalPaddingMobile,
            isWide && styles.contentWide,
          ]}
        >
          <View style={styles.mainColumn}>
            <View style={styles.storySection}>
              <Text style={styles.sectionHeading}>Our Story</Text>
              <Text style={styles.storyCopy}>
                Founded in 2015 by Isabella Rossi, Lumina Event Design specializes in crafting
                narrative-driven weddings that reflect the unique personality of each couple. We
                believe in editorial minimalism—where every detail is curated, and nothing feels
                superfluous. Our approach combines meticulous organization with an intuitive sense
                of style, ensuring your celebration is both breathtaking and seamlessly executed.
                From intimate coastal elopements to grand city center galas, we transform spaces
                into experiences.
              </Text>

              <View style={styles.styleTags}>
                {styleTags.map((tag) => (
                  <View key={tag} style={styles.styleTag}>
                    <Text style={styles.styleTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.portfolioSection}>
              <View style={styles.portfolioHeader}>
                <Text style={styles.sectionHeading}>Portfolio Highlights</Text>
                <Pressable
                  accessibilityLabel="View all portfolio images"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onViewAllPortfolio}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.viewAll}>VIEW ALL</Text>
                </Pressable>
              </View>

              {isWide ? (
                <View style={styles.portfolioGrid}>
                  <View style={styles.portfolioColumn}>
                    {renderPortfolioImage(0)}
                    {renderPortfolioImage(2)}
                  </View>
                  <View style={styles.portfolioColumn}>
                    {renderPortfolioImage(1)}
                    {renderPortfolioImage(3)}
                  </View>
                </View>
              ) : (
                <View style={styles.portfolioColumn}>
                  {portfolioImages.map((_, index) => renderPortfolioImage(index))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.sidebar}>
            <View style={styles.pricingCard}>
              <Text style={styles.pricingHeading}>Pricing Guide</Text>
              <Text style={styles.startingPrice}>From $5,000</Text>

              <View style={styles.pricingList}>
                {pricingItems.map((item, index) => (
                  <View
                    key={item.title}
                    style={[
                      styles.pricingItem,
                      index < pricingItems.length - 1 && styles.pricingItemBorder,
                    ]}
                  >
                    <Text style={styles.pricingIcon}>{item.icon}</Text>
                    <View style={styles.pricingCopy}>
                      <Text style={styles.pricingTitle}>{item.title}</Text>
                      <Text style={styles.pricingDescription}>{item.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {isWide ? (
        <View style={styles.desktopActionBar}>
          <Pressable
            accessibilityLabel="Message Lumina Event Design"
            accessibilityRole="button"
            onPress={onMessage}
            style={({ pressed }) => [styles.desktopMessageButton, pressed && styles.pressed]}
          >
            <Text style={styles.messageIcon}>○</Text>
            <Text style={styles.desktopMessageText}>MESSAGE</Text>
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable
            accessibilityLabel="Select Lumina Event Design"
            accessibilityRole="button"
            onPress={onSelectProvider}
            style={({ pressed }) => [styles.desktopSelectButton, pressed && styles.selectPressed]}
          >
            <Text style={styles.desktopSelectText}>SELECT PROVIDER</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bottomNavigation}>
          <Pressable
            accessibilityLabel="Message Lumina Event Design"
            accessibilityRole="button"
            onPress={onMessage}
            style={({ pressed }) => [styles.mobileAction, pressed && styles.pressed]}
          >
            <Text style={styles.mobileMessageIcon}>○</Text>
            <Text style={styles.mobileMessageText}>Message</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Select Lumina Event Design"
            accessibilityRole="button"
            onPress={onSelectProvider}
            style={({ pressed }) => [styles.mobileSelectAction, pressed && styles.selectPressed]}
          >
            <Text style={styles.mobileSelectIcon}>✓</Text>
            <Text style={styles.mobileSelectText}>Select</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  surfaceLow: '#F3F3F4',
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
    zIndex: 50,
    height: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.outlineVariant,
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
  horizontalPaddingMobile: { paddingHorizontal: 20 },
  horizontalPaddingWide: { paddingHorizontal: 64 },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backIcon: { color: palette.secondary, fontSize: 28, lineHeight: 30 },
  favoriteIcon: { color: palette.primaryContainer, fontSize: 25, lineHeight: 27 },
  headerTitle: {
    flex: 1,
    color: palette.primary,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  scrollContent: { paddingBottom: 120 },
  hero: {
    width: '100%',
    maxWidth: 1200,
    height: 500,
    alignSelf: 'center',
    backgroundColor: palette.surfaceVariant,
    marginBottom: 72,
  },
  heroWide: { height: 600, marginBottom: 96 },
  heroImage: { width: '100%', height: '100%' },
  profileCardWrapper: {
    position: 'absolute',
    right: 0,
    bottom: -48,
    left: 0,
    paddingHorizontal: 20,
  },
  profileCard: {
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    padding: 24,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 6,
  },
  profileCardWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 32,
  },
  profileCopy: { alignItems: 'center' },
  profileCopyWide: { flex: 1, alignItems: 'flex-start' },
  providerName: {
    color: palette.text,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.32,
    textAlign: 'center',
  },
  providerNameWide: { fontSize: 42, lineHeight: 50, textAlign: 'left' },
  providerCategory: {
    color: palette.secondary,
    fontSize: 18,
    lineHeight: 30,
    textAlign: 'center',
    marginTop: 4,
  },
  profileRating: { alignItems: 'center' },
  profileRatingWide: { alignItems: 'flex-end' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { color: palette.primaryContainer, fontSize: 23, lineHeight: 25 },
  ratingValue: { color: palette.primaryContainer, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  reviewCount: { color: palette.secondary, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1, marginTop: 4 },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    gap: 56,
  },
  contentWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  mainColumn: { flex: 2, gap: 80 },
  sidebar: { flex: 1 },
  storySection: {},
  sectionHeading: { color: palette.primaryContainer, fontSize: 24, lineHeight: 32, fontWeight: '600', marginBottom: 24 },
  storyCopy: { color: palette.secondary, fontSize: 18, lineHeight: 30 },
  styleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 32 },
  styleTag: { borderWidth: 1, borderColor: palette.primaryContainer, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  styleTagText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1 },
  portfolioSection: {},
  portfolioHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  viewAll: { color: palette.secondary, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1 },
  portfolioGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  portfolioColumn: { flex: 1, gap: 16 },
  portfolioItem: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: palette.surfaceVariant,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
  },
  portfolioImage: { width: '100%' },
  imagePressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  pricingCard: {
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surfaceLowest,
    padding: 24,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  pricingHeading: { color: palette.primaryContainer, fontSize: 24, lineHeight: 32, fontWeight: '600', marginBottom: 8 },
  startingPrice: { color: palette.text, fontSize: 32, lineHeight: 40, fontWeight: '700', marginBottom: 24 },
  pricingList: {},
  pricingItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16 },
  pricingItemBorder: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant },
  pricingIcon: { width: 24, color: palette.primaryContainer, fontSize: 22, lineHeight: 25, fontWeight: '700' },
  pricingCopy: { flex: 1 },
  pricingTitle: { color: palette.text, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  pricingDescription: { color: palette.secondary, fontSize: 14, lineHeight: 21, marginTop: 2 },
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
    backgroundColor: palette.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mobileAction: { minWidth: 112, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 6 },
  mobileMessageIcon: { color: palette.secondary, fontSize: 22, lineHeight: 24 },
  mobileMessageText: { color: palette.secondary, fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  mobileSelectAction: { minWidth: 128, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: palette.primary, paddingHorizontal: 32, paddingVertical: 9 },
  mobileSelectIcon: { color: palette.white, fontSize: 20, lineHeight: 22, fontWeight: '700' },
  mobileSelectText: { color: palette.white, fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 1 },
  desktopActionBar: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 32,
    backgroundColor: palette.surfaceLowest,
    paddingHorizontal: 16,
    paddingVertical: 8,
    transform: [{ translateX: -210 }],
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 6,
  },
  desktopMessageButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  messageIcon: { color: palette.secondary, fontSize: 20, lineHeight: 22 },
  desktopMessageText: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
  actionDivider: { width: 1, height: 24, backgroundColor: palette.surfaceVariant },
  desktopSelectButton: { borderRadius: 24, backgroundColor: palette.primary, paddingHorizontal: 30, paddingVertical: 13 },
  desktopSelectText: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
  selectPressed: { backgroundColor: palette.primaryContainer, transform: [{ scale: 0.98 }] },
  pressed: { opacity: 0.55, transform: [{ scale: 0.95 }] },
})
