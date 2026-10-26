import React from 'react'
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
import { Text } from './AppText'
import type { ServiceCategoryDetails } from '../lib/service-category-details'

type RecordValue = Record<string, unknown>

type Props = {
  details: ServiceCategoryDetails
  onChange: (value: ServiceCategoryDetails) => void
}

const asRecord = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const asRows = (value: unknown) => Array.isArray(value) ? value.map(asRecord) : []
const stringValue = (value: unknown) => typeof value === 'string' ? value : ''
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? String(value)
  : typeof value === 'string' ? value : ''
const parseNumber = (value: string) => {
  const parsed = Number(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) && value.trim() ? parsed : undefined
}
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const Section = ({ children, description, title }: React.PropsWithChildren<{ description?: string; title: string }>) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
    {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    {children}
  </View>
)

const Field = ({ children, label, helper }: React.PropsWithChildren<{ helper?: string; label: string }>) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    {children}
  </View>
)

const TextField = ({ label, onChange, placeholder, value }: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: unknown
}) => <Field label={label}><TextInput onChangeText={onChange} placeholder={placeholder} placeholderTextColor={palette.placeholder} style={styles.input} value={stringValue(value)} /></Field>

const NumberField = ({ helper, label, min = 0, onChange, suffix, value }: {
  helper?: string
  label: string
  min?: number
  onChange: (value?: number) => void
  suffix?: string
  value: unknown
}) => <Field helper={helper} label={label}><View style={styles.numberRow}><TextInput inputMode="decimal" keyboardType="decimal-pad" onChangeText={(next) => {
  const parsed = parseNumber(next)
  onChange(parsed === undefined ? undefined : Math.max(min, parsed))
}} placeholder="0" placeholderTextColor={palette.placeholder} style={[styles.input, styles.flex]} value={numberValue(value)} />{suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}</View></Field>

const Toggle = ({ label, onChange, value }: { label: string; onChange: (value: boolean) => void; value: unknown }) => (
  <View style={styles.toggleRow}><Text style={styles.toggleLabel}>{label}</Text><Switch onValueChange={onChange} thumbColor="#FFFFFF" trackColor={{ false: '#C9C7C8', true: palette.primary }} value={value === true} /></View>
)

export const PhotoVideoCoverageEditor: React.FC<Props> = ({ details, onChange }) => {
  const coverageConfigurations = asRows(details.coverageConfigurations)
  const additionalCrewOptions = asRows(details.additionalCrewOptions)
  const set = (patch: RecordValue) => onChange({ ...details, ...patch })
  const updateCoverage = (coverageIndex: number, patch: RecordValue) => set({
    coverageConfigurations: coverageConfigurations.map((configuration, index) => index === coverageIndex
      ? { ...configuration, ...patch }
      : configuration),
  })
  const updateIncludedCrew = (coverageIndex: number, crewIndex: number, patch: RecordValue) => {
    const currentCrew = asRows(coverageConfigurations[coverageIndex]?.includedCrew)
    updateCoverage(coverageIndex, {
      includedCrew: currentCrew.map((crew, index) => index === crewIndex ? { ...crew, ...patch } : crew),
    })
  }
  const updateAdditionalCrew = (crewIndex: number, patch: RecordValue) => set({
    additionalCrewOptions: additionalCrewOptions.map((option, index) => index === crewIndex
      ? { ...option, ...patch }
      : option),
  })

  return <>
    <Section title="Bookable Coverage Configurations" description="Create only the durations and included teams you actually offer. Each coverage option has its own provider price.">
      {coverageConfigurations.map((configuration, coverageIndex) => {
        const includedCrew = asRows(configuration.includedCrew)
        return <View key={stringValue(configuration.id) || `coverage-${coverageIndex}`} style={styles.card}>
          <View style={styles.cardHeader}><Text style={styles.cardTitle}>Coverage option {coverageIndex + 1}</Text><Pressable onPress={() => set({ coverageConfigurations: coverageConfigurations.filter((_, index) => index !== coverageIndex) })} style={styles.removeButton}><Text style={styles.removeText}>Remove</Text></Pressable></View>
          <TextField label="Coverage name" onChange={(name) => updateCoverage(coverageIndex, { name })} placeholder="e.g., Full event coverage" value={configuration.name} />
          <View style={styles.twoColumns}><NumberField label="Included duration" min={1} onChange={(durationHours) => updateCoverage(coverageIndex, { durationHours })} suffix="hours" value={configuration.durationHours} /><NumberField label="Provider price" min={1} onChange={(price) => updateCoverage(coverageIndex, { price })} suffix="PHP" value={configuration.price} /></View>
          <Text style={styles.subheading}>Included crew</Text>
          {includedCrew.map((crew, crewIndex) => <View key={`${stringValue(crew.role)}-${crewIndex}`} style={styles.crewRow}>
            <View style={styles.crewRole}><TextField label="Role" onChange={(role) => updateIncludedCrew(coverageIndex, crewIndex, { role })} placeholder="e.g., Lead Photographer" value={crew.role} /></View>
            <View style={styles.crewQuantity}><NumberField label="Qty" min={1} onChange={(quantity) => updateIncludedCrew(coverageIndex, crewIndex, { quantity })} value={crew.quantity} /></View>
            <Pressable accessibilityLabel="Remove included crew" onPress={() => updateCoverage(coverageIndex, { includedCrew: includedCrew.filter((_, index) => index !== crewIndex) })} style={styles.iconRemove}><Text style={styles.iconRemoveText}>−</Text></Pressable>
          </View>)}
          <Pressable onPress={() => updateCoverage(coverageIndex, { includedCrew: [...includedCrew, { quantity: 1, role: '' }] })} style={styles.secondaryButton}><Text style={styles.secondaryText}>Add included crew</Text></Pressable>
        </View>
      })}
      <Pressable onPress={() => set({ coverageConfigurations: [...coverageConfigurations, { durationHours: undefined, id: newId('coverage'), includedCrew: [], name: '', price: undefined }] })} style={styles.addButton}><Text style={styles.addText}>Add coverage option</Text></Pressable>
    </Section>

    <Section title="Additional Crew & Team Capacity" description="Optional extra crew is only available when you configure its maximum quantity and provider price.">
      {additionalCrewOptions.map((option, crewIndex) => <View key={stringValue(option.id) || `additional-${crewIndex}`} style={styles.card}>
        <View style={styles.cardHeader}><Text style={styles.cardTitle}>Additional crew {crewIndex + 1}</Text><Pressable onPress={() => set({ additionalCrewOptions: additionalCrewOptions.filter((_, index) => index !== crewIndex) })} style={styles.removeButton}><Text style={styles.removeText}>Remove</Text></Pressable></View>
        <TextField label="Crew role" onChange={(role) => updateAdditionalCrew(crewIndex, { role })} placeholder="e.g., Drone Operator" value={option.role} />
        <View style={styles.twoColumns}><NumberField label="Maximum available" min={1} onChange={(maximumQuantity) => updateAdditionalCrew(crewIndex, { maximumQuantity })} value={option.maximumQuantity} /><NumberField label="Provider price" min={1} onChange={(price) => updateAdditionalCrew(crewIndex, { price })} suffix="PHP" value={option.price} /></View>
        <Text style={styles.label}>Price type</Text><View style={styles.choiceRow}>{(['event', 'hour'] as const).map((pricingUnit) => <Pressable key={pricingUnit} onPress={() => updateAdditionalCrew(crewIndex, { pricingUnit })} style={[styles.choice, option.pricingUnit === pricingUnit && styles.choiceActive]}><Text style={[styles.choiceText, option.pricingUnit === pricingUnit && styles.choiceTextActive]}>{pricingUnit === 'event' ? 'Per event' : 'Per hour'}</Text></Pressable>)}</View>
      </View>)}
      <Pressable onPress={() => set({ additionalCrewOptions: [...additionalCrewOptions, { id: newId('crew'), maximumQuantity: 1, price: undefined, pricingUnit: 'event', role: '' }] })} style={styles.addButton}><Text style={styles.addText}>Add additional crew option</Text></Pressable>
      <NumberField label="Coverage team capacity" helper="How many separate teams can accept overlapping coverage at the same time." min={1} onChange={(teamCapacity) => set({ teamCapacity })} suffix="teams" value={details.teamCapacity} />
    </Section>

    <Section title="Coverage Schedule & Locations" description="Clients will select their requested schedule later; this sets the limits your team can support.">
      <Toggle label="Allow clients to request a coverage schedule" onChange={(allowsClientCoverageSchedule) => set({ allowsClientCoverageSchedule })} value={details.allowsClientCoverageSchedule !== false} />
      <NumberField label="Schedule flexibility" helper="Allowed difference from the requested coverage schedule." min={0} onChange={(scheduleFlexibilityMinutes) => set({ scheduleFlexibilityMinutes })} suffix="minutes" value={details.scheduleFlexibilityMinutes} />
      <Toggle label="Support multiple coverage locations" onChange={(allowsMultipleLocations) => set({ allowsMultipleLocations })} value={details.allowsMultipleLocations === true} />
      {details.allowsMultipleLocations === true ? <><NumberField label="Additional-location fee (optional)" min={0} onChange={(additionalLocationFee) => set({ additionalLocationFee })} suffix="PHP" value={details.additionalLocationFee} /><TextField label="Travel-time guidance (optional)" onChange={(travelTimeNotes) => set({ travelTimeNotes })} placeholder="Describe time or distance limits between locations." value={details.travelTimeNotes} /></> : null}
    </Section>

    <Section title="Extra Hours & Overtime" description="Prebooked extra hours are agreed before confirmation. Event-day overtime remains separately authorized by the client.">
      <Toggle label="Allow prebooked additional hours" onChange={(additionalHoursAllowed) => set({ additionalHoursAllowed })} value={details.additionalHoursAllowed === true} />
      {details.additionalHoursAllowed === true ? <View style={styles.twoColumns}><NumberField label="Additional-hour rate" min={1} onChange={(additionalHourRate) => set({ additionalHourRate })} suffix="PHP / hour" value={details.additionalHourRate} /><NumberField label="Maximum extra hours" min={1} onChange={(maximumAdditionalHours) => set({ maximumAdditionalHours })} suffix="hours" value={details.maximumAdditionalHours} /></View> : null}
      <Toggle label="Allow event-day overtime" onChange={(overtimeAllowed) => set({ overtimeAllowed, overtimeRequiresAuthorization: overtimeAllowed ? true : details.overtimeRequiresAuthorization })} value={details.overtimeAllowed === true} />
      {details.overtimeAllowed === true ? <><View style={styles.twoColumns}><NumberField label="Overtime rate" min={1} onChange={(overtimeRate) => set({ overtimeRate })} suffix="PHP / hour" value={details.overtimeRate} /><NumberField label="Minimum overtime increment" min={0.25} onChange={(overtimeMinimumIncrementHours) => set({ overtimeMinimumIncrementHours })} suffix="hours" value={details.overtimeMinimumIncrementHours} /></View><Text style={styles.authorizationNote}>Client authorization is required before event-day overtime can create an additional charge.</Text></> : null}
    </Section>
  </>
}

const palette = { border: '#E6E1E2', card: '#FFFBFF', muted: '#6F6A6C', placeholder: '#888386', primary: '#7A1830', primarySoft: '#F8EAEE', text: '#211A1D' }
const styles = StyleSheet.create({
  addButton: { alignItems: 'center', borderColor: palette.primary, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, marginTop: 6, padding: 12 },
  addText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  authorizationNote: { backgroundColor: '#FFF5F6', borderColor: '#F0D5DB', borderRadius: 9, borderWidth: 1, color: palette.primary, fontSize: 12, lineHeight: 18, marginTop: 8, padding: 10 },
  card: { backgroundColor: palette.card, borderColor: palette.border, borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 12 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  cardTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  choice: { borderColor: palette.border, borderRadius: 9, borderWidth: 1, flex: 1, paddingHorizontal: 10, paddingVertical: 9 },
  choiceActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  choiceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  choiceText: { color: palette.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  choiceTextActive: { color: palette.primary },
  crewQuantity: { width: 76 },
  crewRole: { flex: 1 },
  crewRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 8 },
  field: { marginTop: 11 },
  flex: { flex: 1 },
  helper: { color: palette.muted, fontSize: 11, lineHeight: 16, marginBottom: 5 },
  iconRemove: { alignItems: 'center', borderColor: '#E5BBC5', borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', marginBottom: 11, width: 36 },
  iconRemoveText: { color: palette.primary, fontSize: 20, fontWeight: '700' },
  input: { backgroundColor: '#FFFFFF', borderColor: palette.border, borderRadius: 9, borderWidth: 1, color: palette.text, fontSize: 14, minHeight: 42, paddingHorizontal: 11 },
  label: { color: palette.text, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  numberRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  removeButton: { paddingHorizontal: 4, paddingVertical: 5 },
  removeText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  section: { borderTopColor: palette.border, borderTopWidth: 1, marginTop: 20, paddingTop: 18 },
  sectionDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: palette.primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  secondaryButton: { alignItems: 'center', borderColor: palette.border, borderRadius: 9, borderWidth: 1, marginTop: 6, padding: 10 },
  secondaryText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  subheading: { color: palette.text, fontSize: 12, fontWeight: '900', marginBottom: 1, marginTop: 13 },
  suffix: { color: palette.muted, fontSize: 12, fontWeight: '700', minWidth: 50 },
  toggleLabel: { color: palette.text, flex: 1, fontSize: 13, fontWeight: '700', paddingRight: 10 },
  toggleRow: { alignItems: 'center', flexDirection: 'row', marginTop: 12, minHeight: 38 },
  twoColumns: { flexDirection: 'row', gap: 10 },
})
