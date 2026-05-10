import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/EmptyState";
import { useApp } from "../../src/context/AppContext";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  surfaceHigh: "#E0E3E1",
  primary: "#005C55",
  primaryFixed: "#9CF2E8",
  secondary: "#855300",
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  white: "#FFFFFF"
};

export default function RatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { submitRating, ratings, currentUser, tasks } = useApp();
  const [score, setScore] = useState(5);
  const [feedback, setFeedback] = useState("");
  const task = tasks.find((item) => item.id === id);
  const taskRatings = ratings.filter((rating) => rating.taskId === id);

  async function handleSubmit() {
    await submitRating(id, score, feedback || "Good transaction.");
    router.back();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{"<"}</Text>
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
            <Text style={styles.heroTitle}>{task?.title ?? "Completed Task"}</Text>
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
                    accessibilityRole="button"
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
            accessibilityRole="button"
            onPress={handleSubmit}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Submit Rating</Text>
          </Pressable>
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
                  <Text style={styles.reviewScoreText}>{rating.score}/5</Text>
                </View>
              </View>
              <Text style={styles.reviewText}>{rating.feedback}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
    borderBottomColor: "#EDF1EF"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { color: palette.text, fontSize: 34, lineHeight: 36 },
  brand: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceHigh
  },
  avatarText: { color: palette.secondary, fontWeight: "900" },
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
    color: palette.primaryFixed,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  heroTitle: { color: palette.white, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  heroText: { color: "#DDF8F4", fontSize: 14, lineHeight: 20 },
  scoreBadge: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.secondaryContainer,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.72)"
  },
  scoreBadgeValue: { color: "#684000", fontSize: 24, lineHeight: 30, fontWeight: "900" },
  scoreBadgeLabel: { color: "#684000", fontSize: 11, lineHeight: 14, fontWeight: "900" },
  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.35)",
    backgroundColor: palette.surface,
    gap: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  section: { gap: 10 },
  sectionTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 24, fontWeight: "900" },
  sectionHint: { color: palette.muted, fontSize: 12, lineHeight: 16 },
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
  scoreButtonText: { color: palette.muted, fontSize: 18, lineHeight: 26, fontWeight: "900" },
  scoreButtonTextSelected: { color: palette.white },
  textArea: {
    minHeight: 116,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceLow,
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
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
  primaryButtonText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  listTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  listSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  countPill: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceContainer
  },
  countText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  reviewList: { gap: 12 },
  reviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.35)",
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
  reviewAvatarText: { color: "#684000", fontWeight: "900" },
  reviewName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  reviewDate: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  reviewScore: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.primaryFixed
  },
  reviewScoreText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  reviewText: { color: palette.muted, fontSize: 16, lineHeight: 24 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
