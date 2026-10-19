import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from './AppText'

export interface ChurchCoordinates {
  latitude: number
  longitude: number
}

const padTwo = (value: number) => String(value).padStart(2, '0')
const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const parseDate = (value?: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3]) ? date : undefined
}

const dateValue = (date: Date) =>
  `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`

export const formatChurchDate = (value?: string) => {
  const date = parseDate(value)
  return date
    ? new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    : value || 'Choose a date'
}

const parseTime = (value?: string) => {
  const match = value?.match(/^(\d{1,2}):(\d{2})/)
  const rawHour = match ? Number(match[1]) : 9
  const rawMinute = match ? Number(match[2]) : 0
  const hour24 = rawHour >= 0 && rawHour <= 23 ? rawHour : 9
  const minute = rawMinute >= 0 && rawMinute <= 59 ? rawMinute : 0
  return { hour: hour24 % 12 || 12, meridiem: hour24 >= 12 ? 'PM' as const : 'AM' as const, minute }
}

export const formatChurchTime = (value?: string) => {
  if (!value) return 'Choose a time'
  const parsed = parseTime(value)
  return `${parsed.hour}:${padTwo(parsed.minute)} ${parsed.meridiem}`
}

const storedTime = (hour: number, minute: number, meridiem: 'AM' | 'PM') => {
  const hour24 = meridiem === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
  return `${padTwo(hour24)}:${padTwo(minute)}`
}

interface ChurchLocationMapProps {
  coordinates?: ChurchCoordinates
  interactive?: boolean
  onChange?: (coordinates: ChurchCoordinates) => void
  showOpenStreetMapLink?: boolean
}

const defaultCenter = { latitude: 10.6765, longitude: 122.9511 }
const latitudeSpan = 0.11
const longitudeSpan = 0.08
const coordinatesAreValid = (value?: ChurchCoordinates) => Boolean(
  value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && value.latitude >= -90 && value.latitude <= 90
    && value.longitude >= -180 && value.longitude <= 180
)

export const ChurchLocationMap: React.FC<ChurchLocationMapProps> = ({
  coordinates,
  interactive = false,
  onChange,
  showOpenStreetMapLink = true,
}) => {
  const [interactiveCenter] = React.useState(
    coordinatesAreValid(coordinates) ? coordinates as ChurchCoordinates : defaultCenter
  )
  const center = interactive
    ? interactiveCenter
    : coordinatesAreValid(coordinates) ? coordinates as ChurchCoordinates : defaultCenter
  const [size, setSize] = React.useState({ height: 1, width: 1 })
  const north = center.latitude + latitudeSpan / 2
  const west = center.longitude - longitudeSpan / 2
  const hasPin = coordinatesAreValid(coordinates)
  const pinX = hasPin ? Math.max(0, Math.min(1, ((coordinates as ChurchCoordinates).longitude - west) / longitudeSpan)) : 0.5
  const pinY = hasPin ? Math.max(0, Math.min(1, (north - (coordinates as ChurchCoordinates).latitude) / latitudeSpan)) : 0.5
  const content = (
    <>
      <View style={[styles.road, styles.roadVertical]} />
      <View style={[styles.road, styles.roadHorizontal]} />
      <View style={[styles.road, styles.roadDiagonalOne]} />
      <View style={[styles.road, styles.roadDiagonalTwo]} />
      <View style={[styles.minorRoad, styles.minorRoadOne]} />
      <View style={[styles.minorRoad, styles.minorRoadTwo]} />
      <View style={styles.water} />
      <Text style={[styles.districtLabel, styles.northLabel]}>NORTH DISTRICT</Text>
      <Text style={[styles.districtLabel, styles.centerLabel]}>CITY CENTER</Text>
      <Text style={[styles.districtLabel, styles.southLabel]}>SOUTH DISTRICT</Text>
      {hasPin ? (
        <View pointerEvents="none" style={[styles.pin, { left: `${pinX * 100}%`, top: `${pinY * 100}%` }]}>
          <MaterialIcons color={palette.burgundy} name="location-on" size={38} />
          <View style={styles.pinPulse} />
        </View>
      ) : (
        <View pointerEvents="none" style={styles.emptyPinHint}>
          <MaterialIcons color={palette.burgundy} name="touch-app" size={20} />
          <Text style={styles.emptyPinHintText}>Tap to place the church pin</Text>
        </View>
      )}
      <View pointerEvents="none" style={styles.previewBadge}>
        <Text style={styles.previewBadgeText}>DEMO COORDINATE MAP</Text>
      </View>
    </>
  )

  return (
    <View style={styles.mapContainer}>
      {interactive ? (
        <Pressable
          accessibilityHint="Tap anywhere to place or move the church pin"
          accessibilityLabel="Church location map"
          accessibilityRole="button"
          onLayout={(event) => setSize(event.nativeEvent.layout)}
          onPress={(event) => {
            const xRatio = Math.max(0, Math.min(1, event.nativeEvent.locationX / size.width))
            const yRatio = Math.max(0, Math.min(1, event.nativeEvent.locationY / size.height))
            onChange?.({
              latitude: Number((north - yRatio * latitudeSpan).toFixed(6)),
              longitude: Number((west + xRatio * longitudeSpan).toFixed(6)),
            })
          }}
          style={({ pressed }) => [styles.locationMap, pressed && styles.pressed]}
        >
          {content}
        </Pressable>
      ) : <View accessibilityLabel="Church location map" style={styles.locationMap}>{content}</View>}
      {hasPin ? (
        <View style={styles.mapFooter}>
          <View style={styles.mapCoordinateCopy}>
            <Text style={styles.mapCoordinateLabel}>PINNED COORDINATES</Text>
            <Text style={styles.mapCoordinateValue}>
              {(coordinates as ChurchCoordinates).latitude.toFixed(6)}, {(coordinates as ChurchCoordinates).longitude.toFixed(6)}
            </Text>
          </View>
          {showOpenStreetMapLink ? (
            <Pressable
              accessibilityLabel="View church coordinates on OpenStreetMap"
              accessibilityRole="link"
              onPress={() => {
                const { latitude, longitude } = coordinates as ChurchCoordinates
                void Linking.openURL(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`)
              }}
              style={({ pressed }) => [styles.osmButton, pressed && styles.pressed]}
            >
              <MaterialIcons color={palette.burgundy} name="open-in-new" size={15} />
              <Text style={styles.osmButtonText}>OPENSTREETMAP</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

interface DatePickerProps {
  eventDate?: string
  onClose: () => void
  onConfirm: (value: string) => void
  value?: string
}

export const ChurchDatePickerModal: React.FC<DatePickerProps> = ({ eventDate, onClose, onConfirm, value }) => {
  const initialDate = parseDate(value) ?? parseDate(eventDate) ?? new Date()
  const [selectedDate, setSelectedDate] = React.useState(initialDate)
  const [visibleMonth, setVisibleMonth] = React.useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const selectedValue = dateValue(selectedDate)
  const mismatch = Boolean(eventDate && eventDate !== selectedValue)
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close ceremony date picker" onPress={onClose} style={styles.scrim} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <PickerHeader onClose={onClose} title="Choose ceremony date" />
          <View style={styles.monthHeader}>
            <MonthButton label="Previous month" onPress={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} symbol="\u2039" />
            <Text style={styles.monthLabel}>{new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(visibleMonth)}</Text>
            <MonthButton label="Next month" onPress={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} symbol="\u203a" />
          </View>
          <View style={styles.weekdayRow}>{weekdays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.calendarGrid}>
            {Array.from({ length: visibleMonth.getDay() }, (_, index) => <View key={`blank-${index}`} style={styles.day} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1)
              const valueForDate = dateValue(date)
              const selected = valueForDate === selectedValue
              return (
                <Pressable
                  accessibilityLabel={new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={valueForDate}
                  onPress={() => setSelectedDate(date)}
                  style={({ pressed }) => [styles.day, selected && styles.daySelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{index + 1}</Text>
                  {valueForDate === eventDate && !selected ? <View style={styles.scheduledDot} /> : null}
                </Pressable>
              )
            })}
          </View>
          {eventDate ? (
            <View style={[styles.notice, mismatch && styles.noticeError]}>
              <MaterialIcons color={mismatch ? palette.error : palette.success} name={mismatch ? 'error-outline' : 'event-available'} size={18} />
              <Text style={[styles.noticeText, mismatch && styles.noticeTextError]}>
                {mismatch ? `The ceremony date must match the event date: ${formatChurchDate(eventDate)}.` : 'This date matches the configured event schedule.'}
              </Text>
            </View>
          ) : null}
          <PickerActions disabled={mismatch} onCancel={onClose} onConfirm={() => { onConfirm(selectedValue); onClose() }} confirmLabel="CONFIRM DATE" />
        </View>
      </View>
    </Modal>
  )
}

interface TimePickerProps {
  onClose: () => void
  onConfirm: (value: string) => void
  value?: string
}

export const ChurchTimePickerModal: React.FC<TimePickerProps> = ({ onClose, onConfirm, value }) => {
  const initial = parseTime(value)
  const [hour, setHour] = React.useState(initial.hour)
  const [minute, setMinute] = React.useState(initial.minute)
  const [meridiem, setMeridiem] = React.useState<'AM' | 'PM'>(initial.meridiem)
  const minutes = Array.from(new Set([...Array.from({ length: 12 }, (_, index) => index * 5), initial.minute])).sort((a, b) => a - b)
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close ceremony time picker" onPress={onClose} style={styles.scrim} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <PickerHeader onClose={onClose} title="Choose ceremony time" />
          <View style={styles.timePreview}><MaterialIcons color={palette.burgundy} name="schedule" size={22} /><Text style={styles.timePreviewText}>{hour}:{padTwo(minute)} {meridiem}</Text></View>
          <Text style={styles.optionLabel}>HOUR</Text>
          <View style={styles.optionGrid}>{Array.from({ length: 12 }, (_, index) => index + 1).map((option) => <TimeOption key={option} label={String(option)} onPress={() => setHour(option)} selected={hour === option} />)}</View>
          <Text style={styles.optionLabel}>MINUTE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.minuteRow}>{minutes.map((option) => <TimeOption key={option} label={padTwo(option)} onPress={() => setMinute(option)} selected={minute === option} />)}</ScrollView>
          <View style={styles.meridiemRow}>{(['AM', 'PM'] as const).map((option) => <TimeOption key={option} label={option} onPress={() => setMeridiem(option)} selected={meridiem === option} wide />)}</View>
          <Text style={styles.timezoneNote}>Saved as local ceremony time without timezone conversion.</Text>
          <PickerActions onCancel={onClose} onConfirm={() => { onConfirm(storedTime(hour, minute, meridiem)); onClose() }} confirmLabel="CONFIRM TIME" />
        </View>
      </View>
    </Modal>
  )
}

const PickerHeader = ({ onClose, title }: { onClose: () => void; title: string }) => (
  <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>CHURCH CEREMONY</Text><Text style={styles.title}>{title}</Text></View><Pressable accessibilityLabel="Close picker" accessibilityRole="button" onPress={onClose}><MaterialIcons color={palette.muted} name="close" size={23} /></Pressable></View>
)

const MonthButton = ({ label, onPress, symbol }: { label: string; onPress: () => void; symbol: string }) => (
  <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}><Text style={styles.monthButtonText}>{symbol}</Text></Pressable>
)

const TimeOption = ({ label, onPress, selected, wide = false }: { label: string; onPress: () => void; selected: boolean; wide?: boolean }) => (
  <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.timeOption, wide && styles.timeOptionWide, selected && styles.timeOptionSelected]}><Text style={[styles.timeOptionText, selected && styles.timeOptionTextSelected]}>{label}</Text></Pressable>
)

const PickerActions = ({ confirmLabel, disabled = false, onCancel, onConfirm }: { confirmLabel: string; disabled?: boolean; onCancel: () => void; onConfirm: () => void }) => (
  <View style={styles.actions}><Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>CANCEL</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onConfirm} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{confirmLabel}</Text></Pressable></View>
)

const palette = { burgundy: '#6B1E2E', border: '#E7DADC', error: '#BA1A1A', muted: '#6D5B5E', surface: '#FFFFFF', success: '#17643A', text: '#24191B' } as const

const styles = StyleSheet.create({
  mapContainer: { gap: 9 },
  locationMap: { height: 230, overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: '#E9EEE7' },
  road: { position: 'absolute', backgroundColor: '#FFFFFF', borderColor: '#D8D0C6', borderWidth: 1 },
  roadVertical: { width: 27, height: '125%', left: '46%', top: '-12%', transform: [{ rotate: '8deg' }] },
  roadHorizontal: { width: '125%', height: 25, left: '-12%', top: '47%', transform: [{ rotate: '-5deg' }] },
  roadDiagonalOne: { width: '115%', height: 17, left: '-10%', top: '24%', transform: [{ rotate: '24deg' }] },
  roadDiagonalTwo: { width: '105%', height: 14, left: '7%', top: '72%', transform: [{ rotate: '-18deg' }] },
  minorRoad: { position: 'absolute', height: 6, backgroundColor: '#F8F6F0', borderRadius: 3 },
  minorRoadOne: { width: '72%', left: '13%', top: '35%', transform: [{ rotate: '-32deg' }] },
  minorRoadTwo: { width: '68%', left: '22%', top: '63%', transform: [{ rotate: '31deg' }] },
  water: { position: 'absolute', width: '15%', height: '120%', right: '-7%', top: '-10%', backgroundColor: '#C9E6EB', transform: [{ rotate: '4deg' }] },
  districtLabel: { position: 'absolute', color: '#8A8179', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 0.8 },
  northLabel: { top: '15%', left: '12%' }, centerLabel: { top: '53%', left: '58%' }, southLabel: { bottom: '13%', left: '17%' },
  pin: { position: 'absolute', width: 40, height: 48, alignItems: 'center', marginLeft: -20, marginTop: -38 },
  pinPulse: { width: 18, height: 6, marginTop: -8, borderRadius: 9, backgroundColor: 'rgba(107,30,46,0.22)' },
  emptyPinHint: { position: 'absolute', left: '22%', right: '22%', top: '42%', alignItems: 'center', gap: 4, padding: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)' },
  emptyPinHintText: { color: palette.burgundy, fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  previewBadge: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.92)' },
  previewBadgeText: { color: palette.muted, fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: 0.7 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  mapCoordinateCopy: { minWidth: 0, flex: 1 }, mapCoordinateLabel: { color: palette.muted, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8 }, mapCoordinateValue: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  osmButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 9 },
  osmButtonText: { color: palette.burgundy, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.5 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 }, scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(31,20,23,0.58)' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '92%', gap: 15, padding: 19, borderRadius: 18, backgroundColor: palette.surface },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, headerCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: palette.burgundy, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 1.1 }, title: { color: palette.text, fontSize: 20, lineHeight: 27, fontWeight: '800' },
  monthHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 19 }, monthButtonText: { color: palette.burgundy, fontSize: 27, lineHeight: 30 }, monthLabel: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  weekdayRow: { flexDirection: 'row' }, weekday: { width: '14.2857%', color: palette.muted, fontSize: 8, lineHeight: 12, fontWeight: '800', textAlign: 'center' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, daySelected: { backgroundColor: palette.burgundy }, dayText: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600' }, dayTextSelected: { color: palette.surface, fontWeight: '800' }, scheduledDot: { width: 4, height: 4, marginTop: 1, borderRadius: 2, backgroundColor: palette.burgundy },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#E8F5EC' }, noticeError: { backgroundColor: '#FFF0F0' }, noticeText: { minWidth: 0, flex: 1, color: palette.success, fontSize: 11, lineHeight: 16, fontWeight: '600' }, noticeTextError: { color: palette.error },
  timePreview: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 12, backgroundColor: '#F7EFF1' }, timePreviewText: { color: palette.burgundy, fontSize: 25, lineHeight: 32, fontWeight: '800' }, optionLabel: { color: palette.muted, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.9 }, optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, timeOption: { width: 46, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 9 }, timeOptionWide: { flex: 1, width: undefined }, timeOptionSelected: { borderColor: palette.burgundy, backgroundColor: palette.burgundy }, timeOptionText: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' }, timeOptionTextSelected: { color: palette.surface }, minuteRow: { gap: 7, paddingRight: 5 }, meridiemRow: { flexDirection: 'row', gap: 8 }, timezoneNote: { color: palette.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 2 }, secondaryButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17, borderWidth: 1, borderColor: palette.border, borderRadius: 10 }, secondaryButtonText: { color: palette.burgundy, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.7 }, primaryButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17, borderRadius: 10, backgroundColor: palette.burgundy }, primaryButtonText: { color: palette.surface, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.7 }, disabled: { opacity: 0.42 }, pressed: { opacity: 0.72 },
})
