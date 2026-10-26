import React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Text } from './AppText'
import { formatPeso } from '../lib/catalog'
import {
  calculatePhotoVideoSelectionPrice,
  defaultPhotoVideoSelection,
  normalizePhotoVideoSelection,
  type PhotoVideoBookingConfiguration,
  type PhotoVideoSelectionSnapshot,
} from '../lib/photo-video-booking'

type Props = {
  commissionRate: number
  configuration: PhotoVideoBookingConfiguration
  onChange: (selection: PhotoVideoSelectionSnapshot) => void
  value?: PhotoVideoSelectionSnapshot
}

const text = (value: unknown) => typeof value === 'string' ? value : ''
const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []

const Choice = ({ active, children, disabled, onPress }: React.PropsWithChildren<{ active: boolean; disabled?: boolean; onPress: () => void }>) => <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={onPress} style={[styles.choice, active && styles.choiceActive, disabled && styles.choiceDisabled]}>{children}</Pressable>
const Quantity = ({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) => <View style={styles.quantityRow}><Text style={styles.quantityLabel}>{label}</Text><Pressable accessibilityLabel={`Decrease ${label}`} onPress={() => onChange(Math.max(1, value - 1))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>−</Text></Pressable><Text style={styles.quantityValue}>{value}</Text><Pressable accessibilityLabel={`Increase ${label}`} onPress={() => onChange(value + 1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable></View>

export const PhotoVideoBookingConfigurator: React.FC<Props> = ({ commissionRate, configuration, onChange, value }) => {
  const selection = normalizePhotoVideoSelection(value ?? defaultPhotoVideoSelection())
  const selectedPackage = configuration.packages.find((pkg) => pkg.id === selection.packageId)
  const supportsPackage = configuration.packages.length > 0
  const supportsCustom = configuration.coverageConfigurations.length > 0
  const calculation = calculatePhotoVideoSelectionPrice(configuration, selection, commissionRate)
  const allowedCrew = selectedPackage
    ? configuration.additionalCrewOptions.filter((item) => selectedPackage.allowedAdditionalCrewOptionIds.includes(item.id))
    : configuration.additionalCrewOptions
  const includedDeliverables = new Set(selectedPackage?.deliverableIds ?? [])
  const allowedAdditionalServices = selectedPackage
    ? configuration.additionalServices.filter((item) => selectedPackage.allowedAdditionalServiceIds.includes(item.id))
    : configuration.additionalServices
  const set = (patch: Partial<PhotoVideoSelectionSnapshot>) => onChange({ ...selection, ...patch })
  const toggleSelection = <T extends { quantity: number }>(items: T[], id: string, key: keyof T, quantity = 1) => {
    const selectedItem = items.find((item) => item[key] === id)
    return selectedItem ? items.filter((item) => item[key] !== id) : [...items, { [key]: id, quantity } as T]
  }
  const updateQuantity = <T extends { quantity: number }>(items: T[], id: string, key: keyof T, quantity: number) => items.map((item) => item[key] === id ? { ...item, quantity } : item)
  const setMethod = (selectionMethod: 'custom' | 'package') => {
    if (selectionMethod === 'package') set({ additionalCrew: [], additionalHours: 0, additionalServices: [], coverageConfigurationId: undefined, deliverables: [], packageId: configuration.packages[0]?.id, rushEditingOptionIds: [], selectionMethod })
    else set({ additionalCrew: [], additionalHours: 0, additionalServices: [], coverageConfigurationId: configuration.coverageConfigurations[0]?.id, deliverables: [], packageId: undefined, rushEditingOptionIds: [], selectionMethod })
  }
  const updateSchedule = (key: keyof PhotoVideoSelectionSnapshot['coverageSchedule'], next: string) => set({ coverageSchedule: { ...selection.coverageSchedule, [key]: next } })
  const updateLocations = (next: string) => set({ coverageLocations: next.split('\n').map((item) => item.trim()).filter(Boolean) })

  return <View style={styles.root}>
    <Text style={styles.heading}>Photo / Video coverage</Text>
    <Text style={styles.caption}>Select only the coverage, crew, outputs, and upgrades offered by this provider. Prices update from their configured rates and already include the marketplace price.</Text>
    {supportsPackage && supportsCustom ? <View style={styles.methodRow}><Choice active={selection.selectionMethod === 'package'} onPress={() => setMethod('package')}><Text style={styles.methodText}>Select a package</Text></Choice><Choice active={selection.selectionMethod === 'custom'} onPress={() => setMethod('custom')}><Text style={styles.methodText}>Customize my coverage</Text></Choice></View> : null}

    {configuration.serviceType === 'combined' ? <View style={styles.section}><Text style={styles.sectionTitle}>Coverage type</Text><View style={styles.methodRow}>{(['photo', 'video', 'combined'] as const).map((mediaType) => <Choice active={selection.requestedMediaType === mediaType} key={mediaType} onPress={() => set({ requestedMediaType: mediaType })}><Text style={styles.methodText}>{mediaType === 'combined' ? 'Photo + video' : mediaType === 'photo' ? 'Photography' : 'Videography'}</Text></Choice>)}</View></View> : null}

    {selection.selectionMethod === 'package' ? <View style={styles.section}><Text style={styles.sectionTitle}>Provider packages</Text>{configuration.packages.map((pkg) => { const packageCoverage = configuration.coverageConfigurations.find((item) => item.id === pkg.coverageConfigurationId); return <Choice active={pkg.id === selection.packageId} key={pkg.id ?? pkg.name} onPress={() => set({ additionalCrew: [], additionalHours: 0, additionalServices: [], deliverables: [], packageId: pkg.id, rushEditingOptionIds: [] })}><View style={styles.choiceHeading}><View><Text style={styles.choiceTitle}>{pkg.name}</Text><Text style={styles.choiceCaption}>{packageCoverage?.durationHours ?? 0} hours · {pkg.deliverableIds.length} included deliverable{pkg.deliverableIds.length === 1 ? '' : 's'}</Text></View><Text style={styles.price}>{formatPeso(pkg.price * (1 + commissionRate))}</Text></View>{pkg.description ? <Text style={styles.choiceCaption}>{pkg.description}</Text> : null}</Choice> })}</View> : <View style={styles.section}><Text style={styles.sectionTitle}>Coverage duration & team</Text><Text style={styles.caption}>Choose one of the provider’s actual coverage configurations.</Text>{configuration.coverageConfigurations.map((item) => <Choice active={item.id === selection.coverageConfigurationId} key={item.id} onPress={() => set({ coverageConfigurationId: item.id })}><View style={styles.choiceHeading}><View><Text style={styles.choiceTitle}>{item.name}</Text><Text style={styles.choiceCaption}>{item.durationHours} hours · {item.includedCrew.map((crew) => `${crew.quantity} ${crew.role}`).join(', ')}</Text></View><Text style={styles.price}>{formatPeso(item.price * (1 + commissionRate))}</Text></View></Choice>)}</View>}

    {allowedCrew.length > 0 ? <View style={styles.section}><Text style={styles.sectionTitle}>Additional crew</Text>{allowedCrew.map((option) => {
      const entry = selection.additionalCrew.find((item) => item.optionId === option.id)
      const selected = Boolean(entry)
      return <View key={option.id} style={[styles.optionCard, selected && styles.optionCardActive]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => set({ additionalCrew: toggleSelection(selection.additionalCrew, option.id, 'optionId') })} style={styles.optionHeader}><View><Text style={styles.choiceTitle}>{selected ? '✓ ' : ''}{option.role}</Text><Text style={styles.choiceCaption}>{formatPeso(option.price * (1 + commissionRate))} / {option.pricingUnit}</Text></View><Text style={styles.selectText}>{selected ? 'Selected' : 'Select'}</Text></Pressable>{entry ? <Quantity label="Crew quantity" onChange={(quantity) => set({ additionalCrew: updateQuantity(selection.additionalCrew, option.id, 'optionId', Math.min(option.maximumQuantity, quantity)) })} value={entry.quantity} /> : null}</View>
    })}</View> : null}

    {configuration.deliverables.length > 0 ? <View style={styles.section}><Text style={styles.sectionTitle}>Deliverables</Text>{configuration.deliverables.map((deliverable) => {
      const included = includedDeliverables.has(deliverable.id)
      const entry = selection.deliverables.find((item) => item.deliverableId === deliverable.id)
      const selected = included || Boolean(entry)
      const label = included ? 'Included in package' : deliverable.pricingMode === 'included' ? 'Included' : `+${formatPeso(deliverable.price * (1 + commissionRate))}${deliverable.pricingMode === 'per_hour' ? ' / hour' : deliverable.pricingMode === 'per_unit' ? ' / unit' : ''}`
      return <View key={deliverable.id} style={[styles.optionCard, selected && styles.optionCardActive]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: included }} disabled={included} onPress={() => set({ deliverables: toggleSelection(selection.deliverables, deliverable.id, 'deliverableId') })} style={styles.optionHeader}><View><Text style={styles.choiceTitle}>{selected ? '✓ ' : ''}{deliverable.name}</Text><Text style={styles.choiceCaption}>{deliverable.deliveryFormat || deliverable.mediaType} · {deliverable.turnaroundDays ? `${deliverable.turnaroundDays} days` : 'Provider turnaround'}</Text></View><Text style={styles.price}>{label}</Text></Pressable>{entry && !included && deliverable.pricingMode !== 'included' ? <Quantity label="Quantity" onChange={(quantity) => set({ deliverables: updateQuantity(selection.deliverables, deliverable.id, 'deliverableId', deliverable.maximumQuantity ? Math.min(deliverable.maximumQuantity, quantity) : quantity) })} value={entry.quantity} /> : null}</View>
    })}</View> : null}

    {allowedAdditionalServices.length > 0 ? <View style={styles.section}><Text style={styles.sectionTitle}>Additional services</Text>{allowedAdditionalServices.map((service) => {
      const entry = selection.additionalServices.find((item) => item.serviceId === service.id)
      return <View key={service.id} style={[styles.optionCard, entry && styles.optionCardActive]}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(entry) }} onPress={() => set({ additionalServices: toggleSelection(selection.additionalServices, service.id, 'serviceId') })} style={styles.optionHeader}><View><Text style={styles.choiceTitle}>{entry ? '✓ ' : ''}{service.name}</Text><Text style={styles.choiceCaption}>{formatPeso(service.price * (1 + commissionRate))} / {service.pricingUnit}</Text></View><Text style={styles.selectText}>{entry ? 'Selected' : 'Select'}</Text></Pressable>{entry && service.pricingUnit !== 'event' ? <Quantity label="Quantity" onChange={(quantity) => set({ additionalServices: updateQuantity(selection.additionalServices, service.id, 'serviceId', service.maximumQuantity ? Math.min(service.maximumQuantity, quantity) : quantity) })} value={entry.quantity} /> : null}</View>
    })}</View> : null}

    {configuration.supportsAdditionalHours ? <View style={styles.section}><Text style={styles.sectionTitle}>Additional coverage hours</Text>{selection.additionalHours > 0 ? <><Quantity label={`Up to ${configuration.maximumAdditionalHours} extra hours · ${formatPeso(configuration.additionalHourRate * (1 + commissionRate))}/hour`} onChange={(additionalHours) => set({ additionalHours: Math.min(configuration.maximumAdditionalHours, additionalHours) })} value={selection.additionalHours} /><Pressable onPress={() => set({ additionalHours: 0 })}><Text style={styles.removeText}>Remove additional hours</Text></Pressable></> : <Pressable onPress={() => set({ additionalHours: 1 })} style={styles.addHoursButton}><Text style={styles.selectText}>Add additional hours · {formatPeso(configuration.additionalHourRate * (1 + commissionRate))}/hour</Text></Pressable>}</View> : null}

    {configuration.postProduction?.rushEditingOptions.filter((option) => option.isAvailable).length ? <View style={styles.section}><Text style={styles.sectionTitle}>Rush editing</Text>{configuration.postProduction.rushEditingOptions.filter((option) => option.isAvailable).map((option) => { const active = selection.rushEditingOptionIds.includes(option.id); const eligible = option.deliverableIds.some((id) => includedDeliverables.has(id) || selection.deliverables.some((item) => item.deliverableId === id)); return <Choice active={active} disabled={!eligible} key={option.id} onPress={() => set({ rushEditingOptionIds: active ? selection.rushEditingOptionIds.filter((id) => id !== option.id) : [...selection.rushEditingOptionIds, option.id] })}><View style={styles.choiceHeading}><View><Text style={styles.choiceTitle}>{active ? '✓ ' : ''}Rush delivery</Text><Text style={styles.choiceCaption}>{eligible ? `${option.turnaroundDays} days · Eligible outputs selected` : 'Select an eligible deliverable first'}</Text></View><Text style={styles.price}>+{formatPeso(option.additionalCharge * (1 + commissionRate))}</Text></View></Choice> })}</View> : null}

    {configuration.allowsClientCoverageSchedule ? <View style={styles.section}><Text style={styles.sectionTitle}>Requested coverage schedule</Text><Text style={styles.caption}>These are requests for provider review, not a confirmed schedule.</Text><View style={styles.twoColumns}><TextInput onChangeText={(next) => updateSchedule('coverageStart', next)} placeholder="Coverage start" placeholderTextColor="#777" style={styles.input} value={text(selection.coverageSchedule.coverageStart)} /><TextInput onChangeText={(next) => updateSchedule('coverageEnd', next)} placeholder="Coverage end" placeholderTextColor="#777" style={styles.input} value={text(selection.coverageSchedule.coverageEnd)} /></View><TextInput onChangeText={(next) => updateSchedule('preparation', next)} placeholder="Preparation schedule (optional)" placeholderTextColor="#777" style={styles.input} value={text(selection.coverageSchedule.preparation)} /><TextInput onChangeText={(next) => updateSchedule('ceremony', next)} placeholder="Ceremony schedule (optional)" placeholderTextColor="#777" style={styles.input} value={text(selection.coverageSchedule.ceremony)} /><TextInput onChangeText={(next) => updateSchedule('reception', next)} placeholder="Reception schedule (optional)" placeholderTextColor="#777" style={styles.input} value={text(selection.coverageSchedule.reception)} />{configuration.allowsMultipleLocations ? <TextInput multiline onChangeText={updateLocations} placeholder="Coverage locations — one per line" placeholderTextColor="#777" style={[styles.input, styles.locationsInput]} value={list(selection.coverageLocations).join('\n')} /> : null}</View> : null}

    <View style={styles.priceSummary}><Text style={styles.priceSummaryLabel}>Current marketplace price</Text><Text style={styles.priceSummaryValue}>{formatPeso(calculation.clientTotal)}</Text><Text style={styles.priceSummaryCopy}>Includes the marketplace price. Your detailed provider requests, including must-have shots and references, stay in the existing Instruction Module after selection.</Text></View>
  </View>
}

const styles = StyleSheet.create({
  root: { gap: 12 }, heading: { color: '#4E061A', fontSize: 20, fontWeight: '800' }, caption: { color: '#5E5E5E', fontSize: 13, lineHeight: 19 }, section: { borderTopColor: '#E2E2E2', borderTopWidth: 1, gap: 8, paddingTop: 14 }, sectionTitle: { color: '#1A1C1C', fontSize: 16, fontWeight: '800' }, methodRow: { flexDirection: 'row', gap: 8 }, methodText: { color: '#4E061A', fontSize: 12, fontWeight: '800', textAlign: 'center' }, choice: { borderColor: '#E2E2E2', borderRadius: 10, borderWidth: 1, flex: 1, padding: 12 }, choiceActive: { backgroundColor: '#FDF4F6', borderColor: '#6B1E2E' }, choiceDisabled: { opacity: 0.6 }, choiceHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, choiceTitle: { color: '#1A1C1C', fontSize: 14, fontWeight: '700' }, choiceCaption: { color: '#5E5E5E', fontSize: 12, lineHeight: 17, marginTop: 3 }, price: { color: '#4E061A', fontSize: 13, fontWeight: '800', textAlign: 'right' }, optionCard: { borderColor: '#E2E2E2', borderRadius: 10, borderWidth: 1, overflow: 'hidden' }, optionCardActive: { borderColor: '#6B1E2E' }, optionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 12 }, selectText: { color: '#4E061A', fontSize: 12, fontWeight: '800' }, addHoursButton: { borderColor: '#D8CDD0', borderRadius: 8, borderWidth: 1, padding: 11 }, quantityRow: { alignItems: 'center', borderTopColor: '#EEE7E9', borderTopWidth: 1, flexDirection: 'row', gap: 9, padding: 10 }, quantityLabel: { color: '#303033', flex: 1, fontSize: 12, fontWeight: '700' }, quantityButton: { alignItems: 'center', backgroundColor: '#4E061A', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 }, quantityButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800' }, quantityValue: { color: '#1A1C1C', fontSize: 14, fontWeight: '800', minWidth: 18, textAlign: 'center' }, removeText: { color: '#7A1830', fontSize: 12, fontWeight: '800', textAlign: 'right' }, twoColumns: { flexDirection: 'row', gap: 8 }, input: { backgroundColor: '#FFF', borderColor: '#D8CDD0', borderRadius: 8, borderWidth: 1, color: '#1A1C1C', flex: 1, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 }, locationsInput: { minHeight: 76, textAlignVertical: 'top' }, priceSummary: { backgroundColor: '#F7EFEF', borderColor: '#E7D9DD', borderRadius: 12, borderWidth: 1, gap: 3, padding: 14 }, priceSummaryLabel: { color: '#5E5E5E', fontSize: 12, fontWeight: '700' }, priceSummaryValue: { color: '#4E061A', fontSize: 22, fontWeight: '900' }, priceSummaryCopy: { color: '#5E5E5E', fontSize: 12, lineHeight: 18 },
})
