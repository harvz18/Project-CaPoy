import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Text } from './AppText'
import { photoVideoPreEventPlanFrom, type PhotoVideoPreEventPlan } from '../lib/photo-video-pre-event'

type Result = { message?: string; ok: boolean }

interface Props {
  bookingId: string
  mode: 'client' | 'provider'
  onConfirm?: (bookingId: string) => Promise<Result>
  onSavePlan?: (bookingId: string, plan: PhotoVideoPreEventPlan) => Promise<Result>
  onSaveShotList?: (bookingId: string, shotList: string) => Promise<Result>
  plan?: PhotoVideoPreEventPlan
}

const Field = ({ label, onChange, value }: { label: string; onChange: (value: string) => void; value?: string }) => (
  <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput multiline onChangeText={onChange} placeholder={label} placeholderTextColor="#85787B" style={styles.input} value={value ?? ''} /></View>
)

export const PhotoVideoPreEventPlanCard: React.FC<Props> = ({ bookingId, mode, onConfirm, onSavePlan, onSaveShotList, plan }) => {
  const [draft, setDraft] = React.useState(() => photoVideoPreEventPlanFrom(plan))
  const [message, setMessage] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  React.useEffect(() => { setDraft(photoVideoPreEventPlanFrom(plan)); setMessage('') }, [bookingId, plan])
  const save = async (action: () => Promise<Result>) => { setSaving(true); const result = await action(); setSaving(false); setMessage(result.message ?? (result.ok ? 'Pre-event coordination saved.' : 'Unable to save the pre-event plan.')) }
  const warnings = [
    !draft.crewAssignments ? 'Confirm the crew assignments before final confirmation.' : '',
    !draft.venueAddresses && !draft.preparationLocation && !draft.ceremonyLocation && !draft.receptionLocation ? 'Add the event locations and access details.' : '',
    draft.preparationLocation && draft.ceremonyLocation && draft.preparationLocation !== draft.ceremonyLocation && !draft.timelineNotes ? 'Multiple locations are listed. Confirm travel time in the timeline notes.' : '',
  ].filter(Boolean)
  const confirmed = mode === 'provider' ? Boolean(draft.providerConfirmedAt) : Boolean(draft.clientConfirmedAt)
  return <View style={styles.card}>
    <View style={styles.heading}><MaterialIcons color="#6B1E2E" name="event-note" size={20} /><View><Text style={styles.title}>Pre-event coverage plan</Text><Text style={styles.subtitle}>Operational coordination only — this does not create payment or change the booking price.</Text></View></View>
    {mode === 'provider' ? <>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.eventDateConfirmed === true }} onPress={() => setDraft((current) => ({ ...current, eventDateConfirmed: !current.eventDateConfirmed }))} style={styles.checkRow}><MaterialIcons color="#6B1E2E" name={draft.eventDateConfirmed ? 'check-box' : 'check-box-outline-blank'} size={20} /><Text style={styles.checkText}>I confirmed the event date and coverage schedule.</Text></Pressable>
      <Field label="Coverage start time" onChange={(coverageStart) => setDraft((current) => ({ ...current, coverageStart }))} value={draft.coverageStart} />
      <Field label="Coverage end time" onChange={(coverageEnd) => setDraft((current) => ({ ...current, coverageEnd }))} value={draft.coverageEnd} />
      <Field label="Venue addresses" onChange={(venueAddresses) => setDraft((current) => ({ ...current, venueAddresses }))} value={draft.venueAddresses} />
      <Field label="Crew assignments" onChange={(crewAssignments) => setDraft((current) => ({ ...current, crewAssignments }))} value={draft.crewAssignments} />
      <Field label="Required equipment" onChange={(requiredEquipment) => setDraft((current) => ({ ...current, requiredEquipment }))} value={draft.requiredEquipment} />
      <Field label="Contact person" onChange={(contactPerson) => setDraft((current) => ({ ...current, contactPerson }))} value={draft.contactPerson} />
      <Field label="Preparation location" onChange={(preparationLocation) => setDraft((current) => ({ ...current, preparationLocation }))} value={draft.preparationLocation} />
      <Field label="Ceremony location" onChange={(ceremonyLocation) => setDraft((current) => ({ ...current, ceremonyLocation }))} value={draft.ceremonyLocation} />
      <Field label="Reception location" onChange={(receptionLocation) => setDraft((current) => ({ ...current, receptionLocation }))} value={draft.receptionLocation} />
      <Field label="Special access requirements" onChange={(specialAccessRequirements) => setDraft((current) => ({ ...current, specialAccessRequirements }))} value={draft.specialAccessRequirements} />
      <Field label="Timeline and travel notes" onChange={(timelineNotes) => setDraft((current) => ({ ...current, timelineNotes }))} value={draft.timelineNotes} />
      {onSavePlan ? <Pressable disabled={saving} onPress={() => void save(() => onSavePlan(bookingId, draft))} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save coverage plan'}</Text></Pressable> : null}
    </> : <>
      <Text style={styles.clientCopy}>Share your must-have shots and review the provider’s coverage plan. Requests are planning notes, not automatic guarantees.</Text>
      <Field label="Shot list and important moments" onChange={(shotList) => setDraft((current) => ({ ...current, shotList }))} value={draft.shotList} />
      {onSaveShotList ? <Pressable disabled={saving} onPress={() => void save(() => onSaveShotList(bookingId, draft.shotList ?? ''))} style={styles.secondary}><Text style={styles.secondaryText}>{saving ? 'Saving…' : 'Save shot list'}</Text></Pressable> : null}
    </>}
    {warnings.length ? <View style={styles.warning}><Text style={styles.warningTitle}>Coordination checks</Text>{warnings.map((warning) => <Text key={warning} style={styles.warningText}>• {warning}</Text>)}</View> : null}
    {onConfirm ? <Pressable disabled={saving || confirmed} onPress={() => void save(() => onConfirm(bookingId))} style={[styles.confirm, (saving || confirmed) && styles.disabled]}><MaterialIcons color="#FFFFFF" name="verified" size={18} /><Text style={styles.primaryText}>{confirmed ? 'Plan confirmed' : mode === 'provider' ? 'Confirm coverage plan' : 'Confirm reviewed plan'}</Text></Pressable> : null}
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>
}

const styles = StyleSheet.create({ card: { backgroundColor: '#FFFFFF', borderColor: '#E7DADD', borderRadius: 14, borderWidth: 1, gap: 10, marginTop: 14, padding: 14 }, heading: { flexDirection: 'row', gap: 9 }, title: { color: '#29171B', fontSize: 16, fontWeight: '700' }, subtitle: { color: '#756569', fontSize: 12, lineHeight: 17, marginTop: 2 }, clientCopy: { color: '#514146', fontSize: 13, lineHeight: 18 }, field: { gap: 4 }, label: { color: '#6B1E2E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }, input: { borderColor: '#DED1D4', borderRadius: 8, borderWidth: 1, color: '#29171B', fontSize: 13, minHeight: 40, padding: 9 }, checkRow: { alignItems: 'center', flexDirection: 'row', gap: 8 }, checkText: { color: '#38262B', flex: 1, fontSize: 13 }, primary: { alignItems: 'center', backgroundColor: '#6B1E2E', borderRadius: 8, padding: 12 }, secondary: { alignItems: 'center', borderColor: '#6B1E2E', borderRadius: 8, borderWidth: 1, padding: 11 }, primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }, secondaryText: { color: '#6B1E2E', fontSize: 13, fontWeight: '700' }, warning: { backgroundColor: '#FFF5DE', borderRadius: 8, gap: 3, padding: 10 }, warningTitle: { color: '#7A4B00', fontSize: 12, fontWeight: '700' }, warningText: { color: '#6B4E1B', fontSize: 12, lineHeight: 16 }, confirm: { alignItems: 'center', backgroundColor: '#6B1E2E', borderRadius: 8, flexDirection: 'row', gap: 7, justifyContent: 'center', padding: 12 }, disabled: { opacity: 0.55 }, message: { color: '#514146', fontSize: 12, lineHeight: 16, textAlign: 'center' } })
