import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/Button'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface RoleHomePlaceholderScreenProps {
  description: string
  onBackToRoleSelection: () => void
  roleLabel: string
  title: string
  userName?: string
}

const getFirstName = (name: string) => {
  const trimmedName = name.trim()

  if (trimmedName.length === 0) {
    return 'there'
  }

  return trimmedName.split(/\s+/)[0]
}

export const RoleHomePlaceholderScreen: React.FC<RoleHomePlaceholderScreenProps> = ({
  description,
  onBackToRoleSelection,
  roleLabel,
  title,
  userName = '',
}) => {
  const firstName = getFirstName(userName)

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.brand}>MULTIVENT</Text>

      <View style={styles.hero}>
        <View style={styles.roleBadge}>
          <Text style={styles.roleInitial}>{roleLabel.charAt(0)}</Text>
        </View>
        <Text style={styles.eyebrow}>{roleLabel.toUpperCase()}</Text>
        <Text style={styles.title}>Hi, {firstName}</Text>
        <Text style={styles.subtitle}>{title}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Home page coming soon</Text>
        <Text style={styles.cardText}>{description}</Text>
      </View>

      <Button
        accessibilityLabel="Back to role selection"
        isFullWidth
        onPress={onBackToRoleSelection}
        size="lg"
        style={styles.button}
      >
        BACK TO ROLE SELECTION
      </Button>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 430,
    minHeight: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.background,
  },
  brand: {
    color: colors.primaryDark,
    fontSize: typography.h3,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  roleBadge: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentLight,
    borderRadius: radius.pill,
    backgroundColor: '#F5E7DC',
    marginBottom: spacing.xl,
  },
  roleInitial: {
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.h1,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.large,
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.h3,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  cardText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  button: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
})
