import { Text } from './AppText'
import { BlurView } from 'expo-blur'
import React from 'react'
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native'

import { type CatalogService } from '../lib/catalog'
import { CoordinatorDetailsScreen } from '../screens/06.1-CoordinatorDetails'

interface CoordinatorProfileOverlayProps {
  blurTarget?: React.RefObject<React.ComponentRef<typeof View> | null>
  onClose: () => void
  service: CatalogService
}

const initialsFrom = (name: string) => (
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EC'
)

export const CoordinatorProfileOverlay: React.FC<CoordinatorProfileOverlayProps> = ({
  blurTarget,
  onClose,
  service,
}) => {
  const [isClosing, setIsClosing] = React.useState(false)
  const popupScale = React.useRef(new Animated.Value(0.9)).current
  const coordinatorName = service.name || 'Event Coordinator'

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
              accessibilityLabel="Close coordinator profile"
              accessibilityRole="button"
              hitSlop={10}
              onPress={dismissOverlay}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Text style={styles.closeButtonGlyph}>×</Text>
            </Pressable>
            <CoordinatorDetailsScreen
              mode="explore"
              presentation="overlay"
              service={service}
              showProfileImage={false}
            />
          </View>
          <View pointerEvents="none" style={styles.avatarFrame}>
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 24,
    backgroundColor: '#E9EDF0',
    boxShadow: '9px 9px 20px rgba(157, 169, 178, 0.5)',
  },
  avatarFrame: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 104,
    height: 104,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 52,
    backgroundColor: '#E9EDF0',
    boxShadow: '5px 5px 11px rgba(157, 169, 178, 0.5)',
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
    boxShadow: '3px 3px 6px rgba(157, 169, 178, 0.5)',
  },
  closeButtonGlyph: {
    color: '#57636C',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '400',
  },
  closeButtonPressed: { opacity: 0.72 },
})
