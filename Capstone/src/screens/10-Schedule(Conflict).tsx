import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

export interface ScheduleConflictProvider {
  available: boolean
  dateTime?: string
  id: string
  message?: string
  name: string
}

interface ScheduleConflictScreenProps {
  providers?: ScheduleConflictProvider[]
  onBack?: () => void
  onChangeDate?: (provider: ScheduleConflictProvider) => void
  onChooseDifferentProvider?: (provider: ScheduleConflictProvider) => void
  onMessageProvider?: (provider: ScheduleConflictProvider) => void
}

const defaultProviders: ScheduleConflictProvider[] = [
  {
    id: 'gourmetAffairs',
    name: 'Gourmet Affairs',
    dateTime: 'OCT 24, 4:30 PM',
    available: true,
  },
  {
    id: 'glasshouse',
    name: 'The Glasshouse Estate',
    message: 'Not available on Oct 24 \u2014 resolve to continue.',
    available: false,
  },
  {
    id: 'lumiere',
    name: 'Lumiere Photography',
    dateTime: 'OCT 24, 1:00 PM',
    available: true,
  },
]

export const ScheduleConflictScreen: React.FC<ScheduleConflictScreenProps> = ({
  providers = defaultProviders,
  onBack,
  onChangeDate,
  onChooseDifferentProvider,
  onMessageProvider,
}) => {
  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarContent}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Schedule Check</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <View style={styles.statusIconCircle}>
            <View style={styles.errorIcon}>
              <Text style={styles.errorMark}>!</Text>
            </View>
          </View>
          <Text style={styles.statusTitle}>Conflict Found</Text>
          <Text style={styles.statusDescription}>
            One of your selected providers isn&apos;t available on your event date.
          </Text>
        </View>

        <View style={styles.providerCard}>
          {providers.map((provider, index) =>
            provider.available ? (
              <View
                key={provider.id}
                style={[
                  styles.providerRow,
                  index < providers.length - 1 && styles.providerRowBorder,
                ]}
              >
                <View style={styles.providerCopy}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.providerDate}>{provider.dateTime}</Text>
                </View>
                <View style={styles.checkIcon}>
                  <Text style={styles.checkMark}>{'\u2713'}</Text>
                </View>
              </View>
            ) : (
              <View
                key={provider.id}
                style={[
                  styles.conflictRow,
                  index < providers.length - 1 && styles.providerRowBorder,
                ]}
              >
                <View style={styles.conflictHeading}>
                  <View style={styles.providerCopy}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    <Text style={styles.actionRequired}>ACTION REQUIRED</Text>
                  </View>
                  <View style={styles.warningIcon}>
                    <Text style={styles.warningMark}>!</Text>
                  </View>
                </View>

                <View style={styles.conflictMessage}>
                  <Text style={styles.conflictMessageText}>
                    {provider.message ??
                      'This provider is unavailable \u2014 resolve to continue.'}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onChangeDate?.(provider)}
                    style={({ pressed }) => [
                      styles.outlineButton,
                      pressed && styles.outlineButtonPressed,
                    ]}
                  >
                    <Text style={styles.outlineButtonText}>Change Date</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onChooseDifferentProvider?.(provider)}
                    style={({ pressed }) => [
                      styles.outlineButton,
                      pressed && styles.outlineButtonPressed,
                    ]}
                  >
                    <Text style={styles.outlineButtonText}>Choose Different Provider</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onMessageProvider?.(provider)}
                    style={({ pressed }) => [
                      styles.messageButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.messageButtonText}>Message Provider</Text>
                  </Pressable>
                </View>
              </View>
            )
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Text style={styles.footerHint}>Resolve the conflict above to continue</Text>
          <Pressable
            accessibilityLabel="Continue to payment, unavailable until conflicts are resolved"
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
            style={styles.disabledButton}
          >
            <Text style={styles.disabledButtonText}>Continue to Payment</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  border: '#E2E2E2',
  burgundy: '#6B1E2E',
  greyLight: '#E5E5E5',
  greyMid: '#8A8A8A',
  secondary: '#544244',
  surface: '#FFFFFF',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 50,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 448,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backIcon: { color: palette.burgundy, fontSize: 27, lineHeight: 29 },
  headerTitle: {
    flex: 1,
    color: palette.burgundy,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    marginLeft: 4,
  },
  headerSpacer: { width: 24, height: 40 },
  content: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 148,
  },
  statusSection: { alignItems: 'center', marginBottom: 32 },
  statusIconCircle: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 32,
    backgroundColor: palette.greyLight,
    marginBottom: 16,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  errorIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: palette.burgundy,
  },
  errorMark: { color: palette.surface, fontSize: 20, lineHeight: 23, fontWeight: '800' },
  statusTitle: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusDescription: {
    maxWidth: 340,
    color: palette.greyMid,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  providerCard: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: 'rgba(229, 229, 229, 0.4)',
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  providerRow: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    backgroundColor: palette.surface,
    padding: 16,
  },
  providerRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  providerCopy: { flex: 1 },
  providerName: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: '600' },
  providerDate: {
    color: palette.greyMid,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 4,
  },
  checkIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.burgundy,
  },
  checkMark: { color: palette.surface, fontSize: 15, lineHeight: 18, fontWeight: '800' },
  conflictRow: {
    borderLeftWidth: 4,
    borderLeftColor: palette.burgundy,
    backgroundColor: palette.surface,
    padding: 16,
  },
  conflictHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionRequired: {
    color: palette.burgundy,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 4,
    opacity: 0.8,
  },
  warningIcon: {
    width: 24,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: palette.burgundy,
  },
  warningMark: { color: palette.surface, fontSize: 14, lineHeight: 17, fontWeight: '800' },
  conflictMessage: {
    borderWidth: 1,
    borderColor: palette.greyLight,
    borderRadius: 8,
    backgroundColor: palette.background,
    padding: 12,
    marginTop: 16,
  },
  conflictMessageText: { color: palette.secondary, fontSize: 14, lineHeight: 21 },
  actions: { gap: 12, marginTop: 18 },
  outlineButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.burgundy,
    borderRadius: 8,
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  outlineButtonPressed: { backgroundColor: '#F8F1F3', transform: [{ scale: 0.98 }] },
  outlineButtonText: {
    color: palette.burgundy,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  messageButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  messageButtonText: {
    color: palette.greyMid,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 6,
  },
  footerContent: { width: '100%', maxWidth: 448, alignSelf: 'center', gap: 10 },
  footerHint: { color: palette.greyMid, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  disabledButton: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.greyLight,
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  disabledButtonText: {
    color: palette.greyMid,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  pressed: { opacity: 0.55 },
})
