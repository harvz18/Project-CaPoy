import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'

import { BrandIdentity } from './BrandIdentity'

interface MerchantWorkspaceHeaderProps {
  hasUnreadNotifications?: boolean
  onOpenNotifications?: () => void
}

/**
 * Shared top bar for the provider workspace's five primary destinations.
 * Primary destinations already have the global bottom navigation, so the bar
 * intentionally contains only the MULTIVENT identity and notifications.
 */
export const MerchantWorkspaceHeader: React.FC<MerchantWorkspaceHeaderProps> = ({
  hasUnreadNotifications = false,
  onOpenNotifications,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768

  return (
    <View style={styles.topAppBar}>
      <View style={[styles.topAppBarContent, isWide && styles.topAppBarContentWide]}>
        <BrandIdentity markSize={32} variant="metallicWordmark" />

        <Pressable
          accessibilityLabel="Open notifications"
          accessibilityRole="button"
          accessibilityState={{ disabled: !onOpenNotifications }}
          disabled={!onOpenNotifications}
          hitSlop={8}
          onPress={onOpenNotifications}
          style={({ pressed }) => [
            styles.notificationButton,
            pressed && styles.iconButtonPressed,
            !onOpenNotifications && styles.notificationButtonDisabled,
          ]}
        >
          <MaterialIcons color={palette.onPrimary} name="notifications-none" size={23} />
          {hasUnreadNotifications ? <View style={styles.notificationBadge} /> : null}
        </Pressable>
      </View>
    </View>
  )
}

const palette = {
  accent: '#E8BF94',
  onPrimary: '#FFFFFF',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
} as const

const styles = StyleSheet.create({
  topAppBar: {
    zIndex: 20,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.primary,
    backgroundColor: palette.primaryContainer,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topAppBarContentWide: { paddingHorizontal: 32 },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationButtonDisabled: { opacity: 0.74 },
  iconButtonPressed: { opacity: 0.72 },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: palette.primaryContainer,
    borderRadius: 5,
    backgroundColor: palette.accent,
  },
})
