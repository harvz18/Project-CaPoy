import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import React from 'react'
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, View } from 'react-native'
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

const Stars = ({ rating }: { rating: number }) => <View style={styles.stars}>
  {Array.from({ length: 5 }, (_, index) => <MaterialCommunityIcons color={index < rating ? '#D99A44' : '#D8CCCE'} key={index} name="star" size={16} />)}
</View>

export const ReviewedServicesTab: React.FC<Props> = ({ isLoading = false, items, onOpenAvailableService }) => {
  const [historyItem, setHistoryItem] = React.useState<ReviewedService>()

  if (isLoading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading your reviewed services...</Text></View>
  if (!items.length) return <View style={styles.empty}>
    <MaterialCommunityIcons color={colors.primary} name="star-outline" size={34} />
    <Text style={styles.emptyTitle}>No Reviewed Services Yet</Text>
    <Text style={styles.emptyCopy}>Services you&apos;ve reviewed will appear here.</Text>
  </View>

  return <>
    <View style={styles.list}>
      {items.map((item) => {
        const canOpen = item.isAvailable && Boolean(item.serviceId)
        return <Pressable
          accessibilityLabel={canOpen ? `Open reviewed service ${item.serviceName}` : `View your review of ${item.serviceName}`}
          accessibilityRole="button"
          key={item.id}
          onPress={() => canOpen ? onOpenAvailableService?.(item.serviceId as string) : setHistoryItem(item)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          {item.imageUrl ? <Image accessibilityLabel={item.serviceName} resizeMode="cover" source={{ uri: item.imageUrl }} style={styles.image} /> : <View style={styles.placeholder}><MaterialCommunityIcons color={colors.primary} name="image-outline" size={24} /></View>}
          <View style={styles.copy}>
            <View style={styles.titleRow}><Text numberOfLines={2} style={styles.serviceName}>{item.serviceName}</Text>{!item.isAvailable ? <Text style={styles.historyPill}>HISTORY</Text> : null}</View>
            <Text numberOfLines={1} style={styles.provider}>{item.providerName}</Text>
            <Stars rating={item.rating} />
            {item.reviewPreview ? <Text numberOfLines={2} style={styles.preview}>&ldquo;{item.reviewPreview}&rdquo;</Text> : <Text style={styles.noComment}>You left a {item.rating}-star rating.</Text>}
            <Text style={styles.meta}>{[item.eventDate ? `Event: ${dateLabel(item.eventDate)}` : '', item.reviewDate ? `Reviewed: ${dateLabel(item.reviewDate)}` : ''].filter(Boolean).join(' · ')}</Text>
          </View>
        </Pressable>
      })}
    </View>
    <Modal animationType="fade" onRequestClose={() => setHistoryItem(undefined)} transparent visible={Boolean(historyItem)}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close review history" onPress={() => setHistoryItem(undefined)} style={StyleSheet.absoluteFill} />
        {historyItem ? <View accessibilityViewIsModal style={styles.historyCard}>
          <View style={styles.historyHeader}><Text style={styles.historyTitle}>Reviewed Service</Text><Pressable accessibilityLabel="Close review history" onPress={() => setHistoryItem(undefined)}><MaterialCommunityIcons color={colors.primary} name="close" size={23} /></Pressable></View>
          <Text style={styles.historyService}>{historyItem.serviceName}</Text>
          <Text style={styles.provider}>{historyItem.providerName}</Text>
          <Stars rating={historyItem.rating} />
          {historyItem.reviewPreview ? <Text style={styles.historyReview}>{historyItem.reviewPreview}</Text> : <Text style={styles.historyReview}>You left a {historyItem.rating}-star rating without a written comment.</Text>}
          <Text style={styles.meta}>{historyItem.eventDate ? `Event: ${dateLabel(historyItem.eventDate)}` : ''}{historyItem.reviewDate ? `\nReviewed: ${dateLabel(historyItem.reviewDate)}` : ''}</Text>
          <Text style={styles.historyNotice}>This listing is no longer available for booking. Your review remains part of your private history.</Text>
        </View> : null}
      </View>
    </Modal>
  </>
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderColor: colors.divider, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, overflow: 'hidden', padding: 10 },
  copy: { flex: 1, gap: 4, minWidth: 0, paddingVertical: 2 },
  empty: { alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderColor: colors.divider, borderRadius: 16, borderWidth: 1, gap: 8, padding: 28 },
  emptyCopy: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyTitle: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 16 },
  historyCard: { backgroundColor: colors.background, borderRadius: 18, gap: 10, marginHorizontal: 20, maxWidth: 520, padding: 20, width: '90%' },
  historyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyNotice: { backgroundColor: colors.backgroundSecondary, borderColor: colors.divider, borderRadius: 10, borderWidth: 1, color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4, padding: 10 },
  historyReview: { color: colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  historyService: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 18 },
  historyTitle: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 16 },
  historyPill: { backgroundColor: '#EFE7D6', borderRadius: 999, color: '#735C24', fontFamily: 'Inter_700Bold', fontSize: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4 },
  image: { backgroundColor: colors.backgroundSecondary, borderRadius: 11, height: 104, width: 100 },
  list: { gap: 12 },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', paddingVertical: 30 },
  loadingText: { color: colors.textMuted, fontFamily: 'Inter_500Medium', fontSize: 13 },
  meta: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 2 },
  noComment: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 12 },
  overlay: { alignItems: 'center', backgroundColor: 'rgba(23, 15, 18, 0.45)', flex: 1, justifyContent: 'center' },
  placeholder: { alignItems: 'center', backgroundColor: colors.backgroundSecondary, borderRadius: 11, height: 104, justifyContent: 'center', width: 100 },
  pressed: { opacity: 0.72 },
  preview: { color: colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  provider: { color: colors.textMuted, fontFamily: 'Inter_500Medium', fontSize: 12 },
  serviceName: { color: colors.textPrimary, flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 19 },
  stars: { flexDirection: 'row', gap: 1 },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
})
