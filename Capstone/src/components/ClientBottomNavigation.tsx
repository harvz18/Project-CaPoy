import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export type ClientMainTab = 'home' | 'explore' | 'bookings' | 'messages' | 'profile'

interface ClientBottomNavigationProps {
  activeTab: ClientMainTab
  onSelectTab?: (tab: ClientMainTab) => void
}

const tabs = [
  { id: 'home' as const, icon: 'H', label: 'Home' },
  { id: 'explore' as const, icon: 'E', label: 'Explore' },
  { id: 'bookings' as const, icon: 'B', label: 'Bookings' },
  { id: 'messages' as const, icon: 'M', label: 'Messages', hasBadge: true },
  { id: 'profile' as const, icon: 'P', label: 'Profile' },
]

export const ClientBottomNavigation: React.FC<ClientBottomNavigationProps> = ({
  activeTab,
  onSelectTab,
}) => (
  <View style={styles.bottomNavigation}>
    <View style={styles.bottomNavigationContent}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab

        return (
          <Pressable
            key={tab.id}
            accessibilityLabel={`Open ${tab.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelectTab?.(tab.id)}
            style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
          >
            <View style={[styles.navIconContainer, isActive && styles.navIconContainerActive]}>
              {'hasBadge' in tab && tab.hasBadge ? <View style={styles.messageBadge} /> : null}
              <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{tab.icon}</Text>
            </View>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  </View>
)

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
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    height: 80,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
    backgroundColor: palette.background,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 8,
  },
  bottomNavigationContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainer: {
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginBottom: 2,
  },
  navIconContainerActive: {
    backgroundColor: 'rgba(255, 178, 187, 0.2)',
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
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    opacity: 0.8,
  },
  navLabelActive: {
    color: palette.primary,
    opacity: 1,
  },
  messageBadge: {
    position: 'absolute',
    top: 5,
    right: 10,
    width: 7,
    height: 7,
    borderWidth: 1,
    borderColor: palette.white,
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
  },
  pressed: {
    opacity: 0.6,
  },
})
