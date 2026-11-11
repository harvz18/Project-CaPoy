import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { MotionPressable as Pressable } from "../../src/components/MotionPressable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "../../src/components/StatusBadge";
import { useApp } from "../../src/context/AppContext";
import { useTasklinkBack } from "../../src/hooks/useTasklinkBack";
import { screenPalette } from "../../src/theme";
import { typography } from "../../src/typography";
import { AppText as Text } from "../../src/components/AppText";

const palette = screenPalette;

export default function WorkerPublicProfileScreen() {
  const router = useRouter();
  const goBack = useTasklinkBack();
  const insets = useSafeAreaInsets();
  const { id, taskId } = useLocalSearchParams<{ id: string; taskId?: string }>();
  const { actionLoading, currentUser, getUserById, ratings, taskMatches, tasks, updateTaskStatus, users } = useApp();
  const [actionError, setActionError] = useState("");
  const worker = getUserById(id);
  const selectedTask = tasks.find((task) => task.id === taskId);
  const activeMatch = taskMatches.find((match) =>
    match.taskId === taskId && match.workerId === worker?.id && match.acceptanceStatus === "Applied"
  );
  const canAcceptApplication = Boolean(
    worker
    && selectedTask
    && currentUser?.role === "client"
    && selectedTask.clientId === currentUser.id
    && selectedTask.status === "Applied"
    && selectedTask.applicantIds?.includes(worker.id)
    && activeMatch
  );
  const canMessageWorker = Boolean(
    worker
    && selectedTask
    && currentUser?.role === "client"
    && selectedTask.clientId === currentUser.id
    && (selectedTask.workerId === worker.id || selectedTask.applicantIds?.includes(worker.id))
  );
  const skills = worker?.capabilities?.length ? worker.capabilities : worker?.skills ?? [];
  const name = worker?.fullName ?? "Worker profile";
  const verificationStatus = worker?.verificationStatus ?? "Not Submitted";
  const experienceText =
    worker?.experienceDescription ||
    (worker?.yearsOfExperience ? `${worker.yearsOfExperience} of local task experience.` : "Experience details not provided yet.");
  const workerRatings = ratings
    .filter((rating) => rating.targetUserId === id)
    .map((rating) => ({
      ...rating,
      reviewerName: users.find((user) => user.id === rating.reviewerId)?.fullName ?? "TaskLink User"
    }));
  const averageRating = workerRatings.length
    ? (workerRatings.reduce((total, rating) => total + rating.score, 0) / workerRatings.length).toFixed(1)
    : worker && worker.rating > 0 ? worker.rating.toFixed(1) : "Not rated";
  const reviewCountLabel = workerRatings.length ? `${workerRatings.length} reviews` : "No reviews yet";
  const memberSince = worker?.createdAt && Number.isFinite(new Date(worker.createdAt).getTime())
    ? String(new Date(worker.createdAt).getFullYear())
    : "Not recorded";

  async function handleAcceptWorker() {
    if (!taskId || !worker || !canAcceptApplication) {
      setActionError("This tasker does not have an active application for this task. Return to Review Applicants and select a tasker marked Applied.");
      return;
    }
    try {
      setActionError("");
      await updateTaskStatus(taskId, "Accepted", worker.id);
      router.replace(`/task-status/${taskId}`);
    } catch (acceptError) {
      setActionError(acceptError instanceof Error ? acceptError.message : "Unable to accept this application.");
    }
  }

  if (!worker) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.backButton}>
            <Feather accessibilityElementsHidden color={palette.primary} name="arrow-left" size={22} />
          </Pressable>
        </View>
        <View style={styles.missingProfile}>
          <Text style={styles.sectionTitle}>Worker profile unavailable</Text>
          <Text style={styles.bio}>This profile could not be loaded. Go back and retry from the applicant list.</Text>
        </View>
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
          <Text style={styles.avatarText}>{name[0]}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 118 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.photoWrap}>
              <View style={styles.profilePhoto}>
                {worker.profilePhotoUrl ? <Image source={{ uri: worker.profilePhotoUrl }} style={styles.profilePhotoImage} /> : <Text style={styles.profilePhotoText}>{name[0]}</Text>}
              </View>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>{verificationStatus}</Text>
              </View>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{name}</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingValue}>{averageRating}</Text>
                <Text style={styles.reviewCount}>({reviewCountLabel})</Text>
              </View>
              <Text style={styles.bio}>{experienceText}</Text>
              {worker.availabilityStatus
                ? <StatusBadge status={worker.availabilityStatus} />
                : <Text style={styles.bio}>Availability not recorded.</Text>}
              <View style={styles.statsGrid}>
                <StatBox label="Jobs Completed" value={String(worker.completedTasks ?? 0)} />
                <StatBox label="Member since" value={memberSince} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capabilities</Text>
          <View style={styles.skillRow}>
            {skills.length ? skills.map((skill, index) => (
              <View key={`${skill}-${index}`} style={styles.skillChip}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            )) : <Text style={styles.bio}>No capabilities listed.</Text>}
          </View>
        </View>

        <View style={styles.verificationCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Verification</Text>
            <View style={styles.verificationStatusBadge}>
              <Text style={styles.verificationStatusText}>{verificationStatus}</Text>
            </View>
          </View>
          <Text style={styles.bio}>Private identity and medical files are reviewed by authorized staff and are not exposed on public profiles.</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <Text style={styles.reviewCount}>{reviewCountLabel}</Text>
          </View>
          {workerRatings.length ? (
            workerRatings.map((rating) => (
              <ReviewCard
                key={rating.id}
                initials={rating.reviewerName[0] ?? "U"}
                name={rating.reviewerName}
                date="Task review"
                stars={rating.score}
                text={rating.feedback}
              />
            ))
          ) : (
            <View style={styles.reviewEmptyCard}>
              <Text style={styles.reviewEmptyText}>No reviews yet</Text>
            </View>
          )}
        </View>

        <View style={styles.coverageCard}>
          <View style={styles.coverageHeader}>
            <Text style={styles.coverageTitle}>Location privacy</Text>
          </View>
          <Text style={styles.bio}>TaskLink uses the tasker's private saved location for matching. Exact coordinates and home address are not displayed here.</Text>
        </View>
        {taskId && !canAcceptApplication && selectedTask?.workerId !== worker.id ? (
          <Text style={styles.applicationHint}>This tasker cannot be accepted because they do not have an active application for the selected task.</Text>
        ) : null}
        {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          accessibilityLabel="Message worker"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canMessageWorker }}
          disabled={!canMessageWorker}
          style={[styles.messageButton, !canMessageWorker && styles.messageButtonDisabled]}
          onPress={() =>
            router.push({
              pathname: "/chat/[id]",
              params: { id: taskId as string, recipientId: worker.id }
            })
          }
        >
          <Text style={styles.messageButtonText}>Message</Text>
        </Pressable>
        <Pressable accessibilityLabel="Accept worker application" accessibilityRole="button" accessibilityState={{ busy: actionLoading, disabled: !canAcceptApplication || actionLoading }} disabled={!canAcceptApplication || actionLoading} style={[styles.hireButton, (!canAcceptApplication || actionLoading) && styles.hireButtonDisabled]} onPress={handleAcceptWorker}>
          <Text style={[styles.hireButtonText, !canAcceptApplication && styles.hireButtonTextDisabled]}>
            {actionLoading ? "Accepting..." : canAcceptApplication ? "Accept Application" : selectedTask?.workerId === worker.id ? "Worker Accepted" : taskId ? "Not an Active Applicant" : "No Task Selected"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ReviewCard({ initials, name, date, stars, text }: { initials: string; name: string; date: string; stars: number; text: string }) {
  const score = Number.isFinite(stars) ? Math.min(5, Math.max(0, Math.round(stars))) : 0;
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        <View style={styles.reviewPerson}>
          <View style={styles.reviewAvatar}>
            <Text style={styles.reviewAvatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.reviewName}>{name}</Text>
            <Text style={styles.reviewDate}>{date}</Text>
          </View>
        </View>
        <Text accessibilityLabel={`${score} out of 5 stars`} style={styles.reviewStars}>{"★".repeat(score)}{"☆".repeat(5 - score)} <Text style={styles.reviewScore}>{score}/5</Text></Text>
      </View>
      <Text style={styles.reviewText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: "rgba(207, 249, 255, 0.20)" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" },
  backText: { ...typography.button, color: palette.primary },
  brand: { ...typography.screenTitle, color: palette.primary },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.surfaceHigh, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.bodyMedium, color: palette.secondary },
  content: { padding: 16, paddingTop: 24, gap: 16 },
  missingProfile: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  profileCard: { padding: 24, borderRadius: 12, borderWidth: 1, borderColor: "rgba(207,249,255,0.28)", backgroundColor: palette.surface, shadowColor: "#001722", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  profileHeader: { alignItems: "center", gap: 20 },
  photoWrap: { position: "relative" },
  profilePhoto: { width: 132, height: 132, borderRadius: 66, borderWidth: 4, borderColor: palette.primaryFixed, backgroundColor: palette.secondaryContainer, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  profilePhotoImage: { width: "100%", height: "100%" },
  profilePhotoText: { ...typography.heroNumber, color: "#F4C95D" },
  verifiedPill: { position: "absolute", right: -4, bottom: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: palette.success },
  verifiedText: { ...typography.badge, color: palette.white },
  profileCopy: { width: "100%", alignItems: "center", gap: 8 },
  profileName: { ...typography.screenTitle, color: palette.textStrong, textAlign: "center" },
  ratingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  star: { ...typography.sectionTitleSmall, color: palette.secondary },
  ratingValue: { ...typography.sectionTitle, color: palette.secondary },
  reviewCount: { ...typography.heroNumber, color: palette.muted },
  bio: { ...typography.cardTitle, color: palette.muted, textAlign: "center" },
  statsGrid: { flexDirection: "row", gap: 12, width: "100%", paddingTop: 8 },
  statBox: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: palette.surfaceContainer, alignItems: "center" },
  statLabel: { ...typography.fieldLabel, color: palette.muted },
  statValue: { ...typography.heroNumber, color: palette.primary },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { ...typography.sectionTitle, color: palette.textStrong },
  viewAll: { ...typography.button, color: palette.primary },
  viewAllComingSoon: { alignItems: "flex-end" },
  viewAllHint: { ...typography.button, color: palette.muted },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: palette.primaryContainer, borderWidth: 1, borderColor: "rgba(0,201,179,0.24)" },
  skillChipMuted: { backgroundColor: palette.surfaceHigh, borderColor: palette.surfaceHigh },
  skillText: { ...typography.bodyMedium, color: "#7FF6E6" },
  skillTextMuted: { color: palette.muted },
  verificationCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(207,249,255,0.28)", backgroundColor: palette.surface, gap: 12 },
  verificationStatusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(38, 229, 178, 0.16)" },
  verificationStatusText: { ...typography.badge, color: palette.success },
  documentGrid: { gap: 8 },
  documentRow: { minHeight: 42, borderRadius: 8, backgroundColor: palette.surfaceLow, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  documentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.outlineVariant },
  documentDotComplete: { backgroundColor: palette.success },
  documentText: { ...typography.badge, color: palette.text, flex: 1 },
  documentStatus: { ...typography.badge, color: palette.muted },
  documentStatusComplete: { color: palette.success },
  reviewCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(207,249,255,0.28)", backgroundColor: palette.surface, gap: 10 },
  reviewEmptyCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow },
  reviewEmptyText: { ...typography.bodyMedium, color: palette.muted },
  reviewTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  reviewPerson: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.secondaryFixed, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { ...typography.bodyMedium, color: "#F5FCFF" },
  reviewName: { ...typography.bodyMedium, color: palette.text },
  reviewDate: { ...typography.metadata, color: palette.muted },
  reviewStars: { ...typography.sectionTitleSmall, color: palette.secondary },
  reviewScore: { ...typography.badge, color: palette.muted },
  reviewText: { ...typography.cardTitle, color: palette.muted },
  coverageCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(207,249,255,0.28)", backgroundColor: palette.surfaceLow, gap: 12 },
  actionError: { ...typography.button, color: "#FF7D8C", textAlign: "center" },
  applicationHint: { ...typography.metadata, color: "#F4C95D", textAlign: "center" },
  coverageHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  coverageIcon: { ...typography.heroNumber, color: palette.primary },
  coverageTitle: { ...typography.bodyMedium, color: palette.textStrong },
  coverageMap: { height: 128, borderRadius: 8, backgroundColor: "rgba(20, 217, 226, 0.12)", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  mapRoadOne: { position: "absolute", left: -18, right: -18, top: 58, height: 14, backgroundColor: "#17607A", transform: [{ rotate: "-12deg" }] },
  mapRoadTwo: { position: "absolute", top: -12, bottom: -12, left: "58%", width: 16, backgroundColor: "#14556D", transform: [{ rotate: "18deg" }] },
  coverageBadge: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: palette.surface },
  coverageBadgeText: { ...typography.badge, color: palette.primary },
  bottomAction: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.outlineVariant, backgroundColor: palette.surface, flexDirection: "row", gap: 12, elevation: 12 },
  messageButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceHigh },
  messageButtonDisabled: { opacity: 0.5 },
  messageButtonText: { ...typography.button, color: palette.text },
  hireButton: { flex: 2, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  hireButtonDisabled: { backgroundColor: palette.surfaceHigh },
  hireButtonText: { ...typography.button, color: palette.white, textAlign: "center" },
  hireButtonTextDisabled: { color: palette.muted }
});
