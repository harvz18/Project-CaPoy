import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  LayoutAnimation,
  Modal,
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
import { formatPeso } from '../lib/catalog'

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name']
type TextInputInstance = React.ComponentRef<typeof TextInput>

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

export type CategoryBudgetMinimum = {
  amount: number
  isEstimate: boolean
  pricingBasis?: string
}

export interface BudgetAllocationValue {
  allocations: CategoryBudgetAllocation[]
  budget: number
  priorities: BudgetPriority[]
}

interface BudgetAllocationScreenProps {
  categoryMinimums?: Partial<Record<BudgetPriority, CategoryBudgetMinimum>>
  coordinatorCost?: number
  coordinatorRequired?: boolean
  excludeVenue?: boolean
  includeCoordinator?: boolean
  initialAllocations?: CategoryBudgetAllocation[]
  initialBudget?: number
  initialPriorities?: BudgetPriority[]
  isProcessing?: boolean
  isMarketplacePricingLoading?: boolean
  onBack?: () => void
  onBudgetChange?: (budget: number) => void
  onContinue?: (value: BudgetAllocationValue) => void
  onDraftChange?: (value: BudgetAllocationValue) => void
  onPrioritiesChange?: (priorities: BudgetPriority[]) => void
  onRemoveCommittedCoordinator?: () => void
  onSkip?: () => void
}

const categoryOptions: ReadonlyArray<{
  id: BudgetPriority
  icon: MaterialIconName
  label: string
}> = [
  { id: 'eventOrganizer', icon: 'event', label: 'Event Coordinator' },
  { id: 'venue', icon: 'location-on', label: 'Venue' },
  { id: 'catering', icon: 'restaurant', label: 'Catering' },
  { id: 'photoVideo', icon: 'camera-alt', label: 'Photography & Video' },
  { id: 'floral', icon: 'local-florist', label: 'Florist & Styling' },
  { id: 'soundLights', icon: 'volume-up', label: 'Sound & Lights' },
  { id: 'hostEmcee', icon: 'mic', label: 'Host / Emcee' },
  { id: 'gownRental', icon: 'checkroom', label: 'Attire & Gown Rental' },
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

const formatMoney = formatPeso

const formatDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const formatAmountInput = (value: number) =>
  sanitizeMoney(value).toLocaleString('en-PH', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })

const parseAmountInput = (value: string): number | undefined => {
  const normalized = value.replace(/[₱,\s]/g, '')
  if (!normalized || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? sanitizeMoney(parsed) : undefined
}

const normalizeAmountInput = (value: string) => {
  const filtered = value.replace(/[^\d.]/g, '')
  const [whole = '', ...decimals] = filtered.split('.')
  if (decimals.length === 0) return whole

  return `${whole}.${decimals.join('').slice(0, 2)}`
}

const BUDGET_ALLOCATION_STEP = 500

const buildAllocations = (
  initialAllocations: CategoryBudgetAllocation[],
  coordinatorCost: number,
  includeCoordinator: boolean
) => {
  const result = emptyAllocations()

  initialAllocations.forEach((allocation) => {
    if (allocation.categoryKey in result) {
      result[allocation.categoryKey] = sanitizeMoney(allocation.amount)
    }
  })
  result.eventOrganizer = includeCoordinator
    ? Math.max(result.eventOrganizer, sanitizeMoney(coordinatorCost))
    : 0

  return result
}

const reserveCoordinatorAllocation = (current: AllocationMap, coordinatorCost: number) => {
  const minimum = sanitizeMoney(coordinatorCost)
  if (current.eventOrganizer >= minimum) return current

  // A new coordinator commitment must remain visible until the client raises
  // the event budget or resolves it through the existing booking flow.
  return { ...current, eventOrganizer: minimum }
}

interface AllocationSliderProps {
  amount: number
  budget: number
  coordinatorMinimum: number
  label: string
  locked: boolean
  availableAmount: number
  maxAmount: number
  minimumAmount: number
  onChange: (amount: number) => void
  onValidationMessageChange: (message: string) => void
  validationMessage?: string
}

const AllocationSlider: React.FC<AllocationSliderProps> = ({
  amount,
  budget,
  coordinatorMinimum,
  label,
  locked,
  availableAmount,
  maxAmount,
  minimumAmount,
  onChange,
  onValidationMessageChange,
  validationMessage,
}) => {
  const [trackWidth, setTrackWidth] = React.useState(1)
  const [amountText, setAmountText] = React.useState(() => formatAmountInput(amount))
  const [isAmountFocused, setIsAmountFocused] = React.useState(false)
  const previousAmountRef = React.useRef(amount)
  const amountInputRef = React.useRef<TextInputInstance>(null)
  const step = BUDGET_ALLOCATION_STEP
  const minimum = sanitizeMoney(minimumAmount)
  const maximum = sanitizeMoney(maxAmount)
  const percent = budget > 0 ? Math.min(amount / budget, 1) : 0

  React.useEffect(() => {
    if (!isAmountFocused && previousAmountRef.current !== amount) {
      setAmountText(formatAmountInput(amount))
    }
    previousAmountRef.current = amount
  }, [amount, isAmountFocused])

  const updateFromPosition = React.useCallback(
    (position: number) => {
      if (budget <= 0 || trackWidth <= 1 || locked) return
      const ratio = Math.max(0, Math.min(position / trackWidth, 1))
      const requested = Math.round((ratio * budget) / step) * step
      onChange(Math.max(minimum, Math.min(requested, maximum)))
    },
    [budget, locked, maximum, minimum, onChange, step, trackWidth]
  )

  // Keep one responder instance for the entire drag. Recreating it after each
  // allocation update can interrupt the gesture after its first movement.
  const canAdjustRef = React.useRef(false)
  const dragStartPositionRef = React.useRef(0)
  const updateFromPositionRef = React.useRef(updateFromPosition)
  canAdjustRef.current = budget > 0 && !locked
  updateFromPositionRef.current = updateFromPosition

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          canAdjustRef.current
          && Math.abs(gestureState.dx) >= 2
          && Math.abs(gestureState.dx) >= Math.abs(gestureState.dy),
        onPanResponderGrant: (event) => {
          dragStartPositionRef.current = event.nativeEvent.locationX
          updateFromPositionRef.current(dragStartPositionRef.current)
        },
        onPanResponderMove: (_, gestureState) => {
          updateFromPositionRef.current(dragStartPositionRef.current + gestureState.dx)
        },
        onPanResponderRelease: (_, gestureState) => {
          updateFromPositionRef.current(dragStartPositionRef.current + gestureState.dx)
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onStartShouldSetPanResponder: () => canAdjustRef.current,
      }),
    []
  )

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(Math.max(event.nativeEvent.layout.width, 1))
  }

  const adjust = (direction: -1 | 1) => {
    onValidationMessageChange('')
    onChange(Math.max(minimum, Math.min(amount + direction * step, maximum)))
  }

  const commitAmount = React.useCallback(() => {
    const requested = parseAmountInput(amountText)

    if (requested === undefined) {
      onValidationMessageChange('Enter a valid budget amount.')
      return false
    }

    if (requested < minimum) {
      onValidationMessageChange(
        minimum > 0
          ? `This category needs at least ${formatMoney(minimum)}.`
          : 'Budget amounts cannot be negative.'
      )
      return false
    }

    if (requested > maximum) {
      onValidationMessageChange(`Only ${formatMoney(maximum)} is available for this category.`)
      return false
    }

    onValidationMessageChange('')
    onChange(requested)
    setAmountText(formatAmountInput(requested))
    return true
  }, [amountText, maximum, minimum, onChange, onValidationMessageChange])

  return (
    <View style={styles.allocationEditor}>
      <View style={styles.allocationHeading}>
        <View style={styles.allocationCopy}>
          <Text style={styles.allocationLabel}>Budget Allocation</Text>
          {locked ? (
            <Text style={styles.reservedLabel}>Locked to selected service amount</Text>
          ) : coordinatorMinimum > 0 ? (
            <Text style={styles.reservedLabel}>
              {formatMoney(coordinatorMinimum)} committed coordinator cost
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.amountInputShell,
            isAmountFocused && styles.amountInputShellFocused,
            validationMessage && styles.amountInputShellError,
          ]}
        >
          <Text style={styles.amountCurrency}>₱</Text>
          <TextInput
            accessibilityLabel={`${label} budget allocation`}
            accessibilityHint="Enter an exact peso amount, or use the slider in 500-peso steps."
            editable={budget > 0 && !locked}
            inputMode="decimal"
            keyboardType="decimal-pad"
            onBlur={() => {
              setIsAmountFocused(false)
              commitAmount()
            }}
            onChangeText={(value) => {
              setAmountText(normalizeAmountInput(value))
              if (validationMessage) onValidationMessageChange('')
            }}
            onFocus={() => {
              setIsAmountFocused(true)
              setAmountText(String(sanitizeMoney(amount)))
            }}
            onSubmitEditing={() => {
              if (commitAmount()) amountInputRef.current?.blur()
            }}
            ref={amountInputRef}
            selectTextOnFocus
            style={styles.amountInput}
            value={amountText}
          />
        </View>
      </View>

      {validationMessage ? <Text style={styles.amountInputError}>{validationMessage}</Text> : null}

      <View
        accessible
        accessibilityActions={[
          { name: 'increment', label: `Increase ${label} allocation` },
          { name: 'decrement', label: `Decrease ${label} allocation` },
        ]}
        accessibilityLabel={`${label}: ${formatMoney(amount)} of ${formatMoney(budget)}`}
        accessibilityRole="adjustable"
        accessibilityState={{ disabled: budget <= 0 || locked }}
        accessibilityValue={{ max: budget, min: minimum, now: amount }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') adjust(1)
          if (event.nativeEvent.actionName === 'decrement') adjust(-1)
        }}
        onLayout={(event) => setTrackWidth(Math.max(event.nativeEvent.layout.width, 1))}
        style={styles.sliderTouchArea}
        {...panResponder.panHandlers}
      >
        <View onLayout={handleTrackLayout} style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${percent * 100}%` }]} />
          <View style={[styles.sliderThumb, { left: `${percent * 100}%` }]} />
        </View>
      </View>

      <View style={styles.sliderRange}>
        <Text style={styles.rangeText}>₱0</Text>
        <Text style={styles.rangeText}>Available: {formatMoney(availableAmount)}</Text>
      </View>
    </View>
  )
}

export const BudgetAllocationScreen: React.FC<BudgetAllocationScreenProps> = ({
  categoryMinimums = {},
  coordinatorCost = 0,
  coordinatorRequired = false,
  excludeVenue = false,
  includeCoordinator = true,
  initialAllocations = [],
  initialBudget,
  initialPriorities = [],
  isProcessing = false,
  isMarketplacePricingLoading = false,
  onBack,
  onBudgetChange,
  onContinue,
  onDraftChange,
  onPrioritiesChange,
  onRemoveCommittedCoordinator,
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
    buildAllocations(initialAllocations, coordinatorCost, includeCoordinator)
  )
  const visibleCategoryOptions = React.useMemo(
    () => includeCoordinator
      ? categoryOptions
      : categoryOptions.filter((category) => category.id !== 'eventOrganizer'),
    [includeCoordinator]
  )
  const selectableCategoryOptions = React.useMemo(
    () => excludeVenue
      ? visibleCategoryOptions.filter((category) => category.id !== 'venue')
      : visibleCategoryOptions,
    [excludeVenue, visibleCategoryOptions]
  )
  const [allocationValidationMessages, setAllocationValidationMessages] = React.useState<
    Partial<Record<BudgetPriority, string>>
  >({})
  const [isBudgetInputFocused, setIsBudgetInputFocused] = React.useState(false)
  const [expandedCategories, setExpandedCategories] = React.useState<Set<BudgetPriority>>(
    () =>
      new Set(
        selectableCategoryOptions
          .filter((category) => {
            const initialAllocation = initialAllocations.find(
              (allocation) => allocation.categoryKey === category.id
            )
            return (
              Boolean(initialAllocation?.locked)
              || sanitizeMoney(initialAllocation?.amount ?? 0) > 0
              || (category.id === 'eventOrganizer' && sanitizeMoney(coordinatorCost) > 0)
            )
          })
          .map((category) => category.id)
      )
  )
  const [categoryNotice, setCategoryNotice] = React.useState('')
  const [pendingRemoval, setPendingRemoval] = React.useState<{
    categoryKey: BudgetPriority
    label: string
  }>()
  const [removedCategories, setRemovedCategories] = React.useState<
    Partial<Record<BudgetPriority, { previousAmount: number }>>
  >({})
  const budget = hasBudgetInput && budgetDigits ? sanitizeMoney(Number(budgetDigits)) : 0
  const totalAllocated = Object.values(allocations).reduce((sum, amount) => sum + amount, 0)
  const remainingBudget = Math.max(budget - totalAllocated, 0)
  const coordinatorMinimum = includeCoordinator ? sanitizeMoney(coordinatorCost) : 0
  const budgetTooLow = coordinatorMinimum > budget
  const allocationExceeded = totalAllocated > budget
  const hasAllocationValidationErrors = Object.values(allocationValidationMessages).some(Boolean)
  const legacyPriorities = React.useMemo(() => new Set(initialPriorities), [initialPriorities])
  const lockedCategories = React.useMemo(
    () => new Set(initialAllocations.filter((item) => item.locked).map((item) => item.categoryKey)),
    [initialAllocations]
  )
  const minimumForCategory = React.useCallback(
    (categoryKey: BudgetPriority) => {
      if (categoryKey === 'eventOrganizer') return coordinatorMinimum
      return sanitizeMoney(categoryMinimums[categoryKey]?.amount ?? 0)
    },
    [categoryMinimums, coordinatorMinimum]
  )

  React.useEffect(() => {
    setAllocations((current) => reserveCoordinatorAllocation(current, coordinatorMinimum))
  }, [coordinatorMinimum])

  React.useEffect(() => {
    if (!includeCoordinator || coordinatorMinimum <= 0) return
    setExpandedCategories((current) => (
      current.has('eventOrganizer') ? current : new Set(current).add('eventOrganizer')
    ))
  }, [coordinatorMinimum, includeCoordinator])

  React.useEffect(() => {
    if (!excludeVenue) return
    setAllocations((current) => current.venue > 0 ? { ...current, venue: 0 } : current)
    setExpandedCategories((current) => {
      if (!current.has('venue')) return current
      const next = new Set(current)
      next.delete('venue')
      return next
    })
  }, [excludeVenue])

  React.useEffect(() => {
    const priorities = selectableCategoryOptions
      .filter((category) => allocations[category.id] > 0)
      .sort((left, right) => allocations[right.id] - allocations[left.id])
      .slice(0, 3)
      .map((category) => category.id)
    onPrioritiesChange?.(priorities)
  }, [allocations, onPrioritiesChange, selectableCategoryOptions])

  const handleBudgetChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    setBudgetDigits(digits)
    onBudgetChange?.(digits ? Number(digits) : 0)
  }

  const handleAllocationChange = React.useCallback(
    (categoryKey: BudgetPriority, requestedAmount: number) => {
      setAllocations((current) => {
        if (lockedCategories.has(categoryKey)) return current

        const otherTotal = Object.entries(current).reduce(
          (sum, [key, amount]) => sum + (key === categoryKey ? 0 : amount),
          0
        )
        const minimum = minimumForCategory(categoryKey)
        const allowed = Math.max(budget - otherTotal, 0)

        return {
          ...current,
          [categoryKey]: Math.max(minimum, Math.min(sanitizeMoney(requestedAmount), allowed)),
        }
      })
    },
    [budget, lockedCategories, minimumForCategory]
  )

  const handleAllocationValidationMessage = React.useCallback(
    (categoryKey: BudgetPriority, message: string) => {
      setAllocationValidationMessages((current) => {
        if (current[categoryKey] === message) return current

        const next = { ...current }
        if (message) next[categoryKey] = message
        else delete next[categoryKey]
        return next
      })
    },
    []
  )

  const animateCategoryLayout = React.useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
  }, [])

  const handleCategoryPress = React.useCallback(
    (categoryKey: BudgetPriority) => {
      const currentAmount = allocations[categoryKey]
      const isSelected = currentAmount > 0 || lockedCategories.has(categoryKey)

      if (isSelected) {
        setCategoryNotice('')
        animateCategoryLayout()
        setExpandedCategories((current) => {
          const next = new Set(current)
          if (next.has(categoryKey)) next.delete(categoryKey)
          else next.add(categoryKey)
          return next
        })
        return
      }

      if (budget <= 0) {
        setCategoryNotice('Enter an event budget before selecting a service category.')
        return
      }

      if (isMarketplacePricingLoading && categoryKey !== 'eventOrganizer') {
        setCategoryNotice('Marketplace prices are still loading. Please try this category again in a moment.')
        return
      }

      const available = Math.max(budget - totalAllocated, 0)
      const minimum = minimumForCategory(categoryKey)

      if (minimum <= 0) {
        setCategoryNotice(
          `No eligible ${categoryOptions.find((item) => item.id === categoryKey)?.label ?? 'service'} price can be calculated for this event. Adjust the event details or choose another category.`
        )
        return
      }

      if (minimum > available) {
        setCategoryNotice(
          `At least ${formatMoney(minimum)} remains available to add this category.`
        )
        return
      }

      const startingAmount = minimum
      handleAllocationChange(categoryKey, startingAmount)
      setCategoryNotice(
        categoryMinimums[categoryKey]?.isEstimate
          ? 'This allocation uses a marketplace estimate until the provider confirms availability.'
          : ''
      )
      setRemovedCategories((current) => {
        if (!current[categoryKey]) return current
        const next = { ...current }
        delete next[categoryKey]
        return next
      })
      animateCategoryLayout()
      setExpandedCategories((current) => new Set(current).add(categoryKey))
    },
    [
      allocations,
      animateCategoryLayout,
      budget,
      categoryMinimums,
      handleAllocationChange,
      isMarketplacePricingLoading,
      lockedCategories,
      minimumForCategory,
      totalAllocated,
    ]
  )

  const requestCategoryRemoval = React.useCallback(
    (categoryKey: BudgetPriority, label: string) => {
      if (lockedCategories.has(categoryKey)) {
        setCategoryNotice(`${label} cannot be removed while it has a selected service.`)
        return
      }
      if (categoryKey === 'eventOrganizer' && coordinatorMinimum > 0) {
        if (onRemoveCommittedCoordinator) {
          onRemoveCommittedCoordinator()
          return
        }
        setCategoryNotice('Event Coordinator cannot be removed while a coordinator cost is committed.')
        return
      }

      setPendingRemoval({ categoryKey, label })
    },
    [coordinatorMinimum, lockedCategories, onRemoveCommittedCoordinator]
  )

  const confirmCategoryRemoval = React.useCallback(() => {
    if (!pendingRemoval) return

    const { categoryKey, label } = pendingRemoval
    const previousAmount = allocations[categoryKey]
    animateCategoryLayout()
    setCategoryNotice(`${label} was removed. You can undo it while this budget plan is open.`)
    setRemovedCategories((current) => ({ ...current, [categoryKey]: { previousAmount } }))
    setAllocations((current) => ({ ...current, [categoryKey]: 0 }))
    setAllocationValidationMessages((current) => {
      if (!current[categoryKey]) return current
      const next = { ...current }
      delete next[categoryKey]
      return next
    })
    setExpandedCategories((current) => {
      const next = new Set(current)
      next.delete(categoryKey)
      return next
    })
    setPendingRemoval(undefined)
  }, [allocations, animateCategoryLayout, pendingRemoval])

  const handleUndoCategoryRemoval = React.useCallback(
    (categoryKey: BudgetPriority, label: string) => {
      const removed = removedCategories[categoryKey]
      if (!removed) return

      const available = Math.max(budget - totalAllocated, 0)
      if (removed.previousAmount > available) {
        setCategoryNotice(
          `Undo is unavailable because restoring ${formatMoney(removed.previousAmount)} for ${label} would exceed the remaining budget.`
        )
        return
      }

      animateCategoryLayout()
      setAllocations((current) => ({ ...current, [categoryKey]: removed.previousAmount }))
      setAllocationValidationMessages((current) => {
        if (!current[categoryKey]) return current
        const next = { ...current }
        delete next[categoryKey]
        return next
      })
      setExpandedCategories((current) => {
        const next = new Set(current)
        next.add(categoryKey)
        return next
      })
      setRemovedCategories((current) => {
        const next = { ...current }
        delete next[categoryKey]
        return next
      })
      setCategoryNotice(`${label} was restored with its previous allocation.`)
    },
    [animateCategoryLayout, budget, removedCategories, totalAllocated]
  )

  const draftValue = React.useMemo<BudgetAllocationValue>(() => {
    const draftAllocations = selectableCategoryOptions
      .map((category) => ({
        amount: sanitizeMoney(allocations[category.id]),
        categoryKey: category.id,
        label: category.label,
        locked: lockedCategories.has(category.id),
      }))
      .filter((allocation) => allocation.amount > 0)
    const priorities = [...draftAllocations]
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 3)
      .map((allocation) => allocation.categoryKey)

    return { allocations: draftAllocations, budget, priorities }
  }, [allocations, budget, lockedCategories, selectableCategoryOptions])

  React.useEffect(() => {
    onDraftChange?.(draftValue)
  }, [draftValue, onDraftChange])

  const handleContinue = () => {
    if (hasAllocationValidationErrors) {
      setCategoryNotice('Correct the highlighted category budget before continuing.')
      return
    }

    onContinue?.(draftValue)
  }

  const removeBudget = () => {
    if (coordinatorRequired || coordinatorMinimum > 0) {
      setCategoryNotice('The event budget cannot be removed while a coordinator cost is committed.')
      return
    }
    if (lockedCategories.size > 0) {
      setCategoryNotice('The event budget cannot be removed while a selected service locks a category.')
      return
    }

    setBudgetDigits('')
    setHasBudgetInput(false)
    setAllocations(emptyAllocations())
    setAllocationValidationMessages({})
    setExpandedCategories(new Set())
    onBudgetChange?.(0)
  }

  const coordinatorPriceUnavailable = coordinatorRequired && coordinatorMinimum <= 0
  const canContinue = !isProcessing
    && !budgetTooLow
    && !allocationExceeded
    && !hasAllocationValidationErrors
    && !coordinatorPriceUnavailable

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
            {excludeVenue ? 'Your secured external venue is excluded. Divide the full budget among your remaining services.' : 'Set the total, then divide it among the services that matter to your event.'}
          </Text>
        </View>

        {hasBudgetInput ? (
          <View style={[styles.budgetInputCard, isBudgetInputFocused && styles.budgetInputCardFocused]}>
            <Text style={styles.fieldLabel}>TOTAL EVENT BUDGET</Text>
            <View style={styles.totalBudgetRow}>
              <Text style={styles.totalCurrency}>₱</Text>
              <TextInput
                accessibilityLabel="Total event budget in Philippine pesos"
                inputMode="numeric"
                keyboardType="number-pad"
                onBlur={() => setIsBudgetInputFocused(false)}
                onChangeText={handleBudgetChange}
                onFocus={() => setIsBudgetInputFocused(true)}
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

        {coordinatorPriceUnavailable ? (
          <View style={styles.errorBanner}>
            <MaterialIcons color={palette.error} name="event-busy" size={20} />
            <Text style={styles.errorText}>
              {isMarketplacePricingLoading
                ? 'Coordinator prices are loading. Please wait before continuing.'
                : 'No bookable coordinator price is available for this event yet. Return to Step 1 to continue without a coordinator, or try again after refreshing.'}
            </Text>
          </View>
        ) : null}

        {allocationExceeded ? (
          <View style={styles.errorBanner}>
            <MaterialIcons color={palette.error} name="error-outline" size={20} />
            <Text style={styles.errorText}>
              Allocated category budgets are above the event budget. Raise the total budget or
              reduce an unlocked category before continuing.
            </Text>
          </View>
        ) : null}

        <View style={styles.allocationsSection}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Category Budgets</Text>
            <Text style={styles.sectionSubtitle}>
              Select only the categories you need. Each selected card opens its allocation controls,
              and the combined total cannot exceed your event budget.
            </Text>
          </View>

          {categoryNotice ? (
            <View accessibilityLiveRegion="polite" style={styles.categoryNotice}>
              <MaterialIcons color={palette.primaryContainer} name="info-outline" size={18} />
              <Text style={styles.categoryNoticeText}>{categoryNotice}</Text>
            </View>
          ) : null}

          <View style={styles.allocationList}>
            {selectableCategoryOptions.map((category) => {
              const amount = allocations[category.id]
              const otherTotal = totalAllocated - amount
              const maximum = Math.max(budget - otherTotal, 0)
              const minimum = minimumForCategory(category.id)
              const locked = lockedCategories.has(category.id)
              const selected = amount > 0 || locked
              const wasRemoved = Boolean(removedCategories[category.id])
              const expanded = expandedCategories.has(category.id)
              const canRemove = !locked && !(
                category.id === 'eventOrganizer' && (minimum > 0 || coordinatorRequired)
              )
              const canRequestCoordinatorRemoval =
                category.id === 'eventOrganizer'
                && minimum > 0
                && Boolean(onRemoveCommittedCoordinator)
              const canRemoveCategory = canRemove || canRequestCoordinatorRemoval
              const sliderMinimum = minimum

              return (
                <View
                  key={category.id}
                  style={[styles.categoryCard, selected && styles.categoryCardSelected]}
                >
                  <Pressable
                    accessibilityLabel={
                      selected
                        ? `${expanded ? 'Collapse' : 'Expand'} ${category.label} budget allocation`
                        : wasRemoved
                          ? `Undo removal of ${category.label} category`
                        : `Select ${category.label} category`
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded, selected }}
                    onPress={() => {
                      if (wasRemoved) handleUndoCategoryRemoval(category.id, category.label)
                      else handleCategoryPress(category.id)
                    }}
                    style={({ pressed }) => [styles.categoryHeader, pressed && styles.categoryHeaderPressed]}
                  >
                    <View style={styles.categoryIdentity}>
                      <View style={[styles.categoryIcon, selected && styles.categoryIconSelected]}>
                        <MaterialIcons
                          color={palette.primaryContainer}
                          name={category.icon}
                          size={20}
                        />
                      </View>
                      <View style={styles.categoryCopy}>
                        <Text style={styles.categoryLabel}>{category.label}</Text>
                        <Text style={styles.categoryStatus}>
                          {selected
                            ? locked
                              ? 'Selected · locked to service'
                              : `Selected · ${formatMoney(amount)}`
                            : wasRemoved
                              ? 'Removed from this budget plan'
                              : legacyPriorities.has(category.id)
                              ? 'Previously marked as a priority'
                              : 'Not selected'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.categoryAction, selected && styles.categoryActionSelected]}>
                      <Text style={[styles.categoryActionText, selected && styles.categoryActionTextSelected]}>
                        {selected ? (expanded ? 'HIDE' : 'SHOW') : wasRemoved ? 'UNDO' : 'SELECT'}
                      </Text>
                      <MaterialIcons
                        color={selected ? palette.white : palette.primaryContainer}
                        name={selected && expanded ? 'expand-less' : selected ? 'expand-more' : wasRemoved ? 'undo' : 'add'}
                        size={18}
                      />
                    </View>
                  </Pressable>

                  {selected && expanded ? (
                    <View style={styles.categoryAllocationPanel}>
                      <AllocationSlider
                        amount={amount}
                        budget={budget}
                        coordinatorMinimum={minimum}
                        label={category.label}
                        locked={locked}
                        availableAmount={remainingBudget}
                        maxAmount={maximum}
                        minimumAmount={sliderMinimum}
                        onChange={(nextAmount) => handleAllocationChange(category.id, nextAmount)}
                        onValidationMessageChange={(message) =>
                          handleAllocationValidationMessage(category.id, message)
                        }
                        validationMessage={allocationValidationMessages[category.id]}
                      />
                      {category.id !== 'eventOrganizer' && minimum > 0 ? (
                        <Text style={styles.marketplacePriceNote}>
                          {categoryMinimums[category.id]?.isEstimate
                            ? `Marketplace estimate: ${formatMoney(minimum)}`
                            : `Lowest available marketplace price: ${formatMoney(minimum)}`}
                          {categoryMinimums[category.id]?.pricingBasis
                            ? ` · ${categoryMinimums[category.id]?.pricingBasis}`
                            : ''}
                        </Text>
                      ) : null}
                      <Pressable
                        accessibilityLabel={
                          canRequestCoordinatorRemoval
                            ? 'Remove committed coordinator before removing Event Coordinator category'
                            : `Remove ${category.label} category`
                        }
                        accessibilityRole="button"
                        disabled={!canRemoveCategory}
                        onPress={() => requestCategoryRemoval(category.id, category.label)}
                        style={({ pressed }) => [
                          styles.removeCategoryButton,
                          !canRemoveCategory && styles.removeCategoryDisabled,
                          pressed && canRemoveCategory && styles.pressed,
                        ]}
                      >
                        <MaterialIcons
                          color={canRemoveCategory ? palette.error : palette.secondaryFixedDim}
                          name={canRemoveCategory ? 'remove-circle-outline' : 'lock-outline'}
                          size={17}
                        />
                        <Text style={[styles.removeCategoryText, !canRemoveCategory && styles.removeCategoryTextDisabled]}>
                          {canRemove
                            ? 'REMOVE CATEGORY'
                            : canRequestCoordinatorRemoval
                              ? 'REMOVE COORDINATOR FIRST'
                            : locked
                              ? 'LOCKED TO SELECTED SERVICE'
                              : 'COMMITTED TO COORDINATOR'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setPendingRemoval(undefined)}
        transparent
        visible={Boolean(pendingRemoval)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel category removal"
          onPress={() => setPendingRemoval(undefined)}
          style={styles.removalBackdrop}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={styles.removalDialog}
          >
            <MaterialIcons color={palette.error} name="remove-circle-outline" size={28} />
            <Text style={styles.removalTitle}>Remove This Category?</Text>
            <Text style={styles.removalBody}>
              {pendingRemoval
                ? `${pendingRemoval.label} will be removed from this budget plan. You can undo the removal while you stay on this screen.`
                : ''}
            </Text>
            <View style={styles.removalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPendingRemoval(undefined)}
                style={({ pressed }) => [styles.removalCancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.removalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirmCategoryRemoval}
                style={({ pressed }) => [styles.removalConfirmButton, pressed && styles.pressed]}
              >
                <Text style={styles.removalConfirmText}>REMOVE CATEGORY</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          {onSkip && coordinatorMinimum === 0 && !coordinatorRequired ? (
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
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    // Reserve the focus-border space so focusing the field cannot expand this
    // card beyond the scroll content on narrow web and mobile layouts.
    borderWidth: 2,
    borderColor: palette.outline,
    borderRadius: 16,
    backgroundColor: palette.white,
    padding: 20,
  },
  budgetInputCardFocused: { borderColor: palette.primaryContainer },
  fieldLabel: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  totalBudgetRow: { minWidth: 0, minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  totalCurrency: {
    color: palette.primaryContainer,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
  },
  budgetInput: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: palette.primaryContainer,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 8,
    outlineWidth: 0,
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
  categoryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#F8EDEF',
    padding: 12,
  },
  categoryNoticeText: { flex: 1, color: palette.primaryContainer, fontSize: 12, lineHeight: 18 },
  allocationList: { gap: 12 },
  categoryCard: {
    borderWidth: 1,
    borderColor: '#E9DFE1',
    borderRadius: 14,
    backgroundColor: palette.white,
    overflow: 'hidden',
  },
  categoryCardSelected: { borderColor: '#B48A94', backgroundColor: '#FFF9FA' },
  categoryHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoryHeaderPressed: { backgroundColor: '#FCF4F5' },
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
  categoryIconSelected: { backgroundColor: '#F0DDE1' },
  categoryCopy: { minWidth: 0, flex: 1 },
  categoryLabel: { color: palette.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  categoryStatus: { marginTop: 2, color: palette.secondary, fontSize: 11, lineHeight: 15 },
  categoryAction: {
    minWidth: 82,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#C9AFB5',
    borderRadius: 18,
    paddingHorizontal: 10,
  },
  categoryActionSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryContainer },
  categoryActionText: { color: palette.primaryContainer, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  categoryActionTextSelected: { color: palette.white },
  categoryAllocationPanel: {
    borderTopWidth: 1,
    borderTopColor: '#EFE4E6',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  allocationEditor: { paddingTop: 16 },
  allocationCopy: { minWidth: 0, flex: 1 },
  allocationLabel: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  reservedLabel: { marginTop: 2, color: palette.primaryContainer, fontSize: 10, lineHeight: 14 },
  legacyLabel: { marginTop: 2, color: palette.secondary, fontSize: 10, lineHeight: 14 },
  marketplacePriceNote: { marginTop: 9, color: palette.secondary, fontSize: 10, lineHeight: 14 },
  amountInputShell: {
    width: 140,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.outline,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  amountInputShellFocused: { borderWidth: 2, borderColor: palette.primaryContainer },
  amountInputShellError: { borderWidth: 2, borderColor: palette.error },
  amountCurrency: { color: palette.primaryContainer, fontSize: 14, fontWeight: '700' },
  amountInput: {
    minWidth: 0,
    flex: 1,
    color: palette.primaryContainer,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    paddingVertical: 8,
    outlineWidth: 0,
  },
  amountInputError: { marginTop: 6, color: palette.error, fontSize: 11, lineHeight: 16 },
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
  removeCategoryButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  removeCategoryDisabled: { opacity: 0.68 },
  removeCategoryText: { color: palette.error, fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  removeCategoryTextDisabled: { color: palette.secondaryFixedDim },
  removalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 8, 13, 0.5)',
    padding: 24,
  },
  removalDialog: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: palette.white,
    padding: 24,
  },
  removalTitle: { marginTop: 12, color: palette.primaryContainer, fontSize: 21, fontWeight: '700' },
  removalBody: {
    marginTop: 9,
    color: palette.secondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  removalActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 22 },
  removalCancelButton: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.outline,
    borderRadius: 23,
  },
  removalCancelText: { color: palette.primaryContainer, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  removalConfirmButton: {
    minHeight: 46,
    flex: 1.35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: palette.error,
    paddingHorizontal: 8,
  },
  removalConfirmText: { color: palette.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.35 },
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
