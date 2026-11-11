import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { MotionModal as Modal } from "../../src/components/MotionModal";
import { MotionPressable as Pressable } from "../../src/components/MotionPressable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/EmptyState";
import { useApp } from "../../src/context/AppContext";
import { useTasklinkBack } from "../../src/hooks/useTasklinkBack";
import { screenPalette } from "../../src/theme";
import { typography } from "../../src/typography";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";

const palette = screenPalette;

export default function RatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useTasklinkBack();
  const insets = useSafeAreaInsets();
  const { actionLoading, submitRating, ratings, currentUser, tasks } = useApp();
  const [score, setScore] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const task = tasks.find((item) => item.id === id);
  const taskRatings = ratings.filter((rating) => rating.taskId === id);

  async function handleSubmit() {
    try {
      setSubmitError("");
      await submitRating(id, score, feedback.trim());
      setSuccessOpen(true);
    } catch (ratingError) {
      setSubmitError(ratingError instanceof Error ? ratingError.message : "Unable to submit this rating.");
    }
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.backButton}>
            <Feather accessibilityElementsHidden color={palette.primary} name="arrow-left" size={22} />
          </Pressable>
        </View>
        <EmptyState title="Task unavailable" message="This task could not be loaded, so a rating cannot be submitted." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.backButton}>
            <Feather accessibilityElementsHidden color={palette.primary} name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.brand}>TASKLINK</Text>
        </View>
        <View style={styles.smallAvatar}>
          <Text style={styles.avatarText}>{currentUser?.fullName?.[0] ?? "U"}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Rate Transaction</Text>
            <Text style={styles.heroTitle}>{task.title}</Text>
            <Text style={styles.heroText}>Share a quick review for trust, quality, and reliability.</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeValue}>{score}.0</Text>
            <Text style={styles.scoreBadgeLabel}>Score</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overall Rating</Text>
            <Text style={styles.sectionHint}>Tap a score from 1 to 5.</Text>
            <View style={styles.scoreRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const selected = score === value;
                return (
                  <Pressable
                    accessibilityLabel={`${value} out of 5`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={value}
                    onPress={() => setScore(value)}
                    style={({ pressed }) => [
                      styles.scoreButton,
                      selected && styles.scoreButtonSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={[styles.scoreButtonText, selected && styles.scoreButtonTextSelected]}>{value}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Feedback</Text>
            <TextInput
              accessibilityLabel="Rating feedback"
              accessibilityHint="Optional. Add details about the experience."
              multiline
              onChangeText={setFeedback}
              placeholder="Add details about punctuality, work quality, or payment reliability."
              placeholderTextColor={palette.outline}
              style={styles.textArea}
              textAlignVertical="top"
              value={feedback}
            />
          </View>

          <Pressable
            accessibilityLabel="Submit rating"
            accessibilityRole="button"
            accessibilityState={{ busy: actionLoading, disabled: actionLoading }}
            disabled={actionLoading}
            onPress={handleSubmit}
            style={({ pressed }) => [styles.primaryButton, actionLoading && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>{actionLoading ? "Submitting..." : "Submit Rating"}</Text>
          </Pressable>
          {submitError ? <Text accessibilityRole="alert" style={styles.submitError}>{submitError}</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.listTitle}>Submitted Ratings</Text>
            <Text style={styles.listSubtitle}>Reviews connected to this task.</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{taskRatings.length}</Text>
          </View>
        </View>

        {taskRatings.length === 0 ? (
          <EmptyState title="No ratings yet" message="Ratings will appear after submission." />
        ) : null}

        <View style={styles.reviewList}>
          {taskRatings.map((rating) => (
            <View style={styles.reviewCard} key={rating.id}>
              <View style={styles.reviewTop}>
                <View style={styles.reviewPerson}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>
                      {rating.reviewerId === currentUser?.id ? currentUser?.fullName?.[0] ?? "Y" : "U"}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.reviewName}>
                      {rating.reviewerId === currentUser?.id ? "Submitted by you" : "Submitted by other user"}
                    </Text>
                    <Text style={styles.reviewDate}>Task review</Text>
                  </View>
                </View>
                <View style={styles.reviewScore}>
                  <Text accessibilityLabel={`${normalizedRating(rating.score)} out of 5 stars`} style={styles.reviewStars}>{"★".repeat(normalizedRating(rating.score))}{"☆".repeat(5 - normalizedRating(rating.score))}</Text>
                  <Text style={styles.reviewScoreText}>{normalizedRating(rating.score)}/5</Text>
                </View>
              </View>
              <Text style={styles.reviewText}>{rating.feedback}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal animationType="fade" transparent visible={successOpen} onRequestClose={() => router.replace(currentUser?.role === "worker" ? "/worker-dashboard" : "/client-dashboard")}>
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Rating Submitted Successfully!</Text>
            <Text style={styles.successText}>Thank you for sharing your feedback.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace(currentUser?.role === "worker" ? "/worker-dashboard" : "/client-dashboard")} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function normalizedRating(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.min(5, Math.max(0, Math.round(score))) : 0;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(207, 249, 255, 0.20)"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" },
  backText: { ...typography.button, color: palette.primary },
  brand: { ...typography.screenTitle, color: palette.primary },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceHigh
  },
  avatarText: { ...typography.bodyMedium, color: palette.secondary },
  content: { padding: 16, paddingTop: 24, gap: 16 },
  heroPanel: {
    minHeight: 164,
    borderRadius: 12,
    padding: 20,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16
  },
  heroCopy: { flex: 1, gap: 6 },
  heroKicker: {
    ...typography.overline,
    color: palette.primaryFixed,
  },
  heroTitle: { ...typography.screenTitle, color: palette.white },
  heroText: { ...typography.body, color: palette.primaryFixed },
  scoreBadge: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.secondaryContainer,
    borderWidth: 3,
    borderColor: "rgba(55,126,151,0.30)"
  },
  scoreBadgeValue: { ...typography.badge, color: "#F4C95D" },
  scoreBadgeLabel: { ...typography.badge, color: "#F4C95D" },
  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(207,249,255,0.28)",
    backgroundColor: palette.surface,
    gap: 18,
    shadowColor: "#001722",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  section: { gap: 10 },
  sectionTitle: { ...typography.sectionTitleSmall, color: palette.textStrong },
  sectionHint: { ...typography.metadata, color: palette.muted },
  scoreRow: { flexDirection: "row", gap: 8 },
  scoreButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceLow
  },
  scoreButtonSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primary
  },
  scoreButtonText: { ...typography.button, color: palette.muted },
  scoreButtonTextSelected: { color: palette.white },
  textArea: {
    ...typography.inputText,
    minHeight: 116,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceLow,
    color: palette.text,
    paddingHorizontal: 14,
    paddingTop: 12
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryButtonText: { ...typography.button, color: palette.white },
  successBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(1,15,25,0.72)", alignItems: "center", justifyContent: "center" },
  successCard: { width: "100%", maxWidth: 420, padding: 24, borderRadius: 20, backgroundColor: palette.surface, alignItems: "center", gap: 12 },
  successTitle: { ...typography.sectionTitle, color: palette.textStrong, textAlign: "center" },
  successText: { ...typography.body, color: palette.muted, textAlign: "center", marginBottom: 4 },
  submitError: { ...typography.button, color: "#FF7D8C", textAlign: "center" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  listTitle: { ...typography.sectionTitle, color: palette.textStrong },
  listSubtitle: { ...typography.metadata, color: palette.muted },
  countPill: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceContainer
  },
  countText: { ...typography.heroNumber, color: palette.primary },
  reviewList: { gap: 12 },
  reviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(207,249,255,0.28)",
    backgroundColor: palette.surface,
    gap: 10
  },
  reviewTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  reviewPerson: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.secondaryContainer
  },
  reviewAvatarText: { ...typography.bodyMedium, color: "#F4C95D" },
  reviewName: { ...typography.bodyMedium, color: palette.text },
  reviewDate: { ...typography.metadata, color: palette.muted },
  reviewScore: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.primaryFixed
  },
  reviewScoreText: { ...typography.badge, color: palette.primary },
  reviewStars: { ...typography.sectionTitleSmall, color: palette.secondary },
  reviewText: { ...typography.cardTitle, color: palette.muted },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78 }
});
