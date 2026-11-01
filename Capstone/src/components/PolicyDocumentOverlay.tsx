import { Text } from './AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radius, spacing } from '../theme/tokens'

interface PolicyDocumentOverlayProps {
  blurTarget: React.RefObject<React.ComponentRef<typeof View> | null>
  content: string
  onClose: () => void
  title: string
}

const neo = {
  surface: '#E9EDF0',
  edge: 'rgba(255, 255, 255, 0.62)',
  darkShadow: 'rgba(160, 171, 180, 0.54)',
  lightShadow: 'rgba(255, 255, 255, 0.96)',
  text: '#57636C',
}

export const PolicyDocumentOverlay: React.FC<PolicyDocumentOverlayProps> = ({
  blurTarget,
  content,
  onClose,
  title,
}) => {
  const insets = useSafeAreaInsets()
  const [isClosing, setIsClosing] = useState(false)
  const scale = useRef(new Animated.Value(0.84)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.035, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      ]),
    ]).start()
  }, [opacity, scale])

  const dismiss = () => {
    if (isClosing) return

    setIsClosing(true)
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.025, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.84, duration: 170, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onClose()
    })
  }

  return (
    <View pointerEvents={isClosing ? 'none' : 'auto'} style={[styles.overlay, { top: -insets.top }]}>
      <StatusBar barStyle="light-content" />
      <BlurView
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={1}
        blurTarget={blurTarget}
        intensity={42}
        tint="dark"
        style={StyleSheet.absoluteFill}
      >
        <View pointerEvents="none" style={styles.backdropTint} />
        <Pressable
          accessibilityLabel="Close policy"
          accessibilityRole="button"
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        />
      </BlurView>

      <Animated.View
        accessibilityViewIsModal
        style={[styles.card, { opacity, transform: [{ scale }] }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            accessibilityLabel="Close policy"
            accessibilityRole="button"
            hitSlop={8}
            onPress={dismiss}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          >
            <MaterialCommunityIcons color={neo.text} name="close" size={23} />
          </Pressable>
        </View>

        <View style={styles.documentWell}>
          <ScrollView
            contentContainerStyle={styles.documentContent}
            showsVerticalScrollIndicator
            style={styles.documentScroll}
          >
            <Text style={styles.documentText}>{content}</Text>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  backdropTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(27, 32, 37, 0.34)',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '78%',
    minHeight: 360,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: 24,
    backgroundColor: neo.surface,
    boxShadow: '0px 12px 24px rgba(27, 32, 37, 0.24)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    flex: 1,
    color: neo.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: radius.pill,
    backgroundColor: neo.surface,
    boxShadow: `5px 5px 11px ${neo.darkShadow}, -5px -5px 11px ${neo.lightShadow}`,
  },
  closeButtonPressed: {
    boxShadow: `inset 3px 3px 6px ${neo.darkShadow}, inset -3px -3px 6px ${neo.lightShadow}`,
  },
  documentWell: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: radius.large,
    backgroundColor: neo.surface,
    boxShadow: `inset 5px 5px 9px ${neo.darkShadow}, inset -5px -5px 9px ${neo.lightShadow}`,
  },
  documentScroll: {
    flex: 1,
  },
  documentContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  documentText: {
    color: neo.text,
    fontSize: 14,
    lineHeight: 22,
  },
})
