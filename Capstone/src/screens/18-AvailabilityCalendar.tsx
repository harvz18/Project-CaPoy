import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

export type AvailabilityStatus = 'available' | 'unavailable' | 'booked'

export interface AvailabilityEntry {
  bookingLabel?: string
  date: string
  status: AvailabilityStatus
}

export interface AvailabilityCalendarValue {
  entries: AvailabilityEntry[]
}

interface AvailabilityCalendarScreenProps {
  disablePastDates?: boolean
  initialEntries?: AvailabilityEntry[]
  initialMonth?: Date | string
  isSaving?: boolean
  onBack?: () => void
  onMonthChange?: (month: Date) => void
  onOpenAccount?: () => void
  onSave?: (value: AvailabilityCalendarValue) => void
  onSelectDate?: (date: string) => void
}

interface CalendarDay {
  date: Date
  dateKey: string
  dayNumber: number
  isCurrentMonth: boolean
}

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const padNumber = (value: number) => String(value).padStart(2, '0')

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`

const fromDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

const resolveInitialMonth = (value?: Date | string) => {
  const date = value instanceof Date ? value : value ? fromDateKey(value) : new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

const buildCalendarDays = (month: Date): CalendarDay[] => {
  const calendarStart = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  )

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      calendarStart.getFullYear(),
      calendarStart.getMonth(),
      calendarStart.getDate() + index
    )

    return {
      date,
      dateKey: toDateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth:
        date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth(),
    }
  })
}

const buildEntryMap = (entries: AvailabilityEntry[]) =>
  entries.reduce<Record<string, AvailabilityEntry>>((map, entry) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      map[entry.date] = { ...entry }
    }
    return map
  }, {})

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const AccountIcon = () => (
  <View style={styles.accountIcon}>
    <View style={styles.accountHead} />
    <View style={styles.accountShoulders} />
  </View>
)

const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <View
    style={[
      styles.chevronIcon,
      direction === 'left' ? styles.chevronIconLeft : styles.chevronIconRight,
    ]}
  />
)

export const AvailabilityCalendarScreen: React.FC<AvailabilityCalendarScreenProps> = ({
  disablePastDates = true,
  initialEntries = [],
  initialMonth,
  isSaving = false,
  onBack,
  onMonthChange,
  onOpenAccount,
  onSave,
  onSelectDate,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const today = new Date()
  const todayKey = toDateKey(today)
  const [visibleMonth, setVisibleMonth] = React.useState(() => resolveInitialMonth(initialMonth))
  const [selectedDateKey, setSelectedDateKey] = React.useState(todayKey)
  const [entriesByDate, setEntriesByDate] = React.useState(() => buildEntryMap(initialEntries))
  const [hasChanges, setHasChanges] = React.useState(false)

  const calendarDays = React.useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])
  const selectedDate = fromDateKey(selectedDateKey)
  const selectedEntry = entriesByDate[selectedDateKey]
  const selectedStatus = selectedEntry?.status ?? 'available'
  const selectedIsPast = selectedDateKey < todayKey
  const selectedIsReadOnly = selectedStatus === 'booked' || (disablePastDates && selectedIsPast)

  const monthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
  }).format(visibleMonth)
  const selectedDateLabel = new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(selectedDate)

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1
    )
    setVisibleMonth(nextMonth)
    onMonthChange?.(nextMonth)
  }

  const showToday = () => {
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    setVisibleMonth(thisMonth)
    setSelectedDateKey(todayKey)
    onMonthChange?.(thisMonth)
    onSelectDate?.(todayKey)
  }

  const selectDay = (day: CalendarDay) => {
    const isPast = day.dateKey < todayKey
    if (disablePastDates && isPast) return

    setSelectedDateKey(day.dateKey)
    onSelectDate?.(day.dateKey)

    if (!day.isCurrentMonth) {
      const nextMonth = new Date(day.date.getFullYear(), day.date.getMonth(), 1)
      setVisibleMonth(nextMonth)
      onMonthChange?.(nextMonth)
    }
  }

  const setSelectedStatus = (status: Extract<AvailabilityStatus, 'available' | 'unavailable'>) => {
    if (selectedIsReadOnly || selectedStatus === status) return

    setEntriesByDate((current) => ({
      ...current,
      [selectedDateKey]: { date: selectedDateKey, status },
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    const entries = Object.values(entriesByDate).sort((first, second) =>
      first.date.localeCompare(second.date)
    )
    onSave?.({ entries })
    setHasChanges(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <BackIcon />
          </Pressable>

          <Text numberOfLines={1} style={styles.topAppBarTitle}>
            Availability Calendar
          </Text>

          <Pressable
            accessibilityLabel="Open account"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenAccount}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <AccountIcon />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>Manage Availability</Text>
          <Text style={styles.subtitle}>
            Keep your calendar current so clients only request dates you can accept.
          </Text>
        </View>

        <View style={[styles.workspace, isWide && styles.workspaceWide]}>
          <View style={styles.calendarColumn}>
            <View style={styles.calendarCard}>
              <View style={styles.monthHeader}>
                <Pressable
                  accessibilityLabel="Show previous month"
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => changeMonth(-1)}
                  style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}
                >
                  <ChevronIcon direction="left" />
                </Pressable>

                <View style={styles.monthTitleGroup}>
                  <Text accessibilityRole="header" style={styles.monthTitle}>
                    {monthLabel}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={4}
                    onPress={showToday}
                    style={({ pressed }) => pressed && styles.todayButtonPressed}
                  >
                    <Text style={styles.todayButtonText}>Today</Text>
                  </Pressable>
                </View>

                <Pressable
                  accessibilityLabel="Show next month"
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => changeMonth(1)}
                  style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}
                >
                  <ChevronIcon direction="right" />
                </Pressable>
              </View>

              <View style={styles.weekHeader}>
                {weekDays.map((day) => (
                  <Text key={day} style={styles.weekDay}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((day) => {
                  const entry = entriesByDate[day.dateKey]
                  const status = entry?.status ?? 'available'
                  const isSelected = day.dateKey === selectedDateKey
                  const isToday = day.dateKey === todayKey
                  const isPast = day.dateKey < todayKey
                  const isDisabled = disablePastDates && isPast

                  return (
                    <View key={day.dateKey} style={styles.dateCellWrapper}>
                      <Pressable
                        accessibilityLabel={`${new Intl.DateTimeFormat('en-PH', {
                          dateStyle: 'full',
                        }).format(day.date)}, ${status}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isDisabled, selected: isSelected }}
                        disabled={isDisabled}
                        onPress={() => selectDay(day)}
                        style={({ pressed }) => [
                          styles.dateCell,
                          status === 'unavailable' && styles.dateCellUnavailable,
                          status === 'booked' && styles.dateCellBooked,
                          isSelected && styles.dateCellSelected,
                          pressed && styles.dateCellPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateNumber,
                            !day.isCurrentMonth && styles.dateNumberOutside,
                            isDisabled && styles.dateNumberDisabled,
                            status === 'booked' && styles.dateNumberBooked,
                            isToday && status !== 'booked' && styles.dateNumberToday,
                          ]}
                        >
                          {day.dayNumber}
                        </Text>
                        {!isDisabled ? (
                          <View
                            style={[
                              styles.statusDot,
                              status === 'available' && styles.statusDotAvailable,
                              status === 'unavailable' && styles.statusDotUnavailable,
                              status === 'booked' && styles.statusDotBooked,
                            ]}
                          />
                        ) : null}
                      </Pressable>
                    </View>
                  )
                })}
              </View>
            </View>

            <View style={styles.legend}>
              <LegendItem color={palette.available} label="Available" />
              <LegendItem color={palette.unavailable} label="Unavailable" />
              <LegendItem color={palette.primaryContainer} label="Booked" />
            </View>
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.detailsEyebrow}>SELECTED DATE</Text>
            <Text style={styles.detailsDate}>{selectedDateLabel}</Text>

            {selectedStatus === 'booked' ? (
              <View style={styles.bookingNotice}>
                <View style={styles.bookingNoticeIcon}>
                  <Text style={styles.bookingNoticeCheck}>{'\u2713'}</Text>
                </View>
                <View style={styles.bookingNoticeCopy}>
                  <Text style={styles.bookingNoticeTitle}>Confirmed booking</Text>
                  <Text style={styles.bookingNoticeText}>
                    {selectedEntry?.bookingLabel ?? 'This date is reserved for a client event.'}
                  </Text>
                </View>
              </View>
            ) : selectedIsPast && disablePastDates ? (
              <View style={styles.pastNotice}>
                <Text style={styles.pastNoticeText}>Past dates cannot be changed.</Text>
              </View>
            ) : (
              <View style={styles.statusEditor}>
                <Text style={styles.statusEditorLabel}>Availability</Text>
                <View accessibilityRole="radiogroup" style={styles.statusChoices}>
                  <StatusChoice
                    description="Clients can request this date."
                    label="Available"
                    onPress={() => setSelectedStatus('available')}
                    selected={selectedStatus === 'available'}
                    status="available"
                  />
                  <StatusChoice
                    description="Hide this date from new requests."
                    label="Unavailable"
                    onPress={() => setSelectedStatus('unavailable')}
                    selected={selectedStatus === 'unavailable'}
                    status="unavailable"
                  />
                </View>
              </View>
            )}

            <View style={styles.detailsTip}>
              <Text style={styles.detailsTipTitle}>Calendar tip</Text>
              <Text style={styles.detailsTipText}>
                Confirmed bookings are locked automatically to prevent scheduling conflicts.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.footerContent, isWide && styles.wideHorizontalPadding]}>
          <Text style={styles.unsavedText}>
            {hasChanges ? 'You have unsaved changes.' : 'Your availability is up to date.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasChanges || isSaving }}
            disabled={!hasChanges || isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              (!hasChanges || isSaving) && styles.saveButtonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
          >
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
)

interface StatusChoiceProps {
  description: string
  label: string
  onPress: () => void
  selected: boolean
  status: Extract<AvailabilityStatus, 'available' | 'unavailable'>
}

const StatusChoice: React.FC<StatusChoiceProps> = ({
  description,
  label,
  onPress,
  selected,
  status,
}) => (
  <Pressable
    accessibilityLabel={`${label}. ${description}`}
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    onPress={onPress}
    style={({ pressed }) => [
      styles.statusChoice,
      selected && styles.statusChoiceSelected,
      pressed && styles.statusChoicePressed,
    ]}
  >
    <View
      style={[
        styles.statusChoiceIcon,
        status === 'available'
          ? styles.statusChoiceIconAvailable
          : styles.statusChoiceIconUnavailable,
      ]}
    >
      <View
        style={[
          styles.statusChoiceIconDot,
          {
            backgroundColor:
              status === 'available' ? palette.available : palette.unavailable,
          },
        ]}
      />
    </View>
    <View style={styles.statusChoiceCopy}>
      <Text style={[styles.statusChoiceLabel, selected && styles.statusChoiceLabelSelected]}>
        {label}
      </Text>
      <Text style={styles.statusChoiceDescription}>{description}</Text>
    </View>
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  </Pressable>
)

const palette = {
  available: '#2F6B46',
  availableSoft: '#E8F3EC',
  background: '#FAF9F9',
  border: '#E3E2E2',
  onPrimary: '#FFFFFF',
  placeholder: '#A8A8A9',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerHigh: '#E9E8E8',
  surfaceContainerLow: '#F5F3F3',
  text: '#1B1C1C',
  unavailable: '#8A8586',
  unavailableSoft: '#EFeded',
  white: '#FFFFFF',
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  topAppBarTitle: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  iconButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.72 },
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
  accountIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    borderWidth: 1.7,
    borderColor: palette.primary,
    borderRadius: 12,
  },
  accountHead: {
    position: 'absolute',
    top: 4,
    width: 7,
    height: 7,
    borderWidth: 1.5,
    borderColor: palette.primary,
    borderRadius: 4,
  },
  accountShoulders: {
    position: 'absolute',
    bottom: 3,
    width: 14,
    height: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: palette.primary,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  content: { width: '100%', maxWidth: 1024, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 40 },
  intro: { width: '100%', maxWidth: 768, alignSelf: 'center', marginBottom: 24 },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  workspace: { width: '100%', maxWidth: 768, alignSelf: 'center', gap: 20 },
  workspaceWide: {
    maxWidth: 960,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  calendarColumn: { minWidth: 0, flex: 1.2, gap: 12 },
  calendarCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.white,
    padding: 12,
  },
  monthHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  monthButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  monthButtonPressed: { backgroundColor: palette.surfaceContainerLow },
  chevronIcon: {
    width: 9,
    height: 9,
    borderTopWidth: 1.8,
    borderColor: palette.primary,
  },
  chevronIconLeft: { borderLeftWidth: 1.8, transform: [{ rotate: '-45deg' }] },
  chevronIconRight: { borderRightWidth: 1.8, transform: [{ rotate: '45deg' }] },
  monthTitleGroup: { alignItems: 'center' },
  monthTitle: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  todayButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, marginTop: 2 },
  todayButtonPressed: { opacity: 0.55 },
  weekHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.border },
  weekDay: {
    width: '14.285714%',
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 6 },
  dateCellWrapper: { width: '14.285714%', padding: 2 },
  dateCell: {
    width: '100%',
    maxWidth: 52,
    aspectRatio: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 8,
  },
  dateCellUnavailable: { backgroundColor: palette.unavailableSoft },
  dateCellBooked: { backgroundColor: palette.primaryContainer },
  dateCellSelected: { borderColor: palette.primaryContainer },
  dateCellPressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
  dateNumber: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  dateNumberOutside: { color: palette.placeholder },
  dateNumberDisabled: { color: '#D2D0D0' },
  dateNumberBooked: { color: palette.onPrimary, fontWeight: '600' },
  dateNumberToday: { color: palette.primaryContainer, fontWeight: '700' },
  statusDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
  statusDotAvailable: { backgroundColor: palette.available },
  statusDotUnavailable: { backgroundColor: palette.unavailable },
  statusDotBooked: { backgroundColor: palette.onPrimary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  detailsCard: {
    minWidth: 0,
    flex: 0.8,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.white,
    padding: 20,
  },
  detailsEyebrow: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  detailsDate: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '600', marginTop: 4 },
  statusEditor: { marginTop: 24 },
  statusEditorLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginBottom: 8 },
  statusChoices: { gap: 8 },
  statusChoice: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    padding: 12,
  },
  statusChoiceSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primarySoft },
  statusChoicePressed: { opacity: 0.72 },
  statusChoiceIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  statusChoiceIconAvailable: { backgroundColor: palette.availableSoft },
  statusChoiceIconUnavailable: { backgroundColor: palette.unavailableSoft },
  statusChoiceIconDot: { width: 10, height: 10, borderRadius: 5 },
  statusChoiceCopy: { minWidth: 0, flex: 1 },
  statusChoiceLabel: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  statusChoiceLabelSelected: { color: palette.primaryContainer },
  statusChoiceDescription: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 1 },
  radio: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.placeholder,
    borderRadius: 9,
  },
  radioSelected: { borderColor: palette.primaryContainer },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primaryContainer },
  bookingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 8,
    backgroundColor: palette.primarySoft,
    padding: 14,
    marginTop: 20,
  },
  bookingNoticeIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.primaryContainer,
  },
  bookingNoticeCheck: { color: palette.onPrimary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  bookingNoticeCopy: { minWidth: 0, flex: 1 },
  bookingNoticeTitle: { color: palette.primaryContainer, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  bookingNoticeText: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  pastNotice: { borderRadius: 8, backgroundColor: palette.surfaceContainerLow, padding: 14, marginTop: 20 },
  pastNoticeText: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  detailsTip: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 16, marginTop: 24 },
  detailsTipTitle: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  detailsTipText: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  footer: {
    zIndex: 30,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
  },
  footerContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  unsavedText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 12, lineHeight: 17 },
  saveButton: {
    minWidth: 148,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  saveButtonText: { color: palette.onPrimary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
})
