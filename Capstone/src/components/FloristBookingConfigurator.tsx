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
import { neutralSelection } from '../theme/neumorphism'
import { animateOptionLayout } from '../theme/option-motion'

type Props = {
  configuration: FloristServiceConfiguration
  neumorphic?: boolean
  onChange: (selection: FloristSelectionSnapshot) => void
  onOptionSelected?: (node: React.ElementRef<typeof View> | null) => void
  value: FloristSelectionSnapshot
}

const defaultSelection = (): FloristSelectionSnapshot => ({ schemaVersion: 1, selectedArrangements: [] })

const customizationGroupRank = (name: string) => {
  const normalized = name.toLowerCase()
  if (normalized.includes('color') || normalized.includes('palette')) return 1
  if (normalized.includes('premium') || normalized.includes('bloom')) return 2
  if (normalized.includes('stem') || normalized.includes('add-on') || normalized.includes('addon')) return 3
  if (normalized.includes('note') || normalized.includes('instruction')) return 4
  if (normalized.includes('image') || normalized.includes('inspiration') || normalized.includes('reference')) return 5
  return 3
}

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

export const FloristBookingConfigurator: React.FC<Props> = ({ configuration, neumorphic = false, onChange, onOptionSelected, value }) => {
  const selected = value ?? defaultSelection()
  const selectedPackage = configuration.packages.find((item) => item.id === selected.packageId)
  const selectedArrangements = new Map(selected.selectedArrangements.map((item) => [item.arrangementId, item]))
  const selectableArrangements = selectedPackage
    ? configuration.arrangements.filter((arrangement) => selectedPackage.inclusions.some((item) =>
      item.arrangementId === arrangement.id && item.customizationAllowed
    ))
    : configuration.arrangements
  const optionRefs = React.useRef<Record<string, React.ElementRef<typeof View> | null>>({})
  const focusSelectedOption = (optionKey: string) => onOptionSelected?.(optionRefs.current[optionKey])

  const setMethod = (method: 'custom' | 'package') => {
    animateOptionLayout()
    if (method === 'custom') onChange({ schemaVersion: 1, selectedArrangements: [], fulfillmentOptionId: selected.fulfillmentOptionId })
    else onChange({ schemaVersion: 1, selectedArrangements: [], fulfillmentOptionId: selected.fulfillmentOptionId, packageAddOnIds: [] })
    focusSelectedOption(`method:${method}`)
  }

  const choosePackage = (packageId: string) => {
    animateOptionLayout()
    onChange({
      ...selected,
      packageId,
      packageAddOnIds: [],
      selectedArrangements: [],
    })
    focusSelectedOption(`package:${packageId}`)
  }

  const toggleArrangement = (arrangement: FloristPublishedArrangement) => {
    const existing = selectedArrangements.get(arrangement.id)
    animateOptionLayout()
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
    focusSelectedOption(`arrangement:${arrangement.id}`)
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
          return <Pressable ref={(node) => { optionRefs.current[`method:${method}`] = node }} key={method} accessibilityRole="button" onPress={() => setMethod(method)} style={[styles.methodButton, neumorphic && (active ? styles.neoRaised : styles.neoInset), active && styles.methodButtonActive]}>
            <Text style={[styles.methodText, active && styles.methodTextActive]}>{method === 'package' ? 'Wedding package' : 'Customize flowers'}</Text>
          </Pressable>
        })}
      </View> : null}

      {configuration.packages.length > 0 && (selected.packageId || configuration.arrangements.length === 0) ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>Packages</Text>
        {configuration.packages.map((pkg) => <Pressable ref={(node) => { optionRefs.current[`package:${pkg.id}`] = node }} key={pkg.id} accessibilityRole="button" onPress={() => choosePackage(pkg.id)} style={[styles.choiceRow, neumorphic && (selected.packageId === pkg.id ? styles.neoRaised : styles.neoInset), selected.packageId === pkg.id && styles.choiceRowActive]}>
          <View><Text style={[styles.choiceTitle, selected.packageId === pkg.id && styles.selectedText]}>{pkg.name}</Text><Text style={[styles.choiceCaption, selected.packageId === pkg.id && styles.selectedMutedText]}>{pkg.inclusions.length} included arrangement{pkg.inclusions.length === 1 ? '' : 's'}</Text></View>
          <Text style={[styles.price, selected.packageId === pkg.id && styles.selectedText]}>{formatPeso(pkg.price)}</Text>
        </Pressable>)}
        {selectedPackage?.addOns.length ? <View style={styles.addOnList}>
          <Text style={styles.inputLabel}>Optional add-ons</Text>
          {selectedPackage.addOns.map((addOn) => {
            const active = selected.packageAddOnIds?.includes(addOn.id) ?? false
            return <Pressable key={addOn.id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => onChange({
              ...selected,
              packageAddOnIds: active ? selected.packageAddOnIds?.filter((id) => id !== addOn.id) : [...(selected.packageAddOnIds ?? []), addOn.id],
            })} style={[styles.choiceRow, neumorphic && (active ? styles.neoRaised : styles.neoInset), active && styles.choiceRowActive]}>
              <Text style={[styles.choiceTitle, active && styles.selectedText]}>{active ? '✓ ' : ''}{addOn.name}</Text><Text style={[styles.price, active && styles.selectedText]}>+{formatPeso(addOn.price)}</Text>
            </Pressable>
          })}
        </View> : null}
      </View> : null}

      {selectableArrangements.length > 0 && (!selected.packageId || selectedPackage) ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selected.packageId ? 'Customize included arrangements' : 'Arrangements'}</Text>
        {selectableArrangements.map((arrangement) => {
          const current = selectedArrangements.get(arrangement.id)
          const packageItem = selectedPackage?.inclusions.find((item) => item.arrangementId === arrangement.id)
          const customizationGroups = [...arrangement.customizationGroups].sort((left, right) =>
            customizationGroupRank(left.name) - customizationGroupRank(right.name)
          )
          return <View ref={(node) => { optionRefs.current[`arrangement:${arrangement.id}`] = node }} key={arrangement.id} style={[styles.arrangement, neumorphic && (current ? styles.neoRaised : styles.neoInset), current && styles.arrangementActive]}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(current) }} onPress={() => toggleArrangement(arrangement)} style={[styles.arrangementHeader, current && styles.arrangementHeaderActive]}>
              <View style={styles.arrangementHeadingCopy}>
                <Text style={[styles.choiceTitle, styles.arrangementTitle, current && styles.selectedText]}>{arrangement.name}</Text>
                <View style={styles.arrangementMetaRow}>
                  <Text style={[styles.choiceCaption, styles.arrangementCategory, current && styles.selectedMutedText]}>{arrangement.category}</Text>
                  <Text style={[styles.price, current && styles.selectedText]}>{formatPeso(arrangement.basePrice)} / {arrangement.pricingUnit}</Text>
                </View>
              </View>
              {current ? <View style={styles.arrangementSelectedMark}><Text style={styles.arrangementSelectedMarkText}>{'\u2713'}</Text></View> : null}
            </Pressable>
            {current ? <View style={[styles.configBody, neumorphic && styles.neoConfigBody]}>
              {!packageItem ? <View style={styles.quantityRow}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <Pressable accessibilityLabel={`Decrease ${arrangement.name} quantity`} onPress={() => onChange(updateArrangement(selected, arrangement, (item) => ({ ...item, quantity: Math.max(arrangement.minimumQuantity, item.quantity - 1) })))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>−</Text></Pressable>
                <Text style={styles.quantityValue}>{current.quantity}</Text>
                <Pressable accessibilityLabel={`Increase ${arrangement.name} quantity`} onPress={() => onChange(updateArrangement(selected, arrangement, (item) => ({ ...item, quantity: arrangement.maximumQuantity ? Math.min(arrangement.maximumQuantity, item.quantity + 1) : item.quantity + 1 })))} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable>
              </View> : <Text style={styles.choiceCaption}>Included quantity: {packageItem.quantity}</Text>}
              {customizationGroups.map((group) => {
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
                    style={[styles.textInput, neumorphic && styles.neoInput]}
                    value={groupSelections[0]?.value ?? ''}
                  /> : group.selectionType === 'quantity' ? group.options.map((option) => {
                    const quantity = groupSelections.find((item) => item.optionId === option.id)?.quantity ?? 0
                    const setQuantity = (nextQuantity: number) => onChange(updateArrangement(selected, arrangement, (item) => ({
                      ...item,
                      selectedOptions: [
                        ...item.selectedOptions.filter((entry) => entry.optionId !== option.id),
                        ...(nextQuantity > 0 ? [{ optionId: option.id, optionGroupId: group.id, quantity: nextQuantity }] : []),
                      ],
                    })))
                    return <View key={option.id} style={[styles.quantityOptionRow, neumorphic && styles.neoRaised]}>
                      <View><Text style={styles.optionText}>{option.name}</Text><Text style={styles.choiceCaption}>+{formatPeso(option.priceModifier)} each</Text></View>
                      <View style={styles.quantityControls}>
                        <Pressable accessibilityLabel={`Decrease ${option.name}`} disabled={quantity === 0} onPress={() => setQuantity(quantity - 1)} style={[styles.quantityButton, quantity === 0 && styles.quantityButtonDisabled]}><Text style={styles.quantityButtonText}>−</Text></Pressable>
                        <Text style={styles.quantityValue}>{quantity}</Text>
                        <Pressable accessibilityLabel={`Increase ${option.name}`} onPress={() => setQuantity(quantity + 1)} style={styles.quantityButton}><Text style={styles.quantityButtonText}>+</Text></Pressable>
                      </View>
                    </View>
                  }) : group.options.map((option) => {
                    const picked = groupSelections.some((item) => item.optionId === option.id)
                    return <Pressable key={option.id} accessibilityRole={group.selectionType === 'single' ? 'radio' : 'checkbox'} accessibilityState={{ checked: picked }} onPress={() => {
                      if (group.selectionType === 'single') {
                        onChange(updateArrangement(selected, arrangement, (item) => ({ ...item, selectedOptions: [...item.selectedOptions.filter((entry) => entry.optionGroupId !== group.id), { optionId: option.id, optionGroupId: group.id }] })))
                      } else updateOption(arrangement, { optionId: option.id, optionGroupId: group.id }, !picked)
                    }} style={[styles.optionRow, neumorphic && (picked ? styles.neoRaised : styles.neoInset), picked && styles.optionRowActive]}>
                      <Text style={[styles.optionText, picked && styles.selectedText]}>{picked ? '✓ ' : ''}{option.name}</Text><Text style={[styles.choiceCaption, picked && styles.selectedMutedText]}>{option.priceModifier > 0 ? `+${formatPeso(option.priceModifier)}` : 'Included'}</Text>
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
        {configuration.fulfillmentOptions.map((option) => <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected.fulfillmentOptionId === option.id }} onPress={() => onChange({ ...selected, fulfillmentOptionId: option.id })} style={[styles.choiceRow, neumorphic && (selected.fulfillmentOptionId === option.id ? styles.neoRaised : styles.neoInset), selected.fulfillmentOptionId === option.id && styles.choiceRowActive]}>
          <Text style={[styles.choiceTitle, selected.fulfillmentOptionId === option.id && styles.selectedText]}>{selected.fulfillmentOptionId === option.id ? '✓ ' : ''}{option.name}</Text><Text style={[styles.price, selected.fulfillmentOptionId === option.id && styles.selectedText]}>{option.price > 0 ? `+${formatPeso(option.price)}` : 'Included'}</Text>
        </Pressable>)}
      </View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  heading: { color: '#1A1C1C', fontSize: 20, fontWeight: '800' },
  caption: { color: '#5E5E5E', fontSize: 13, lineHeight: 19 },
  section: { borderTopColor: '#E2E2E2', borderTopWidth: 1, gap: 8, paddingTop: 14 },
  sectionTitle: { color: '#1A1C1C', fontSize: 16, fontWeight: '800' },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodButton: { borderColor: '#D8CDD0', borderRadius: 10, borderWidth: 1, flex: 1, padding: 11 },
  methodButtonActive: { backgroundColor: neutralSelection.selectedSurface, borderColor: neutralSelection.selectedEdge, boxShadow: neutralSelection.selectedRaisedShadow },
  methodText: { color: '#4E061A', fontWeight: '700', textAlign: 'center' },
  methodTextActive: { color: neutralSelection.selectedText },
  choiceRow: { alignItems: 'center', borderColor: '#E2E2E2', borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  choiceRowActive: { backgroundColor: neutralSelection.selectedSurface, borderColor: neutralSelection.selectedEdge, boxShadow: neutralSelection.selectedRaisedShadow },
  choiceTitle: { color: '#1A1C1C', fontSize: 14, fontWeight: '700' },
  choiceCaption: { color: '#5E5E5E', fontSize: 12, marginTop: 3 },
  price: { color: '#4E061A', fontSize: 13, fontWeight: '800' },
  addOnList: { gap: 8, marginTop: 4 },
  arrangement: { borderColor: '#E2E2E2', borderRadius: 12, borderWidth: 1, marginTop: 8, overflow: 'hidden' },
  arrangementActive: { backgroundColor: neutralSelection.surface, borderColor: neutralSelection.selectedEdge, boxShadow: neutralSelection.selectedRaisedShadow },
  arrangementHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between', padding: 12 },
  arrangementHeaderActive: { backgroundColor: neutralSelection.selectedSurface },
  arrangementHeadingCopy: { flex: 1, minWidth: 0 },
  arrangementTitle: { fontSize: 15, lineHeight: 21 },
  arrangementMetaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  arrangementCategory: { marginTop: 0 },
  arrangementSelectedMark: { alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.76)', borderRadius: 10, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 },
  arrangementSelectedMarkText: { color: '#FFF', fontSize: 13, fontWeight: '900', lineHeight: 17 },
  configBody: { backgroundColor: '#FAF8F8', gap: 10, padding: 12 },
  quantityRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  quantityOptionRow: { alignItems: 'center', borderColor: '#E2E2E2', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
  quantityControls: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  inputLabel: { color: '#303033', fontSize: 12, fontWeight: '800' },
  quantityButton: { alignItems: 'center', backgroundColor: '#4E061A', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  quantityButtonDisabled: { backgroundColor: '#B7A7AA' },
  quantityButtonText: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  quantityValue: { color: '#1A1C1C', fontSize: 15, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  group: { gap: 6 },
  optionRow: { alignItems: 'center', borderColor: '#E2E2E2', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
  optionRowActive: { backgroundColor: neutralSelection.selectedSurface, borderColor: neutralSelection.selectedEdge, boxShadow: neutralSelection.selectedRaisedShadow },
  optionText: { color: '#303033', fontSize: 13, fontWeight: '600' },
  textInput: { backgroundColor: '#FFF', borderColor: '#D8CDD0', borderRadius: 8, borderWidth: 1, color: '#1A1C1C', minHeight: 40, paddingHorizontal: 10, paddingVertical: 8 },
  selectedText: { color: neutralSelection.selectedText },
  selectedMutedText: { color: neutralSelection.selectedMutedText },
  neoRaised: { borderColor: neutralSelection.edge, backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.raisedShadow },
  neoInset: { borderColor: neutralSelection.edge, backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.sunkenShadow },
  neoConfigBody: { backgroundColor: '#E9EDF0', borderTopWidth: 1, borderTopColor: 'rgba(157, 169, 178, 0.24)' },
  neoInput: { borderColor: 'rgba(255, 255, 255, 0.72)', backgroundColor: '#E9EDF0', boxShadow: 'inset 2px 2px 5px rgba(157, 169, 178, 0.40), inset -2px -2px 5px rgba(255, 255, 255, 0.92)' },
})
