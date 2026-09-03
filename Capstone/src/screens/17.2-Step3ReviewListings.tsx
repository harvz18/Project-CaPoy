import React from 'react'
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import type { ServiceInformationValue } from './17-Step1ServiceListing'
import type { ServicePricingValue } from './17.1-Step2Pricing'
import type { ServicePackageValue } from './17.1.1-Step2AddPackage'

export type ReviewListingSection = 'serviceInformation' | 'pricing' | 'packages'

export interface ServiceListingReviewValue {
  information: ServiceInformationValue
  packages: ServicePackageValue[]
  pricing: ServicePricingValue
}

interface Step3ReviewListingsScreenProps {
  information?: ServiceInformationValue
  isPublishing?: boolean
  isSavingDraft?: boolean
  onBack?: () => void
  onEditSection?: (section: ReviewListingSection) => void
  onOpenAccount?: () => void
  onPublish?: (value: ServiceListingReviewValue) => void
  onSaveDraft?: (value: ServiceListingReviewValue) => void
  packages?: ServicePackageValue[]
  pricing?: ServicePricingValue
}

const previewPhotos = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCFy8GFGnTIViw3VmfkUFRVeKwOzFcHWif-q_Kwb3JfzpR9NDlXIoLCDoRuaEjvGwZYl4kSHmv5Sa523PFwWxCn4OhnwE1_QCa9GJdADSC-OikeVSFws9NRZbQBoUT1-t3Us2QiNVq0nMj205-SyZw03Bdwoa3hmPatqHJGDewBGkCXFhho3dt7H3npjzXgX2z5UDfDBXsEdTHBzP1yU7BMAU8F5pOGG0jz0bVVfwkgLNvHEZ5O6-_gVg',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDHMIA33FbC2eD9HjLEiVb0DE2NWi_IGk-fiRpBObkXzUfulMA5JIui2_4ee98h8cZKQgnU13WcdhfU4FyUestfeBTGqbAH9xrMXnAeZ4uwF_4NX0p7cTbTNKeLaB3peOMaGvZ86btR4iYNw0Eo0-DS_2TCHEKwBLDWz7AUwdHO4h_jotiGwKmmc9lemK6AfnjPKjzUzxc19Bhbu-E8DtUC6mHOoXFsotYCHZbIThwoU8NYKeCtJw4Wqw',
]

const defaultInformation: ServiceInformationValue = {
  category: 'Floral Design',
  description: 'Elegant floral styling tailored to your event theme and venue.',
  photos: previewPhotos,
  serviceName: 'Premium Floral Design',
}

const defaultPricing: ServicePricingValue = {
  amount: 2500,
  currency: 'PHP',
  details: '',
  model: 'startingAt',
  unit: 'event',
}

const defaultPackages: ServicePackageValue[] = [
  {
    currency: 'PHP',
    description: 'Essential styling for an intimate celebration.',
    id: 'essential',
    inclusions: ['Table centerpieces', 'Welcome arrangement'],
    name: 'Essential',
    price: 2500,
    unit: 'event',
  },
  {
    currency: 'PHP',
    description: 'Expanded floral styling for the ceremony and reception.',
    id: 'signature',
    inclusions: ['Ceremony florals', 'Reception centerpieces'],
    name: 'Signature',
    price: 4500,
    unit: 'event',
  },
  {
    currency: 'PHP',
    description: 'Full-service floral design and installation.',
    id: 'premium',
    inclusions: ['Full venue styling', 'Setup and breakdown'],
    name: 'Premium',
    price: 7500,
    unit: 'event',
  },
]

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const AccountIcon = () => (
  <View style={styles.accountIcon}>
    <View style={styles.accountHead} />
    <View style={styles.accountShoulders} />
  </View>
)

const PhotoPlaceholder = () => (
  <View style={styles.photoPlaceholder}>
    <View style={styles.placeholderFrame}>
      <View style={styles.placeholderSun} />
      <View style={styles.placeholderMountain} />
    </View>
    <Text style={styles.photoPlaceholderTitle}>No service photos yet</Text>
    <Text style={styles.photoPlaceholderCopy}>Edit your service information to add photos.</Text>
  </View>
)

const formatPrice = (pricing: ServicePricingValue) => {
  if (pricing.model === 'customQuote' || !pricing.amount) return 'Request a quote'

  return new Intl.NumberFormat('en-PH', {
    currency: pricing.currency,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(pricing.amount)
}

const getPriceLabel = (model: ServicePricingValue['model']) => {
  if (model === 'startingAt') return 'Starting Price'
  if (model === 'customQuote') return 'Pricing'
  return 'Service Price'
}

export const Step3ReviewListingsScreen: React.FC<Step3ReviewListingsScreenProps> = ({
  information = defaultInformation,
  isPublishing = false,
  isSavingDraft = false,
  onBack,
  onEditSection,
  onOpenAccount,
  onPublish,
  onSaveDraft,
  packages = defaultPackages,
  pricing = defaultPricing,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const previewWidth = Math.min(280, width - 40)
  const photos = information.photos.filter(Boolean)
  const previewItems: Array<string | undefined> = photos.length > 0 ? photos : [undefined]
  const [activePhotoIndex, setActivePhotoIndex] = React.useState(0)
  const reviewValue: ServiceListingReviewValue = { information, packages, pricing }
  const actionsDisabled = isPublishing || isSavingDraft

  React.useEffect(() => {
    setActivePhotoIndex((current) => Math.min(current, previewItems.length - 1))
  }, [previewItems.length])

  const handlePreviewScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / (previewWidth + 16))
    setActivePhotoIndex(Math.max(0, Math.min(nextIndex, previewItems.length - 1)))
  }

  const summaryRows: Array<{
    label: string
    section: ReviewListingSection
    value: string
  }> = [
    {
      label: 'Service Name',
      section: 'serviceInformation',
      value: information.serviceName,
    },
    {
      label: getPriceLabel(pricing.model),
      section: 'pricing',
      value: formatPrice(pricing),
    },
    {
      label: 'Total Packages',
      section: 'packages',
      value: `${packages.length} ${packages.length === 1 ? 'Configured Package' : 'Configured Packages'}`,
    },
  ]

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Go back to pricing"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <BackIcon />
          </Pressable>

          <Text style={styles.brand}>MULTIVENT</Text>

          <Pressable
            accessibilityLabel="Open account"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenAccount}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <AccountIcon />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.reviewHeader}>
          <View style={[styles.sectionContent, isWide && styles.sectionContentWide]}>
            <View style={styles.stepRow}>
              <View style={styles.stepDot} />
              <View style={styles.stepDot} />
              <View style={styles.stepActive} />
              <Text style={styles.stepLabel}>STEP 3 OF 3</Text>
            </View>
            <Text style={styles.title}>Everything Looks Good?</Text>
            <Text style={styles.subtitle}>Check your details below.</Text>
          </View>
        </View>

        <View style={styles.previewSection}>
          <View style={[styles.sectionContent, isWide && styles.sectionContentWide]}>
            <Text style={styles.sectionTitle}>Visual Preview</Text>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.previewList,
              isWide && styles.previewListWide,
            ]}
            decelerationRate="fast"
            horizontal
            onMomentumScrollEnd={handlePreviewScroll}
            showsHorizontalScrollIndicator={false}
            snapToInterval={previewWidth + 16}
          >
            {previewItems.map((photoUri, index) => (
              <View
                key={`${photoUri ?? 'empty-preview'}-${index}`}
                style={[styles.previewCard, { width: previewWidth }]}
              >
                {photoUri ? (
                  <Image
                    accessibilityLabel={
                      index === 0 ? 'Service cover photo preview' : `Service photo ${index + 1}`
                    }
                    resizeMode="cover"
                    source={{ uri: photoUri }}
                    style={styles.previewImage}
                  />
                ) : (
                  <PhotoPlaceholder />
                )}
              </View>
            ))}
          </ScrollView>

          {previewItems.length > 1 ? (
            <View style={styles.carouselDots}>
              {previewItems.map((photoUri, index) => (
                <View
                  key={`${photoUri ?? 'empty'}-${index}`}
                  style={[
                    styles.carouselDot,
                    index === activePhotoIndex && styles.carouselDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.summarySection}>
          <View style={[styles.sectionContent, isWide && styles.sectionContentWide]}>
            <Text style={styles.sectionTitle}>Data Summary</Text>
            <View style={styles.summaryCard}>
              {summaryRows.map((row, index) => (
                <Pressable
                  key={row.section}
                  accessibilityLabel={`Edit ${row.label}. Current value: ${row.value}`}
                  accessibilityRole="button"
                  onPress={() => onEditSection?.(row.section)}
                  style={({ pressed }) => [
                    styles.summaryRow,
                    index < summaryRows.length - 1 && styles.summaryRowBorder,
                    pressed && styles.summaryRowPressed,
                  ]}
                >
                  <View style={styles.summaryCopy}>
                    <Text style={styles.summaryLabel}>{row.label}</Text>
                    <Text numberOfLines={2} style={styles.summaryValue}>
                      {row.value}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{'\u203A'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.footerContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Publish service"
            accessibilityRole="button"
            accessibilityState={{ disabled: actionsDisabled }}
            disabled={actionsDisabled}
            onPress={() => onPublish?.(reviewValue)}
            style={({ pressed }) => [
              styles.publishButton,
              actionsDisabled && styles.buttonDisabled,
              pressed && styles.publishButtonPressed,
            ]}
          >
            <Text style={styles.publishButtonText}>
              {isPublishing ? 'Publishing...' : 'Publish Service'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Save service as draft"
            accessibilityRole="button"
            accessibilityState={{ disabled: actionsDisabled }}
            disabled={actionsDisabled}
            onPress={() => onSaveDraft?.(reviewValue)}
            style={({ pressed }) => [
              styles.draftButton,
              actionsDisabled && styles.buttonDisabled,
              pressed && styles.draftButtonPressed,
            ]}
          >
            <Text style={styles.draftButtonText}>
              {isSavingDraft ? 'Saving...' : 'Save as Draft'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  headerBorder: '#DAC0C2',
  onPrimary: '#FFFFFF',
  placeholder: '#C6C6C7',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5D5F5F',
  surfaceContainerLow: '#F5F3F3',
  text: '#1B1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 20,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.headerBorder,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  iconButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.7 },
  brand: {
    color: palette.primary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
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
  accountIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    borderWidth: 1.7,
    borderColor: palette.primary,
    borderRadius: 12,
  },
  accountHead: {
    position: 'absolute',
    top: 4,
    width: 7,
    height: 7,
    borderWidth: 1.5,
    borderColor: palette.primary,
    borderRadius: 4,
  },
  accountShoulders: {
    position: 'absolute',
    bottom: 3,
    width: 14,
    height: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: palette.primary,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  scrollContent: { flexGrow: 1 },
  sectionContent: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: 20 },
  sectionContentWide: { paddingHorizontal: 32 },
  reviewHeader: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
    paddingVertical: 24,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.border },
  stepActive: { width: 32, height: 8, borderRadius: 4, backgroundColor: palette.primaryContainer },
  stepLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    marginLeft: 2,
  },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  previewSection: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surfaceContainerLow,
    paddingTop: 16,
    paddingBottom: 14,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  previewList: { gap: 16, paddingHorizontal: 20, paddingBottom: 2 },
  previewListWide: { paddingHorizontal: 32 },
  previewCard: {
    height: 180,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.background,
  },
  previewImage: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  placeholderFrame: {
    width: 38,
    height: 32,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.placeholder,
    borderRadius: 3,
    marginBottom: 10,
  },
  placeholderSun: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.placeholder,
  },
  placeholderMountain: {
    position: 'absolute',
    bottom: -14,
    left: 3,
    width: 31,
    height: 31,
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: palette.placeholder,
    transform: [{ rotate: '45deg' }],
  },
  photoPlaceholderTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  photoPlaceholderCopy: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  carouselDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  carouselDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.border },
  carouselDotActive: { backgroundColor: palette.primaryContainer },
  summarySection: { flex: 1, backgroundColor: palette.background, paddingVertical: 24 },
  summaryCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.background,
  },
  summaryRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 16,
  },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  summaryRowPressed: { backgroundColor: palette.surfaceContainerLow },
  summaryCopy: { minWidth: 0, flex: 1 },
  summaryLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginBottom: 4 },
  summaryValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  chevron: { color: palette.secondary, fontSize: 30, lineHeight: 32, fontWeight: '300' },
  footer: {
    zIndex: 30,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
  },
  footerContent: {
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  publishButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  publishButtonPressed: { opacity: 0.8 },
  publishButtonText: { color: palette.onPrimary, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  draftButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  draftButtonPressed: { backgroundColor: palette.surfaceContainerLow },
  draftButtonText: { color: palette.primaryContainer, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  buttonDisabled: { opacity: 0.55 },
})
