import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { StyleSheet } from 'react-native'

/** A subtle, clipped surface tint that gives a card a softly inset edge. */
export const CardInsetShadow: React.FC = () => (
  <LinearGradient
    colors={[
      'rgba(88, 57, 63, 0.19)',
      'rgba(255, 255, 255, 0)',
      'rgba(255, 255, 255, 0)',
      'rgba(88, 57, 63, 0.13)',
    ]}
    end={{ x: 0, y: 1 }}
    locations={[0, 0.16, 0.78, 1]}
    pointerEvents="none"
    start={{ x: 0, y: 0 }}
    style={styles.insetShadow}
  />
)

const styles = StyleSheet.create({
  insetShadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
})
