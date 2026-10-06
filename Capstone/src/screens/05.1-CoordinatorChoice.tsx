import { MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text } from '../components/AppText'

interface CoordinatorChoiceScreenProps {
  busyChoice?: 'browse' | 'skip' | ''
  onBack?: () => void
  onBrowse?: () => void
  onSkip?: () => void
}

export const CoordinatorChoiceScreen: React.FC<CoordinatorChoiceScreenProps> = ({
  busyChoice = '',
  onBack,
  onBrowse,
  onSkip,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 760

  return (
    <View style={styles.screen}>
      <View style={[styles.header, isWide && styles.wide]}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onBack} style={styles.back}>
          <MaterialCommunityIcons color="#4E061A" name="arrow-left" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>COORDINATOR SERVICE</Text>
        <View style={styles.back} />
      </View>

      <View style={[styles.content, isWide && styles.wide]}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons color="#FFFFFF" name="account-tie-outline" size={38} />
        </View>
        <Text style={styles.eyebrow}>OPTIONAL PAID SERVICE</Text>
        <Text style={styles.title}>Would you like an event coordinator?</Text>
        <Text style={styles.copy}>
          Browse independent coordinators, compare their fee and availability, and send a booking request. You can also continue planning without one.
        </Text>

        <View style={[styles.actions, isWide && styles.actionsWide]}>
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(busyChoice)}
            onPress={onBrowse}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed, Boolean(busyChoice) && styles.disabled]}
          >
            {busyChoice === 'browse' ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons color="#FFFFFF" name="account-search-outline" size={22} />}
            <Text style={styles.primaryText}>Browse coordinators</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(busyChoice)}
            onPress={onSkip}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed, Boolean(busyChoice) && styles.disabled]}
          >
            {busyChoice === 'skip' ? <ActivityIndicator color="#4E061A" /> : <MaterialCommunityIcons color="#4E061A" name="arrow-right" size={22} />}
            <Text style={styles.secondaryText}>Continue without coordinator</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>You can add a coordinator later from Event Organizers.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9F9F9' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E4D8DA', backgroundColor: '#FFFFFF' },
  wide: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#4E061A', fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 64 },
  iconCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6B1E2E', marginBottom: 20 },
  eyebrow: { color: '#6B1E2E', fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginBottom: 8 },
  title: { maxWidth: 650, color: '#1A1C1C', fontSize: 30, lineHeight: 38, fontWeight: '700', textAlign: 'center' },
  copy: { maxWidth: 620, color: '#6F6769', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 12 },
  actions: { width: '100%', maxWidth: 620, gap: 12, marginTop: 30 },
  actionsWide: { flexDirection: 'row' },
  primary: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 28, backgroundColor: '#4E061A', paddingHorizontal: 22 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondary: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: '#6B1E2E', borderRadius: 28, backgroundColor: '#FFFFFF', paddingHorizontal: 22 },
  secondaryText: { color: '#4E061A', fontSize: 14, fontWeight: '700' },
  note: { color: '#7A7072', fontSize: 12, marginTop: 18 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
})
