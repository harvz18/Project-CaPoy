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

export type ServicePricingModel = 'fixed' | 'startingAt' | 'customQuote'
export type ServicePricingUnit = 'event' | 'person' | 'hour' | 'day'

export interface ServicePricingValue {
  amount?: number
  currency: 'PHP'
  details: string
  model: ServicePricingModel
  unit?: ServicePricingUnit
}

interface Step2PricingScreenProps {
  initialValue?: Partial<ServicePricingValue>
  onBack?: () => void
  onNext?: (value: ServicePricingValue) => void
}

const pricingModels: Array<{
  description: string
  id: ServicePricingModel
  label: string
}> = [
  {
    id: 'fixed',
    label: 'Fixed price',
    description: 'Charge one set price for this service.',
  },
  {
    id: 'startingAt',
    label: 'Starting at',
    description: 'Show a base price that can increase with client needs.',
  },
  {
    id: 'customQuote',
    label: 'Custom quote',
    description: 'Discuss the scope first and send each client a quote.',
  },
]

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

export const Step2PricingScreen: React.FC<Step2PricingScreenProps> = ({
  initialValue,
  onBack,
  onNext,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [model, setModel] = React.useState<ServicePricingModel>(
    initialValue?.model ?? 'fixed'
  )
  const [amountInput, setAmountInput] = React.useState(
    initialValue?.amount && initialValue.amount > 0 ? String(initialValue.amount) : ''
  )
  const [unit, setUnit] = React.useState<ServicePricingUnit>(
    initialValue?.unit ?? 'event'
  )
  const [details, setDetails] = React.useState(initialValue?.details ?? '')
  const [submitted, setSubmitted] = React.useState(false)

  const requiresAmount = model !== 'customQuote'
  const amount = parseAmount(amountInput)
  const amountMissing = submitted && requiresAmount && !amount

  const handleModelChange = (nextModel: ServicePricingModel) => {
    setModel(nextModel)
    setSubmitted(false)
  }

  const handleNext = () => {
    setSubmitted(true)
    if (requiresAmount && !amount) return

    onNext?.({
      amount: requiresAmount ? amount : undefined,
      currency: 'PHP',
      details: details.trim(),
      model,
      unit: requiresAmount ? unit : undefined,
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
              accessibilityLabel="Go back to service information"
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
            Set Your Pricing
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
          <Text style={styles.title}>Set Your Pricing</Text>
          <Text style={styles.subtitle}>
            Choose how clients will see the price of this service.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Pricing Type</Text>
            <View style={styles.pricingModelList}>
              {pricingModels.map((option) => {
                const selected = model === option.id

                return (
                  <Pressable
                    key={option.id}
                    accessibilityLabel={`${option.label}. ${option.description}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => handleModelChange(option.id)}
                    style={({ pressed }) => [
                      styles.pricingModelCard,
                      selected && styles.pricingModelCardSelected,
                      pressed && styles.pricingModelCardPressed,
                    ]}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.pricingModelCopy}>
                      <Text
                        style={[
                          styles.pricingModelLabel,
                          selected && styles.pricingModelLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.pricingModelDescription}>{option.description}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {requiresAmount ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  {model === 'startingAt' ? 'Starting Price' : 'Price'}
                </Text>
                <View style={[styles.amountField, amountMissing && styles.inputError]}>
                  <View style={styles.currencyPrefix}>
                    <Text style={styles.currencySymbol}>{'\u20B1'}</Text>
                  </View>
                  <TextInput
                    accessibilityLabel={
                      model === 'startingAt' ? 'Starting price in Philippine pesos' : 'Price in Philippine pesos'
                    }
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    onChangeText={(value) => setAmountInput(sanitizeAmount(value))}
                    placeholder="0.00"
                    placeholderTextColor={palette.placeholder}
                    returnKeyType="done"
                    style={styles.amountInput}
                    value={amountInput}
                  />
                  <Text style={styles.currencyCode}>PHP</Text>
                </View>
                {amountMissing ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    Enter an amount greater than zero.
                  </Text>
                ) : (
                  <Text style={styles.helperText}>Clients will see this amount on your listing.</Text>
                )}
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
            </>
          ) : (
            <View style={styles.quoteNotice}>
              <View style={styles.quoteNoticeIcon}>
                <Text style={styles.quoteNoticeIconText}>i</Text>
              </View>
              <Text style={styles.quoteNoticeText}>
                Your listing will show “Request a quote.” You can agree on a price after
                reviewing each client's event details.
              </Text>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <View style={styles.detailsHeader}>
              <Text style={styles.label}>Package Details</Text>
              <Text style={styles.optionalLabel}>Optional</Text>
            </View>
            <TextInput
              accessibilityLabel="Package details"
              maxLength={300}
              multiline
              onChangeText={setDetails}
              placeholder="e.g., Includes buffet setup, service staff, and tableware"
              placeholderTextColor={palette.placeholder}
              style={[styles.textArea, styles.input]}
              textAlignVertical="top"
              value={details}
            />
            <Text style={styles.characterCount}>{details.length} / 300</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, isWide && styles.wideHorizontalPadding]}>
        <Pressable
          accessibilityLabel="Continue to availability"
          accessibilityRole="button"
          onPress={handleNext}
          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </Pressable>
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
  headerSide: {
    minWidth: 128,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
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
  label: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  pricingModelList: { gap: 8 },
  pricingModelCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 8,
    backgroundColor: palette.inputBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pricingModelCardSelected: {
    borderColor: palette.primaryContainer,
    backgroundColor: palette.primaryPill,
  },
  pricingModelCardPressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
  radio: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#877274',
    borderRadius: 10,
  },
  radioSelected: { borderColor: palette.primaryContainer },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primaryContainer },
  pricingModelCopy: { minWidth: 0, flex: 1 },
  pricingModelLabel: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  pricingModelLabelSelected: { color: palette.primaryContainer },
  pricingModelDescription: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
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
  currencySymbol: {
    color: palette.primaryContainer,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
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
  inputError: { borderColor: palette.error },
  helperText: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  errorText: { color: palette.error, fontSize: 12, lineHeight: 16 },
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
  quoteNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 8,
    backgroundColor: palette.primaryPill,
    padding: 16,
  },
  quoteNoticeIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: palette.primaryContainer,
  },
  quoteNoticeIconText: {
    color: palette.onPrimary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  quoteNoticeText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionalLabel: { color: palette.placeholder, fontSize: 12, lineHeight: 16 },
  input: {
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
  textArea: { minHeight: 104 },
  characterCount: { alignSelf: 'flex-end', color: palette.placeholder, fontSize: 12, lineHeight: 16 },
  footer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  nextButton: {
    width: '100%',
    maxWidth: 728,
    minHeight: 52,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  nextButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  nextButtonText: {
    color: palette.onPrimary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  iconButtonPressed: { backgroundColor: palette.border, opacity: 0.72 },
})
