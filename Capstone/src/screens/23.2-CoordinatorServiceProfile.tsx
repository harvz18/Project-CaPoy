import { MaterialCommunityIcons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native'
import { Text } from '../components/AppText'
import { CoordinatorServiceProfile, fetchCoordinatorServiceProfile, saveCoordinatorServiceProfile } from '../lib/coordinator'

interface Props { onBack?: () => void; onSaved?: (message: string) => void }

const emptyProfile: CoordinatorServiceProfile = {
  coordinationFee: 0,
  currency: 'PHP',
  description: '',
  isAcceptingBookings: false,
  specializations: [],
}

export const CoordinatorServiceProfileScreen: React.FC<Props> = ({ onBack, onSaved }) => {
  const [profile, setProfile] = useState(emptyProfile)
  const [fee, setFee] = useState('')
  const [specializations, setSpecializations] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetchCoordinatorServiceProfile().then((result) => {
      if (result.data) {
        setProfile(result.data)
        setFee(String(result.data.coordinationFee || ''))
        setSpecializations(result.data.specializations.join(', '))
      }
      if (!result.ok) setError(result.message ?? 'Unable to load your service profile.')
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    const next = {
      ...profile,
      coordinationFee: Number(fee) || 0,
      specializations: specializations.split(',').map((item) => item.trim()).filter(Boolean),
    }
    const result = await saveCoordinatorServiceProfile(next)
    setSaving(false)
    if (!result.ok) { setError(result.message ?? 'Unable to save your service profile.'); return }
    setProfile(next)
    onSaved?.('Coordinator service profile saved.')
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={onBack} style={styles.icon}><MaterialCommunityIcons color="#4E061A" name="arrow-left" size={24} /></Pressable>
        <Text style={styles.headerTitle}>SERVICE PROFILE</Text><View style={styles.icon} />
      </View>
      {loading ? <View style={styles.loading}><ActivityIndicator color="#6B1E2E" /></View> : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Offer coordination services</Text>
          <Text style={styles.copy}>Set the public details clients see before they send you a booking request.</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Coordination fee (PHP per event)</Text>
            <TextInput keyboardType="decimal-pad" onChangeText={setFee} placeholder="e.g. 12000" style={styles.input} value={fee} />
            <Text style={styles.label}>About your service</Text>
            <TextInput multiline onChangeText={(description) => setProfile((current) => ({ ...current, description }))} placeholder="Describe your coordination experience and service." style={[styles.input, styles.textarea]} value={profile.description} />
            <Text style={styles.label}>Specializations</Text>
            <TextInput onChangeText={setSpecializations} placeholder="Weddings, corporate events, debuts" style={styles.input} value={specializations} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}><Text style={styles.toggleTitle}>Accept booking requests</Text><Text style={styles.toggleHint}>Your profile becomes visible to clients when a positive fee is set.</Text></View>
              <Switch onValueChange={(isAcceptingBookings) => setProfile((current) => ({ ...current, isAcceptingBookings }))} value={profile.isAcceptingBookings} />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons color="#FFFFFF" name="content-save-outline" size={20} />}
              <Text style={styles.saveText}>Save service profile</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9F9F9' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E4D8DA', backgroundColor: '#FFFFFF', paddingHorizontal: 18 },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#4E061A', fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24, paddingBottom: 80 },
  title: { color: '#1A1C1C', fontSize: 28, lineHeight: 36, fontWeight: '700' },
  copy: { color: '#6F6769', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  card: { gap: 10, borderWidth: 1, borderColor: '#E4D8DA', borderRadius: 18, backgroundColor: '#FFFFFF', padding: 20 },
  label: { color: '#4E061A', fontSize: 12, fontWeight: '700', marginTop: 6 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#D8CCCE', borderRadius: 10, color: '#1A1C1C', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 10 },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: '#1A1C1C', fontSize: 14, fontWeight: '700' },
  toggleHint: { color: '#6F6769', fontSize: 11, lineHeight: 16, marginTop: 3 },
  error: { color: '#A12A35', fontSize: 12 },
  save: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 26, backgroundColor: '#4E061A', marginTop: 8 },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.55 },
})
