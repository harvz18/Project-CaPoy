import React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Text } from './AppText'
import {
  getPhotoVideoAdditionalCrewOptions,
  getPhotoVideoAdditionalServices,
  getPhotoVideoCoverageConfigurations,
  getPhotoVideoDeliverableConfigurations,
  type ServiceCategoryDetails,
} from '../lib/service-category-details'
import { photoVideoPackageDraftsFrom, type PhotoVideoPackageDraft } from '../lib/photo-video'

type Props = {
  details: ServiceCategoryDetails
  onAddPackagePhoto?: () => Promise<string | string[] | null | undefined> | string | string[] | null | undefined
  onChange: (value: ServiceCategoryDetails) => void
}

const text = (value: unknown) => typeof value === 'string' ? value : ''
const numberText = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value : ''
const parseNumber = (value: string) => { const parsed = Number(value.replace(/[^\d.]/g, '')); return Number.isFinite(parsed) && value.trim() ? parsed : undefined }

const Field = ({ children, label, helper }: React.PropsWithChildren<{ helper?: string; label: string }>) => <View style={styles.field}><Text style={styles.label}>{label}</Text>{helper ? <Text style={styles.helper}>{helper}</Text> : null}{children}</View>
const TextField = ({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder?: string; value: unknown }) => <Field label={label}><TextInput onChangeText={onChange} placeholder={placeholder} placeholderTextColor={palette.placeholder} style={styles.input} value={text(value)} /></Field>
const NumberField = ({ label, min = 0, onChange, suffix, value }: { label: string; min?: number; onChange: (value?: number) => void; suffix?: string; value: unknown }) => <Field label={label}><View style={styles.numberRow}><TextInput inputMode="decimal" keyboardType="decimal-pad" onChangeText={(next) => { const parsed = parseNumber(next); onChange(parsed === undefined ? undefined : Math.max(min, parsed)) }} placeholder="0" placeholderTextColor={palette.placeholder} style={[styles.input, styles.flex]} value={numberText(value)} />{suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}</View></Field>
const ToggleChoice = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>

export const PhotoVideoPackagesEditor: React.FC<Props> = ({ details, onAddPackagePhoto, onChange }) => {
  const packages = photoVideoPackageDraftsFrom(details)
  const coverageConfigurations = getPhotoVideoCoverageConfigurations(details)
  const deliverables = getPhotoVideoDeliverableConfigurations(details)
  const additionalCrew = getPhotoVideoAdditionalCrewOptions(details)
  const additionalServices = getPhotoVideoAdditionalServices(details)
  const serviceEventTypes = Array.isArray(details.eventTypes)
    ? details.eventTypes.filter((item): item is string => typeof item === 'string')
    : []
  const [uploadingPackageIndex, setUploadingPackageIndex] = React.useState<number | null>(null)
  const setPackages = (next: PhotoVideoPackageDraft[]) => onChange({ ...details, photoVideoPackages: next })
  const update = (index: number, patch: Partial<PhotoVideoPackageDraft>) => setPackages(packages.map((item, current) => current === index ? { ...item, ...patch } : item))
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
  const duplicate = (index: number) => {
    const source = packages[index]
    if (!source) return
    setPackages([...packages, { ...source, id: undefined, imageUrls: [...source.imageUrls], name: `${source.name || 'Untitled package'} copy` }])
  }
  const addPhoto = async (index: number) => {
    if (!onAddPackagePhoto || uploadingPackageIndex !== null) return
    setUploadingPackageIndex(index)
    try {
      const result = await onAddPackagePhoto()
      const urls = (Array.isArray(result) ? result : [result]).filter((item): item is string => typeof item === 'string' && item.length > 0)
      const existing = packages[index]
      if (existing && urls.length) update(index, { imageUrls: Array.from(new Set([...existing.imageUrls, ...urls])) })
    } finally { setUploadingPackageIndex(null) }
  }

  return <View style={styles.root}>
    <View style={styles.heading}><Text style={styles.headingTitle}>PHOTO / VIDEO PACKAGES</Text><Text style={styles.headingCopy}>Packages reuse your configured coverage, crew, deliverables, and add-ons. Their price already includes the selected inclusions; clients will only see upgrades you explicitly allow.</Text></View>
    {packages.map((pkg, index) => {
      const selectedCoverage = coverageConfigurations.find((coverage) => coverage.id === pkg.coverageConfigurationId)
      return <View key={pkg.id ?? `new-${index}`} style={styles.card}>
        <View style={styles.cardHeader}><Text style={styles.cardTitle}>Package {index + 1}</Text><View style={styles.headerActions}><Pressable onPress={() => duplicate(index)}><Text style={styles.actionText}>Duplicate</Text></Pressable><Pressable onPress={() => setPackages(packages.filter((_, current) => current !== index))}><Text style={styles.removeText}>Remove</Text></Pressable></View></View>
        <TextField label="Package name" onChange={(name) => update(index, { name })} placeholder="e.g., Full-Day Story Package" value={pkg.name} />
        <TextField label="Package description" onChange={(description) => update(index, { description })} placeholder="Describe what this package is designed for." value={pkg.description} />
        <NumberField label="Package base price" min={1} onChange={(price) => update(index, { price: price ?? 0 })} suffix="PHP" value={pkg.price} />
        <ToggleChoice active={pkg.isActive} label={pkg.isActive ? 'Package is active' : 'Package is inactive'} onPress={() => update(index, { isActive: !pkg.isActive })} />
        <Field label="Coverage configuration" helper="The selected coverage already supplies this package’s included crew and duration."><View style={styles.choiceList}>{coverageConfigurations.map((coverage) => <ToggleChoice active={pkg.coverageConfigurationId === coverage.id} key={coverage.id} label={`${coverage.name} · ${coverage.durationHours} hrs · ₱${coverage.price.toLocaleString('en-PH')}`} onPress={() => update(index, { coverageConfigurationId: coverage.id })} />)}</View></Field>
        {selectedCoverage ? <Text style={styles.selectionNote}>Included crew: {selectedCoverage.includedCrew.map((crew) => `${crew.quantity} ${crew.role}`).join(', ')}</Text> : null}
        <Field label="Supported event types"><View style={styles.choiceList}>{serviceEventTypes.map((eventType) => <ToggleChoice active={pkg.eventTypes.includes(eventType)} key={eventType} label={eventType} onPress={() => update(index, { eventTypes: toggle(pkg.eventTypes, eventType) })} />)}</View></Field>
        <Field label="Included deliverables"><View style={styles.choiceList}>{deliverables.map((deliverable) => <ToggleChoice active={pkg.deliverableIds.includes(deliverable.id)} key={deliverable.id} label={deliverable.name} onPress={() => update(index, { deliverableIds: toggle(pkg.deliverableIds, deliverable.id) })} />)}</View></Field>
        <View style={styles.twoColumns}><NumberField label="Included locations" min={1} onChange={(includedLocationCount) => update(index, { includedLocationCount: includedLocationCount ?? 1 })} value={pkg.includedLocationCount} /><NumberField label="Maximum coverage extension" min={0} onChange={(maximumCoverageExtensionHours) => update(index, { maximumCoverageExtensionHours: maximumCoverageExtensionHours ?? 0 })} suffix="hours" value={pkg.maximumCoverageExtensionHours} /></View>
        <View style={styles.twoColumns}><NumberField label="Maximum additional crew" min={0} onChange={(maximumAdditionalCrew) => update(index, { maximumAdditionalCrew: maximumAdditionalCrew ?? 0 })} value={pkg.maximumAdditionalCrew} /><NumberField label="Maximum additional deliverables" min={0} onChange={(maximumAdditionalDeliverables) => update(index, { maximumAdditionalDeliverables: maximumAdditionalDeliverables ?? 0 })} value={pkg.maximumAdditionalDeliverables} /></View>
        <Field label="Allowed additional crew"><View style={styles.choiceList}>{additionalCrew.map((crew) => <ToggleChoice active={pkg.allowedAdditionalCrewOptionIds.includes(crew.id)} key={crew.id} label={`${crew.role} · ₱${crew.price.toLocaleString('en-PH')} / ${crew.pricingUnit}`} onPress={() => update(index, { allowedAdditionalCrewOptionIds: toggle(pkg.allowedAdditionalCrewOptionIds, crew.id) })} />)}</View></Field>
        <Field label="Allowed additional services"><View style={styles.choiceList}>{additionalServices.map((service) => <ToggleChoice active={pkg.allowedAdditionalServiceIds.includes(service.id)} key={service.id} label={`${service.name} · ₱${service.price.toLocaleString('en-PH')} / ${service.pricingUnit}`} onPress={() => update(index, { allowedAdditionalServiceIds: toggle(pkg.allowedAdditionalServiceIds, service.id) })} />)}</View></Field>
        <Field label="Package images" helper="Optional. Images are uploaded using the existing provider media picker."><View style={styles.images}>{pkg.imageUrls.map((url, imageIndex) => <View key={`${url}-${imageIndex}`} style={styles.imageChip}><Text numberOfLines={1} style={styles.imageText}>Image {imageIndex + 1}</Text><Pressable onPress={() => update(index, { imageUrls: pkg.imageUrls.filter((_, current) => current !== imageIndex) })}><Text style={styles.removeText}>×</Text></Pressable></View>)}</View><Pressable disabled={!onAddPackagePhoto || uploadingPackageIndex !== null} onPress={() => void addPhoto(index)} style={styles.addImageButton}><Text style={styles.addImageText}>{uploadingPackageIndex === index ? 'Adding image…' : 'Add package image'}</Text></Pressable></Field>
      </View>
    })}
    <Pressable onPress={() => setPackages([...packages, { allowedAdditionalCrewOptionIds: [], allowedAdditionalServiceIds: [], coverageConfigurationId: '', deliverableIds: [], description: '', eventTypes: [], imageUrls: [], includedLocationCount: 1, isActive: true, maximumAdditionalCrew: 0, maximumAdditionalDeliverables: 0, maximumCoverageExtensionHours: 0, name: '', price: 0 }])} style={styles.addButton}><Text style={styles.addText}>Add Photo/Video package</Text></Pressable>
  </View>
}

const palette = { border: '#E6E1E2', card: '#FFFBFF', muted: '#6F6A6C', placeholder: '#888386', primary: '#7A1830', primarySoft: '#F8EAEE', text: '#211A1D' }
const styles = StyleSheet.create({
  actionText: { color: palette.primary, fontSize: 12, fontWeight: '800', padding: 5 },
  addButton: { alignItems: 'center', borderColor: palette.primary, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, marginTop: 10, padding: 12 },
  addImageButton: { alignItems: 'center', borderColor: palette.border, borderRadius: 9, borderWidth: 1, marginTop: 7, padding: 10 },
  addImageText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  addText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: palette.card, borderColor: palette.border, borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 12 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: palette.text, fontSize: 14, fontWeight: '900' },
  choice: { borderColor: palette.border, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9 },
  choiceActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  choiceList: { gap: 7 },
  choiceText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  choiceTextActive: { color: palette.primary },
  field: { marginTop: 11 },
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 3 },
  heading: { borderTopColor: palette.border, borderTopWidth: 1, marginTop: 20, paddingTop: 18 },
  headingCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  headingTitle: { color: palette.primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  helper: { color: palette.muted, fontSize: 11, lineHeight: 16, marginBottom: 5 },
  imageChip: { alignItems: 'center', backgroundColor: '#F4EFF0', borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 9, paddingVertical: 7 },
  imageText: { color: palette.muted, flex: 1, fontSize: 12, fontWeight: '700' },
  images: { gap: 6 },
  input: { backgroundColor: '#FFFFFF', borderColor: palette.border, borderRadius: 9, borderWidth: 1, color: palette.text, fontSize: 14, minHeight: 42, paddingHorizontal: 11 },
  label: { color: palette.text, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  numberRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  removeText: { color: palette.primary, fontSize: 12, fontWeight: '900', padding: 5 },
  root: { marginTop: 0 },
  selectionNote: { backgroundColor: '#FFF5F6', borderColor: '#F0D5DB', borderRadius: 9, borderWidth: 1, color: palette.primary, fontSize: 12, lineHeight: 18, marginTop: 9, padding: 10 },
  suffix: { color: palette.muted, fontSize: 12, fontWeight: '700', minWidth: 42 },
  twoColumns: { flexDirection: 'row', gap: 10 },
})
