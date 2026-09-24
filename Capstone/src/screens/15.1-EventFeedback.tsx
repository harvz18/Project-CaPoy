import { Text } from '../components/AppText'
import React from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import type { BookingItem } from './11-BookingScreen'

export interface ServiceFeedbackValue {
  bookingId: string
  comment: string
  rating: number
}

export interface EventFeedbackValue {
  eventId?: string
  serviceReviews: ServiceFeedbackValue[]
}

interface EventFeedbackScreenProps {
  booking?: BookingItem
  onBackHome?: () => void
  onClose?: () => void
  onSubmit?: (value: EventFeedbackValue) => boolean | Promise<boolean>
}

type Draft = { comment: string; rating: number }

export const EventFeedbackScreen: React.FC<EventFeedbackScreenProps> = ({
  booking,
  onBackHome,
  onClose,
  onSubmit,
}) => {
  const services = React.useMemo(() => booking?.services ?? [], [booking?.services])
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({})
  const [error, setError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const onBackHomeRef = React.useRef(onBackHome)

  React.useEffect(() => {
    onBackHomeRef.current = onBackHome
  }, [onBackHome])

  React.useEffect(() => {
    if (!submitted) return

    const returnTimer = setTimeout(() => onBackHomeRef.current?.(), 3000)
    return () => clearTimeout(returnTimer)
  }, [submitted])

  React.useEffect(() => {
    setDrafts(
      Object.fromEntries(
        services.map((service) => [service.bookingId, { comment: '', rating: 0 }])
      )
    )
    setError('')
    setSubmitted(false)
  }, [booking?.id, services])

  const ratedCount = services.filter((service) => (drafts[service.bookingId]?.rating ?? 0) > 0).length
  const canSubmit = services.length > 0 && ratedCount === services.length && !submitting

  const updateDraft = (bookingId: string, update: Partial<Draft>) => {
    setDrafts((current) => {
      const existing = current[bookingId] ?? { comment: '', rating: 0 }
      return { ...current, [bookingId]: { ...existing, ...update } }
    })
    if (error) setError('')
  }

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Please choose a star rating for every service.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const saved = await onSubmit?.({
        eventId: booking?.eventId ?? booking?.id,
        serviceReviews: services.map((service) => ({
          bookingId: service.bookingId,
          comment: (drafts[service.bookingId]?.comment ?? '').trim(),
          rating: drafts[service.bookingId]?.rating ?? 0,
        })),
      })

      if (!saved) {
        setError('Unable to save your feedback. Please try again.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Unable to save your feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarContent}>
          <Pressable
            accessibilityLabel="Close service feedback"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>{'<'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>SERVICE FEEDBACK</Text>
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
            {[booking?.date, `${services.length} booked services`].filter(Boolean).join('  ·  ')}
          </Text>
        </View>

        <View style={styles.introSection}>
          <Text style={styles.title}>Rate each service</Text>
          <Text style={styles.subtitle}>
            Star ratings are required. Comments are optional and help future clients understand
            what went well and what could improve.
          </Text>
        </View>

        <View style={styles.serviceList}>
          {services.map((service, index) => {
            const draft = drafts[service.bookingId] ?? { comment: '', rating: 0 }

            return (
              <View key={service.bookingId} style={styles.serviceCard}>
                <View style={styles.serviceHeading}>
                  <View style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>{service.category.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.serviceNumber}>SERVICE {index + 1} OF {services.length}</Text>
                </View>
                <Text style={styles.serviceName}>{service.serviceName}</Text>
                <Text style={styles.providerName}>{service.providerName}</Text>

                <View style={styles.ratingHeading}>
                  <Text style={styles.fieldLabel}>YOUR RATING</Text>
                  <Text style={styles.requiredLabel}>Required</Text>
                </View>
                <View
                  accessibilityLabel={`${draft.rating || 'No'} stars selected for ${service.serviceName}`}
                  accessibilityRole="radiogroup"
                  style={styles.starRow}
                >
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Pressable
                      key={rating}
                      accessibilityLabel={`${rating} star${rating === 1 ? '' : 's'}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: draft.rating === rating }}
                      hitSlop={4}
                      onPress={() => updateDraft(service.bookingId, { rating })}
                      style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}
                    >
                      <Text style={[styles.star, rating <= draft.rating && styles.starSelected]}>
                        {rating <= draft.rating ? '\u2605' : '\u2606'}
                      </Text>
                    </Pressable>
                  ))}
                  <Text style={styles.ratingValue}>{draft.rating ? `${draft.rating}/5` : 'Select'}</Text>
                </View>

                <View style={styles.commentHeading}>
                  <Text style={styles.fieldLabel}>COMMENT</Text>
                  <Text style={styles.optionalLabel}>Optional</Text>
                </View>
                <View style={styles.inputShell}>
                  <TextInput
                    accessibilityLabel={`Comment for ${service.serviceName}`}
                    maxLength={4000}
                    multiline
                    onChangeText={(comment) => updateDraft(service.bookingId, { comment })}
                    placeholder="What did you like? What could be improved?"
                    placeholderTextColor={palette.placeholder}
                    style={styles.input}
                    textAlignVertical="top"
                    value={draft.comment}
                  />
                  <Text style={styles.characterCount}>{draft.comment.length} / 4000</Text>
                </View>
              </View>
            )
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.privacyNote}>
          Comments are analyzed individually by the LDA + RAG sentiment pipeline. Ratings are
          stored as ratings and are not used to change the model's sentiment decision.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Text style={styles.progressText}>{ratedCount} OF {services.length} SERVICES RATED</Text>
          <Pressable
            accessibilityLabel="Submit service feedback"
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
              {submitting ? 'SUBMITTING...' : 'SUBMIT ALL FEEDBACK'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={onBackHome}
        transparent
        visible={submitted}
      >
        <View style={styles.successBackdrop}>
          <View accessibilityViewIsModal style={styles.successCard}>
            <View style={styles.successIcon}>
              <Text style={styles.successCheck}>{'\u2713'}</Text>
            </View>
            <Text accessibilityRole="header" style={styles.successTitle}>
              Thank you for your feedback!
            </Text>
            <Text accessibilityLiveRegion="polite" style={styles.successCopy}>
              Your ratings and comments were submitted successfully. Your written feedback is
              now being analyzed to help future clients choose with confidence. Returning you to
              Home...
            </Text>
            <Pressable
              accessibilityLabel="Return to home"
              accessibilityRole="button"
              onPress={onBackHome}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>BACK TO HOME</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const palette = {
  background: '#FFFFFF', border: '#DAC0C2', burgundy: '#6B1E2E', burgundyDark: '#4E061A',
  error: '#BA1A1A', gold: '#D19A20', placeholder: '#777777', soft: '#F8EDEF',
  surface: '#F9F9F9', text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: { zIndex: 40, height: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.burgundyDark, backgroundColor: palette.burgundy },
  topAppBarContent: { width: '100%', maxWidth: 700, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: palette.background, fontSize: 25, lineHeight: 29, fontWeight: '500' },
  headerTitle: { color: palette.background, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  content: { width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 154 },
  eventCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.soft, padding: 18 },
  eventEyebrow: { color: palette.burgundy, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.1 },
  eventName: { color: palette.text, fontSize: 22, lineHeight: 29, fontWeight: '700', marginTop: 4 },
  eventMeta: { color: palette.placeholder, fontSize: 13, lineHeight: 19, marginTop: 5 },
  introSection: { alignItems: 'center', paddingVertical: 30 },
  title: { color: palette.burgundyDark, fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  subtitle: { maxWidth: 560, color: palette.placeholder, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 8 },
  serviceList: { gap: 18 },
  serviceCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.background, padding: 18 },
  serviceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryChip: { borderRadius: 999, backgroundColor: palette.soft, paddingHorizontal: 10, paddingVertical: 5 },
  categoryChipText: { color: palette.burgundy, fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.7 },
  serviceNumber: { color: palette.placeholder, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.7 },
  serviceName: { color: palette.text, fontSize: 20, lineHeight: 27, fontWeight: '700', marginTop: 14 },
  providerName: { color: palette.placeholder, fontSize: 13, lineHeight: 19, marginTop: 2 },
  ratingHeading: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, marginBottom: 7 },
  commentHeading: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  fieldLabel: { color: palette.text, fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.9 },
  requiredLabel: { color: palette.burgundy, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  optionalLabel: { color: palette.placeholder, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  starButton: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  star: { color: '#A6A6A6', fontSize: 32, lineHeight: 38 },
  starSelected: { color: palette.gold },
  ratingValue: { color: palette.placeholder, fontSize: 12, lineHeight: 18, marginLeft: 8 },
  inputShell: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface },
  input: { minHeight: 112, color: palette.text, fontSize: 14, lineHeight: 21, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 32 },
  characterCount: { position: 'absolute', right: 12, bottom: 9, color: palette.placeholder, fontSize: 10, lineHeight: 14 },
  errorText: { color: palette.error, fontSize: 12, lineHeight: 18, marginTop: 14 },
  privacyNote: { color: palette.placeholder, fontSize: 12, lineHeight: 18, marginTop: 16 },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 50, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: 'rgba(255,255,255,0.97)', paddingHorizontal: 20, paddingVertical: 13 },
  footerContent: { width: '100%', maxWidth: 700, alignSelf: 'center' },
  progressText: { color: palette.placeholder, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center', marginBottom: 7 },
  primaryButton: { width: '100%', minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: palette.burgundyDark, paddingHorizontal: 24, paddingVertical: 14 },
  primaryButtonDisabled: { opacity: 0.42 },
  primaryButtonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: palette.background, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.1, textAlign: 'center' },
  successBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(26,28,28,0.55)', paddingHorizontal: 24 },
  successCard: { width: '100%', maxWidth: 440, alignItems: 'center', borderRadius: 20, backgroundColor: palette.background, paddingHorizontal: 26, paddingVertical: 34 },
  successIcon: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 41, backgroundColor: palette.burgundy, marginBottom: 24 },
  successCheck: { color: palette.background, fontSize: 34, lineHeight: 38, fontWeight: '800' },
  successTitle: { color: palette.burgundyDark, fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  successCopy: { maxWidth: 460, color: palette.placeholder, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 9, marginBottom: 34 },
  pressed: { opacity: 0.58 },
})
