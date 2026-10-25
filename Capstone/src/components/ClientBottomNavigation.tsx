import { Text } from './AppText'
import React from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

// `bookings` remains a first-class route in App.tsx. It is intentionally not
// an action in the V12 floating navigation; clients can still reach it from
// the existing booking and receipt flows until the home shortcut is added.
export type ClientMainTab = 'home' | 'explore' | 'bookings' | 'messages' | 'profile'

interface ClientBottomNavigationProps {
  activeTab: ClientMainTab
  hasUnreadHomeUpdates?: boolean
  hasUnreadInbox?: boolean
  isVisible?: boolean
  onSelectTab?: (tab: ClientMainTab) => void
  onToggleNavigation?: () => void
}

const tabs = [
  { id: 'home' as const, icon: 'home' as const, label: 'Home' },
  { id: 'explore' as const, icon: 'explore' as const, label: 'Explore' },
  { id: 'messages' as const, icon: 'inbox' as const, label: 'Inbox' },
  { id: 'profile' as const, icon: 'person' as const, label: 'Account' },
]

const animationDuration = 240

export const ClientBottomNavigation: React.FC<ClientBottomNavigationProps> = ({
  activeTab,
  hasUnreadHomeUpdates = false,
  hasUnreadInbox = false,
  isVisible = true,
  onSelectTab,
  onToggleNavigation,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [reducedMotion, setReducedMotion] = React.useState(false)
  const expansion = React.useRef(new Animated.Value(0)).current
  const navigationTranslateY = React.useRef(new Animated.Value(0)).current
  const logoPressScale = React.useRef(new Animated.Value(1)).current
  const isToggleInFlight = React.useRef(false)

  React.useEffect(() => {
    let isMounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setReducedMotion(enabled)
    })

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion)
    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])

  React.useEffect(() => {
    Animated.timing(navigationTranslateY, {
      toValue: isVisible ? 0 : 116,
      duration: reducedMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [isVisible, navigationTranslateY, reducedMotion])

  React.useEffect(() => {
    expansion.stopAnimation()
    Animated.timing(expansion, {
      toValue: isExpanded ? 1 : 0,
      duration: reducedMotion ? 0 : animationDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) isToggleInFlight.current = false
    })

    return () => expansion.stopAnimation()
  }, [expansion, isExpanded, reducedMotion])

  const toggleNavigation = () => {
    if (isToggleInFlight.current) return
    isToggleInFlight.current = true
    // The M control owns the pill animation. If a scroll visibility animation
    // is still settling, anchor the navigation at the M before expanding or
    // collapsing so the pill cannot slide down as part of this interaction.
    navigationTranslateY.stopAnimation()
    navigationTranslateY.setValue(0)
    onToggleNavigation?.()
    setIsExpanded((current) => !current)
  }

  const handleLogoPressIn = () => {
    if (reducedMotion) return
    logoPressScale.stopAnimation()
    Animated.timing(logoPressScale, {
      toValue: 0.95,
      duration: 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }

  const handleLogoPressOut = () => {
    if (reducedMotion) {
      logoPressScale.setValue(1)
      return
    }

    logoPressScale.stopAnimation()
    // Always complete a brief down-and-up cycle on release. This keeps the
    // press feedback visible even when the user taps the M control quickly.
    Animated.sequence([
      Animated.timing(logoPressScale, {
        toValue: 0.94,
        duration: 65,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoPressScale, {
        toValue: 1,
        speed: 16,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const selectTab = (tab: (typeof tabs)[number]['id']) => {
    if (!isExpanded || isToggleInFlight.current) return
    onSelectTab?.(tab)
  }

  const barScaleX = expansion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.02, 1],
  })
  // While the pill is collapsed, the center M is the only visible way to
  // discover updates in Home or Inbox. Surface one consolidated indicator
  // there; the per-tab indicators remain visible after it expands.
  const hasCollapsedNavigationUpdate = !isExpanded && (hasUnreadHomeUpdates || hasUnreadInbox)
  const renderTab = (tab: (typeof tabs)[number]) => {
    const isActive = tab.id === activeTab
    const hasUnreadUpdate = (tab.id === 'home' && hasUnreadHomeUpdates)
      || (tab.id === 'messages' && hasUnreadInbox)
    return (
      <Pressable
        key={tab.id}
        accessibilityLabel={`Open ${tab.label}${hasUnreadUpdate ? ', with unread updates' : ''}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        onPress={() => selectTab(tab.id)}
        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
      >
        <View style={[styles.navIconContainer, isActive && styles.navIconContainerActive]}>
          <MaterialIcons
            color={palette.iconMuted}
            name={tab.icon}
            size={21}
          />
          {hasUnreadUpdate ? <View style={styles.inboxUnreadDot} /> : null}
        </View>
        <Text numberOfLines={1} style={[styles.navLabel, isActive && styles.navLabelActive]}>
          {tab.label}
        </Text>
      </Pressable>
    )
  }

  return (
    <Animated.View
      pointerEvents={isVisible ? 'auto' : 'none'}
      style={[styles.bottomNavigation, { transform: [{ translateY: navigationTranslateY }] }]}
    >
      <LinearGradient
        colors={[
          'rgba(255, 252, 253, 0)',
          'rgba(236, 208, 217, 0.76)',
          'rgba(224, 185, 198, 0.98)',
        ]}
        locations={[0, 0.55, 1]}
        pointerEvents="none"
        style={styles.navigationFade}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.navigationSurface,
          {
            transform: [{ scaleX: barScaleX }],
          },
        ]}
      />

      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[
          styles.navigationActions,
          {
            transform: [{ scaleX: barScaleX }],
          },
        ]}
      >
        <View style={styles.actionSide}>{tabs.slice(0, 2).map(renderTab)}</View>
        <View style={styles.logoGap} />
        <View style={styles.actionSide}>{tabs.slice(2).map(renderTab)}</View>
      </Animated.View>

      <View pointerEvents="none" style={styles.logoGlow} />
      <Animated.View style={[styles.logoButton, { transform: [{ scale: logoPressScale }] }]}>
        <Pressable
          accessibilityHint={isExpanded ? 'Collapses client navigation' : 'Expands client navigation'}
          accessibilityLabel={isExpanded
            ? 'Collapse navigation'
            : `Expand navigation${hasCollapsedNavigationUpdate ? ', with unread updates' : ''}`}
          accessibilityRole="button"
          onPress={toggleNavigation}
          onPressIn={handleLogoPressIn}
          onPressOut={handleLogoPressOut}
          style={styles.logoPressTarget}
        >
          <LinearGradient
            colors={['#FFFDF8', '#A79D9A', '#F7F4EE', '#827875', '#E8E2DD']}
            end={{ x: 0.9, y: 1 }}
            locations={[0, 0.24, 0.46, 0.72, 1]}
            pointerEvents="none"
            start={{ x: 0.1, y: 0 }}
            style={styles.logoRim}
          >
            <View style={styles.logoMask}>
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="cover"
                source={require('../../assets/Metallic LOGO.png')}
                style={styles.logo}
              />
            </View>
          </LinearGradient>
        </Pressable>
        {hasCollapsedNavigationUpdate ? <View pointerEvents="none" style={styles.logoUnreadDot} /> : null}
      </Animated.View>
    </Animated.View>
  )
}

const palette = {
  burgundy: '#6B1E2E',
  burgundyDark: '#4E061A',
  iconMuted: '#625D5D',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  bottomNavigation: {
    position: 'absolute',
    right: 16,
    bottom: 8,
    left: 16,
    zIndex: 50,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  navigationFade: {
    position: 'absolute',
    top: -82,
    right: -16,
    left: -16,
    height: 172,
  },
  navigationSurface: {
    position: 'absolute',
    top: 13,
    right: 0,
    bottom: 13,
    left: 0,
    borderRadius: 28,
    backgroundColor: palette.white,
    shadowColor: '#25141A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 9,
  },
  navigationActions: {
    position: 'absolute',
    top: 13,
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionSide: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
  },
  logoGap: {
    width: 84,
  },
  navItem: {
    minWidth: 0,
    height: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemPressed: {
    opacity: 0.66,
    transform: [{ scale: 0.96 }],
  },
  navIconContainer: {
    position: 'relative',
    width: 32,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    marginBottom: 1,
  },
  navIconContainerActive: {
    backgroundColor: 'rgba(107, 30, 46, 0.1)',
  },
  inboxUnreadDot: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderColor: palette.white,
    borderRadius: 4,
    backgroundColor: '#C93643',
  },
  navLabel: {
    maxWidth: '100%',
    color: palette.iconMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    opacity: 0.84,
  },
  navLabelActive: {
    color: palette.iconMuted,
    fontWeight: '800',
    opacity: 1,
  },
  logoButton: {
    position: 'absolute',
    top: 0,
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 41,
    backgroundColor: palette.burgundyDark,
    shadowColor: '#3A0814',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 18,
  },
  logoPressTarget: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 41,
  },
  logoUnreadDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: palette.white,
    borderRadius: 6,
    backgroundColor: '#C93643',
    shadowColor: '#3A0814',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 2,
    elevation: 3,
  },
  logoRim: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderRadius: 41,
  },
  logoMask: {
    width: 78,
    height: 78,
    borderRadius: 39,
    overflow: 'hidden',
  },
  logoGlow: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: 'rgba(107, 30, 46, 0.11)',
    shadowColor: '#6B1E2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
})
