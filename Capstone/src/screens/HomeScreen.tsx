import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/Button'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

export const HomeScreen: React.FC = () => {
  const actions = [
    { title: 'Browse Vendors', icon: '🔍' },
    { title: 'My Bookings', icon: '📅' },
    { title: 'Budget Planner', icon: '💰' },
    { title: 'Messages', icon: '💬' },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming Events</Text>
        <Text style={styles.subtitle}>
          Welcome back! Manage your events and bookings.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Plan Your Next Event</Text>
          <Text style={styles.heroText}>
            Create and organize events, then discover and book vendors all in one place.
          </Text>
          <Button
            variant="secondary"
            size="md"
            style={{ backgroundColor: colors.textInverse }}
            textStyle={{ color: colors.primary }}
          >
            Create Event
          </Button>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {actions.map((action) => (
            <Pressable
              key={action.title}
              style={({ pressed }) => [
                styles.actionCard,
                pressed && styles.actionCardPressed,
              ]}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.title}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Events</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No events yet. Create one to get started!</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.large,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: typography.h2,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.textInverse,
  },
  heroText: {
    fontSize: typography.body,
    marginBottom: spacing.lg,
    color: colors.textInverse,
    opacity: 0.95,
  },
  sectionTitle: {
    fontSize: typography.h2,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  actionCard: {
    width: '48%',
    padding: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.medium,
    alignItems: 'center',
  },
  actionCardPressed: {
    backgroundColor: colors.grey100,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: typography.body,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  placeholder: {
    padding: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.medium,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
})

