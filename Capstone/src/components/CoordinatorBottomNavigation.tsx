import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import React from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from './AppText'

export type CoordinatorMainTab = 'account' | 'events' | 'home' | 'messages' | 'tasks'

interface CoordinatorBottomNavigationProps {
  activeTab: CoordinatorMainTab
  hasUnreadEvents?: boolean
  hasUnreadMessages?: boolean
  hasUnreadTasks?: boolean
  onSelectTab?: (tab: CoordinatorMainTab) => void
}

const tabs: Array<{
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  id: CoordinatorMainTab
  label: string
}> = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'events', icon: 'event-available', label: 'Events' },
  { id: 'tasks', icon: 'check-circle', label: 'Tasks' },
  { id: 'messages', icon: 'chat', label: 'Inbox' },
  { id: 'account', icon: 'person', label: 'Account' },
]

export const CoordinatorBottomNavigation: React.FC<CoordinatorBottomNavigationProps> = ({
  activeTab,
  hasUnreadEvents = false,
  hasUnreadMessages = false,
  hasUnreadTasks = false,
  onSelectTab,
}) => {
  const safeAreaInsets = useSafeAreaInsets()
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab))
  const activeIndicatorX = React.useRef(new Animated.Value(0)).current
  const initialized = React.useRef(false)
  const [contentWidth, setContentWidth] = React.useState(0)
  const navigationBottomOffset = Math.max(20, safeAreaInsets.bottom + 12)

  const indicatorPosition = (width: number, index: number) => {
    const slotWidth = width / tabs.length
    return index * slotWidth + (slotWidth - 64) / 2
  }

  React.useEffect(() => {
    if (!contentWidth) return
    activeIndicatorX.stopAnimation()
    Animated.timing(activeIndicatorX, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
      toValue: indicatorPosition(contentWidth, activeIndex),
      useNativeDriver: true,
    }).start()
  }, [activeIndex, activeIndicatorX, contentWidth])

  return (
    <View style={[styles.bottomNavigation, { bottom: navigationBottomOffset }]}>
      <View
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width
          setContentWidth(width)
          if (!initialized.current) {
            activeIndicatorX.setValue(indicatorPosition(width, activeIndex))
            initialized.current = true
          }
        }}
        style={styles.bottomNavigationContent}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            { opacity: contentWidth ? 1 : 0 },
            { transform: [{ translateX: activeIndicatorX }] },
          ]}
        />
        {tabs.map((tab) => {
          const selected = tab.id === activeTab
          const hasUnreadUpdate = (tab.id === 'events' && hasUnreadEvents)
            || (tab.id === 'tasks' && hasUnreadTasks)
            || (tab.id === 'messages' && hasUnreadMessages)
          return (
            <Pressable
              key={tab.id}
              accessibilityLabel={`Open ${tab.label}${hasUnreadUpdate ? ', with unread updates' : ''}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onSelectTab?.(tab.id)}
              style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
            >
              <View style={styles.navIconContainer}>
                <MaterialIcons
                  color={selected ? palette.primary : palette.secondary}
                  name={tab.icon}
                  size={21}
                />
                {hasUnreadUpdate ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const palette = {
  primary: '#4E061A',
  secondary: '#68747C',
  surface: '#E9EDF0',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  bottomNavigation: {
    position: 'absolute',
    right: 20,
    left: 20,
    zIndex: 50,
    height: 60,
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.76)',
    backgroundColor: palette.surface,
    boxShadow: '7px 7px 15px rgba(160, 171, 180, 0.5), -7px -7px 15px rgba(255, 255, 255, 0.95)',
    elevation: 8,
  },
  bottomNavigationContent: {
    width: '100%',
    maxWidth: 600,
    height: 52,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    width: 64,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 22,
    backgroundColor: palette.surface,
    boxShadow: '4px 4px 9px rgba(158, 169, 178, 0.52), -4px -4px 9px rgba(255, 255, 255, 0.96)',
    elevation: 4,
    shadowColor: '#9EA9B2',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.34,
    shadowRadius: 6,
  },
  navItem: {
    minWidth: 0,
    height: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  navIconContainer: {
    position: 'relative',
    width: 40,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    marginBottom: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 1,
    right: 5,
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderColor: palette.surface,
    borderRadius: 4,
    backgroundColor: '#C93643',
  },
  navLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    opacity: 0.8,
  },
  navLabelSelected: { color: palette.primary, opacity: 1 },
})
