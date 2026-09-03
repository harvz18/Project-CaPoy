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
import { MerchantBottomNavigation } from '../components/MerchantBottomNavigation'
import type { MerchantServiceListing } from '../lib/merchant'
import type { MerchantHomeTab } from './16-MerchantHome'

interface ProviderServicesScreenProps {
  hasDraft?: boolean
  services?: MerchantServiceListing[]
  onAddService?: () => void
  onBack?: () => void
  onContinueDraft?: () => void
  onOpenAccount?: () => void
  onSelectService?: (service: MerchantServiceListing) => void
  onSelectTab?: (tab: MerchantHomeTab) => void
}

const formatPrice = (value: number) => {
  if (!value) return 'Quote based'

  return `PHP ${Math.round(value).toLocaleString('en-US')}`
}

const formatStatus = (status: string) => {
  const normalized = status.trim().toLowerCase()

  if (normalized === 'active') return 'Live'
  if (normalized === 'draft') return 'Draft'
  if (normalized === 'inactive') return 'Hidden'

  return normalized.length > 0 ? normalized : 'Draft'
}

export const ProviderServicesScreen: React.FC<ProviderServicesScreenProps> = ({
  hasDraft = false,
  services = [],
  onAddService,
  onBack,
  onContinueDraft,
  onOpenAccount,
  onSelectService,
  onSelectTab,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.widePadding]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.iconText}>{'<'}</Text>
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <Pressable
            accessibilityLabel="Open account"
            accessibilityRole="button"
            onPress={onOpenAccount}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.accountIcon}>O</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide && styles.contentWide,
          !isWide && styles.contentWithNav,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Your Services</Text>
            <Text style={styles.subtitle}>
              {services.length === 0
                ? 'Published services will appear here.'
                : `${services.length} ${services.length === 1 ? 'service' : 'services'} uploaded`}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Add service"
            accessibilityRole="button"
            onPress={onAddService}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          >
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>Add Service</Text>
          </Pressable>
        </View>

        {hasDraft ? (
          <Pressable
            accessibilityLabel="Continue saved service draft"
            accessibilityRole="button"
            onPress={onContinueDraft}
            style={({ pressed }) => [styles.draftBanner, pressed && styles.draftBannerPressed]}
          >
            <View style={styles.draftCopy}>
              <Text style={styles.draftTitle}>Unpublished draft saved</Text>
              <Text style={styles.draftText}>Continue your last service listing.</Text>
            </View>
            <Text style={styles.draftAction}>Continue</Text>
          </Pressable>
        ) : null}

        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No services uploaded yet</Text>
            <Text style={styles.emptyCopy}>
              Add a service to make it visible to clients once it is published.
            </Text>
          </View>
        ) : (
          <View style={styles.serviceList}>
            {services.map((service) => (
              <Pressable
                key={service.id}
                accessibilityLabel={`Open ${service.name}`}
                accessibilityRole="button"
                onPress={() => onSelectService?.(service)}
                style={({ pressed }) => [styles.serviceCard, pressed && styles.serviceCardPressed]}
              >
                {service.coverImageUrl ? (
                  <Image
                    accessibilityLabel={`${service.name} cover photo`}
                    resizeMode="cover"
                    source={{ uri: service.coverImageUrl }}
                    style={styles.serviceImage}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>
                      {service.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.serviceBody}>
                  <View style={styles.serviceTitleRow}>
                    <Text numberOfLines={1} style={styles.serviceName}>
                      {service.name}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        service.status === 'active' && styles.statusLive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          service.status === 'active' && styles.statusLiveText,
                        ]}
                      >
                        {formatStatus(service.status)}
                      </Text>
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.serviceDescription}>
                    {service.description || service.categoryName}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{service.categoryName}</Text>
                    <Text style={styles.metaDot}>|</Text>
                    <Text style={styles.metaText}>{formatPrice(service.basePrice)}</Text>
                    <Text style={styles.metaDot}>|</Text>
                    <Text style={styles.metaText}>
                      {service.packageCount} {service.packageCount === 1 ? 'package' : 'packages'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {!isWide ? (
        <MerchantBottomNavigation activeTab="services" onSelectTab={onSelectTab} />
      ) : null}
    </View>
  )
}

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  muted: '#5D5F5F',
  primary: '#6B1E2E',
  surface: '#FFFFFF',
  surfaceLow: '#F5F3F3',
  text: '#1B1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#DAC0C2',
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
  widePadding: { paddingHorizontal: 32 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  pressed: { backgroundColor: palette.surfaceLow, opacity: 0.72 },
  iconText: {
    color: palette.primary,
    fontSize: 34,
    lineHeight: 38,
  },
  accountIcon: {
    color: palette.primary,
    fontSize: 24,
    lineHeight: 28,
  },
  brand: {
    color: '#4E061A',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 28,
  },
  contentWide: { paddingHorizontal: 32, paddingTop: 28 },
  contentWithNav: { paddingBottom: 112 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 18,
  },
  headerCopy: { minWidth: 0, flex: 1 },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  addButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
  },
  addButtonPressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  addIcon: {
    color: palette.surface,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  addText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  draftBanner: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderColor: '#D8B9BE',
    borderRadius: 8,
    backgroundColor: '#FFF8F9',
    padding: 16,
    marginBottom: 18,
  },
  draftBannerPressed: { opacity: 0.82 },
  draftCopy: { minWidth: 0, flex: 1 },
  draftTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  draftText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  draftAction: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.surface,
    padding: 24,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  emptyCopy: {
    maxWidth: 320,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  serviceList: { gap: 12 },
  serviceCard: {
    minHeight: 118,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.surface,
  },
  serviceCardPressed: { opacity: 0.84 },
  serviceImage: { width: 104, minHeight: 118 },
  imagePlaceholder: {
    width: 104,
    minHeight: 118,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceLow,
  },
  imagePlaceholderText: {
    color: palette.primary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  serviceBody: {
    minWidth: 0,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serviceName: {
    minWidth: 0,
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  statusPill: {
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusLive: { backgroundColor: '#EAF6EE' },
  statusText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  statusLiveText: { color: '#176339' },
  serviceDescription: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  metaDot: {
    color: '#B3A4A6',
    fontSize: 12,
    lineHeight: 17,
  },
})
