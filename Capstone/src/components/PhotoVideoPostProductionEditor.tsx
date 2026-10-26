import React from 'react'
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
import { Text } from './AppText'
import type { ServiceCategoryDetails } from '../lib/service-category-details'

type RecordValue = Record<string, unknown>
type Props = { details: ServiceCategoryDetails; onChange: (value: ServiceCategoryDetails) => void }

const deliveryMethodOptions = [
  { label: 'Secure download link', value: 'secure_download_link' },
  { label: 'Online gallery', value: 'online_gallery' },
  { label: 'Cloud delivery', value: 'cloud_delivery' },
  { label: 'USB', value: 'usb' },
  { label: 'Physical album delivery', value: 'physical_album_delivery' },
  { label: 'Courier delivery', value: 'courier_delivery' },
  { label: 'Client pickup', value: 'client_pickup' },
] as const

const asRecord = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const asRows = (value: unknown) => Array.isArray(value) ? value.map(asRecord) : []
const text = (value: unknown) => typeof value === 'string' ? value : ''
const numberText = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value : ''
const number = (value: string) => { const parsed = Number(value.replace(/[^\d.]/g, '')); return Number.isFinite(parsed) && value.trim() ? parsed : undefined }
const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const Field = ({ children, helper, label }: React.PropsWithChildren<{ helper?: string; label: string }>) => <View style={styles.field}><Text style={styles.label}>{label}</Text>{helper ? <Text style={styles.helper}>{helper}</Text> : null}{children}</View>
const TextField = ({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder?: string; value: unknown }) => <Field label={label}><TextInput multiline onChangeText={onChange} placeholder={placeholder} placeholderTextColor={palette.placeholder} style={[styles.input, styles.textArea]} value={text(value)} /></Field>
const NumberField = ({ label, min = 0, onChange, suffix, value }: { label: string; min?: number; onChange: (value?: number) => void; suffix?: string; value: unknown }) => <Field label={label}><View style={styles.numberRow}><TextInput inputMode="decimal" keyboardType="decimal-pad" onChangeText={(next) => { const parsed = number(next); onChange(parsed === undefined ? undefined : Math.max(min, parsed)) }} placeholder="0" placeholderTextColor={palette.placeholder} style={[styles.input, styles.flex]} value={numberText(value)} />{suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}</View></Field>
const Choice = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>

export const PhotoVideoPostProductionEditor: React.FC<Props> = ({ details, onChange }) => {
  const deliverables = asRows(details.deliverableConfigurations)
  const existing = asRecord(details.postProductionSettings)
  const deliveryMethods = asRows(existing.deliveryMethods)
  const rushOptions = asRows(existing.rushEditingOptions)
  const revisionPolicy = asRecord(existing.revisionPolicy)
  const deadlineStartingPoint = text(existing.deadlineStartingPoint) || 'event_completion'
  const initializedSettings = {
    deadlineStartingPoint,
    deliveryMethods,
    revisionPolicy: { includedRevisionRounds: 0, ...revisionPolicy },
    rushEditingOptions: rushOptions,
  }
  const set = (patch: RecordValue) => onChange({ ...details, postProductionSettings: { ...initializedSettings, ...patch } })
  const updateDeliverable = (index: number, patch: RecordValue) => onChange({
    ...details,
    deliverableConfigurations: deliverables.map((deliverable, current) => current === index ? { ...deliverable, ...patch } : deliverable),
    postProductionSettings: initializedSettings,
  })
  const updateDeliveryMethod = (index: number, patch: RecordValue) => set({ deliveryMethods: deliveryMethods.map((method, current) => current === index ? { ...method, ...patch } : method) })
  const updateRushOption = (index: number, patch: RecordValue) => set({ rushEditingOptions: rushOptions.map((option, current) => current === index ? { ...option, ...patch } : option) })
  const updatePolicy = (patch: RecordValue) => set({ revisionPolicy: { ...revisionPolicy, ...patch } })
  const toggleIds = (current: unknown, id: string) => {
    const ids = list(current)
    return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
  }
  const includedRevisions = Number(revisionPolicy.includedRevisionRounds ?? 0) || 0

  return <View style={styles.root}>
    <View style={styles.heading}><Text style={styles.headingTitle}>EDITING, DELIVERY & REVISIONS</Text><Text style={styles.headingCopy}>State the post-event commitments you can actually meet. The agreed configuration is preserved with a booking; delivering files and requesting revisions are handled in the later delivery workflow.</Text></View>

    <Text style={styles.sectionTitle}>Editing turnaround</Text>
    <Text style={styles.sectionCopy}>Each promised deliverable needs its own turnaround. Deadlines normally begin after event completion.</Text>
    <Text style={styles.label}>Deadline starting point</Text><View style={styles.choiceRow}><Choice active={deadlineStartingPoint === 'event_completion'} label="Event completion" onPress={() => set({ deadlineStartingPoint: 'event_completion', startingPointDisclosure: '' })} /><Choice active={deadlineStartingPoint === 'agreed_custom_start'} label="Another agreed point" onPress={() => set({ deadlineStartingPoint: 'agreed_custom_start' })} /></View>
    {deadlineStartingPoint === 'agreed_custom_start' ? <TextField label="Explain the agreed starting point" onChange={(startingPointDisclosure) => set({ startingPointDisclosure })} placeholder="e.g., Editing begins after the client supplies music selections." value={existing.startingPointDisclosure} /> : null}
    {deliverables.map((deliverable, index) => <View key={text(deliverable.id) || `turnaround-${index}`} style={styles.card}><Text style={styles.cardTitle}>{text(deliverable.name) || `Deliverable ${index + 1}`}</Text><NumberField label="Expected editing turnaround" min={1} onChange={(turnaroundDays) => updateDeliverable(index, { turnaroundDays })} suffix="days" value={deliverable.turnaroundDays} /></View>)}

    <Text style={styles.sectionTitle}>Rush editing</Text><Text style={styles.sectionCopy}>Only offer rush work when you have capacity. It remains subject to the configured availability and limits.</Text>
    {rushOptions.map((option, index) => <View key={text(option.id) || `rush-${index}`} style={styles.card}>
      <View style={styles.cardHeader}><Text style={styles.cardTitle}>Rush option {index + 1}</Text><Pressable onPress={() => set({ rushEditingOptions: rushOptions.filter((_, current) => current !== index) })}><Text style={styles.removeText}>Remove</Text></Pressable></View>
      <View style={styles.switchRow}><Text style={styles.label}>Available to clients</Text><Switch onValueChange={(isAvailable) => updateRushOption(index, { isAvailable })} value={option.isAvailable !== false} /></View>
      <Text style={styles.label}>Eligible deliverables</Text><View style={styles.choiceGrid}>{deliverables.map((deliverable, deliverableIndex) => <Choice active={list(option.deliverableIds).includes(text(deliverable.id))} key={text(deliverable.id) || deliverableIndex} label={text(deliverable.name) || `Deliverable ${deliverableIndex + 1}`} onPress={() => updateRushOption(index, { deliverableIds: toggleIds(option.deliverableIds, text(deliverable.id)) })} />)}</View>
      <View style={styles.twoColumns}><NumberField label="Rush turnaround" min={1} onChange={(turnaroundDays) => updateRushOption(index, { turnaroundDays })} suffix="days" value={option.turnaroundDays} /><NumberField label="Additional charge" min={1} onChange={(additionalCharge) => updateRushOption(index, { additionalCharge })} suffix="PHP" value={option.additionalCharge} /></View>
      <NumberField label="Capacity limit (optional)" min={1} onChange={(capacityLimit) => updateRushOption(index, { capacityLimit })} suffix="rush jobs" value={option.capacityLimit} />
    </View>)}
    <Pressable onPress={() => set({ rushEditingOptions: [...rushOptions, { additionalCharge: undefined, capacityLimit: undefined, deliverableIds: [], id: newId('rush'), isAvailable: true, turnaroundDays: undefined }] })} style={styles.addButton}><Text style={styles.addText}>Add rush editing option</Text></Pressable>

    <Text style={styles.sectionTitle}>Delivery methods</Text><Text style={styles.sectionCopy}>Choose only the methods you can support. Secure external links can be used later for large files; do not upload unnecessary raw video to app storage.</Text>
    {deliveryMethods.map((method, index) => <View key={text(method.id) || `delivery-${index}`} style={styles.card}>
      <View style={styles.cardHeader}><Text style={styles.cardTitle}>Delivery method {index + 1}</Text><Pressable onPress={() => set({ deliveryMethods: deliveryMethods.filter((_, current) => current !== index) })}><Text style={styles.removeText}>Remove</Text></Pressable></View>
      <Text style={styles.label}>Method</Text><View style={styles.choiceGrid}>{deliveryMethodOptions.map((candidate) => <Choice active={method.kind === candidate.value} key={candidate.value} label={candidate.label} onPress={() => updateDeliveryMethod(index, { kind: candidate.value })} />)}</View>
      <TextField label="Access or handoff details (optional)" onChange={(details) => updateDeliveryMethod(index, { details })} placeholder="e.g., Password-protected gallery; courier fee confirmed separately." value={method.details} />
    </View>)}
    <Pressable onPress={() => set({ deliveryMethods: [...deliveryMethods, { details: '', id: newId('delivery'), kind: 'secure_download_link' }] })} style={styles.addButton}><Text style={styles.addText}>Add delivery method</Text></Pressable>

    <Text style={styles.sectionTitle}>Revision policy</Text><Text style={styles.sectionCopy}>A revision is a change to an agreed deliverable. New concepts or unrelated work can require a separate approved quotation.</Text>
    <View style={styles.card}>
      <NumberField label="Included revision rounds" min={0} onChange={(includedRevisionRounds) => updatePolicy({ includedRevisionRounds })} suffix="rounds" value={revisionPolicy.includedRevisionRounds} />
      {includedRevisions > 0 ? <><Text style={styles.label}>Revision-eligible deliverables</Text><View style={styles.choiceGrid}>{deliverables.map((deliverable, index) => <Choice active={list(revisionPolicy.eligibleDeliverableIds).includes(text(deliverable.id))} key={text(deliverable.id) || index} label={text(deliverable.name) || `Deliverable ${index + 1}`} onPress={() => updatePolicy({ eligibleDeliverableIds: toggleIds(revisionPolicy.eligibleDeliverableIds, text(deliverable.id)) })} />)}</View><View style={styles.twoColumns}><NumberField label="Request period" min={1} onChange={(revisionRequestPeriodDays) => updatePolicy({ revisionRequestPeriodDays })} suffix="days" value={revisionPolicy.revisionRequestPeriodDays} /><NumberField label="Revision turnaround" min={1} onChange={(revisionTurnaroundDays) => updatePolicy({ revisionTurnaroundDays })} suffix="days" value={revisionPolicy.revisionTurnaroundDays} /></View></> : null}
      <NumberField label="Additional revision charge (optional)" min={0} onChange={(additionalRevisionCharge) => updatePolicy({ additionalRevisionCharge })} suffix="PHP" value={revisionPolicy.additionalRevisionCharge} />
      <TextField label="Revision scope note (optional)" onChange={(scopeNote) => updatePolicy({ scopeNote })} placeholder="State what is and is not an included revision." value={revisionPolicy.scopeNote} />
    </View>
  </View>
}

const palette = { border: '#E6E1E2', card: '#FFFBFF', muted: '#6F6A6C', placeholder: '#888386', primary: '#7A1830', primarySoft: '#F8EAEE', text: '#211A1D' }
const styles = StyleSheet.create({
  addButton: { alignItems: 'center', borderColor: palette.primary, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, marginTop: 8, padding: 12 },
  addText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: palette.card, borderColor: palette.border, borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 12 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  choice: { alignItems: 'center', borderColor: palette.border, borderRadius: 9, borderWidth: 1, flexGrow: 1, justifyContent: 'center', minHeight: 39, paddingHorizontal: 6 },
  choiceActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 9 },
  choiceRow: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  choiceText: { color: palette.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  choiceTextActive: { color: palette.primary },
  field: { marginTop: 10 },
  flex: { flex: 1 },
  heading: { borderTopColor: palette.border, borderTopWidth: 1, marginTop: 20, paddingTop: 18 },
  headingCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  headingTitle: { color: palette.primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  helper: { color: palette.muted, fontSize: 11, lineHeight: 16, marginBottom: 5 },
  input: { backgroundColor: '#FFFFFF', borderColor: palette.border, borderRadius: 9, borderWidth: 1, color: palette.text, fontSize: 14, minHeight: 42, paddingHorizontal: 11 },
  label: { color: palette.text, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  numberRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  removeText: { color: palette.primary, fontSize: 12, fontWeight: '800', padding: 5 },
  root: { marginTop: 0 },
  sectionCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '900', marginTop: 20 },
  suffix: { color: palette.muted, fontSize: 12, fontWeight: '700', minWidth: 42 },
  switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  textArea: { minHeight: 68, paddingTop: 10, textAlignVertical: 'top' },
  twoColumns: { flexDirection: 'row', gap: 10 },
})
