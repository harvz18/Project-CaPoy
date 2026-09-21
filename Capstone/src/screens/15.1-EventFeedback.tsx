import { Text } from '../components/AppText'
import React from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import type { BookingItem } from './11-BookingScreen'

export interface EventFeedbackValue {
  eventId?: string
  overallComment: string
}

interface EventFeedbackScreenProps {
  booking?: BookingItem
  onBackToBookings?: () => void
  onClose?: () => void
  onSubmit?: (value: EventFeedbackValue) => boolean | Promise<boolean>
}

export const EventFeedbackScreen: React.FC<EventFeedbackScreenProps> = ({
  booking,
  onBackToBookings,
  onClose,
  onSubmit,
}) => {
  const [comment, setComment] = React.useState('')
  const [error, setError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const categories = Array.from(
    new Set((booking?.services ?? []).map((service) => service.category).filter(Boolean))
  )
  const normalizedComment = comment.trim()
  const canSubmit = normalizedComment.length >= 10 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Please share at least 10 characters about your overall experience.')
      return
    }

    setSubmitting(true)
    setError('')
    const saved = await onSubmit?.({
      eventId: booking?.eventId ?? booking?.id,
      overallComment: normalizedComment,
    })
    setSubmitting(false)

    if (saved === false) {
      setError('Unable to save your feedback. Please try again.')
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successIcon}>
          <Text style={styles.successCheck}>{'\u2713'}</Text>
        </View>
        <Text style={styles.successTitle}>Thank you for sharing</Text>
        <Text style={styles.successCopy}>
          Your overall event experience has been saved and is ready for future feedback analysis.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onBackToBookings}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.primaryButtonText}>BACK TO BOOKINGS</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarContent}>
          <Pressable
            accessibilityLabel="Close event feedback"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>{'<'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>EVENT FEEDBACK</Text>
          <View style={styles.headerButton} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.eventCard}>
          <Text style={styles.eventEyebrow}>COMPLETED EVENT</Text>
          <Text style={styles.eventName}>{booking?.name ?? 'Your event'}</Text>
          <Text style={styles.eventMeta}>
            {[booking?.date, `${booking?.services?.length ?? 0} booked services`]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
        </View>

        <View style={styles.introSection}>
          <Text style={styles.title}>How was the event overall?</Text>
          <Text style={styles.subtitle}>
            Write naturally about the complete experience—from planning and coordination to the
            event day itself.
          </Text>
        </View>

        {categories.length > 0 ? (
          <View style={styles.contextCard}>
            <View style={styles.contextHeading}>
              <View style={styles.contextIcon}>
                <Text style={styles.contextIconText}>i</Text>
              </View>
              <View style={styles.contextHeadingCopy}>
                <Text style={styles.contextEyebrow}>EVENT CONTEXT</Text>
                <Text style={styles.contextTitle}>Services included in this experience</Text>
              </View>
            </View>
            <View style={styles.categoryList}>
              {categories.map((category) => (
                <View key={category} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{category.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.feedbackSection}>
          <View style={styles.fieldHeading}>
            <Text style={styles.fieldLabel}>OVERALL EVENT EXPERIENCE</Text>
            <Text style={styles.requiredLabel}>Required</Text>
          </View>
          <View style={[styles.inputShell, error && styles.inputShellError]}>
            <TextInput
              accessibilityLabel="Overall event experience"
              maxLength={4000}
              multiline
              onChangeText={(value) => {
                setComment(value)
                if (error) setError('')
              }}
              placeholder="Tell us what went well, what could be improved, and anything memorable about your event..."
              placeholderTextColor={palette.placeholder}
              style={styles.input}
              textAlignVertical="top"
              value={comment}
            />
            <Text style={styles.characterCount}>{comment.length} / 4000</Text>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.privacyNote}>
            This saves your original wording unchanged. Automated topic and sentiment analysis will
            be connected later.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Pressable
            accessibilityLabel="Submit overall event feedback"
            accessibilityRole="button"
            accessibilityState={{ busy: submitting, disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSubmit && styles.primaryButtonDisabled,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'SUBMITTING...' : 'SUBMIT EVENT FEEDBACK'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const palette = {
  background: '#FFFFFF',
  border: '#DAC0C2',
  burgundy: '#6B1E2E',
  burgundyDark: '#4E061A',
  error: '#BA1A1A',
  placeholder: '#8A8A8A',
  soft: '#F8EDEF',
  surface: '#F9F9F9',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 40,
    height: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.burgundyDark,
    backgroundColor: palette.burgundy,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: palette.background, fontSize: 25, lineHeight: 29, fontWeight: '500' },
  headerTitle: {
    color: palette.background,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  content: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 136,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.soft,
    padding: 18,
  },
  eventEyebrow: {
    color: palette.burgundy,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  eventName: { color: palette.text, fontSize: 22, lineHeight: 29, fontWeight: '700', marginTop: 4 },
  eventMeta: { color: palette.placeholder, fontSize: 13, lineHeight: 19, marginTop: 5 },
  introSection: { alignItems: 'center', paddingVertical: 34 },
  title: { color: palette.burgundyDark, fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  subtitle: { maxWidth: 540, color: palette.placeholder, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 8 },
  contextCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderLeftWidth: 5,
    borderLeftColor: palette.burgundy,
    borderRadius: 12,
    backgroundColor: palette.surface,
    padding: 16,
    marginBottom: 28,
  },
  contextHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contextIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.burgundy },
  contextIconText: { color: palette.background, fontSize: 15, lineHeight: 19, fontWeight: '800' },
  contextHeadingCopy: { minWidth: 0, flex: 1 },
  contextEyebrow: { color: palette.burgundy, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1 },
  contextTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 1 },
  categoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  categoryChip: { borderRadius: 999, backgroundColor: palette.soft, paddingHorizontal: 10, paddingVertical: 5 },
  categoryChipText: { color: palette.burgundy, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.7 },
  feedbackSection: { marginBottom: 28 },
  fieldHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  fieldLabel: { color: palette.text, fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.9 },
  requiredLabel: { color: palette.burgundy, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  inputShell: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface },
  inputShellError: { borderColor: palette.error },
  input: { minHeight: 210, color: palette.text, fontSize: 15, lineHeight: 23, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 },
  characterCount: { position: 'absolute', right: 14, bottom: 11, color: palette.placeholder, fontSize: 11, lineHeight: 15 },
  errorText: { color: palette.error, fontSize: 12, lineHeight: 18, marginTop: 7 },
  privacyNote: { color: palette.placeholder, fontSize: 12, lineHeight: 18, marginTop: 10 },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 50, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: 'rgba(255,255,255,0.97)', paddingHorizontal: 20, paddingVertical: 16 },
  footerContent: { width: '100%', maxWidth: 700, alignSelf: 'center' },
  primaryButton: { width: '100%', minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: palette.burgundyDark, paddingHorizontal: 24, paddingVertical: 14 },
  primaryButtonDisabled: { opacity: 0.42 },
  primaryButtonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: palette.background, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.1, textAlign: 'center' },
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background, paddingHorizontal: 24 },
  successIcon: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 41, backgroundColor: palette.burgundy, marginBottom: 24 },
  successCheck: { color: palette.background, fontSize: 34, lineHeight: 38, fontWeight: '800' },
  successTitle: { color: palette.burgundyDark, fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  successCopy: { maxWidth: 430, color: palette.placeholder, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 9, marginBottom: 34 },
  pressed: { opacity: 0.58 },
})
