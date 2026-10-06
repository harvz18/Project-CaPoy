import { MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native'
import { Text } from './AppText'

export interface MultiSelectOption {
  description?: string
  label: string
  value: string
}

interface MultiSelectFieldProps {
  error?: string
  helper?: string
  label: string
  onApply: (values: string[]) => void
  options: MultiSelectOption[]
  selectedValues: string[]
}

const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

export const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  error,
  helper,
  label,
  onApply,
  options,
  selectedValues,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [draftValues, setDraftValues] = React.useState<string[]>([])
  const normalizedSelected = uniqueValues(selectedValues)
  const knownValues = new Set(options.map((option) => option.value))
  const availableOptions: MultiSelectOption[] = [
    ...options,
    ...normalizedSelected
      .filter((value) => !knownValues.has(value))
      .map((value) => ({ label: value, value })),
  ]
  const labelsByValue = new Map(availableOptions.map((option) => [option.value, option.label]))
  const summary = normalizedSelected.length > 0
    ? normalizedSelected.map((value) => labelsByValue.get(value) ?? value).join(', ')
    : `No ${label.toLowerCase()} selected`

  const open = () => {
    setDraftValues(normalizedSelected)
    setIsOpen(true)
  }

  const toggle = (value: string) => {
    setDraftValues((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value])
  }

  const apply = () => {
    const selected = new Set(draftValues)
    onApply(availableOptions.filter((option) => selected.has(option.value)).map((option) => option.value))
    setIsOpen(false)
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      <Pressable
        accessibilityLabel={`${normalizedSelected.length > 0 ? 'Edit' : 'Select'} ${label}`}
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [
          styles.selector,
          error && styles.selectorError,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.selectorCopy}>
          <Text
            numberOfLines={2}
            style={normalizedSelected.length > 0 ? styles.summary : styles.placeholder}
          >
            {summary}
          </Text>
          <Text style={styles.selectionCount}>
            {normalizedSelected.length > 0
              ? `${normalizedSelected.length} selected`
              : 'Tap to choose'}
          </Text>
        </View>
        <MaterialCommunityIcons color={palette.primary} name="chevron-down" size={22} />
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel={`Close ${label} selection`}
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.panel}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>MULTIPLE SELECTION</Text>
                <Text style={styles.title}>Select {label}</Text>
                <Text style={styles.description}>Choose every option that applies to this service.</Text>
              </View>
              <Pressable
                accessibilityLabel={`Close ${label} selection`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons color={palette.secondary} name="close" size={22} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.optionList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {availableOptions.map((option) => {
                const selected = draftValues.includes(option.value)
                return (
                  <Pressable
                    accessibilityLabel={option.description
                      ? `${option.label}. ${option.description}`
                      : option.label}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={option.value}
                    onPress={() => toggle(option.value)}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      ) : null}
                    </View>
                    <View pointerEvents="none">
                      <Switch
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        thumbColor="#FFFFFF"
                        trackColor={{ false: '#C9C7C8', true: palette.primary }}
                        value={selected}
                      />
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsOpen(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={apply}
                style={({ pressed }) => [styles.applyButton, pressed && styles.applyButtonPressed]}
              >
                <Text style={styles.applyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const palette = {
  border: '#E6E1E2',
  error: '#BA1A1A',
  input: '#FFFFFF',
  primary: '#6B1E2E',
  primarySoft: '#F8ECEF',
  secondary: '#666263',
  text: '#211F20',
} as const

const styles = StyleSheet.create({
  field: { width: '100%', minWidth: 0, gap: 7 },
  label: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  helper: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  selector: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.input,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  selectorError: { borderColor: palette.error },
  selectorCopy: { minWidth: 0, flex: 1, gap: 2 },
  summary: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  placeholder: { color: palette.secondary, fontSize: 13, lineHeight: 18 },
  selectionCount: { color: palette.secondary, fontSize: 10, lineHeight: 14 },
  error: { color: palette.error, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 16, 18, 0.58)',
    padding: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '82%',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    padding: 20,
  },
  headerCopy: { minWidth: 0, flex: 1, gap: 3 },
  eyebrow: { color: palette.primary, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 1 },
  title: { color: palette.text, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  description: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  optionList: { gap: 8, padding: 16 },
  option: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionSelected: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  optionCopy: { minWidth: 0, flex: 1 },
  optionLabel: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  optionLabelSelected: { color: palette.primary },
  optionDescription: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    padding: 16,
  },
  cancelButton: { minHeight: 44, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 18 },
  cancelText: { color: palette.secondary, fontSize: 14, fontWeight: '700' },
  applyButton: { minHeight: 44, justifyContent: 'center', borderRadius: 8, backgroundColor: palette.primary, paddingHorizontal: 22 },
  applyButtonPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  applyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
})
