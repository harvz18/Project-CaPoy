import React from 'react'
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { PlanningStepIndicator } from '../components/PlanningStepIndicator'

export interface ScheduleProvider {
  available: boolean
  dateTime: string
  id: string
  name: string
}

interface ScheduleNoConflictScreenProps {
  providers?: ScheduleProvider[]
  onBack?: () => void
  onContinueToPayment?: () => void
  onSelectProvider?: (provider: ScheduleProvider) => void
}

const defaultProviders: ScheduleProvider[] = [
  {
    id: 'glasshouse',
    name: 'The Glasshouse Estate',
    dateTime: 'OCT 24, 2:00 PM',
    available: true,
  },
  {
    id: 'gourmetAffairs',
    name: 'Gourmet Affairs',
    dateTime: 'OCT 24, 4:30 PM',
    available: true,
  },
  {
    id: 'lumiere',
    name: 'Lumiere Photography',
    dateTime: 'OCT 24, 1:00 PM',
    available: true,
  },
]

export const ScheduleNoConflictScreen: React.FC<ScheduleNoConflictScreenProps> = ({
  providers = defaultProviders,
  onBack,
  onContinueToPayment,
  onSelectProvider,
}) => {
  const statusOpacity = React.useRef(new Animated.Value(0)).current
  const statusOffset = React.useRef(new Animated.Value(10)).current
  const listOpacity = React.useRef(new Animated.Value(0)).current
  const listOffset = React.useRef(new Animated.Value(10)).current
  const hasConflicts = providers.some((provider) => !provider.available)

  React.useEffect(() => {
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(statusOpacity, {
          duration: 420,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(statusOffset, {
          duration: 420,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(listOpacity, {
          duration: 420,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(listOffset, {
          duration: 420,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [listOffset, listOpacity, statusOffset, statusOpacity])

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarContent}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Schedule Check</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <View style={styles.stepWrapper}>
        <PlanningStepIndicator currentStep={4} label="Schedule Check" />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.statusSection,
            { opacity: statusOpacity, transform: [{ translateY: statusOffset }] },
          ]}
        >
          <View style={[styles.statusIconCircle, hasConflicts && styles.statusIconConflict]}>
            <View style={[styles.checkCircle, hasConflicts && styles.conflictCircle]}>
              <Text style={[styles.checkMark, hasConflicts && styles.conflictMark]}>
                {hasConflicts ? '!' : '✓'}
              </Text>
            </View>
          </View>
          <Text style={styles.statusTitle}>
            {hasConflicts ? 'Schedule Conflict Found' : 'No Conflicts Found'}
          </Text>
          <Text style={styles.statusDescription}>
            {hasConflicts
              ? 'One or more selected providers need a different schedule.'
              : 'All your selected providers are available on your event date.'}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.providerCard,
            { opacity: listOpacity, transform: [{ translateY: listOffset }] },
          ]}
        >
          <View style={styles.providerList}>
            {providers.map((provider, index) => (
              <Pressable
                key={provider.id}
                accessibilityLabel={`${provider.name}, ${provider.dateTime}, ${
                  provider.available ? 'available' : 'conflict'
                }`}
                accessibilityRole="button"
                onPress={() => onSelectProvider?.(provider)}
                style={({ pressed }) => [
                  styles.providerRow,
                  index < providers.length - 1 && styles.providerRowBorder,
                  pressed && styles.providerRowPressed,
                ]}
              >
                <View style={styles.providerCopy}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.providerDate}>{provider.dateTime}</Text>
                </View>
                <View
                  style={[
                    styles.rowCheckCircle,
                    !provider.available && styles.rowConflictCircle,
                  ]}
                >
                  <Text
                    style={[styles.rowCheckMark, !provider.available && styles.rowConflictMark]}
                  >
                    {provider.available ? '✓' : '!'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Pressable
            accessibilityLabel={hasConflicts ? 'Resolve schedule conflicts' : 'Continue to payment'}
            accessibilityRole="button"
            onPress={onContinueToPayment}
            style={({ pressed }) => [styles.continueButton, pressed && styles.continuePressed]}
          >
            <Text style={styles.continueText}>
              {hasConflicts ? 'Resolve Conflicts' : 'Continue to Payment'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  surface: '#FFFFFF',
  surfaceMuted: '#E5E5E5',
  surfaceVariant: '#E2E2E2',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  text: '#1A1C1C',
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 50,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceVariant,
    backgroundColor: palette.surface,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 448,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backIcon: { color: palette.text, fontSize: 27, lineHeight: 29 },
  headerTitle: {
    flex: 1,
    color: palette.primary,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerSpacer: { width: 40, height: 40 },
  stepWrapper: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  content: {
    width: '100%',
    maxWidth: 448,
    minHeight: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 124,
  },
  statusSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  statusIconCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    backgroundColor: palette.surfaceMuted,
    marginBottom: 24,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  statusIconConflict: { backgroundColor: palette.errorContainer },
  checkCircle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: palette.primaryContainer,
    borderRadius: 20,
    backgroundColor: palette.primaryContainer,
  },
  conflictCircle: { borderColor: palette.error, backgroundColor: palette.error },
  checkMark: { color: palette.white, fontSize: 25, lineHeight: 27, fontWeight: '700' },
  conflictMark: { color: palette.white },
  statusTitle: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusDescription: {
    maxWidth: 300,
    color: palette.secondary,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
  },
  providerCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: palette.surfaceMuted,
    borderRadius: 12,
    backgroundColor: 'rgba(229, 229, 229, 0.4)',
    padding: 8,
    marginBottom: 32,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  providerList: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: palette.surface,
  },
  providerRow: {
    minHeight: 81,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 16,
  },
  providerRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.surfaceMuted },
  providerRowPressed: { backgroundColor: palette.background },
  providerCopy: { flex: 1 },
  providerName: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  providerDate: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 4,
  },
  rowCheckCircle: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: palette.primaryContainer,
  },
  rowConflictCircle: { backgroundColor: palette.error },
  rowCheckMark: { color: palette.white, fontSize: 14, lineHeight: 16, fontWeight: '700' },
  rowConflictMark: { color: palette.white },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    minHeight: 88,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.surfaceVariant,
    backgroundColor: palette.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  footerContent: { width: '100%', maxWidth: 448, alignSelf: 'center' },
  continueButton: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 15,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  continueText: { color: palette.white, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  continuePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  pressed: { opacity: 0.55 },
})
