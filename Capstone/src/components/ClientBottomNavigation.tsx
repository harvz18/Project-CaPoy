import { Text } from './AppText'
import React from 'react'
import { Animated, Easing, Pressable, StyleSheet,  View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

export type ClientMainTab = 'home' | 'explore' | 'bookings' | 'messages' | 'profile'

interface ClientBottomNavigationProps {
  activeTab: ClientMainTab
  isVisible?: boolean
  onSelectTab?: (tab: ClientMainTab) => void
}

const tabs = [
  { id: 'home' as const, icon: 'H', label: 'Home' },
  { id: 'explore' as const, icon: 'E', label: 'Explore' },
  { id: 'bookings' as const, icon: 'B', label: 'Bookings' },
  { id: 'messages' as const, icon: 'M', label: 'Messages' },
  { id: 'profile' as const, icon: 'P', label: 'Account' },
]

export const ClientBottomNavigation: React.FC<ClientBottomNavigationProps> = ({
  activeTab,
  isVisible = true,
  onSelectTab,
}) => {
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab)
  const activeIndicatorX = React.useRef(new Animated.Value(0)).current
  const navigationTranslateY = React.useRef(new Animated.Value(0)).current
  const hasInitializedIndicator = React.useRef(false)
  const [navContentWidth, setNavContentWidth] = React.useState(0)

  const getIndicatorX = (width: number, index: number) => {
    const slotWidth = width / tabs.length
    const indicatorWidth = 64

    return index * slotWidth + (slotWidth - indicatorWidth) / 2
  }

  React.useEffect(() => {
    if (navContentWidth === 0) {
      return
    }

    activeIndicatorX.stopAnimation()
    Animated.timing(activeIndicatorX, {
      toValue: getIndicatorX(navContentWidth, activeIndex),
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [activeIndex, activeIndicatorX, navContentWidth])

  React.useEffect(() => {
    Animated.timing(navigationTranslateY, {
      toValue: isVisible ? 0 : 96,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [isVisible, navigationTranslateY])

  return (
    <Animated.View
      style={[styles.bottomNavigation, { transform: [{ translateY: navigationTranslateY }] }]}
    >
      <View
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width

          setNavContentWidth(width)
          if (!hasInitializedIndicator.current) {
            activeIndicatorX.setValue(getIndicatorX(width, activeIndex))
            hasInitializedIndicator.current = true
          }
        }}
        style={styles.bottomNavigationContent}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            { opacity: navContentWidth === 0 ? 0 : 1 },
            { transform: [{ translateX: activeIndicatorX }] },
          ]}
        />
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab

          return (
            <Pressable
              key={tab.id}
              accessibilityLabel={`Open ${tab.label}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelectTab?.(tab.id)}
              style={styles.navItem}
            >
            <View style={styles.navIconContainer}>
              {tab.id === 'home' ? (
                <MaterialIcons
                  color={isActive ? palette.primary : palette.secondary}
                  name="home"
                  size={21}
                />
              ) : tab.id === 'explore' ? (
                <MaterialIcons
                  color={isActive ? palette.primary : palette.secondary}
                  name="explore"
                  size={21}
                />
              ) : tab.id === 'bookings' ? (
                <MaterialIcons
                  color={isActive ? palette.primary : palette.secondary}
                  name="event-available"
                  size={21}
                />
              ) : tab.id === 'messages' ? (
                <MaterialIcons
                  color={isActive ? palette.primary : palette.secondary}
                  name="chat"
                  size={21}
                />
              ) : (
                <MaterialIcons
                  color={isActive ? palette.primary : palette.secondary}
                  name="person"
                  size={21}
                />
              )}
            </View>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.label}
            </Text>
            </Pressable>
          )
        })}
      </View>
    </Animated.View>
  )
}

const palette = {
  background: '#F9F9F9',
  outlineVariant: '#DAC0C2',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  bottomNavigation: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    left: 20,
    zIndex: 50,
    height: 60,
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: palette.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },
  bottomNavigationContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 64,
    borderRadius: 28,
    backgroundColor: 'rgba(226, 226, 226, 0.6)',
  },
  navItem: {
    minWidth: 0,
    height: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainer: {
    width: 40,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    marginBottom: 2,
  },
  navIcon: {
    color: palette.secondary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  navIconActive: {
    color: palette.primary,
  },
  navLabel: {
    color: palette.secondary,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    opacity: 0.8,
  },
  navLabelActive: {
    color: palette.primary,
    opacity: 1,
  },
  pressed: {
    opacity: 0.6,
  },
})
