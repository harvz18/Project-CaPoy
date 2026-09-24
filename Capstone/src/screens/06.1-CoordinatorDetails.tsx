import { MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { Text } from '../components/AppText'
import type { CatalogService } from '../lib/catalog'

interface CoordinatorDetailsScreenProps {
  assigning?: boolean
  isAssigned?: boolean
  mode?: 'explore' | 'planning'
  onBack?: () => void
  onSelectProvider?: () => void
  service?: CatalogService
}

const initialsFrom = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EC'

export const CoordinatorDetailsScreen: React.FC<CoordinatorDetailsScreenProps> = ({
  assigning = false,
  isAssigned = false,
  mode = 'planning',
  onBack,
  onSelectProvider,
  service,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const name = service?.name ?? 'Event Coordinator'
  const canAssign = mode === 'planning' && Boolean(service?.coordinatorUserId)

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={[styles.topBarContent, isWide && styles.horizontalWide]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons color={palette.primary} name="arrow-left" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Coordinator Profile</Text>
          <View style={styles.iconButton} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.horizontalWide : styles.horizontalMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, isWide && styles.profileCardWide]}>
          {service?.imageUrl ? (
            <Image
              accessibilityLabel={service.imageLabel}
              resizeMode="cover"
              source={{ uri: service.imageUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initialsFrom(name)}</Text>
            </View>
          )}

          <View style={styles.profileCopy}>
            <View style={styles.rolePill}>
              <MaterialCommunityIcons color={palette.primaryContainer} name="account-tie-outline" size={16} />
              <Text style={styles.rolePillText}>EVENT COORDINATOR</Text>
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.subtitle}>
              Coordinates your event details, booked providers, schedules, and action items in one workspace.
            </Text>
          </View>
        </View>

        <View style={[styles.detailsGrid, isWide && styles.detailsGridWide]}>
          <View style={styles.detailCard}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="calendar-check-outline" size={24} />
            <Text style={styles.detailTitle}>Event overview</Text>
            <Text style={styles.detailCopy}>
              Sees the event date, time, venue, guest count, budget, and current planning status.
            </Text>
          </View>
          <View style={styles.detailCard}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="briefcase-check-outline" size={24} />
            <Text style={styles.detailTitle}>Booked services</Text>
            <Text style={styles.detailCopy}>
              Sees the providers and services selected for this event, including each booking status.
            </Text>
          </View>
          <View style={styles.detailCard}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="clipboard-check-outline" size={24} />
            <Text style={styles.detailTitle}>Coordination tasks</Text>
            <Text style={styles.detailCopy}>
              Can organize event-specific tasks and track them through completion.
            </Text>
          </View>
        </View>

        <View style={styles.privacyCard}>
          <MaterialCommunityIcons color={palette.success} name="shield-check-outline" size={22} />
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Access is limited to this event</Text>
            <Text style={styles.privacyText}>
              {name} receives an invitation first. Event, booking, and provider details are shared only after acceptance.
            </Text>
          </View>
        </View>
      </ScrollView>

      {canAssign ? (
        <View style={styles.actionBar}>
          <Pressable
            accessibilityLabel={isAssigned ? `${name} has an invitation or assignment` : `Invite ${name} to this event`}
            accessibilityRole="button"
            accessibilityState={{ disabled: assigning || isAssigned }}
            disabled={assigning || isAssigned}
            onPress={onSelectProvider}
            style={({ pressed }) => [
              styles.assignButton,
              (assigning || isAssigned) && styles.assignButtonDisabled,
              pressed && styles.assignButtonPressed,
            ]}
          >
            {assigning ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
              <MaterialCommunityIcons
                color="#FFFFFF"
                name={isAssigned ? 'clock-check-outline' : 'account-plus-outline'}
                size={20}
              />
            )}
            <Text style={styles.assignButtonText}>
              {assigning ? 'Sending invitation...' : isAssigned ? 'Invitation sent or accepted' : 'Invite coordinator'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  border: '#E4D8DA',
  muted: '#6F6769',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  success: '#2E6D4E',
  surface: '#FFFFFF',
  surfaceTint: '#F8EFF1',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topBar: { height: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  topBarContent: { width: '100%', maxWidth: 1120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  horizontalMobile: { paddingHorizontal: 20 },
  horizontalWide: { paddingHorizontal: 56 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  headerTitle: { color: palette.primary, fontSize: 15, fontWeight: '700', letterSpacing: 0.6 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingTop: 28, paddingBottom: 120, gap: 20 },
  profileCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 22, gap: 20 },
  profileCardWide: { flexDirection: 'row', alignItems: 'center', padding: 30 },
  avatar: { width: 116, height: 116, borderRadius: 58, backgroundColor: palette.surfaceTint },
  avatarFallback: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryContainer },
  avatarInitials: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
  profileCopy: { flex: 1, gap: 9 },
  rolePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: palette.surfaceTint, paddingHorizontal: 11, paddingVertical: 6 },
  rolePillText: { color: palette.primaryContainer, fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  name: { color: palette.text, fontSize: 29, fontWeight: '700', lineHeight: 36 },
  subtitle: { maxWidth: 700, color: palette.muted, fontSize: 15, lineHeight: 23 },
  detailsGrid: { gap: 14 },
  detailsGridWide: { flexDirection: 'row' },
  detailCard: { flex: 1, minHeight: 170, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 20, gap: 10 },
  detailTitle: { color: palette.text, fontSize: 16, fontWeight: '700' },
  detailCopy: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  privacyCard: { flexDirection: 'row', gap: 13, borderRadius: 17, backgroundColor: '#EEF6F1', padding: 18 },
  privacyCopy: { flex: 1, gap: 4 },
  privacyTitle: { color: palette.success, fontSize: 14, fontWeight: '700' },
  privacyText: { color: '#486052', fontSize: 13, lineHeight: 19 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 20, paddingVertical: 14 },
  assignButton: { width: '100%', maxWidth: 520, alignSelf: 'center', minHeight: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: palette.primaryContainer, paddingHorizontal: 20 },
  assignButtonDisabled: { backgroundColor: '#8F7A80' },
  assignButtonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  assignButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
})
