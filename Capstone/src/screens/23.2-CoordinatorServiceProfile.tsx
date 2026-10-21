import { MaterialCommunityIcons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native'
import { Text } from '../components/AppText'
import { CoordinatorServiceProfile, fetchCoordinatorServiceProfile, saveCoordinatorServiceProfile } from '../lib/coordinator'

interface Props { onBack?: () => void; onSaved?: (message: string) => void }

const emptyProfile: CoordinatorServiceProfile = {
  availabilityNotes: '', capabilities: [], certifications: [], coordinationFee: 0, currency: 'PHP', description: '', eventTypesHandled: [], isAcceptingBookings: false, portfolioSummary: '', serviceInclusions: [], skills: [], specializations: [], yearsExperience: undefined,
}

const listFrom = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)

export const CoordinatorServiceProfileScreen: React.FC<Props> = ({ onBack, onSaved }) => {
  const [profile, setProfile] = useState(emptyProfile)
  const [fee, setFee] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [eventTypesHandled, setEventTypesHandled] = useState('')
  const [specializations, setSpecializations] = useState('')
  const [skills, setSkills] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [certifications, setCertifications] = useState('')
  const [serviceInclusions, setServiceInclusions] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetchCoordinatorServiceProfile().then((result) => {
      if (result.data) {
        setProfile(result.data)
        setFee(String(result.data.coordinationFee || ''))
        setYearsExperience(result.data.yearsExperience ? String(result.data.yearsExperience) : '')
        setEventTypesHandled(result.data.eventTypesHandled.join(', '))
        setSpecializations(result.data.specializations.join(', '))
        setSkills(result.data.skills.join(', '))
        setCapabilities(result.data.capabilities.join(', '))
        setCertifications(result.data.certifications.join(', '))
        setServiceInclusions(result.data.serviceInclusions.join(', '))
      }
      if (!result.ok) setError(result.message ?? 'Unable to load your coordinator profile.')
      setLoading(false)
    })
  }, [])

  const save = async () => {
    const parsedYears = yearsExperience.trim() ? Number(yearsExperience) : undefined
    if (parsedYears !== undefined && (!Number.isInteger(parsedYears) || parsedYears < 0 || parsedYears > 80)) {
      setError('Enter years of experience as a whole number from 0 to 80.')
      return
    }
    setSaving(true)
    setError('')
    const next: CoordinatorServiceProfile = {
      ...profile,
      availabilityNotes: profile.availabilityNotes.trim(),
      capabilities: listFrom(capabilities),
      certifications: listFrom(certifications),
      coordinationFee: Number(fee) || 0,
      eventTypesHandled: listFrom(eventTypesHandled),
      portfolioSummary: profile.portfolioSummary.trim(),
      serviceInclusions: listFrom(serviceInclusions),
      skills: listFrom(skills),
      specializations: listFrom(specializations),
      yearsExperience: parsedYears,
    }
    const result = await saveCoordinatorServiceProfile(next)
    setSaving(false)
    if (!result.ok) { setError(result.message ?? 'Unable to save your coordinator profile.'); return }
    setProfile(next)
    onSaved?.('Coordinator profile saved.')
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={onBack} style={styles.icon}><MaterialCommunityIcons color="#4E061A" name="arrow-left" size={24} /></Pressable>
        <Text style={styles.headerTitle}>COORDINATOR PROFILE</Text><View style={styles.icon} />
      </View>
      {loading ? <View style={styles.loading}><ActivityIndicator color="#6B1E2E" /></View> : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Present your coordination expertise</Text>
          <Text style={styles.copy}>Share the actual experience, services, and availability clients need to make an informed choice. Every profile detail except your fee is optional.</Text>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Professional introduction</Text>
            <Text style={styles.label}>About your coordination service</Text>
            <TextInput accessibilityLabel="Professional introduction" multiline onChangeText={(description) => setProfile((current) => ({ ...current, description }))} placeholder="Introduce your coordination approach and experience." style={[styles.input, styles.textarea]} value={profile.description} />
            <Text style={styles.label}>Years of experience</Text>
            <TextInput accessibilityLabel="Years of experience" keyboardType="number-pad" onChangeText={setYearsExperience} placeholder="e.g. 5" style={styles.input} value={yearsExperience} />
            <Text style={styles.label}>Event types handled</Text>
            <TextInput accessibilityLabel="Event types handled" onChangeText={setEventTypesHandled} placeholder="Weddings, debuts, corporate events" style={styles.input} value={eventTypesHandled} />

            <Text style={styles.sectionTitle}>Skills and background</Text>
            <Text style={styles.label}>Coordination specialties</Text>
            <TextInput accessibilityLabel="Coordination specialties" onChangeText={setSpecializations} placeholder="Wedding timelines, supplier coordination" style={styles.input} value={specializations} />
            <Text style={styles.label}>Skills</Text>
            <TextInput accessibilityLabel="Coordinator skills" onChangeText={setSkills} placeholder="Budget tracking, run-of-show planning" style={styles.input} value={skills} />
            <Text style={styles.label}>Capabilities</Text>
            <TextInput accessibilityLabel="Coordinator capabilities" onChangeText={setCapabilities} placeholder="On-site coordination, vendor liaison" style={styles.input} value={capabilities} />
            <Text style={styles.label}>Certifications (optional)</Text>
            <TextInput accessibilityLabel="Coordinator certifications" onChangeText={setCertifications} placeholder="Only list certifications you hold" style={styles.input} value={certifications} />
            <Text style={styles.label}>Previous event experience or portfolio</Text>
            <TextInput accessibilityLabel="Previous event experience or portfolio" multiline onChangeText={(portfolioSummary) => setProfile((current) => ({ ...current, portfolioSummary }))} placeholder="Describe relevant past events or linkable portfolio details." style={[styles.input, styles.textarea]} value={profile.portfolioSummary} />

            <Text style={styles.sectionTitle}>Service and availability</Text>
            <Text style={styles.label}>Service inclusions</Text>
            <TextInput accessibilityLabel="Service inclusions" onChangeText={setServiceInclusions} placeholder="Planning calls, event timeline, on-site support" style={styles.input} value={serviceInclusions} />
            <Text style={styles.label}>Coordination fee (PHP per event)</Text>
            <TextInput accessibilityLabel="Coordination fee" keyboardType="decimal-pad" onChangeText={setFee} placeholder="e.g. 12000" style={styles.input} value={fee} />
            <Text style={styles.label}>Availability notes</Text>
            <TextInput accessibilityLabel="Availability notes" multiline onChangeText={(availabilityNotes) => setProfile((current) => ({ ...current, availabilityNotes }))} placeholder="Optional scheduling notes clients should know." style={[styles.input, styles.shortTextarea]} value={profile.availabilityNotes} />
            <Text style={styles.helper}>Use commas to separate items. Leave any optional field blank rather than inventing credentials or experience.</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}><Text style={styles.toggleTitle}>Accept booking requests</Text><Text style={styles.toggleHint}>Your profile becomes visible to clients when a positive fee is set.</Text></View>
              <Switch onValueChange={(isAcceptingBookings) => setProfile((current) => ({ ...current, isAcceptingBookings }))} value={profile.isAcceptingBookings} />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons color="#FFFFFF" name="content-save-outline" size={20} />}
              <Text style={styles.saveText}>Save coordinator profile</Text>
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
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, headerTitle: { color: '#4E061A', fontSize: 12, fontWeight: '700', letterSpacing: 1.1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24, paddingBottom: 80 }, title: { color: '#1A1C1C', fontSize: 28, lineHeight: 36, fontWeight: '700' }, copy: { color: '#6F6769', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  card: { gap: 10, borderWidth: 1, borderColor: '#E4D8DA', borderRadius: 18, backgroundColor: '#FFFFFF', padding: 20 }, sectionTitle: { color: '#4E061A', fontSize: 15, fontWeight: '700', marginTop: 12 }, label: { color: '#4E061A', fontSize: 12, fontWeight: '700', marginTop: 6 }, input: { minHeight: 50, borderWidth: 1, borderColor: '#D8CCCE', borderRadius: 10, color: '#1A1C1C', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }, textarea: { minHeight: 110, textAlignVertical: 'top' }, shortTextarea: { minHeight: 76, textAlignVertical: 'top' }, helper: { color: '#6F6769', fontSize: 12, lineHeight: 17, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 10 }, toggleCopy: { flex: 1 }, toggleTitle: { color: '#1A1C1C', fontSize: 14, fontWeight: '700' }, toggleHint: { color: '#6F6769', fontSize: 12, lineHeight: 16, marginTop: 3 }, error: { color: '#A12A35', fontSize: 12 }, save: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 26, backgroundColor: '#4E061A', marginTop: 8 }, saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }, disabled: { opacity: 0.55 },
})
