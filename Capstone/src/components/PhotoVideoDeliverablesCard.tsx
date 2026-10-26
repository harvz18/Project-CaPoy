import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { photoVideoDeliverableTrackingFrom, type PhotoVideoDeliverableTracking } from '../lib/photo-video-deliverables'

type Result = { message?: string; ok: boolean }
type Props = {
  bookingId: string
  mode: 'client' | 'provider'
  onRespond?: (bookingId: string, deliverableId: string, action: 'confirm_receipt' | 'request_revision' | 'approve_output' | 'report_issue', note?: string) => Promise<Result>
  onSave?: (bookingId: string, update: Record<string, unknown>) => Promise<Result>
  tracking?: PhotoVideoDeliverableTracking
}
const label: Record<string, string> = { awaiting_event: 'Awaiting event', editing: 'Editing', ready_for_review: 'Ready for review', revision_requested: 'Revision requested', completed: 'Completed' }
const overdue = (date?: string, status?: string) => Boolean(date && !['completed'].includes(status ?? '') && new Date(`${date}T23:59:59`).getTime() < Date.now())

export const PhotoVideoDeliverablesCard: React.FC<Props> = ({ bookingId, mode, onRespond, onSave, tracking }) => {
  const value = photoVideoDeliverableTrackingFrom(tracking)
  const [notes, setNotes] = React.useState<Record<string, string>>({})
  const [links, setLinks] = React.useState<Record<string, string>>({})
  const [methods, setMethods] = React.useState<Record<string, string>>({})
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { setNotes({}); setLinks({}); setMethods({}); setMessage('') }, [bookingId, tracking])
  const run = async (action: () => Promise<Result>) => { setBusy(true); const result = await action(); setBusy(false); setMessage(result.message ?? (result.ok ? 'Deliverable record saved.' : 'Unable to save deliverable record.')) }
  return <View style={styles.card}>
    <View style={styles.heading}><MaterialIcons color="#6B1E2E" name="photo-library" size={20} /><View style={styles.flex}><Text style={styles.title}>Post-event deliverables</Text><Text style={styles.subtitle}>{busy ? 'Saving deliverable update…' : 'Each promised output is tracked separately. Delivery updates do not affect payout or payment.'}</Text></View></View>
    {!value.deliverables.length ? <Text style={styles.empty}>Promised deliverables will appear after the provider starts post-event editing.</Text> : value.deliverables.map((item) => <View key={item.id} style={styles.item}>
      <View style={styles.itemHeader}><View style={styles.flex}><Text style={styles.name}>{item.name}{item.quantity ? ` × ${item.quantity}` : ''}</Text><Text style={styles.meta}>{label[item.status]}{item.expectedCompletionDate ? ` · Due ${item.expectedCompletionDate}` : ''}</Text></View>{overdue(item.expectedCompletionDate, item.status) ? <Text style={styles.overdue}>OVERDUE</Text> : null}</View>
      {item.deliveryMethod || item.deliveryReference ? <Text style={styles.detail}>Delivery: {[item.deliveryMethod, item.deliveryReference].filter(Boolean).join(' · ')}</Text> : null}
      <Text style={styles.detail}>Revisions: {item.usedRevisionRounds} of {item.includedRevisionRounds} included round(s) used{item.additionalPaidRevisionRequested ? ' · additional paid revision requested' : ''}</Text>
      {item.revisionNote || item.issueNote ? <Text style={styles.detail}>{item.revisionNote || item.issueNote}</Text> : null}
      {mode === 'provider' ? <>
        <TextInput onChangeText={(text) => setMethods((current) => ({ ...current, [item.id]: text }))} placeholder="Delivery method (gallery, cloud, courier…)" placeholderTextColor="#85787B" style={styles.input} value={methods[item.id] ?? item.deliveryMethod ?? ''} />
        <TextInput onChangeText={(text) => setLinks((current) => ({ ...current, [item.id]: text }))} placeholder="Secure delivery link or reference" placeholderTextColor="#85787B" style={styles.input} value={links[item.id] ?? item.deliveryReference ?? ''} />
        <View style={styles.actions}><Action label="Start editing" onPress={() => void run(() => onSave?.(bookingId, { action: 'start_editing', deliverableId: item.id }) ?? Promise.resolve({ ok: false }))} /><Action label="Ready for review" onPress={() => void run(() => onSave?.(bookingId, { action: 'ready_for_review', deliverableId: item.id, deliveryMethod: methods[item.id] ?? item.deliveryMethod ?? '', deliveryReference: links[item.id] ?? item.deliveryReference ?? '' }) ?? Promise.resolve({ ok: false }))} /><Action label="Revision done" onPress={() => void run(() => onSave?.(bookingId, { action: 'revision_completed', deliverableId: item.id, deliveryMethod: methods[item.id] ?? item.deliveryMethod ?? '', deliveryReference: links[item.id] ?? item.deliveryReference ?? '' }) ?? Promise.resolve({ ok: false }))} /><Action label="Record completion" onPress={() => void run(() => onSave?.(bookingId, { action: 'record_completed', deliverableId: item.id }) ?? Promise.resolve({ ok: false }))} /></View>
      </> : <>
        <TextInput multiline onChangeText={(text) => setNotes((current) => ({ ...current, [item.id]: text }))} placeholder="Revision, missing-item, or issue details" placeholderTextColor="#85787B" style={styles.input} value={notes[item.id] ?? ''} />
        <View style={styles.actions}><Action label="Confirm receipt" onPress={() => void run(() => onRespond?.(bookingId, item.id, 'confirm_receipt') ?? Promise.resolve({ ok: false }))} /><Action label="Request revision" onPress={() => void run(() => onRespond?.(bookingId, item.id, 'request_revision', notes[item.id] ?? '') ?? Promise.resolve({ ok: false }))} /><Action label="Approve output" onPress={() => void run(() => onRespond?.(bookingId, item.id, 'approve_output') ?? Promise.resolve({ ok: false }))} /><Action label="Report issue" onPress={() => void run(() => onRespond?.(bookingId, item.id, 'report_issue', notes[item.id] ?? '') ?? Promise.resolve({ ok: false }))} /></View>
      </>}
    </View>)}
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>
}
const Action = ({ label: value, onPress }: { label: string; onPress: () => void }) => <Pressable onPress={onPress} style={styles.action}><Text style={styles.actionText}>{value}</Text></Pressable>
const styles = StyleSheet.create({ card: { backgroundColor: '#fff', borderColor: '#E4D9DC', borderRadius: 16, borderWidth: 1, gap: 10, marginBottom: 14, padding: 14 }, heading: { flexDirection: 'row', gap: 9 }, flex: { flex: 1 }, title: { color: '#28171B', fontSize: 16, fontWeight: '800' }, subtitle: { color: '#706469', fontSize: 12, lineHeight: 17, marginTop: 2 }, empty: { color: '#706469', fontSize: 13 }, item: { borderColor: '#E8DDDF', borderRadius: 10, borderWidth: 1, gap: 7, padding: 10 }, itemHeader: { flexDirection: 'row', gap: 8 }, name: { color: '#28171B', fontSize: 14, fontWeight: '800' }, meta: { color: '#706469', fontSize: 12, marginTop: 2 }, overdue: { color: '#9B1C31', fontSize: 10, fontWeight: '900' }, detail: { color: '#5B4C50', fontSize: 12, lineHeight: 17 }, input: { borderColor: '#DCCFD2', borderRadius: 8, borderWidth: 1, color: '#28171B', fontSize: 12, minHeight: 38, padding: 8 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, action: { backgroundColor: '#F8F1F2', borderColor: '#8A293A', borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 7 }, actionText: { color: '#6B1E2E', fontSize: 11, fontWeight: '800' }, message: { color: '#6B1E2E', fontSize: 12, fontWeight: '700' } })
