import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import type { VenueBookedOption, VenueBookingConfiguration } from '../lib/venue-booking'
import { Text } from './AppText'

type VenueBookingSummaryProps = {
  audience: 'client' | 'provider'
  configuration: VenueBookingConfiguration
}

const formatPeso = (value: number) => new Intl.NumberFormat('en-PH', {
  currency: 'PHP',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
}).format(value)

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2)

const formatTime = (value?: string) => {
  if (!value) return undefined
  const match = /(?:T|^)(\d{2}):(\d{2})/.exec(value)
  if (!match) return value
  const hours = Number(match[1])
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`
}

const optionPrice = (option: VenueBookedOption) => {
  if (option.pricingType === 'hour' && option.unitRate !== undefined && option.selectedDurationHours !== undefined) {
    const total = option.pricingSubtotal ?? option.unitRate * option.selectedDurationHours
    return `${formatPeso(option.unitRate)}/hour × ${formatNumber(option.selectedDurationHours)} hours = ${formatPeso(total)}`
  }
  if (option.pricingType === 'event' && option.unitRate !== undefined) {
    return `${formatPeso(option.pricingSubtotal ?? option.unitRate)}/event`
  }
  return option.pricingSubtotal === undefined ? 'Agreed venue option' : formatPeso(option.pricingSubtotal)
}

const scheduleFor = (option: VenueBookedOption, configuration: VenueBookingConfiguration) => {
  const eventDate = configuration.eventDate || option.startAt?.slice(0, 10)
  const start = formatTime(option.startAt) || configuration.eventTime
  const end = formatTime(option.endAt)
  const setup = formatTime(option.setupStartAt)
  const parts = [eventDate, start && end ? `${start} – ${end}` : start]
  if (setup) parts.push(`setup from ${setup}`)
  return parts.filter(Boolean).join(' · ')
}

export const VenueBookingSummary: React.FC<VenueBookingSummaryProps> = ({ audience, configuration }) => {
  const providerBaseTotal = configuration.providerBaseTotal
  const clientFacingTotal = configuration.clientFacingTotal

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <MaterialIcons color={palette.primary} name="meeting-room" size={18} />
        <Text style={styles.title}>
          {audience === 'provider' ? 'SELECTED VENUE CONFIGURATION' : 'AGREED VENUE CONFIGURATION'}
        </Text>
      </View>
      {configuration.options.map((option) => (
        <View key={option.id} style={styles.option}>
          <Text style={styles.optionName}>{option.name}</Text>
          <Text style={styles.optionPrice}>{optionPrice(option)}</Text>
          {scheduleFor(option, configuration) ? (
            <Text style={styles.optionSchedule}>{scheduleFor(option, configuration)}</Text>
          ) : null}
          {option.rentalConditions?.overtimePolicy ? (
            <Text style={styles.optionRestriction}>{option.rentalConditions.overtimePolicy}</Text>
          ) : null}
        </View>
      ))}
      {providerBaseTotal !== undefined ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>PROVIDER BASE TOTAL</Text>
          <Text style={styles.totalValue}>{formatPeso(providerBaseTotal)}</Text>
        </View>
      ) : null}
      {clientFacingTotal !== undefined ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{audience === 'provider' ? 'CLIENT-FACING TOTAL' : 'AGREED CLIENT TOTAL'}</Text>
          <Text style={styles.totalValue}>{formatPeso(clientFacingTotal)}</Text>
        </View>
      ) : null}
      {audience === 'provider' && clientFacingTotal !== undefined ? (
        <Text style={styles.providerNotice}>
          The client-facing total includes MULTIVENT&apos;s marketplace fee. Your earnings and payout remain based on the provider base total.
        </Text>
      ) : null}
    </View>
  )
}

const palette = {
  border: '#E3D8DA',
  muted: '#695A5E',
  primary: '#741B2A',
  surface: '#FFFDFC',
  text: '#2B2425',
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 10, borderWidth: 1, marginTop: 12, padding: 13 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  title: { color: palette.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.55, lineHeight: 15 },
  option: { borderTopColor: palette.border, borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  optionName: { color: palette.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  optionPrice: { color: palette.text, fontSize: 12, lineHeight: 17, marginTop: 2 },
  optionSchedule: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  optionRestriction: { color: palette.muted, fontSize: 10, fontStyle: 'italic', lineHeight: 15, marginTop: 3 },
  totalRow: { alignItems: 'center', borderTopColor: palette.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 9 },
  totalLabel: { color: palette.muted, flex: 1, fontSize: 10, fontWeight: '700', letterSpacing: 0.35, lineHeight: 15 },
  totalValue: { color: palette.primary, fontSize: 13, fontWeight: '700', lineHeight: 18, textAlign: 'right' },
  providerNotice: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 9 },
})
