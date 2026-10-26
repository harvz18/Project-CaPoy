import React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Text } from './AppText'
import type { ServiceCategoryDetails } from '../lib/service-category-details'

type RecordValue = Record<string, unknown>
type Props = { details: ServiceCategoryDetails; onChange: (value: ServiceCategoryDetails) => void }

const asRecord = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const asRows = (value: unknown) => Array.isArray(value) ? value.map(asRecord) : []
const text = (value: unknown) => typeof value === 'string' ? value : ''
const numberText = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value : ''
const number = (value: string) => { const parsed = Number(value.replace(/[^\d.]/g, '')); return Number.isFinite(parsed) && value.trim() ? parsed : undefined }
const rolesText = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join(', ') : ''
const rolesFromText = (value: string) => Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)))
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const Field = ({ children, helper, label }: React.PropsWithChildren<{ helper?: string; label: string }>) => <View style={styles.field}><Text style={styles.label}>{label}</Text>{helper ? <Text style={styles.helper}>{helper}</Text> : null}{children}</View>
const TextField = ({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder?: string; value: unknown }) => <Field label={label}><TextInput onChangeText={onChange} placeholder={placeholder} placeholderTextColor={palette.placeholder} style={styles.input} value={text(value)} /></Field>
const NumberField = ({ label, min = 0, onChange, suffix, value }: { label: string; min?: number; onChange: (value?: number) => void; suffix?: string; value: unknown }) => <Field label={label}><View style={styles.numberRow}><TextInput inputMode="decimal" keyboardType="decimal-pad" onChangeText={(next) => { const parsed = number(next); onChange(parsed === undefined ? undefined : Math.max(min, parsed)) }} placeholder="0" placeholderTextColor={palette.placeholder} style={[styles.input, styles.flex]} value={numberText(value)} />{suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}</View></Field>
const Choice = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>

export const PhotoVideoDeliverablesEditor: React.FC<Props> = ({ details, onChange }) => {
  const deliverables = asRows(details.deliverableConfigurations)
  const additionalServices = asRows(details.additionalServices)
  const serviceType = text(details.photoVideoServiceType)
  const allowedMediaTypes = serviceType === 'photography' ? ['photo'] : serviceType === 'videography' ? ['video'] : ['photo', 'video', 'both']
  const configuredRoles = Array.from(new Set([
    ...asRows(details.coverageConfigurations).flatMap((coverage) => asRows(coverage.includedCrew)).map((crew) => text(crew.role)).filter(Boolean),
    ...asRows(details.additionalCrewOptions).map((crew) => text(crew.role)).filter(Boolean),
  ])).join(', ')
  const set = (patch: RecordValue) => onChange({ ...details, ...patch })
  const updateDeliverable = (index: number, patch: RecordValue) => set({ deliverableConfigurations: deliverables.map((deliverable, current) => current === index ? { ...deliverable, ...patch } : deliverable) })
  const updateAdditionalService = (index: number, patch: RecordValue) => set({ additionalServices: additionalServices.map((service, current) => current === index ? { ...service, ...patch } : service) })

  return <View style={styles.root}>
    <View style={styles.heading}><Text style={styles.headingTitle}>DELIVERABLES & ADDITIONAL SERVICES</Text><Text style={styles.headingCopy}>Define only outputs and upgrades you can deliver. These records, including their quantities and prices, will be the client-facing choices in the booking flow.</Text></View>
    <Text style={styles.sectionTitle}>Promised deliverables</Text>
    {deliverables.map((deliverable, index) => {
      const pricingMode = text(deliverable.pricingMode) || 'included'
      return <View key={text(deliverable.id) || `deliverable-${index}`} style={styles.card}>
        <View style={styles.cardHeader}><Text style={styles.cardTitle}>Deliverable {index + 1}</Text><Pressable onPress={() => set({ deliverableConfigurations: deliverables.filter((_, current) => current !== index) })}><Text style={styles.removeText}>Remove</Text></Pressable></View>
        <TextField label="Deliverable name" onChange={(name) => updateDeliverable(index, { name })} placeholder="e.g., Edited digital gallery" value={deliverable.name} />
        <Text style={styles.label}>Applies to</Text><View style={styles.choiceRow}>{allowedMediaTypes.map((mediaType) => <Choice active={deliverable.mediaType === mediaType} key={mediaType} label={mediaType === 'both' ? 'Photo + Video' : mediaType === 'photo' ? 'Photo' : 'Video'} onPress={() => updateDeliverable(index, { mediaType })} />)}</View>
        <Text style={styles.label}>Pricing</Text><View style={styles.choiceGrid}>{(['included', 'fixed', 'per_unit', 'per_hour'] as const).map((mode) => <Choice active={pricingMode === mode} key={mode} label={({ included: 'Included', fixed: 'Fixed price', per_unit: 'Per unit', per_hour: 'Per hour' })[mode]} onPress={() => updateDeliverable(index, { pricingMode: mode, price: mode === 'included' ? 0 : deliverable.price })} />)}</View>
        {pricingMode !== 'included' ? <NumberField label="Provider price" min={1} onChange={(price) => updateDeliverable(index, { price })} suffix="PHP" value={deliverable.price} /> : null}
        <View style={styles.twoColumns}><NumberField label="Included quantity" min={pricingMode === 'included' ? 1 : 0} onChange={(includedQuantity) => updateDeliverable(index, { includedQuantity })} value={deliverable.includedQuantity} /><NumberField label="Maximum quantity (optional)" min={0} onChange={(maximumQuantity) => updateDeliverable(index, { maximumQuantity })} value={deliverable.maximumQuantity} /></View>
        <TextField label="Delivery format (optional)" onChange={(deliveryFormat) => updateDeliverable(index, { deliveryFormat })} placeholder="e.g., Online gallery, USB, printed album" value={deliverable.deliveryFormat} />
        <NumberField label="Delivery turnaround (optional)" min={0} onChange={(turnaroundDays) => updateDeliverable(index, { turnaroundDays })} suffix="days" value={deliverable.turnaroundDays} />
        <TextField label="Required crew roles (optional)" onChange={(requiredCrewRoles) => updateDeliverable(index, { requiredCrewRoles: rolesFromText(requiredCrewRoles) })} placeholder="Separate roles with commas" value={rolesText(deliverable.requiredCrewRoles)} />
      </View>
    })}
    <Pressable onPress={() => set({ deliverableConfigurations: [...deliverables, { id: newId('deliverable'), includedQuantity: 1, maximumQuantity: undefined, mediaType: allowedMediaTypes[0], name: '', price: 0, pricingMode: 'included', requiredCrewRoles: [] }] })} style={styles.addButton}><Text style={styles.addText}>Add promised deliverable</Text></Pressable>

    <Text style={styles.sectionTitle}>Optional additional services</Text>
    <Text style={styles.sectionCopy}>Use this for provider-supported upgrades such as extra coverage, production services, or extra outputs. Do not add a capability your configured crew cannot support.</Text>
    {configuredRoles ? <Text style={styles.rolesNote}>Configured crew roles: {configuredRoles}</Text> : <Text style={styles.rolesNote}>Add included or additional crew first if an option depends on a specific role.</Text>}
    {additionalServices.map((service, index) => <View key={text(service.id) || `additional-service-${index}`} style={styles.card}>
      <View style={styles.cardHeader}><Text style={styles.cardTitle}>Additional service {index + 1}</Text><Pressable onPress={() => set({ additionalServices: additionalServices.filter((_, current) => current !== index) })}><Text style={styles.removeText}>Remove</Text></Pressable></View>
      <TextField label="Service name" onChange={(name) => updateAdditionalService(index, { name })} placeholder="e.g., Additional edited photos" value={service.name} />
      <View style={styles.twoColumns}><NumberField label="Provider price" min={1} onChange={(price) => updateAdditionalService(index, { price })} suffix="PHP" value={service.price} /><NumberField label="Maximum quantity (optional)" min={0} onChange={(maximumQuantity) => updateAdditionalService(index, { maximumQuantity })} value={service.maximumQuantity} /></View>
      <Text style={styles.label}>Price type</Text><View style={styles.choiceRow}>{(['event', 'hour', 'unit'] as const).map((pricingUnit) => <Choice active={service.pricingUnit === pricingUnit} key={pricingUnit} label={pricingUnit === 'event' ? 'Per event' : pricingUnit === 'hour' ? 'Per hour' : 'Per unit'} onPress={() => updateAdditionalService(index, { pricingUnit })} />)}</View>
      <TextField label="Required crew roles (optional)" onChange={(requiredCrewRoles) => updateAdditionalService(index, { requiredCrewRoles: rolesFromText(requiredCrewRoles) })} placeholder="Separate roles with commas" value={rolesText(service.requiredCrewRoles)} />
    </View>)}
    <Pressable onPress={() => set({ additionalServices: [...additionalServices, { id: newId('additional-service'), maximumQuantity: undefined, name: '', price: undefined, pricingUnit: 'event', requiredCrewRoles: [] }] })} style={styles.addButton}><Text style={styles.addText}>Add optional additional service</Text></Pressable>
  </View>
}

const palette = { border: '#E6E1E2', card: '#FFFBFF', muted: '#6F6A6C', placeholder: '#888386', primary: '#7A1830', primarySoft: '#F8EAEE', text: '#211A1D' }
const styles = StyleSheet.create({
  addButton: { alignItems: 'center', borderColor: palette.primary, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, marginTop: 8, padding: 12 },
  addText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: palette.card, borderColor: palette.border, borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 12 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  choice: { alignItems: 'center', borderColor: palette.border, borderRadius: 9, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 39, paddingHorizontal: 6 },
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
  rolesNote: { backgroundColor: '#FFF5F6', borderColor: '#F0D5DB', borderRadius: 9, borderWidth: 1, color: palette.primary, fontSize: 12, lineHeight: 18, marginTop: 9, padding: 10 },
  root: { marginTop: 0 },
  sectionCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '900', marginTop: 20 },
  suffix: { color: palette.muted, fontSize: 12, fontWeight: '700', minWidth: 42 },
  twoColumns: { flexDirection: 'row', gap: 10 },
})
