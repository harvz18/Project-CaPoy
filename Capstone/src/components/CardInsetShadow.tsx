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

/** A stronger, pressed-in neomorphic surface for intentional recessed cards. */
export const NeumorphicInset: React.FC = () => (
  <>
    <LinearGradient
      colors={['#D1C0BE', '#F2E9E7', '#F6F0EF', '#FFFFFF']}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.2, 0.78, 1]}
      pointerEvents="none"
      start={{ x: 0, y: 0 }}
      style={styles.neumorphicSurface}
    />
    <LinearGradient colors={['rgba(0, 0, 0, 0.14)', 'rgba(0, 0, 0, 0)']} end={{ x: 0, y: 1 }} pointerEvents="none" start={{ x: 0, y: 0 }} style={styles.neumorphicTop} />
    <LinearGradient colors={['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0)']} end={{ x: 1, y: 0 }} pointerEvents="none" start={{ x: 0, y: 0 }} style={styles.neumorphicLeft} />
    <LinearGradient colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.56)']} end={{ x: 0, y: 1 }} pointerEvents="none" start={{ x: 0, y: 0 }} style={styles.neumorphicBottom} />
    <LinearGradient colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.48)']} end={{ x: 1, y: 0 }} pointerEvents="none" start={{ x: 0, y: 0 }} style={styles.neumorphicRight} />
  </>
)

/** A softly raised surface with the light-to-dark treatment used in neumorphism. */
export const NeumorphicRaised: React.FC<{ surfaceColor: string }> = ({ surfaceColor }) => (
  <LinearGradient
    colors={['#FFFFFF', surfaceColor, '#E1E0E3']}
    end={{ x: 1, y: 1 }}
    locations={[0, 0.58, 1]}
    pointerEvents="none"
    start={{ x: 0, y: 0 }}
    style={styles.neumorphicRaised}
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
  neumorphicSurface: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  neumorphicTop: { position: 'absolute', top: 0, right: 0, left: 0, height: 13 },
  neumorphicLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 13 },
  neumorphicBottom: { position: 'absolute', right: 0, bottom: 0, left: 0, height: 13 },
  neumorphicRight: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 13 },
  neumorphicRaised: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
