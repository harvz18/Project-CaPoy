import { Text } from '../components/AppText'
import React from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { BlurView } from 'expo-blur'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'
import { hasMapTilerVenueMap, MapTilerVenueMap } from '../components/MapTilerVenueMap'
import { colors } from '../theme/tokens'
import { neutralSelection } from '../theme/neumorphism'
import { animateOptionLayout, optionSelectionMotionDuration } from '../theme/option-motion'
import {
  EVENT_BOOKING_LEAD_TIME_MESSAGE,
  isEventDateBookable,
  minimumEventBookingDate,
} from '../lib/event-booking-lead-time'

export type EventType = 'wedding' | 'preWedding' | 'postWedding'
export type VenueStatus = 'secured' | 'searching'
export type VenueSource = 'external' | 'marketplace'
type RequiredSection = 'eventName' | 'coordinator' | 'churchWedding' | 'dateTime' | 'venueStatus' | 'venue' | 'guestCount'

export interface EventCreationValue {
  date: string
  eventName: string
  eventType: EventType
  guestCount: number
  isChurchWedding?: boolean
  wantsCoordinator?: boolean
  time: string
  venueAddress?: string
  venueLatitude?: number
  venueLongitude?: number
  venueName?: string
  venueSource?: VenueSource
  externalVenueConfirmed?: boolean
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
  isProcessing?: boolean
  onClose?: () => void
  onContinue?: (value: EventCreationValue) => void
  onValueChange?: (value: EventCreationValue) => void
  presentation?: 'planning' | 'savedPlan'
  timeGuidance?: string
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
const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim() ?? ''

const bacolodVenueSuggestions: VenueMapValue[] = [
  {
    address: 'Lacson Street, Bacolod City, Negros Occidental',
    latitude: 10.6799,
    longitude: 122.954,
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
    latitude: 10.65253,
    longitude: 122.93732,
    name: 'Sugarland Hotel',
  },
  {
    address: 'Capitol Park and Lagoon, Bacolod City, Negros Occidental',
    latitude: 10.676044,
    longitude: 122.952096,
    name: 'Capitol Park and Lagoon',
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

const distanceInKilometres = (
  first: Pick<VenueMapValue, 'latitude' | 'longitude'>,
  second: Pick<VenueMapValue, 'latitude' | 'longitude'>,
) => {
  const radians = (value: number) => (value * Math.PI) / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const firstLatitude = radians(first.latitude)
  const secondLatitude = radians(second.latitude)
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

const verifiedVenueAtPin = (latitude: number, longitude: number) => {
  const pin = { latitude, longitude }
  const nearestVenue = bacolodVenueSuggestions.reduce((nearest, venue) => (
    distanceInKilometres(venue, pin) < distanceInKilometres(nearest, pin) ? venue : nearest
  ))
  // Only use a local landmark label when the pin is actually at that landmark.
  // This prevents a nearby hotel from replacing a park or street selection.
  return distanceInKilometres(nearestVenue, pin) <= 0.15 ? nearestVenue : null
}

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

// Keyboard entry must reach the exact same calendar value as the picker.
// Keep this stricter than the display mask so impossible dates (for example,
// 02/31/2027) cannot be carried into the planning state as a truthy string.
const normalizeDateValue = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const parsed = parseDateValue(value)
  return parsed ? formatDateValue(parsed) : null
}

const formatManualDateInput = (value: string) => {
  // Preserve manually entered separators so inputs such as 7/5/2027 become
  // 07/05/2027 instead of being reinterpreted as a different month/day.
  if (value.includes('/')) {
    const parts = value.split('/').slice(0, 3).map((part) => part.replace(/\D/g, ''))
    const month = parts[0].slice(0, 2)
    if (parts.length === 1) return month

    const normalizedMonth = month.length === 1 ? `0${month}` : month
    const day = (parts[1] ?? '').slice(0, 2)
    // The first slash is inserted as soon as a two-digit month is entered.
    // Continue that same keyboard-friendly masking after a two-digit day;
    // otherwise a numeric keyboard cannot reach the year segment because it
    // has no slash key to create the second separator itself.
    if (parts.length === 2) return day.length === 2 ? `${normalizedMonth}/${day}/` : `${normalizedMonth}/${day}`

    const normalizedDay = day.length === 1 ? `0${day}` : day
    return `${normalizedMonth}/${normalizedDay}/${(parts[2] ?? '').slice(0, 4)}`
  }

  const digits = value.replace(/\D/g, '').slice(0, 8)
  const month = digits.slice(0, 2)
  if (digits.length < 2) return month
  if (digits.length === 2) return `${month}/`

  const day = digits.slice(2, 4)
  if (digits.length < 4) return `${month}/${day}`
  if (digits.length === 4) return `${month}/${day}/`

  const year = digits.slice(4)
  return `${month}/${day}/${year}`
}

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const isSameLocalDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate()

const parseTimeParts = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i)
  const rawHour = match ? Number.parseInt(match[1], 10) : 6
  const rawMinute = match?.[2] ?? '00'
  const rawMeridiem = match?.[3]?.toUpperCase() === 'PM' ? 'PM' : 'AM'

  return {
    hour: rawHour >= 1 && rawHour <= 12 ? rawHour : 6,
    minute: /^\d{2}$/.test(rawMinute) && Number.parseInt(rawMinute, 10) <= 59
      ? rawMinute
      : '00',
    meridiem: rawMeridiem as Meridiem,
  }
}

const formatTime = (hour: number, minute: string, meridiem: Meridiem) =>
  `${padTwo(hour)}:${minute} ${meridiem}`

const getManualTimeInput = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s?(?:AM|PM)$/i)
  return match ? `${padTwo(Number.parseInt(match[1], 10))}:${match[2]}` : ''
}

const formatManualTimeInput = (value: string) => {
  const sanitized = value.replace(/[^\d:]/g, '').slice(0, 5)

  if (sanitized.includes(':')) {
    const [rawHour = '', rawMinute = ''] = sanitized.split(':')
    const hour = rawHour.slice(0, 2)
    const normalizedHour = hour.length === 1 ? `0${hour}` : hour
    return `${normalizedHour}:${rawMinute.slice(0, 2)}`
  }

  const digits = sanitized.replace(/\D/g, '').slice(0, 4)
  if (digits.length < 2) return digits

  const twoDigitHour = Number.parseInt(digits.slice(0, 2), 10)
  if (digits.length === 2) {
    if (twoDigitHour >= 1 && twoDigitHour <= 12) return `${padTwo(twoDigitHour)}:`

    // A user typing 9:00 on a numeric keyboard may produce 90 before the
    // mask can insert the colon. Treat that as 09:0 rather than 12:.
    const firstDigit = Number.parseInt(digits[0], 10)
    const secondDigit = Number.parseInt(digits[1], 10)
    if (firstDigit >= 1 && firstDigit <= 9 && secondDigit <= 5) {
      return `${padTwo(firstDigit)}:${secondDigit}`
    }
    return digits
  }

  if (digits.length === 3 && twoDigitHour > 12) {
    return `${padTwo(Number.parseInt(digits[0], 10))}:${digits.slice(1)}`
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

const parseManualTimeInput = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  return hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59
    ? { hour, minute: padTwo(minute) }
    : null
}

const normalizeTimeValue = (
  manualValue: string,
  meridiem: Meridiem,
  storedValue: string
) => {
  const manual = parseManualTimeInput(manualValue)
  if (manual) return formatTime(manual.hour, manual.minute, meridiem)

  const stored = storedValue.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i)
  if (!stored) return null

  const hour = Number.parseInt(stored[1], 10)
  const minute = Number.parseInt(stored[2], 10)
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null

  return formatTime(hour, padTwo(minute), stored[3].toUpperCase() as Meridiem)
}

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

const RequiredFieldAlert: React.FC<{ message: string; visible: boolean }> = ({ message, visible }) => {
  if (!visible) return null

  return <Text accessibilityRole="alert" style={styles.requiredFieldWarning}>{message}</Text>
}

const ProgressiveInputMask: React.FC<{
  complete?: boolean
  mask: string
  value: string
}> = ({ complete = false, mask, value }) => {
  const remainingMask = complete ? '' : mask.slice(Math.min(value.length, mask.length))

  return (
    <Text
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.dateTimeInputMask}
    >
      <Text style={styles.dateTimeInputSpacer}>{value}</Text>
      <Text style={styles.dateTimeInputRemaining}>{remainingMask}</Text>
    </Text>
  )
}

export const EventCreationScreen: React.FC<EventCreationScreenProps> = ({
  initialValue,
  isProcessing = false,
  onClose,
  onContinue,
  onValueChange,
  presentation = 'planning',
  timeGuidance,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [eventName, setEventName] = React.useState(initialValue?.eventName ?? '')
  const eventType: EventType = initialValue?.eventType ?? 'wedding'
  const [date, setDate] = React.useState(initialValue?.date ?? '')
  const [time, setTime] = React.useState(initialValue?.time ?? '')
  const [timeInput, setTimeInput] = React.useState(() => getManualTimeInput(initialValue?.time ?? ''))
  const [timeMeridiem, setTimeMeridiem] = React.useState<Meridiem>(
    () => parseTimeParts(initialValue?.time ?? '').meridiem
  )
  const [isMeridiemMenuOpen, setIsMeridiemMenuOpen] = React.useState(false)
  const [dateTimeError, setDateTimeError] = React.useState('')
  const [hasManualDateLeadTimeError, setHasManualDateLeadTimeError] = React.useState(false)
  const [isEventNameFocused, setIsEventNameFocused] = React.useState(false)
  const [activePicker, setActivePicker] = React.useState<'calendar' | 'time' | null>(null)
  const [venueStatus, setVenueStatus] = React.useState<VenueStatus>(
    initialValue?.venueStatus ?? 'searching'
  )
  const [hasVenueStatusSelection, setHasVenueStatusSelection] = React.useState(
    Boolean(
      initialValue?.eventName
        || initialValue?.date
        || initialValue?.time
        || typeof initialValue?.wantsCoordinator === 'boolean'
    )
  )
  const isSecuredVenueExpanded = hasVenueStatusSelection && venueStatus === 'secured'
  const [venueMap, setVenueMap] = React.useState<VenueMapValue>({
    address: initialValue?.venueAddress ?? '',
    latitude: initialValue?.venueLatitude ?? 10.6765,
    longitude: initialValue?.venueLongitude ?? 122.9511,
    name: initialValue?.venueName ?? '',
  })
  const [venueError, setVenueError] = React.useState('')
  const venuePanelAnimation = React.useRef(
    new Animated.Value(isSecuredVenueExpanded ? 1 : 0)
  ).current
  const [guestCount, setGuestCount] = React.useState(initialValue?.guestCount ?? 120)
  const [selectedWeddingThemes, setSelectedWeddingThemes] = React.useState<string[]>(
    initialValue?.weddingThemes ?? []
  )
  const [isChurchWedding, setIsChurchWedding] = React.useState<boolean | undefined>(
    initialValue?.isChurchWedding
  )
  const [wantsCoordinator, setWantsCoordinator] = React.useState<boolean | undefined>(
    initialValue?.wantsCoordinator
  )
  const [themeLimitMessage, setThemeLimitMessage] = React.useState(false)
  const themeLimitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const eventScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null)
  const optionFocusTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const guestInputScrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const requiredFieldShake = React.useRef(new Animated.Value(0)).current
  const manualDateFieldShake = React.useRef(new Animated.Value(0)).current
  const requiredShakeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRequiredShake = React.useRef<RequiredSection | undefined>(undefined)
  const sectionOffsets = React.useRef<Partial<Record<RequiredSection, number>>>({})
  const [requiredSection, setRequiredSection] = React.useState<RequiredSection>()
  const [requiredNotice, setRequiredNotice] = React.useState('')
  const shouldAskChurchQuestion = eventType === 'wedding' && wantsCoordinator === true

  React.useEffect(
    () => () => {
      if (themeLimitTimer.current) {
        clearTimeout(themeLimitTimer.current)
      }
      if (guestInputScrollTimer.current) {
        clearTimeout(guestInputScrollTimer.current)
      }
      if (optionFocusTimer.current) {
        clearTimeout(optionFocusTimer.current)
      }
      if (requiredShakeTimer.current) {
        clearTimeout(requiredShakeTimer.current)
      }
      requiredFieldShake.stopAnimation()
      manualDateFieldShake.stopAnimation()
    },
    [manualDateFieldShake, requiredFieldShake]
  )

  React.useEffect(() => {
    Animated.timing(venuePanelAnimation, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
      toValue: isSecuredVenueExpanded ? 1 : 0,
      useNativeDriver: false,
    }).start()
  }, [isSecuredVenueExpanded, venuePanelAnimation])

  const toggleWeddingTheme = (theme: string) => {
    if (selectedWeddingThemes.includes(theme)) {
      setSelectedWeddingThemes((current) => current.filter((item) => item !== theme))
      return
    }

    if (selectedWeddingThemes.length >= 2) {
      setSelectedWeddingThemes((current) => [...current.slice(1), theme])
      setThemeLimitMessage(false)
      if (themeLimitTimer.current) {
        clearTimeout(themeLimitTimer.current)
      }
      return
    }

    setSelectedWeddingThemes((current) => [...current, theme])
  }

  const handleTimeChange = (nextTime: string) => {
    const nextTimeParts = parseTimeParts(nextTime)
    setTime(formatTime(nextTimeParts.hour, nextTimeParts.minute, nextTimeParts.meridiem))
    setTimeInput(`${padTwo(nextTimeParts.hour)}:${nextTimeParts.minute}`)
    setTimeMeridiem(nextTimeParts.meridiem)
    setDateTimeError('')
  }

  const handleManualTimeChange = (nextValue: string) => {
    const editableValue = timeInput.endsWith(':') && nextValue === timeInput.slice(0, -1)
      ? nextValue.slice(0, -1)
      : nextValue
    const formattedTime = formatManualTimeInput(editableValue)
    const parsedTime = parseManualTimeInput(formattedTime)
    setTimeInput(formattedTime)
    setDateTimeError('')
    setTime(parsedTime ? formatTime(parsedTime.hour, parsedTime.minute, timeMeridiem) : '')
  }

  const handleMeridiemChange = (nextMeridiem: Meridiem) => {
    animateOptionLayout()
    const parsedTime = parseManualTimeInput(timeInput)
    setTimeMeridiem(nextMeridiem)
    setIsMeridiemMenuOpen(false)
    setDateTimeError('')
    setTime(parsedTime ? formatTime(parsedTime.hour, parsedTime.minute, nextMeridiem) : '')
  }

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate)
    setDateTimeError('')
    setHasManualDateLeadTimeError(false)

    if (time && isPastDateTime(nextDate, time)) {
      const nextAvailableTime = validTimePartsForDate(nextDate, new Date())[0]
      if (nextAvailableTime) {
        handleTimeChange(
          formatTime(
            nextAvailableTime.hour,
            nextAvailableTime.minute,
            nextAvailableTime.meridiem
          )
        )
      } else {
        setTime('')
        setTimeInput('')
      }
    }
  }

  const handleManualDateChange = (nextValue: string) => {
    const editableValue = date.endsWith('/') && nextValue === date.slice(0, -1)
      ? nextValue.slice(0, -1)
      : nextValue
    const formattedDate = formatManualDateInput(editableValue)
    const normalizedDate = normalizeDateValue(formattedDate)
    const hasLeadTimeError = Boolean(normalizedDate && !isEventDateBookable(normalizedDate))

    handleDateChange(formattedDate)
    setHasManualDateLeadTimeError(hasLeadTimeError)

    if (hasLeadTimeError) {
      manualDateFieldShake.stopAnimation()
      manualDateFieldShake.setValue(0)
      Animated.sequence([
        Animated.timing(manualDateFieldShake, {
          duration: 85,
          easing: Easing.inOut(Easing.ease),
          toValue: 7,
          useNativeDriver: true,
        }),
        Animated.timing(manualDateFieldShake, {
          duration: 85,
          easing: Easing.inOut(Easing.ease),
          toValue: -7,
          useNativeDriver: true,
        }),
        Animated.timing(manualDateFieldShake, {
          duration: 85,
          easing: Easing.inOut(Easing.ease),
          toValue: 4,
          useNativeDriver: true,
        }),
        Animated.timing(manualDateFieldShake, {
          duration: 110,
          easing: Easing.inOut(Easing.ease),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }

  const normalizeManualSchedule = () => {
    const normalizedDate = normalizeDateValue(date)
    const normalizedTime = normalizeTimeValue(timeInput, timeMeridiem, time)
    if (!normalizedDate || !normalizedTime) return undefined

    if (normalizedDate !== date) setDate(normalizedDate)
    if (normalizedTime !== time) setTime(normalizedTime)
    const normalizedTimeParts = parseTimeParts(normalizedTime)
    const normalizedTimeInput = `${padTwo(normalizedTimeParts.hour)}:${normalizedTimeParts.minute}`
    if (normalizedTimeInput !== timeInput) setTimeInput(normalizedTimeInput)
    if (normalizedTimeParts.meridiem !== timeMeridiem) {
      setTimeMeridiem(normalizedTimeParts.meridiem)
    }

    return { date: normalizedDate, time: normalizedTime }
  }

  const handleManualDateBlur = () => {
    const normalizedDate = normalizeDateValue(date)
    if (normalizedDate && normalizedDate !== date) handleDateChange(normalizedDate)
  }

  const handleManualTimeBlur = () => {
    const normalizedTime = normalizeTimeValue(timeInput, timeMeridiem, time)
    if (normalizedTime) handleTimeChange(normalizedTime)
  }

  const handleGuestInputFocus = React.useCallback(() => {
    const scrollToGuestInput = () => eventScrollRef.current?.scrollToEnd({ animated: true })

    if (guestInputScrollTimer.current) clearTimeout(guestInputScrollTimer.current)
    requestAnimationFrame(scrollToGuestInput)
    // Android completes its keyboard resize after focus. Scroll again once it
    // settles so the manual guest-count field remains visible.
    guestInputScrollTimer.current = setTimeout(scrollToGuestInput, 220)
  }, [])

  const revealRequiredSection = React.useCallback((section: RequiredSection, message: string) => {
    setRequiredSection(section)
    setRequiredNotice(message)
    pendingRequiredShake.current = section
    requestAnimationFrame(() => {
      eventScrollRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, (sectionOffsets.current[section] ?? 0) - 18),
      })

      if (requiredShakeTimer.current) clearTimeout(requiredShakeTimer.current)
      requiredShakeTimer.current = setTimeout(() => {
        // Only selectable choices shake. The short delay lets the guided
        // scroll finish before drawing attention to the missing choice.
        if (
          pendingRequiredShake.current !== section
          || (
            section !== 'coordinator'
            && section !== 'churchWedding'
            && section !== 'dateTime'
            && section !== 'venueStatus'
          )
        ) return

        requiredFieldShake.stopAnimation()
        requiredFieldShake.setValue(0)
        Animated.sequence([
          Animated.timing(requiredFieldShake, {
            duration: 105,
            easing: Easing.inOut(Easing.ease),
            toValue: 8,
            useNativeDriver: true,
          }),
          Animated.timing(requiredFieldShake, {
            duration: 105,
            easing: Easing.inOut(Easing.ease),
            toValue: -8,
            useNativeDriver: true,
          }),
          Animated.timing(requiredFieldShake, {
            duration: 105,
            easing: Easing.inOut(Easing.ease),
            toValue: 5,
            useNativeDriver: true,
          }),
          Animated.timing(requiredFieldShake, {
            duration: 105,
            easing: Easing.inOut(Easing.ease),
            toValue: -5,
            useNativeDriver: true,
          }),
          Animated.timing(requiredFieldShake, {
            duration: 125,
            easing: Easing.inOut(Easing.ease),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start()
      }, 360)
    })
  }, [requiredFieldShake])

  React.useEffect(() => {
    if (!requiredSection) return

    const isStillIncomplete = {
      churchWedding: shouldAskChurchQuestion && typeof isChurchWedding !== 'boolean',
      coordinator: typeof wantsCoordinator !== 'boolean',
      dateTime: !date || !time || !isEventDateBookable(date) || isPastDateTime(date, time),
      eventName: !eventName.trim(),
      guestCount: guestCount <= 0,
      venue: isSecuredVenueExpanded && !venueMap.name.trim(),
      venueStatus: !hasVenueStatusSelection,
    }[requiredSection]

    if (!isStillIncomplete) {
      if (pendingRequiredShake.current === requiredSection) {
        pendingRequiredShake.current = undefined
      }
      if (requiredShakeTimer.current) clearTimeout(requiredShakeTimer.current)
      setRequiredSection(undefined)
      setRequiredNotice('')
    }
  }, [
    date,
    eventName,
    guestCount,
    hasVenueStatusSelection,
    isChurchWedding,
    isSecuredVenueExpanded,
    requiredSection,
    shouldAskChurchQuestion,
    time,
    venueMap.name,
    wantsCoordinator,
  ])

  const handleCoordinatorPreferenceChange = (nextPreference: boolean) => {
    animateOptionLayout()
    setWantsCoordinator(nextPreference)

    // Church-arrangement details apply only while coordinator planning is
    // requested. An explicit "No" clears that dependent answer; merely
    // hiding this question never interprets it as a "No".
    if (!nextPreference) {
      setIsChurchWedding(undefined)
    }
    focusSelectedSection('coordinator')
  }

  const focusSelectedSection = (section: RequiredSection) => {
    if (optionFocusTimer.current) clearTimeout(optionFocusTimer.current)
    optionFocusTimer.current = setTimeout(() => {
      eventScrollRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, (sectionOffsets.current[section] ?? 0) - 18),
      })
    }, optionSelectionMotionDuration)
  }

  const handleChurchWeddingChange = (nextPreference: boolean) => {
    animateOptionLayout()
    setIsChurchWedding(nextPreference)
    focusSelectedSection('churchWedding')
  }

  const handleContinue = () => {
    if (!eventName.trim()) {
      revealRequiredSection('eventName', 'Enter an event name to continue.')
      return
    }

    if (typeof wantsCoordinator !== 'boolean') {
      revealRequiredSection('coordinator', 'Choose whether you would like an event coordinator.')
      return
    }

    if (shouldAskChurchQuestion && typeof isChurchWedding !== 'boolean') {
      revealRequiredSection('churchWedding', 'Choose whether this is a church wedding.')
      return
    }

    const normalizedSchedule = normalizeManualSchedule()
    if (!normalizedSchedule) {
      setDateTimeError('Enter a valid date and time, for example 07/05/2027 and 09:00 AM.')
      revealRequiredSection('dateTime', 'Enter a valid event date and time to continue.')
      return
    }

    if (isPastDateTime(normalizedSchedule.date, normalizedSchedule.time)) {
      setDateTimeError('Choose a date and time later than the current local time.')
      revealRequiredSection('dateTime', 'Choose a date and time later than the current local time.')
      return
    }

    if (!isEventDateBookable(normalizedSchedule.date)) {
      setDateTimeError(EVENT_BOOKING_LEAD_TIME_MESSAGE)
      revealRequiredSection('dateTime', EVENT_BOOKING_LEAD_TIME_MESSAGE)
      return
    }

    if (!hasVenueStatusSelection) {
      revealRequiredSection('venueStatus', 'Choose a venue status to continue.')
      return
    }

    if (isSecuredVenueExpanded && !venueMap.name.trim()) {
      setVenueError('Choose a location for your secured venue.')
      revealRequiredSection('venue', 'Choose the location of your secured venue.')
      return
    }

    if (guestCount <= 0) {
      revealRequiredSection('guestCount', 'Enter an estimated guest count to continue.')
      return
    }

    // Do not wait for React state to settle after a keyboard edit. Step 2 and
    // the draft save receive the canonical picker-equivalent values now.
    onContinue?.({
      ...value,
      date: normalizedSchedule.date,
      time: normalizedSchedule.time,
    })
  }

  const value = React.useMemo<EventCreationValue>(() => ({
    eventName,
    eventType,
    date,
    time,
    venueStatus,
    venueAddress: venueMap.address,
    venueLatitude: venueMap.latitude,
    venueLongitude: venueMap.longitude,
    venueName: venueMap.name,
    venueSource: isSecuredVenueExpanded && venueMap.name.trim() ? 'external' : undefined,
    externalVenueConfirmed: isSecuredVenueExpanded && Boolean(venueMap.name.trim()),
    guestCount,
    isChurchWedding,
    wantsCoordinator,
    weddingThemes: selectedWeddingThemes,
  }), [
    date,
    eventName,
    eventType,
    guestCount,
    isChurchWedding,
    selectedWeddingThemes,
    time,
    venueMap.address,
    venueMap.latitude,
    venueMap.longitude,
    venueMap.name,
    venueStatus,
    isSecuredVenueExpanded,
    wantsCoordinator,
  ])

  // Keep partially entered details in the shared planning state even when a
  // client goes back to another step before explicitly saving the draft.
  React.useEffect(() => {
    onValueChange?.(value)
  }, [onValueChange, value])

  return (
    <View style={styles.screen}>
      <PlanningScreenHeader
        brandTitle={presentation !== 'savedPlan'}
        currentStep={1}
        label={presentation === 'savedPlan' ? 'Saved Plan' : 'CREATE EVENT'}
        neumorphicNavigation
        nextEnabled={!isProcessing}
        onBack={isProcessing ? undefined : onClose}
        onBrandPress={presentation === 'savedPlan' || isProcessing ? undefined : onClose}
        onNext={handleContinue}
        showProgress={presentation !== 'savedPlan'}
        showBackButton
        title={presentation === 'savedPlan' ? 'Edit Event Details' : 'Create Event'}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAwareContent}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ref={eventScrollRef}
          showsVerticalScrollIndicator={false}
        >
        <View style={[styles.mainContent, isWide && styles.horizontalPaddingWide]}>
          <View style={[styles.form, isWide && styles.formWide]}>
            <View style={styles.intro}>
              <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.pageTitle, isWide && styles.pageTitleWide]}>
                Your Wedding Starts Here
              </Text>
              <Text style={styles.pageDescription}>
                Tell us a few details about your special day so we can personalize your planning experience.
              </Text>
            </View>

            <View
              onLayout={(event) => {
                sectionOffsets.current.eventName = event.nativeEvent.layout.y
              }}
              style={styles.fieldGroup}
            >
              <Text style={styles.sectionFieldLabel}>EVENT NAME</Text>
              <View
                style={[
                  styles.textInputShell,
                  isEventNameFocused && styles.textInputShellFocused,
                  requiredSection === 'eventName' && styles.requiredInputBorder,
                ]}
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
              <RequiredFieldAlert
                message={requiredNotice}
                visible={requiredSection === 'eventName'}
              />
            </View>

            <View style={styles.themeSection}>
              <View style={styles.themeLabelRow}>
                <Text style={styles.sectionFieldLabel}>WEDDING THEME</Text>
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

            <View
              onLayout={(event) => {
                sectionOffsets.current.coordinator = event.nativeEvent.layout.y
              }}
              style={styles.coordinatorPreferenceSection}
            >
              <Text style={styles.sectionFieldLabel}>WOULD YOU LIKE AN EVENT COORDINATOR?</Text>
              <Animated.View
                style={[
                  styles.churchWeddingChoices,
                  requiredSection === 'coordinator' && { transform: [{ translateX: requiredFieldShake }] },
                ]}
              >
                {[
                  {
                    description: 'Include Event Coordinator in your budget and browse coordinators when you are ready.',
                    label: 'Yes — I want a coordinator',
                    value: true,
                  },
                  {
                    description: 'Continue without coordinator planning. You can change this before booking services.',
                    label: 'No — I will plan without one',
                    value: false,
                  },
                ].map((option) => {
                  const selected = wantsCoordinator === option.value
                  return (
                    <Pressable
                      key={option.label}
                      accessibilityLabel={option.label}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => handleCoordinatorPreferenceChange(option.value)}
                      style={({ pressed }) => [
                        styles.churchWeddingChoice,
                        selected && styles.selectionCardActive,
                        requiredSection === 'coordinator' && styles.requiredChoiceBorder,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <View style={[styles.churchWeddingIcon, selected && styles.churchWeddingIconSelected]}>
                        <MaterialIcons
                          color={palette.burgundy}
                          name={option.value ? 'support-agent' : 'event-busy'}
                          size={21}
                        />
                      </View>
                      <View style={styles.churchWeddingCopy}>
                        <Text style={styles.churchWeddingTitle}>{option.label}</Text>
                        <Text style={styles.churchWeddingDescription}>{option.description}</Text>
                      </View>
                      {selected ? <SelectionCheck /> : null}
                    </Pressable>
                  )
                })}
              </Animated.View>
              <RequiredFieldAlert
                message={requiredNotice}
                visible={requiredSection === 'coordinator'}
              />
            </View>

            {shouldAskChurchQuestion ? (
              <View
                onLayout={(event) => {
                  sectionOffsets.current.churchWedding = event.nativeEvent.layout.y
                }}
                style={styles.churchWeddingSection}
              >
                <Text style={styles.sectionFieldLabel}>IS THIS A CHURCH WEDDING?</Text>
                <View accessibilityLiveRegion="polite" style={styles.churchWeddingNotice}>
                  <MaterialIcons color="#BA1A1A" name="error-outline" size={18} />
                  <Text style={styles.churchWeddingNoticeText}>
                    This does not reserve a church or change your budget.
                  </Text>
                </View>
                <Animated.View
                  style={[
                    styles.churchWeddingChoices,
                    requiredSection === 'churchWedding' && { transform: [{ translateX: requiredFieldShake }] },
                  ]}
                >
                  {[
                    {
                      description: 'A coordinator can help with church arrangements after their booking is accepted.',
                      label: 'Yes — Church Wedding',
                      value: true,
                    },
                    {
                      description: 'Continue with your preferred venue or ceremony location.',
                      label: 'No - Non-Church / Outdoor Wedding',
                      value: false,
                    },
                  ].map((option) => {
                    const selected = isChurchWedding === option.value
                    return (
                      <Pressable
                        key={option.label}
                        accessibilityLabel={option.label}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() => handleChurchWeddingChange(option.value)}
                        style={({ pressed }) => [
                          styles.churchWeddingChoice,
                          selected && styles.selectionCardActive,
                          requiredSection === 'churchWedding' && styles.requiredChoiceBorder,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <View style={[styles.churchWeddingIcon, selected && styles.churchWeddingIconSelected]}>
                          <MaterialIcons
                            color={palette.burgundy}
                            name={option.value ? 'church' : 'location-on'}
                            size={21}
                          />
                        </View>
                        <View style={styles.churchWeddingCopy}>
                          <Text style={styles.churchWeddingTitle}>{option.label}</Text>
                          <Text style={styles.churchWeddingDescription}>{option.description}</Text>
                        </View>
                        {selected ? <SelectionCheck /> : null}
                      </Pressable>
                    )
                  })}
                </Animated.View>
                <RequiredFieldAlert
                  message={requiredNotice}
                  visible={requiredSection === 'churchWedding'}
                />
              </View>
            ) : null}

            <View
              onLayout={(event) => {
                sectionOffsets.current.dateTime = event.nativeEvent.layout.y
              }}
              style={styles.dateTimeSection}
            >
              <Animated.View
                style={[
                  styles.dateTimeGrid,
                  isWide && styles.dateTimeGridWide,
                  requiredSection === 'dateTime'
                  && !hasManualDateLeadTimeError
                  && { transform: [{ translateX: requiredFieldShake }] },
                ]}
              >
                <View style={styles.dateTimeField}>
                  <Text style={styles.sectionFieldLabel}>DATE</Text>
                  <Animated.View
                    style={{ transform: [{ translateX: manualDateFieldShake }] }}
                  >
                    <View
                      style={[
                        styles.iconInputShell,
                        (requiredSection === 'dateTime' || hasManualDateLeadTimeError) && styles.requiredInputBorder,
                      ]}
                    >
                      <Pressable
                        accessibilityLabel="Open full event calendar"
                        accessibilityRole="button"
                        hitSlop={6}
                        onPress={() => setActivePicker('calendar')}
                        style={({ pressed }) => [styles.inputIconButton, pressed && styles.pressed]}
                      >
                        <MaterialIcons color={palette.burgundy} name="calendar-month" size={22} />
                      </Pressable>
                      <View style={styles.dateTimeInputFrame}>
                        <ProgressiveInputMask mask="MM/DD/YYYY" value={date} />
                        <TextInput
                          accessibilityLabel="Event date"
                          autoCapitalize="none"
                          autoCorrect={false}
                          cursorColor={palette.burgundy}
                          keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                          maxLength={10}
                          onBlur={handleManualDateBlur}
                          onChangeText={handleManualDateChange}
                          onFocus={() => setIsMeridiemMenuOpen(false)}
                          selectionColor={palette.burgundy}
                          style={[
                            styles.dateTimeTextInput,
                            Platform.OS === 'web'
                              ? ({ caretColor: palette.burgundy } as unknown as TextStyle)
                              : null,
                          ]}
                          value={date}
                        />
                      </View>
                    </View>
                  </Animated.View>
                  {hasManualDateLeadTimeError ? (
                    <View accessibilityLiveRegion="polite" style={styles.manualDateLeadTimeNotice}>
                      <MaterialIcons color="#BA1A1A" name="info-outline" size={18} />
                      <Text style={styles.timeGuidanceText}>{EVENT_BOOKING_LEAD_TIME_MESSAGE}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.dateTimeField, isMeridiemMenuOpen && styles.dateTimeFieldMenuOpen]}>
                  <Text style={styles.sectionFieldLabel}>TIME</Text>
                  <View style={[styles.iconInputShell, requiredSection === 'dateTime' && styles.requiredInputBorder]}>
                    <Pressable
                      accessibilityLabel="Open event time picker"
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() => setActivePicker('time')}
                      style={({ pressed }) => [styles.inputIconButton, pressed && styles.pressed]}
                    >
                      <MaterialIcons color={palette.burgundy} name="timer" size={22} />
                    </Pressable>
                    <View style={styles.dateTimeInputFrame}>
                      <ProgressiveInputMask
                        complete={Boolean(parseManualTimeInput(timeInput))}
                        mask="HH:MM"
                        value={timeInput}
                      />
                      <TextInput
                        accessibilityLabel="Event time"
                        autoCapitalize="none"
                        autoCorrect={false}
                        cursorColor={palette.burgundy}
                        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                        maxLength={5}
                        onBlur={handleManualTimeBlur}
                        onChangeText={handleManualTimeChange}
                        onFocus={() => setIsMeridiemMenuOpen(false)}
                        selectionColor={palette.burgundy}
                        style={[
                          styles.dateTimeTextInput,
                          Platform.OS === 'web'
                            ? ({ caretColor: palette.burgundy } as unknown as TextStyle)
                            : null,
                        ]}
                        value={timeInput}
                      />
                    </View>
                    <View style={styles.meridiemSelector}>
                      <Pressable
                        accessibilityLabel={`Select AM or PM, currently ${timeMeridiem}`}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isMeridiemMenuOpen }}
                        onPress={() => setIsMeridiemMenuOpen((open) => !open)}
                        style={({ pressed }) => [styles.meridiemButton, pressed && styles.pressed]}
                      >
                        <Text style={styles.meridiemButtonText}>{timeMeridiem}</Text>
                        <MaterialIcons color={palette.burgundy} name="keyboard-arrow-down" size={18} />
                      </Pressable>
                      {isMeridiemMenuOpen ? (
                        <View style={styles.meridiemMenu}>
                          {meridiemOptions.map((option) => (
                            <Pressable
                              key={option}
                              accessibilityRole="button"
                              accessibilityState={{ selected: option === timeMeridiem }}
                              onPress={() => handleMeridiemChange(option)}
                              style={({ pressed }) => [
                                styles.meridiemOption,
                                option === timeMeridiem && styles.meridiemOptionSelected,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text style={[styles.meridiemOptionText, option === timeMeridiem && styles.meridiemOptionTextSelected]}>
                                {option}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </Animated.View>
              <RequiredFieldAlert
                message={requiredSection === 'dateTime' ? requiredNotice : dateTimeError}
                visible={
                  !hasManualDateLeadTimeError
                  && (requiredSection === 'dateTime' || Boolean(dateTimeError))
                }
              />
              <View
                accessibilityLiveRegion="polite"
                style={[styles.timeGuidanceNotice, isWide && styles.timeGuidanceNoticeWide]}
              >
                <MaterialIcons color="#BA1A1A" name="info-outline" size={18} />
                <Text style={styles.timeGuidanceText}>
                  {timeGuidance ?? 'Service operating hours may vary depending on the provider and selected package.'}
                </Text>
              </View>
            </View>

            <View
              onLayout={(event) => {
                sectionOffsets.current.venueStatus = event.nativeEvent.layout.y
                sectionOffsets.current.venue = event.nativeEvent.layout.y
              }}
              style={[styles.fieldGroup, styles.venueStatusSection]}
            >
              <Text style={styles.sectionFieldLabel}>VENUE STATUS</Text>
              <Animated.View
                style={[
                  styles.venueGrid,
                  requiredSection === 'venueStatus' && {
                    transform: [{ translateX: requiredFieldShake }],
                  },
                ]}
              >
                {venueOptions.map((option) => {
                  const selected = hasVenueStatusSelection && venueStatus === option.id
                  return (
                    <React.Fragment key={option.id}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={() => {
                          animateOptionLayout()
                          if (selected) {
                            setHasVenueStatusSelection(false)
                            setVenueStatus('searching')
                            setVenueError('')
                            return
                          }
                          setVenueStatus(option.id)
                          setHasVenueStatusSelection(true)
                          setVenueError('')
                          focusSelectedSection('venueStatus')
                        }}
                        style={({ pressed }) => [
                          styles.venueCard,
                          selected && styles.selectionCardActive,
                          selected && requiredSection === 'venue' && styles.requiredChoiceBorder,
                          requiredSection === 'venueStatus' && styles.requiredChoiceBorder,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <View style={[styles.venueIconCircle, selected && styles.venueIconSelected]}>
                          {React.isValidElement(option.icon) ? (
                            React.cloneElement(option.icon as React.ReactElement<{ color?: string }>, {
                              color: palette.burgundyDark,
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
                          </View>
                        ) : null}
                      </Pressable>

                      {option.id === 'secured' ? (
                        <Animated.View
                          pointerEvents={isSecuredVenueExpanded ? 'auto' : 'none'}
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
              </Animated.View>
              <RequiredFieldAlert
                message={requiredNotice}
                visible={requiredSection === 'venueStatus' || requiredSection === 'venue'}
              />
            </View>

            <View
              onLayout={(event) => {
                sectionOffsets.current.guestCount = event.nativeEvent.layout.y
              }}
              style={styles.guestSection}
            >
              <View style={styles.guestLabelRow}>
                <Text style={[styles.sectionFieldLabel, styles.guestLabelCentered]}>
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
                  ]}
                >
                  {({ pressed }) => (
                    <Text style={[styles.stepperButtonText, pressed && styles.stepperButtonTextPressed]}>
                      -
                    </Text>
                  )}
                </Pressable>
                <View style={[styles.guestInputShell, requiredSection === 'guestCount' && styles.requiredInputBorder]}>
                  <TextInput
                    accessibilityLabel="Estimated guest count"
                    keyboardType="number-pad"
                    onChangeText={(text) => {
                      const parsed = Number.parseInt(text.replace(/\D/g, ''), 10)
                      setGuestCount(Number.isFinite(parsed) ? parsed : 0)
                    }}
                    onFocus={handleGuestInputFocus}
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
                  ]}
                >
                  {({ pressed }) => (
                    <Text style={[styles.stepperButtonText, pressed && styles.stepperButtonTextPressed]}>
                      +
                    </Text>
                  )}
                </Pressable>
              </View>
              <RequiredFieldAlert
                message={requiredNotice}
                visible={requiredSection === 'guestCount'}
              />
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

        <View style={styles.footer}>
        <View style={[styles.footerContent, isWide && styles.horizontalPaddingWide]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isProcessing, disabled: isProcessing }}
            disabled={isProcessing}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              isWide && styles.continueButtonWide,
              isProcessing && styles.continueDisabled,
              pressed && styles.continuePressed,
            ]}
          >
            {isProcessing ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={styles.continueText}>
              {isProcessing ? 'SAVING…' : isWide ? 'CONTINUE' : 'NEXT STEP'}
            </Text>
            {!isProcessing ? <Text style={styles.continueArrow}>{'\u2192'}</Text> : null}
          </Pressable>
        </View>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {activePicker === 'calendar' ? (
        <CalendarPickerModal
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
  const [remoteResults, setRemoteResults] = React.useState<VenueMapValue[] | null>(null)
  const [, setIsSearching] = React.useState(false)
  const pinLookupRequestRef = React.useRef(0)
  const normalizedQuery = query.trim().toLowerCase()
  const suggestedResults = normalizedQuery
    ? bacolodVenueSuggestions
        .filter(
          (venue) =>
            venue.name.toLowerCase().includes(normalizedQuery) ||
            venue.address.toLowerCase().includes(normalizedQuery)
        )
        .slice(0, 4)
    : []
  const results = remoteResults ?? suggestedResults

  const chooseVenue = (venue: VenueMapValue) => {
    pinLookupRequestRef.current += 1
    setQuery(venue.name)
    setRemoteResults(null)
    onChange(venue)
  }

  const searchVenue = async () => {
    const requestedQuery = query.trim()
    if (!requestedQuery) return

    if (!mapTilerKey || Platform.OS !== 'web') {
      if (suggestedResults[0]) chooseVenue(suggestedResults[0])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(`${requestedQuery}, Bacolod City, Philippines`)}.json?key=${encodeURIComponent(mapTilerKey)}&limit=5&proximity=122.9511,10.6765`
      )
      if (!response.ok) throw new Error('Location search was unavailable.')
      const payload = await response.json() as {
        features?: Array<{ center?: unknown; place_name?: unknown; text?: unknown }>
      }
      const nextResults = (payload.features ?? []).flatMap((feature) => {
        const center = Array.isArray(feature.center) ? feature.center : []
        const longitude = typeof center[0] === 'number' ? center[0] : NaN
        const latitude = typeof center[1] === 'number' ? center[1] : NaN
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
        const name = typeof feature.text === 'string' && feature.text.trim()
          ? feature.text.trim()
          : requestedQuery
        const address = typeof feature.place_name === 'string' && feature.place_name.trim()
          ? feature.place_name.trim()
          : `${requestedQuery}, Bacolod City, Negros Occidental`
        return [{ address, latitude, longitude, name }]
      })
      setRemoteResults(nextResults)
    } catch {
      setRemoteResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const pinVenue = (latitude: number, longitude: number) => {
    const requestId = pinLookupRequestRef.current + 1
    pinLookupRequestRef.current = requestId
    const verifiedVenue = verifiedVenueAtPin(latitude, longitude)
    const pinnedVenue: VenueMapValue = verifiedVenue
      ? { ...verifiedVenue, latitude, longitude }
      : {
          address: 'Pinned location in Bacolod City, Negros Occidental',
          latitude,
          longitude,
          name: 'Pinned location',
        }

    // Move and retain the marker immediately. The reverse lookup below only
    // improves the location name; it never re-creates the map.
    setQuery(pinnedVenue.name)
    setRemoteResults(null)
    onChange(pinnedVenue)

    if (verifiedVenue || !mapTilerKey || Platform.OS !== 'web') return

    void (async () => {
      try {
        let name = ''
        let address = ''
        const poiResponse = await fetch(
          `https://api.maptiler.com/geocoding/${longitude.toFixed(6)},${latitude.toFixed(6)}.json?key=${encodeURIComponent(mapTilerKey)}&language=en&types=poi&limit=1`
        )
        if (poiResponse.ok) {
          const poiPayload = await poiResponse.json() as {
            features?: Array<{ center?: unknown; place_name?: unknown; text?: unknown }>
          }
          const poi = poiPayload.features?.[0]
          const center = Array.isArray(poi?.center) ? poi.center : []
          const poiLongitude = typeof center[0] === 'number' ? center[0] : NaN
          const poiLatitude = typeof center[1] === 'number' ? center[1] : NaN
          const poiIsAtPin = Number.isFinite(poiLatitude)
            && Number.isFinite(poiLongitude)
            && distanceInKilometres({ latitude, longitude }, { latitude: poiLatitude, longitude: poiLongitude }) <= 0.12
          if (poiIsAtPin) {
            name = typeof poi?.text === 'string' ? poi.text.trim() : ''
            address = typeof poi?.place_name === 'string' ? poi.place_name.trim() : ''
          }
        }

        // If no named place contains the pin, use the actual nearby street or
        // address details rather than assigning a different venue name.
        if (!name || !address) {
          const response = await fetch(
            `https://api.maptiler.com/geocoding/${longitude.toFixed(6)},${latitude.toFixed(6)}.json?key=${encodeURIComponent(mapTilerKey)}&language=en`
          )
          if (response.ok) {
            const payload = await response.json() as {
              features?: Array<{ place_name?: unknown; text?: unknown }>
            }
            const result = payload.features?.[0]
            name = name || (typeof result?.text === 'string' ? result.text.trim() : '')
            address = address || (typeof result?.place_name === 'string' ? result.place_name.trim() : '')
          }
        }
        if (pinLookupRequestRef.current !== requestId) return
        const resolvedName = name || pinnedVenue.name
        const resolvedAddress = address || pinnedVenue.address
        setQuery(resolvedName)
        onChange({ address: resolvedAddress, latitude, longitude, name: resolvedName })
      } catch {
        // The selected coordinates remain valid even if a readable place name
        // is unavailable from the optional reverse-geocoding service.
      }
    })()
  }

  const searchBox = (fullscreen = false) => (
    <View style={[styles.venueSearchArea, fullscreen && styles.venueSearchAreaFullscreen]}>
      <View style={styles.venueSearchShell}>
        <MaterialIcons color={palette.burgundy} name="search" size={21} />
        <TextInput
          accessibilityLabel="Search secured venue in Bacolod"
          onChangeText={(nextQuery) => {
            setQuery(nextQuery)
            setRemoteResults(null)
          }}
          onSubmitEditing={() => void searchVenue()}
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
            <Text style={styles.venueNoResults}>{remoteResults ? 'No locations found. Check the spelling or place the pin manually.' : 'Press search to find a venue, or tap the map to place the pin manually.'}</Text>
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
              <MaterialIcons color={colors.closeIcon} name="close" size={25} />
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
  const [isHostedMapUnavailable, setIsHostedMapUnavailable] = React.useState(false)
  const [mapRetryKey, setMapRetryKey] = React.useState(0)

  if (hasMapTilerVenueMap) {
    if (!isHostedMapUnavailable) {
      return (
        <MapTilerVenueMap
          key={mapRetryKey}
          coordinates={{ latitude: value.latitude, longitude: value.longitude }}
          fullscreen={fullscreen}
          onPin={({ latitude, longitude }) => onPin(latitude, longitude)}
          onUnavailable={() => setIsHostedMapUnavailable(true)}
        />
      )
    }
  }

  const west = 122.91
  const east = 122.99
  const north = 10.73
  const south = 10.62
  const pinX = Math.max(0, Math.min(1, (value.longitude - west) / (east - west)))
  const pinY = Math.max(0, Math.min(1, (north - value.latitude) / (north - south)))

  const localFallback = (
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

  if (!isHostedMapUnavailable) return localFallback

  return (
    <View style={[styles.mapFallbackSurface, fullscreen && styles.mapSurfaceFullscreen]}>
      {localFallback}
      <Pressable
        accessibilityLabel="Retry interactive venue map"
        accessibilityRole="button"
        onPress={() => {
          setMapRetryKey((current) => current + 1)
          setIsHostedMapUnavailable(false)
        }}
        style={({ pressed }) => [styles.mapRetryButton, pressed && styles.mapRetryButtonPressed]}
      >
        <MaterialIcons color={palette.surface} name="refresh" size={16} />
        <Text style={styles.mapRetryText}>Retry map</Text>
      </Pressable>
    </View>
  )
}

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
  const latestOffset = React.useRef(0)
  const optionsRef = React.useRef(options)
  const onSelectRef = React.useRef(onSelect)
  const selectedRef = React.useRef(selected)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selected))

  optionsRef.current = options
  onSelectRef.current = onSelect
  selectedRef.current = selected

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      listRef.current?.scrollToOffset({
        animated: false,
        offset: selectedIndex * wheelRowHeight,
      })
      latestOffset.current = selectedIndex * wheelRowHeight
    }, 0)

    return () => clearTimeout(timeout)
  }, [options, selectedIndex])

  React.useEffect(
    () => () => {
      if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current)
    },
    []
  )

  const settleWheel = (offset: number, animated = true) => {
    const currentOptions = optionsRef.current
    const index = Math.max(
      0,
      Math.min(currentOptions.length - 1, Math.round(offset / wheelRowHeight))
    )
    const snappedOffset = index * wheelRowHeight
    latestOffset.current = snappedOffset

    if (Math.abs(offset - snappedOffset) > 0.5) {
      listRef.current?.scrollToOffset({ animated, offset: snappedOffset })
    }

    const option = currentOptions[index]
    if (option && option.value !== selectedRef.current) {
      selectedRef.current = option.value
      onSelectRef.current(option.value)
    }
  }

  const scheduleWheelSettle = (offset: number) => {
    latestOffset.current = offset
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current)
    dragSettleTimer.current = setTimeout(() => {
      dragSettleTimer.current = null
      settleWheel(latestOffset.current)
    }, 120)
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
        decelerationRate="fast"
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
          dragSettleTimer.current = null
          settleWheel(event.nativeEvent.contentOffset.y)
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollOffset } } }],
          {
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              scheduleWheelSettle(event.nativeEvent.contentOffset.y)
            },
            useNativeDriver: true,
          }
        )}
        onScrollEndDrag={(event) => {
          scheduleWheelSettle(event.nativeEvent.contentOffset.y)
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
                  if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current)
                  dragSettleTimer.current = null
                  latestOffset.current = index * wheelRowHeight
                  listRef.current?.scrollToOffset({
                    animated: true,
                    offset: index * wheelRowHeight,
                  })
                  if (item.value !== selectedRef.current) {
                    selectedRef.current = item.value
                    onSelectRef.current(item.value)
                  }
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

interface CalendarPickerModalProps {
  onChange: (value: string) => void
  onClose: () => void
  value: string
}

const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({ onChange, onClose, value }) => {
  const now = React.useRef(new Date()).current
  const minimumDate = React.useMemo(() => minimumEventBookingDate(now), [now])
  const maximumYear = minimumDate.getFullYear() + 7
  const maximumDate = React.useMemo(
    () => new Date(maximumYear, 11, 31),
    [maximumYear]
  )
  const parsedValue = parseDateValue(value)
  const initialDate = parsedValue && parsedValue >= minimumDate && parsedValue <= maximumDate
    ? parsedValue
    : minimumDate
  const draftDate = initialDate
  const [visibleMonth, setVisibleMonth] = React.useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  )
  const firstAvailableMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1)
  const lastAvailableMonth = new Date(maximumDate.getFullYear(), maximumDate.getMonth(), 1)
  const visibleYear = visibleMonth.getFullYear()
  const visibleMonthIndex = visibleMonth.getMonth()
  const daysInVisibleMonth = new Date(visibleYear, visibleMonthIndex + 1, 0).getDate()
  const leadingBlankDays = new Date(visibleYear, visibleMonthIndex, 1).getDay()
  const calendarCellCount = Math.ceil((leadingBlankDays + daysInVisibleMonth) / 7) * 7
  const yearOptions = Array.from({ length: 8 }, (_, index) => minimumDate.getFullYear() + index)
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const isAllowedDate = React.useCallback(
    (candidate: Date) => candidate >= minimumDate && candidate <= maximumDate,
    [maximumDate, minimumDate]
  )
  const setCalendarMonth = (year: number, monthIndex: number) => {
    const requested = new Date(year, monthIndex, 1)
    if (requested < firstAvailableMonth) {
      setVisibleMonth(firstAvailableMonth)
      return
    }
    if (requested > lastAvailableMonth) {
      setVisibleMonth(lastAvailableMonth)
      return
    }
    setVisibleMonth(requested)
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.modalOverlay}>
        <BlurView
          blurMethod="dimezisBlurViewSdk31Plus"
          blurReductionFactor={1}
          intensity={42}
          tint="dark"
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            accessibilityLabel="Close event calendar"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.modalScrim}
          />
        </BlurView>
        <View accessibilityViewIsModal style={[styles.pickerSheet, styles.calendarSheet]}>
          <View style={[styles.pickerHeader, styles.pickerHeaderCentered]}>
            <Text accessibilityRole="header" style={[styles.pickerTitle, styles.pickerTitleCentered]}>
              Select event date
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.calendarContent}
            showsVerticalScrollIndicator={false}
            style={styles.calendarScroll}
          >
            <View style={styles.calendarMonthHeader}>
            <Pressable
              accessibilityLabel="Previous calendar month"
              accessibilityRole="button"
              accessibilityState={{ disabled: visibleMonth <= firstAvailableMonth }}
              disabled={visibleMonth <= firstAvailableMonth}
              onPress={() => setCalendarMonth(visibleYear, visibleMonthIndex - 1)}
              style={({ pressed }) => [
                styles.calendarNavigationButton,
                visibleMonth <= firstAvailableMonth && styles.calendarNavigationDisabled,
                pressed && visibleMonth > firstAvailableMonth && styles.pressed,
              ]}
            >
              <MaterialIcons color={palette.burgundy} name="chevron-left" size={24} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.calendarMonthLabel}>
              {`${monthNames[visibleMonthIndex]} ${visibleYear}`}
            </Text>
            <Pressable
              accessibilityLabel="Next calendar month"
              accessibilityRole="button"
              accessibilityState={{ disabled: visibleMonth >= lastAvailableMonth }}
              disabled={visibleMonth >= lastAvailableMonth}
              onPress={() => setCalendarMonth(visibleYear, visibleMonthIndex + 1)}
              style={({ pressed }) => [
                styles.calendarNavigationButton,
                visibleMonth >= lastAvailableMonth && styles.calendarNavigationDisabled,
                pressed && visibleMonth < lastAvailableMonth && styles.pressed,
              ]}
            >
              <MaterialIcons color={palette.burgundy} name="chevron-right" size={24} />
            </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.calendarYearList}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {yearOptions.map((year) => {
                const selected = year === visibleYear
                return (
                  <Pressable
                    key={year}
                    accessibilityLabel={`Show calendar year ${year}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCalendarMonth(year, visibleMonthIndex)}
                    style={({ pressed }) => [
                      styles.calendarYearButton,
                      selected && styles.calendarYearButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.calendarYearText, selected && styles.calendarYearTextSelected]}>
                      {year}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.calendarWeekdays}>
              {weekdayLabels.map((weekday) => (
                <Text key={weekday} style={styles.calendarWeekday}>{weekday}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {Array.from({ length: calendarCellCount }, (_, index) => {
                const day = index - leadingBlankDays + 1
                if (day < 1 || day > daysInVisibleMonth) {
                  return <View key={`blank-${index}`} style={styles.calendarDayCell} />
                }

                const candidate = new Date(visibleYear, visibleMonthIndex, day)
                const allowed = isAllowedDate(candidate)
                const selected = isSameLocalDay(candidate, draftDate)
                const today = isSameLocalDay(candidate, now)

                return (
                  <View key={formatDateValue(candidate)} style={styles.calendarDayCell}>
                    <Pressable
                      accessibilityLabel={`${monthNames[visibleMonthIndex]} ${day}, ${visibleYear}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !allowed, selected }}
                      disabled={!allowed}
                      onPress={() => {
                        onChange(formatDateValue(candidate))
                        onClose()
                      }}
                      style={({ pressed }) => [
                        styles.calendarDayButton,
                        today && styles.calendarDayButtonToday,
                        selected && styles.calendarDayButtonSelected,
                        !allowed && styles.calendarDayButtonDisabled,
                        pressed && allowed && styles.pressed,
                      ]}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        selected && styles.calendarDayTextSelected,
                        !allowed && styles.calendarDayTextDisabled,
                      ]}>
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
            <View style={[styles.timeGuidanceNotice, styles.calendarLeadTimeNotice]}>
              <MaterialIcons color="#BA1A1A" name="info-outline" size={18} />
              <Text style={styles.timeGuidanceText}>{EVENT_BOOKING_LEAD_TIME_MESSAGE}</Text>
            </View>
          </ScrollView>
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
    if (next) {
      setSelected(next)
    }
  }

  const selectHour = (hour: number) => {
    const matching = validTimes.filter(
      (option) => option.meridiem === selected.meridiem && option.hour === hour
    )
    const next = matching.find((option) => option.minute === selected.minute) ?? matching[0]
    if (next) {
      setSelected(next)
    }
  }

  const selectMinute = (minute: string) => {
    const next = validTimes.find(
      (option) =>
        option.meridiem === selected.meridiem &&
        option.hour === selected.hour &&
        option.minute === minute
    )
    if (next) {
      setSelected(next)
    }
  }

  const confirmTime = () => {
    const confirmed = validTimes.find(
      (option) =>
        option.hour === selected.hour &&
        option.minute === selected.minute &&
        option.meridiem === selected.meridiem
    ) ?? validTimes[0]

    if (!confirmed) return

    onChange(formatTime(confirmed.hour, confirmed.minute, confirmed.meridiem))
    onClose()
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.modalOverlay}>
        <BlurView
          blurMethod="dimezisBlurViewSdk31Plus"
          blurReductionFactor={1}
          intensity={42}
          tint="dark"
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            accessibilityLabel="Close event time picker"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.modalScrim}
          />
        </BlurView>
        <View accessibilityViewIsModal style={styles.pickerSheet}>
          <View style={[styles.pickerHeader, styles.pickerHeaderCentered]}>
            <Text accessibilityRole="header" style={[styles.pickerTitle, styles.pickerTitleCentered]}>
              Pick event time
            </Text>
          </View>
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
          <Pressable
            accessibilityLabel="Confirm event time"
            accessibilityRole="button"
            onPress={confirmTime}
            style={({ pressed }) => [styles.timePickerConfirmButton, pressed && styles.continuePressed]}
          >
            <Text style={styles.timePickerConfirmText}>CONFIRM TIME</Text>
          </Pressable>
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
  background: '#E9EDF0',
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
  keyboardAwareContent: { flex: 1 },
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
  scrollContent: { paddingBottom: 32 },
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
  pageTitle: { color: '#57636C', fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.25, marginBottom: 16 },
  pageTitleWide: { fontSize: 36, lineHeight: 44, letterSpacing: -0.5 },
  pageDescription: { color: '#87929A', fontSize: 18, lineHeight: 30 },
  fieldGroup: { gap: 12 },
  fieldLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  sectionFieldLabel: { color: palette.muted, fontSize: 14, lineHeight: 20, fontWeight: '800', letterSpacing: 1.2 },
  textInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    boxShadow: 'inset 4px 4px 8px rgba(160, 171, 180, 0.54), inset -4px -4px 8px rgba(255, 255, 255, 0.96)',
  },
  textInputShellFocused: { borderColor: '#6B1E2E' },
  requiredInputBorder: { borderColor: '#BA1A1A' },
  requiredChoiceBorder: { borderColor: '#BA1A1A' },
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
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    backgroundColor: neutralSelection.surface,
    boxShadow: neutralSelection.raisedShadow,
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
  dateTimeSection: { gap: 12 },
  dateTimeGrid: { gap: 24 },
  dateTimeGridWide: { flexDirection: 'row' },
  dateTimeError: { color: '#BA1A1A', fontSize: 13, lineHeight: 19 },
  dateTimeField: { flex: 1, gap: 12 },
  dateTimeFieldMenuOpen: {
    zIndex: 10,
    // The AM/PM menu is positioned over the input shell. Reserve its full
    // height in the field so validation and guidance content starts below it.
    paddingBottom: 80,
  },
  timeGuidanceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.20)',
    borderRadius: 12,
    backgroundColor: 'rgba(186, 26, 26, 0.10)',
    padding: 12,
  },
  timeGuidanceNoticeWide: { alignSelf: 'flex-end', width: '48%' },
  timeGuidanceText: { flex: 1, color: '#8F1010', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  manualDateLeadTimeNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.20)',
    borderRadius: 12,
    backgroundColor: 'rgba(186, 26, 26, 0.10)',
    padding: 12,
  },
  iconInputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    paddingHorizontal: 16,
    boxShadow: 'inset 4px 4px 8px rgba(160, 171, 180, 0.54), inset -4px -4px 8px rgba(255, 255, 255, 0.96)',
  },
  inputIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#E9EDF0',
    boxShadow: '2px 2px 5px rgba(160, 171, 180, 0.46), -2px -2px 5px rgba(255, 255, 255, 0.92)',
  },
  dateTimeInputFrame: {
    position: 'relative',
    minWidth: 0,
    minHeight: 50,
    flex: 1,
  },
  dateTimeInputMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  dateTimeInputSpacer: { color: 'transparent' },
  dateTimeInputRemaining: { color: '#A3A4A4' },
  dateTimeTextInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    color: palette.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 12,
    paddingVertical: 13,
    outlineWidth: 0,
  },
  meridiemSelector: { position: 'relative', zIndex: 20 },
  meridiemButton: {
    minWidth: 64,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.68)',
    borderRadius: 12,
    backgroundColor: '#E9EDF0',
    paddingHorizontal: 7,
    boxShadow: '2px 2px 5px rgba(160, 171, 180, 0.46), -2px -2px 5px rgba(255, 255, 255, 0.92)',
  },
  meridiemButtonText: { color: palette.burgundy, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  meridiemMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    minWidth: 64,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.68)',
    borderRadius: 12,
    backgroundColor: '#E9EDF0',
    padding: 4,
    boxShadow: '4px 4px 8px rgba(160, 171, 180, 0.52), -4px -4px 8px rgba(255, 255, 255, 0.96)',
  },
  meridiemOption: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 8,
    backgroundColor: neutralSelection.surface,
    paddingHorizontal: 8,
    boxShadow: neutralSelection.sunkenShadow,
  },
  meridiemOptionSelected: { backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.raisedShadow },
  meridiemOptionText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  meridiemOptionTextSelected: { color: palette.muted, fontWeight: '800' },
  venueStatusSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 30, 46, 0.16)',
    marginTop: -24,
    paddingTop: 16,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(35, 43, 48, 0.14)',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  modalScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  pickerSheet: {
    maxHeight: '86%',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    backgroundColor: palette.background,
    padding: 24,
  },
  calendarSheet: { maxWidth: 480, maxHeight: '86%' },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  pickerHeaderCentered: { justifyContent: 'center' },
  pickerTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  pickerTitleCentered: { textAlign: 'center' },
  calendarMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  calendarNavigationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 20,
    backgroundColor: palette.background,
    boxShadow: '4px 4px 8px rgba(160, 171, 180, 0.52), -4px -4px 8px rgba(255, 255, 255, 0.96)',
  },
  calendarNavigationDisabled: { opacity: 0.38 },
  calendarMonthLabel: {
    flex: 1,
    color: palette.burgundy,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendarScroll: { flexShrink: 1 },
  calendarContent: { paddingBottom: 2 },
  calendarLeadTimeNotice: { marginTop: 16 },
  calendarYearList: { gap: 8, paddingBottom: 14 },
  calendarYearButton: {
    minWidth: 62,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 16,
    backgroundColor: palette.background,
    paddingHorizontal: 10,
    boxShadow: 'inset 3px 3px 6px rgba(166, 175, 183, 0.57), inset -3px -3px 6px rgba(255, 255, 255, 0.97)',
  },
  calendarYearButtonSelected: {
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: palette.background,
    boxShadow: '4px 4px 8px rgba(160, 171, 180, 0.52), -4px -4px 8px rgba(255, 255, 255, 0.96)',
  },
  calendarYearText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  calendarYearTextSelected: { color: palette.burgundy, fontWeight: '800' },
  calendarWeekdays: { flexDirection: 'row', marginBottom: 5 },
  calendarWeekday: {
    width: '14.2857%',
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calendarDayButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  calendarDayButtonToday: { borderWidth: 1, borderColor: '#C99AA4' },
  calendarDayButtonSelected: {
    backgroundColor: palette.burgundy,
    boxShadow: '3px 4px 7px rgba(43, 7, 18, 0.42), -3px -3px 6px rgba(255, 237, 243, 0.36), inset 1px 1px 1px rgba(255, 255, 255, 0.16)',
  },
  calendarDayButtonDisabled: { opacity: 0.32 },
  calendarDayText: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  calendarDayTextSelected: { color: palette.surface, fontWeight: '800' },
  calendarDayTextDisabled: { color: palette.muted },
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  pickerColumn: {
    flex: 1,
    height: wheelRowHeight * wheelVisibleRows,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 12,
    backgroundColor: palette.background,
    boxShadow: 'inset 4px 4px 8px rgba(160, 171, 180, 0.54), inset -4px -4px 8px rgba(255, 255, 255, 0.96)',
  },
  pickerColumnWide: { flex: 1 },
  timePickerConfirmButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    backgroundColor: palette.burgundyDark,
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    boxShadow: '4px 5px 10px rgba(43, 7, 18, 0.38), -3px -3px 7px rgba(255, 255, 255, 0.42), inset 1px 1px 1px rgba(255, 255, 255, 0.14)',
  },
  timePickerConfirmText: {
    color: palette.surface,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  wheelSelectionBand: {
    position: 'absolute',
    top: wheelRowHeight * 2,
    right: 0,
    left: 0,
    zIndex: 0,
    height: wheelRowHeight,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(107, 30, 46, 0.26)',
    backgroundColor: 'rgba(107, 30, 46, 0.09)',
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
    borderColor: neutralSelection.edge,
    borderRadius: 12,
    backgroundColor: neutralSelection.surface,
    padding: 16,
    boxShadow: neutralSelection.sunkenShadow,
  },
  venueIconCircle: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    boxShadow: 'inset 2px 2px 4px rgba(160, 171, 180, 0.44), inset -2px -2px 4px rgba(255, 255, 255, 0.92)',
  },
  venueIconSelected: { backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.raisedShadow },
  venueIcon: { color: palette.burgundyDark, fontSize: 23, lineHeight: 26 },
  venueIconTextSelected: { color: palette.burgundyDark },
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
  venueMapEyebrow: { color: palette.burgundy, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.1 },
  venueMapTitle: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '700', marginTop: 2 },
  venueMapDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  venueStepBadge: { borderRadius: 999, backgroundColor: '#F8EDEF', paddingHorizontal: 10, paddingVertical: 5 },
  venueStepBadgeText: { color: palette.burgundy, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.8 },
  venueSearchArea: { zIndex: 8, marginBottom: 12 },
  venueSearchAreaFullscreen: { zIndex: 20, paddingHorizontal: 16, paddingTop: 14, marginBottom: 0, backgroundColor: palette.background },
  venueSearchShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 12,
    backgroundColor: '#E9EDF0',
    paddingHorizontal: 14,
    boxShadow: 'inset 3px 3px 7px rgba(160, 171, 180, 0.5), inset -3px -3px 7px rgba(255, 255, 255, 0.94)',
  },
  venueSearchInput: { minWidth: 0, flex: 1, minHeight: 46, color: palette.text, fontSize: 14, lineHeight: 20, paddingVertical: 11 },
  venueSearchButton: { alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 16, backgroundColor: palette.burgundy },
  venueSearchButtonPressed: { opacity: 0.58 },
  useVenueButton: { alignItems: 'center', backgroundColor: palette.burgundy, borderRadius: 14, flexDirection: 'row', gap: 10, marginTop: 12, padding: 13 },
  useVenueButtonConfirmed: { backgroundColor: '#17664A' },
  useVenueButtonPressed: { opacity: 0.62 },
  useVenueButtonCopy: { flex: 1 },
  useVenueButtonText: { color: palette.surface, fontSize: 14, fontWeight: '800' },
  useVenueButtonHint: { color: '#F9EDEE', fontSize: 12, lineHeight: 18, marginTop: 2 },
  venueResults: { overflow: 'hidden', borderWidth: 1, borderTopWidth: 0, borderColor: palette.border, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: palette.surface },
  venueResultRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#F0E8EA', paddingHorizontal: 12, paddingVertical: 9 },
  venueResultRowPressed: { backgroundColor: '#FCF4F6' },
  venueResultCopy: { minWidth: 0, flex: 1 },
  venueResultName: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  venueResultAddress: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  venueNoResults: { color: palette.muted, fontSize: 12, lineHeight: 18, padding: 12 },
  mapPreviewShell: { position: 'relative', overflow: 'hidden', borderRadius: 14 },
  mapFallbackSurface: { position: 'relative', height: 250, overflow: 'hidden' },
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
  mapDistrictLabel: { position: 'absolute', color: '#8B8176', fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  mapLabelMandalagan: { top: '13%', right: '14%' },
  mapLabelDowntown: { top: '61%', left: '28%' },
  mapLabelSingcang: { right: '12%', bottom: '13%' },
  mapCityLabel: { position: 'absolute', top: 12, left: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.86)', paddingHorizontal: 8, paddingVertical: 5 },
  mapCityLabelText: { color: palette.burgundy, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.9 },
  mapPin: { position: 'absolute', zIndex: 6, width: 38, height: 44, alignItems: 'center', marginLeft: -19, marginTop: -38 },
  mapPinPulse: { width: 15, height: 6, borderRadius: 8, backgroundColor: 'rgba(107,30,46,0.24)', marginTop: -6 },
  mapAttributionBadge: { position: 'absolute', right: 8, bottom: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.84)', paddingHorizontal: 7, paddingVertical: 3 },
  mapAttributionText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  mapRetryButton: { position: 'absolute', left: 8, bottom: 8, zIndex: 8, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, backgroundColor: palette.burgundy, paddingHorizontal: 10, paddingVertical: 7 },
  mapRetryButtonPressed: { backgroundColor: palette.burgundyDark, transform: [{ scale: 0.97 }] },
  mapRetryText: { color: palette.surface, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  mapFullscreenButton: { position: 'absolute', top: 10, right: 10, zIndex: 7, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, backgroundColor: palette.burgundy, paddingHorizontal: 10, paddingVertical: 8 },
  mapFullscreenButtonPressed: { backgroundColor: palette.burgundyDark, transform: [{ scale: 0.97 }] },
  mapFullscreenText: { color: palette.surface, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7 },
  selectedVenueBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: '#F8EDEF', padding: 12, marginTop: 12 },
  selectedVenueIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.burgundy },
  selectedVenueCopy: { minWidth: 0, flex: 1 },
  selectedVenueName: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  selectedVenueAddress: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  venueError: { color: '#BA1A1A', fontSize: 12, lineHeight: 18, marginTop: 10 },
  fullscreenMapScreen: { flex: 1, backgroundColor: palette.background },
  fullscreenMapHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.burgundy, paddingHorizontal: 16, paddingVertical: 10 },
  fullscreenMapClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  fullscreenMapHeaderCopy: { minWidth: 0, flex: 1 },
  fullscreenMapEyebrow: { color: '#EAC7CE', fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1 },
  fullscreenMapTitle: { color: palette.surface, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  fullscreenMapDone: { minHeight: 38, justifyContent: 'center', borderRadius: 19, backgroundColor: palette.surface, paddingHorizontal: 15 },
  fullscreenMapDoneText: { color: palette.burgundy, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.8 },
  fullscreenMapBody: { minHeight: 0, flex: 1, marginTop: 14 },
  fullscreenMapFooter: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 20, paddingVertical: 12 },
  fullscreenMapHint: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  themeSection: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 30, 46, 0.16)',
    marginTop: -24,
    paddingTop: 16,
  },
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
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    backgroundColor: neutralSelection.surface,
    paddingHorizontal: 14,
    boxShadow: neutralSelection.sunkenShadow,
  },
  themeChipSelected: {
    borderColor: neutralSelection.edge,
    backgroundColor: neutralSelection.surface,
    boxShadow: neutralSelection.raisedShadow,
  },
  themeChipText: { color: '#8A8A8A', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  themeChipTextSelected: { color: '#8A8A8A', fontWeight: '800' },
  themeLimitMessage: { color: '#8A8A8A', fontSize: 12, lineHeight: 18 },
  churchWeddingSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 30, 46, 0.16)',
    marginTop: -24,
    paddingTop: 16,
  },
  coordinatorPreferenceSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 30, 46, 0.16)',
    marginTop: -24,
    paddingTop: 16,
  },
  churchWeddingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.20)',
    borderRadius: 12,
    backgroundColor: 'rgba(186, 26, 26, 0.10)',
    padding: 12,
  },
  churchWeddingNoticeText: { minWidth: 0, flex: 1, color: '#8F1010', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  churchWeddingChoices: { gap: 10 },
  churchWeddingChoice: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 16,
    backgroundColor: neutralSelection.surface,
    padding: 14,
    boxShadow: neutralSelection.sunkenShadow,
  },
  churchWeddingIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    boxShadow: 'inset 2px 2px 4px rgba(160, 171, 180, 0.44), inset -2px -2px 4px rgba(255, 255, 255, 0.92)',
  },
  churchWeddingIconSelected: { backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.raisedShadow },
  churchWeddingCopy: { minWidth: 0, flex: 1 },
  churchWeddingTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  churchWeddingDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  preferenceRequiredText: { color: '#BA1A1A', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  requiredFieldWarning: {
    color: '#8F1010',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
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
    borderColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 24,
    backgroundColor: palette.background,
    boxShadow: '4px 4px 8px rgba(160, 171, 180, 0.52), -4px -4px 8px rgba(255, 255, 255, 0.96)',
  },
  stepperButtonText: { color: palette.burgundyDark, fontSize: 27, lineHeight: 29, fontWeight: '400' },
  stepperButtonPressed: {
    backgroundColor: palette.background,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    boxShadow: 'inset 3px 3px 6px rgba(166, 175, 183, 0.57), inset -3px -3px 6px rgba(255, 255, 255, 0.97)',
    transform: [{ scale: 0.98 }],
  },
  stepperButtonTextPressed: { color: palette.burgundyDark },
  guestInputShell: {
    width: 128,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 8,
    backgroundColor: '#E9EDF0',
    boxShadow: 'inset 4px 4px 8px rgba(160, 171, 180, 0.54), inset -4px -4px 8px rgba(255, 255, 255, 0.96)',
  },
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
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 226, 226, 0.5)',
    backgroundColor: palette.background,
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  footerContent: { width: '100%', maxWidth: 1200, alignSelf: 'center', alignItems: 'stretch', gap: 10 },
  continueButton: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 26,
    backgroundColor: palette.burgundyDark,
    paddingHorizontal: 32,
    paddingVertical: 12,
    boxShadow: '4px 5px 10px rgba(43, 7, 18, 0.38), -3px -3px 7px rgba(255, 255, 255, 0.42), inset 1px 1px 1px rgba(255, 255, 255, 0.14)',
  },
  continueButtonWide: { alignSelf: 'flex-end', width: 200 },
  continueText: { color: palette.surface, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  continueArrow: { color: palette.surface, fontSize: 18, lineHeight: 21 },
  continuePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  continueDisabled: { opacity: 0.45, boxShadow: 'none' },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  pressed: { opacity: 0.58 },
})
