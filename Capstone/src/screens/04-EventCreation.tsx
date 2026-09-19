import { Text } from '../components/AppText'
import React from 'react'
import {
  Image,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TextStyle,
  useWindowDimensions,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

export type EventType = 'wedding' | 'preWedding' | 'postWedding'
export type VenueStatus = 'secured' | 'searching'

export interface EventCreationValue {
  date: string
  eventName: string
  eventType: EventType
  guestCount: number
  time: string
  venueStatus: VenueStatus
  weddingThemes?: string[]
}

interface EventCreationScreenProps {
  initialValue?: Partial<EventCreationValue>
  onClose?: () => void
  onContinue?: (value: EventCreationValue) => void
  onSaveExit?: (value: EventCreationValue) => void
}

const venueOptions = [
  {
    id: 'secured' as const,
    icon: <MaterialIcons name="assured-workload" size={23} />,
    title: 'Venue Secured',
    description: 'I have a confirmed location for this event.',
  },
  {
    id: 'searching' as const,
    icon: <MaterialIcons name="youtube-searched-for" size={23} />,
    title: 'Still Searching',
    description: 'I need to find or decide on a location.',
  },
]

const weddingThemes = ['Minimalist', 'Rustic', 'Garden', 'Classic', 'Modern', 'Beach', 'Glam']

const tipImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBN6x8Mx5zGHTD6IUyLqfk50QbAV-Dq_o6n1Enaq7AusFv1NnMCxYBi0buj801mTGgF7ik3QFivj2rQeGMjXrjptQ6nWOWxpil8cSFaiGfQ79kC9IIW2Jw1dSgsd1IpNCQzZUBkMjoeI_8PbNUsPPCfmvb5L7F7JenBBEY4QpYJe8FcwPrci6W4vHuD5rsSFk_v-xKjQy_eOgKNO7bWrx2GzC1QXPsn3MqYevozfV8UX9XJkZATyrsrCw'

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)
const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1)
const yearStart = new Date().getFullYear()
const yearOptions = Array.from({ length: 8 }, (_, index) => yearStart + index)
const hourOptions = Array.from({ length: 12 }, (_, index) => index + 1)
const minuteOptions = ['00', '15', '30', '45'] as const
const meridiemOptions = ['AM', 'PM'] as const

type Meridiem = (typeof meridiemOptions)[number]

const padTwo = (value: number) => value.toString().padStart(2, '0')

const parseDateParts = (value: string) => {
  const [rawMonth, rawDay, rawYear] = value.split('/').map((part) => Number.parseInt(part, 10))
  const month = Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : 1
  const day = Number.isInteger(rawDay) && rawDay >= 1 && rawDay <= 31 ? rawDay : 1
  const year = yearOptions.includes(rawYear) ? rawYear : yearStart

  return { day, month, year }
}

const formatDate = (month: number, day: number, year: number) =>
  `${padTwo(month)}/${padTwo(day)}/${year}`

const parseTimeParts = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i)
  const rawHour = match ? Number.parseInt(match[1], 10) : 6
  const rawMinute = match?.[2] ?? '00'
  const rawMeridiem = match?.[3]?.toUpperCase() === 'AM' ? 'AM' : 'PM'

  return {
    hour: rawHour >= 1 && rawHour <= 12 ? rawHour : 6,
    minute: minuteOptions.includes(rawMinute as (typeof minuteOptions)[number])
      ? rawMinute
      : '00',
    meridiem: rawMeridiem as Meridiem,
  }
}

const formatTime = (hour: number, minute: string, meridiem: Meridiem) =>
  `${padTwo(hour)}:${minute} ${meridiem}`

export const EventCreationScreen: React.FC<EventCreationScreenProps> = ({
  initialValue,
  onClose,
  onContinue,
  onSaveExit,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [eventName, setEventName] = React.useState(initialValue?.eventName ?? '')
  const eventType: EventType = initialValue?.eventType ?? 'wedding'
  const [date, setDate] = React.useState(initialValue?.date ?? '')
  const [time, setTime] = React.useState(initialValue?.time ?? '')
  const [isEventNameFocused, setIsEventNameFocused] = React.useState(false)
  const [activePicker, setActivePicker] = React.useState<'date' | 'time' | null>(null)
  const [venueStatus, setVenueStatus] = React.useState<VenueStatus>(
    initialValue?.venueStatus ?? 'searching'
  )
  const [guestCount, setGuestCount] = React.useState(initialValue?.guestCount ?? 120)
  const [selectedWeddingThemes, setSelectedWeddingThemes] = React.useState<string[]>(
    initialValue?.weddingThemes ?? []
  )
  const [themeLimitMessage, setThemeLimitMessage] = React.useState(false)
  const themeLimitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (themeLimitTimer.current) {
        clearTimeout(themeLimitTimer.current)
      }
    },
  )

  const toggleWeddingTheme = (theme: string) => {
    if (selectedWeddingThemes.includes(theme)) {
      setSelectedWeddingThemes((current) => current.filter((item) => item !== theme))
      return
    }

    if (selectedWeddingThemes.length >= 2) {
      setThemeLimitMessage(true)
      if (themeLimitTimer.current) {
        clearTimeout(themeLimitTimer.current)
      }
      themeLimitTimer.current = setTimeout(() => setThemeLimitMessage(false), 2200)
      return
    }

    setSelectedWeddingThemes((current) => [...current, theme])
  }

  const value: EventCreationValue = {
    eventName,
    eventType,
    date,
    time,
    venueStatus,
    guestCount,
    weddingThemes: selectedWeddingThemes,
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.topAppBarContentWide]}>
          <View style={styles.desktopTitleGroup}>
            <Pressable
              accessibilityLabel={isWide ? 'Go back' : 'Close event creation'}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.headerButton,
                isWide && styles.headerButtonWide,
                pressed && styles.pressed,
              ]}
            >
              {isWide ? (
                <Text style={styles.headerIcon}>{'\u2190'}</Text>
              ) : (
                <MaterialIcons color={palette.surface} name="cancel" size={24} />
              )}
            </Pressable>
            {isWide && <Text style={styles.desktopTitle}>New Celebration</Text>}
          </View>

          {!isWide && <Text style={styles.mobileTitle}>CREATE EVENT</Text>}

          {isWide ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onSaveExit?.(value)}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            >
              <Text style={styles.saveButtonText}>SAVE & EXIT</Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
      </View>

      <View style={[styles.progressSection, isWide && styles.horizontalPaddingWide]}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressActiveLabel}>BASICS</Text>
          <Text style={styles.progressLabel}>STEP 1 OF 5</Text>
        </View>
        <View style={styles.progressSegments}>
          {Array.from({ length: 5 }, (_, index) => (
            <View
              key={index}
              style={[styles.progressSegment, index === 0 && styles.progressSegmentActive]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainContent, isWide && styles.horizontalPaddingWide]}>
          <View style={[styles.form, isWide && styles.formWide]}>
            <View style={styles.intro}>
              <Text style={[styles.pageTitle, isWide && styles.pageTitleWide]}>
                Let&apos;s start with the basics
              </Text>
              <Text style={styles.pageDescription}>
                Define the foundational elements of this celebration. We&apos;ll build the
                details around these choices.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EVENT NAME</Text>
              <View
                style={[styles.textInputShell, isEventNameFocused && styles.textInputShellFocused]}
              >
                <MaterialIcons
                  accessibilityLabel="Event name"
                  color={palette.burgundy}
                  name="event-note"
                  size={22}
                  style={styles.eventNameIcon}
                />
                <TextInput
                  accessibilityLabel="Event name"
                  onBlur={() => setIsEventNameFocused(false)}
                  onChangeText={setEventName}
                  onFocus={() => setIsEventNameFocused(true)}
                  placeholder="e.g., Lorainne & Oemer's Wedding"
                  placeholderTextColor="#BDBDBD"
                  style={[
                    styles.textInput,
                    styles.textInputWithIcon,
                    Platform.OS === 'web'
                      ? ({ outlineStyle: 'none' } as unknown as TextStyle)
                      : null,
                  ]}
                  value={eventName}
                />
              </View>
            </View>

            <View style={styles.themeSection}>
              <View style={styles.themeLabelRow}>
                <Text style={styles.fieldLabel}>WEDDING THEME</Text>
                <Text style={styles.themeOptionalLabel}>OPTIONAL</Text>
              </View>
              <Text style={styles.themeHelperText}>
                Pick up to 2 — helps us recommend vendors that match your style.
              </Text>
              <View style={styles.themeChipGrid}>
                {weddingThemes.map((theme) => {
                  const selected = selectedWeddingThemes.includes(theme)
                  return (
                    <Pressable
                      key={theme}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleWeddingTheme(theme)}
                      style={({ pressed }) => [
                        styles.themeChip,
                        selected && styles.themeChipSelected,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Text style={[styles.themeChipText, selected && styles.themeChipTextSelected]}>
                        {theme}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              {themeLimitMessage && (
                <Text style={styles.themeLimitMessage}>You can only pick up to 2.</Text>
              )}
            </View>

            <View style={[styles.dateTimeGrid, isWide && styles.dateTimeGridWide]}>
              <PickerField
                icon={
                  <MaterialIcons
                    color={palette.burgundy}
                    name="calendar-month"
                    size={22}
                    style={styles.inputIcon}
                  />
                }
                label="DATE"
                onPress={() => setActivePicker('date')}
                placeholder="MM/DD/YYYY"
                value={date}
              />
              <PickerField
                icon={
                  <MaterialIcons
                    color={palette.burgundy}
                    name="timer"
                    size={22}
                    style={styles.inputIcon}
                  />
                }
                label="TIME"
                onPress={() => setActivePicker('time')}
                placeholder="HH:MM AM"
                value={time}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>VENUE STATUS</Text>
              <View style={[styles.venueGrid, isWide && styles.venueGridWide]}>
                {venueOptions.map((option) => {
                  const selected = venueStatus === option.id
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setVenueStatus(option.id)}
                      style={({ pressed }) => [
                        styles.venueCard,
                        selected && styles.selectionCardActive,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <View style={[styles.venueIconCircle, selected && styles.venueIconSelected]}>
                        {React.isValidElement(option.icon) ? (
                          React.cloneElement(option.icon as React.ReactElement<{ color?: string }>, {
                            color: selected ? palette.surface : palette.burgundyDark,
                          })
                        ) : (
                          <Text style={[styles.venueIcon, selected && styles.venueIconTextSelected]}>
                            {option.icon}
                          </Text>
                        )}
                      </View>
                      <View style={styles.venueCopy}>
                        <Text style={styles.venueTitle}>{option.title}</Text>
                        <Text style={styles.venueDescription}>{option.description}</Text>
                      </View>
                      {selected && <SelectionCheck />}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <View style={styles.guestSection}>
              <View style={styles.guestLabelRow}>
                <Text style={[styles.fieldLabel, styles.guestLabelCentered]}>
                  ESTIMATED GUEST COUNT
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityLabel="Decrease guest count by 10"
                  accessibilityRole="button"
                  onPress={() => setGuestCount((current) => Math.max(0, current - 10))}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    pressed && styles.stepperButtonPressed,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {({ pressed }) => (
                    <Text style={[styles.stepperButtonText, pressed && styles.stepperButtonTextPressed]}>
                      -
                    </Text>
                  )}
                </Pressable>
                <View style={styles.guestInputShell}>
                  <TextInput
                    accessibilityLabel="Estimated guest count"
                    keyboardType="number-pad"
                    onChangeText={(text) => {
                      const parsed = Number.parseInt(text.replace(/\D/g, ''), 10)
                      setGuestCount(Number.isFinite(parsed) ? parsed : 0)
                    }}
                    style={styles.guestInput}
                    value={String(guestCount)}
                  />
                </View>
                <Pressable
                  accessibilityLabel="Increase guest count by 10"
                  accessibilityRole="button"
                  onPress={() => setGuestCount((current) => current + 10)}
                  style={({ pressed }) => [
                    styles.stepperButton,
                    pressed && styles.stepperButtonPressed,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {({ pressed }) => (
                    <Text style={[styles.stepperButtonText, pressed && styles.stepperButtonTextPressed]}>
                      +
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          {isWide && (
            <View style={styles.tipPanel}>
              <View style={styles.tipHeading}>
                <Text style={styles.tipIcon}>!</Text>
                <Text style={styles.tipTitle}>Pro Tip</Text>
              </View>
              <Text style={styles.tipDescription}>
                Don&apos;t worry if you don&apos;t have exact numbers or a confirmed date yet.
                You can always update these details later. The initial setup helps us tailor
                the vendor recommendations and budget tools for you.
              </Text>
              <Image
                accessibilityLabel="Wedding planning notebook and pen"
                resizeMode="cover"
                source={{ uri: tipImage }}
                style={styles.tipImage}
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.footerContent, isWide && styles.horizontalPaddingWide]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onContinue?.(value)}
            style={({ pressed }) => [
              styles.continueButton,
              isWide && styles.continueButtonWide,
              pressed && styles.continuePressed,
            ]}
          >
            <Text style={styles.continueText}>{isWide ? 'CONTINUE' : 'NEXT STEP'}</Text>
            <Text style={styles.continueArrow}>{'\u2192'}</Text>
          </Pressable>
        </View>
      </View>

      {activePicker === 'date' ? (
        <DatePickerModal
          onChange={setDate}
          onClose={() => setActivePicker(null)}
          value={date}
        />
      ) : null}
      {activePicker === 'time' ? (
        <TimePickerModal
          onChange={setTime}
          onClose={() => setActivePicker(null)}
          value={time}
        />
      ) : null}
    </View>
  )
}

interface PickerFieldProps {
  icon: React.ReactNode
  label: string
  onPress: () => void
  placeholder: string
  value: string
}

const PickerField: React.FC<PickerFieldProps> = ({
  icon,
  label,
  onPress,
  placeholder,
  value,
}) => (
  <View style={styles.dateTimeField}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable
      accessibilityLabel={`Pick ${label.toLowerCase()}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconInputShell, pressed && styles.cardPressed]}
    >
      {typeof icon === 'string' ? <Text style={styles.inputIcon}>{icon}</Text> : icon}
      <Text style={[styles.pickerValue, !value && styles.pickerPlaceholder]}>
        {value || placeholder}
      </Text>
      <Text style={styles.pickerChevron}>{'\u2304'}</Text>
    </Pressable>
  </View>
)

interface PickerColumnProps<T extends number | string> {
  formatter?: (value: T) => string
  onSelect: (value: T) => void
  options: readonly T[]
  selected: T
  title: string
}

const PickerColumn = <T extends number | string,>({
  formatter,
  onSelect,
  options,
  selected,
  title,
}: PickerColumnProps<T>) => (
  <View style={styles.pickerColumn}>
    <Text style={styles.pickerColumnTitle}>{title}</Text>
    <ScrollView
      contentContainerStyle={styles.pickerOptionList}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {options.map((option) => {
        const isSelected = option === selected

        return (
          <Pressable
            key={String(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option)}
            style={({ pressed }) => [
              styles.pickerOption,
              isSelected && styles.pickerOptionSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.pickerOptionText,
                isSelected && styles.pickerOptionTextSelected,
              ]}
            >
              {formatter ? formatter(option) : String(option)}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  </View>
)

interface DatePickerModalProps {
  onChange: (value: string) => void
  onClose: () => void
  value: string
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({ onChange, onClose, value }) => {
  const selected = parseDateParts(value)
  const updateDate = (next: Partial<typeof selected>) => {
    const merged = { ...selected, ...next }
    onChange(formatDate(merged.month, merged.day, merged.year))
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Pick event date</Text>
            <Pressable
              accessibilityLabel="Close date picker"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalCloseText}>DONE</Text>
            </Pressable>
          </View>
          <View style={styles.pickerColumns}>
            <PickerColumn
              formatter={(option) => padTwo(option)}
              onSelect={(month) => updateDate({ month })}
              options={monthOptions}
              selected={selected.month}
              title="MONTH"
            />
            <PickerColumn
              formatter={(option) => padTwo(option)}
              onSelect={(day) => updateDate({ day })}
              options={dayOptions}
              selected={selected.day}
              title="DAY"
            />
            <PickerColumn
              onSelect={(year) => updateDate({ year })}
              options={yearOptions}
              selected={selected.year}
              title="YEAR"
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

interface TimePickerModalProps {
  onChange: (value: string) => void
  onClose: () => void
  value: string
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({ onChange, onClose, value }) => {
  const selected = parseTimeParts(value)
  const updateTime = (next: Partial<typeof selected>) => {
    const merged = { ...selected, ...next }
    onChange(formatTime(merged.hour, merged.minute, merged.meridiem))
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Pick event time</Text>
            <Pressable
              accessibilityLabel="Close time picker"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalCloseText}>DONE</Text>
            </Pressable>
          </View>
          <View style={styles.pickerColumns}>
            <PickerColumn
              formatter={(option) => padTwo(option)}
              onSelect={(hour) => updateTime({ hour })}
              options={hourOptions}
              selected={selected.hour}
              title="HOUR"
            />
            <PickerColumn
              onSelect={(minute) => updateTime({ minute })}
              options={minuteOptions}
              selected={selected.minute}
              title="MIN"
            />
            <PickerColumn
              onSelect={(meridiem) => updateTime({ meridiem })}
              options={meridiemOptions}
              selected={selected.meridiem}
              title="AM/PM"
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const SelectionCheck: React.FC = () => (
  <View style={styles.selectionCheck}>
    <Text style={styles.selectionCheckText}>{'\u2713'}</Text>
  </View>
)

const palette = {
  background: '#F9F9F9',
  border: '#E2E2E2',
  burgundy: '#6B1E2E',
  burgundyDark: '#4E061A',
  muted: '#5E5E5E',
  placeholder: '#A3A4A4',
  surface: '#FFFFFF',
  surfaceLow: '#F3F3F4',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 40,
    borderBottomWidth: 1,
    borderBottomColor: palette.burgundyDark,
    backgroundColor: palette.burgundy,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topAppBarContentWide: { minHeight: 72, paddingHorizontal: 64 },
  desktopTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  headerButtonWide: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.5)' },
  headerIcon: { color: palette.surface, fontSize: 25, lineHeight: 28 },
  desktopTitle: { color: palette.surface, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  mobileTitle: {
    color: palette.surface,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  saveButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  saveButtonText: { color: palette.surface, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.1 },
  headerSpacer: { width: 36, height: 36 },
  scrollContent: { paddingBottom: 128 },
  progressSection: {
    zIndex: 20,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  horizontalPaddingWide: { paddingHorizontal: 64 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressActiveLabel: { color: palette.burgundy, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  progressLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  progressSegments: {
    width: '100%',
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    height: 10,
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#E3E2E2',
  },
  progressSegmentActive: {
    backgroundColor: palette.burgundy,
  },
  mainContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  form: { width: '100%', gap: 48 },
  formWide: { width: '64%' },
  intro: { marginBottom: 16 },
  pageTitle: { color: '#2A1A1D', fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.3, marginBottom: 16 },
  pageTitleWide: { fontSize: 48, lineHeight: 56, letterSpacing: -0.8 },
  pageDescription: { color: palette.muted, fontSize: 18, lineHeight: 30 },
  fieldGroup: { gap: 12 },
  fieldLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  textInputShell: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderWidth: 2, borderColor: palette.border, borderRadius: 20, backgroundColor: '#F1F2F4' },
  textInputShellFocused: { borderColor: palette.burgundy },
  eventNameIcon: { marginLeft: 16 },
  textInput: { minHeight: 52, borderWidth: 0, borderColor: 'transparent', borderRadius: 0, color: palette.text, fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingVertical: 14 },
  textInputWithIcon: {
    minWidth: 0,
    flex: 1,
    paddingLeft: 12,
    paddingRight: 16,
    outlineWidth: 0,
  },
  selectionCardActive: {
    borderColor: palette.burgundy,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 8,
  },
  selectionCheck: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.burgundy,
  },
  selectionCheckText: { color: palette.surface, fontSize: 14, lineHeight: 16, fontWeight: '800' },
  dateTimeGrid: { gap: 24 },
  dateTimeGridWide: { flexDirection: 'row' },
  dateTimeField: { flex: 1, gap: 12 },
  iconInputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: 20,
    backgroundColor: '#F1F2F4',
    paddingHorizontal: 16,
  },
  inputIcon: { color: palette.burgundy, fontSize: 20, lineHeight: 23, marginRight: 12 },
  iconTextInput: { flex: 1, minHeight: 56, color: palette.text, fontSize: 16, lineHeight: 24, paddingVertical: 14 },
  pickerValue: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 16,
  },
  pickerPlaceholder: {
    color: '#BDBDBD',
  },
  pickerChevron: {
    color: palette.muted,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(26, 28, 28, 0.35)',
  },
  pickerSheet: {
    maxHeight: '72%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: palette.surface,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  pickerTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  modalCloseButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: 16,
  },
  modalCloseText: {
    color: palette.burgundy,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  pickerColumns: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerColumn: {
    flex: 1,
    minHeight: 260,
  },
  pickerColumnTitle: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 8,
    textAlign: 'center',
  },
  pickerOptionList: {
    gap: 6,
    paddingBottom: 8,
  },
  pickerOption: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.surface,
  },
  pickerOptionSelected: {
    borderColor: palette.burgundy,
    backgroundColor: '#FCF8F9',
  },
  pickerOptionText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  pickerOptionTextSelected: {
    color: palette.burgundy,
    fontWeight: '800',
  },
  venueGrid: { gap: 16 },
  venueGridWide: { flexDirection: 'row' },
  venueCard: {
    flex: 1,
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface,
    padding: 16,
  },
  venueIconCircle: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F8EDEF',
  },
  venueIconSelected: { backgroundColor: palette.burgundy },
  venueIcon: { color: palette.burgundyDark, fontSize: 23, lineHeight: 26 },
  venueIconTextSelected: { color: palette.surface },
  venueCopy: { flex: 1 },
  venueTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 3 },
  venueDescription: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  themeSection: { gap: 10 },
  themeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  themeOptionalLabel: {
    color: '#8A8A8A',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  themeHelperText: { color: '#8A8A8A', fontSize: 12, lineHeight: 18 },
  themeChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeChip: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#E5E5E5',
    paddingHorizontal: 14,
  },
  themeChipSelected: { backgroundColor: palette.burgundy },
  themeChipText: { color: '#8A8A8A', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  themeChipTextSelected: { color: palette.surface },
  themeLimitMessage: { color: '#8A8A8A', fontSize: 12, lineHeight: 18 },
  guestSection: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 32,
    gap: 12,
  },
  guestLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  guestLabelCentered: { textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  stepperButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 24,
    backgroundColor: palette.surface,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 3,
  },
  stepperButtonText: { color: palette.burgundyDark, fontSize: 27, lineHeight: 29, fontWeight: '400' },
  stepperButtonPressed: { backgroundColor: palette.burgundy, borderColor: palette.burgundy },
  stepperButtonTextPressed: { color: palette.surface },
  guestInputShell: { width: 128, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surface },
  guestInput: { minHeight: 54, color: palette.text, fontSize: 24, lineHeight: 32, fontWeight: '600', textAlign: 'center', paddingVertical: 10 },
  tipPanel: {
    position: 'absolute',
    top: 48,
    right: 64,
    width: '31%',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 24,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  tipHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  tipIcon: {
    width: 24,
    height: 24,
    color: palette.surface,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
    borderRadius: 12,
    backgroundColor: palette.burgundy,
  },
  tipTitle: { color: palette.text, fontSize: 18, lineHeight: 26, fontWeight: '600' },
  tipDescription: { color: palette.muted, fontSize: 16, lineHeight: 26, marginBottom: 24 },
  tipImage: { width: '100%', height: 192, borderRadius: 8, backgroundColor: palette.surfaceLow },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 226, 226, 0.5)',
    backgroundColor: 'rgba(249,249,249,0.96)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  footerContent: { width: '100%', maxWidth: 1200, alignSelf: 'center', alignItems: 'flex-end' },
  continueButton: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 28,
    backgroundColor: palette.burgundyDark,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: palette.burgundyDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  continueButtonWide: { width: 200 },
  continueText: { color: palette.surface, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  continueArrow: { color: palette.surface, fontSize: 18, lineHeight: 21 },
  continuePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  pressed: { opacity: 0.58 },
})
