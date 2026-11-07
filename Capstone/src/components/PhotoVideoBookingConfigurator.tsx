import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from './AppText'
import { formatPeso } from '../lib/catalog'
import { neutralSelection } from '../theme/neumorphism'
import { animateOptionLayout } from '../theme/option-motion'
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
  neumorphic?: boolean
  onChange: (selection: PhotoVideoSelectionSnapshot) => void
  onOptionSelected?: (node: React.ElementRef<typeof View> | null) => void
  value?: PhotoVideoSelectionSnapshot
}

const PackageChoice = ({ active, children, neumorphic, onPress, setNode }: React.PropsWithChildren<{ active: boolean; neumorphic: boolean; onPress: () => void; setNode: (node: React.ElementRef<typeof View> | null) => void }>) => (
  <Pressable ref={setNode} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={[styles.choice, neumorphic && (active ? styles.neoRaised : styles.neoInset), active && styles.choiceActive]}>
    {children}
  </Pressable>
)

const Quantity = ({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) => (
  <View style={styles.quantityRow}>
    <Text style={styles.quantityLabel}>{label}</Text>
    <Pressable accessibilityLabel={`Decrease ${label}`} onPress={() => onChange(Math.max(1, value - 1))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>−</Text></Pressable>
    <Text style={styles.quantityValue}>{value}</Text>
    <Pressable accessibilityLabel={`Increase ${label}`} onPress={() => onChange(value + 1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable>
  </View>
)

export const PhotoVideoBookingConfigurator: React.FC<Props> = ({ commissionRate, configuration, neumorphic = false, onChange, onOptionSelected, value }) => {
  const selection = normalizePhotoVideoSelection(value ?? defaultPhotoVideoSelection())
  const selectedPackage = configuration.packages.find((item) => item.id === selection.packageId)
  const calculation = calculatePhotoVideoSelectionPrice(configuration, selection, commissionRate)
  const allowedAdditionalServices = selectedPackage
    ? configuration.additionalServices.filter((item) => selectedPackage.allowedAdditionalServiceIds.includes(item.id))
    : []
  const includedDeliverables = new Set(selectedPackage?.deliverableIds ?? [])
  const optionRefs = React.useRef<Record<string, React.ElementRef<typeof View> | null>>({})
  const focusSelectedOption = (optionKey: string) => onOptionSelected?.(optionRefs.current[optionKey])
  const set = (patch: Partial<PhotoVideoSelectionSnapshot>) => onChange({ ...selection, ...patch })
  const choosePackage = (packageId?: string) => {
    animateOptionLayout()
    set({
      additionalCrew: [],
      additionalHours: 0,
      additionalServices: [],
      coverageConfigurationId: undefined,
      coverageLocations: [],
      coverageSchedule: {},
      deliverables: [],
      packageId,
      rushEditingOptionIds: [],
      selectionMethod: 'package',
    })
    if (packageId) focusSelectedOption(`package:${packageId}`)
  }
  const toggleDeliverable = (deliverableId: string) => {
    const wasSelected = selection.deliverables.some((item) => item.deliverableId === deliverableId)
    animateOptionLayout()
    set({
      deliverables: wasSelected
        ? selection.deliverables.filter((item) => item.deliverableId !== deliverableId)
        : [...selection.deliverables, { deliverableId, quantity: 1 }],
    })
    if (!wasSelected) focusSelectedOption(`deliverable:${deliverableId}`)
  }
  const toggleAdditionalService = (serviceId: string) => {
    const wasSelected = selection.additionalServices.some((item) => item.serviceId === serviceId)
    animateOptionLayout()
    set({
      additionalServices: wasSelected
        ? selection.additionalServices.filter((item) => item.serviceId !== serviceId)
        : [...selection.additionalServices, { serviceId, quantity: 1 }],
    })
    if (!wasSelected) focusSelectedOption(`additional:${serviceId}`)
  }
  const updateDeliverableQuantity = (deliverableId: string, quantity: number) => set({
    deliverables: selection.deliverables.map((item) => item.deliverableId === deliverableId ? { ...item, quantity } : item),
  })
  const updateServiceQuantity = (serviceId: string, quantity: number) => set({
    additionalServices: selection.additionalServices.map((item) => item.serviceId === serviceId ? { ...item, quantity } : item),
  })

  return <View style={styles.root}>
    <Text style={styles.heading}>Photo / Video packages</Text>
    <Text style={styles.caption}>Choose one package, then select only the optional inclusions offered with it. Prices already include the marketplace price.</Text>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Available packages</Text>
      {configuration.packages.map((pkg) => {
        const coverage = configuration.coverageConfigurations.find((item) => item.id === pkg.coverageConfigurationId)
        const inclusions = configuration.deliverables.filter((item) => pkg.deliverableIds.includes(item.id))
        return <PackageChoice active={selection.selectionMethod === 'package' && pkg.id === selection.packageId} key={pkg.id ?? pkg.name} neumorphic={neumorphic} onPress={() => choosePackage(pkg.id)} setNode={(node) => { optionRefs.current[`package:${pkg.id}`] = node }}>
          <View style={styles.choiceHeading}>
            <View style={styles.choiceCopy}>
              <Text style={styles.choiceTitle}>{pkg.name}</Text>
              <Text style={styles.choiceCaption}>{coverage?.durationHours ?? 0} hours · {pkg.description || 'Provider preset package'}</Text>
            </View>
            <Text style={styles.price}>{formatPeso(pkg.price * (1 + commissionRate))}</Text>
          </View>
          {inclusions.length ? <Text style={styles.choiceCaption}>Includes: {inclusions.map((item) => item.name).join(', ')}</Text> : null}
        </PackageChoice>
      })}
      {configuration.packages.length === 0 ? <Text style={styles.unavailable}>This provider has no active packages available right now.</Text> : null}
    </View>

    {selectedPackage && configuration.deliverables.length > 0 ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Package inclusions and optional upgrades</Text>
      {configuration.deliverables.map((deliverable) => {
        const included = includedDeliverables.has(deliverable.id)
        const entry = selection.deliverables.find((item) => item.deliverableId === deliverable.id)
        const selected = included || Boolean(entry)
        const label = included ? 'Included' : deliverable.pricingMode === 'included'
          ? 'Included'
          : `+${formatPeso(deliverable.price * (1 + commissionRate))}${deliverable.pricingMode === 'per_hour' ? ' / hour' : deliverable.pricingMode === 'per_unit' ? ' / unit' : ''}`
        return <View ref={(node) => { optionRefs.current[`deliverable:${deliverable.id}`] = node }} key={deliverable.id} style={[styles.optionCard, neumorphic && (selected ? styles.neoRaised : styles.neoInset), selected && styles.optionCardActive]}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: included }} disabled={included} onPress={() => toggleDeliverable(deliverable.id)} style={styles.optionHeader}>
            <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{selected ? '✓ ' : ''}{deliverable.name}</Text><Text style={styles.choiceCaption}>{deliverable.deliveryFormat || deliverable.mediaType}</Text></View>
            <Text style={styles.price}>{label}</Text>
          </Pressable>
          {entry && !included && deliverable.pricingMode !== 'included' ? <Quantity label="Quantity" onChange={(quantity) => updateDeliverableQuantity(deliverable.id, deliverable.maximumQuantity ? Math.min(deliverable.maximumQuantity, quantity) : quantity)} value={entry.quantity} /> : null}
        </View>
      })}
    </View> : null}

    {selectedPackage && allowedAdditionalServices.length > 0 ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Optional services</Text>
      {allowedAdditionalServices.map((service) => {
        const entry = selection.additionalServices.find((item) => item.serviceId === service.id)
        return <View ref={(node) => { optionRefs.current[`additional:${service.id}`] = node }} key={service.id} style={[styles.optionCard, neumorphic && (entry ? styles.neoRaised : styles.neoInset), entry && styles.optionCardActive]}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(entry) }} onPress={() => toggleAdditionalService(service.id)} style={styles.optionHeader}>
            <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{entry ? '✓ ' : ''}{service.name}</Text><Text style={styles.choiceCaption}>Provider optional inclusion</Text></View>
            <Text style={styles.price}>+{formatPeso(service.price * (1 + commissionRate))}{service.pricingUnit === 'hour' ? ' / hour' : service.pricingUnit === 'unit' ? ' / unit' : ''}</Text>
          </Pressable>
          {entry && service.pricingUnit !== 'event' ? <Quantity label="Quantity" onChange={(quantity) => updateServiceQuantity(service.id, service.maximumQuantity ? Math.min(service.maximumQuantity, quantity) : quantity)} value={entry.quantity} /> : null}
        </View>
      })}
    </View> : null}

    {selectedPackage && configuration.supportsAdditionalHours && selectedPackage.maximumCoverageExtensionHours > 0 ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Additional coverage hours</Text>
      {selection.additionalHours > 0 ? <><Quantity label={`Up to ${selectedPackage.maximumCoverageExtensionHours} extra hours · ${formatPeso(configuration.additionalHourRate * (1 + commissionRate))}/hour`} onChange={(hours) => set({ additionalHours: Math.min(selectedPackage.maximumCoverageExtensionHours, hours) })} value={selection.additionalHours} /><Pressable onPress={() => { animateOptionLayout(); set({ additionalHours: 0 }) }}><Text style={styles.removeText}>Remove additional hours</Text></Pressable></> : <Pressable onPress={() => { animateOptionLayout(); set({ additionalHours: 1 }) }} style={[styles.addHoursButton, neumorphic && styles.neoRaised]}><Text style={styles.selectText}>Add additional hour · {formatPeso(configuration.additionalHourRate * (1 + commissionRate))}/hour</Text></Pressable>}
    </View> : null}

    <View style={[styles.priceSummary, neumorphic && styles.neoInset]}><Text style={styles.priceSummaryLabel}>Current marketplace price</Text><Text style={styles.priceSummaryValue}>{formatPeso(calculation.clientTotal)}</Text><Text style={styles.priceSummaryCopy}>Your selected package and optional inclusions are saved with the booking for provider review.</Text></View>
  </View>
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  heading: { color: '#4E061A', fontSize: 20, fontWeight: '800' },
  caption: { color: '#5E5E5E', fontSize: 13, lineHeight: 19 },
  section: { borderTopColor: '#E2E2E2', borderTopWidth: 1, gap: 8, paddingTop: 14 },
  sectionTitle: { color: '#1A1C1C', fontSize: 16, fontWeight: '800' },
  choice: { borderColor: '#E2E2E2', borderRadius: 10, borderWidth: 1, gap: 5, padding: 12 },
  choiceActive: { backgroundColor: neutralSelection.surface, borderColor: neutralSelection.edge },
  choiceHeading: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  choiceCopy: { flex: 1, minWidth: 0 },
  choiceTitle: { color: '#1A1C1C', fontSize: 14, fontWeight: '700' },
  choiceCaption: { color: '#5E5E5E', fontSize: 12, lineHeight: 17, marginTop: 3 },
  price: { color: '#4E061A', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  unavailable: { color: '#5E5E5E', fontSize: 12, lineHeight: 18 },
  optionCard: { borderColor: '#E2E2E2', borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  optionCardActive: { backgroundColor: neutralSelection.surface, borderColor: neutralSelection.edge },
  optionHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', padding: 12 },
  quantityRow: { alignItems: 'center', borderTopColor: '#EEE7E9', borderTopWidth: 1, flexDirection: 'row', gap: 9, padding: 10 },
  quantityLabel: { color: '#303033', flex: 1, fontSize: 12, fontWeight: '700' },
  quantityButton: { alignItems: 'center', backgroundColor: '#4E061A', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  quantityButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  quantityValue: { color: '#1A1C1C', fontSize: 14, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  addHoursButton: { borderColor: '#D8CDD0', borderRadius: 8, borderWidth: 1, padding: 11 },
  selectText: { color: '#4E061A', fontSize: 12, fontWeight: '800' },
  removeText: { color: '#7A1830', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  priceSummary: { backgroundColor: '#F7EFEF', borderColor: '#E7D9DD', borderRadius: 12, borderWidth: 1, gap: 3, padding: 14 },
  priceSummaryLabel: { color: '#5E5E5E', fontSize: 12, fontWeight: '700' },
  priceSummaryValue: { color: '#4E061A', fontSize: 22, fontWeight: '900' },
  priceSummaryCopy: { color: '#5E5E5E', fontSize: 12, lineHeight: 18 },
  neoRaised: { borderColor: neutralSelection.edge, backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.raisedShadow },
  neoInset: { borderColor: neutralSelection.edge, backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.sunkenShadow },
})
