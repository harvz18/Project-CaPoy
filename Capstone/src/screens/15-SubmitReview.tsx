import React from 'react'
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { BookingItem } from './11-BookingScreen'

export type ReviewTag =
  | 'Great value'
  | 'On time'
  | 'Professional'
  | 'Beautiful setup'
  | 'Responsive'
  | 'Highly recommended'

export interface SubmitReviewValue {
  bookingId?: string
  comment: string
  rating: number
  tags: ReviewTag[]
}

interface SubmitReviewScreenProps {
  booking?: BookingItem
  onBackToBookings?: () => void
  onClose?: () => void
  onSubmit?: (value: SubmitReviewValue) => void
}

const defaultProvider: Pick<
  BookingItem,
  'category' | 'image' | 'imageLabel' | 'name'
> = {
  name: 'Elite Catering',
  category: 'Catering',
  imageLabel: 'Elite Catering plated dish',
  image:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuABeTfkfDgOw5Bxt9ZfSrVxhbQd7U7OOPzU9yTO2su3aiwKbo-UoDS6t9jfg_200Gn1niFd-HTSGYxeygTBUkFi_VnqB6CYADVUtghQ1V7YDj8fHUOcUP26I46vVMNgiEv_wfyCQtETB-3ErjbrwUIF0ZeWzxZ76uorYxSfYy8tNkiG034cK_7sUVP1wBK7wwnhvGJ-R8cMSwDPQ74NaxzfQzG-FdOx2KUx-6YcD9FdiV1rhUeBLAwKLA',
}

const reviewTags: ReviewTag[] = [
  'Great value',
  'On time',
  'Professional',
  'Beautiful setup',
  'Responsive',
  'Highly recommended',
]

export const SubmitReviewScreen: React.FC<SubmitReviewScreenProps> = ({
  booking,
  onBackToBookings,
  onClose,
  onSubmit,
}) => {
  const provider = booking ?? defaultProvider
  const [rating, setRating] = React.useState(0)
  const [selectedTags, setSelectedTags] = React.useState<ReviewTag[]>([])
  const [comment, setComment] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const overlayOpacity = React.useRef(new Animated.Value(0)).current
  const successScale = React.useRef(new Animated.Value(0.85)).current
  const submitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => () => {
    if (submitTimer.current) clearTimeout(submitTimer.current)
  }, [])

  React.useEffect(() => {
    if (!submitted) return

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        duration: 350,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(successScale, {
        damping: 13,
        stiffness: 145,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start()
  }, [overlayOpacity, submitted, successScale])

  const toggleTag = (tag: ReviewTag) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((selectedTag) => selectedTag !== tag)
        : [...current, tag]
    )
  }

  const handleSubmit = () => {
    if (submitting) return
    const value: SubmitReviewValue = {
      bookingId: booking?.id,
      rating,
      tags: selectedTags,
      comment: comment.trim(),
    }

    setSubmitting(true)
    submitTimer.current = setTimeout(() => {
      onSubmit?.(value)
      setSubmitting(false)
      setSubmitted(true)
      submitTimer.current = null
    }, 650)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <Pressable
          accessibilityLabel="Close review"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Text style={styles.closeIcon}>{'\u00D7'}</Text>
        </Pressable>

        <View style={styles.providerHeader}>
          <Image
            accessibilityLabel={provider.imageLabel}
            resizeMode="cover"
            source={{ uri: provider.image }}
            style={styles.providerImage}
          />
          <View style={styles.providerCopy}>
            <Text numberOfLines={1} style={styles.providerName}>
              {provider.name}
            </Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{provider.category}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>How was your experience?</Text>
          <View
            accessibilityLabel={`${rating} out of 5 stars selected`}
            accessibilityRole="radiogroup"
            style={styles.stars}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: rating === value }}
                hitSlop={4}
                onPress={() => setRating(value)}
                style={({ pressed }) => [styles.starButton, pressed && styles.starPressed]}
              >
                <Text style={[styles.star, value <= rating && styles.starActive]}>
                  {value <= rating ? '\u2605' : '\u2606'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.tagsSection}>
          <View style={styles.tagsHeading}>
            <Text style={styles.sectionTitle}>What stood out?</Text>
            <Text style={styles.sectionDescription}>Select all that apply.</Text>
          </View>
          <View style={styles.tagList}>
            {reviewTags.map((tag) => {
              const active = selectedTags.includes(tag)
              return (
                <Pressable
                  key={tag}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  onPress={() => toggleTag(tag)}
                  style={({ pressed }) => [
                    styles.tag,
                    active && styles.tagActive,
                    pressed && styles.tagPressed,
                  ]}
                >
                  <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackTitle}>Tell us more (optional)</Text>
          <View style={styles.feedbackInputShell}>
            <TextInput
              accessibilityLabel="Review details"
              maxLength={500}
              multiline
              onChangeText={setComment}
              placeholder="Share details about your experience..."
              placeholderTextColor={palette.muted}
              style={styles.feedbackInput}
              textAlignVertical="top"
              value={comment}
            />
            <Text style={styles.characterCount}>{comment.length}/500</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: submitting }}
            disabled={submitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              submitting && styles.submitButtonBusy,
            ]}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Text>
          </Pressable>
        </View>
      </View>

      {submitted && (
        <Animated.View style={[styles.successOverlay, { opacity: overlayOpacity }]}>
          <Animated.View
            style={[styles.successContent, { transform: [{ scale: successScale }] }]}
          >
            <View style={styles.successIconCircle}>
              <View style={styles.successIconInner}>
                <Text style={styles.successCheck}>{'\u2713'}</Text>
              </View>
            </View>
            <Text style={styles.successTitle}>Thank You!</Text>
            <Text style={styles.successDescription}>
              Your review helps other couples plan with confidence.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onBackToBookings}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.submitButtonPressed,
              ]}
            >
              <Text style={styles.backButtonText}>Back to Bookings</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  )
}

const palette = {
  background: '#FFFFFF',
  border: '#DAC0C2',
  burgundy: '#6B1E2E',
  burgundyDark: '#4E061A',
  greyLight: '#E5E5E5',
  muted: '#8A8A8A',
  surfaceVariant: '#E2E2E2',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 50,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  closeIcon: { color: palette.muted, fontSize: 27, lineHeight: 30 },
  providerHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  providerImage: { width: 32, height: 32, borderWidth: 1, borderColor: palette.border, borderRadius: 16 },
  providerCopy: { maxWidth: 220, alignItems: 'flex-start' },
  providerName: { color: palette.text, fontSize: 18, lineHeight: 23, fontWeight: '600' },
  categoryBadge: { borderRadius: 10, backgroundColor: palette.burgundy, paddingHorizontal: 8, paddingVertical: 2 },
  categoryText: { color: palette.background, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.7 },
  headerSpacer: { width: 40, height: 40 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 },
  ratingSection: { alignItems: 'center', marginBottom: 80 },
  sectionTitle: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: '600', textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 24 },
  starButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  star: { color: palette.greyLight, fontSize: 40, lineHeight: 44 },
  starActive: { color: palette.burgundy },
  starPressed: { transform: [{ scale: 0.9 }] },
  tagsSection: { marginBottom: 80 },
  tagsHeading: { alignItems: 'center', marginBottom: 24 },
  sectionDescription: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  tag: { borderRadius: 20, backgroundColor: palette.greyLight, paddingHorizontal: 16, paddingVertical: 9 },
  tagActive: { backgroundColor: palette.burgundy },
  tagText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  tagTextActive: { color: palette.background },
  tagPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  feedbackSection: { marginBottom: 80 },
  feedbackTitle: { color: palette.text, fontSize: 18, lineHeight: 26, fontWeight: '600', marginBottom: 16 },
  feedbackInputShell: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 12, backgroundColor: 'rgba(226,226,226,0.4)' },
  feedbackInput: { height: 128, color: palette.text, fontSize: 16, lineHeight: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 },
  characterCount: { position: 'absolute', right: 16, bottom: 10, color: palette.muted, fontSize: 12, lineHeight: 16 },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 40, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 20, paddingVertical: 16, shadowColor: palette.burgundy, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 6 },
  footerContent: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  submitButton: { width: '100%', minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: palette.burgundy, paddingHorizontal: 24, paddingVertical: 14 },
  submitButtonPressed: { backgroundColor: palette.burgundyDark, transform: [{ scale: 0.98 }] },
  submitButtonBusy: { opacity: 0.72 },
  submitButtonText: { color: palette.background, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  successOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background, paddingHorizontal: 20 },
  successContent: { width: '100%', maxWidth: 600, alignItems: 'center' },
  successIconCircle: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 48, backgroundColor: 'rgba(226,226,226,0.5)', marginBottom: 32 },
  successIconInner: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: palette.burgundy },
  successCheck: { color: palette.background, fontSize: 28, lineHeight: 31, fontWeight: '800' },
  successTitle: { color: palette.text, fontSize: 24, lineHeight: 32, fontWeight: '600', marginBottom: 16 },
  successDescription: { maxWidth: 320, color: palette.muted, fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 48 },
  backButton: { width: '100%', minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: palette.burgundy, paddingHorizontal: 24, paddingVertical: 14 },
  backButtonText: { color: palette.background, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  pressed: { opacity: 0.58 },
})
