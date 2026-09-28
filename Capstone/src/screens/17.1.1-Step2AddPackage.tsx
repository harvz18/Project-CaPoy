import { Text } from '../components/AppText'
import React from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import type { ServicePricingUnit } from './17.1-Step2Pricing'

export interface ServicePackageValue {
  currency: 'PHP'
  description: string
  discountAmount?: number
  discountType?: PackageDiscountType
  discountValue?: number
  id: string
  inclusions: string[]
  name: string
  price: number
  pricingMode?: 'composed' | 'legacy'
  serviceIds?: string[]
  services?: PackageServiceOption[]
  subtotal?: number
  unit: ServicePricingUnit
}

export type PackageDiscountType = 'none' | 'percentage' | 'fixed'

export interface PackageServiceOption {
  id: string
  name: string
  price: number
  unit: ServicePricingUnit
}

interface Step2AddPackageScreenProps {
  availableServices?: PackageServiceOption[]
  commissionRate?: number
  initialValue?: Partial<ServicePackageValue>
  isSaving?: boolean
  maxInclusions?: number
  mode?: 'listing' | 'standalone'
  onBack?: (draft?: ServicePackageValue) => void
  onSave?: (value: ServicePackageValue) => void
  onSkip?: () => void
  requiredServiceId?: string
}

const sanitizeAmount = (value: string) => {
  const numericValue = value.replace(/[^\d.]/g, '')
  const [whole = '', ...decimalParts] = numericValue.split('.')
  const decimal = decimalParts.join('').slice(0, 2)

  return numericValue.includes('.') ? `${whole}.${decimal}` : whole
}

const parseAmount = (value: string) => {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : 0
}

const money = (amount: number) =>
  `\u20B1${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const unitLabel = (unit: ServicePricingUnit) =>
  ({ event: 'event', person: 'person', hour: 'hour', day: 'day' })[unit]

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

export const Step2AddPackageScreen: React.FC<Step2AddPackageScreenProps> = ({
  availableServices = [],
  commissionRate = 0.1,
  initialValue,
  isSaving = false,
  maxInclusions = 10,
  mode = 'listing',
  onBack,
  onSave,
  onSkip,
  requiredServiceId,
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
  const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>(
    () => initialValue?.serviceIds?.length
      ? initialValue.serviceIds
      : requiredServiceId
        ? [requiredServiceId]
        : []
  )
  const [discountType, setDiscountType] = React.useState<PackageDiscountType>(
    initialValue?.discountType ?? 'none'
  )
  const [discountInput, setDiscountInput] = React.useState(
    initialValue?.discountValue ? String(initialValue.discountValue) : ''
  )
  const [inclusions, setInclusions] = React.useState<string[]>(() => {
    const initialInclusions = initialValue?.inclusions?.slice(0, inclusionLimit)
    return initialInclusions?.length ? initialInclusions : ['']
  })
  const [submitted, setSubmitted] = React.useState(false)

  const normalizedName = name.trim()
  const selectedServices = selectedServiceIds.flatMap((serviceId) => {
    const service = availableServices.find((option) => option.id === serviceId)
    return service ? [service] : []
  })
  const unit = selectedServices[0]?.unit ?? initialValue?.unit ?? 'event'
  const hasMixedUnits = selectedServices.some((service) => service.unit !== unit)
  const subtotal = selectedServices.reduce((sum, service) => sum + service.price, 0)
  const discountValue = discountType === 'none' ? 0 : parseAmount(discountInput)
  const discountAmount = discountType === 'percentage'
    ? Math.round((subtotal * Math.min(discountValue, 99.99) / 100) * 100) / 100
    : discountType === 'fixed'
      ? Math.min(discountValue, subtotal)
      : 0
  const price = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100)
  const commissionAmount = Math.round(price * Math.max(0, commissionRate) * 100) / 100
  const customerPrice = price + commissionAmount
  const nameMissing = submitted && normalizedName.length === 0
  const servicesMissing = submitted && selectedServices.length === 0
  const isDiscountInvalid = (
    (discountType === 'percentage' && discountValue >= 100)
    || (discountType === 'fixed' && discountValue >= subtotal)
  )
  const discountInvalid = submitted && isDiscountInvalid
  const canAddInclusion = inclusions.length < inclusionLimit

  React.useEffect(() => {
    if (!requiredServiceId) return
    setSelectedServiceIds((current) =>
      current.includes(requiredServiceId) ? current : [requiredServiceId, ...current]
    )
  }, [requiredServiceId])

  const toggleService = (serviceId: string) => {
    if (serviceId === requiredServiceId) return
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    )
  }

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
    if (
      isSaving
      || !normalizedName
      || selectedServices.length === 0
      || hasMixedUnits
      || price <= 0
      || isDiscountInvalid
    ) return

    onSave?.({
      currency: 'PHP',
      description: description.trim(),
      discountAmount,
      discountType,
      discountValue,
      id: packageId,
      inclusions: inclusions.map((inclusion) => inclusion.trim()).filter(Boolean),
      name: normalizedName,
      price,
      pricingMode: 'composed',
      serviceIds: selectedServices.map((service) => service.id),
      services: selectedServices,
      subtotal,
      unit,
    })
  }

  const buildDraft = (): ServicePackageValue | undefined => {
    if (!normalizedName || selectedServices.length === 0 || hasMixedUnits || price <= 0) {
      return undefined
    }

    return {
      currency: 'PHP',
      description: description.trim(),
      discountAmount,
      discountType,
      discountValue,
      id: packageId,
      inclusions: inclusions.map((inclusion) => inclusion.trim()).filter(Boolean),
      name: normalizedName,
      price,
      pricingMode: 'composed',
      serviceIds: selectedServices.map((service) => service.id),
      services: selectedServices,
      subtotal,
      unit,
    }
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
              onPress={() => onBack?.(buildDraft())}
              style={({ pressed }) => [styles.backButton, pressed && styles.iconButtonPressed]}
            >
              <BackIcon />
            </Pressable>

            {mode === 'listing' ? (
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
            ) : null}
          </View>

          <Text
            numberOfLines={isWide ? 1 : 2}
            style={[styles.headerTitle, !isWide && styles.headerTitleMobile]}
          >
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
          <View style={styles.introHeader}>
            <View style={styles.introCopy}>
              <Text style={styles.title}>{isEditing ? 'Edit Your Package' : 'Create a Package'}</Text>
              <Text style={styles.subtitle}>
                Select from your priced services. The package total updates automatically,
                and you may add an optional promo discount.
              </Text>
            </View>
            {!isEditing && mode === 'listing' ? (
              <Pressable
                accessibilityLabel="Skip package setup"
                accessibilityRole="button"
                onPress={onSkip}
                style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </Pressable>
            ) : null}
          </View>
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
            <View style={styles.labelRow}>
              <Text style={styles.label}>Services in this package</Text>
              <Text style={styles.characterCount}>{selectedServices.length} selected</Text>
            </View>
            <Text style={styles.helperText}>
              Only your services with a set price are shown. Services must use the same charging unit.
              {mode === 'standalone' ? ' Your first selection becomes the package\'s primary listing.' : ''}
            </Text>
            <View style={[styles.serviceList, servicesMissing && styles.serviceListError]}>
              {availableServices.length > 0 ? availableServices.map((service) => {
                const selected = selectedServiceIds.includes(service.id)
                const required = service.id === requiredServiceId
                const incompatible = selectedServices.length > 0 && service.unit !== unit && !selected

                return (
                  <Pressable
                    key={service.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled: required || incompatible }}
                    disabled={required || incompatible}
                    onPress={() => toggleService(service.id)}
                    style={({ pressed }) => [
                      styles.serviceOption,
                      selected && styles.serviceOptionSelected,
                      incompatible && styles.serviceOptionDisabled,
                      pressed && styles.serviceOptionPressed,
                    ]}
                  >
                    <View style={[styles.serviceCheck, selected && styles.serviceCheckSelected]}>
                      {selected ? <Text style={styles.serviceCheckText}>{'\u2713'}</Text> : null}
                    </View>
                    <View style={styles.serviceCopy}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <Text style={styles.serviceMeta}>
                        {money(service.price)} per {unitLabel(service.unit)}{required ? ' · Required' : ''}
                      </Text>
                    </View>
                  </Pressable>
                )
              }) : (
                <View style={styles.emptyServices}>
                  <Text style={styles.emptyServicesTitle}>No priced services available</Text>
                  <Text style={styles.helperText}>Add a service with a fixed price before creating a package.</Text>
                </View>
              )}
            </View>
            {servicesMissing ? (
              <Text accessibilityRole="alert" style={styles.errorText}>Select at least one service.</Text>
            ) : null}
            {hasMixedUnits ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                Selected services must use the same charging unit.
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Package discount</Text>
              <Text style={styles.optionalLabel}>Optional</Text>
            </View>
            <View accessibilityRole="radiogroup" style={styles.discountOptions}>
              {([
                ['none', 'No discount'],
                ['percentage', 'Percentage'],
                ['fixed', 'Fixed amount'],
              ] as Array<[PackageDiscountType, string]>).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: discountType === value }}
                  onPress={() => {
                    setDiscountType(value)
                    if (value === 'none') setDiscountInput('')
                  }}
                  style={({ pressed }) => [
                    styles.discountChip,
                    discountType === value && styles.discountChipSelected,
                    pressed && styles.unitChipPressed,
                  ]}
                >
                  <Text style={[
                    styles.unitText,
                    discountType === value && styles.unitTextSelected,
                  ]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {discountType !== 'none' ? (
              <View style={[styles.amountField, discountInvalid && styles.inputError]}>
                <View style={styles.currencyPrefix}>
                  <Text style={styles.currencySymbol}>
                    {discountType === 'percentage' ? '%' : '\u20B1'}
                  </Text>
                </View>
                <TextInput
                  accessibilityLabel={discountType === 'percentage' ? 'Discount percentage' : 'Discount amount'}
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  onChangeText={(value) => setDiscountInput(sanitizeAmount(value))}
                  placeholder="0.00"
                  placeholderTextColor={palette.placeholder}
                  style={styles.amountInput}
                  value={discountInput}
                />
              </View>
            ) : null}
            {discountInvalid ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                The discount must be less than the package subtotal.
              </Text>
            ) : null}
          </View>

          <View style={styles.priceSummary}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Services subtotal</Text>
              <Text style={styles.priceValue}>{money(subtotal)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Your package discount</Text>
              <Text style={styles.discountValue}>-{money(discountAmount)}</Text>
            </View>
            <View style={[styles.priceRow, styles.providerTotalRow]}>
              <View>
                <Text style={styles.providerTotalLabel}>Your package price</Text>
                <Text style={styles.helperText}>Amount before MULTIVENT's added fee</Text>
              </View>
              <Text style={styles.providerTotal}>{money(price)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Estimated client total</Text>
              <Text style={styles.clientTotal}>{money(customerPrice)}</Text>
            </View>
            <Text style={styles.commissionNote}>
              Includes {Math.round(Math.max(0, commissionRate) * 10000) / 100}% MULTIVENT commission ({money(commissionAmount)}).
            </Text>
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
            onPress={() => onBack?.(buildDraft())}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={isEditing ? 'Save package changes' : 'Add package'}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaving }}
            disabled={isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              isSaving && styles.saveButtonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
          >
            {isSaving ? <ActivityIndicator color={palette.onPrimary} size="small" /> : null}
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving package...' : isEditing ? 'Save Changes' : 'Add Package'}
            </Text>
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
  headerSide: { minWidth: 112, flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  headerTitleMobile: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'right',
  },
  headerSpacer: { width: 40 },
  content: { width: '100%', maxWidth: 768, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 40 },
  intro: { marginBottom: 32 },
  introHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  introCopy: { minWidth: 0, flex: 1 },
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
  helperText: { color: palette.secondary, fontSize: 12, lineHeight: 17 },
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
  serviceList: {
    gap: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.inputBackground,
    padding: 8,
  },
  serviceListError: { borderColor: palette.error },
  serviceOption: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  serviceOptionSelected: { backgroundColor: palette.primaryPill },
  serviceOptionDisabled: { opacity: 0.45 },
  serviceOptionPressed: { opacity: 0.72 },
  serviceCheck: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.placeholder,
    borderRadius: 6,
  },
  serviceCheckSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryContainer },
  serviceCheckText: { color: palette.onPrimary, fontSize: 13, lineHeight: 16, fontWeight: '700' },
  serviceCopy: { minWidth: 0, flex: 1 },
  serviceName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  serviceMeta: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  emptyServices: { gap: 4, padding: 12 },
  emptyServicesTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  discountOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  discountChip: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 999,
    backgroundColor: palette.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  discountChipSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryPill },
  priceSummary: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#E7CDD2',
    borderRadius: 14,
    backgroundColor: '#FFF9FA',
    padding: 16,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  priceLabel: { color: palette.secondary, fontSize: 13, lineHeight: 18 },
  priceValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  discountValue: { color: '#2E7D4F', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  providerTotalRow: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12 },
  providerTotalLabel: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  providerTotal: { color: palette.primaryContainer, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  clientTotal: { color: palette.primaryContainer, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  commissionNote: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
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
  skipButton: {
    minWidth: 88,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7CDD2',
    borderRadius: 999,
    backgroundColor: palette.primaryPill,
    paddingHorizontal: 16,
  },
  skipButtonPressed: { opacity: 0.78 },
  skipButtonText: { color: palette.primaryContainer, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  saveButton: {
    minHeight: 52,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
  },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  saveButtonText: { color: palette.onPrimary, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  iconButtonPressed: { backgroundColor: palette.border, opacity: 0.72 },
})
