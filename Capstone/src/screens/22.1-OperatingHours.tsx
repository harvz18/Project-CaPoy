import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

export type OperatingDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface OperatingHoursEntry {
  closeTime?: string
  day: OperatingDay
  isOpen: boolean
  openTime?: string
}

export interface OperatingHoursValue {
  hours: OperatingHoursEntry[]
  timezone: string
}

interface OperatingHoursScreenProps {
  initialHours?: OperatingHoursEntry[]
  isSaving?: boolean
  onBack?: () => void
  onOpenAvailabilityCalendar?: () => void
  onSave?: (value: OperatingHoursValue) => void
  onSelectTimezone?: () => void
  timezone?: string
}

interface EditableHoursEntry {
  closeInput: string
  day: OperatingDay
  isOpen: boolean
  openInput: string
}

const dayOptions: Array<{ id: OperatingDay; label: string; shortLabel: string }> = [
  { id: 'monday', label: 'Monday', shortLabel: 'Mon' },
  { id: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
  { id: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
  { id: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
  { id: 'friday', label: 'Friday', shortLabel: 'Fri' },
  { id: 'saturday', label: 'Saturday', shortLabel: 'Sat' },
  { id: 'sunday', label: 'Sunday', shortLabel: 'Sun' },
]

const defaultHours: OperatingHoursEntry[] = dayOptions.map(({ id }) => ({
  day: id,
  isOpen: id !== 'sunday',
  openTime: id !== 'sunday' ? '09:00' : undefined,
  closeTime: id === 'saturday' ? '15:00' : id !== 'sunday' ? '18:00' : undefined,
}))

const parseTime = (value: string) => {
  const trimmedValue = value.trim()
  const twelveHourMatch = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i.exec(trimmedValue)

  if (twelveHourMatch) {
    const hour = Number(twelveHourMatch[1])
    const minute = Number(twelveHourMatch[2])
    const meridiem = twelveHourMatch[3].toUpperCase()

    if (hour < 1 || hour > 12) return undefined
    const normalizedHour = (hour % 12) + (meridiem === 'PM' ? 12 : 0)
    return normalizedHour * 60 + minute
  }

  const twentyFourHourMatch = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmedValue)
  if (!twentyFourHourMatch) return undefined

  return Number(twentyFourHourMatch[1]) * 60 + Number(twentyFourHourMatch[2])
}

const toDisplayTime = (minutes: number) => {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const displayHour = hour % 12 || 12
  const meridiem = hour >= 12 ? 'PM' : 'AM'
  return `${displayHour}:${String(minute).padStart(2, '0')} ${meridiem}`
}

const toStorageTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const createEditableHours = (initialHours: OperatingHoursEntry[]) => {
  const suppliedHours = new Map(initialHours.map((entry) => [entry.day, entry]))

  return defaultHours.map((fallback): EditableHoursEntry => {
    const entry = suppliedHours.get(fallback.day) ?? fallback
    const openMinutes = parseTime(entry.openTime ?? '') ?? 9 * 60
    const closeMinutes = parseTime(entry.closeTime ?? '') ?? 18 * 60

    return {
      closeInput: toDisplayTime(closeMinutes),
      day: entry.day,
      isOpen: entry.isOpen,
      openInput: toDisplayTime(openMinutes),
    }
  })
}

const getEntryError = (entry: EditableHoursEntry) => {
  if (!entry.isOpen) return undefined

  const openMinutes = parseTime(entry.openInput)
  const closeMinutes = parseTime(entry.closeInput)

  if (openMinutes === undefined || closeMinutes === undefined) {
    return 'Use a valid time such as 9:00 AM.'
  }

  if (closeMinutes <= openMinutes) {
    return 'Closing time must be later than opening time.'
  }

  return undefined
}

const normalizeHours = (schedule: EditableHoursEntry[]): OperatingHoursEntry[] | undefined => {
  if (schedule.some(getEntryError)) return undefined

  return schedule.map((entry) => {
    if (!entry.isOpen) return { day: entry.day, isOpen: false }

    const openMinutes = parseTime(entry.openInput)
    const closeMinutes = parseTime(entry.closeInput)
    if (openMinutes === undefined || closeMinutes === undefined) {
      return { day: entry.day, isOpen: false }
    }

    return {
      closeTime: toStorageTime(closeMinutes),
      day: entry.day,
      isOpen: true,
      openTime: toStorageTime(openMinutes),
    }
  })
}

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

export const OperatingHoursScreen: React.FC<OperatingHoursScreenProps> = ({
  initialHours = defaultHours,
  isSaving = false,
  onBack,
  onOpenAvailabilityCalendar,
  onSave,
  onSelectTimezone,
  timezone = 'Asia/Manila (GMT+8)',
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const isCompact = width < 430
  const [schedule, setSchedule] = React.useState(() => createEditableHours(initialHours))
  const [submitted, setSubmitted] = React.useState(false)
  const [hasChanges, setHasChanges] = React.useState(false)

  const errors = React.useMemo(
    () =>
      schedule.reduce<Partial<Record<OperatingDay, string>>>((result, entry) => {
        const error = getEntryError(entry)
        if (error) result[entry.day] = error
        return result
      }, {}),
    [schedule]
  )
  const openDayCount = schedule.filter((entry) => entry.isOpen).length

  const updateEntry = (day: OperatingDay, updates: Partial<EditableHoursEntry>) => {
    setSchedule((current) =>
      current.map((entry) => (entry.day === day ? { ...entry, ...updates } : entry))
    )
    setHasChanges(true)
  }

  const normalizeInput = (day: OperatingDay, field: 'openInput' | 'closeInput') => {
    const entry = schedule.find((item) => item.day === day)
    if (!entry) return

    const minutes = parseTime(entry[field])
    if (minutes !== undefined) updateEntry(day, { [field]: toDisplayTime(minutes) })
  }

  const copyMondayHours = (destination: 'weekdays' | 'all') => {
    const monday = schedule.find((entry) => entry.day === 'monday')
    if (!monday) return

    const targetDays: OperatingDay[] =
      destination === 'weekdays'
        ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        : dayOptions.map((day) => day.id)

    setSchedule((current) =>
      current.map((entry) =>
        targetDays.includes(entry.day)
          ? {
              ...entry,
              closeInput: monday.closeInput,
              isOpen: monday.isOpen,
              openInput: monday.openInput,
            }
          : entry
      )
    )
    setHasChanges(true)
  }

  const handleSave = () => {
    setSubmitted(true)
    const hours = normalizeHours(schedule)
    if (!hours) return

    onSave?.({ hours, timezone })
    setHasChanges(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to merchant profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            Operating Hours
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
          <Text style={styles.title}>Set Your Weekly Hours</Text>
          <Text style={styles.subtitle}>
            Let clients know when your business is available to answer inquiries and provide
            services.
          </Text>
        </View>

        <Pressable
          accessibilityLabel={`Select timezone. Current timezone: ${timezone}`}
          accessibilityRole="button"
          onPress={onSelectTimezone}
          style={({ pressed }) => [styles.timezoneCard, pressed && styles.timezoneCardPressed]}
        >
          <View style={styles.clockIcon}>
            <View style={styles.clockHourHand} />
            <View style={styles.clockMinuteHand} />
          </View>
          <View style={styles.timezoneCopy}>
            <Text style={styles.timezoneLabel}>TIMEZONE</Text>
            <Text style={styles.timezoneValue}>{timezone}</Text>
          </View>
          <Text style={styles.chevron}>{'\u203A'}</Text>
        </Pressable>

        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View>
              <Text style={styles.sectionTitle}>Regular Hours</Text>
              <Text style={styles.sectionSubtitle}>
                {openDayCount} {openDayCount === 1 ? 'day' : 'days'} open each week
              </Text>
            </View>
            <View style={styles.openBadge}>
              <View style={styles.openBadgeDot} />
              <Text style={styles.openBadgeText}>{openDayCount} OPEN</Text>
            </View>
          </View>

          <View style={styles.copyActions}>
            <Text style={styles.copyLabel}>Copy Monday:</Text>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => copyMondayHours('weekdays')}
              style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
            >
              <Text style={styles.copyButtonText}>To weekdays</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => copyMondayHours('all')}
              style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
            >
              <Text style={styles.copyButtonText}>To all days</Text>
            </Pressable>
          </View>

          <View style={styles.dayList}>
            {schedule.map((entry, index) => {
              const day = dayOptions.find((option) => option.id === entry.day)
              const error = submitted ? errors[entry.day] : undefined

              return (
                <View
                  key={entry.day}
                  style={[
                    styles.dayRow,
                    index < schedule.length - 1 && styles.dayRowBorder,
                    isCompact && styles.dayRowCompact,
                  ]}
                >
                  <View style={[styles.dayIdentity, isCompact && styles.dayIdentityCompact]}>
                    <Pressable
                      accessibilityLabel={`${day?.label ?? entry.day} is ${entry.isOpen ? 'open' : 'closed'}`}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: entry.isOpen, disabled: isSaving }}
                      disabled={isSaving}
                      onPress={() => updateEntry(entry.day, { isOpen: !entry.isOpen })}
                      style={({ pressed }) => [pressed && styles.switchPressed]}
                    >
                      <View style={[styles.switchTrack, entry.isOpen && styles.switchTrackActive]}>
                        <View
                          style={[
                            styles.switchThumb,
                            entry.isOpen && styles.switchThumbActive,
                          ]}
                        />
                      </View>
                    </Pressable>
                    <Text style={styles.dayLabel}>
                      {isCompact ? day?.shortLabel : day?.label}
                    </Text>
                  </View>

                  {entry.isOpen ? (
                    <View style={styles.timeEditor}>
                      <TextInput
                        accessibilityLabel={`${day?.label} opening time`}
                        autoCapitalize="characters"
                        editable={!isSaving}
                        maxLength={8}
                        onBlur={() => normalizeInput(entry.day, 'openInput')}
                        onChangeText={(value) => updateEntry(entry.day, { openInput: value })}
                        placeholder="9:00 AM"
                        placeholderTextColor={palette.placeholder}
                        selectTextOnFocus
                        style={[styles.timeInput, error && styles.timeInputError]}
                        value={entry.openInput}
                      />
                      <Text style={styles.timeSeparator}>to</Text>
                      <TextInput
                        accessibilityLabel={`${day?.label} closing time`}
                        autoCapitalize="characters"
                        editable={!isSaving}
                        maxLength={8}
                        onBlur={() => normalizeInput(entry.day, 'closeInput')}
                        onChangeText={(value) => updateEntry(entry.day, { closeInput: value })}
                        placeholder="6:00 PM"
                        placeholderTextColor={palette.placeholder}
                        selectTextOnFocus
                        style={[styles.timeInput, error && styles.timeInputError]}
                        value={entry.closeInput}
                      />
                    </View>
                  ) : (
                    <View style={styles.closedBadge}>
                      <Text style={styles.closedBadgeText}>Closed</Text>
                    </View>
                  )}

                  {error ? (
                    <Text accessibilityRole="alert" style={styles.errorText}>
                      {error}
                    </Text>
                  ) : null}
                </View>
              )
            })}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onOpenAvailabilityCalendar}
          style={({ pressed }) => [styles.availabilityCard, pressed && styles.availabilityCardPressed]}
        >
          <View style={styles.calendarIcon}>
            <View style={styles.calendarRule} />
            <View style={styles.calendarDots}>
              <View style={styles.calendarDot} />
              <View style={styles.calendarDot} />
            </View>
          </View>
          <View style={styles.availabilityCopy}>
            <Text style={styles.availabilityTitle}>Date-specific availability</Text>
            <Text style={styles.availabilityDescription}>
              Block holidays, booked dates, and one-time schedule changes in your calendar.
            </Text>
          </View>
          <Text style={styles.chevron}>{'\u203A'}</Text>
        </Pressable>

        <View style={styles.infoNotice}>
          <Text style={styles.infoNoticeTitle}>How operating hours are used</Text>
          <Text style={styles.infoNoticeText}>
            Weekly hours appear on your public profile. Confirmed bookings and blocked calendar
            dates still take priority over this schedule.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.footerContent, isWide && styles.wideHorizontalPadding]}>
          <Text style={styles.changeStatus}>
            {hasChanges ? 'You have unsaved changes.' : 'Your weekly hours are up to date.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isSaving, disabled: !hasChanges || isSaving }}
            disabled={!hasChanges || isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              (!hasChanges || isSaving) && styles.saveButtonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
          >
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Hours'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  error: '#BA1A1A',
  onPrimary: '#FFFFFF',
  placeholder: '#A8A8A9',
  positive: '#2F6B46',
  positiveSoft: '#E7F3EB',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerLow: '#F5F3F3',
  text: '#1B1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 30,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 820,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.72 },
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
  headerTitle: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 120 },
  intro: { marginBottom: 22 },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { maxWidth: 600, color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 5 },
  timezoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
    padding: 14,
    marginBottom: 16,
  },
  timezoneCardPressed: { backgroundColor: palette.surfaceContainerLow },
  clockIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.primaryContainer,
    borderRadius: 18,
    backgroundColor: palette.primarySoft,
  },
  clockHourHand: { position: 'absolute', width: 1.5, height: 8, top: 9, borderRadius: 1, backgroundColor: palette.primaryContainer },
  clockMinuteHand: { position: 'absolute', width: 8, height: 1.5, top: 16, left: 17, borderRadius: 1, backgroundColor: palette.primaryContainer },
  timezoneCopy: { minWidth: 0, flex: 1 },
  timezoneLabel: { color: palette.secondary, fontSize: 10, lineHeight: 14, letterSpacing: 0.7 },
  timezoneValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 1 },
  chevron: { color: palette.secondary, fontSize: 28, lineHeight: 30, fontWeight: '300' },
  scheduleCard: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: 16 },
  sectionTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '600' },
  sectionSubtitle: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  openBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: palette.positiveSoft, paddingHorizontal: 9, paddingVertical: 5 },
  openBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.positive },
  openBadgeText: { color: palette.positive, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.5 },
  copyActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceContainerLow, paddingHorizontal: 16, paddingVertical: 10 },
  copyLabel: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  copyButton: { borderRadius: 6, backgroundColor: palette.white, paddingHorizontal: 9, paddingVertical: 5 },
  copyButtonPressed: { backgroundColor: palette.primarySoft },
  copyButtonText: { color: palette.primaryContainer, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  dayList: { paddingHorizontal: 16 },
  dayRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dayRowCompact: { gap: 8 },
  dayRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  dayIdentity: { width: 142, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayIdentityCompact: { width: 86 },
  switchTrack: { width: 42, height: 24, justifyContent: 'center', borderRadius: 12, backgroundColor: palette.border, paddingHorizontal: 3 },
  switchTrackActive: { backgroundColor: palette.primaryContainer },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: palette.white },
  switchThumbActive: { alignSelf: 'flex-end' },
  switchPressed: { opacity: 0.65 },
  dayLabel: { color: palette.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  timeEditor: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  timeInput: { minWidth: 74, minHeight: 40, flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 7, backgroundColor: palette.background, color: palette.text, fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 6, paddingVertical: 8 },
  timeInputError: { borderColor: palette.error },
  timeSeparator: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  closedBadge: { minHeight: 36, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: palette.surfaceContainerLow },
  closedBadgeText: { color: palette.secondary, fontSize: 12, lineHeight: 17, fontWeight: '500' },
  errorText: { position: 'absolute', left: 170, bottom: 1, color: palette.error, fontSize: 9, lineHeight: 12 },
  availabilityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white, padding: 15, marginTop: 16 },
  availabilityCardPressed: { backgroundColor: palette.surfaceContainerLow },
  calendarIcon: { width: 36, height: 34, overflow: 'hidden', borderWidth: 1.5, borderColor: palette.primaryContainer, borderRadius: 5 },
  calendarRule: { width: '100%', height: 1.5, backgroundColor: palette.primaryContainer, marginTop: 8 },
  calendarDots: { flexDirection: 'row', gap: 5, marginTop: 6, marginLeft: 7 },
  calendarDot: { width: 5, height: 5, borderRadius: 2, backgroundColor: palette.primaryContainer },
  availabilityCopy: { minWidth: 0, flex: 1 },
  availabilityTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  availabilityDescription: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  infoNotice: { borderLeftWidth: 3, borderLeftColor: palette.primaryContainer, borderRadius: 7, backgroundColor: palette.primarySoft, padding: 14, marginTop: 16 },
  infoNoticeTitle: { color: palette.primaryContainer, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  infoNoticeText: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  footer: { zIndex: 40, width: '100%', borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.background },
  footerContent: { width: '100%', maxWidth: 820, minHeight: 78, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingVertical: 14 },
  changeStatus: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 11, lineHeight: 16 },
  saveButton: { minWidth: 132, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: palette.primaryContainer, paddingHorizontal: 20 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  saveButtonText: { color: palette.onPrimary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
})
