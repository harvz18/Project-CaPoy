import { MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { Text } from '../components/AppText'
import { CatalogService, fetchCatalogServices, formatServicePrice } from '../lib/catalog'
import {
  CoordinatorManagedPackage,
  fetchCoordinatorPackages,
  saveCoordinatorPackage,
  setCoordinatorPackageStatus,
} from '../lib/coordinator'

interface Props { onBack?: () => void; onSaved?: (message: string) => void }
type EventType = CoordinatorManagedPackage['eventType']

const eventTypes: Array<{ id: EventType; label: string }> = [
  { id: 'wedding', label: 'Wedding' },
  { id: 'preWedding', label: 'Pre-wedding' },
  { id: 'postWedding', label: 'Post-wedding' },
]

export const CoordinatorPackagesScreen: React.FC<Props> = ({ onBack, onSaved }) => {
  const [packages, setPackages] = React.useState<CoordinatorManagedPackage[]>([])
  const [services, setServices] = React.useState<CatalogService[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState('')
  const [editing, setEditing] = React.useState<CoordinatorManagedPackage | null>()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [eventType, setEventType] = React.useState<EventType>('wedding')
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [publishNow, setPublishNow] = React.useState(true)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    const [packageResult, serviceRows] = await Promise.all([
      fetchCoordinatorPackages(),
      fetchCatalogServices(),
    ])
    setPackages(packageResult.data ?? [])
    setServices(serviceRows.filter((service) => service.kind !== 'coordinator' && !service.isMock))
    setError(packageResult.ok ? '' : packageResult.message ?? 'Unable to load packages.')
    setLoading(false)
  }, [])

  React.useEffect(() => { void load() }, [load])

  const openEditor = (value?: CoordinatorManagedPackage) => {
    setEditing(value ?? null)
    setName(value?.name ?? '')
    setDescription(value?.description ?? '')
    setEventType(value?.eventType ?? 'wedding')
    setSelectedIds(value?.items.map((item) => item.serviceId) ?? [])
    setPublishNow(value?.status === 'active' || !value)
    setError('')
  }

  const closeEditor = () => {
    setEditing(undefined)
    setError('')
  }

  const toggleService = (serviceId: string) => {
    setSelectedIds((current) => current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId])
  }

  const save = async () => {
    if (busy) return
    setBusy('save')
    setError('')
    const result = await saveCoordinatorPackage({
      description,
      eventType,
      id: editing?.id,
      name,
      serviceIds: selectedIds,
      status: publishNow ? 'active' : 'draft',
    })
    setBusy('')
    if (!result.ok) { setError(result.message ?? 'Unable to save this package.'); return }
    closeEditor()
    await load()
    onSaved?.(editing ? 'Coordinator package updated.' : 'Coordinator package created.')
  }

  const changeStatus = async (item: CoordinatorManagedPackage) => {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active'
    setBusy(item.id)
    setError('')
    const result = await setCoordinatorPackageStatus(item.id, nextStatus)
    setBusy('')
    if (!result.ok) { setError(result.message ?? 'Unable to change package status.'); return }
    await load()
    onSaved?.(`Package ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={editing !== undefined ? closeEditor : onBack} style={styles.icon}>
          <MaterialCommunityIcons color="#4E061A" name="arrow-left" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{editing !== undefined ? (editing ? 'EDIT PACKAGE' : 'CREATE PACKAGE') : 'COORDINATOR PACKAGES'}</Text>
        <View style={styles.icon} />
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#6B1E2E" size="large" /></View> : editing !== undefined ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{editing ? 'Edit curated package' : 'Create a curated package'}</Text>
          <Text style={styles.copy}>Choose real active services from MULTIVENT. Providers keep ownership and approve their own booking requests.</Text>
          <View style={styles.formCard}>
            <Text style={styles.label}>Package name</Text>
            <TextInput maxLength={120} onChangeText={setName} placeholder="Wedding Essentials" style={styles.input} value={name} />
            <Text style={styles.label}>Description</Text>
            <TextInput maxLength={2000} multiline onChangeText={setDescription} placeholder="Describe the event need this curated selection addresses." style={[styles.input, styles.textarea]} value={description} />
            <Text style={styles.label}>Event type</Text>
            <View style={styles.chips}>{eventTypes.map((option) => <Pressable key={option.id} onPress={() => setEventType(option.id)} style={[styles.chip, eventType === option.id && styles.chipActive]}><Text style={[styles.chipText, eventType === option.id && styles.chipTextActive]}>{option.label}</Text></Pressable>)}</View>
            <View style={styles.servicesHeading}><Text style={styles.label}>Selected services</Text><Text style={styles.count}>{selectedIds.length} selected</Text></View>
            <Text style={styles.helper}>Prices are not copied into the package. Client totals use each service&apos;s current pricing when the package is chosen.</Text>
            <View style={styles.serviceList}>{(editing?.items ?? []).filter((item) =>
              selectedIds.includes(item.serviceId) && !services.some((service) => service.id === item.serviceId)
            ).map((item) => (
              <Pressable key={item.serviceId} onPress={() => toggleService(item.serviceId)} style={[styles.serviceRow, styles.unavailableRow]}>
                <View style={[styles.checkbox, styles.checkboxSelected]}><MaterialCommunityIcons color="#FFFFFF" name="close" size={15} /></View>
                <View style={styles.serviceCopy}><Text style={styles.serviceName}>{item.serviceName}</Text><Text style={styles.serviceMeta}>{item.categoryName} · unavailable — tap to remove</Text></View>
              </Pressable>
            ))}{services.map((service) => {
              const selected = selectedIds.includes(service.id)
              return <Pressable key={service.id} onPress={() => toggleService(service.id)} style={[styles.serviceRow, selected && styles.serviceRowSelected]}>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <MaterialCommunityIcons color="#FFFFFF" name="check" size={15} /> : null}</View>
                <View style={styles.serviceCopy}><Text style={styles.serviceName}>{service.name}</Text><Text style={styles.serviceMeta}>{service.categoryName} · {service.providerName}</Text></View>
                <Text style={styles.servicePrice}>{formatServicePrice(service)}</Text>
              </Pressable>
            })}</View>
            <Pressable onPress={() => setPublishNow((current) => !current)} style={styles.publishRow}>
              <View style={[styles.checkbox, publishNow && styles.checkboxSelected]}>{publishNow ? <MaterialCommunityIcons color="#FFFFFF" name="check" size={15} /> : null}</View>
              <View style={styles.serviceCopy}><Text style={styles.serviceName}>Publish after saving</Text><Text style={styles.serviceMeta}>Inactive or unavailable services automatically deactivate the package.</Text></View>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable disabled={busy === 'save'} onPress={() => void save()} style={[styles.primary, busy === 'save' && styles.disabled]}>{busy === 'save' ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons color="#FFFFFF" name="content-save-outline" size={20} />}<Text style={styles.primaryText}>Save package</Text></Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.pageHeading}><View style={styles.headingCopy}><Text style={styles.title}>Curated packages</Text><Text style={styles.copy}>Build reusable recommendations from existing MULTIVENT services.</Text></View><Pressable onPress={() => openEditor()} style={styles.primary}><MaterialCommunityIcons color="#FFFFFF" name="plus" size={20} /><Text style={styles.primaryText}>Create package</Text></Pressable></View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {packages.length === 0 ? <View style={styles.empty}><MaterialCommunityIcons color="#6B1E2E" name="package-variant-closed" size={34} /><Text style={styles.emptyTitle}>No coordinator packages yet</Text><Text style={styles.helper}>Create a package to recommend a curated group of real provider services.</Text></View> : <View style={styles.packageList}>{packages.map((item) => <View key={item.id} style={styles.packageCard}>
            <View style={styles.packageTop}><View style={styles.headingCopy}><Text style={styles.eyebrow}>{eventTypes.find((option) => option.id === item.eventType)?.label.toUpperCase()} · {item.status.toUpperCase()}</Text><Text style={styles.packageName}>{item.name}</Text></View><View style={[styles.status, item.status === 'active' && styles.statusActive]}><Text style={[styles.statusText, item.status === 'active' && styles.statusTextActive]}>{item.status}</Text></View></View>
            {item.description ? <Text style={styles.packageDescription}>{item.description}</Text> : null}
            <View style={styles.itemList}>{item.items.map((service) => <View key={service.serviceId} style={styles.itemRow}><Text style={styles.itemCategory}>{service.categoryName}</Text><Text style={styles.itemName}>{service.serviceName}</Text><Text style={styles.itemProvider}>{service.providerName}</Text></View>)}</View>
            <View style={styles.cardActions}><Pressable onPress={() => openEditor(item)} style={styles.secondary}><Text style={styles.secondaryText}>Edit / View</Text></Pressable><Pressable disabled={busy === item.id} onPress={() => void changeStatus(item)} style={styles.secondary}>{busy === item.id ? <ActivityIndicator color="#4E061A" size="small" /> : null}<Text style={styles.secondaryText}>{item.status === 'active' ? 'Deactivate' : 'Activate'}</Text></Pressable></View>
          </View>)}</View>}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9F9F9' }, header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E4D8DA', backgroundColor: '#FFFFFF', paddingHorizontal: 18 }, icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, headerTitle: { color: '#4E061A', fontSize: 12, fontWeight: '700', letterSpacing: 1.1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 24, paddingBottom: 90 }, pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 22 }, headingCopy: { flex: 1, minWidth: 0 }, title: { color: '#1A1C1C', fontSize: 27, lineHeight: 35, fontWeight: '700' }, copy: { color: '#6F6769', fontSize: 14, lineHeight: 21, marginTop: 6 }, primary: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 24, backgroundColor: '#4E061A', paddingHorizontal: 20 }, primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }, formCard: { gap: 10, borderWidth: 1, borderColor: '#E4D8DA', borderRadius: 18, backgroundColor: '#FFFFFF', padding: 20, marginTop: 22 }, label: { color: '#4E061A', fontSize: 12, fontWeight: '700', marginTop: 5 }, input: { minHeight: 50, borderWidth: 1, borderColor: '#D8CCCE', borderRadius: 10, color: '#1A1C1C', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }, textarea: { minHeight: 105, textAlignVertical: 'top' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#D8CCCE', borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 9 }, chipActive: { borderColor: '#6B1E2E', backgroundColor: '#6B1E2E' }, chipText: { color: '#5E5557', fontSize: 12, fontWeight: '600' }, chipTextActive: { color: '#FFFFFF' }, servicesHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, count: { color: '#6B1E2E', fontSize: 11, fontWeight: '700' }, helper: { color: '#6F6769', fontSize: 11, lineHeight: 17 }, serviceList: { gap: 8, marginTop: 4 }, serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#E4D8DA', borderRadius: 12, padding: 12 }, serviceRowSelected: { borderColor: '#6B1E2E', backgroundColor: '#FCF5F6' }, checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BFAEB1', borderRadius: 5 }, checkboxSelected: { borderColor: '#6B1E2E', backgroundColor: '#6B1E2E' }, serviceCopy: { flex: 1, minWidth: 0 }, serviceName: { color: '#1A1C1C', fontSize: 13, fontWeight: '700' }, serviceMeta: { color: '#6F6769', fontSize: 10, lineHeight: 15, marginTop: 2 }, servicePrice: { maxWidth: 140, color: '#6B1E2E', fontSize: 11, fontWeight: '700', textAlign: 'right' }, publishRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, backgroundColor: '#F8EFF1', padding: 13, marginTop: 5 }, error: { color: '#A12A35', fontSize: 12, lineHeight: 18 }, disabled: { opacity: 0.55 }, empty: { alignItems: 'center', borderWidth: 1, borderColor: '#E4D8DA', borderRadius: 18, backgroundColor: '#FFFFFF', padding: 34 }, emptyTitle: { color: '#1A1C1C', fontSize: 17, fontWeight: '700', marginTop: 10 }, packageList: { gap: 14 }, packageCard: { borderWidth: 1, borderColor: '#E4D8DA', borderRadius: 18, backgroundColor: '#FFFFFF', padding: 18 }, packageTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, eyebrow: { color: '#6B1E2E', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }, packageName: { color: '#1A1C1C', fontSize: 20, fontWeight: '700', marginTop: 4 }, status: { borderRadius: 12, backgroundColor: '#EFE9EA', paddingHorizontal: 10, paddingVertical: 5 }, statusActive: { backgroundColor: '#E6F4EC' }, statusText: { color: '#6F6769', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }, statusTextActive: { color: '#21633E' }, packageDescription: { color: '#6F6769', fontSize: 13, lineHeight: 19, marginTop: 10 }, itemList: { gap: 7, borderTopWidth: 1, borderTopColor: '#EEE5E7', marginTop: 14, paddingTop: 12 }, itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, itemCategory: { width: 100, color: '#6B1E2E', fontSize: 10, fontWeight: '700' }, itemName: { flex: 1, color: '#1A1C1C', fontSize: 12, fontWeight: '600' }, itemProvider: { color: '#6F6769', fontSize: 10 }, cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }, secondary: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#6B1E2E', borderRadius: 20, paddingHorizontal: 15 }, secondaryText: { color: '#4E061A', fontSize: 11, fontWeight: '700' },
  unavailableRow: { borderColor: '#C98B94', backgroundColor: '#FFF4F5' },
})
