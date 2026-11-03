import { MaterialIcons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import React from 'react'
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { formatServicePrice, type CatalogService } from '../lib/catalog'
import type { ProviderBusinessRating } from '../lib/provider-business'
import { Text } from './AppText'

interface BusinessProfileOverlayProps {
  blurTarget?: React.RefObject<React.ComponentRef<typeof View> | null>
  isRatingLoading?: boolean
  onClose: () => void
  onSelectService: (service: CatalogService) => void
  provider: CatalogService
  rating: ProviderBusinessRating
  services: CatalogService[]
}

/**
 * Client-facing business detail presentation. It intentionally mirrors the
 * established ServiceProfileOverlay instead of introducing a separate route.
 */
export const BusinessProfileOverlay: React.FC<BusinessProfileOverlayProps> = ({
  blurTarget,
  isRatingLoading = false,
  onClose,
  onSelectService,
  provider,
  rating,
  services,
}) => {
  const [isClosing, setIsClosing] = React.useState(false)
  const popupScale = React.useRef(new Animated.Value(0.9)).current

  React.useEffect(() => {
    popupScale.setValue(0.9)
    const animation = Animated.sequence([
      Animated.timing(popupScale, {
        toValue: 1.025,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(popupScale, {
        toValue: 1,
        friction: 6,
        tension: 130,
        useNativeDriver: true,
      }),
    ])
    animation.start()
    return () => animation.stop()
  }, [popupScale])

  const dismissOverlay = () => {
    if (isClosing) return
    setIsClosing(true)
    popupScale.stopAnimation()
    Animated.sequence([
      Animated.timing(popupScale, { toValue: 1.02, duration: 80, useNativeDriver: true }),
      Animated.timing(popupScale, {
        toValue: 0.9,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose()
    })
  }

  const chooseService = (service: CatalogService) => {
    if (isClosing) return
    onSelectService(service)
  }

  const ratingText = isRatingLoading
    ? 'Loading rating…'
    : rating.reviewCount > 0 && rating.averageRating
      ? `${rating.averageRating.toFixed(1)} (${rating.reviewCount} rating${rating.reviewCount === 1 ? '' : 's'})`
      : 'Not Yet Rated'

  return (
    <View pointerEvents={isClosing ? 'none' : 'auto'} style={styles.modalOverlay}>
      <BlurView
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={1}
        blurTarget={blurTarget}
        intensity={42}
        tint="dark"
        style={StyleSheet.absoluteFill}
      >
        <Pressable
          accessibilityLabel="Close business details"
          accessibilityRole="button"
          onPress={dismissOverlay}
          style={StyleSheet.absoluteFill}
        />
      </BlurView>

      <View style={styles.modalContent}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.modalShell,
            {
              opacity: popupScale.interpolate({
                inputRange: [0.9, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              transform: [{ scale: popupScale }],
            },
          ]}
        >
          <View style={styles.modalCard}>
            <Pressable
              accessibilityLabel="Close business details"
              accessibilityRole="button"
              hitSlop={10}
              onPress={dismissOverlay}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Text style={styles.closeButtonGlyph}>{'\u00D7'}</Text>
            </Pressable>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.hero}>
                {provider.providerCoverUrl || provider.imageUrl ? (
                  <Image
                    accessibilityLabel={`${provider.providerName} cover photo`}
                    resizeMode="cover"
                    source={{ uri: provider.providerCoverUrl || provider.imageUrl }}
                    style={styles.coverImage}
                  />
                ) : (
                  <View style={styles.coverFallback} />
                )}
                <View style={styles.coverShade} />
                <View style={styles.logo}>
                  {provider.providerLogoUrl ? (
                    <Image
                      accessibilityLabel={`${provider.providerName} logo`}
                      resizeMode="cover"
                      source={{ uri: provider.providerLogoUrl }}
                      style={styles.logoImage}
                    />
                  ) : (
                    <MaterialIcons color="#722F37" name="storefront" size={30} />
                  )}
                </View>
              </View>

              <View style={styles.businessBody}>
                <Text style={styles.businessName}>{provider.providerName}</Text>
                {provider.providerLocation || provider.location ? (
                  <View style={styles.locationRow}>
                    <MaterialIcons color="#722F37" name="location-on" size={16} />
                    <Text style={styles.locationText}>{provider.providerLocation || provider.location}</Text>
                  </View>
                ) : null}
                {provider.providerDescription ? (
                  <Text style={styles.description}>{provider.providerDescription}</Text>
                ) : null}

                <View accessibilityLabel={`Business rating: ${ratingText}`} style={styles.ratingCard}>
                  <MaterialIcons color="#C38A23" name="star" size={22} />
                  <View>
                    <Text style={styles.ratingValue}>{ratingText}</Text>
                    <Text style={styles.ratingCaption}>Overall rating from service ratings</Text>
                  </View>
                </View>

                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Services offered</Text>
                  <Text style={styles.sectionCount}>{services.length}</Text>
                </View>

                {services.map((service) => (
                  <Pressable
                    key={service.id}
                    accessibilityLabel={`View ${service.name}`}
                    accessibilityRole="button"
                    onPress={() => chooseService(service)}
                    style={({ pressed }) => [styles.serviceCard, pressed && styles.serviceCardPressed]}
                  >
                    {service.imageUrl ? (
                      <Image accessibilityLabel={service.imageLabel} resizeMode="cover" source={{ uri: service.imageUrl }} style={styles.serviceImage} />
                    ) : (
                      <View style={[styles.serviceImage, styles.serviceImageFallback]}><MaterialIcons color="#722F37" name="image" size={23} /></View>
                    )}
                    <View style={styles.serviceCopy}>
                      <Text numberOfLines={2} style={styles.serviceName}>{service.name}</Text>
                      <Text numberOfLines={1} style={styles.serviceCategory}>{service.categoryName}</Text>
                      <Text style={styles.servicePrice}>{formatServicePrice(service)}</Text>
                    </View>
                    <MaterialIcons color="#722F37" name="chevron-right" size={23} />
                  </Pressable>
                ))}

                {services.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No published services yet</Text>
                    <Text style={styles.emptyCopy}>This business does not currently have bookable services available.</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  modalOverlay: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100, backgroundColor: 'rgba(35, 43, 48, 0.14)' },
  modalContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalShell: { width: '100%', maxWidth: 760, height: '90%' },
  modalCard: { flex: 1, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.66)', borderRadius: 24, backgroundColor: '#E9EDF0', boxShadow: '9px 9px 20px rgba(157, 169, 178, 0.5)' },
  closeButton: { position: 'absolute', top: 12, right: 12, zIndex: 3, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.66)', borderRadius: 18, backgroundColor: '#E9EDF0', shadowColor: '#000000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.38, shadowRadius: 6, elevation: 4, boxShadow: '3px 3px 6px rgba(0, 0, 0, 0.38), -3px -3px 6px rgba(255, 255, 255, 0.94)' },
  closeButtonGlyph: { color: '#E53935', fontSize: 26, lineHeight: 28, fontWeight: '400' },
  closeButtonPressed: { opacity: 0.72 },
  content: { paddingBottom: 26 },
  hero: { height: 204, overflow: 'hidden', position: 'relative', backgroundColor: '#722F37' },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: { ...StyleSheet.absoluteFill, backgroundColor: '#722F37' },
  coverShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(31, 5, 12, 0.24)' },
  logo: { position: 'absolute', bottom: -31, left: 20, width: 72, height: 72, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: '#E9EDF0', borderRadius: 20, backgroundColor: '#FFFFFF' },
  logoImage: { width: '100%', height: '100%' },
  businessBody: { paddingHorizontal: 20, paddingTop: 44 },
  businessName: { color: '#202326', fontSize: 25, lineHeight: 31, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { flex: 1, color: '#5C6268', fontSize: 13, lineHeight: 18 },
  description: { color: '#4F565C', fontSize: 14, lineHeight: 21, marginTop: 14 },
  ratingCard: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: 'rgba(114, 47, 55, 0.14)', borderRadius: 15, backgroundColor: '#FAF7F2', marginTop: 18, padding: 13 },
  ratingValue: { color: '#24272A', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  ratingCaption: { color: '#6B7177', fontSize: 11, lineHeight: 15, marginTop: 1 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: '#24272A', fontSize: 18, lineHeight: 24, fontWeight: '800' },
  sectionCount: { minWidth: 24, color: '#FFFFFF', fontSize: 12, lineHeight: 24, fontWeight: '800', textAlign: 'center', borderRadius: 12, backgroundColor: '#722F37', overflow: 'hidden' },
  serviceCard: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.72)', borderRadius: 16, backgroundColor: '#F8F6F3', marginTop: 10, padding: 9, shadowColor: '#9DA9B2', shadowOffset: { width: 3, height: 4 }, shadowOpacity: 0.24, shadowRadius: 7, elevation: 2 },
  serviceCardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  serviceImage: { width: 66, height: 66, borderRadius: 12, backgroundColor: '#ECE5E2' },
  serviceImageFallback: { alignItems: 'center', justifyContent: 'center' },
  serviceCopy: { minWidth: 0, flex: 1 },
  serviceName: { color: '#25282B', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  serviceCategory: { color: '#6B7177', fontSize: 11, lineHeight: 15, marginTop: 2 },
  servicePrice: { color: '#722F37', fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 4 },
  emptyState: { alignItems: 'center', borderWidth: 1, borderColor: '#E1CFD1', borderRadius: 16, backgroundColor: '#FAF7F2', marginTop: 10, padding: 22 },
  emptyTitle: { color: '#3A3132', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  emptyCopy: { color: '#6A6B6C', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
})
