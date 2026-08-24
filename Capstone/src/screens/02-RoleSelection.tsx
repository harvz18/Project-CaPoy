import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

export type UserRole = 'client' | 'provider'

interface RoleSelectionScreenProps {
  onSelectRole: (role: UserRole) => void
  onLogIn?: () => void
}

const roles = [
  {
    id: 'client' as const,
    icon: '♥',
    title: "I'm Planning an Event",
    description: 'Browse, compare, and book wedding services all in one place.',
  },
  {
    id: 'provider' as const,
    icon: '▣',
    title: "I'm a Service Provider",
    description: 'List your services and manage bookings from couples planning their big day.',
  },
]

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onSelectRole,
  onLogIn,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>MULTIVENT</Text>
          <Text style={styles.title}>How will you use MULTIVENT?</Text>
          <Text style={styles.subtitle}>
            You can always switch later from your profile settings.
          </Text>
        </View>

        <View style={styles.roles}>
          {roles.map((role) => (
            <Pressable
              key={role.id}
              accessibilityRole="button"
              accessibilityLabel={role.title}
              onPress={() => onSelectRole(role.id)}
              style={({ pressed }) => [styles.roleCard, pressed && styles.roleCardPressed]}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{role.icon}</Text>
              </View>
              <View style={styles.roleCopy}>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.roleDescription}>{role.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log in"
            disabled={!onLogIn}
            onPress={onLogIn}
            style={({ pressed }) => pressed && styles.loginPressed}
          >
            <Text style={styles.loginText}>Log In</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  brand: {
    color: colors.primaryDark,
    fontSize: typography.h3,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing['3xl'],
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.h1,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 26,
    textAlign: 'center',
  },
  roles: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  roleCard: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: 'transparent',
    borderRadius: radius.medium,
    borderWidth: 2,
    padding: spacing['2xl'],
    gap: spacing.lg,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  roleCardPressed: {
    borderColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD9DC',
    borderRadius: radius.pill,
  },
  icon: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: '700',
  },
  roleCopy: {
    gap: spacing.sm,
  },
  roleTitle: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    lineHeight: 32,
    fontWeight: '600',
  },
  roleDescription: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 26,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 26,
  },
  loginText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 26,
  },
  loginPressed: {
    opacity: 0.65,
  },
})
