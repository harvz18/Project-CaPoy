import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LocationMap from "../../src/components/LocationMap";
import { StatusBadge } from "../../src/components/StatusBadge";
import { useApp } from "../../src/context/AppContext";
import { useForegroundLocationWatch } from "../../src/hooks/useForegroundLocationWatch";
import { PaymentStatus, Task, TaskStatus } from "../../src/types";
import {
  formatDistance,
  getGeofenceCheck,
  getLiveLocationIssue,
  getTaskCheckDistanceKm,
  shouldTrackTaskLocation
} from "../../src/utils/location";
import { pickAndUploadPaymentProof } from "../../src/services/fileUploadService";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  surfaceHigh: "#E0E3E1",
  primary: "#005C55",
  secondary: "#855300",
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  urgent: "#EF4444",
  white: "#FFFFFF"
};

export default function TaskStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { acceptTask, actionLoading, confirmCashPayment, currentUser, getUserById, ratings, tasks, submitPaymentProof, updateTaskStatus, withdrawApplication } = useApp();
  const task = tasks.find((item) => item.id === id);
  const taskClient = getUserById(task?.clientId) ?? (currentUser?.id === task?.clientId ? currentUser : undefined);
  const [actionWarning, setActionWarning] = useState("");
  const [proofOfPaymentText, setProofOfPaymentText] = useState(task?.proofOfPaymentText ?? "");
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState(task?.proofOfPaymentUrl ?? "");
  const [proofFileName, setProofFileName] = useState(task?.proofOfPaymentUrl?.split("/").pop() ?? "");
  const [uploadingProof, setUploadingProof] = useState(false);
  const liveTrackingEnabled = shouldTrackTaskLocation(
    currentUser?.role,
    currentUser?.id,
    task?.workerId,
    task?.status
  );
  const liveTracking = useForegroundLocationWatch(liveTrackingEnabled);

  if (!task) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <TopBar initials={currentUser?.fullName?.[0] ?? "U"} onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={styles.title}>Task not found</Text>
          <Pressable style={styles.secondaryAction} onPress={() => router.replace("/worker-dashboard")}>
            <Text style={styles.secondaryActionText}>Back to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const workerHasApplied = Boolean(currentUser?.id && task.applicantIds?.includes(currentUser.id));
  const taskIsOpenForApplications = !task.workerId && (task.status === "Finding Workers" || task.status === "Applied");
  const workerCanTrackTask =
    currentUser?.role !== "worker" ||
    task.workerId === currentUser?.id ||
    workerHasApplied ||
    taskIsOpenForApplications;
  const action = getPrimaryAction(task.status, currentUser?.role, workerHasApplied, task.paymentStatus);
  const locationActor = currentUser && liveTracking.location ? {
    ...currentUser,
    currentLatitude: liveTracking.location.latitude,
    currentLongitude: liveTracking.location.longitude,
    locationAccuracyMeters: liveTracking.location.accuracyMeters,
    locationUpdatedAt: liveTracking.location.capturedAt,
    locationSource: liveTracking.location.source
  } : currentUser;
  const distanceKm = getTaskCheckDistanceKm(locationActor, task);
  const geofenceCheck = currentUser?.role === "worker"
    ? getGeofenceCheck(locationActor, task, liveTracking.checkedAt)
    : { allowed: false, reason: "The assigned worker's location is checked privately when they start or finish the task." };
  const insideGeofence = geofenceCheck.allowed;
  const liveLocationIssue = liveTracking.status === "error"
    ? liveTracking.issue?.message
    : getLiveLocationIssue(liveTracking.location, liveTracking.checkedAt);
  const liveLocationHealthy = liveTracking.status === "watching" && !liveLocationIssue;
  const clientHasRated = Boolean(
    currentUser?.role === "client" && task.workerId && ratings.some((rating) => rating.taskId === task.id && rating.reviewerId === currentUser.id)
  );
  const reportTargetId = currentUser?.id === task.clientId
    ? task.workerId
    : currentUser?.id === task.workerId
      ? task.clientId
      : undefined;

  async function handlePrimaryAction() {
    if (!task) {
      return;
    }

    if (currentUser?.role === "client" && task.status === "Applied" && !action.nextStatus) {
      router.push(`/task/${task.id}`);
      return;
    }

    if (!action.nextStatus) {
      return;
    }

    try {
      setActionWarning("");
      if (action.nextStatus === "Applied" && currentUser?.role === "worker") {
        await acceptTask(task.id);
        return;
      }

      await updateTaskStatus(
        task.id,
        action.nextStatus,
        undefined
      );
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to continue. Please try again.");
    }
  }

  if (!workerCanTrackTask) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <TopBar initials={currentUser?.fullName?.[0] ?? "U"} onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={styles.title}>Apply before tracking this task</Text>
          <Text style={styles.emptyText}>This status screen is only for workers who applied to the task or were accepted by the client.</Text>
          <Pressable style={styles.secondaryAction} onPress={() => router.replace(`/task/${task.id}`)}>
            <Text style={styles.secondaryActionText}>Open Job Details</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  async function handleSubmitPaymentProof() {
    if (!task) {
      return;
    }

    try {
      setActionWarning("");
      await submitPaymentProof(task.id, proofOfPaymentText, proofOfPaymentUrl || undefined);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to submit payment proof.");
    }
  }

  async function handleUploadPaymentProof() {
    if (!task) return;
    setUploadingProof(true);
    setActionWarning("");
    try {
      const uploaded = await pickAndUploadPaymentProof(task.id);
      if (uploaded) {
        setProofOfPaymentUrl(uploaded.path);
        setProofFileName(uploaded.name);
      }
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to upload payment evidence.");
    } finally {
      setUploadingProof(false);
    }
  }

  async function handleConfirmCashPayment() {
    if (!task) return;
    try {
      setActionWarning("");
      await confirmCashPayment(task.id);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to confirm cash payment.");
    }
  }

  async function handleSecondaryWorkflowAction(actionName: "withdraw" | "cancel" | "dispute") {
    if (!task) return;
    try {
      setActionWarning("");
      if (actionName === "withdraw") {
        await withdrawApplication(task.id);
        return;
      }
      await updateTaskStatus(task.id, actionName === "cancel" ? "Cancelled" : "Disputed");
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to continue. Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <TopBar initials={currentUser?.fullName?.[0] ?? "U"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 132 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.mapHero}>
          <LocationMap
            center={task.latitude !== undefined && task.longitude !== undefined ? { latitude: task.latitude, longitude: task.longitude } : undefined}
            markers={[
              ...(task.latitude !== undefined && task.longitude !== undefined
                ? [{ id: task.id, latitude: task.latitude, longitude: task.longitude, title: task.title }]
                : []),
              ...(liveTracking.location ? [{
                id: "current-device",
                latitude: liveTracking.location.latitude,
                longitude: liveTracking.location.longitude,
                title: "Current device location",
                description: Number.isFinite(liveTracking.location.accuracyMeters)
                  ? `Accuracy about ${Math.round(liveTracking.location.accuracyMeters as number)} meters`
                  : "Accuracy unavailable",
                color: "#2563EB"
              }] : [])
            ]}
            radiusMeters={task.geofenceRadius}
            height={260}
          />
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>{task.status === "Finding Workers" ? "Open" : task.status}</Text>
          </View>
          <View style={styles.locationBadge}>
            <Text style={styles.locationText}>{task.location}</Text>
          </View>
        </View>

        <View style={styles.sheetWrap}>
          <View style={styles.card}>
            <View style={styles.jobHeader}>
              <View style={styles.jobTitleBlock}>
                <Text style={styles.title}>{task.title}</Text>
                <Text style={styles.metaText}>Estimated duration: {task.estimatedDuration}</Text>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.price}>P{task.wage}</Text>
                <Text style={styles.rateText}>Fixed Rate</Text>
              </View>
            </View>

            <View style={styles.employerCard}>
              <View style={styles.employerLeft}>
                <View style={styles.employerAvatar}>
                  <Text style={styles.avatarText}>{taskClient?.fullName?.[0] ?? "C"}</Text>
                </View>
                <View>
                  <Text style={styles.employerName}>{taskClient?.fullName ?? "Task client"}</Text>
                  <Text style={styles.rating}>{taskClient && taskClient.rating > 0 ? `${taskClient.rating.toFixed(1)} rating` : "Not rated"}</Text>
                </View>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Task Client</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Task Description</Text>
              <Text style={styles.description}>{task.description}</Text>
            </View>

            <View style={styles.detailsGrid}>
              <DetailBox label="Payment Method" value={task.paymentMethod} icon="P" />
              <DetailBox label="Required Capability" value={task.requiredCapability ?? task.category} icon="S" />
            </View>

            <View style={styles.geoPanel}>
              <View style={styles.geoHeader}>
                <Text style={styles.sectionTitle}>Location Check</Text>
                <Text style={[styles.geoBadge, insideGeofence ? styles.geoBadgeGood : styles.geoBadgeWarn]}>
                  {currentUser?.role !== "worker" ? "Worker check-in" : insideGeofence ? "Inside task radius" : "Check-in needed"}
                </Text>
              </View>
              <Text style={styles.geoText}>Task area: {task.locationAddress ?? task.location}</Text>
              <Text style={styles.geoText}>Distance: {formatDistance(distanceKm)}</Text>
              <Text style={styles.geoText}>Allowed radius: {task.geofenceRadius !== undefined ? `${task.geofenceRadius} meters` : "Not recorded"}</Text>
              {liveTrackingEnabled ? (
                <View style={styles.liveLocationPanel}>
                  <View style={styles.geoHeader}>
                    <Text style={styles.liveLocationTitle}>Foreground live location</Text>
                    <Text style={[styles.geoBadge, liveLocationHealthy ? styles.geoBadgeGood : styles.geoBadgeWarn]}>
                      {liveLocationStatusLabel(liveTracking.status, liveLocationHealthy)}
                    </Text>
                  </View>
                  {liveTracking.location ? (
                    <>
                      <Text style={styles.geoText}>Last update: {formatLocationUpdateTime(liveTracking.location.capturedAt)}</Text>
                      <Text style={styles.geoText}>
                        Accuracy: {Number.isFinite(liveTracking.location.accuracyMeters)
                          ? `about ${Math.round(liveTracking.location.accuracyMeters as number)} meters`
                          : "unavailable"}
                      </Text>
                    </>
                  ) : null}
                  <Text style={[styles.geoHint, liveLocationIssue ? styles.liveLocationWarning : undefined]}>
                    {liveTracking.status === "starting"
                      ? "Requesting a balanced-accuracy device location..."
                      : liveTracking.status === "paused"
                        ? "Live updates pause while TaskLink is in the background."
                        : liveLocationIssue ?? "Your marker is updating while this screen stays open."}
                  </Text>
                  <Text style={styles.privacyText}>This moving marker stays on your device and is not continuously stored or shared with the employer.</Text>
                  {(liveTracking.status === "error" || (liveTracking.status === "watching" && Boolean(liveLocationIssue))) ? (
                    <Pressable accessibilityRole="button" onPress={liveTracking.retry} style={styles.retryLocationButton}>
                      <Text style={styles.retryLocationButtonText}>Retry Live Location</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.geoHint}>{geofenceCheck.reason} Start and finish actions refresh your device location before continuing.</Text>
            </View>

            <View style={styles.paymentPanel}>
              <View style={styles.geoHeader}>
                <Text style={styles.sectionTitle}>Payment Verification</Text>
                <Text style={styles.paymentBadge}>{task.paymentStatus ?? "Pending"}</Text>
              </View>
              <Text style={styles.geoText}>Method: {task.paymentMethod}</Text>
              {currentUser?.role === "client" ? (
                <>
                  <TextInput
                    multiline
                    onChangeText={setProofOfPaymentText}
                    placeholder="Reference number, GCash note, or COD confirmation"
                    placeholderTextColor={palette.outline}
                    style={styles.paymentInput}
                    textAlignVertical="top"
                    value={proofOfPaymentText}
                  />
                  {task.paymentMethod === "GCash link" ? (
                    <Pressable accessibilityRole="button" disabled={uploadingProof} onPress={handleUploadPaymentProof} style={styles.paymentOutlineButton}>
                      <Text style={styles.paymentOutlineButtonText}>
                        {uploadingProof ? "Uploading..." : proofFileName || "Upload receipt image or PDF"}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={actionLoading || task.paymentStatus === "Submitted" || task.paymentStatus === "Verified"}
                    onPress={handleSubmitPaymentProof}
                    style={({ pressed }) => [
                      styles.paymentButton,
                      (actionLoading || task.paymentStatus === "Submitted" || task.paymentStatus === "Verified") && styles.primaryActionDisabled,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.paymentButtonText}>
                      {actionLoading
                        ? "Submitting..."
                        : task.paymentStatus === "Verified"
                          ? "Payment Confirmed"
                          : task.paymentStatus === "Submitted"
                            ? "Waiting for Tasker Confirmation"
                            : "Submit Payment Confirmation"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.geoHint}>{task.proofOfPaymentText || "Waiting for client payment confirmation."}</Text>
                  {currentUser?.id === task.workerId && task.status === "Pending Approval" && task.paymentMethod === "COD" && task.paymentStatus === "Submitted" ? (
                    <Pressable accessibilityRole="button" disabled={actionLoading} onPress={handleConfirmCashPayment} style={styles.paymentButton}>
                      <Text style={styles.paymentButtonText}>{actionLoading ? "Confirming..." : "Confirm Cash Received"}</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.trustRow}>
              <TrustItem text="Evidence stored privately" />
              <TrustItem text="Participants only" />
              <TrustItem text="Disputes can be reviewed" />
            </View>

            <View style={styles.statusPanel}>
              <Text style={styles.sectionTitle}>Current Status</Text>
              <StatusBadge status={task.status} />
            </View>

            {currentUser?.role === "client" && (task.status === "Finished" || task.status === "Archived") && task.workerId ? (
              <View style={styles.clientRatingPanel}>
                <View style={styles.clientRatingCopy}>
                  <Text style={styles.clientRatingTitle}>Rate Worker</Text>
                  <Text style={styles.clientRatingText}>Leave a review for the worker who completed this task.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={clientHasRated}
                  onPress={() => router.push(`/rating/${task.id}`)}
                  style={({ pressed }) => [
                    styles.clientRatingButton,
                    clientHasRated && styles.clientRatingButtonDisabled,
                    pressed && !clientHasRated && styles.pressed
                  ]}
                >
                  <Text style={[styles.clientRatingButtonText, clientHasRated && styles.clientRatingButtonTextDisabled]}>
                    {clientHasRated ? "User Rated" : "Rate User"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {currentUser?.role !== "client" ? (
              <View style={styles.secondaryRow}>
                <Pressable style={styles.secondaryAction} onPress={() => router.push(`/chat/${task.id}`)}>
                  <Text style={styles.secondaryActionText}>Chat</Text>
                </Pressable>
                {task.status === "Finished" || task.status === "Archived" ? (
                  <Pressable style={styles.secondaryAction} onPress={() => router.push(`/rating/${task.id}`)}>
                    <Text style={styles.secondaryActionText}>Rate User</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {currentUser?.role === "worker" && workerHasApplied && taskIsOpenForApplications ? (
              <Pressable style={styles.dangerAction} onPress={() => handleSecondaryWorkflowAction("withdraw")}>
                <Text style={styles.dangerActionText}>Withdraw Application</Text>
              </Pressable>
            ) : null}

            {currentUser?.role === "client" && task.clientId === currentUser.id && taskIsOpenForApplications ? (
              <Pressable style={styles.dangerAction} onPress={() => handleSecondaryWorkflowAction("cancel")}>
                <Text style={styles.dangerActionText}>Cancel Task</Text>
              </Pressable>
            ) : null}

            {(task.status === "Accepted" || task.status === "In Progress" || task.status === "Pending Approval" || task.status === "Finished") &&
            (currentUser?.id === task.clientId || currentUser?.id === task.workerId) ? (
              <Pressable style={styles.dangerAction} onPress={() => handleSecondaryWorkflowAction("dispute")}>
                <Text style={styles.dangerActionText}>Open Dispute</Text>
              </Pressable>
            ) : null}

            {reportTargetId ? (
              <Pressable
                style={styles.reportAction}
                onPress={() => router.push({
                  pathname: "/report-user",
                  params: { targetUserId: reportTargetId, taskId: task.id }
                } as unknown as Href)}
              >
                <Text style={styles.reportActionText}>Report Safety or Conduct Issue</Text>
              </Pressable>
            ) : null}

            {actionWarning ? <Text style={styles.warningText}>{actionWarning}</Text> : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={!action.enabled}
          onPress={handlePrimaryAction}
          style={({ pressed }) => [
            styles.primaryAction,
            !action.enabled && styles.primaryActionDisabled,
            pressed && action.enabled && styles.pressed
          ]}
        >
          <Text allowFontScaling={false} adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.primaryActionText}>
            {action.label}
          </Text>
        </Pressable>
        <Text style={styles.guidelineText}>By clicking, you agree to the TaskLink Community Guidelines.</Text>
      </View>
    </SafeAreaView>
  );
}

function getPrimaryAction(
  status: TaskStatus,
  role?: string,
  workerHasApplied = false,
  paymentStatus?: PaymentStatus
) {
  if (role === "client" && status === "Applied") {
    return { label: "Review Applicants", enabled: true };
  }

  if (role === "client" && status === "Pending Approval") {
    const paymentReady = paymentStatus === "Verified";
    return paymentReady
      ? { label: "Confirm Finished", nextStatus: "Finished" as TaskStatus, enabled: true }
      : paymentStatus === "Submitted"
        ? { label: "Waiting for Tasker Payment Confirmation", enabled: false }
        : { label: "Submit Payment First", enabled: false };
  }

  if (role === "client" && status === "Finished") {
    return { label: "Archive Task", nextStatus: "Archived" as TaskStatus, enabled: true };
  }

  if (role === "client" && (status === "Accepted" || status === "In Progress")) {
    return { label: "Waiting for Worker", enabled: false };
  }

  if (role === "worker" && status === "Finding Workers") {
    return { label: "Apply", nextStatus: "Applied" as TaskStatus, enabled: true };
  }

  if (role === "worker" && status === "Applied") {
    if (!workerHasApplied) {
      return { label: "Apply", nextStatus: "Applied" as TaskStatus, enabled: true };
    }

    return { label: "Waiting for Client", enabled: false };
  }

  if (role === "worker" && status === "Accepted") {
    return { label: "Start Task", nextStatus: "In Progress" as TaskStatus, enabled: true };
  }

  if (role === "worker" && status === "In Progress") {
    return { label: "Submit for Approval", nextStatus: "Pending Approval" as TaskStatus, enabled: true };
  }

  if (role === "worker" && status === "Pending Approval") {
    return { label: "Waiting for Client", enabled: false };
  }

  if (status === "Finding Workers") {
    return { label: "Finding Workers", enabled: false };
  }

  if (status === "Finished") {
    return { label: "Task Finished", enabled: false };
  }

  if (status === "Archived") {
    return { label: "Task Archived", enabled: false };
  }

  if (status === "Cancelled" || status === "Disputed" || status === "Expired") {
    return { label: `Task ${status}`, enabled: false };
  }

  return { label: "Status Updated", enabled: false };
}

function liveLocationStatusLabel(status: "idle" | "starting" | "watching" | "paused" | "error", healthy: boolean) {
  if (status === "starting") return "Locating";
  if (status === "paused") return "Paused";
  if (status === "error") return "Needs attention";
  if (status === "watching") return healthy ? "Live" : "Check accuracy";
  return "Off";
}

function formatLocationUpdateTime(capturedAt: string) {
  const timestamp = new Date(capturedAt);
  if (!Number.isFinite(timestamp.getTime())) return "Unavailable";
  return timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function TopBar({ initials, onBack }: { initials: string; onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.brand}>TASKLINK</Text>
      <View style={styles.userAvatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    </View>
  );
}

function DetailBox({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Text style={styles.detailIcon}>{icon}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function TrustItem({ text }: { text: string }) {
  return (
    <View style={styles.trustItem}>
      <Text style={styles.trustText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  topBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderBottomColor: "#EDF1EF",
    borderBottomWidth: 1
  },
  backButton: {
    minWidth: 48,
    minHeight: 44,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  backText: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  brand: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "800" },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.secondaryContainer,
    borderWidth: 1,
    borderColor: palette.outlineVariant
  },
  avatarText: { color: "#684000", fontWeight: "900" },
  content: { paddingBottom: 132 },
  notFound: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  mapHero: {
    height: 192,
    backgroundColor: palette.surfaceContainer,
    overflow: "hidden"
  },
  mapGrid: { flex: 1, backgroundColor: "#E5F1EE" },
  mapRoadOne: {
    position: "absolute",
    left: -28,
    right: -28,
    top: 86,
    height: 18,
    backgroundColor: "#C9DAD6",
    transform: [{ rotate: "-12deg" }]
  },
  mapRoadTwo: {
    position: "absolute",
    top: -20,
    bottom: -20,
    left: "54%",
    width: 20,
    backgroundColor: "#D9C39A",
    transform: [{ rotate: "18deg" }]
  },
  mapPark: {
    position: "absolute",
    right: 28,
    top: 28,
    width: 76,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#CDE7CE"
  },
  mapPin: {
    position: "absolute",
    left: "48%",
    top: 82,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.urgent,
    borderWidth: 4,
    borderColor: palette.white
  },
  urgentBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.urgent
  },
  urgentBadgeText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  locationBadge: {
    position: "absolute",
    left: 16,
    bottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "86%"
  },
  locationDot: { color: palette.primary, fontSize: 22, lineHeight: 22, fontWeight: "900" },
  locationText: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "800", flex: 1 },
  sheetWrap: { paddingHorizontal: 16, marginTop: -24 },
  card: {
    borderRadius: 12,
    padding: 20,
    backgroundColor: palette.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    gap: 22
  },
  jobHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  jobTitleBlock: { flex: 1, gap: 6 },
  title: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  inlineMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaIcon: { color: palette.outline, fontSize: 14 },
  metaText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  priceBlock: { alignItems: "flex-end" },
  price: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  rateText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  employerCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.35)",
    backgroundColor: palette.surfaceLow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  employerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  employerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.secondaryContainer,
    borderWidth: 2,
    borderColor: palette.white
  },
  employerName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  rating: { color: palette.text, fontSize: 12, lineHeight: 16 },
  verifiedBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#EAF8F1" },
  verifiedText: { color: palette.success, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  section: { gap: 8 },
  sectionTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  description: { color: palette.muted, fontSize: 16, lineHeight: 24 },
  detailsGrid: { flexDirection: "row", gap: 12 },
  detailBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.35)",
    backgroundColor: palette.surfaceContainer,
    gap: 6
  },
  detailLabel: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  detailValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailIcon: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  detailValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "800", flex: 1 },
  trustRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(189,201,198,0.45)",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  trustCheck: { color: palette.success, fontSize: 12, fontWeight: "900" },
  trustText: { color: palette.muted, fontSize: 11, lineHeight: 14, fontWeight: "600" },
  statusPanel: { gap: 8 },
  geoPanel: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, gap: 6 },
  geoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  geoBadge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, lineHeight: 14, fontWeight: "900" },
  geoBadgeGood: { backgroundColor: "#EAF8F1", color: "#0B7A52" },
  geoBadgeWarn: { backgroundColor: "#FFF8EE", color: "#684000" },
  geoText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  geoHint: { color: palette.outline, fontSize: 12, lineHeight: 16 },
  liveLocationPanel: { marginTop: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, gap: 6 },
  liveLocationTitle: { color: palette.textStrong, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  liveLocationWarning: { color: "#92400E", fontWeight: "700" },
  privacyText: { color: palette.outline, fontSize: 11, lineHeight: 15 },
  retryLocationButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center", marginTop: 2 },
  retryLocationButtonText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  paymentPanel: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(189,201,198,0.45)", backgroundColor: palette.surface, gap: 8 },
  paymentBadge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#FFF8EE", color: "#684000", fontSize: 11, lineHeight: 14, fontWeight: "900" },
  paymentInput: { minHeight: 82, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, color: palette.text, fontSize: 14, lineHeight: 20, padding: 12 },
  paymentButton: { minHeight: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  paymentButtonText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  paymentOutlineButton: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  paymentOutlineButtonText: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: "900", textAlign: "center" },
  warningText: { color: "#684000", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  clientRatingPanel: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, gap: 12, elevation: 2 },
  clientRatingCopy: { gap: 4 },
  clientRatingTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  clientRatingText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  clientRatingButton: { minHeight: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  clientRatingButtonDisabled: { backgroundColor: palette.surfaceContainer, borderWidth: 1, borderColor: palette.outlineVariant },
  clientRatingButtonText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  clientRatingButtonTextDisabled: { color: palette.textStrong },
  secondaryRow: { flexDirection: "row", gap: 12 },
  dangerAction: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: "#B91C1C", alignItems: "center", justifyContent: "center", backgroundColor: palette.surface },
  dangerActionText: { color: "#B91C1C", fontSize: 13, lineHeight: 18, fontWeight: "900" },
  reportAction: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceLow },
  reportActionText: { color: palette.muted, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface
  },
  secondaryActionText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  bottomAction: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: palette.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryActionDisabled: { backgroundColor: palette.surfaceHigh },
  primaryActionText: { color: palette.white, fontSize: 18, lineHeight: 22, fontWeight: "800", textAlign: "center" },
  guidelineText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
