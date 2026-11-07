import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import React from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native'
import type { ReviewedService } from '../lib/reviewed-services'
import { colors } from '../theme/tokens'
import { Text } from './AppText'

type Props = {
  isLoading?: boolean
  items: ReviewedService[]
  onOpenAvailableService?: (serviceId: string) => void
}

const dateLabel = (value?: string) => {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-PH', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const formatPrice = (price?: number) => {
  if (!price || price <= 0) return 'Price unavailable'
  return '₱' + price.toLocaleString('en-PH', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
}

const Stars = ({ rating }: { rating: number }) => <View style={styles.stars}>
  {Array.from({ length: 5 }, (_, index) => <MaterialCommunityIcons color={index < rating ? '#D99A44' : '#D8CCCE'} key={index} name="star" size={16} />)}
</View>

export const ReviewedServicesTab: React.FC<Props> = ({ isLoading = false, items, onOpenAvailableService }) => {
  const [expandedReviewId, setExpandedReviewId] = React.useState<string>()

  if (isLoading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading your reviewed services...</Text></View>
  if (!items.length) return <View style={styles.empty}>
    <MaterialCommunityIcons color={colors.primary} name="star-outline" size={34} />
    <Text style={styles.emptyTitle}>No Reviewed Services Yet</Text>
    <Text style={styles.emptyCopy}>Services you&apos;ve reviewed will appear here.</Text>
  </View>

  return <View style={styles.list}>
    {items.map((item) => {
      const canOpen = item.isAvailable && Boolean(item.serviceId)
      const expanded = expandedReviewId === item.id
      const feedback = item.reviewPreview || ('You left a ' + item.rating + '-star rating without a written comment.')
      const reviewDates = [
        item.eventDate ? 'Event: ' + dateLabel(item.eventDate) : '',
        item.reviewDate ? 'Reviewed: ' + dateLabel(item.reviewDate) : '',
      ].filter(Boolean).join(' · ')

      return <View key={item.id} style={styles.card}>
        <Pressable
          accessibilityLabel={canOpen ? 'Open reviewed service ' + item.serviceName : 'Reviewed service ' + item.serviceName}
          accessibilityRole="button"
          disabled={!canOpen}
          onPress={() => onOpenAvailableService?.(item.serviceId as string)}
          style={({ pressed }) => [styles.serviceRow, canOpen && pressed && styles.pressed]}
        >
          {item.imageUrl ? <Image accessibilityLabel={item.serviceName} resizeMode="cover" source={{ uri: item.imageUrl }} style={styles.image} /> : <View style={styles.placeholder}><MaterialCommunityIcons color={colors.primary} name="image-outline" size={24} /></View>}
          <View style={styles.copy}>
            <View style={styles.titleRow}><Text numberOfLines={2} style={styles.serviceName}>{item.serviceName}</Text>{!item.isAvailable ? <Text style={styles.historyPill}>HISTORY</Text> : null}</View>
            <Text numberOfLines={1} style={styles.provider}>{item.providerName}</Text>
            <Text style={styles.price}>{formatPrice(item.marketplacePrice)}</Text>
            <Text style={styles.meta}>{reviewDates}</Text>
          </View>
          {canOpen ? <MaterialCommunityIcons color={colors.primary} name="chevron-right" size={22} /> : null}
        </Pressable>
        <View style={styles.reviewSection}>
          <Pressable
            accessibilityLabel={(expanded ? 'Hide your feedback for ' : 'Show your feedback for ') + item.serviceName}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpandedReviewId((current) => current === item.id ? undefined : item.id)}
            style={({ pressed }) => [styles.feedbackToggle, pressed && styles.pressed]}
          >
            <View><Text style={styles.feedbackLabel}>YOUR FEEDBACK</Text><Text numberOfLines={expanded ? undefined : 1} style={styles.feedbackSummary}>{expanded ? 'Hide feedback' : (item.reviewPreview || 'Rating only')}</Text></View>
            <MaterialCommunityIcons color={colors.primary} name={expanded ? 'chevron-up' : 'chevron-down'} size={22} />
          </Pressable>
          {expanded ? <Text style={styles.feedbackCopy}>{feedback}</Text> : null}
          <View style={styles.ratingRow}><Stars rating={item.rating} /><Text style={styles.ratingText}>{item.rating} out of 5</Text></View>
        </View>
      </View>
    })}
  </View>
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderColor: colors.divider, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  copy: { flex: 1, gap: 4, minWidth: 0, paddingVertical: 2 },
  empty: { alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderColor: colors.divider, borderRadius: 16, borderWidth: 1, gap: 8, padding: 28 },
  emptyCopy: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyTitle: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 16 },
  feedbackCopy: { color: colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, paddingTop: 8 },
  feedbackLabel: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.45 },
  feedbackSummary: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  feedbackToggle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyPill: { backgroundColor: '#EFE7D6', borderRadius: 999, color: '#735C24', fontFamily: 'Inter_700Bold', fontSize: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4 },
  image: { backgroundColor: colors.backgroundSecondary, borderRadius: 11, height: 86, width: 86 },
  list: { gap: 12 },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', paddingVertical: 30 },
  loadingText: { color: colors.textMuted, fontFamily: 'Inter_500Medium', fontSize: 13 },
  meta: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 2 },
  placeholder: { alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 11, height: 86, justifyContent: 'center', width: 86 },
  pressed: { opacity: 0.72 },
  price: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 13, marginTop: 1 },
  provider: { color: colors.textMuted, fontFamily: 'Inter_500Medium', fontSize: 12 },
  ratingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  ratingText: { color: colors.textMuted, fontFamily: 'Inter_500Medium', fontSize: 12 },
  reviewSection: { borderTopColor: colors.divider, borderTopWidth: 1, marginTop: 10, paddingBottom: 12, paddingHorizontal: 12, paddingTop: 10 },
  serviceName: { color: colors.textPrimary, flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 19 },
  serviceRow: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 10 },
  stars: { flexDirection: 'row', gap: 1 },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
})
