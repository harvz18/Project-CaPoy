import { Text } from '../components/AppText'
import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'

export interface ScheduleConflictProvider {
  available: boolean
  category?: string
  dateTime?: string
  id: string
  message?: string
  name: string
  serviceName?: string
}

interface ScheduleConflictScreenProps {
  eventDate?: string
  providers?: ScheduleConflictProvider[]
  onBack?: () => void
  onConfirmDateChange?: (
    date: string,
    provider: ScheduleConflictProvider
  ) => boolean | Promise<boolean>
  onChooseDifferentProvider?: (provider: ScheduleConflictProvider) => void
  onMessageProvider?: (provider: ScheduleConflictProvider) => void
}

const defaultProviders: ScheduleConflictProvider[] = [
  {
    id: 'gourmetAffairs',
    name: 'Gourmet Affairs',
    dateTime: 'OCT 24, 4:30 PM',
    available: true,
  },
  {
    id: 'glasshouse',
    name: 'The Glasshouse Estate',
    message: 'Not available on Oct 24 \u2014 resolve to continue.',
    available: false,
  },
  {
    id: 'lumiere',
    name: 'Lumiere Photography',
    dateTime: 'OCT 24, 1:00 PM',
    available: true,
  },
]

const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const padTwo = (value: number) => value.toString().padStart(2, '0')
const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate())
const parseEventDate = (value?: string) => {
  if (!value) return null
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const parsed = slashMatch
    ? new Date(Number(slashMatch[3]), Number(slashMatch[1]) - 1, Number(slashMatch[2]))
    : isoMatch
      ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
      : null

  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
}
const formatEventDate = (value: Date) =>
  `${padTwo(value.getMonth() + 1)}/${padTwo(value.getDate())}/${value.getFullYear()}`
const isSameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate()

export const ScheduleConflictScreen: React.FC<ScheduleConflictScreenProps> = ({
  eventDate,
  providers = defaultProviders,
  onBack,
  onConfirmDateChange,
  onChooseDifferentProvider,
  onMessageProvider,
}) => {
  const today = React.useMemo(() => startOfDay(new Date()), [])
  const initialDate = React.useMemo(() => {
    const parsed = parseEventDate(eventDate)
    return parsed && parsed >= today ? parsed : today
  }, [eventDate, today])
  const [dateProvider, setDateProvider] = React.useState<ScheduleConflictProvider>()
  const [selectedDate, setSelectedDate] = React.useState(initialDate)
  const [visibleMonth, setVisibleMonth] = React.useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  )
  const [isSavingDate, setIsSavingDate] = React.useState(false)
  const [dateError, setDateError] = React.useState('')
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  ).getDate()
  const leadingDays = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1
  ).getDay()
  const canGoToPreviousMonth =
    visibleMonth.getFullYear() > today.getFullYear() ||
    (visibleMonth.getFullYear() === today.getFullYear() &&
      visibleMonth.getMonth() > today.getMonth())
  const dateIsUnchanged = isSameDay(selectedDate, initialDate)

  const openDateCalendar = (provider: ScheduleConflictProvider) => {
    setDateProvider(provider)
    setSelectedDate(initialDate)
    setVisibleMonth(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
    setDateError('')
  }

  return (
    <View style={styles.screen}>
      <PlanningScreenHeader
        currentStep={4}
        label="Schedule Check"
        nextAccessibilityLabel="Resolve schedule conflicts before continuing"
        onBack={onBack}
        title="Schedule Check"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <View style={styles.statusIconCircle}>
            <View style={styles.errorIcon}>
              <Text style={styles.errorMark}>!</Text>
            </View>
          </View>
          <Text style={styles.statusTitle}>Conflict Found</Text>
          <Text style={styles.statusDescription}>
            One of your selected providers isn&apos;t available on your event date.
          </Text>
        </View>

        <View style={styles.providerCard}>
          {providers.map((provider, index) =>
            provider.available ? (
              <View
                key={provider.id}
                style={[
                  styles.providerRow,
                  index < providers.length - 1 && styles.providerRowBorder,
                ]}
              >
                <View style={styles.providerCopy}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  {provider.serviceName ? (
                    <Text style={styles.serviceName}>
                      {provider.serviceName}
                      {provider.category ? ` \u00b7 ${provider.category}` : ''}
                    </Text>
                  ) : null}
                  <Text style={styles.providerDate}>{provider.dateTime}</Text>
                </View>
                <View style={styles.checkIcon}>
                  <Text style={styles.checkMark}>{'\u2713'}</Text>
                </View>
              </View>
            ) : (
              <View
                key={provider.id}
                style={[
                  styles.conflictRow,
                  index < providers.length - 1 && styles.providerRowBorder,
                ]}
              >
                <View style={styles.conflictHeading}>
                  <View style={styles.providerCopy}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    {provider.serviceName ? (
                      <Text style={styles.serviceName}>
                        {provider.serviceName}
                        {provider.category ? ` \u00b7 ${provider.category}` : ''}
                      </Text>
                    ) : null}
                    <Text style={styles.actionRequired}>ACTION REQUIRED</Text>
                  </View>
                  <View style={styles.warningIcon}>
                    <Text style={styles.warningMark}>!</Text>
                  </View>
                </View>

                <View style={styles.conflictMessage}>
                  <Text style={styles.conflictMessageText}>
                    {provider.message ??
                      'This provider is unavailable \u2014 resolve to continue.'}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    accessibilityLabel="Open calendar to change the event date"
                    accessibilityRole="button"
                    onPress={() => openDateCalendar(provider)}
                    style={({ pressed }) => [
                      styles.outlineButton,
                      pressed && styles.outlineButtonPressed,
                    ]}
                  >
                    <Text style={styles.outlineButtonText}>Change Date</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onChooseDifferentProvider?.(provider)}
                    style={({ pressed }) => [
                      styles.outlineButton,
                      pressed && styles.outlineButtonPressed,
                    ]}
                  >
                    <Text style={styles.outlineButtonText}>Choose Different Provider</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onMessageProvider?.(provider)}
                    style={({ pressed }) => [
                      styles.messageButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.messageButtonText}>Message Provider</Text>
                  </Pressable>
                </View>
              </View>
            )
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Text style={styles.footerHint}>Resolve the conflict above to continue</Text>
          <Pressable
            accessibilityLabel="Continue to payment, unavailable until conflicts are resolved"
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
            style={styles.disabledButton}
          >
            <Text style={styles.disabledButtonText}>Continue to Payment</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (!isSavingDate) setDateProvider(undefined)
        }}
        transparent
        visible={Boolean(dateProvider)}
      >
        <View style={styles.calendarOverlay}>
          <View accessibilityViewIsModal style={styles.calendarModal}>
            <View style={styles.calendarHandle} />
            <Text style={styles.calendarEyebrow}>RESOLVE SCHEDULE</Text>
            <Text style={styles.calendarTitle}>Choose a new event date</Text>
            <Text style={styles.calendarSubtitle}>
              We&apos;ll recheck every selected provider after you confirm.
            </Text>

            <View style={styles.monthHeader}>
              <Pressable
                accessibilityLabel="Previous month"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canGoToPreviousMonth }}
                disabled={!canGoToPreviousMonth}
                onPress={() =>
                  setVisibleMonth(
                    (month) => new Date(month.getFullYear(), month.getMonth() - 1, 1)
                  )
                }
                style={({ pressed }) => [
                  styles.monthButton,
                  !canGoToPreviousMonth && styles.monthButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.monthButtonText}>{'‹'}</Text>
              </Pressable>
              <Text style={styles.monthLabel}>
                {new Intl.DateTimeFormat('en-PH', {
                  month: 'long',
                  year: 'numeric',
                }).format(visibleMonth)}
              </Text>
              <Pressable
                accessibilityLabel="Next month"
                accessibilityRole="button"
                onPress={() =>
                  setVisibleMonth(
                    (month) => new Date(month.getFullYear(), month.getMonth() + 1, 1)
                  )
                }
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Text style={styles.monthButtonText}>{'›'}</Text>
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {weekdays.map((weekday) => (
                <Text key={weekday} style={styles.weekdayLabel}>{weekday}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {Array.from({ length: leadingDays }, (_, index) => (
                <View key={`blank-${index}`} style={styles.calendarDay} />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const date = new Date(
                  visibleMonth.getFullYear(),
                  visibleMonth.getMonth(),
                  index + 1
                )
                const disabled = date < today
                const selected = isSameDay(date, selectedDate)

                return (
                  <Pressable
                    key={index + 1}
                    accessibilityLabel={new Intl.DateTimeFormat('en-PH', {
                      dateStyle: 'long',
                    }).format(date)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected }}
                    disabled={disabled}
                    onPress={() => {
                      setSelectedDate(date)
                      setDateError('')
                    }}
                    style={({ pressed }) => [
                      styles.calendarDay,
                      selected && styles.calendarDaySelected,
                      disabled && styles.calendarDayDisabled,
                      pressed && styles.calendarDayPressed,
                    ]}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      selected && styles.calendarDayTextSelected,
                      disabled && styles.calendarDayTextDisabled,
                    ]}>
                      {index + 1}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.selectedDateBanner}>
              <Text style={styles.selectedDateLabel}>NEW EVENT DATE</Text>
              <Text style={styles.selectedDateValue}>
                {new Intl.DateTimeFormat('en-PH', { dateStyle: 'full' }).format(selectedDate)}
              </Text>
            </View>
            {dateError ? <Text style={styles.dateError}>{dateError}</Text> : null}

            <View style={styles.calendarActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSavingDate }}
                disabled={isSavingDate}
                onPress={() => setDateProvider(undefined)}
                style={({ pressed }) => [styles.calendarCancel, pressed && styles.pressed]}
              >
                <Text style={styles.calendarCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSavingDate || dateIsUnchanged }}
                disabled={isSavingDate || dateIsUnchanged}
                onPress={async () => {
                  if (!dateProvider || isSavingDate) return
                  setIsSavingDate(true)
                  const changed = await onConfirmDateChange?.(
                    formatEventDate(selectedDate),
                    dateProvider
                  )
                  setIsSavingDate(false)
                  if (changed === false) {
                    setDateError('Unable to update the event date. Please try again.')
                  } else {
                    setDateProvider(undefined)
                  }
                }}
                style={({ pressed }) => [
                  styles.calendarConfirm,
                  (isSavingDate || dateIsUnchanged) && styles.calendarConfirmDisabled,
                  pressed && styles.calendarConfirmPressed,
                ]}
              >
                <Text style={styles.calendarConfirmText}>
                  {isSavingDate
                    ? 'CHECKING...'
                    : dateIsUnchanged
                      ? 'SELECT A NEW DATE'
                      : 'CONFIRM & RECHECK'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  border: '#E2E2E2',
  burgundy: '#6B1E2E',
  greyLight: '#E5E5E5',
  greyMid: '#8A8A8A',
  secondary: '#544244',
  surface: '#FFFFFF',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#4E061A',
    backgroundColor: '#6B1E2E',
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 448,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
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
  backIcon: { color: '#FFFFFF', fontSize: 27, lineHeight: 29 },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    marginLeft: 4,
  },
  headerSpacer: { width: 24, height: 40 },
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
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 148,
  },
  statusSection: { alignItems: 'center', marginBottom: 32 },
  statusIconCircle: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 32,
    backgroundColor: palette.greyLight,
    marginBottom: 16,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  errorIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: palette.burgundy,
  },
  errorMark: { color: palette.surface, fontSize: 20, lineHeight: 23, fontWeight: '800' },
  statusTitle: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusDescription: {
    maxWidth: 340,
    color: palette.greyMid,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  providerCard: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: 'rgba(229, 229, 229, 0.4)',
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  providerRow: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    backgroundColor: palette.surface,
    padding: 16,
  },
  providerRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  providerCopy: { flex: 1 },
  providerName: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: '600' },
  serviceName: { color: palette.burgundy, fontSize: 12, lineHeight: 17, marginTop: 2 },
  providerDate: {
    color: palette.greyMid,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 4,
  },
  checkIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.burgundy,
  },
  checkMark: { color: palette.surface, fontSize: 15, lineHeight: 18, fontWeight: '800' },
  conflictRow: {
    borderLeftWidth: 4,
    borderLeftColor: palette.burgundy,
    backgroundColor: palette.surface,
    padding: 16,
  },
  conflictHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionRequired: {
    color: palette.burgundy,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 4,
    opacity: 0.8,
  },
  warningIcon: {
    width: 24,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: palette.burgundy,
  },
  warningMark: { color: palette.surface, fontSize: 14, lineHeight: 17, fontWeight: '800' },
  conflictMessage: {
    borderWidth: 1,
    borderColor: palette.greyLight,
    borderRadius: 8,
    backgroundColor: palette.background,
    padding: 12,
    marginTop: 16,
  },
  conflictMessageText: { color: palette.secondary, fontSize: 14, lineHeight: 21 },
  actions: { gap: 12, marginTop: 18 },
  outlineButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.burgundy,
    borderRadius: 8,
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  outlineButtonPressed: { backgroundColor: '#F8F1F3', transform: [{ scale: 0.98 }] },
  outlineButtonText: {
    color: palette.burgundy,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  messageButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  messageButtonText: {
    color: palette.greyMid,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 6,
  },
  footerContent: { width: '100%', maxWidth: 448, alignSelf: 'center', gap: 10 },
  footerHint: { color: palette.greyMid, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  disabledButton: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.greyLight,
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  disabledButtonText: {
    color: palette.greyMid,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  calendarOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26, 10, 15, 0.58)',
  },
  calendarModal: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: palette.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 18,
  },
  calendarHandle: {
    width: 44,
    height: 5,
    alignSelf: 'center',
    borderRadius: 3,
    backgroundColor: palette.greyLight,
    marginBottom: 18,
  },
  calendarEyebrow: {
    color: palette.burgundy,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  calendarTitle: {
    color: palette.text,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  calendarSubtitle: {
    color: palette.greyMid,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 5,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 14,
  },
  monthButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    backgroundColor: palette.background,
  },
  monthButtonDisabled: { opacity: 0.32 },
  monthButtonText: { color: palette.burgundy, fontSize: 28, lineHeight: 30 },
  monthLabel: {
    color: palette.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  weekdayRow: { flexDirection: 'row', marginBottom: 5 },
  weekdayLabel: {
    width: `${100 / 7}%`,
    color: palette.greyMid,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  calendarDaySelected: { backgroundColor: palette.burgundy },
  calendarDayDisabled: { opacity: 0.25 },
  calendarDayPressed: { backgroundColor: '#F8EDEF' },
  calendarDayText: { color: palette.text, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  calendarDayTextSelected: { color: palette.surface, fontWeight: '800' },
  calendarDayTextDisabled: { color: palette.greyMid },
  selectedDateBanner: {
    borderWidth: 1,
    borderColor: '#DAC0C2',
    borderRadius: 12,
    backgroundColor: '#FFF7F8',
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 14,
  },
  selectedDateLabel: {
    color: palette.burgundy,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  selectedDateValue: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 2,
  },
  dateError: {
    color: '#BA1A1A',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 8,
  },
  calendarActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  calendarCancel: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DAC0C2',
    borderRadius: 25,
    backgroundColor: palette.surface,
  },
  calendarCancelText: {
    color: palette.burgundy,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  calendarConfirm: {
    minHeight: 50,
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 14,
  },
  calendarConfirmPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  calendarConfirmDisabled: { opacity: 0.6 },
  calendarConfirmText: {
    color: palette.surface,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  pressed: { opacity: 0.55 },
})
