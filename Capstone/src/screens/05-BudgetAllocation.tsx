import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import React from 'react'
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
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
import { BlurTargetView, BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

import { Text } from '../components/AppText'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'
import { formatPeso } from '../lib/catalog'

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name']
type TextInputInstance = React.ComponentRef<typeof TextInput>
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

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

const createCategoryAnimationValues = () => {
  const values = {} as Record<BudgetPriority, Animated.Value>
  categoryOptions.forEach((category) => {
    values[category.id] = new Animated.Value(0)
  })
  return values
}

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
  compact?: boolean
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
  compact = false,
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
        // Let the surrounding ScrollView own taps and vertical drags. The
        // slider claims the gesture only after horizontal intent is clear.
        onStartShouldSetPanResponder: () => false,
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
    <View style={[styles.allocationEditor, compact && styles.allocationEditorCompact]}>
      <View style={styles.allocationHeading}>
        <View style={styles.allocationCopy}>
          <Text style={styles.allocationLabel}>Budget Allocation</Text>
          {!compact && locked ? (
            <Text style={styles.reservedLabel}>Locked to selected service amount</Text>
          ) : !compact && coordinatorMinimum > 0 ? (
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

      {!compact ? (
      <View style={styles.sliderRange}>
        <Text style={styles.rangeText}>₱0</Text>
        <Text style={styles.rangeText}>Available: {formatMoney(availableAmount)}</Text>
      </View>
      ) : null}
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
  const [isCategoryBudgetOverlayOpen, setIsCategoryBudgetOverlayOpen] = React.useState(false)
  const [isCategoryBudgetOverlayClosing, setIsCategoryBudgetOverlayClosing] = React.useState(false)
  const categoryBudgetBlurTargetRef = React.useRef<React.ComponentRef<typeof View>>(null)
  const categoryBudgetPopupScale = React.useRef(new Animated.Value(0.82)).current
  const [departingCategory, setDepartingCategory] = React.useState<{
    categoryKey: BudgetPriority
    wasRemoved: boolean
  }>()
  const categoryDeparture = React.useRef(new Animated.Value(0)).current
  const [fadingCategoryKey, setFadingCategoryKey] = React.useState<BudgetPriority>()
  const categoryRemovalFade = React.useRef(new Animated.Value(1)).current
  const [categoryReflowAnimations] = React.useState(createCategoryAnimationValues)
  const categoryActionsReflow = React.useRef(new Animated.Value(0)).current
  const categoryOverlayCardHeights = React.useRef<Partial<Record<BudgetPriority, number>>>({})
  const [isCategoryReflowing, setIsCategoryReflowing] = React.useState(false)
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
  const [isRemovalDialogClosing, setIsRemovalDialogClosing] = React.useState(false)
  const removalDialogScale = React.useRef(new Animated.Value(0.82)).current
  const [removedCategories, setRemovedCategories] = React.useState<
    Partial<Record<BudgetPriority, { previousAmount: number }>>
  >({})
  const budget = budgetDigits ? sanitizeMoney(Number(budgetDigits)) : 0
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
    if (!isCategoryBudgetOverlayOpen) return undefined

    setIsCategoryBudgetOverlayClosing(false)
    categoryBudgetPopupScale.setValue(0.82)
    const animation = Animated.sequence([
      Animated.timing(categoryBudgetPopupScale, {
        toValue: 1.045,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(categoryBudgetPopupScale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
    ])

    animation.start()
    return () => animation.stop()
  }, [categoryBudgetPopupScale, isCategoryBudgetOverlayOpen])

  const dismissCategoryBudgetOverlay = React.useCallback(() => {
    if (isCategoryBudgetOverlayClosing) return

    setIsCategoryBudgetOverlayClosing(true)
    categoryBudgetPopupScale.stopAnimation()
    Animated.sequence([
      Animated.timing(categoryBudgetPopupScale, {
        toValue: 1.035,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(categoryBudgetPopupScale, {
        toValue: 0.82,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return
      setIsCategoryBudgetOverlayOpen(false)
      setIsCategoryBudgetOverlayClosing(false)
    })
  }, [categoryBudgetPopupScale, isCategoryBudgetOverlayClosing])

  React.useEffect(() => {
    if (!isCategoryBudgetOverlayOpen) return undefined

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissCategoryBudgetOverlay()
      return true
    })
    return () => subscription.remove()
  }, [dismissCategoryBudgetOverlay, isCategoryBudgetOverlayOpen])

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
    if (!pendingRemoval) return undefined

    setIsRemovalDialogClosing(false)
    removalDialogScale.setValue(0.82)
    const animation = Animated.sequence([
      Animated.timing(removalDialogScale, {
        toValue: 1.045,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(removalDialogScale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
    ])

    animation.start()
    return () => animation.stop()
  }, [pendingRemoval, removalDialogScale])

  const dismissRemovalDialog = React.useCallback(
    (afterClose?: () => void) => {
      if (!pendingRemoval || isRemovalDialogClosing) return

      setIsRemovalDialogClosing(true)
      removalDialogScale.stopAnimation()
      Animated.sequence([
        Animated.timing(removalDialogScale, {
          toValue: 1.045,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(removalDialogScale, {
          toValue: 0.82,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return
        setPendingRemoval(undefined)
        setIsRemovalDialogClosing(false)
        afterClose?.()
      })
    },
    [isRemovalDialogClosing, pendingRemoval, removalDialogScale]
  )

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

  const animateCategoryDeparture = React.useCallback(
    (categoryKey: BudgetPriority, wasRemoved = false) => {
      setDepartingCategory({ categoryKey, wasRemoved })
      categoryDeparture.stopAnimation()
      categoryDeparture.setValue(0)
      requestAnimationFrame(() => {
        Animated.timing(categoryDeparture, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return
          animateCategoryLayout()
          setDepartingCategory(undefined)
          categoryDeparture.setValue(0)
        })
      })
    },
    [animateCategoryLayout, categoryDeparture]
  )

  const handleCategoryPress = React.useCallback(
    (categoryKey: BudgetPriority) => {
      const currentAmount = allocations[categoryKey]
      const isSelected = currentAmount > 0 || lockedCategories.has(categoryKey)

      if (isSelected) {
        setIsCategoryBudgetOverlayOpen(true)
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
      animateCategoryDeparture(categoryKey)
    },
    [
      allocations,
      animateCategoryDeparture,
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

    const finishRemoval = () => {
      const selectedBeforeRemoval = selectableCategoryOptions.filter(
        (category) => allocations[category.id] > 0 || lockedCategories.has(category.id)
      )
      const removedIndex = selectedBeforeRemoval.findIndex((category) => category.id === categoryKey)
      const remainingCategories = selectedBeforeRemoval
        .map((category, originalIndex) => ({ category, originalIndex }))
        .filter(({ category }) => category.id !== categoryKey)
      const shouldAnimateReflow = isCategoryBudgetOverlayOpen && removedIndex >= 0
      let reflowAnimation: Animated.CompositeAnimation | undefined

      if (shouldAnimateReflow) {
        const removedCardHeight = categoryOverlayCardHeights.current[categoryKey] ?? 150
        const removedCardTravel = removedCardHeight + 10
        const downwardNudge = Math.min(36, Math.max(22, removedCardHeight * 0.18))
        const orderedCategories = [...remainingCategories].sort(
          (left, right) =>
            Math.abs(left.originalIndex - removedIndex) - Math.abs(right.originalIndex - removedIndex)
        )

        const cardAnimations = orderedCategories.map(({ category, originalIndex }) => {
          const animationValue = categoryReflowAnimations[category.id]
          animationValue.stopAnimation()
          animationValue.setValue(originalIndex < removedIndex ? -downwardNudge : removedCardTravel)
          return Animated.timing(animationValue, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        })

        categoryActionsReflow.stopAnimation()
        categoryActionsReflow.setValue(removedCardTravel)
        const actionAnimation = Animated.sequence([
          Animated.delay(orderedCategories.length * 45),
          Animated.timing(categoryActionsReflow, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ])

        setIsCategoryReflowing(true)
        reflowAnimation = Animated.parallel([
          Animated.stagger(45, cardAnimations),
          actionAnimation,
        ])
      } else {
        animateCategoryLayout()
      }

      setCategoryNotice(`${label} was removed. You can reselect it while this budget plan is open.`)
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
      setFadingCategoryKey(undefined)

      if (reflowAnimation) {
        requestAnimationFrame(() => {
          categoryRemovalFade.setValue(1)
          reflowAnimation?.start(() => {
            remainingCategories.forEach(({ category }) => {
              categoryReflowAnimations[category.id].setValue(0)
            })
            categoryActionsReflow.setValue(0)
            setIsCategoryReflowing(false)
          })
        })
      } else {
        categoryRemovalFade.setValue(1)
      }
    }

    dismissRemovalDialog(() => {
      if (!isCategoryBudgetOverlayOpen) {
        finishRemoval()
        return
      }

      setFadingCategoryKey(categoryKey)
      categoryRemovalFade.stopAnimation()
      categoryRemovalFade.setValue(1)
      requestAnimationFrame(() => {
        Animated.timing(categoryRemovalFade, {
          toValue: 0,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) finishRemoval()
          else {
            setFadingCategoryKey(undefined)
            categoryRemovalFade.setValue(1)
          }
        })
      })
    })
  }, [
    allocations,
    animateCategoryLayout,
    categoryActionsReflow,
    categoryReflowAnimations,
    categoryRemovalFade,
    dismissRemovalDialog,
    isCategoryBudgetOverlayOpen,
    lockedCategories,
    pendingRemoval,
    selectableCategoryOptions,
  ])

  const handleReselectCategory = React.useCallback(
    (categoryKey: BudgetPriority, label: string) => {
      const removed = removedCategories[categoryKey]
      if (!removed) return

      const available = Math.max(budget - totalAllocated, 0)
      if (removed.previousAmount > available) {
        setCategoryNotice(
          `Reselect is unavailable because restoring ${formatMoney(removed.previousAmount)} for ${label} would exceed the remaining budget.`
        )
        return
      }

      setAllocations((current) => ({ ...current, [categoryKey]: removed.previousAmount }))
      setAllocationValidationMessages((current) => {
        if (!current[categoryKey]) return current
        const next = { ...current }
        delete next[categoryKey]
        return next
      })
      setExpandedCategories((current) => {
        if (!current.has(categoryKey)) return current
        const next = new Set(current)
        next.delete(categoryKey)
        return next
      })
      setRemovedCategories((current) => {
        const next = { ...current }
        delete next[categoryKey]
        return next
      })
      setCategoryNotice(`${label} was reselected with its previous allocation.`)
      animateCategoryDeparture(categoryKey, true)
    },
    [animateCategoryDeparture, budget, removedCategories, totalAllocated]
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

  const coordinatorPriceUnavailable = coordinatorRequired && coordinatorMinimum <= 0
  const canContinue = !isProcessing
    && !budgetTooLow
    && !allocationExceeded
    && !hasAllocationValidationErrors
    && !coordinatorPriceUnavailable
  const selectedCategories = selectableCategoryOptions.filter(
    (category) => allocations[category.id] > 0 || lockedCategories.has(category.id)
  )
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <BlurTargetView ref={categoryBudgetBlurTargetRef} style={styles.screen}>
      <PlanningScreenHeader
        brandTitle
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
        stickyHeaderIndices={[1]}
        style={styles.mainScroll}
      >
        <View style={styles.contentBody}>
          <View style={styles.introCopy}>
            <Text style={[styles.title, isWide && styles.titleWide]}>Set &amp; Allocate Your Event Budget</Text>
            <Text style={styles.subtitle}>
              {excludeVenue ? 'Your secured external venue is excluded. Divide the full budget among your remaining services.' : 'Set the total, then divide it among the services that matter to your event.'}
            </Text>
          </View>
        </View>

        <View style={styles.budgetStickyContainer}>
          <View style={styles.budgetStickyInner}>
            <View style={styles.budgetSummaryCard}>
          <View style={styles.budgetInputCard}>
            <View style={styles.budgetInputHeading}>
              <Text style={styles.fieldLabel}>SET YOUR EVENT BUDGET</Text>
              <Text style={styles.optionalLabel}>OPTIONAL</Text>
            </View>
            <View style={[styles.totalBudgetInputShell, isBudgetInputFocused && styles.totalBudgetInputShellFocused]}>
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
            </View>
          </View>

          <View style={styles.budgetSummarySectionDivider} />

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
            </View>
          </View>
          <LinearGradient
            colors={[palette.background, 'rgba(233, 237, 240, 0)']}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
            start={{ x: 0, y: 0 }}
            style={styles.budgetStickyBottomFade}
          />
        </View>

        <View style={styles.contentBody}>
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
            <Text style={styles.sectionTitle}>CATEGORY BUDGETS</Text>
            <Text style={styles.sectionSubtitle}>
              Select the services you need, then set their individual budgets together.
            </Text>
          </View>

          {categoryNotice ? (
            <View accessibilityLiveRegion="polite" style={styles.categoryNotice}>
              <MaterialIcons color={palette.primaryContainer} name="info-outline" size={18} />
              <Text style={styles.categoryNoticeText}>{categoryNotice}</Text>
            </View>
          ) : null}

          <View style={styles.categorySelectionContainer}>
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
              const isDeparting = departingCategory?.categoryKey === category.id
              const visuallySelected = selected && !isDeparting
              const visuallyRemoved = wasRemoved || Boolean(isDeparting && departingCategory?.wasRemoved)

              if (selected && !isDeparting) return null

              return (
                <Animated.View
                  key={category.id}
                  pointerEvents={isDeparting ? 'none' : 'auto'}
                  style={[
                    styles.categoryCard,
                    visuallySelected && styles.categoryCardSelected,
                    isDeparting && {
                      opacity: categoryDeparture.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                      transform: [{
                        translateX: categoryDeparture.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 72],
                        }),
                      }],
                    },
                  ]}
                >
                  <Pressable
                    accessibilityLabel={
                      visuallySelected
                        ? `${expanded ? 'Collapse' : 'Expand'} ${category.label} budget allocation`
                        : visuallyRemoved
                          ? `Reselect ${category.label} category`
                        : `Select ${category.label} category`
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded, selected: visuallySelected }}
                    onPress={() => {
                      if (wasRemoved) handleReselectCategory(category.id, category.label)
                      else handleCategoryPress(category.id)
                    }}
                    style={({ pressed }) => [styles.categoryHeader, pressed && styles.categoryHeaderPressed]}
                  >
                    <View style={styles.categoryIdentity}>
                      <View style={[styles.categoryIcon, visuallySelected && styles.categoryIconSelected]}>
                        <MaterialIcons
                          color={palette.primaryContainer}
                          name={category.icon}
                          size={20}
                        />
                      </View>
                      <View style={styles.categoryCopy}>
                        <Text style={styles.categoryLabel}>{category.label}</Text>
                        <Text style={styles.categoryStatus}>
                          {visuallySelected
                            ? locked
                              ? 'Selected · locked to service'
                              : `Selected · ${formatMoney(amount)}`
                            : visuallyRemoved
                              ? 'Removed from this budget plan'
                              : legacyPriorities.has(category.id)
                              ? 'Previously marked as a priority'
                              : 'Not selected'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.categoryAction, visuallySelected && styles.categoryActionSelected]}>
                      <Text style={[styles.categoryActionText, visuallySelected && styles.categoryActionTextSelected]}>
                        {visuallySelected ? (expanded ? 'HIDE' : 'SHOW') : visuallyRemoved ? 'RESELECT' : 'SELECT'}
                      </Text>
                      <MaterialIcons
                        color={visuallySelected ? palette.white : palette.primaryContainer}
                        name={visuallySelected && expanded ? 'expand-less' : visuallySelected ? 'expand-more' : visuallyRemoved ? 'undo' : 'chevron-right'}
                        size={18}
                      />
                    </View>
                  </Pressable>

                  {visuallySelected && expanded ? (
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
                          {`Lowest available price: ${formatMoney(minimum)}`}
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
                </Animated.View>
              )
            })}
          </View>
          {selectedCategories.length > 0 ? (
            <Pressable
              accessibilityLabel="Set budgets for selected categories"
              accessibilityRole="button"
              onPress={() => setIsCategoryBudgetOverlayOpen(true)}
              style={({ pressed }) => [styles.categoryDoneButton, pressed && styles.pressed]}
            >
              <Text style={styles.categoryDoneText}>DONE</Text>
            </Pressable>
          ) : null}
          </View>
        </View>
        </View>
      </ScrollView>
      {onSkip && coordinatorMinimum === 0 && !coordinatorRequired ? (
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <Pressable
              accessibilityRole="button"
              disabled={isProcessing}
              onPress={onSkip}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={styles.skipText}>SKIP FOR NOW</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      </BlurTargetView>

      {isCategoryBudgetOverlayOpen ? (
        <View
          pointerEvents={isCategoryBudgetOverlayClosing ? 'none' : 'auto'}
          style={styles.categoryBudgetOverlay}
        >
          <BlurView
            blurTarget={categoryBudgetBlurTargetRef}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={1}
            intensity={42}
            tint="dark"
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              accessibilityLabel="Close category budgets"
              accessibilityRole="button"
              onPress={dismissCategoryBudgetOverlay}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.categoryBudgetKeyboard}>
            <View style={styles.categoryBudgetOverlayContent}>
              <Animated.View
                accessibilityViewIsModal
                style={[
                  styles.categoryBudgetDialog,
                  {
                    opacity: categoryBudgetPopupScale.interpolate({
                      inputRange: [0.82, 1],
                      outputRange: [0, 1],
                      extrapolate: 'clamp',
                    }),
                    transform: [{ scale: categoryBudgetPopupScale }],
                  },
                ]}
              >
                <View style={styles.categoryBudgetDialogHeader}>
                  <Text style={styles.categoryBudgetEventTitle}>Set Your Event Budget</Text>
                  <Pressable
                    accessibilityLabel="Close category budgets"
                    accessibilityRole="button"
                    onPress={dismissCategoryBudgetOverlay}
                    style={({ pressed }) => [styles.categoryBudgetClose, pressed && styles.pressed]}
                  >
                    <MaterialIcons color={palette.error} name="close" size={20} />
                  </Pressable>
                </View>

                <View style={styles.categoryBudgetStickyBudget}>
                  <View style={styles.categoryBudgetSummaryRow}>
                    <View style={styles.categoryBudgetSummaryMetric}>
                      <Text style={styles.categoryBudgetSummaryLabel}>Allocated</Text>
                      <Text style={styles.categoryBudgetAllocatedValue}>
                        {formatMoney(totalAllocated)}
                      </Text>
                    </View>
                    <View style={styles.categoryBudgetSummaryMetric}>
                      <Text style={styles.categoryBudgetSummaryLabel}>Remaining</Text>
                      <Text style={styles.categoryBudgetRemainingValue}>
                        {formatMoney(remainingBudget)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.totalBudgetInputShell, isBudgetInputFocused && styles.totalBudgetInputShellFocused]}>
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
                  </View>
                  {budgetTooLow ? (
                    <Text accessibilityRole="alert" style={styles.categoryBudgetStickyError}>
                      Raise the event budget to at least {formatMoney(coordinatorMinimum)}.
                    </Text>
                  ) : allocationExceeded ? (
                    <Text accessibilityRole="alert" style={styles.categoryBudgetStickyError}>
                      Allocations exceed the event budget. Raise the total or reduce a category.
                    </Text>
                  ) : null}
                </View>

                <View
                  pointerEvents={isCategoryReflowing ? 'none' : 'auto'}
                  style={styles.categoryBudgetEditorViewport}
                >
                  <ScrollView
                    contentContainerStyle={styles.categoryBudgetEditorListContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={styles.categoryBudgetEditorList}
                  >
                    <Text style={styles.categoryBudgetDialogTitle}>Set Budget for Selected Categories</Text>

                {selectedCategories.map((category) => {
                  const amount = allocations[category.id]
                  const otherTotal = totalAllocated - amount
                  const maximum = Math.max(budget - otherTotal, 0)
                  const minimum = minimumForCategory(category.id)
                  const locked = lockedCategories.has(category.id)
                  const canRemove = !locked && !(
                    category.id === 'eventOrganizer' && (minimum > 0 || coordinatorRequired)
                  )
                  const canRequestCoordinatorRemoval =
                    category.id === 'eventOrganizer'
                    && minimum > 0
                    && Boolean(onRemoveCommittedCoordinator)
                  const canRemoveCategory = canRemove || canRequestCoordinatorRemoval
                  const isFading = fadingCategoryKey === category.id

                  return (
                    <Animated.View
                      key={category.id}
                      onLayout={(event) => {
                        categoryOverlayCardHeights.current[category.id] = event.nativeEvent.layout.height
                      }}
                      pointerEvents={isFading ? 'none' : 'auto'}
                      style={[
                        styles.categoryBudgetEditorCard,
                        {
                          opacity: isFading ? categoryRemovalFade : 1,
                          transform: [
                            { translateY: categoryReflowAnimations[category.id] },
                            {
                              scale: categoryRemovalFade.interpolate({
                                inputRange: [0, 1],
                                outputRange: isFading ? [0.96, 1] : [1, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <View style={styles.categoryBudgetEditorHeader}>
                        <View style={styles.categoryIdentity}>
                          <View style={[
                            styles.categoryIcon,
                            styles.categoryIconSelected,
                            styles.categoryBudgetEditorIcon,
                          ]}>
                            <MaterialIcons color={palette.primaryContainer} name={category.icon} size={20} />
                          </View>
                          <View style={styles.categoryCopy}>
                            <Text style={styles.categoryLabel}>{category.label}</Text>
                          </View>
                        </View>
                        <Pressable
                          accessibilityLabel={
                            canRequestCoordinatorRemoval
                              ? 'Remove committed coordinator before removing Event Coordinator category'
                              : `Remove ${category.label} category`
                          }
                          accessibilityRole="button"
                          disabled={!canRemoveCategory || isFading}
                          hitSlop={8}
                          onPress={() => requestCategoryRemoval(category.id, category.label)}
                          style={({ pressed }) => [
                            styles.categoryBudgetRemoveButton,
                            !canRemoveCategory && styles.categoryBudgetRemoveButtonDisabled,
                            pressed && canRemoveCategory && styles.pressed,
                          ]}
                        >
                          <MaterialIcons
                            color={canRemoveCategory ? palette.error : palette.secondaryFixedDim}
                            name="remove"
                            size={20}
                          />
                        </Pressable>
                      </View>
                      <AllocationSlider
                        amount={amount}
                        budget={budget}
                        compact
                        coordinatorMinimum={minimum}
                        label={category.label}
                        locked={locked}
                        availableAmount={remainingBudget}
                        maxAmount={maximum}
                        minimumAmount={minimum}
                        onChange={(nextAmount) => handleAllocationChange(category.id, nextAmount)}
                        onValidationMessageChange={(message) =>
                          handleAllocationValidationMessage(category.id, message)
                        }
                        validationMessage={allocationValidationMessages[category.id]}
                      />
                      {category.id !== 'eventOrganizer' && minimum > 0 ? (
                        <Text style={styles.marketplacePriceNote}>
                          {`Lowest available price: ${formatMoney(minimum)}`}
                          {categoryMinimums[category.id]?.pricingBasis
                            ? ` · ${categoryMinimums[category.id]?.pricingBasis}`
                            : ''}
                        </Text>
                      ) : null}
                    </Animated.View>
                  )
                })}

                    <Animated.View
                      style={[
                        styles.categoryBudgetScrollableActions,
                        { transform: [{ translateY: categoryActionsReflow }] },
                      ]}
                    >
                      <View style={styles.categoryBudgetActionDivider} />
                      <Pressable
                        accessibilityLabel="Return to category selection"
                        accessibilityRole="button"
                        onPress={dismissCategoryBudgetOverlay}
                        style={({ pressed }) => [
                          styles.categoryBudgetAddButton,
                          pressed && styles.categoryBudgetAddButtonPressed,
                        ]}
                      >
                        <MaterialIcons color={palette.primaryContainer} name="add" size={19} />
                        <Text style={styles.categoryBudgetAddButtonText}>ADD MORE CATEGORIES</Text>
                      </Pressable>

                      <Pressable
                        accessibilityLabel="Continue to the next planning step"
                        accessibilityRole="button"
                        disabled={!canContinue}
                        onPress={handleContinue}
                        style={({ pressed }) => [
                          styles.categoryBudgetDoneButton,
                          !canContinue && styles.continueDisabled,
                          pressed && canContinue && styles.pressed,
                        ]}
                      >
                        {isProcessing ? <ActivityIndicator color={palette.white} size="small" /> : null}
                        <Text style={styles.categoryBudgetDoneText}>
                          {isProcessing ? 'SAVING…' : 'NEXT STEP'}
                        </Text>
                        {!isProcessing ? (
                          <MaterialIcons color={palette.white} name="arrow-forward" size={18} />
                        ) : null}
                      </Pressable>
                    </Animated.View>

                  </ScrollView>
                  <LinearGradient
                    colors={[palette.background, 'rgba(233, 237, 240, 0)']}
                    end={{ x: 0, y: 1 }}
                    pointerEvents="none"
                    start={{ x: 0, y: 0 }}
                    style={styles.categoryBudgetEditorTopFade}
                  />
                </View>

              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}

      <Modal
        animationType="none"
        onRequestClose={() => dismissRemovalDialog()}
        transparent
        visible={Boolean(pendingRemoval)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel category removal"
          onPress={() => dismissRemovalDialog()}
          pointerEvents={isRemovalDialogClosing ? 'none' : 'auto'}
          style={styles.removalBackdrop}
        >
          <AnimatedPressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.removalDialog,
              {
                opacity: removalDialogScale.interpolate({
                  inputRange: [0.82, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [{ scale: removalDialogScale }],
              },
            ]}
          >
            <MaterialIcons color={palette.error} name="remove-circle-outline" size={28} />
            <Text style={styles.removalTitle}>Remove This Category?</Text>
            <Text style={styles.removalBody}>
              {pendingRemoval
                ? `${pendingRemoval.label} will be removed from this budget plan. You can reselect it while you stay on this screen.`
                : ''}
            </Text>
            <View style={styles.removalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isRemovalDialogClosing}
                onPress={() => dismissRemovalDialog()}
                style={({ pressed }) => [
                  styles.removalCancelButton,
                  pressed && styles.removalCancelButtonPressed,
                ]}
              >
                <Text style={styles.removalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isRemovalDialogClosing}
                onPress={confirmCategoryRemoval}
                style={({ pressed }) => [
                  styles.removalConfirmButton,
                  pressed && styles.removalConfirmButtonPressed,
                ]}
              >
                <Text style={styles.removalConfirmText}>REMOVE CATEGORY</Text>
              </Pressable>
            </View>
          </AnimatedPressable>
        </Pressable>
      </Modal>

    </KeyboardAvoidingView>
  )
}

const palette = {
  background: '#E9EDF0',
  error: '#B3261E',
  errorSurface: '#FFF1F0',
  outline: '#D8C4C8',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  secondaryFixedDim: '#9A9395',
  surface: '#E9EDF0',
  text: '#1A1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  mainScroll: { flex: 1 },
  content: {
    width: '100%',
    paddingTop: 48,
    paddingBottom: 32,
  },
  contentBody: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  introCopy: { marginBottom: 32 },
  title: {
    color: '#57636C',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.25,
    marginBottom: 16,
  },
  titleWide: { fontSize: 36, lineHeight: 44, letterSpacing: -0.5 },
  subtitle: {
    color: '#87929A',
    fontSize: 18,
    lineHeight: 30,
  },
  budgetSummaryCard: {
    zIndex: 20,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.76)',
    borderRadius: 18,
    backgroundColor: palette.background,
    padding: 20,
    boxShadow: '8px 8px 17px rgba(156, 169, 180, 0.48), -8px -8px 17px rgba(255, 255, 255, 0.96)',
  },
  budgetStickyContainer: {
    zIndex: 20,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(94, 94, 94, 0.32)',
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  budgetStickyBottomFade: {
    position: 'absolute',
    right: 0,
    bottom: -28,
    left: 0,
    height: 28,
  },
  budgetStickyInner: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  budgetInputCard: { width: '100%' },
  budgetInputHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  fieldLabel: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  optionalLabel: {
    color: '#87929A',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  totalBudgetInputShell: {
    minWidth: 0,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    borderRadius: 14,
    backgroundColor: palette.background,
    paddingHorizontal: 14,
    boxShadow: 'inset 5px 5px 10px rgba(170, 181, 190, 0.54), inset -5px -5px 10px rgba(255, 255, 255, 0.92)',
  },
  totalBudgetInputShellFocused: {
    borderColor: 'rgba(107, 30, 46, 0.62)',
  },
  totalCurrency: {
    color: palette.primaryContainer,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
  },
  budgetInput: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: palette.primaryContainer,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 7,
    outlineWidth: 0,
  },
  budgetSummarySectionDivider: {
    height: 1,
    marginVertical: 18,
    backgroundColor: 'rgba(135,146,154,0.22)',
  },
  summaryCard: {
    flexDirection: 'row',
  },
  summaryItem: { flex: 1 },
  summaryDivider: { width: 1, marginHorizontal: 16, backgroundColor: 'rgba(135,146,154,0.24)' },
  summaryLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
  summaryValue: { marginTop: 5, color: palette.text, fontSize: 20, fontWeight: '800' },
  remainingValue: { color: palette.primaryContainer },
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
  sectionTitle: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionSubtitle: { marginTop: 6, color: '#87929A', fontSize: 13, lineHeight: 20 },
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
  categorySelectionContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.76)',
    borderRadius: 18,
    backgroundColor: palette.background,
    padding: 12,
    boxShadow: '8px 8px 17px rgba(156, 169, 180, 0.42), -8px -8px 17px rgba(255, 255, 255, 0.94)',
  },
  allocationList: { gap: 12 },
  categoryCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 14,
    backgroundColor: palette.background,
    overflow: 'hidden',
    boxShadow: '5px 5px 10px rgba(156, 169, 180, 0.40), -5px -5px 10px rgba(255, 255, 255, 0.92)',
  },
  categoryCardSelected: { borderColor: 'rgba(107,30,46,0.34)' },
  categoryHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoryHeaderPressed: { opacity: 0.82 },
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
    backgroundColor: palette.background,
    boxShadow: 'inset 3px 3px 6px rgba(170, 181, 190, 0.34), inset -3px -3px 6px rgba(255, 255, 255, 0.90)',
  },
  categoryIconSelected: { backgroundColor: 'rgba(107,30,46,0.11)' },
  categoryCopy: { minWidth: 0, flex: 1 },
  categoryLabel: { color: palette.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  categoryStatus: { marginTop: 2, color: palette.secondary, fontSize: 12, lineHeight: 16 },
  categoryAction: {
    minWidth: 82,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    borderRadius: 18,
    backgroundColor: palette.background,
    paddingHorizontal: 10,
    boxShadow: '3px 3px 6px rgba(156, 169, 180, 0.40), -3px -3px 6px rgba(255, 255, 255, 0.92)',
  },
  categoryActionSelected: {
    borderColor: palette.primaryContainer,
    backgroundColor: palette.primaryContainer,
    boxShadow: '3px 3px 7px rgba(78, 6, 26, 0.36), -2px -2px 5px rgba(255, 255, 255, 0.62)',
  },
  categoryActionText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6 },
  categoryActionTextSelected: { color: palette.white },
  categoryAllocationPanel: {
    borderTopWidth: 1,
    borderTopColor: '#EFE4E6',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  categoryDoneButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderRadius: 26,
    backgroundColor: palette.primary,
    boxShadow: '5px 6px 11px rgba(78, 6, 26, 0.38), -3px -3px 7px rgba(255, 255, 255, 0.58)',
  },
  categoryDoneText: { color: palette.white, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  allocationEditor: { paddingTop: 16 },
  allocationEditorCompact: { paddingTop: 10 },
  allocationCopy: { minWidth: 0, flex: 1 },
  allocationLabel: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  reservedLabel: { marginTop: 2, color: palette.primaryContainer, fontSize: 12, lineHeight: 17 },
  legacyLabel: { marginTop: 2, color: palette.secondary, fontSize: 12, lineHeight: 17 },
  marketplacePriceNote: { marginTop: 9, color: palette.secondary, fontSize: 12, lineHeight: 17 },
  amountInputShell: {
    width: 140,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    borderRadius: 10,
    backgroundColor: palette.background,
    paddingHorizontal: 10,
    boxShadow: 'inset 3px 3px 6px rgba(170, 181, 190, 0.44), inset -3px -3px 6px rgba(255, 255, 255, 0.92)',
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
  amountInputError: { marginTop: 6, color: palette.error, fontSize: 12, lineHeight: 17 },
  sliderTouchArea: { justifyContent: 'center', height: 38, marginTop: 10 },
  sliderTrack: {
    height: 6,
    justifyContent: 'center',
    borderRadius: 3,
    backgroundColor: palette.background,
    boxShadow: 'inset 2px 2px 4px rgba(170, 181, 190, 0.48), inset -2px -2px 4px rgba(255, 255, 255, 0.88)',
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
    shadowColor: '#4E061A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sliderRange: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
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
  removeCategoryText: { color: palette.error, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  removeCategoryTextDisabled: { color: palette.secondaryFixedDim },
  categoryBudgetOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
    backgroundColor: 'rgba(35, 43, 48, 0.14)',
  },
  categoryBudgetKeyboard: { flex: 1 },
  categoryBudgetOverlayContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  categoryBudgetDialog: {
    width: '100%',
    height: '90%',
    maxWidth: 480,
    maxHeight: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 22,
    backgroundColor: palette.background,
    padding: 20,
    boxShadow: '10px 12px 26px rgba(62, 75, 84, 0.26)',
  },
  categoryBudgetDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  categoryBudgetDialogTitle: {
    alignSelf: 'center',
    color: '#57636C',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 2,
  },
  categoryBudgetEventTitle: {
    minWidth: 0,
    flex: 1,
    color: '#57636C',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'left',
  },
  categoryBudgetClose: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    borderRadius: 19,
    backgroundColor: palette.background,
    boxShadow: '4px 4px 8px rgba(156, 169, 180, 0.42), -4px -4px 8px rgba(255, 255, 255, 0.92)',
  },
  categoryBudgetStickyBudget: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 16,
    backgroundColor: palette.background,
    padding: 14,
    marginBottom: 12,
    boxShadow: '5px 5px 11px rgba(156, 169, 180, 0.38), -5px -5px 11px rgba(255, 255, 255, 0.92)',
  },
  categoryBudgetSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  categoryBudgetSummaryMetric: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 12,
    backgroundColor: palette.background,
    paddingHorizontal: 10,
    paddingVertical: 9,
    boxShadow: '3px 3px 7px rgba(156, 169, 180, 0.38), -3px -3px 7px rgba(255, 255, 255, 0.92)',
  },
  categoryBudgetSummaryLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  categoryBudgetAllocatedValue: {
    color: '#187A55',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    marginTop: 3,
  },
  categoryBudgetRemainingValue: {
    color: palette.error,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    marginTop: 3,
  },
  categoryBudgetStickyError: {
    color: palette.error,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 8,
  },
  categoryBudgetEditorViewport: {
    position: 'relative',
    minHeight: 0,
    flex: 1,
    marginHorizontal: -12,
  },
  categoryBudgetEditorList: { minHeight: 0, flex: 1 },
  categoryBudgetEditorListContent: {
    paddingTop: 40,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  categoryBudgetEditorTopFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 5,
    height: 36,
  },
  categoryBudgetEditorCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 16,
    backgroundColor: palette.background,
    marginTop: 10,
    padding: 12,
    boxShadow: '5px 5px 11px rgba(156, 169, 180, 0.42), -5px -5px 11px rgba(255, 255, 255, 0.92)',
  },
  categoryBudgetEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryBudgetEditorIcon: { width: 34, height: 34, borderRadius: 17 },
  categoryBudgetRemoveButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    borderRadius: 16,
    backgroundColor: palette.background,
    boxShadow: '3px 3px 6px rgba(156, 169, 180, 0.36), -3px -3px 6px rgba(255, 255, 255, 0.90)',
  },
  categoryBudgetRemoveButtonDisabled: { opacity: 0.48 },
  categoryBudgetScrollableActions: { paddingTop: 8, paddingBottom: 12 },
  categoryBudgetActionDivider: {
    alignSelf: 'center',
    width: '68%',
    height: 1,
    backgroundColor: 'rgba(94, 94, 94, 0.32)',
    marginTop: 10,
    marginBottom: 4,
  },
  categoryBudgetAddButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    borderRadius: 23,
    backgroundColor: palette.background,
    boxShadow: '5px 5px 10px rgba(156, 169, 180, 0.42), -5px -5px 10px rgba(255, 255, 255, 0.94)',
  },
  categoryBudgetAddButtonPressed: {
    boxShadow: 'inset 3px 3px 6px rgba(170, 181, 190, 0.50), inset -3px -3px 6px rgba(255, 255, 255, 0.92)',
    transform: [{ scale: 0.99 }],
  },
  categoryBudgetAddButtonText: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  categoryBudgetDoneButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: 26,
    backgroundColor: palette.primary,
    boxShadow: '6px 7px 13px rgba(78, 6, 26, 0.40), -3px -3px 7px rgba(255, 255, 255, 0.56)',
  },
  categoryBudgetDoneText: { color: palette.white, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  removalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 8, 13, 0.42)',
    padding: 24,
  },
  removalDialog: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: palette.background,
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
    borderColor: 'rgba(255,255,255,0.82)',
    borderRadius: 23,
    backgroundColor: palette.background,
    boxShadow: '5px 5px 10px rgba(156, 169, 180, 0.46), -5px -5px 10px rgba(255, 255, 255, 0.96)',
  },
  removalCancelButtonPressed: {
    boxShadow: 'inset 3px 3px 6px rgba(160, 171, 180, 0.52), inset -3px -3px 6px rgba(255, 255, 255, 0.94)',
    transform: [{ scale: 0.99 }],
  },
  removalCancelText: { color: palette.primaryContainer, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  removalConfirmButton: {
    minHeight: 46,
    flex: 1.35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: palette.error,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 8,
    boxShadow: '5px 6px 11px rgba(91, 16, 12, 0.46), -4px -4px 9px rgba(255, 126, 116, 0.32)',
  },
  removalConfirmButtonPressed: {
    boxShadow: 'inset 3px 3px 6px rgba(91, 16, 12, 0.58), inset -2px -2px 5px rgba(255, 150, 140, 0.30)',
    transform: [{ scale: 0.99 }],
  },
  removalConfirmText: { color: palette.white, fontSize: 12, fontWeight: '800', letterSpacing: 0.35 },
  footer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(135,146,154,0.20)',
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  footerContent: { width: '100%', maxWidth: 760, alignSelf: 'center', alignItems: 'center' },
  skipButton: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipText: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textDecorationLine: 'underline',
    textDecorationColor: palette.secondary,
  },
  continueDisabled: { opacity: 0.5, boxShadow: 'none' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
})
