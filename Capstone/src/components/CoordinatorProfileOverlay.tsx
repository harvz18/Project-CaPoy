import { Text } from './AppText'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { BlurView } from 'expo-blur'
import React from 'react'
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native'

import { type CatalogService } from '../lib/catalog'
import { CoordinatorDetailsScreen } from '../screens/06.1-CoordinatorDetails'

interface CoordinatorProfileOverlayProps {
  assigning?: boolean
  blurTarget?: React.RefObject<React.ComponentRef<typeof View> | null>
  coordinatorBookingEnabled?: boolean
  isAssigned?: boolean
  mode?: 'explore' | 'planning'
  onClose: () => void
  onSelectProvider?: () => boolean | Promise<boolean>
  service: CatalogService
}

const initialsFrom = (name: string) => (
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EC'
)

export const CoordinatorProfileOverlay: React.FC<CoordinatorProfileOverlayProps> = ({
  assigning = false,
  blurTarget,
  coordinatorBookingEnabled = false,
  isAssigned = false,
  mode = 'explore',
  onClose,
  onSelectProvider,
  service,
}) => {
  const [isClosing, setIsClosing] = React.useState(false)
  const popupScale = React.useRef(new Animated.Value(0.82)).current
  const coordinatorName = service.name || 'Event Coordinator'

  React.useEffect(() => {
    popupScale.setValue(0.82)
    const animation = Animated.sequence([
      Animated.timing(popupScale, {
        toValue: 1.045,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(popupScale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
    ])

    animation.start()
    return () => animation.stop()
  }, [popupScale])

  const dismissOverlay = () => {
    if (isClosing || assigning) return

    setIsClosing(true)
    popupScale.stopAnimation()
    Animated.sequence([
      Animated.timing(popupScale, {
        toValue: 1.035,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(popupScale, {
        toValue: 0.82,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose()
    })
  }

  const selectCoordinator = async () => {
    if (!onSelectProvider || assigning || isClosing) return
    const selected = await onSelectProvider()
    if (selected) dismissOverlay()
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
          accessibilityLabel="Close coordinator profile"
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
                  inputRange: [0.82, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              transform: [{ scale: popupScale }],
            },
          ]}
        >
          <View style={styles.modalCard}>
            <View style={styles.profileHeader}>
              <View pointerEvents="none" style={styles.profileHeaderIdentity}>
                <View style={styles.avatarFrame}>
                  {service.imageUrl ? (
                    <Image
                      accessibilityLabel={service.imageLabel}
                      resizeMode="cover"
                      source={{ uri: service.imageUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{initialsFrom(coordinatorName)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.avatarRolePill}>
                  <MaterialCommunityIcons color="#6B1E2E" name="account-tie-outline" size={16} />
                  <Text style={styles.avatarRolePillText}>EVENT COORDINATOR</Text>
                </View>
              </View>
            </View>
            <Pressable
              accessibilityLabel="Close coordinator profile"
              accessibilityRole="button"
              hitSlop={10}
              onPress={dismissOverlay}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Text style={styles.closeButtonGlyph}>×</Text>
            </Pressable>
            <View style={styles.detailsClip}>
              <CoordinatorDetailsScreen
                assigning={assigning}
                coordinatorBookingEnabled={coordinatorBookingEnabled}
                isAssigned={isAssigned}
                mode={mode}
                onSelectProvider={() => void selectCoordinator()}
                presentation="overlay"
                service={service}
                showProfileImage={false}
              />
            </View>
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
  modalShell: {
    width: '100%',
    maxWidth: 760,
    height: '90%',
    position: 'relative',
    paddingTop: 52,
  },
  modalCard: {
    flex: 1,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 24,
    backgroundColor: '#E9EDF0',
    boxShadow: '3px 4px 8px rgba(62, 72, 80, 0.28)',
  },
  detailsClip: { flex: 1, overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  profileHeader: {
    position: 'relative',
    height: 108,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(157, 169, 178, 0.42)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#E9EDF0',
  },
  profileHeaderIdentity: { ...StyleSheet.absoluteFill, alignItems: 'center' },
  avatarFrame: {
    position: 'absolute',
    top: -52,
    alignSelf: 'center',
    width: 104,
    height: 104,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 52,
    backgroundColor: '#E9EDF0',
    boxShadow: '5px 5px 11px rgba(157, 169, 178, 0.5)',
    zIndex: 2,
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EDF0',
  },
  avatarInitials: {
    color: '#57636C',
    fontSize: 26,
    fontWeight: '700',
  },
  avatarRolePill: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 999,
    backgroundColor: 'rgba(233, 237, 240, 0.76)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.48,
    shadowRadius: 6,
    elevation: 3,
    boxShadow: '3px 3px 6px rgba(157, 169, 178, 0.48), -3px -3px 6px rgba(255, 255, 255, 0.94)',
    zIndex: 1,
  },
  avatarRolePillText: {
    color: '#6B1E2E',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    height: 36,
    width: 36,
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
  closeButtonGlyph: {
    color: '#E53935',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '400',
  },
  closeButtonPressed: { opacity: 0.72 },
})
