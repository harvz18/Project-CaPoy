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
import type { MerchantHomeTab } from './16-MerchantHome'

export type MerchantVerificationStatus = 'approved' | 'pending' | 'rejected'
export type MerchantProfileMediaTarget = 'cover' | 'logo'
export type MerchantProfileAction =
  | 'services'
  | 'packages'
  | 'availability'
  | 'operatingHours'
  | 'payouts'
  | 'reviews'
  | 'verification'
  | 'notifications'
  | 'security'
  | 'help'
  | 'terms'
  | 'logout'

export interface MerchantProfileValue {
  activeServices: number
  businessName: string
  category: string
  completedBookings: number
  contactEmail: string
  contactPhone: string
  coverImageUrl?: string
  description: string
  location: string
  logoUrl?: string
  memberSince: number
  rating: number
  reviewCount: number
  verificationStatus: MerchantVerificationStatus
}

interface MerchantProfileScreenProps {
  hasUnreadNotifications?: boolean
  isLoggingOut?: boolean
  onBack?: () => void
  onEditMedia?: (target: MerchantProfileMediaTarget) => void
  onEditProfile?: () => void
  onOpenNotifications?: () => void
  onSelectAction?: (action: MerchantProfileAction) => void
  onSelectTab?: (tab: MerchantHomeTab) => void
  onViewPublicProfile?: () => void
  profile?: Partial<MerchantProfileValue>
}

const defaultProfile: MerchantProfileValue = {
  activeServices: 4,
  businessName: 'Floral Arts',
  category: 'Floral Design & Event Styling',
  completedBookings: 86,
  contactEmail: 'hello@floralarts.ph',
  contactPhone: '+63 917 555 0184',
  description:
    'We create refined floral experiences for weddings and celebrations, combining thoughtful design, seasonal blooms, and dependable event-day service.',
  location: 'Bacolod City, Negros Occidental',
  memberSince: 2024,
  rating: 4.8,
  reviewCount: 124,
  verificationStatus: 'approved',
}

const navigationTabs: Array<{ id: MerchantHomeTab; label: string; glyph: string }> = [
  { id: 'home', label: 'Home', glyph: '\u2302' },
  { id: 'services', label: 'Services', glyph: '\u2637' },
  { id: 'bookings', label: 'Bookings', glyph: '\u25A3' },
  { id: 'messages', label: 'Messages', glyph: '\u2709' },
  { id: 'profile', label: 'Profile', glyph: '\u25CB' },
]

const accountActions: Array<{
  action: MerchantProfileAction
  glyph: string
  label: string
  subtitle: string
}> = [
  {
    action: 'notifications',
    glyph: '\u25CF',
    label: 'Notifications',
    subtitle: 'Booking, payment, and message alerts',
  },
  {
    action: 'security',
    glyph: '\u25C6',
    label: 'Security',
    subtitle: 'Password and account access',
  },
  {
    action: 'help',
    glyph: '?',
    label: 'Help & Support',
    subtitle: 'Get help with your merchant account',
  },
  {
    action: 'terms',
    glyph: '\u2263',
    label: 'Terms & Policies',
    subtitle: 'Merchant terms and privacy policy',
  },
]

const verificationLabels: Record<
  MerchantVerificationStatus,
  { label: string; message: string }
> = {
  approved: {
    label: 'Verified Business',
    message: 'Your identity and business information are verified.',
  },
  pending: {
    label: 'Verification Pending',
    message: 'Your submitted business information is being reviewed.',
  },
  rejected: {
    label: 'Verification Needs Attention',
    message: 'Update your documents to complete business verification.',
  },
}

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const BellIcon = () => (
  <View style={styles.bellIcon}>
    <View style={styles.bellBody} />
    <View style={styles.bellBase} />
  </View>
)

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'M'

export const MerchantProfileScreen: React.FC<MerchantProfileScreenProps> = ({
  hasUnreadNotifications = true,
  isLoggingOut = false,
  onBack,
  onEditMedia,
  onEditProfile,
  onOpenNotifications,
  onSelectAction,
  onSelectTab,
  onViewPublicProfile,
  profile,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const value: MerchantProfileValue = { ...defaultProfile, ...profile }
  const verification = verificationLabels[value.verificationStatus]

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <BackIcon />
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenNotifications}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <BellIcon />
            {hasUnreadNotifications ? <View style={styles.notificationBadge} /> : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHero}>
          <Pressable
            accessibilityLabel="Change business cover photo"
            accessibilityRole="button"
            onPress={() => onEditMedia?.('cover')}
            style={({ pressed }) => [styles.cover, pressed && styles.coverPressed]}
          >
            {value.coverImageUrl ? (
              <Image
                accessibilityLabel={`${value.businessName} cover photo`}
                resizeMode="cover"
                source={{ uri: value.coverImageUrl }}
                style={styles.coverImage}
              />
            ) : (
              <>
                <View style={styles.coverOrbLarge} />
                <View style={styles.coverOrbSmall} />
                <View style={styles.coverLine} />
              </>
            )}
            <View style={styles.editCoverBadge}>
              <Text style={styles.editCoverText}>Edit cover</Text>
            </View>
          </Pressable>

          <View style={styles.heroBody}>
            <Pressable
              accessibilityLabel="Change business logo"
              accessibilityRole="button"
              onPress={() => onEditMedia?.('logo')}
              style={({ pressed }) => [styles.logo, pressed && styles.logoPressed]}
            >
              {value.logoUrl ? (
                <Image
                  accessibilityLabel={`${value.businessName} logo`}
                  resizeMode="cover"
                  source={{ uri: value.logoUrl }}
                  style={styles.logoImage}
                />
              ) : (
                <Text style={styles.logoInitials}>{getInitials(value.businessName)}</Text>
              )}
              <View style={styles.editLogoBadge}>
                <Text style={styles.editLogoBadgeText}>+</Text>
              </View>
            </Pressable>

            <View style={[styles.businessHeading, isWide && styles.businessHeadingWide]}>
              <View style={styles.businessCopy}>
                <View style={styles.businessNameRow}>
                  <Text style={styles.businessName}>{value.businessName}</Text>
                  {value.verificationStatus === 'approved' ? (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedCheck}>{'\u2713'}</Text>
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.category}>{value.category}</Text>
                <View style={styles.locationRow}>
                  <View style={styles.locationPin} />
                  <Text style={styles.location}>{value.location}</Text>
                </View>
              </View>

              <View style={styles.heroActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onViewPublicProfile}
                  style={({ pressed }) => [
                    styles.previewButton,
                    pressed && styles.previewButtonPressed,
                  ]}
                >
                  <Text style={styles.previewButtonText}>View Public Profile</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onEditProfile}
                  style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
                >
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Rating" value={`${value.rating.toFixed(1)} \u2605`} accent />
          <StatCard label="Reviews" value={String(value.reviewCount)} />
          <StatCard label="Active Services" value={String(value.activeServices)} />
          <StatCard label="Completed" value={String(value.completedBookings)} />
        </View>

        <View style={[styles.profileGrid, isWide && styles.profileGridWide]}>
          <View style={styles.primaryColumn}>
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>About the Business</Text>
                <Pressable
                  accessibilityLabel="Edit business description"
                  accessibilityRole="button"
                  onPress={onEditProfile}
                  style={({ pressed }) => [styles.textButton, pressed && styles.textButtonPressed]}
                >
                  <Text style={styles.textButtonLabel}>Edit</Text>
                </Pressable>
              </View>
              <Text style={styles.description}>{value.description}</Text>
              <Text style={styles.memberSince}>MULTIVENT member since {value.memberSince}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.sectionTitle}>Business Details</Text>
                <Pressable
                  accessibilityLabel="Edit business contact details"
                  accessibilityRole="button"
                  onPress={onEditProfile}
                  style={({ pressed }) => [styles.textButton, pressed && styles.textButtonPressed]}
                >
                  <Text style={styles.textButtonLabel}>Edit</Text>
                </Pressable>
              </View>
              <ContactRow glyph="@" label="Business Email" value={value.contactEmail} />
              <ContactRow glyph="T" label="Phone Number" value={value.contactPhone} />
              <ContactRow glyph="L" label="Service Location" last value={value.location} />
            </View>
          </View>

          <View style={styles.secondaryColumn}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Manage Business</Text>
              <View style={styles.menuList}>
                <MenuRow
                  action="services"
                  glyph="\u2637"
                  label="Services"
                  onPress={onSelectAction}
                  subtitle={`${value.activeServices} active listings`}
                />
                <MenuRow
                  action="packages"
                  glyph="\u25A3"
                  label="Packages"
                  onPress={onSelectAction}
                  subtitle="Manage pricing and inclusions"
                />
                <MenuRow
                  action="availability"
                  glyph="\u25A6"
                  label="Availability"
                  onPress={onSelectAction}
                  subtitle="Update your booking calendar"
                />
                <MenuRow
                  action="operatingHours"
                  glyph="\u25F7"
                  label="Operating Hours"
                  onPress={onSelectAction}
                  subtitle="Set your weekly business schedule"
                />
                <MenuRow
                  action="payouts"
                  glyph="\u20B1"
                  label="Payouts & Earnings"
                  onPress={onSelectAction}
                  subtitle="Track income and manage payouts"
                />
                <MenuRow
                  action="reviews"
                  glyph="\u2605"
                  label="Reviews & Performance"
                  last
                  onPress={onSelectAction}
                  subtitle={`${value.reviewCount} client reviews`}
                />
              </View>
            </View>

            <Pressable
              accessibilityLabel={`${verification.label}. ${verification.message}`}
              accessibilityRole="button"
              onPress={() => onSelectAction?.('verification')}
              style={({ pressed }) => [
                styles.verificationCard,
                value.verificationStatus === 'pending' && styles.verificationCardPending,
                value.verificationStatus === 'rejected' && styles.verificationCardRejected,
                pressed && styles.verificationCardPressed,
              ]}
            >
              <View
                style={[
                  styles.verificationIcon,
                  value.verificationStatus === 'pending' && styles.verificationIconPending,
                  value.verificationStatus === 'rejected' && styles.verificationIconRejected,
                ]}
              >
                <Text style={styles.verificationIconText}>
                  {value.verificationStatus === 'approved' ? '\u2713' : '!'}
                </Text>
              </View>
              <View style={styles.verificationCopy}>
                <Text style={styles.verificationTitle}>{verification.label}</Text>
                <Text style={styles.verificationMessage}>{verification.message}</Text>
              </View>
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </Pressable>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Account & Support</Text>
              <View style={styles.menuList}>
                {accountActions.map((item, index) => (
                  <MenuRow
                    key={item.action}
                    action={item.action}
                    glyph={item.glyph}
                    label={item.label}
                    last={index === accountActions.length - 1}
                    onPress={onSelectAction}
                    subtitle={item.subtitle}
                  />
                ))}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: isLoggingOut, disabled: isLoggingOut }}
              disabled={isLoggingOut}
              onPress={() => onSelectAction?.('logout')}
              style={({ pressed }) => [
                styles.logoutButton,
                isLoggingOut && styles.logoutButtonDisabled,
                pressed && styles.logoutButtonPressed,
              ]}
            >
              <Text style={styles.logoutGlyph}>{'\u2192'}</Text>
              <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out...' : 'Log Out'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {!isWide ? (
        <View style={styles.bottomNavigation}>
          <View style={styles.bottomNavigationContent}>
            {navigationTabs.map((tab) => {
              const selected = tab.id === 'profile'
              return (
                <Pressable
                  key={tab.id}
                  accessibilityLabel={`Open ${tab.label}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectTab?.(tab.id)}
                  style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                >
                  <View style={[styles.navIconContainer, selected && styles.navIconSelected]}>
                    <Text style={[styles.navGlyph, selected && styles.navGlyphSelected]}>
                      {tab.glyph}
                    </Text>
                  </View>
                  <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>
                    {tab.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const StatCard = ({
  accent = false,
  label,
  value,
}: {
  accent?: boolean
  label: string
  value: string
}) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
)

const ContactRow = ({
  glyph,
  label,
  last = false,
  value,
}: {
  glyph: string
  label: string
  last?: boolean
  value: string
}) => (
  <View style={[styles.contactRow, !last && styles.rowBorder]}>
    <View style={styles.menuIcon}>
      <Text style={styles.menuGlyph}>{glyph}</Text>
    </View>
    <View style={styles.contactCopy}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue}>{value.trim() || 'Not provided'}</Text>
    </View>
  </View>
)

const MenuRow = ({
  action,
  glyph,
  label,
  last = false,
  onPress,
  subtitle,
}: {
  action: MerchantProfileAction
  glyph: string
  label: string
  last?: boolean
  onPress?: (action: MerchantProfileAction) => void
  subtitle: string
}) => (
  <Pressable
    accessibilityLabel={`${label}. ${subtitle}`}
    accessibilityRole="button"
    onPress={() => onPress?.(action)}
    style={({ pressed }) => [
      styles.menuRow,
      !last && styles.rowBorder,
      pressed && styles.menuRowPressed,
    ]}
  >
    <View style={styles.menuIcon}>
      <Text style={styles.menuGlyph}>{glyph}</Text>
    </View>
    <View style={styles.menuCopy}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </View>
    <Text style={styles.chevron}>{'\u203A'}</Text>
  </Pressable>
)

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  error: '#93000A',
  errorSoft: '#FFDAD6',
  onPrimary: '#FFFFFF',
  positive: '#145133',
  positiveSoft: '#E7F3EB',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerHigh: '#E9E8E8',
  surfaceContainerLow: '#F5F3F3',
  text: '#1B1C1C',
  warning: '#7A5517',
  warningSoft: '#F6E7CA',
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
    maxWidth: 1040,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  iconButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.72 },
  brand: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
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
  bellIcon: { width: 22, height: 24, alignItems: 'center' },
  bellBody: {
    position: 'absolute',
    top: 3,
    width: 16,
    height: 16,
    borderWidth: 1.7,
    borderBottomWidth: 0,
    borderColor: palette.primary,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  bellBase: { position: 'absolute', bottom: 2, width: 6, height: 2, borderRadius: 1, backgroundColor: palette.primary },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderWidth: 2,
    borderColor: palette.background,
    borderRadius: 5,
    backgroundColor: palette.primaryContainer,
  },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 112 },
  contentWide: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 56 },
  profileHero: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.white,
  },
  cover: { height: 142, overflow: 'hidden', backgroundColor: palette.primary },
  coverPressed: { opacity: 0.9 },
  coverImage: { width: '100%', height: '100%' },
  coverOrbLarge: {
    position: 'absolute',
    top: -72,
    right: -38,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: '#7B2B3A',
  },
  coverOrbSmall: {
    position: 'absolute',
    bottom: -65,
    left: 52,
    width: 155,
    height: 155,
    borderRadius: 78,
    backgroundColor: '#5C1225',
  },
  coverLine: {
    position: 'absolute',
    top: 62,
    left: -24,
    width: '78%',
    height: 1,
    backgroundColor: '#A86472',
    transform: [{ rotate: '-8deg' }],
  },
  editCoverBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(27, 28, 28, 0.66)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  editCoverText: { color: palette.onPrimary, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  heroBody: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 22 },
  logo: {
    position: 'absolute',
    top: -50,
    left: 20,
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: palette.white,
    borderRadius: 46,
    backgroundColor: palette.primarySoft,
  },
  logoPressed: { opacity: 0.85 },
  logoImage: { width: '100%', height: '100%', borderRadius: 42 },
  logoInitials: { color: palette.primaryContainer, fontSize: 26, lineHeight: 32, fontWeight: '700' },
  editLogoBadge: {
    position: 'absolute',
    right: -1,
    bottom: 3,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.white,
    borderRadius: 13,
    backgroundColor: palette.primaryContainer,
  },
  editLogoBadgeText: { color: palette.onPrimary, fontSize: 17, lineHeight: 20, fontWeight: '500' },
  businessHeading: { gap: 18 },
  businessHeadingWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  businessCopy: { minWidth: 0, flex: 1 },
  businessNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  businessName: { color: palette.text, fontSize: 24, lineHeight: 31, fontWeight: '700' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: palette.positiveSoft, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedCheck: { color: palette.positive, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  verifiedText: { color: palette.positive, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  category: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  locationPin: {
    width: 10,
    height: 13,
    borderWidth: 1.4,
    borderColor: palette.secondary,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 5,
    transform: [{ rotate: '45deg' }],
  },
  location: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 12, lineHeight: 17 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 8, paddingHorizontal: 14 },
  previewButtonPressed: { backgroundColor: palette.surfaceContainerLow },
  previewButtonText: { color: palette.secondary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  editButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: palette.primaryContainer, paddingHorizontal: 16 },
  editButtonPressed: { opacity: 0.86 },
  editButtonText: { color: palette.onPrimary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statCard: { minWidth: 115, minHeight: 74, flexBasis: '22%', flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white, padding: 12 },
  statValue: { color: palette.text, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  statValueAccent: { color: palette.primaryContainer },
  statLabel: { color: palette.secondary, fontSize: 11, lineHeight: 15, marginTop: 2 },
  profileGrid: { gap: 16, marginTop: 16 },
  profileGridWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  primaryColumn: { minWidth: 0, flex: 1.05, gap: 16 },
  secondaryColumn: { minWidth: 0, flex: 0.95, gap: 16 },
  card: { borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white, padding: 18 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  textButton: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  textButtonPressed: { backgroundColor: palette.primarySoft },
  textButtonLabel: { color: palette.primaryContainer, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  description: { color: palette.secondary, fontSize: 14, lineHeight: 21, marginTop: 12 },
  memberSince: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 14 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  contactCopy: { minWidth: 0, flex: 1 },
  contactLabel: { color: palette.secondary, fontSize: 10, lineHeight: 14 },
  contactValue: { color: palette.text, fontSize: 13, lineHeight: 19, fontWeight: '500', marginTop: 1 },
  menuList: { marginTop: 8 },
  menuRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  menuRowPressed: { backgroundColor: palette.surfaceContainerLow },
  menuIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.primarySoft },
  menuGlyph: { color: palette.primaryContainer, fontSize: 15, lineHeight: 19, fontWeight: '600' },
  menuCopy: { minWidth: 0, flex: 1 },
  menuLabel: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  menuSubtitle: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 1 },
  chevron: { color: palette.secondary, fontSize: 28, lineHeight: 30, fontWeight: '300' },
  verificationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#B9D5C2', borderRadius: 10, backgroundColor: palette.positiveSoft, padding: 15 },
  verificationCardPending: { borderColor: '#E2C58C', backgroundColor: palette.warningSoft },
  verificationCardRejected: { borderColor: '#E8A9A4', backgroundColor: palette.errorSoft },
  verificationCardPressed: { opacity: 0.75 },
  verificationIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.positive },
  verificationIconPending: { backgroundColor: palette.warning },
  verificationIconRejected: { backgroundColor: palette.error },
  verificationIconText: { color: palette.onPrimary, fontSize: 15, lineHeight: 19, fontWeight: '700' },
  verificationCopy: { minWidth: 0, flex: 1 },
  verificationTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  verificationMessage: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 2 },
  logoutButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#E8A9A4', borderRadius: 8, backgroundColor: palette.white },
  logoutButtonDisabled: { opacity: 0.5 },
  logoutButtonPressed: { backgroundColor: palette.errorSoft },
  logoutGlyph: { color: palette.error, fontSize: 18, lineHeight: 22 },
  logoutText: { color: palette.error, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  bottomNavigation: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 40, minHeight: 76, justifyContent: 'center', borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.background, paddingVertical: 6 },
  bottomNavigationContent: { width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { width: 68, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navItemPressed: { opacity: 0.55, transform: [{ scale: 0.93 }] },
  navIconContainer: { width: 50, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  navIconSelected: { backgroundColor: palette.primaryContainer },
  navGlyph: { color: palette.secondary, fontSize: 18, lineHeight: 22 },
  navGlyphSelected: { color: palette.onPrimary },
  navLabel: { color: palette.secondary, fontSize: 9, lineHeight: 13 },
  navLabelSelected: { color: palette.primaryContainer, fontWeight: '700' },
})
