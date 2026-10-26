import React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Text } from './AppText'
import type {
  FloristArrangementSelectionSnapshot,
  FloristOptionSelectionSnapshot,
  FloristPublishedArrangement,
  FloristServiceConfiguration,
  FloristSelectionSnapshot,
} from '../lib/florist'
import { formatPeso } from '../lib/catalog'

type Props = {
  configuration: FloristServiceConfiguration
  onChange: (selection: FloristSelectionSnapshot) => void
  value: FloristSelectionSnapshot
}

const defaultSelection = (): FloristSelectionSnapshot => ({ schemaVersion: 1, selectedArrangements: [] })

const updateArrangement = (
  selection: FloristSelectionSnapshot,
  arrangement: FloristPublishedArrangement,
  update: (current: FloristArrangementSelectionSnapshot) => FloristArrangementSelectionSnapshot
) => ({
  ...selection,
  selectedArrangements: selection.selectedArrangements.map((item) =>
    item.arrangementId === arrangement.id ? update(item) : item
  ),
})

export const FloristBookingConfigurator: React.FC<Props> = ({ configuration, onChange, value }) => {
  const selected = value ?? defaultSelection()
  const selectedPackage = configuration.packages.find((item) => item.id === selected.packageId)
  const selectedArrangements = new Map(selected.selectedArrangements.map((item) => [item.arrangementId, item]))
  const selectableArrangements = selectedPackage
    ? configuration.arrangements.filter((arrangement) => selectedPackage.inclusions.some((item) =>
      item.arrangementId === arrangement.id && item.customizationAllowed
    ))
    : configuration.arrangements

  const setMethod = (method: 'custom' | 'package') => {
    if (method === 'custom') onChange({ schemaVersion: 1, selectedArrangements: [], fulfillmentOptionId: selected.fulfillmentOptionId })
    else onChange({ schemaVersion: 1, selectedArrangements: [], fulfillmentOptionId: selected.fulfillmentOptionId, packageAddOnIds: [] })
  }

  const choosePackage = (packageId: string) => onChange({
    ...selected,
    packageId,
    packageAddOnIds: [],
    selectedArrangements: [],
  })

  const toggleArrangement = (arrangement: FloristPublishedArrangement) => {
    const existing = selectedArrangements.get(arrangement.id)
    if (existing) {
      onChange({ ...selected, selectedArrangements: selected.selectedArrangements.filter((item) => item.arrangementId !== arrangement.id) })
      return
    }
    const packageItem = selectedPackage?.inclusions.find((item) => item.arrangementId === arrangement.id)
    onChange({
      ...selected,
      selectedArrangements: [...selected.selectedArrangements, {
        arrangementId: arrangement.id,
        quantity: packageItem?.quantity ?? arrangement.minimumQuantity,
        selectedOptions: [],
      }],
    })
  }

  const updateOption = (
    arrangement: FloristPublishedArrangement,
    option: FloristOptionSelectionSnapshot,
    enabled: boolean
  ) => {
    onChange(updateArrangement(selected, arrangement, (current) => ({
      ...current,
      selectedOptions: enabled
        ? [...current.selectedOptions, option]
        : current.selectedOptions.filter((item) => item.optionId !== option.optionId || item.optionGroupId !== option.optionGroupId),
    })))
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Floral selection</Text>
      <Text style={styles.caption}>Choose only the arrangements, package, customizations, and fulfillment offered by this florist.</Text>
      {configuration.packages.length > 0 && configuration.arrangements.length > 0 ? <View style={styles.methodRow}>
        {(['custom', 'package'] as const).map((method) => {
          const active = method === 'package' ? Boolean(selected.packageId) : !selected.packageId
          return <Pressable key={method} accessibilityRole="button" onPress={() => setMethod(method)} style={[styles.methodButton, active && styles.methodButtonActive]}>
            <Text style={[styles.methodText, active && styles.methodTextActive]}>{method === 'package' ? 'Wedding package' : 'Customize flowers'}</Text>
          </Pressable>
        })}
      </View> : null}

      {configuration.packages.length > 0 && (selected.packageId || configuration.arrangements.length === 0) ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>Packages</Text>
        {configuration.packages.map((pkg) => <Pressable key={pkg.id} accessibilityRole="button" onPress={() => choosePackage(pkg.id)} style={[styles.choiceRow, selected.packageId === pkg.id && styles.choiceRowActive]}>
          <View><Text style={styles.choiceTitle}>{pkg.name}</Text><Text style={styles.choiceCaption}>{pkg.inclusions.length} included arrangement{pkg.inclusions.length === 1 ? '' : 's'}</Text></View>
          <Text style={styles.price}>{formatPeso(pkg.price)}</Text>
        </Pressable>)}
        {selectedPackage?.addOns.length ? <View style={styles.addOnList}>
          <Text style={styles.inputLabel}>Optional add-ons</Text>
          {selectedPackage.addOns.map((addOn) => {
            const active = selected.packageAddOnIds?.includes(addOn.id) ?? false
            return <Pressable key={addOn.id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => onChange({
              ...selected,
              packageAddOnIds: active ? selected.packageAddOnIds?.filter((id) => id !== addOn.id) : [...(selected.packageAddOnIds ?? []), addOn.id],
            })} style={[styles.choiceRow, active && styles.choiceRowActive]}>
              <Text style={styles.choiceTitle}>{active ? '✓ ' : ''}{addOn.name}</Text><Text style={styles.price}>+{formatPeso(addOn.price)}</Text>
            </Pressable>
          })}
        </View> : null}
      </View> : null}

      {selectableArrangements.length > 0 && (!selected.packageId || selectedPackage) ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selected.packageId ? 'Customize included arrangements' : 'Arrangements'}</Text>
        {selectableArrangements.map((arrangement) => {
          const current = selectedArrangements.get(arrangement.id)
          const packageItem = selectedPackage?.inclusions.find((item) => item.arrangementId === arrangement.id)
          return <View key={arrangement.id} style={[styles.arrangement, current && styles.arrangementActive]}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(current) }} onPress={() => toggleArrangement(arrangement)} style={styles.arrangementHeader}>
              <View><Text style={styles.choiceTitle}>{current ? '✓ ' : ''}{arrangement.name}</Text><Text style={styles.choiceCaption}>{arrangement.category} · {formatPeso(arrangement.basePrice)} / {arrangement.pricingUnit}</Text></View>
              <Text style={styles.selectLabel}>{current ? 'Selected' : 'Select'}</Text>
            </Pressable>
            {current ? <View style={styles.configBody}>
              {!packageItem ? <View style={styles.quantityRow}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <Pressable accessibilityLabel={`Decrease ${arrangement.name} quantity`} onPress={() => onChange(updateArrangement(selected, arrangement, (item) => ({ ...item, quantity: Math.max(arrangement.minimumQuantity, item.quantity - 1) })))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>−</Text></Pressable>
                <Text style={styles.quantityValue}>{current.quantity}</Text>
                <Pressable accessibilityLabel={`Increase ${arrangement.name} quantity`} onPress={() => onChange(updateArrangement(selected, arrangement, (item) => ({ ...item, quantity: arrangement.maximumQuantity ? Math.min(arrangement.maximumQuantity, item.quantity + 1) : item.quantity + 1 })))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable>
              </View> : <Text style={styles.choiceCaption}>Included quantity: {packageItem.quantity}</Text>}
              {arrangement.customizationGroups.map((group) => {
                const groupSelections = current.selectedOptions.filter((item) => item.optionGroupId === group.id)
                return <View key={group.id} style={styles.group}>
                  <Text style={styles.inputLabel}>{group.name}{group.isRequired ? ' *' : ''}</Text>
                  {group.selectionType === 'text' || group.selectionType === 'image' ? <TextInput
                    accessibilityLabel={group.name}
                    onChangeText={(next) => {
                      onChange(updateArrangement(selected, arrangement, (item) => ({ ...item, selectedOptions: [
                        ...item.selectedOptions.filter((entry) => entry.optionGroupId !== group.id),
                        ...(next.trim() ? [{ optionGroupId: group.id, value: next }] : []),
                      ] })))
                    }}
                    placeholder={group.selectionType === 'image' ? 'Reference image link (optional)' : 'Add instructions'}
                    placeholderTextColor="#777"
                    style={styles.textInput}
                    value={groupSelections[0]?.value ?? ''}
                  /> : group.options.map((option) => {
                    const picked = groupSelections.some((item) => item.optionId === option.id)
                    return <Pressable key={option.id} accessibilityRole={group.selectionType === 'single' ? 'radio' : 'checkbox'} accessibilityState={{ checked: picked }} onPress={() => {
                      if (group.selectionType === 'single') {
                        onChange(updateArrangement(selected, arrangement, (item) => ({ ...item, selectedOptions: [...item.selectedOptions.filter((entry) => entry.optionGroupId !== group.id), { optionId: option.id, optionGroupId: group.id }] })))
                      } else updateOption(arrangement, { optionId: option.id, optionGroupId: group.id }, !picked)
                    }} style={[styles.optionRow, picked && styles.optionRowActive]}>
                      <Text style={styles.optionText}>{picked ? '✓ ' : ''}{option.name}</Text><Text style={styles.choiceCaption}>{option.priceModifier > 0 ? `+${formatPeso(option.priceModifier)}` : 'Included'}</Text>
                    </Pressable>
                  })}
                </View>
              })}
            </View> : null}
          </View>
        })}
      </View> : null}

      {configuration.fulfillmentOptions.length > 0 ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fulfillment</Text>
        {configuration.fulfillmentOptions.map((option) => <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected.fulfillmentOptionId === option.id }} onPress={() => onChange({ ...selected, fulfillmentOptionId: option.id })} style={[styles.choiceRow, selected.fulfillmentOptionId === option.id && styles.choiceRowActive]}>
          <Text style={styles.choiceTitle}>{selected.fulfillmentOptionId === option.id ? '✓ ' : ''}{option.name}</Text><Text style={styles.price}>{option.price > 0 ? `+${formatPeso(option.price)}` : 'Included'}</Text>
        </Pressable>)}
      </View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 12 }, heading: { color: '#4E061A', fontSize: 20, fontWeight: '800' }, caption: { color: '#5E5E5E', fontSize: 13, lineHeight: 19 }, section: { borderTopColor: '#E2E2E2', borderTopWidth: 1, gap: 8, paddingTop: 14 }, sectionTitle: { color: '#1A1C1C', fontSize: 16, fontWeight: '800' }, methodRow: { flexDirection: 'row', gap: 8 }, methodButton: { borderColor: '#D8CDD0', borderRadius: 10, borderWidth: 1, flex: 1, padding: 11 }, methodButtonActive: { backgroundColor: '#FDF4F6', borderColor: '#4E061A' }, methodText: { color: '#4E061A', fontWeight: '700', textAlign: 'center' }, methodTextActive: { color: '#4E061A' }, choiceRow: { alignItems: 'center', borderColor: '#E2E2E2', borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 12 }, choiceRowActive: { backgroundColor: '#FDF4F6', borderColor: '#6B1E2E' }, choiceTitle: { color: '#1A1C1C', fontSize: 14, fontWeight: '700' }, choiceCaption: { color: '#5E5E5E', fontSize: 12, marginTop: 3 }, price: { color: '#4E061A', fontSize: 13, fontWeight: '800' }, addOnList: { gap: 8, marginTop: 4 }, arrangement: { borderColor: '#E2E2E2', borderRadius: 12, borderWidth: 1, marginTop: 8, overflow: 'hidden' }, arrangementActive: { borderColor: '#6B1E2E' }, arrangementHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 12 }, selectLabel: { color: '#4E061A', fontSize: 12, fontWeight: '800' }, configBody: { backgroundColor: '#FAF8F8', gap: 10, padding: 12 }, quantityRow: { alignItems: 'center', flexDirection: 'row', gap: 10 }, inputLabel: { color: '#303033', fontSize: 12, fontWeight: '800' }, quantityButton: { alignItems: 'center', backgroundColor: '#4E061A', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 }, quantityButtonText: { color: '#FFF', fontSize: 20, fontWeight: '800' }, quantityValue: { color: '#1A1C1C', fontSize: 15, fontWeight: '800', minWidth: 20, textAlign: 'center' }, group: { gap: 6 }, optionRow: { alignItems: 'center', borderColor: '#E2E2E2', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 10 }, optionRowActive: { borderColor: '#6B1E2E', backgroundColor: '#FFF8F9' }, optionText: { color: '#303033', fontSize: 13, fontWeight: '600' }, textInput: { backgroundColor: '#FFF', borderColor: '#D8CDD0', borderRadius: 8, borderWidth: 1, color: '#1A1C1C', minHeight: 40, paddingHorizontal: 10, paddingVertical: 8 },
})
