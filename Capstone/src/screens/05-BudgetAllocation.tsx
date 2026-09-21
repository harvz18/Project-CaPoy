import { Text } from '../components/AppText'
import React from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
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

export interface BudgetAllocationValue {
  budget: number
  priorities: BudgetPriority[]
}

interface BudgetAllocationScreenProps {
  initialBudget?: number
  initialPriorities?: BudgetPriority[]
  onBack?: () => void
  onBudgetChange?: (budget: number) => void
  onContinue?: (value: BudgetAllocationValue) => void
  onSkip?: () => void
}

const priorityOptions = [
  { id: 'venue' as const, icon: 'location-on' as MaterialIconName, label: 'Venue' },
  { id: 'catering' as const, icon: 'restaurant' as MaterialIconName, label: 'Catering' },
  { id: 'eventOrganizer' as const, icon: 'event' as MaterialIconName, label: 'Event Organizer' },
  { id: 'photoVideo' as const, icon: 'camera-alt' as MaterialIconName, label: 'Photo/Video' },
  { id: 'gownRental' as const, icon: 'checkroom' as MaterialIconName, label: 'Gown Rental' },
  { id: 'hostEmcee' as const, icon: 'mic' as MaterialIconName, label: 'Host/Emcee' },
  { id: 'soundLights' as const, icon: 'volume-up' as MaterialIconName, label: 'Sound & Lights' },
  { id: 'floral' as const, icon: 'local-florist' as MaterialIconName, label: 'Floral' },
] as const

const formatBudget = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const BudgetAllocationScreen: React.FC<BudgetAllocationScreenProps> = ({
  initialBudget,
  initialPriorities = [],
  onBack,
  onBudgetChange,
  onContinue,
  onSkip,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [hasBudgetInput, setHasBudgetInput] = React.useState(
    typeof initialBudget === 'number' && initialBudget > 0
  )
  const [budgetDigits, setBudgetDigits] = React.useState(
    initialBudget != null && initialBudget > 0 ? String(Math.floor(initialBudget)) : ''
  )
  const [priorities, setPriorities] = React.useState<BudgetPriority[]>(
    initialPriorities.slice(0, 3)
  )
  const [rejectedPriority, setRejectedPriority] = React.useState<BudgetPriority | null>(null)
  const shakePosition = React.useRef(new Animated.Value(0)).current

  const handleBudgetChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 12)
    setBudgetDigits(digits)
    onBudgetChange?.(digits ? Number(digits) : 0)
  }

  const showLimitFeedback = (priority: BudgetPriority) => {
    setRejectedPriority(priority)
    shakePosition.setValue(0)
    Animated.sequence([
      Animated.timing(shakePosition, {
        duration: 60,
        toValue: -4,
        useNativeDriver: true,
      }),
      Animated.timing(shakePosition, {
        duration: 60,
        toValue: 4,
        useNativeDriver: true,
      }),
      Animated.timing(shakePosition, {
        duration: 60,
        toValue: -4,
        useNativeDriver: true,
      }),
      Animated.timing(shakePosition, {
        duration: 60,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => setRejectedPriority(null))
  }

  const togglePriority = (priority: BudgetPriority) => {
    if (priorities.includes(priority)) {
      setPriorities(priorities.filter((item) => item !== priority))
      return
    }

    if (priorities.length >= 3) {
      showLimitFeedback(priority)
      return
    }

    setPriorities([...priorities, priority])
  }

  const handleContinue = () => {
    onContinue?.({
      budget: hasBudgetInput && budgetDigits ? Number(budgetDigits) : 0,
      priorities,
    })
  }

  const removeBudget = () => {
    setBudgetDigits('')
    setHasBudgetInput(false)
    onBudgetChange?.(0)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <PlanningScreenHeader
        currentStep={2}
        label="Budget"
        nextEnabled
        onBack={onBack}
        onNext={handleContinue}
        title="Budget"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          <View style={styles.budgetSection}>
            <View style={styles.introCopy}>
              <Text style={styles.title}>What's Your Budget?</Text>
              <Text style={styles.subtitle}>
                Set a starting point. We'll adjust as you explore.
              </Text>
            </View>

            {hasBudgetInput ? (
              <View style={[styles.budgetCard, styles.budgetInputCard]}>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencyBadgeText}>PHP</Text>
                </View>
                <TextInput
                  accessibilityLabel="Event budget in Philippine pesos"
                  autoFocus
                  inputMode="numeric"
                  keyboardType="number-pad"
                  onChangeText={handleBudgetChange}
                  placeholder="150,000"
                  placeholderTextColor={palette.secondaryFixedDim}
                  selectionColor={palette.primaryContainer}
                  style={styles.budgetInput}
                  value={formatBudget(budgetDigits)}
                />
                <Pressable
                  accessibilityLabel="Remove event budget"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={removeBudget}
                  style={({ pressed }) => [styles.removeBudgetButton, pressed && styles.subtlePressed]}
                >
                  <MaterialIcons color={palette.secondary} name="close" size={20} />
                </Pressable>
              </View>
            ) : (
              <View style={[styles.budgetCard, styles.optionalBudgetCard]}>
                <View style={styles.optionalBudgetIcon}>
                  <MaterialIcons color={palette.primaryContainer} name="account-balance-wallet" size={26} />
                </View>
                <View style={styles.optionalBudgetCopy}>
                  <Text style={styles.optionalBudgetTitle}>Budget is optional</Text>
                  <Text style={styles.optionalBudgetDescription}>
                    Continue without one and pay the actual cost of the services you choose.
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Enter an event budget"
                  accessibilityRole="button"
                  onPress={() => setHasBudgetInput(true)}
                  style={({ pressed }) => [styles.enterBudgetButton, pressed && styles.continuePressed]}
                >
                  <Text style={styles.enterBudgetText}>ENTER BUDGET</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.prioritiesSection}>
            <View style={styles.prioritiesHeading}>
              <Text style={styles.prioritiesTitle}>What matters most?</Text>
              <Text style={styles.prioritiesSubtitle}>
                Pick up to 3 services to prioritize your budget.
              </Text>
            </View>

            <View style={styles.priorityGrid}>
              {priorityOptions.map((option) => {
                const isSelected = priorities.includes(option.id)
                const wasRejected = rejectedPriority === option.id

                return (
                  <Animated.View
                    key={option.id}
                    style={[
                      styles.priorityCell,
                      wasRejected && { transform: [{ translateX: shakePosition }] },
                    ]}
                  >
                    <Pressable
                      accessibilityLabel={`${option.label}${isSelected ? ', selected' : ''}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => togglePriority(option.id)}
                      style={({ pressed }) => [
                        styles.priorityChip,
                        isSelected ? styles.priorityChipSelected : styles.priorityChipUnselected,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <MaterialIcons
                        color={isSelected ? palette.white : palette.tertiaryMuted}
                        name={option.icon}
                        size={29}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.priorityLabel,
                          isSelected && styles.priorityContentSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  </Animated.View>
                )
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Pressable
            accessibilityLabel="Decide budget priorities later"
            accessibilityRole="button"
            hitSlop={6}
            onPress={onSkip}
            style={({ pressed }) => [styles.skipButton, pressed && styles.subtlePressed]}
          >
            <Text style={styles.skipText}>I'LL DECIDE AS I GO</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Continue to the next step"
            accessibilityRole="button"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              isWide && styles.continueButtonWide,
              pressed && styles.continuePressed,
            ]}
          >
            <Text style={styles.continueText}>{isWide ? 'CONTINUE' : 'NEXT STEP'}</Text>
            <MaterialIcons color={palette.white} name="arrow-forward" size={18} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const palette = {
  background: '#FFFFFF',
  surfaceContainer: '#EEEEEE',
  surfaceContainerHigh: '#E8E8E8',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  secondaryFixed: '#E3E2E2',
  secondaryFixedDim: '#C7C6C6',
  tertiaryMuted: '#A3A4A4',
  text: '#1A1C1C',
  white: '#FFFFFF',
  outlineVariant: '#DAC0C2',
} as const

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topAppBar: {
    zIndex: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#4E061A',
    backgroundColor: '#6B1E2E',
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 600,
    minHeight: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  mobileTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 184,
  },
  stepWrapper: {
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 14,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  mainContent: {
    gap: 48,
  },
  budgetSection: {
    alignItems: 'center',
  },
  introCopy: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    color: palette.primaryContainer,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.32,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    maxWidth: 380,
    color: palette.secondary,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
  },
  budgetCard: {
    width: '100%',
    minHeight: 128,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 16,
    backgroundColor: palette.white,
    paddingHorizontal: 24,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  budgetInputCard: { gap: 10 },
  currencyBadge: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F8EDEF',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  currencyBadgeText: {
    color: palette.primaryContainer,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  removeBudgetButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: palette.surfaceContainer,
  },
  optionalBudgetCard: {
    minHeight: 210,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 24,
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
  optionalBudgetTitle: {
    color: palette.primaryContainer,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionalBudgetDescription: {
    maxWidth: 340,
    color: palette.secondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  enterBudgetButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  enterBudgetText: {
    color: palette.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  budgetInput: {
    height: 96,
    flex: 1,
    color: palette.primaryContainer,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  prioritiesSection: {
    marginTop: 8,
  },
  prioritiesHeading: {
    alignItems: 'center',
    marginBottom: 24,
  },
  prioritiesTitle: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  prioritiesSubtitle: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  priorityCell: {
    minWidth: 140,
    flexBasis: '47%',
    flexGrow: 1,
  },
  priorityChip: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  priorityChipSelected: {
    borderColor: palette.primaryContainer,
    backgroundColor: palette.primaryContainer,
  },
  priorityChipUnselected: {
    borderColor: palette.secondaryFixed,
    backgroundColor: palette.white,
  },
  priorityIcon: {
    color: palette.tertiaryMuted,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: '500',
  },
  priorityLabel: {
    maxWidth: '100%',
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  priorityContentSelected: {
    color: palette.white,
  },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 226, 226, 0.5)',
    backgroundColor: 'rgba(249, 249, 249, 0.96)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  footerContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    alignItems: 'flex-end',
  },
  skipButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
  },
  skipText: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  continueButton: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 28,
    backgroundColor: palette.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  continueButtonWide: { width: 200 },
  continueText: {
    color: palette.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  chipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  continuePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  subtlePressed: {
    opacity: 0.55,
  },
})
