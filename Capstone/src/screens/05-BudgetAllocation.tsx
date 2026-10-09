import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  GestureResponderEvent,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'

import { Text } from '../components/AppText'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name']

export type BudgetPriority =
  | 'venue'
  | 'catering'
  | 'eventOrganizer'
  | 'photoVideo'
  | 'gownRental'
  | 'hostEmcee'
  | 'soundLights'
  | 'floral'

export type CategoryBudgetAllocation = {
  amount: number
  categoryKey: BudgetPriority
  label: string
  locked?: boolean
}

export interface BudgetAllocationValue {
  allocations: CategoryBudgetAllocation[]
  budget: number
  priorities: BudgetPriority[]
}

interface BudgetAllocationScreenProps {
  coordinatorCost?: number
  initialAllocations?: CategoryBudgetAllocation[]
  initialBudget?: number
  initialPriorities?: BudgetPriority[]
  isProcessing?: boolean
  onBack?: () => void
  onBudgetChange?: (budget: number) => void
  onContinue?: (value: BudgetAllocationValue) => void
  onPrioritiesChange?: (priorities: BudgetPriority[]) => void
  onSkip?: () => void
}

const categoryOptions: ReadonlyArray<{
  id: BudgetPriority
  icon: MaterialIconName
  label: string
}> = [
  { id: 'venue', icon: 'location-on', label: 'Venue' },
  { id: 'catering', icon: 'restaurant', label: 'Catering' },
  { id: 'photoVideo', icon: 'camera-alt', label: 'Photography & Video' },
  { id: 'floral', icon: 'local-florist', label: 'Florist & Styling' },
  { id: 'soundLights', icon: 'volume-up', label: 'Sound & Lights' },
  { id: 'hostEmcee', icon: 'mic', label: 'Host / Emcee' },
  { id: 'gownRental', icon: 'checkroom', label: 'Attire & Gown Rental' },
  { id: 'eventOrganizer', icon: 'event', label: 'Event Coordinator' },
]

type AllocationMap = Record<BudgetPriority, number>

const emptyAllocations = (): AllocationMap => ({
  catering: 0,
  eventOrganizer: 0,
  floral: 0,
  gownRental: 0,
  hostEmcee: 0,
  photoVideo: 0,
  soundLights: 0,
  venue: 0,
})

const sanitizeMoney = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0

const formatMoney = (value: number) =>
  `₱${sanitizeMoney(value).toLocaleString('en-PH', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`

const formatDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const allocationStep = (budget: number) => {
  if (budget <= 10_000) return 100
  if (budget <= 100_000) return 500
  return 1_000
}

const buildAllocations = (
  initialAllocations: CategoryBudgetAllocation[],
  coordinatorCost: number
) => {
  const result = emptyAllocations()

  initialAllocations.forEach((allocation) => {
    if (allocation.categoryKey in result) {
      result[allocation.categoryKey] = sanitizeMoney(allocation.amount)
    }
  })
  result.eventOrganizer = Math.max(result.eventOrganizer, sanitizeMoney(coordinatorCost))

  return result
}

const clampAllocations = (
  current: AllocationMap,
  budget: number,
  coordinatorCost: number
) => {
  const next = emptyAllocations()
  const safeBudget = sanitizeMoney(budget)
  const reservedCoordinator = sanitizeMoney(coordinatorCost)

  // Never silently reduce a committed coordinator cost. If it exceeds the
  // total, the UI asks the client to raise the event budget.
  next.eventOrganizer = Math.max(current.eventOrganizer, reservedCoordinator)
  let available = Math.max(safeBudget - next.eventOrganizer, 0)

  categoryOptions.forEach((category) => {
    if (category.id === 'eventOrganizer') return
    const amount = Math.min(sanitizeMoney(current[category.id]), available)
    next[category.id] = amount
    available = Math.max(available - amount, 0)
  })

  return next
}

interface AllocationSliderProps {
  amount: number
  budget: number
  coordinatorMinimum: number
  icon: MaterialIconName
  label: string
  legacyPriority: boolean
  locked: boolean
  maxAmount: number
  onChange: (amount: number) => void
}

const AllocationSlider: React.FC<AllocationSliderProps> = ({
  amount,
  budget,
  coordinatorMinimum,
  icon,
  label,
  legacyPriority,
  locked,
  maxAmount,
  onChange,
}) => {
  const [trackWidth, setTrackWidth] = React.useState(1)
  const step = allocationStep(budget)
  const minimum = sanitizeMoney(coordinatorMinimum)
  const percent = budget > 0 ? Math.min(amount / budget, 1) : 0

  const updateFromPosition = React.useCallback(
    (position: number) => {
      if (budget <= 0 || trackWidth <= 1 || locked) return
      const ratio = Math.max(0, Math.min(position / trackWidth, 1))
      const requested = Math.round((ratio * budget) / step) * step
      onChange(Math.max(minimum, Math.min(requested, maxAmount)))
    },
    [budget, locked, maxAmount, minimum, onChange, step, trackWidth]
  )

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => budget > 0 && !locked,
        onPanResponderGrant: (event) => updateFromPosition(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateFromPosition(event.nativeEvent.locationX),
        onStartShouldSetPanResponder: () => budget > 0 && !locked,
      }),
    [budget, locked, updateFromPosition]
  )

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(Math.max(event.nativeEvent.layout.width, 1))
  }

  const handleTrackPress = (event: GestureResponderEvent) => {
    updateFromPosition(event.nativeEvent.locationX)
  }

  const handleAmountChange = (value: string) => {
    const requested = Number(value.replace(/[^\d.]/g, ''))
    onChange(Math.max(minimum, Math.min(sanitizeMoney(requested), maxAmount)))
  }

  const adjust = (direction: -1 | 1) => {
    onChange(Math.max(minimum, Math.min(amount + direction * step, maxAmount)))
  }

  return (
    <View style={styles.allocationCard}>
      <View style={styles.allocationHeading}>
        <View style={styles.categoryIdentity}>
          <View style={styles.categoryIcon}>
            <MaterialIcons color={palette.primaryContainer} name={icon} size={20} />
          </View>
          <View style={styles.categoryCopy}>
            <Text style={styles.categoryLabel}>{label}</Text>
            {locked ? (
              <Text style={styles.reservedLabel}>Locked to selected service amount</Text>
            ) : minimum > 0 ? (
              <Text style={styles.reservedLabel}>
                {formatMoney(minimum)} committed coordinator cost
              </Text>
            ) : legacyPriority && amount === 0 ? (
              <Text style={styles.legacyLabel}>Previously marked as a priority</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.amountInputShell}>
          <Text style={styles.amountCurrency}>₱</Text>
          <TextInput
            accessibilityLabel={`${label} budget allocation`}
            editable={budget > 0 && !locked}
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={handleAmountChange}
            selectTextOnFocus
            style={styles.amountInput}
            value={String(sanitizeMoney(amount))}
          />
        </View>
      </View>

      <Pressable
        accessibilityActions={[
          { name: 'increment', label: `Increase ${label} allocation` },
          { name: 'decrement', label: `Decrease ${label} allocation` },
        ]}
        accessibilityLabel={`${label}: ${formatMoney(amount)} of ${formatMoney(budget)}`}
        accessibilityRole="adjustable"
        accessibilityValue={{ max: budget, min: minimum, now: amount }}
        disabled={budget <= 0 || locked}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') adjust(1)
          if (event.nativeEvent.actionName === 'decrement') adjust(-1)
        }}
        onLayout={(event) => setTrackWidth(Math.max(event.nativeEvent.layout.width, 1))}
        onPress={handleTrackPress}
        style={styles.sliderTouchArea}
        {...panResponder.panHandlers}
      >
        <View onLayout={handleTrackLayout} style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${percent * 100}%` }]} />
          <View style={[styles.sliderThumb, { left: `${percent * 100}%` }]} />
        </View>
      </Pressable>

      <View style={styles.sliderRange}>
        <Text style={styles.rangeText}>₱0</Text>
        <Text style={styles.rangeText}>Available: {formatMoney(maxAmount)}</Text>
      </View>
    </View>
  )
}

export const BudgetAllocationScreen: React.FC<BudgetAllocationScreenProps> = ({
  coordinatorCost = 0,
  initialAllocations = [],
  initialBudget,
  initialPriorities = [],
  isProcessing = false,
  onBack,
  onBudgetChange,
  onContinue,
  onPrioritiesChange,
  onSkip,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const initialBudgetValue = sanitizeMoney(initialBudget ?? 0)
  const [hasBudgetInput, setHasBudgetInput] = React.useState(initialBudgetValue > 0)
  const [budgetDigits, setBudgetDigits] = React.useState(
    initialBudgetValue > 0 ? String(Math.floor(initialBudgetValue)) : ''
  )
  const [allocations, setAllocations] = React.useState<AllocationMap>(() =>
    buildAllocations(initialAllocations, coordinatorCost)
  )
  const budget = hasBudgetInput && budgetDigits ? sanitizeMoney(Number(budgetDigits)) : 0
  const totalAllocated = Object.values(allocations).reduce((sum, amount) => sum + amount, 0)
  const remainingBudget = Math.max(budget - totalAllocated, 0)
  const coordinatorMinimum = sanitizeMoney(coordinatorCost)
  const budgetTooLow = coordinatorMinimum > budget
  const allocationExceeded = totalAllocated > budget
  const legacyPriorities = React.useMemo(() => new Set(initialPriorities), [initialPriorities])
  const lockedCategories = React.useMemo(
    () => new Set(initialAllocations.filter((item) => item.locked).map((item) => item.categoryKey)),
    [initialAllocations]
  )

  React.useEffect(() => {
    setAllocations((current) => clampAllocations(current, budget, coordinatorMinimum))
  }, [budget, coordinatorMinimum])

  React.useEffect(() => {
    const priorities = categoryOptions
      .filter((category) => allocations[category.id] > 0)
      .sort((left, right) => allocations[right.id] - allocations[left.id])
      .slice(0, 3)
      .map((category) => category.id)
    onPrioritiesChange?.(priorities)
  }, [allocations, onPrioritiesChange])

  const handleBudgetChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    setBudgetDigits(digits)
    onBudgetChange?.(digits ? Number(digits) : 0)
  }

  const handleAllocationChange = React.useCallback(
    (categoryKey: BudgetPriority, requestedAmount: number) => {
      setAllocations((current) => {
        const otherTotal = Object.entries(current).reduce(
          (sum, [key, amount]) => sum + (key === categoryKey ? 0 : amount),
          0
        )
        const minimum = categoryKey === 'eventOrganizer' ? coordinatorMinimum : 0
        const allowed = Math.max(budget - otherTotal, 0)

        return {
          ...current,
          [categoryKey]: Math.max(minimum, Math.min(sanitizeMoney(requestedAmount), allowed)),
        }
      })
    },
    [budget, coordinatorMinimum]
  )

  const handleContinue = () => {
    const savedAllocations = categoryOptions
      .map((category) => ({
        amount: sanitizeMoney(allocations[category.id]),
        categoryKey: category.id,
        label: category.label,
        locked: lockedCategories.has(category.id),
      }))
      .filter((allocation) => allocation.amount > 0)
    const priorities = [...savedAllocations]
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 3)
      .map((allocation) => allocation.categoryKey)

    onContinue?.({ allocations: savedAllocations, budget, priorities })
  }

  const removeBudget = () => {
    if (coordinatorMinimum > 0) return
    setBudgetDigits('')
    setHasBudgetInput(false)
    setAllocations(emptyAllocations())
    onBudgetChange?.(0)
  }

  const canContinue = !isProcessing && !budgetTooLow && !allocationExceeded

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <PlanningScreenHeader
        currentStep={2}
        label="Budget"
        nextEnabled={canContinue}
        onBack={isProcessing ? undefined : onBack}
        onNext={canContinue ? handleContinue : undefined}
        title="Budget"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCopy}>
          <Text style={styles.title}>Allocate Your Event Budget</Text>
          <Text style={styles.subtitle}>
            Set the total, then divide it among the services that matter to your event.
          </Text>
        </View>

        {hasBudgetInput ? (
          <View style={styles.budgetInputCard}>
            <Text style={styles.fieldLabel}>TOTAL EVENT BUDGET</Text>
            <View style={styles.totalBudgetRow}>
              <Text style={styles.totalCurrency}>₱</Text>
              <TextInput
                accessibilityLabel="Total event budget in Philippine pesos"
                inputMode="numeric"
                keyboardType="number-pad"
                onChangeText={handleBudgetChange}
                placeholder="150,000"
                placeholderTextColor={palette.secondaryFixedDim}
                selectionColor={palette.primaryContainer}
                style={styles.budgetInput}
                value={formatDigits(budgetDigits)}
              />
              {coordinatorMinimum === 0 ? (
                <Pressable
                  accessibilityLabel="Remove event budget"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={removeBudget}
                  style={({ pressed }) => [styles.removeBudgetButton, pressed && styles.pressed]}
                >
                  <MaterialIcons color={palette.secondary} name="close" size={20} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.optionalBudgetCard}>
            <View style={styles.optionalBudgetIcon}>
              <MaterialIcons color={palette.primaryContainer} name="account-balance-wallet" size={26} />
            </View>
            <View style={styles.optionalBudgetCopy}>
              <Text style={styles.optionalBudgetAmount}>₱0</Text>
              <Text style={styles.optionalBudgetTitle}>Budget is optional</Text>
              <Text style={styles.optionalBudgetDescription}>
                Add one to set category limits and see how much remains while planning.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Enter an event budget"
              accessibilityRole="button"
              onPress={() => setHasBudgetInput(true)}
              style={({ pressed }) => [styles.enterBudgetButton, pressed && styles.pressed]}
            >
              <Text style={styles.enterBudgetText}>ENTER BUDGET</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Allocated Budget</Text>
            <Text style={styles.summaryValue}>{formatMoney(totalAllocated)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Remaining Budget</Text>
            <Text style={[styles.summaryValue, styles.remainingValue]}>
              {formatMoney(remainingBudget)}
            </Text>
          </View>
        </View>

        {budgetTooLow ? (
          <View style={styles.errorBanner}>
            <MaterialIcons color={palette.error} name="error-outline" size={20} />
            <Text style={styles.errorText}>
              Raise the event budget to at least {formatMoney(coordinatorMinimum)} to cover the
              committed coordinator cost.
            </Text>
          </View>
        ) : null}

        <View style={styles.allocationsSection}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Category Budgets</Text>
            <Text style={styles.sectionSubtitle}>
              Drag a slider or enter an exact amount. The combined total cannot exceed your event
              budget.
            </Text>
          </View>

          <View style={styles.allocationList}>
            {categoryOptions.map((category) => {
              const amount = allocations[category.id]
              const otherTotal = totalAllocated - amount
              const maximum = Math.max(budget - otherTotal, 0)
              const minimum = category.id === 'eventOrganizer' ? coordinatorMinimum : 0

              return (
                <AllocationSlider
                  amount={amount}
                  budget={budget}
                  coordinatorMinimum={minimum}
                  icon={category.icon}
                  key={category.id}
                  label={category.label}
                  legacyPriority={legacyPriorities.has(category.id)}
                  locked={lockedCategories.has(category.id)}
                  maxAmount={Math.max(maximum, minimum)}
                  onChange={(nextAmount) => handleAllocationChange(category.id, nextAmount)}
                />
              )
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          {onSkip && coordinatorMinimum === 0 ? (
            <Pressable
              accessibilityRole="button"
              disabled={isProcessing}
              onPress={onSkip}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={styles.skipText}>SKIP FOR NOW</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={!canContinue}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              isWide && styles.continueButtonWide,
              !canContinue && styles.continueDisabled,
              pressed && canContinue && styles.pressed,
            ]}
          >
            {isProcessing ? <ActivityIndicator color={palette.white} size="small" /> : null}
            <Text style={styles.continueText}>
              {isProcessing ? 'SAVING…' : isWide ? 'CONTINUE' : 'NEXT STEP'}
            </Text>
            {!isProcessing ? (
              <MaterialIcons color={palette.white} name="arrow-forward" size={18} />
            ) : null}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const palette = {
  background: '#FFFFFF',
  error: '#B3261E',
  errorSurface: '#FFF1F0',
  outline: '#D8C4C8',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  secondaryFixedDim: '#9A9395',
  surface: '#F8F6F6',
  text: '#1A1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 190,
  },
  introCopy: { alignItems: 'center', marginBottom: 24 },
  title: {
    color: palette.primaryContainer,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 520,
    marginTop: 8,
    color: palette.secondary,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  budgetInputCard: {
    borderWidth: 1,
    borderColor: palette.outline,
    borderRadius: 16,
    backgroundColor: palette.white,
    padding: 20,
  },
  fieldLabel: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  totalBudgetRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  totalCurrency: {
    color: palette.primaryContainer,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
  },
  budgetInput: {
    flex: 1,
    color: palette.primaryContainer,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  removeBudgetButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: palette.surface,
  },
  optionalBudgetCard: {
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: palette.outline,
    borderRadius: 16,
    padding: 24,
  },
  optionalBudgetIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#F8EDEF',
  },
  optionalBudgetCopy: { alignItems: 'center', gap: 5 },
  optionalBudgetAmount: {
    color: palette.primaryContainer,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
  },
  optionalBudgetTitle: { color: palette.primaryContainer, fontSize: 18, fontWeight: '700' },
  optionalBudgetDescription: {
    maxWidth: 420,
    color: palette.secondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  enterBudgetButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
  },
  enterBudgetText: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  summaryCard: {
    flexDirection: 'row',
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  summaryItem: { flex: 1 },
  summaryDivider: { width: 1, marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.25)' },
  summaryLabel: { color: '#E7D8DC', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  summaryValue: { marginTop: 5, color: palette.white, fontSize: 20, fontWeight: '700' },
  remainingValue: { color: '#FFE4A8' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: palette.errorSurface,
    padding: 14,
  },
  errorText: { flex: 1, color: palette.error, fontSize: 13, lineHeight: 19 },
  allocationsSection: { marginTop: 32 },
  sectionHeading: { marginBottom: 16 },
  sectionTitle: { color: palette.text, fontSize: 23, lineHeight: 30, fontWeight: '700' },
  sectionSubtitle: { marginTop: 6, color: palette.secondary, fontSize: 13, lineHeight: 20 },
  allocationList: { gap: 12 },
  allocationCard: {
    borderWidth: 1,
    borderColor: '#E9DFE1',
    borderRadius: 14,
    backgroundColor: palette.white,
    padding: 16,
  },
  allocationHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryIdentity: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#F8EDEF',
  },
  categoryCopy: { minWidth: 0, flex: 1 },
  categoryLabel: { color: palette.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  reservedLabel: { marginTop: 2, color: palette.primaryContainer, fontSize: 10, lineHeight: 14 },
  legacyLabel: { marginTop: 2, color: palette.secondary, fontSize: 10, lineHeight: 14 },
  amountInputShell: {
    width: 128,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.outline,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  amountCurrency: { color: palette.primaryContainer, fontSize: 14, fontWeight: '700' },
  amountInput: {
    minWidth: 0,
    flex: 1,
    color: palette.primaryContainer,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    paddingVertical: 8,
  },
  sliderTouchArea: { justifyContent: 'center', height: 38, marginTop: 10 },
  sliderTrack: {
    height: 6,
    justifyContent: 'center',
    borderRadius: 3,
    backgroundColor: '#E8DDDF',
  },
  sliderFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: palette.primaryContainer },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderWidth: 3,
    borderColor: palette.white,
    borderRadius: 11,
    backgroundColor: palette.primaryContainer,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sliderRange: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { color: palette.secondary, fontSize: 10, lineHeight: 14 },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    borderTopWidth: 1,
    borderTopColor: '#ECE6E7',
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  footerContent: { width: '100%', maxWidth: 760, alignSelf: 'center', alignItems: 'flex-end' },
  skipButton: { alignSelf: 'center', marginBottom: 10, paddingHorizontal: 16, paddingVertical: 6 },
  skipText: { color: palette.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  continueButton: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 27,
    backgroundColor: palette.primary,
    paddingHorizontal: 30,
  },
  continueButtonWide: { width: 210 },
  continueDisabled: { opacity: 0.5 },
  continueText: { color: palette.white, fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
})
