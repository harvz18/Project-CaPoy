import { Text } from '../components/AppText'
import React from 'react'
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'

export type EventType = 'wedding' | 'preWedding' | 'postWedding'
export type VenueStatus = 'secured' | 'searching'

export interface EventCreationValue {
  date: string
  eventName: string
  eventType: EventType
  guestCount: number
  time: string
  venueAddress?: string
  venueLatitude?: number
  venueLongitude?: number
  venueName?: string
  venueStatus: VenueStatus
  weddingThemes?: string[]
}

interface VenueMapValue {
  address: string
  latitude: number
  longitude: number
  name: string
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

const bacolodVenueSuggestions: VenueMapValue[] = [
  {
    address: 'Lacson Street, Bacolod City, Negros Occidental',
    latitude: 10.6765,
    longitude: 122.9511,
    name: "L'Fisher Hotel Bacolod",
  },
  {
    address: 'SM City Bacolod, Reclamation Area, Bacolod City',
    latitude: 10.6712,
    longitude: 122.9439,
    name: 'SMX Convention Center Bacolod',
  },
  {
    address: 'Corner Araneta and Roxas Streets, Bacolod City',
    latitude: 10.6537,
    longitude: 122.9465,
    name: 'Sugarland Hotel',
  },
  {
    address: 'Circumferential Road, Bacolod City, Negros Occidental',
    latitude: 10.6862,
    longitude: 122.9781,
    name: 'Acacia Hotel Bacolod',
  },
  {
    address: 'J.R. Torres Avenue, Bacolod City, Negros Occidental',
    latitude: 10.6418,
    longitude: 122.9313,
    name: 'Palmas del Mar Conference Resort Hotel',
  },
]

const tipImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBN6x8Mx5zGHTD6IUyLqfk50QbAV-Dq_o6n1Enaq7AusFv1NnMCxYBi0buj801mTGgF7ik3QFivj2rQeGMjXrjptQ6nWOWxpil8cSFaiGfQ79kC9IIW2Jw1dSgsd1IpNCQzZUBkMjoeI_8PbNUsPPCfmvb5L7F7JenBBEY4QpYJe8FcwPrci6W4vHuD5rsSFk_v-xKjQy_eOgKNO7bWrx2GzC1QXPsn3MqYevozfV8UX9XJkZATyrsrCw'

const hourOptions = Array.from({ length: 12 }, (_, index) => index + 1)
const minuteOptions = ['00', '15', '30', '45'] as const
const meridiemOptions = ['AM', 'PM'] as const
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(new Date(2024, index, 1))
)
const wheelRowHeight = 44
const wheelVisibleRows = 5

type Meridiem = (typeof meridiemOptions)[number]

const padTwo = (value: number) => value.toString().padStart(2, '0')

const parseDateValue = (value: string) => {
  const [rawMonth, rawDay, rawYear] = value.split('/').map((part) => Number.parseInt(part, 10))
  const parsed = new Date(rawYear, rawMonth - 1, rawDay)

  return Number.isInteger(rawMonth) && Number.isInteger(rawDay) && Number.isInteger(rawYear) &&
    parsed.getFullYear() === rawYear &&
    parsed.getMonth() === rawMonth - 1 &&
    parsed.getDate() === rawDay
    ? parsed
    : null
}

const formatDate = (month: number, day: number, year: number) =>
  `${padTwo(month)}/${padTwo(day)}/${year}`

const formatDateValue = (date: Date) =>
  formatDate(date.getMonth() + 1, date.getDate(), date.getFullYear())

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const isSameLocalDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate()

const addLocalDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

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

const timePartsToMinutes = (hour: number, minute: string, meridiem: Meridiem) => {
  const normalizedHour = hour % 12 + (meridiem === 'PM' ? 12 : 0)
  return normalizedHour * 60 + Number.parseInt(minute, 10)
}

const validTimePartsForDate = (dateValue: string, now: Date) => {
  const selectedDate = parseDateValue(dateValue)
  const minimumMinutes = selectedDate && isSameLocalDay(selectedDate, now)
    ? now.getHours() * 60 + now.getMinutes() + 1
    : 0

  return Array.from({ length: 96 }, (_, index) => {
    const totalMinutes = index * 15
    const hour24 = Math.floor(totalMinutes / 60)
    const minute = padTwo(totalMinutes % 60) as (typeof minuteOptions)[number]

    return {
      hour: hour24 % 12 || 12,
      meridiem: (hour24 < 12 ? 'AM' : 'PM') as Meridiem,
      minute,
      totalMinutes,
    }
  }).filter((option) => option.totalMinutes >= minimumMinutes)
}

const isPastDateTime = (dateValue: string, timeValue: string, now = new Date()) => {
  const parsedDate = parseDateValue(dateValue)
  if (!parsedDate) return false
  if (parsedDate < startOfLocalDay(now)) return true
  if (!isSameLocalDay(parsedDate, now) || !timeValue) return false

  const parsedTime = parseTimeParts(timeValue)
  return timePartsToMinutes(parsedTime.hour, parsedTime.minute, parsedTime.meridiem) <=
    now.getHours() * 60 + now.getMinutes()
}

export const EventCreationScreen: React.FC<EventCreationScreenProps> = ({
  initialValue,
  onClose,
  onContinue,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [eventName, setEventName] = React.useState(initialValue?.eventName ?? '')
  const eventType: EventType = initialValue?.eventType ?? 'wedding'
  const [date, setDate] = React.useState(initialValue?.date ?? '')
  const [time, setTime] = React.useState(initialValue?.time ?? '')
  const [dateTimeError, setDateTimeError] = React.useState('')
  const [isEventNameFocused, setIsEventNameFocused] = React.useState(false)
  const [activePicker, setActivePicker] = React.useState<'date' | 'time' | null>(null)
  const [venueStatus, setVenueStatus] = React.useState<VenueStatus>(
    initialValue?.venueStatus ?? 'searching'
  )
  const [venueMap, setVenueMap] = React.useState<VenueMapValue>({
    address: initialValue?.venueAddress ?? '',
    latitude: initialValue?.venueLatitude ?? 10.6765,
    longitude: initialValue?.venueLongitude ?? 122.9511,
    name: initialValue?.venueName ?? '',
  })
  const [venueError, setVenueError] = React.useState('')
  const venuePanelAnimation = React.useRef(
    new Animated.Value(venueStatus === 'secured' ? 1 : 0)
  ).current
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

  React.useEffect(() => {
    Animated.timing(venuePanelAnimation, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
      toValue: venueStatus === 'secured' ? 1 : 0,
      useNativeDriver: false,
    }).start()
  }, [venuePanelAnimation, venueStatus])

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

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate)
    setDateTimeError('')

    if (time && isPastDateTime(nextDate, time)) {
      const nextAvailableTime = validTimePartsForDate(nextDate, new Date())[0]
      setTime(
        nextAvailableTime
          ? formatTime(
              nextAvailableTime.hour,
              nextAvailableTime.minute,
              nextAvailableTime.meridiem
            )
          : ''
      )
    }
  }

  const handleTimeChange = (nextTime: string) => {
    setTime(nextTime)
    setDateTimeError('')
  }

  const handleContinue = () => {
    if (date && isPastDateTime(date, time)) {
      setDateTimeError('Choose a date and time later than the current local time.')
      return
    }

    if (venueStatus === 'secured' && (!venueMap.name.trim() || !venueMap.address.trim())) {
      setVenueError('Search for the secured venue or pin its location on the map.')
      return
    }

    onContinue?.(value)
  }

  const value: EventCreationValue = {
    eventName,
    eventType,
    date,
    time,
    venueStatus,
    venueAddress: venueMap.address,
    venueLatitude: venueMap.latitude,
    venueLongitude: venueMap.longitude,
    venueName: venueMap.name,
    guestCount,
    weddingThemes: selectedWeddingThemes,
  }
  const isStepComplete = Boolean(
    eventName.trim() &&
      date &&
      time &&
      guestCount > 0 &&
      !isPastDateTime(date, time) &&
      (venueStatus !== 'secured' || (venueMap.name.trim() && venueMap.address.trim()))
  )

  return (
    <View style={styles.screen}>
      <PlanningScreenHeader
        currentStep={1}
        label="Basics"
        nextEnabled={isStepComplete}
        onBack={onClose}
        onNext={handleContinue}
        title="Create Event"
      />

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
            {dateTimeError ? (
              <Text accessibilityRole="alert" style={styles.dateTimeError}>
                {dateTimeError}
              </Text>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>VENUE STATUS</Text>
              <View style={styles.venueGrid}>
                {venueOptions.map((option) => {
                  const selected = venueStatus === option.id
                  return (
                    <React.Fragment key={option.id}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() => {
                          setVenueStatus(option.id)
                          setVenueError('')
                        }}
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
                        {selected ? (
                          <View style={styles.venueSelectionActions}>
                            <SelectionCheck />
                            {option.id === 'secured' ? (
                              <MaterialIcons
                                color={palette.burgundy}
                                name="keyboard-arrow-down"
                                size={23}
                              />
                            ) : null}
                          </View>
                        ) : null}
                      </Pressable>

                      {option.id === 'secured' ? (
                        <Animated.View
                          pointerEvents={venueStatus === 'secured' ? 'auto' : 'none'}
                          style={[
                            styles.venueMapReveal,
                            {
                              maxHeight: venuePanelAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 720],
                              }),
                              opacity: venuePanelAnimation,
                              transform: [
                                {
                                  translateY: venuePanelAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-14, 0],
                                  }),
                                },
                              ],
                            },
                          ]}
                        >
                          <View pointerEvents="none" style={styles.venueMapConnector}>
                            <View style={styles.venueMapConnectorDiamond} />
                          </View>
                          <VenueLocationPicker
                            error={venueError}
                            onChange={(nextValue) => {
                              setVenueMap(nextValue)
                              setVenueError('')
                            }}
                            value={venueMap}
                          />
                        </Animated.View>
                      ) : null}
                    </React.Fragment>
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
            accessibilityState={{ disabled: !isStepComplete }}
            disabled={!isStepComplete}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              isWide && styles.continueButtonWide,
              !isStepComplete && styles.continueDisabled,
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
          onChange={handleDateChange}
          onClose={() => setActivePicker(null)}
          value={date}
        />
      ) : null}
      {activePicker === 'time' ? (
        <TimePickerModal
          dateValue={date}
          onChange={handleTimeChange}
          onClose={() => setActivePicker(null)}
          value={time}
        />
      ) : null}
    </View>
  )
}

interface VenueLocationPickerProps {
  error: string
  onChange: (value: VenueMapValue) => void
  value: VenueMapValue
}

const VenueLocationPicker: React.FC<VenueLocationPickerProps> = ({
  error,
  onChange,
  value,
}) => {
  const [query, setQuery] = React.useState(value.name)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const normalizedQuery = query.trim().toLowerCase()
  const results = normalizedQuery
    ? bacolodVenueSuggestions
        .filter(
          (venue) =>
            venue.name.toLowerCase().includes(normalizedQuery) ||
            venue.address.toLowerCase().includes(normalizedQuery)
        )
        .slice(0, 4)
    : []

  const chooseVenue = (venue: VenueMapValue) => {
    setQuery(venue.name)
    onChange(venue)
  }

  const pinVenue = (latitude: number, longitude: number) => {
    const customName = query.trim() || value.name.trim() || 'Pinned venue'
    const hasNewSearch = Boolean(query.trim() && query.trim() !== value.name.trim())
    onChange({
      address:
        hasNewSearch
          ? `${query.trim()}, Bacolod City, Negros Occidental`
          : value.address.trim() || 'Pinned location, Bacolod City, Negros Occidental',
      latitude,
      longitude,
      name: customName,
    })
  }

  const searchBox = (fullscreen = false) => (
    <View style={[styles.venueSearchArea, fullscreen && styles.venueSearchAreaFullscreen]}>
      <View style={styles.venueSearchShell}>
        <MaterialIcons color={palette.burgundy} name="search" size={21} />
        <TextInput
          accessibilityLabel="Search secured venue in Bacolod"
          onChangeText={setQuery}
          onSubmitEditing={() => {
            if (results[0]) chooseVenue(results[0])
          }}
          placeholder="Search your booked venue in Bacolod"
          placeholderTextColor={palette.placeholder}
          returnKeyType="search"
          style={styles.venueSearchInput}
          value={query}
        />
      </View>
      {normalizedQuery ? (
        <View style={styles.venueResults}>
          {results.length > 0 ? (
            results.map((venue) => (
              <Pressable
                key={venue.name}
                accessibilityRole="button"
                onPress={() => chooseVenue(venue)}
                style={({ pressed }) => [
                  styles.venueResultRow,
                  pressed && styles.venueResultRowPressed,
                ]}
              >
                <MaterialIcons color={palette.burgundy} name="location-on" size={20} />
                <View style={styles.venueResultCopy}>
                  <Text style={styles.venueResultName}>{venue.name}</Text>
                  <Text numberOfLines={1} style={styles.venueResultAddress}>
                    {venue.address}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.venueNoResults}>
              No saved suggestion found. Keep the name, then tap its location on the map.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  )

  return (
    <View style={styles.venueMapCard}>
      <View style={styles.venueMapHeading}>
        <View style={styles.venueMapHeadingCopy}>
          <Text style={styles.venueMapEyebrow}>SECURED VENUE</Text>
          <Text style={styles.venueMapTitle}>Find and pin your venue</Text>
          <Text style={styles.venueMapDescription}>
            Search the venue you already booked, then fine-tune the pin on the Bacolod map.
          </Text>
        </View>
        <View style={styles.venueStepBadge}>
          <Text style={styles.venueStepBadgeText}>PIN</Text>
        </View>
      </View>

      {searchBox()}

      <View style={styles.mapPreviewShell}>
        <VenueMapSurface onPin={pinVenue} value={value} />
        <Pressable
          accessibilityLabel="Open venue map in full screen"
          accessibilityRole="button"
          onPress={() => setIsFullscreen(true)}
          style={({ pressed }) => [
            styles.mapFullscreenButton,
            pressed && styles.mapFullscreenButtonPressed,
          ]}
        >
          <MaterialIcons color={palette.surface} name="fullscreen" size={22} />
          <Text style={styles.mapFullscreenText}>FULL SCREEN</Text>
        </Pressable>
      </View>

      {value.name || value.address ? (
        <View style={styles.selectedVenueBanner}>
          <View style={styles.selectedVenueIcon}>
            <MaterialIcons color={palette.surface} name="location-on" size={20} />
          </View>
          <View style={styles.selectedVenueCopy}>
            <Text style={styles.selectedVenueName}>{value.name || 'Pinned venue'}</Text>
            <Text style={styles.selectedVenueAddress}>{value.address}</Text>
          </View>
          <MaterialIcons color={palette.burgundy} name="check-circle" size={23} />
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.venueError}>
          {error}
        </Text>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setIsFullscreen(false)}
        visible={isFullscreen}
      >
        <View style={styles.fullscreenMapScreen}>
          <View style={styles.fullscreenMapHeader}>
            <Pressable
              accessibilityLabel="Close full screen venue map"
              accessibilityRole="button"
              onPress={() => setIsFullscreen(false)}
              style={({ pressed }) => [styles.fullscreenMapClose, pressed && styles.pressed]}
            >
              <MaterialIcons color={palette.surface} name="close" size={25} />
            </Pressable>
            <View style={styles.fullscreenMapHeaderCopy}>
              <Text style={styles.fullscreenMapEyebrow}>BACOLOD CITY</Text>
              <Text style={styles.fullscreenMapTitle}>Pin secured venue</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsFullscreen(false)}
              style={({ pressed }) => [styles.fullscreenMapDone, pressed && styles.pressed]}
            >
              <Text style={styles.fullscreenMapDoneText}>DONE</Text>
            </Pressable>
          </View>
          {searchBox(true)}
          <View style={styles.fullscreenMapBody}>
            <VenueMapSurface fullscreen onPin={pinVenue} value={value} />
          </View>
          <View style={styles.fullscreenMapFooter}>
            <MaterialIcons color={palette.burgundy} name="touch-app" size={20} />
            <Text style={styles.fullscreenMapHint}>
              Tap anywhere on the map to place or adjust the venue pin.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  )
}

interface VenueMapSurfaceProps {
  fullscreen?: boolean
  onPin: (latitude: number, longitude: number) => void
  value: VenueMapValue
}

const VenueMapSurface: React.FC<VenueMapSurfaceProps> = ({
  fullscreen = false,
  onPin,
  value,
}) => {
  const [size, setSize] = React.useState({ height: 1, width: 1 })
  const west = 122.91
  const east = 122.99
  const north = 10.73
  const south = 10.62
  const pinX = Math.max(0, Math.min(1, (value.longitude - west) / (east - west)))
  const pinY = Math.max(0, Math.min(1, (north - value.latitude) / (north - south)))

  return (
    <Pressable
      accessibilityHint="Tap to move the venue pin"
      accessibilityLabel="Bacolod venue map"
      accessibilityRole="button"
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      onPress={(event) => {
        const xRatio = Math.max(0, Math.min(1, event.nativeEvent.locationX / size.width))
        const yRatio = Math.max(0, Math.min(1, event.nativeEvent.locationY / size.height))
        onPin(north - yRatio * (north - south), west + xRatio * (east - west))
      }}
      style={[styles.mapSurface, fullscreen && styles.mapSurfaceFullscreen]}
    >
      <View style={[styles.mapRoad, styles.mapRoadVertical]} />
      <View style={[styles.mapRoad, styles.mapRoadHorizontal]} />
      <View style={[styles.mapRoad, styles.mapRoadDiagonalOne]} />
      <View style={[styles.mapRoad, styles.mapRoadDiagonalTwo]} />
      <View style={[styles.mapRoadMinor, styles.mapRoadMinorOne]} />
      <View style={[styles.mapRoadMinor, styles.mapRoadMinorTwo]} />
      <View style={styles.mapWater} />
      <Text style={[styles.mapDistrictLabel, styles.mapLabelMandalagan]}>MANDALAGAN</Text>
      <Text style={[styles.mapDistrictLabel, styles.mapLabelDowntown]}>DOWNTOWN</Text>
      <Text style={[styles.mapDistrictLabel, styles.mapLabelSingcang]}>SINGCANG</Text>
      <View style={styles.mapCityLabel}>
        <Text style={styles.mapCityLabelText}>BACOLOD CITY</Text>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.mapPin,
          {
            left: `${pinX * 100}%`,
            top: `${pinY * 100}%`,
          },
        ]}
      >
        <MaterialIcons color={palette.burgundy} name="location-on" size={38} />
        <View style={styles.mapPinPulse} />
      </View>
      <View pointerEvents="none" style={styles.mapAttributionBadge}>
        <Text style={styles.mapAttributionText}>Bacolod preview</Text>
      </View>
    </Pressable>
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

interface WheelOption {
  accessibilityLabel?: string
  label: string
  value: string
}

interface PickerColumnProps {
  accessibilityLabel: string
  onSelect: (value: string) => void
  options: WheelOption[]
  selected: string
  wide?: boolean
}

const PickerColumn: React.FC<PickerColumnProps> = ({
  accessibilityLabel,
  onSelect,
  options,
  selected,
  wide = false,
}) => {
  const listRef = React.useRef<FlatList<WheelOption>>(null)
  const scrollOffset = React.useRef(new Animated.Value(0)).current
  const dragSettleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selected))

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      listRef.current?.scrollToOffset({
        animated: false,
        offset: selectedIndex * wheelRowHeight,
      })
    }, 0)

    return () => clearTimeout(timeout)
  }, [options, selectedIndex])

  React.useEffect(
    () => () => {
      if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current)
    },
    []
  )

  const selectFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(
      0,
      Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / wheelRowHeight))
    )
    const option = options[index]
    if (option && option.value !== selected) onSelect(option.value)
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      style={[styles.pickerColumn, wide && styles.pickerColumnWide]}
    >
      <View pointerEvents="none" style={styles.wheelSelectionBand} />
      <Animated.FlatList
        ref={listRef}
        contentContainerStyle={styles.pickerOptionList}
        data={options}
        decelerationRate={0.985}
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          index,
          length: wheelRowHeight,
          offset: wheelRowHeight * index,
        })}
        initialNumToRender={9}
        keyExtractor={(option) => option.value}
        nestedScrollEnabled
        onMomentumScrollBegin={() => {
          if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current)
        }}
        onMomentumScrollEnd={(event) => {
          if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current)
          selectFromScroll(event)
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollOffset } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={(event) => {
          if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current)
          const capturedOffset = event.nativeEvent.contentOffset.y
          dragSettleTimer.current = setTimeout(() => {
            const index = Math.max(
              0,
              Math.min(
                options.length - 1,
                Math.round(capturedOffset / wheelRowHeight)
              )
            )
            listRef.current?.scrollToOffset({
              animated: true,
              offset: index * wheelRowHeight,
            })
            const option = options[index]
            if (option && option.value !== selected) onSelect(option.value)
          }, 90)
        }}
        renderItem={({ index, item }) => {
          const isSelected = item.value === selected
          const inputRange = [
            (index - 2) * wheelRowHeight,
            (index - 1) * wheelRowHeight,
            index * wheelRowHeight,
            (index + 1) * wheelRowHeight,
            (index + 2) * wheelRowHeight,
          ]
          const opacity = scrollOffset.interpolate({
            extrapolate: 'clamp',
            inputRange,
            outputRange: [0.16, 0.46, 1, 0.46, 0.16],
          })
          const rotateX = scrollOffset.interpolate({
            extrapolate: 'clamp',
            inputRange,
            outputRange: ['48deg', '24deg', '0deg', '-24deg', '-48deg'],
          })
          const scale = scrollOffset.interpolate({
            extrapolate: 'clamp',
            inputRange,
            outputRange: [0.82, 0.92, 1, 0.92, 0.82],
          })

          return (
            <Animated.View
              style={{
                opacity,
                transform: [{ perspective: 700 }, { rotateX }, { scale }],
              }}
            >
              <Pressable
                accessibilityLabel={item.accessibilityLabel ?? item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  listRef.current?.scrollToOffset({
                    animated: true,
                    offset: index * wheelRowHeight,
                  })
                  onSelect(item.value)
                }}
                style={({ pressed }) => [styles.pickerOption, pressed && styles.pressed]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.pickerOptionText,
                    isSelected && styles.pickerOptionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            </Animated.View>
          )
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={wheelRowHeight}
        style={styles.wheelList}
        windowSize={7}
      />
    </View>
  )
}

interface DatePickerModalProps {
  onChange: (value: string) => void
  onClose: () => void
  value: string
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({ onChange, onClose, value }) => {
  const now = React.useRef(new Date()).current
  const minimumDate = React.useMemo(() => {
    const today = startOfLocalDay(now)
    return validTimePartsForDate(formatDateValue(today), now).length > 0
      ? today
      : addLocalDays(today, 1)
  }, [now])
  const parsedValue = parseDateValue(value)
  const maximumYear = minimumDate.getFullYear() + 7
  const initialDate = parsedValue &&
      parsedValue >= minimumDate &&
      parsedValue.getFullYear() <= maximumYear
    ? parsedValue
    : minimumDate
  const [draftDate, setDraftDate] = React.useState(initialDate)
  const selectedYear = draftDate.getFullYear()
  const selectedMonth = draftDate.getMonth() + 1
  const selectedDay = draftDate.getDate()
  const yearOptions = Array.from({ length: 8 }, (_, index) => minimumDate.getFullYear() + index)
  const totalMonthOptions =
    (maximumYear - minimumDate.getFullYear()) * 12 +
    (12 - minimumDate.getMonth())
  const monthWheelOptions = Array.from({ length: totalMonthOptions }, (_, index) => {
    const optionDate = new Date(
      minimumDate.getFullYear(),
      minimumDate.getMonth() + index,
      1
    )

    return {
      accessibilityLabel: `${monthNames[optionDate.getMonth()]} ${optionDate.getFullYear()}`,
      label: monthNames[optionDate.getMonth()],
      value: `${optionDate.getFullYear()}-${optionDate.getMonth() + 1}`,
    }
  })
  const minimumDay =
    selectedYear === minimumDate.getFullYear() && selectedMonth === minimumDate.getMonth() + 1
      ? minimumDate.getDate()
      : 1
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate()
  const availableDays = Array.from(
    { length: daysInSelectedMonth - minimumDay + 1 },
    (_, index) => minimumDay + index
  )

  const updateDateParts = (next: { day?: number; month?: number; year?: number }) => {
    const year = next.year ?? selectedYear
    const earliestMonth = year === minimumDate.getFullYear() ? minimumDate.getMonth() + 1 : 1
    const month = Math.max(earliestMonth, next.month ?? selectedMonth)
    const earliestDay =
      year === minimumDate.getFullYear() && month === minimumDate.getMonth() + 1
        ? minimumDate.getDate()
        : 1
    const lastDay = new Date(year, month, 0).getDate()
    const day = Math.min(lastDay, Math.max(earliestDay, next.day ?? selectedDay))

    setDraftDate(new Date(year, month - 1, day))
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Pick event date</Text>
            <Pressable
              accessibilityLabel="Confirm event date"
              accessibilityRole="button"
              onPress={() => {
                onChange(formatDateValue(draftDate))
                onClose()
              }}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalCloseText}>DONE</Text>
            </Pressable>
          </View>
          <View style={[styles.pickerColumnLabelRow, styles.datePickerColumns]}>
            <Text style={styles.pickerColumnLabel}>MONTH</Text>
            <Text style={styles.pickerColumnLabel}>DAY</Text>
            <Text style={styles.pickerColumnLabel}>YEAR</Text>
          </View>
          <View style={[styles.pickerColumns, styles.datePickerColumns]}>
            <PickerColumn
              accessibilityLabel="Event month wheel"
              onSelect={(monthValue) => {
                const [year, month] = monthValue.split('-').map(Number)
                updateDateParts({ month, year })
              }}
              options={monthWheelOptions}
              selected={`${selectedYear}-${selectedMonth}`}
            />
            <PickerColumn
              accessibilityLabel="Event day wheel"
              onSelect={(day) => updateDateParts({ day: Number(day) })}
              options={availableDays.map((day) => ({
                label: padTwo(day),
                value: String(day),
              }))}
              selected={String(selectedDay)}
            />
            <PickerColumn
              accessibilityLabel="Event year wheel"
              onSelect={(year) => updateDateParts({ year: Number(year) })}
              options={yearOptions.map((year) => ({
                label: String(year),
                value: String(year),
              }))}
              selected={String(selectedYear)}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

interface TimePickerModalProps {
  dateValue: string
  onChange: (value: string) => void
  onClose: () => void
  value: string
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({
  dateValue,
  onChange,
  onClose,
  value,
}) => {
  const now = React.useRef(new Date()).current
  const validTimes = React.useMemo(
    () => validTimePartsForDate(dateValue, now),
    [dateValue, now]
  )
  const parsed = parseTimeParts(value)
  const initial = validTimes.find(
    (option) =>
      option.hour === parsed.hour &&
      option.minute === parsed.minute &&
      option.meridiem === parsed.meridiem
  ) ?? validTimes[0]
  const [selected, setSelected] = React.useState(() => ({
    hour: initial?.hour ?? parsed.hour,
    minute: initial?.minute ?? parsed.minute,
    meridiem: initial?.meridiem ?? parsed.meridiem,
  }))

  const meridiemValues = meridiemOptions.filter((meridiem) =>
    validTimes.some((option) => option.meridiem === meridiem)
  )
  const hourValues = hourOptions.filter((hour) =>
    validTimes.some(
      (option) => option.meridiem === selected.meridiem && option.hour === hour
    )
  )
  const minuteValues = minuteOptions.filter((minute) =>
    validTimes.some(
      (option) =>
        option.meridiem === selected.meridiem &&
        option.hour === selected.hour &&
        option.minute === minute
    )
  )

  const selectMeridiem = (meridiem: Meridiem) => {
    const matching = validTimes.filter((option) => option.meridiem === meridiem)
    const next = matching.find(
      (option) => option.hour === selected.hour && option.minute === selected.minute
    ) ?? matching[0]
    if (next) setSelected(next)
  }

  const selectHour = (hour: number) => {
    const matching = validTimes.filter(
      (option) => option.meridiem === selected.meridiem && option.hour === hour
    )
    const next = matching.find((option) => option.minute === selected.minute) ?? matching[0]
    if (next) setSelected(next)
  }

  const selectMinute = (minute: string) => {
    const next = validTimes.find(
      (option) =>
        option.meridiem === selected.meridiem &&
        option.hour === selected.hour &&
        option.minute === minute
    )
    if (next) setSelected(next)
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Pick event time</Text>
            <Pressable
              accessibilityLabel="Confirm event time"
              accessibilityRole="button"
              accessibilityState={{ disabled: validTimes.length === 0 }}
              disabled={validTimes.length === 0}
              onPress={() => {
                onChange(formatTime(selected.hour, selected.minute, selected.meridiem))
                onClose()
              }}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalCloseText}>DONE</Text>
            </Pressable>
          </View>
          <Text style={styles.pickerHelper}>
            {dateValue
              ? 'Times earlier than the current time are removed when today is selected.'
              : 'Choose a time now, or select the event date first.'}
          </Text>
          <View style={styles.pickerColumns}>
            <PickerColumn
              accessibilityLabel="Event hour wheel"
              onSelect={(hour) => selectHour(Number(hour))}
              options={hourValues.map((hour) => ({ label: padTwo(hour), value: String(hour) }))}
              selected={String(selected.hour)}
            />
            <PickerColumn
              accessibilityLabel="Event minute wheel"
              onSelect={selectMinute}
              options={minuteValues.map((minute) => ({ label: minute, value: minute }))}
              selected={selected.minute}
            />
            <PickerColumn
              accessibilityLabel="AM or PM wheel"
              onSelect={(meridiem) => selectMeridiem(meridiem as Meridiem)}
              options={meridiemValues.map((meridiem) => ({ label: meridiem, value: meridiem }))}
              selected={selected.meridiem}
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
  dateTimeError: { color: '#BA1A1A', fontSize: 13, lineHeight: 19, marginTop: -32 },
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
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: palette.border,
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
  pickerHelper: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  pickerColumns: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  datePickerColumns: { alignSelf: 'center', width: '100%', maxWidth: 390 },
  pickerColumnLabelRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  pickerColumnLabel: {
    flex: 1,
    color: palette.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  pickerColumn: {
    flex: 1,
    height: wheelRowHeight * wheelVisibleRows,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#FBF8F9',
  },
  pickerColumnWide: { flex: 1 },
  wheelSelectionBand: {
    position: 'absolute',
    top: wheelRowHeight * 2,
    right: 0,
    left: 0,
    zIndex: 0,
    height: wheelRowHeight,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#C99AA4',
    backgroundColor: '#F8EDEF',
  },
  wheelList: { zIndex: 1, height: wheelRowHeight * wheelVisibleRows },
  pickerOptionList: {
    paddingVertical: wheelRowHeight * 2,
  },
  pickerOption: {
    height: wheelRowHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionText: {
    color: '#A9A2A4',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    opacity: 0.56,
  },
  pickerOptionTextSelected: {
    color: palette.burgundy,
    fontSize: 16,
    fontWeight: '800',
    opacity: 1,
  },
  venueGrid: { gap: 16 },
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
  venueSelectionActions: { alignItems: 'center', gap: 2 },
  venueMapReveal: { position: 'relative', overflow: 'hidden', paddingTop: 13, marginTop: -12 },
  venueMapConnector: {
    position: 'absolute',
    top: 6,
    left: '50%',
    zIndex: 4,
    width: 14,
    height: 14,
    marginLeft: -7,
  },
  venueMapConnectorDiamond: {
    width: 14,
    height: 14,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: '#DAC0C2',
    backgroundColor: palette.surface,
    transform: [{ rotate: '45deg' }],
  },
  venueMapCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DAC0C2',
    borderRadius: 16,
    backgroundColor: palette.surface,
    padding: 16,
    marginTop: 0,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  venueMapHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  venueMapHeadingCopy: { minWidth: 0, flex: 1 },
  venueMapEyebrow: { color: palette.burgundy, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.1 },
  venueMapTitle: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '700', marginTop: 2 },
  venueMapDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  venueStepBadge: { borderRadius: 999, backgroundColor: '#F8EDEF', paddingHorizontal: 10, paddingVertical: 5 },
  venueStepBadgeText: { color: palette.burgundy, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8 },
  venueSearchArea: { zIndex: 8, marginBottom: 12 },
  venueSearchAreaFullscreen: { zIndex: 20, paddingHorizontal: 16, paddingTop: 14, marginBottom: 0, backgroundColor: palette.background },
  venueSearchShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#D8C7CA',
    borderRadius: 12,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
  },
  venueSearchInput: { minWidth: 0, flex: 1, minHeight: 46, color: palette.text, fontSize: 14, lineHeight: 20, paddingVertical: 11 },
  venueResults: { overflow: 'hidden', borderWidth: 1, borderTopWidth: 0, borderColor: palette.border, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: palette.surface },
  venueResultRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#F0E8EA', paddingHorizontal: 12, paddingVertical: 9 },
  venueResultRowPressed: { backgroundColor: '#FCF4F6' },
  venueResultCopy: { minWidth: 0, flex: 1 },
  venueResultName: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  venueResultAddress: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 1 },
  venueNoResults: { color: palette.muted, fontSize: 12, lineHeight: 18, padding: 12 },
  mapPreviewShell: { position: 'relative', overflow: 'hidden', borderRadius: 14 },
  mapSurface: {
    position: 'relative',
    height: 250,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D5CAC5',
    borderRadius: 14,
    backgroundColor: '#E8E1D5',
  },
  mapSurfaceFullscreen: { flex: 1, height: undefined, borderWidth: 0, borderRadius: 0 },
  mapWater: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '15%', backgroundColor: '#C9DFE8', opacity: 0.9 },
  mapRoad: { position: 'absolute', height: 7, borderWidth: 1, borderColor: '#D2CBC2', backgroundColor: '#FFFDF8', borderRadius: 4 },
  mapRoadVertical: { top: '4%', bottom: '3%', left: '52%', width: 7, height: undefined },
  mapRoadHorizontal: { top: '56%', right: '2%', left: '8%' },
  mapRoadDiagonalOne: { top: '33%', left: '4%', width: '105%', transform: [{ rotate: '-18deg' }] },
  mapRoadDiagonalTwo: { top: '72%', left: '4%', width: '100%', transform: [{ rotate: '12deg' }] },
  mapRoadMinor: { position: 'absolute', height: 3, borderRadius: 2, backgroundColor: '#F8F3EA' },
  mapRoadMinorOne: { top: '20%', right: '9%', width: '58%', transform: [{ rotate: '8deg' }] },
  mapRoadMinorTwo: { top: '43%', left: '16%', width: '60%', transform: [{ rotate: '27deg' }] },
  mapDistrictLabel: { position: 'absolute', color: '#8B8176', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 0.7 },
  mapLabelMandalagan: { top: '13%', right: '14%' },
  mapLabelDowntown: { top: '61%', left: '28%' },
  mapLabelSingcang: { right: '12%', bottom: '13%' },
  mapCityLabel: { position: 'absolute', top: 12, left: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.86)', paddingHorizontal: 8, paddingVertical: 5 },
  mapCityLabelText: { color: palette.burgundy, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.9 },
  mapPin: { position: 'absolute', zIndex: 6, width: 38, height: 44, alignItems: 'center', marginLeft: -19, marginTop: -38 },
  mapPinPulse: { width: 15, height: 6, borderRadius: 8, backgroundColor: 'rgba(107,30,46,0.24)', marginTop: -6 },
  mapAttributionBadge: { position: 'absolute', right: 8, bottom: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.84)', paddingHorizontal: 7, paddingVertical: 3 },
  mapAttributionText: { color: palette.muted, fontSize: 8, lineHeight: 11, fontWeight: '600' },
  mapFullscreenButton: { position: 'absolute', top: 10, right: 10, zIndex: 7, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, backgroundColor: palette.burgundy, paddingHorizontal: 10, paddingVertical: 8 },
  mapFullscreenButtonPressed: { backgroundColor: palette.burgundyDark, transform: [{ scale: 0.97 }] },
  mapFullscreenText: { color: palette.surface, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.7 },
  selectedVenueBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: '#F8EDEF', padding: 12, marginTop: 12 },
  selectedVenueIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.burgundy },
  selectedVenueCopy: { minWidth: 0, flex: 1 },
  selectedVenueName: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  selectedVenueAddress: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 1 },
  venueError: { color: '#BA1A1A', fontSize: 12, lineHeight: 18, marginTop: 10 },
  fullscreenMapScreen: { flex: 1, backgroundColor: palette.background },
  fullscreenMapHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.burgundy, paddingHorizontal: 16, paddingVertical: 10 },
  fullscreenMapClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  fullscreenMapHeaderCopy: { minWidth: 0, flex: 1 },
  fullscreenMapEyebrow: { color: '#EAC7CE', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 1 },
  fullscreenMapTitle: { color: palette.surface, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  fullscreenMapDone: { minHeight: 38, justifyContent: 'center', borderRadius: 19, backgroundColor: palette.surface, paddingHorizontal: 15 },
  fullscreenMapDoneText: { color: palette.burgundy, fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8 },
  fullscreenMapBody: { minHeight: 0, flex: 1, marginTop: 14 },
  fullscreenMapFooter: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 20, paddingVertical: 12 },
  fullscreenMapHint: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
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
  continueDisabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  pressed: { opacity: 0.58 },
})
