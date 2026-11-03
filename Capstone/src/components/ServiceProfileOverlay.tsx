import { BlurView } from 'expo-blur'
import React from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'

import { type CatalogService } from '../lib/catalog'
import { type ServiceReviewInsights } from '../lib/reviews'
import { ServiceDetailsScreen } from '../screens/08-ServiceDetails'
import { Text } from './AppText'

interface ServiceProfileOverlayProps {
  blurTarget?: React.RefObject<React.ComponentRef<typeof View> | null>
  onClose: () => void
  onPlanWithService?: () => void
  reviewInsights?: ServiceReviewInsights
  reviewInsightsLoading?: boolean
  service: CatalogService
  showPlanAction?: boolean
}

/**
 * Presents a browsed service without leaving Client Home. Its backdrop,
 * dismissal animation, and close affordance intentionally match the Expert
 * profile overlay.
 */
export const ServiceProfileOverlay: React.FC<ServiceProfileOverlayProps> = ({
  blurTarget,
  onClose,
  onPlanWithService,
  reviewInsights,
  reviewInsightsLoading = false,
  service,
  showPlanAction = false,
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
      Animated.timing(popupScale, {
        toValue: 1.02,
        duration: 80,
        useNativeDriver: true,
      }),
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
          accessibilityLabel="Close service details"
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
              accessibilityLabel="Close service details"
              accessibilityRole="button"
              hitSlop={10}
              onPress={dismissOverlay}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Text style={styles.closeButtonGlyph}>{'\u00D7'}</Text>
            </Pressable>
            <ServiceDetailsScreen
              mode="explore"
              onBack={dismissOverlay}
              presentation="overlay"
              reviewInsights={reviewInsights}
              reviewInsightsLoading={reviewInsightsLoading}
              service={service}
            />
            {showPlanAction ? (
              <View style={styles.planActionBar}>
                <Pressable
                  accessibilityLabel="Plan with this service"
                  accessibilityRole="button"
                  onPress={onPlanWithService}
                  style={({ pressed }) => [styles.planActionButton, pressed && styles.planActionButtonPressed]}
                >
                  <Text style={styles.planActionText}>Plan with this Service</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
    backgroundColor: 'rgba(35, 43, 48, 0.14)',
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalShell: { width: '100%', maxWidth: 760, height: '90%' },
  modalCard: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 24,
    backgroundColor: '#E9EDF0',
    boxShadow: '9px 9px 20px rgba(157, 169, 178, 0.5)',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 3,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 18,
    backgroundColor: '#E9EDF0',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.38,
    shadowRadius: 6,
    elevation: 4,
    boxShadow: '3px 3px 6px rgba(0, 0, 0, 0.38), -3px -3px 6px rgba(255, 255, 255, 0.94)',
  },
  closeButtonGlyph: { color: '#E53935', fontSize: 26, lineHeight: 28, fontWeight: '400' },
  closeButtonPressed: { opacity: 0.72 },
  planActionBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: '#E9EDF0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  planActionButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 235, 240, 0.22)',
    borderRadius: 15,
    backgroundColor: '#6B1E2E',
    shadowColor: '#2B0712',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.52,
    shadowRadius: 9,
    elevation: 6,
    boxShadow: '5px 5px 9px rgba(43, 7, 18, 0.52), -2px -2px 5px rgba(255, 237, 243, 0.22)',
  },
  planActionButtonPressed: {
    transform: [{ translateY: 1 }],
    shadowOpacity: 0,
    elevation: 0,
    boxShadow: 'inset 3px 3px 6px rgba(43, 7, 18, 0.58), inset -2px -2px 4px rgba(255, 230, 237, 0.16)',
  },
  planActionText: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '800' },
})
