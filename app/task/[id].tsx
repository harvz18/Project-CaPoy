import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentProps, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../src/components/AppText";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SmartMatchBadge } from "../../src/components/SmartMatchBadge";
import { useApp } from "../../src/context/AppContext";
import { useTasklinkBack } from "../../src/hooks/useTasklinkBack";
import { rankTaskMatches } from "../../src/domain/matching";
import { estimateServiceFee, formatCentavos } from "../../src/domain/platformRevenue";
import { verificationProgressPublicLabel } from "../../src/domain/verificationProgress";
import { formatPaymentMethod, formatRequiredCapabilities, formatTaskDuration, formatTaskPrice, formatTaskSchedule } from "../../src/domain/taskMarketplace";
import { loadPlatformRevenueConfig } from "../../src/services/platformRevenueService";
import { TaskMatch } from "../../src/types";
import { sanitizeMoneyInput } from "../../src/utils/numericInput";
import { isTaskOpenForApplications, taskExpiryMessage } from "../../src/domain/taskExpiry";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  surfaceHigh: "#E0E3E1",
  primary: "#005C55",
  primaryContainer: "#0F766E",
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

export default function TaskDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useTasklinkBack();
  const insets = useSafeAreaInsets();
  const { actionLoading, currentUser, users, ratings, getUserById, tasks, taskMatches, acceptTask, rejectApplication, updateTaskStatus } = useApp();
  const [proposedAmount, setProposedAmount] = useState("");
  const [actionError, setActionError] = useState("");
  const [serviceFeeBasisPoints, setServiceFeeBasisPoints] = useState(500);
  const task = tasks.find((item) => item.id === id);

  useEffect(() => {
    void loadPlatformRevenueConfig()
      .then((config) => {
        if (config?.enabled && typeof config.rateBasisPoints === "number") {
          setServiceFeeBasisPoints(config.rateBasisPoints);
        }
      })
      .catch(() => undefined);
  }, []);

  if (!task) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <TopBar title="Task" onBack={goBack} />
        <View style={styles.notFound}>
          <Text style={styles.title}>Task not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isClient = currentUser?.role === "client";
  const applicantIds = [...(task.applicantIds ?? [])];
  if (task.status === "Applied" && task.workerId && !applicantIds.includes(task.workerId)) {
    applicantIds.push(task.workerId);
  }
  const rankedMatches = rankTaskMatches(taskMatches.filter(
    (match) => match.taskId === task.id && applicantIds.includes(match.workerId) && match.acceptanceStatus === "Applied"
  ));
  const rankedApplicantIds = [...rankedMatches.map((match) => match.workerId), ...applicantIds.filter(
    (applicantId) => !rankedMatches.some((match) => match.workerId === applicantId)
  )];
  const applicants = rankedApplicantIds.flatMap((applicantId) => {
    const applicant = users.find((user) => user.id === applicantId);
    return applicant ? [applicant] : [];
  });
  const applicantCount = applicantIds.length;
  const hasAcceptedWorker = task.status === "Accepted" && Boolean(task.workerId);
  const worker = getUserById(task.workerId);
  const employer = getUserById(task.clientId);
  const employerScores = ratings.filter((rating) => rating.targetUserId === task.clientId).map((rating) => rating.score);
  const employerRating = employerScores.length
    ? employerScores.reduce((total, score) => total + score, 0) / employerScores.length
    : employer?.rating;
  const description = task.description.trim();
  const hasApplied = Boolean(currentUser?.id && task.applicantIds?.includes(currentUser.id));
  const canWorkerApply = isTaskOpenForApplications(task);
  const workerActionLabel = actionLoading
    ? task.pricingMode === "bidding" ? "Submitting..." : "Applying..."
    : hasApplied || !canWorkerApply
      ? "Open Task Status"
      : task.pricingMode === "bidding"
        ? "Submit Offer"
        : "Apply";
  const chatRecipientId = isClient
    ? task.workerId ?? (applicantIds.length === 1 ? applicantIds[0] : undefined)
    : task.clientId;

  function openTaskChat() {
    if (!chatRecipientId) {
      // A client with several applicants must choose the intended tasker in the
      // inbox. This prevents a message from being sent to the wrong applicant.
      router.push("/chat");
      return;
    }

    router.push({
      pathname: "/chat/[id]",
      params: { id, recipientId: chatRecipientId }
    });
  }

  async function handleWorkerAccept() {
    const taskId = task?.id;
    if (!taskId) {
      return;
    }
    try {
      setActionError("");
      await acceptTask(taskId, proposedAmount);
      router.replace(`/task-status/${taskId}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to apply.");
    }
  }

  async function handleClientAcceptWorker(workerId: string) {
    const taskId = task?.id;
    if (!taskId) {
      return;
    }
    try {
      setActionError("");
      await updateTaskStatus(taskId, "Accepted", workerId);
      router.replace(`/task-status/${taskId}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to accept this application.");
    }
  }

  async function handleClientRejectWorker(workerId: string) {
    if (!task?.id) return;
    try {
      setActionError("");
      await rejectApplication(task.id, workerId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to reject this application.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <TopBar title={isClient ? "Task Details" : "Job Details"} onBack={goBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: isClient ? 32 + insets.bottom : 14 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryMetaRow}>
            <Text style={styles.categoryLabel}>{task.category}</Text>
            <Text numberOfLines={1} style={styles.price}>{formatTaskPrice(task)}</Text>
          </View>
          <Text style={styles.title}>{task.title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>

        <View style={styles.informationCard}>
          <Text style={styles.informationTitle}>Job Information</Text>
          <View style={styles.compactInfoGrid}>
            <DetailBox label="Duration" value={formatTaskDuration(task)} />
            <DetailBox label="Payment" value={formatPaymentMethod(task.paymentMethod)} />
          </View>
          <DetailRow icon="map-pin" label="Location" value={task.locationAddress ?? task.location} />
          <DetailRow icon="calendar" label="Schedule" value={formatTaskSchedule(task)} />
          <DetailRow icon="tool" label="Capabilities" value={formatRequiredCapabilities(task)} />
          <DetailRow icon="crosshair" label="Task Radius" value={`${task.geofenceRadius ?? 500} meters`} />
          <DetailRow
            icon="user"
            label="Employer"
            value={`${employer?.fullName ?? "TaskLink employer"} · ${employer ? verificationProgressPublicLabel(employer) : "Verification: 0% complete"}${employerRating ? ` · ★ ${employerRating.toFixed(1)}` : ""}`}
          />
          <DetailRow icon="users" label="Applicants" value={hasAcceptedWorker ? "1 accepted" : `${applicantCount} applied`} />
        </View>

        {task.perks?.length ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Perks</Text>
          <View style={styles.skillRow}>{task.perks.map((perk) => <Text key={perk} style={styles.skillChip}>{perk}</Text>)}</View>
        </View> : null}

        {isClient ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{task.status === "Accepted" ? "Assigned Worker" : "Worker Applications"}</Text>
              <Text style={styles.sectionMeta}>{task.status === "Accepted" ? "Ready to start" : "Smart Match ranking"}</Text>
            </View>
            {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
            {hasAcceptedWorker ? (
              <View style={styles.workerCard}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/worker-profile/[id]",
                      params: { id: task.workerId as string, taskId: task.id }
                    })
                  }
                  style={styles.workerIdentity}
                >
                  <View style={styles.workerAvatar}>
                    <Text style={styles.workerAvatarText}>{worker?.fullName?.[0] ?? "W"}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.workerName}>{worker?.fullName ?? "Worker"}</Text>
                    <Text style={styles.workerMeta}>{ratingSummary(worker?.rating)} · {worker?.completedTasks ?? 0} jobs</Text>
                    <Text style={styles.workerNote}>{worker?.availabilityStatus ?? "Availability not recorded"}</Text>
                  </View>
                </Pressable>
                <View style={styles.skillRow}>
                  {(worker?.capabilities ?? worker?.skills ?? []).map((skill) => (
                    <Text key={skill} style={styles.skillChip}>{skill}</Text>
                  ))}
                </View>
                <View style={styles.workerActions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() =>
                      router.push({
                        pathname: "/worker-profile/[id]",
                        params: { id: task.workerId as string, taskId: task.id }
                      })
                    }
                  >
                    <Text style={styles.secondaryButtonText}>View Profile</Text>
                  </Pressable>
                  <Pressable
                    disabled={task.status !== "Applied" || !task.workerId}
                    onPress={() => task.workerId && handleClientAcceptWorker(task.workerId)}
                    style={[styles.primaryButton, (task.status !== "Applied" || !task.workerId) && styles.disabledButton]}
                  >
                    <Text style={styles.primaryButtonText}>{task.status === "Accepted" ? "Worker Accepted" : "Accept Application"}</Text>
                  </Pressable>
                </View>
              </View>
            ) : applicants.length ? (
              applicants.map((applicant) => (
                <View key={applicant.id} style={styles.workerCard}>
                  {(() => {
                    const match = rankedMatches.find((item) => item.workerId === applicant.id);
                    return match ? <ApplicantMatchSummary match={match} showBid={task.pricingMode === "bidding"} serviceFeeBasisPoints={serviceFeeBasisPoints} /> : null;
                  })()}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/worker-profile/[id]",
                        params: { id: applicant.id, taskId: task.id }
                      })
                    }
                    style={styles.workerIdentity}
                  >
                    <View style={styles.workerAvatar}>
                      <Text style={styles.workerAvatarText}>{applicant.fullName?.[0] ?? "W"}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.workerName}>{applicant.fullName}</Text>
                      <Text style={styles.workerMeta}>{ratingSummary(applicant.rating)} · {applicant.completedTasks ?? 0} jobs</Text>
                      <Text style={styles.workerNote}>{verificationProgressPublicLabel(applicant)}</Text>
                      <Text style={styles.workerNote}>{applicant.availabilityStatus ?? "Availability not recorded"}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.skillRow}>
                    {(applicant.capabilities ?? applicant.skills ?? []).map((skill) => (
                      <Text key={skill} style={styles.skillChip}>{skill}</Text>
                    ))}
                  </View>
                  <View style={styles.workerActions}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() =>
                        router.push({
                          pathname: "/worker-profile/[id]",
                          params: { id: applicant.id, taskId: task.id }
                        })
                      }
                    >
                      <Text style={styles.secondaryButtonText}>View Profile</Text>
                    </Pressable>
                    <Pressable disabled={actionLoading} style={[styles.primaryButton, actionLoading && styles.disabledButton]} onPress={() => handleClientAcceptWorker(applicant.id)}>
                      <Text style={styles.primaryButtonText}>{actionLoading ? "Working..." : "Accept"}</Text>
                    </Pressable>
                  </View>
                  <Pressable disabled={actionLoading} style={[styles.rejectButton, actionLoading && styles.disabledButton]} onPress={() => handleClientRejectWorker(applicant.id)}>
                    <Text style={styles.rejectButtonText}>Reject Application</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.emptyWorkerState}>
                <Text style={styles.emptyWorkerTitle}>No workers have applied yet</Text>
                <Text style={styles.emptyWorkerText}>
                  Applications will appear here once a worker responds to your task.
                </Text>
              </View>
            )}
          </View>
        ) : task.pricingMode === "bidding" && canWorkerApply && !hasApplied ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Offer</Text>
            <TextInput
              accessibilityLabel="Offer amount"
              keyboardType="decimal-pad"
              onChangeText={(value) => setProposedAmount(sanitizeMoneyInput(value))}
              placeholder="Your offer amount (₱)"
              placeholderTextColor={palette.outline}
              style={styles.bidInput}
              value={proposedAmount}
            />
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={openTaskChat}>
            <Text style={styles.secondaryButtonText}>Chat</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/task-status/${task.id}`)}>
            <Text style={styles.secondaryButtonText}>Status</Text>
          </Pressable>
        </View>
      </ScrollView>
      {!isClient ? (
        <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {!canWorkerApply && !hasApplied ? <Text style={styles.expiryNotice}>{taskExpiryMessage(task)}</Text> : null}
          {actionError ? <Text accessibilityRole="alert" style={styles.errorText}>{actionError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: actionLoading }}
            disabled={actionLoading}
            onPress={hasApplied || !canWorkerApply ? () => router.push(`/task-status/${task.id}`) : handleWorkerAccept}
            style={({ pressed }) => [styles.stickyPrimaryButton, actionLoading && styles.disabledButton, pressed && !actionLoading && styles.pressedButton]}
          >
            <Text style={styles.primaryButtonText}>{workerActionLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ApplicantMatchSummary({ match, showBid, serviceFeeBasisPoints = 500 }: { match: TaskMatch; showBid?: boolean; serviceFeeBasisPoints?: number }) {
  const evaluated = match.matchScore !== undefined && match.matchPolicyVersion !== undefined;
  const serviceFee = showBid && match.proposedAmount
    ? estimateServiceFee(match.proposedAmount, serviceFeeBasisPoints)
    : undefined;
  const offerFeeNotice = serviceFee ? <OfferFeeNotice serviceFee={serviceFee} /> : null;

  if (!evaluated) {
    return (
      <View style={styles.matchSummary}>
        {offerFeeNotice}
        {showBid && match.proposedAmount ? <Text style={styles.bidChip}>Offer: ₱{match.proposedAmount}</Text> : null}
        <Text style={styles.skillChip}>Match evaluation pending</Text>
        <Text style={styles.workerNote}>Trusted score will appear after the matching service evaluates this application.</Text>
      </View>
    );
  }

  return (
    <View style={styles.matchSummary}>
      <View style={styles.skillRow}>
        {showBid && match.proposedAmount ? <Text style={styles.bidChip}>Offer: ₱{match.proposedAmount}</Text> : null}
        <SmartMatchBadge eligible={match.eligible} reasons={match.matchReasons} score={match.matchScore} />
      </View>
      {offerFeeNotice}
    </View>
  );
}

function OfferFeeNotice({ serviceFee }: { serviceFee: NonNullable<ReturnType<typeof estimateServiceFee>> }) {
  return (
    <View style={styles.offerFeeNote}>
      <Text style={styles.offerFeeTotal}>Employer total: {formatCentavos(serviceFee.totalCentavos)}</Text>
      <Text style={styles.offerFeeText}>Includes the {(serviceFee.rateBasisPoints / 100).toFixed(2)}% TASKLINK service fee ({formatCentavos(serviceFee.feeCentavos)}).</Text>
    </View>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Feather accessibilityElementsHidden color={palette.primary} name="arrow-left" size={22} />
      </Pressable>
      <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

function ratingSummary(rating?: number) {
  return rating !== undefined && rating > 0 ? `${rating.toFixed(1)} rating` : "Not rated";
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: ComponentProps<typeof Feather>["name"]; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Feather accessibilityElementsHidden color={palette.muted} name={icon} size={17} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  backButton: { position: "absolute", left: 8, minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center", zIndex: 1 },
  headerTitle: { maxWidth: "68%", color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: "800", textAlign: "center" },
  content: { padding: 14, gap: 14 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  summaryCard: { padding: 16, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: "rgba(189,201,198,0.55)", gap: 10 },
  summaryMetaRow: { minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flex: { flex: 1 },
  categoryLabel: { flex: 1, minWidth: 0, color: palette.success, fontSize: 12, lineHeight: 16, fontWeight: "800", textTransform: "uppercase" },
  title: { minWidth: 0, color: palette.textStrong, fontSize: 20, lineHeight: 27, fontWeight: "800" },
  description: { color: palette.muted, fontSize: 15, lineHeight: 22 },
  price: { maxWidth: "48%", flexShrink: 0, color: palette.textStrong, fontSize: 20, lineHeight: 27, fontWeight: "800", textAlign: "right" },
  informationCard: { paddingHorizontal: 16, paddingTop: 16, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: "rgba(189,201,198,0.55)" },
  informationTitle: { color: palette.textStrong, fontSize: 18, lineHeight: 24, fontWeight: "800", marginBottom: 12 },
  compactInfoGrid: { flexDirection: "row", gap: 16, paddingBottom: 12 },
  detailBox: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.surfaceLow },
  detailRow: { minWidth: 0, flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(189,201,198,0.35)" },
  detailIcon: { width: 28, paddingTop: 2, alignItems: "center" },
  detailCopy: { flex: 1, minWidth: 0, gap: 3 },
  detailLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  detailValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 8 },
  sectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  sectionMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, flexShrink: 0 },
  workerCard: { padding: 16, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant, gap: 14, elevation: 2 },
  workerIdentity: { flexDirection: "row", alignItems: "center", gap: 12 },
  workerAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: palette.secondaryContainer },
  workerAvatarText: { color: "#684000", fontSize: 22, fontWeight: "900" },
  workerName: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  workerMeta: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  workerNote: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  matchSummary: { gap: 6 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: palette.surfaceContainer, color: palette.muted, fontSize: 12, fontWeight: "800" },
  workerActions: { flexDirection: "row", gap: 10 },
  emptyWorkerState: { padding: 16, borderRadius: 12, backgroundColor: palette.surfaceLow, borderWidth: 1, borderColor: palette.outlineVariant, gap: 4 },
  emptyWorkerTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  emptyWorkerText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  primaryButtonText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  editTaskButton: { minHeight: 44, borderRadius: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E5F3F0", borderWidth: 1, borderColor: "#9CCBC4" },
  editTaskText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center", backgroundColor: palette.surface },
  secondaryButtonText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  disabledButton: { backgroundColor: palette.surfaceHigh },
  rejectButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: "#B91C1C", alignItems: "center", justifyContent: "center", backgroundColor: palette.surface },
  rejectButtonText: { color: "#B91C1C", fontSize: 13, lineHeight: 18, fontWeight: "900" },
  bidInput: { minHeight: 48, borderWidth: 1, borderColor: palette.outlineVariant, borderRadius: 10, paddingHorizontal: 14, backgroundColor: palette.surface, color: palette.text },
  bidChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#FFF2DB", color: palette.secondary, fontSize: 13, fontWeight: "900" },
  offerFeeNote: { padding: 10, borderRadius: 8, backgroundColor: "#E5F3F0", borderWidth: 1, borderColor: "#9CCBC4", gap: 2 },
  offerFeeTotal: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  offerFeeText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  errorText: { color: "#B91C1C", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  expiryNotice: { color: "#B91C1C", fontSize: 12, lineHeight: 17, fontWeight: "700", paddingBottom: 8, textAlign: "center" },
  stickyFooter: { paddingHorizontal: 14, paddingTop: 10, gap: 8, borderTopWidth: 1, borderTopColor: "rgba(189,201,198,0.55)", backgroundColor: palette.surface, shadowColor: "#0F172A", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 8 },
  stickyPrimaryButton: { minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  pressedButton: { opacity: 0.82, transform: [{ scale: 0.995 }] },
});
