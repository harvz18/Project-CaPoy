import React from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import type { ServicePricingUnit } from './17.1-Step2Pricing'

export interface ServicePackageValue {
  currency: 'PHP'
  description: string
  id: string
  inclusions: string[]
  name: string
  price: number
  unit: ServicePricingUnit
}

interface Step2AddPackageScreenProps {
  initialValue?: Partial<ServicePackageValue>
  maxInclusions?: number
  onBack?: () => void
  onSave?: (value: ServicePackageValue) => void
}

const pricingUnits: Array<{ id: ServicePricingUnit; label: string }> = [
  { id: 'event', label: 'Per event' },
  { id: 'person', label: 'Per person' },
  { id: 'hour', label: 'Per hour' },
  { id: 'day', label: 'Per day' },
]

const sanitizeAmount = (value: string) => {
  const numericValue = value.replace(/[^\d.]/g, '')
  const [whole = '', ...decimalParts] = numericValue.split('.')
  const decimal = decimalParts.join('').slice(0, 2)

  return numericValue.includes('.') ? `${whole}.${decimal}` : whole
}

const parseAmount = (value: string) => {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

export const Step2AddPackageScreen: React.FC<Step2AddPackageScreenProps> = ({
  initialValue,
  maxInclusions = 10,
  onBack,
  onSave,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const inclusionLimit = Number.isFinite(maxInclusions)
    ? Math.max(1, Math.floor(maxInclusions))
    : 10
  const isEditing = Boolean(initialValue?.id)
  const [packageId] = React.useState(
    () => initialValue?.id ?? `package-${Date.now().toString(36)}`
  )
  const [name, setName] = React.useState(initialValue?.name ?? '')
  const [description, setDescription] = React.useState(initialValue?.description ?? '')
  const [priceInput, setPriceInput] = React.useState(
    initialValue?.price && initialValue.price > 0 ? String(initialValue.price) : ''
  )
  const [unit, setUnit] = React.useState<ServicePricingUnit>(
    initialValue?.unit ?? 'event'
  )
  const [inclusions, setInclusions] = React.useState<string[]>(() => {
    const initialInclusions = initialValue?.inclusions?.slice(0, inclusionLimit)
    return initialInclusions?.length ? initialInclusions : ['']
  })
  const [submitted, setSubmitted] = React.useState(false)

  const normalizedName = name.trim()
  const price = parseAmount(priceInput)
  const nameMissing = submitted && normalizedName.length === 0
  const priceMissing = submitted && !price
  const canAddInclusion = inclusions.length < inclusionLimit

  const handleInclusionChange = (index: number, value: string) => {
    setInclusions((current) =>
      current.map((inclusion, inclusionIndex) =>
        inclusionIndex === index ? value : inclusion
      )
    )
  }

  const handleAddInclusion = () => {
    if (!canAddInclusion) return
    setInclusions((current) => [...current, ''])
  }

  const handleRemoveInclusion = (index: number) => {
    setInclusions((current) => {
      if (current.length === 1) return ['']
      return current.filter((_, inclusionIndex) => inclusionIndex !== index)
    })
  }

  const handleSave = () => {
    setSubmitted(true)
    if (!normalizedName || !price) return

    onSave?.({
      currency: 'PHP',
      description: description.trim(),
      id: packageId,
      inclusions: inclusions.map((inclusion) => inclusion.trim()).filter(Boolean),
      name: normalizedName,
      price,
      unit,
    })
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <View style={styles.headerSide}>
            <Pressable
              accessibilityLabel="Go back to pricing"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.iconButtonPressed]}
            >
              <BackIcon />
            </Pressable>

            <View style={styles.progressBlock}>
              <Text style={styles.stepCaption}>Step 2 of 3</Text>
              <View
                accessibilityLabel="Step 2 of 3"
                accessibilityRole="progressbar"
                accessibilityValue={{ max: 3, min: 1, now: 2 }}
                style={styles.progressRow}
              >
                {[0, 1, 2].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.progressSegment,
                      step <= 1 ? styles.progressSegmentActive : styles.progressSegmentInactive,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          <Text numberOfLines={1} style={styles.headerTitle}>
            {isEditing ? 'Edit Package' : 'Add Package'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>{isEditing ? 'Edit Your Package' : 'Create a Package'}</Text>
          <Text style={styles.subtitle}>
            Bundle your service into a clear option that clients can compare.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Package Name</Text>
              <Text style={styles.characterCount}>{name.length} / 60</Text>
            </View>
            <TextInput
              accessibilityLabel="Package name"
              autoCapitalize="words"
              maxLength={60}
              onChangeText={setName}
              placeholder="e.g., Premium Wedding Buffet"
              placeholderTextColor={palette.placeholder}
              returnKeyType="next"
              style={[styles.input, nameMissing && styles.inputError]}
              value={name}
            />
            {nameMissing ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                Enter a package name.
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Package Price</Text>
            <View style={[styles.amountField, priceMissing && styles.inputError]}>
              <View style={styles.currencyPrefix}>
                <Text style={styles.currencySymbol}>{'\u20B1'}</Text>
              </View>
              <TextInput
                accessibilityLabel="Package price in Philippine pesos"
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={(value) => setPriceInput(sanitizeAmount(value))}
                placeholder="0.00"
                placeholderTextColor={palette.placeholder}
                returnKeyType="done"
                style={styles.amountInput}
                value={priceInput}
              />
              <Text style={styles.currencyCode}>PHP</Text>
            </View>
            {priceMissing ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                Enter an amount greater than zero.
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Charge Per</Text>
            <View accessibilityRole="radiogroup" style={styles.unitGrid}>
              {pricingUnits.map((option) => {
                const selected = unit === option.id

                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setUnit(option.id)}
                    style={({ pressed }) => [
                      styles.unitChip,
                      selected && styles.unitChipSelected,
                      pressed && styles.unitChipPressed,
                    ]}
                  >
                    <Text style={[styles.unitText, selected && styles.unitTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.optionalLabel}>Optional</Text>
            </View>
            <TextInput
              accessibilityLabel="Package description"
              maxLength={300}
              multiline
              onChangeText={setDescription}
              placeholder="Describe who this package is for and what makes it valuable."
              placeholderTextColor={palette.placeholder}
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
              value={description}
            />
            <Text style={styles.characterCount}>{description.length} / 300</Text>
          </View>

          <View style={styles.inclusionsSection}>
            <View style={styles.inclusionsHeader}>
              <View>
                <Text style={styles.sectionTitle}>What's Included</Text>
                <Text style={styles.sectionSubtitle}>Add the main benefits in this package.</Text>
              </View>
              <Text style={styles.inclusionCount}>
                {inclusions.length} / {inclusionLimit}
              </Text>
            </View>

            <View style={styles.inclusionList}>
              {inclusions.map((inclusion, index) => (
                <View key={index} style={styles.inclusionRow}>
                  <View style={styles.checkIcon}>
                    <Text style={styles.checkIconText}>{'\u2713'}</Text>
                  </View>
                  <TextInput
                    accessibilityLabel={`Package inclusion ${index + 1}`}
                    maxLength={100}
                    onChangeText={(value) => handleInclusionChange(index, value)}
                    placeholder="e.g., Buffet setup and tableware"
                    placeholderTextColor={palette.placeholder}
                    returnKeyType="next"
                    style={[styles.input, styles.inclusionInput]}
                    value={inclusion}
                  />
                  <Pressable
                    accessibilityLabel={`Remove inclusion ${index + 1}`}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => handleRemoveInclusion(index)}
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed && styles.removeButtonPressed,
                    ]}
                  >
                    <Text style={styles.removeButtonText}>{'\u00D7'}</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAddInclusion }}
              disabled={!canAddInclusion}
              onPress={handleAddInclusion}
              style={({ pressed }) => [
                styles.addInclusionButton,
                !canAddInclusion && styles.addInclusionButtonDisabled,
                pressed && styles.addInclusionButtonPressed,
              ]}
            >
              <Text style={styles.addInclusionIcon}>+</Text>
              <Text style={styles.addInclusionText}>Add inclusion</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, isWide && styles.wideHorizontalPadding]}>
        <View style={styles.footerContent}>
          <Pressable
            accessibilityLabel="Cancel package changes"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={isEditing ? 'Save package changes' : 'Add package'}
            accessibilityRole="button"
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
          >
            <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Package'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const palette = {
  background: '#FAF9F9',
  border: '#EFEDED',
  error: '#BA1A1A',
  inputBackground: '#FFFFFF',
  onPrimary: '#FFFFFF',
  placeholder: '#A8A8A9',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primaryPill: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerHigh: '#E9E8E8',
  text: '#1B1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 20,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  headerSide: { minWidth: 128, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginLeft: -8,
  },
  backIcon: { width: 24, height: 24, justifyContent: 'center' },
  backIconHead: {
    position: 'absolute',
    left: 4,
    width: 10,
    height: 10,
    borderBottomWidth: 1.8,
    borderLeftWidth: 1.8,
    borderColor: palette.primary,
    transform: [{ rotate: '45deg' }],
  },
  backIconShaft: {
    width: 16,
    height: 1.8,
    marginLeft: 4,
    borderRadius: 1,
    backgroundColor: palette.primary,
  },
  progressBlock: { gap: 4 },
  stepCaption: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressSegment: { width: 32, height: 4, borderRadius: 2 },
  progressSegmentActive: { backgroundColor: palette.primaryContainer },
  progressSegmentInactive: { backgroundColor: palette.surfaceContainerHigh },
  headerTitle: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  headerSpacer: { width: 128 },
  content: { width: '100%', maxWidth: 768, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 40 },
  intro: { marginBottom: 32 },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  form: { gap: 24 },
  fieldGroup: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  optionalLabel: { color: palette.placeholder, fontSize: 12, lineHeight: 16 },
  characterCount: { alignSelf: 'flex-end', color: palette.placeholder, fontSize: 12, lineHeight: 16 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 8,
    backgroundColor: palette.inputBackground,
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inputError: { borderColor: palette.error },
  errorText: { color: palette.error, fontSize: 12, lineHeight: 16 },
  amountField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 8,
    backgroundColor: palette.inputBackground,
  },
  currencyPrefix: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: palette.surfaceContainerHigh,
    paddingHorizontal: 16,
  },
  currencySymbol: { color: palette.primaryContainer, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  amountInput: {
    minWidth: 0,
    flex: 1,
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  currencyCode: { color: palette.secondary, fontSize: 12, lineHeight: 16, paddingRight: 16 },
  unitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 999,
    backgroundColor: palette.inputBackground,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unitChipSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryPill },
  unitChipPressed: { opacity: 0.72 },
  unitText: { color: palette.secondary, fontSize: 14, lineHeight: 20 },
  unitTextSelected: { color: palette.primaryContainer, fontWeight: '600' },
  textArea: { minHeight: 104 },
  inclusionsSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 24,
  },
  inclusionsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  sectionTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  sectionSubtitle: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  inclusionCount: { color: palette.placeholder, fontSize: 12, lineHeight: 16 },
  inclusionList: { gap: 8 },
  inclusionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.primaryPill,
  },
  checkIconText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  inclusionInput: { minWidth: 0, flex: 1 },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  removeButtonPressed: { backgroundColor: palette.border, opacity: 0.7 },
  removeButtonText: { color: palette.secondary, fontSize: 24, lineHeight: 26 },
  addInclusionButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  addInclusionButtonDisabled: { opacity: 0.4 },
  addInclusionButtonPressed: { backgroundColor: palette.primaryPill },
  addInclusionIcon: { color: palette.primaryContainer, fontSize: 20, lineHeight: 20, fontWeight: '500' },
  addInclusionText: { color: palette.primaryContainer, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  footer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  footerContent: {
    width: '100%',
    maxWidth: 728,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    minWidth: 104,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.primaryContainer,
    borderRadius: 999,
    paddingHorizontal: 20,
  },
  cancelButtonPressed: { backgroundColor: palette.primaryPill },
  cancelButtonText: { color: palette.primaryContainer, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  saveButton: {
    minHeight: 52,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 20,
  },
  saveButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  saveButtonText: { color: palette.onPrimary, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  iconButtonPressed: { backgroundColor: palette.border, opacity: 0.72 },
})
