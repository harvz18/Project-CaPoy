import React from 'react'
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { Text } from './AppText'

type BrandIdentityProps = {
  inverse?: boolean
  markSize?: number
  showName?: boolean
  style?: StyleProp<ViewStyle>
}

export const BrandIdentity: React.FC<BrandIdentityProps> = ({
  inverse = false,
  markSize = 38,
  showName = true,
  style,
}) => (
  <View accessibilityLabel="MULTIVENT" style={[styles.container, style]}>
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={require('../../assets/multivent-icon.png')}
      style={{ borderRadius: Math.max(8, markSize * 0.2), height: markSize, width: markSize }}
    />
    {showName ? (
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
  name: {
    color: '#6B1E2E',
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    letterSpacing: 2.2,
    lineHeight: 22,
  },
  nameInverse: {
    color: '#FFF7F2',
  },
})
