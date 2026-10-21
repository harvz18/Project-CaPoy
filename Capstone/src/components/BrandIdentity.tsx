import React from 'react'
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { Text } from './AppText'
import { colors } from '../theme/tokens'

type BrandIdentityProps = {
  inverse?: boolean
  markSize?: number
  showName?: boolean
  style?: StyleProp<ViewStyle>
  variant?: 'standard' | 'metallicWordmark'
}

export const BrandIdentity: React.FC<BrandIdentityProps> = ({
  inverse = false,
  markSize = 38,
  showName = true,
  style,
  variant = 'standard',
}) => (
  <View accessibilityLabel="MULTIVENT" style={[styles.container, style]}>
    {variant === 'metallicWordmark' ? (
      <View
        style={[
          styles.metallicWordmarkWindow,
          {
            height: Math.round(markSize * 0.74),
            width: Math.round(markSize * 6.8),
          },
        ]}
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="stretch"
          source={require('../../assets/multivent-metallic-wordmark.png')}
          style={{
            height: Math.round(markSize * 2.35),
            left: Math.round(-markSize * 0.13),
            position: 'absolute',
            top: Math.round(-markSize * 0.83),
            width: Math.round(markSize * 7.05),
          }}
        />
      </View>
    ) : (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={require('../../assets/multivent-icon.png')}
        style={{ borderRadius: Math.max(8, markSize * 0.2), height: markSize, width: markSize }}
      />
    )}
    {showName && variant === 'standard' ? (
      <Text style={[styles.name, inverse && styles.nameInverse]}>MULTIVENT</Text>
    ) : null}
  </View>
)

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  metallicWordmarkWindow: {
    overflow: 'hidden',
  },
  name: {
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    letterSpacing: 2.2,
    lineHeight: 22,
  },
  nameInverse: {
    color: colors.textInverse,
  },
})
