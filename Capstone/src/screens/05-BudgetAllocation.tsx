import React from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { PlanningStepIndicator } from '../components/PlanningStepIndicator'

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
  { id: 'venue' as const, icon: '⌖', label: 'Venue' },
  { id: 'catering' as const, icon: '♨', label: 'Catering' },
  { id: 'eventOrganizer' as const, icon: '▣', label: 'Event Organizer' },
  { id: 'photoVideo' as const, icon: '◉', label: 'Photo/Video' },
  { id: 'gownRental' as const, icon: '◇', label: 'Gown Rental' },
  { id: 'hostEmcee' as const, icon: '◈', label: 'Host/Emcee' },
  { id: 'soundLights' as const, icon: '♫', label: 'Sound & Lights' },
  { id: 'floral' as const, icon: '✿', label: 'Floral' },
] as const

const formatBudget = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const BudgetAllocationScreen: React.FC<BudgetAllocationScreenProps> = ({
  initialBudget,
  initialPriorities = ['venue', 'eventOrganizer'],
  onBack,
  onBudgetChange,
  onContinue,
  onSkip,
}) => {
  const [budgetDigits, setBudgetDigits] = React.useState(
    initialBudget == null ? '' : String(Math.max(0, Math.floor(initialBudget)))
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
      budget: budgetDigits ? Number(budgetDigits) : 0,
      priorities,
    })
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.subtlePressed]}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>

          <PlanningStepIndicator currentStep={2} label="Budget" />

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.mainContent}>
          <View style={styles.budgetSection}>
            <View style={styles.introCopy}>
              <Text style={styles.title}>What's Your Budget?</Text>
              <Text style={styles.subtitle}>
                Set a starting point. We'll adjust as you explore.
              </Text>
            </View>

            <View style={styles.budgetCard}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                accessibilityLabel="Event budget in Philippine pesos"
                inputMode="numeric"
                keyboardType="number-pad"
                onChangeText={handleBudgetChange}
                placeholder="150,000"
                placeholderTextColor={palette.secondaryFixedDim}
                selectionColor={palette.primaryContainer}
                style={styles.budgetInput}
                value={formatBudget(budgetDigits)}
              />
              <View style={styles.inputAccent} />
            </View>
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
                      <Text
                        style={[
                          styles.priorityIcon,
                          isSelected && styles.priorityContentSelected,
                        ]}
                      >
                        {option.icon}
                      </Text>
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
            style={({ pressed }) => [styles.continueButton, pressed && styles.continuePressed]}
          >
            <Text style={styles.continueText}>CONTINUE</Text>
            <Text style={styles.continueIcon}>→</Text>
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
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 184,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backIcon: {
    color: palette.primary,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '400',
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
  currencySymbol: {
    width: 48,
    color: palette.primaryContainer,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
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
  inputAccent: {
    position: 'absolute',
    bottom: 16,
    left: '37.5%',
    width: '25%',
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.primaryContainer,
    opacity: 0.2,
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
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 8,
  },
  footerContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    alignItems: 'center',
  },
  skipButton: {
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
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 25,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  continueText: {
    color: palette.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  continueIcon: {
    color: palette.white,
    fontSize: 18,
    lineHeight: 20,
  },
  chipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  continuePressed: {
    backgroundColor: palette.primary,
    transform: [{ scale: 0.99 }],
  },
  subtlePressed: {
    opacity: 0.55,
  },
})
