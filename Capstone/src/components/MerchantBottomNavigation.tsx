import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MerchantHomeTab } from '../screens/16-MerchantHome'

interface MerchantBottomNavigationProps {
  activeTab: MerchantHomeTab
  onSelectTab?: (tab: MerchantHomeTab) => void
}

const tabs: Array<{ id: MerchantHomeTab; icon: string; label: string }> = [
  { id: 'home', icon: '\u2302', label: 'Home' },
  { id: 'services', icon: '\u2637', label: 'Services' },
  { id: 'bookings', icon: '\u25A3', label: 'Bookings' },
  { id: 'messages', icon: '\u2709', label: 'Messages' },
  { id: 'profile', icon: '\u25CB', label: 'Profile' },
]

export const MerchantBottomNavigation: React.FC<MerchantBottomNavigationProps> = ({
  activeTab,
  onSelectTab,
}) => (
  <View style={styles.bottomNavigation}>
    <View style={styles.bottomNavigationContent}>
      {tabs.map((tab) => {
        const selected = tab.id === activeTab

        return (
          <Pressable
            key={tab.id}
            accessibilityLabel={`Open ${tab.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelectTab?.(tab.id)}
            style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
          >
            <View style={[styles.navIconContainer, selected && styles.navIconSelected]}>
              <Text style={[styles.navIcon, selected && styles.navIconActive]}>{tab.icon}</Text>
            </View>
            <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  </View>
)

const palette = {
  background: '#FAF9F9',
  border: '#DFE0E0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#6B1E2E',
  secondary: '#5D5F5F',
} as const

const styles = StyleSheet.create({
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    minHeight: 76,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingTop: 6,
    paddingBottom: 8,
  },
  bottomNavigationContent: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    width: 68,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navItemPressed: {
    opacity: 0.58,
    transform: [{ scale: 0.94 }],
  },
  navIconContainer: {
    width: 50,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  navIconSelected: {
    backgroundColor: palette.primaryContainer,
  },
  navIcon: {
    color: palette.secondary,
    fontSize: 18,
    lineHeight: 22,
  },
  navIconActive: {
    color: palette.onPrimary,
  },
  navLabel: {
    color: palette.secondary,
    fontSize: 9,
    lineHeight: 13,
  },
  navLabelSelected: {
    color: palette.primaryContainer,
    fontWeight: '700',
  },
})
