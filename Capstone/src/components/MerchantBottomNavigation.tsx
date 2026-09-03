import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MerchantHomeTab } from '../screens/16-MerchantHome'

interface MerchantBottomNavigationProps {
  activeTab: MerchantHomeTab
  onSelectTab?: (tab: MerchantHomeTab) => void
}

const tabs: Array<{ id: MerchantHomeTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profile' },
]

const NavIcon = ({ name, selected }: { name: MerchantHomeTab; selected: boolean }) => {
  const color = selected ? palette.onPrimary : palette.secondary

  if (name === 'home') {
    return (
      <View style={styles.homeIcon}>
        <View style={[styles.homeRoofLeft, { backgroundColor: color }]} />
        <View style={[styles.homeRoofRight, { backgroundColor: color }]} />
        <View style={[styles.homeBase, { borderColor: color }]} />
      </View>
    )
  }

  if (name === 'services') {
    return (
      <View style={styles.servicesIcon}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.servicesLine}>
            <View style={[styles.servicesDot, { backgroundColor: color }]} />
            <View style={[styles.servicesBar, { backgroundColor: color }]} />
          </View>
        ))}
      </View>
    )
  }

  if (name === 'bookings') {
    return (
      <View style={[styles.bookingIcon, { borderColor: color }]}>
        <View style={[styles.bookingRingLeft, { backgroundColor: color }]} />
        <View style={[styles.bookingRingRight, { backgroundColor: color }]} />
        <View style={[styles.bookingLine, { backgroundColor: color }]} />
        <View style={[styles.bookingLineShort, { backgroundColor: color }]} />
      </View>
    )
  }

  if (name === 'messages') {
    return (
      <View style={[styles.messageIcon, { borderColor: color }]}>
        <View style={[styles.messageFlapLeft, { backgroundColor: color }]} />
        <View style={[styles.messageFlapRight, { backgroundColor: color }]} />
      </View>
    )
  }

  return (
    <View style={styles.profileIcon}>
      <View style={[styles.profileHead, { borderColor: color }]} />
      <View style={[styles.profileShoulders, { borderColor: color }]} />
    </View>
  )
}

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
              <NavIcon name={tab.id} selected={selected} />
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
  homeIcon: { width: 22, height: 21, alignItems: 'center', justifyContent: 'flex-end' },
  homeRoofLeft: {
    position: 'absolute',
    top: 6,
    left: 4,
    width: 11,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-42deg' }],
  },
  homeRoofRight: {
    position: 'absolute',
    top: 6,
    right: 4,
    width: 11,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '42deg' }],
  },
  homeBase: {
    width: 15,
    height: 11,
    borderWidth: 1.8,
    borderTopWidth: 0,
    borderRadius: 2,
  },
  servicesIcon: { width: 23, height: 19, justifyContent: 'space-between' },
  servicesLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  servicesDot: { width: 4, height: 4, borderRadius: 2 },
  servicesBar: { width: 15, height: 2, borderRadius: 1 },
  bookingIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    borderWidth: 1.8,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  bookingRingLeft: { position: 'absolute', top: -3, left: 4, width: 2, height: 6, borderRadius: 1 },
  bookingRingRight: { position: 'absolute', top: -3, right: 4, width: 2, height: 6, borderRadius: 1 },
  bookingLine: { width: 10, height: 2, borderRadius: 1, marginBottom: 3 },
  bookingLineShort: { width: 7, height: 2, borderRadius: 1 },
  messageIcon: {
    width: 22,
    height: 16,
    overflow: 'hidden',
    borderWidth: 1.8,
    borderRadius: 4,
  },
  messageFlapLeft: {
    position: 'absolute',
    left: 2,
    bottom: 5,
    width: 11,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '32deg' }],
  },
  messageFlapRight: {
    position: 'absolute',
    right: 2,
    bottom: 5,
    width: 11,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-32deg' }],
  },
  profileIcon: { width: 22, height: 22, alignItems: 'center' },
  profileHead: { width: 8, height: 8, borderWidth: 1.8, borderRadius: 4, marginTop: 2 },
  profileShoulders: {
    position: 'absolute',
    bottom: 2,
    width: 16,
    height: 8,
    borderWidth: 1.8,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
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
