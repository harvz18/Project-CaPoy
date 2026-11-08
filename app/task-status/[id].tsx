import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LocationMap from "../../src/components/LocationMap";
import { StatusBadge } from "../../src/components/StatusBadge";
import { useApp } from "../../src/context/AppContext";
import { formatPaymentMethod, formatRequiredCapabilities, formatTaskDuration, formatTaskPrice, formatTaskSchedule } from "../../src/domain/taskMarketplace";
import { useForegroundLocationWatch } from "../../src/hooks/useForegroundLocationWatch";
import { useTasklinkBack } from "../../src/hooks/useTasklinkBack";
import { Payment, PaymentStatus, Task, TaskLiveLocation, TaskStatus } from "../../src/types";
import {
  calculateDistanceKm,
  formatDistance,
  getGeofenceCheck,
  getLiveLocationIssue,
  getTaskCheckDistanceKm,
  shouldTrackTaskLocation
} from "../../src/utils/location";
import { getPaymentProofDownloadUrl, pickAndUploadGcashQr, pickAndUploadPaymentProof } from "../../src/services/fileUploadService";
import { formatPhilippineMobileNumber, normalizePhilippineMobileNumber } from "../../src/domain/gcashPayment";
import { subscribeToPayment } from "../../src/services/taskRepository";
import { hasPendingTaskChange, summarizeTaskTermChanges } from "../../src/domain/taskTerms";
import { getCancellationEligibility } from "../../src/domain/cancellation";
import { clearTaskLiveLocation, publishTaskLiveLocation, subscribeToTaskLiveLocation } from "../../src/services/taskLiveLocationService";

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
  const goBack = useTasklinkBack();
  const insets = useSafeAreaInsets();
  const { acceptTask, actionLoading, cancelTask, clearError, confirmCashPayment, confirmGcashPaymentReceived, confirmGcashPaymentSent, currentUser, getUserById, ratings, reportGcashPaymentNotReceived, respondToTaskChangeRequest, submitGcashReceivingDetails, tasks, submitPaymentProof, submitWorkerPaymentProof, updateTaskStatus, withdrawApplication } = useApp();
  const task = tasks.find((item) => item.id === id);
  const taskClient = getUserById(task?.clientId) ?? (currentUser?.id === task?.clientId ? currentUser : undefined);
  const [actionWarning, setActionWarning] = useState("");
  const [proofOfPaymentText, setProofOfPaymentText] = useState(task?.proofOfPaymentText ?? "");
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState(task?.proofOfPaymentUrl ?? "");
  const [proofFileName, setProofFileName] = useState(task?.proofOfPaymentUrl?.split("/").pop() ?? "");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [workerProofOfPaymentText, setWorkerProofOfPaymentText] = useState(task?.workerProofOfPaymentText ?? "");
  const [workerProofOfPaymentUrl, setWorkerProofOfPaymentUrl] = useState(task?.workerProofOfPaymentUrl ?? "");
  const [workerProofFileName, setWorkerProofFileName] = useState(task?.workerProofOfPaymentUrl?.split("/").pop() ?? "");
  const [uploadingWorkerProof, setUploadingWorkerProof] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [sharedWorkerLocation, setSharedWorkerLocation] = useState<TaskLiveLocation>();
  const [payment, setPayment] = useState<Payment>();
  const [gcashDetailsOpen, setGcashDetailsOpen] = useState(false);
  const [gcashMobileNumber, setGcashMobileNumber] = useState("");
  const [gcashDetailsConfirmed, setGcashDetailsConfirmed] = useState(false);
  const [gcashQrPath, setGcashQrPath] = useState("");
  const [gcashQrRemoved, setGcashQrRemoved] = useState(false);
  const [gcashQrFileName, setGcashQrFileName] = useState("");
  const [uploadingGcashQr, setUploadingGcashQr] = useState(false);
  const [gcashPayOpen, setGcashPayOpen] = useState(false);
  const [gcashReference, setGcashReference] = useState("");
  const [gcashProofPath, setGcashProofPath] = useState("");
  const [gcashProofFileName, setGcashProofFileName] = useState("");
  const [uploadingGcashProof, setUploadingGcashProof] = useState(false);
  const [gcashQrPreviewUri, setGcashQrPreviewUri] = useState("");

  // Task data is delivered by a Firestore listener, so it can arrive after this
  // screen's first render. Keep an already-uploaded local receipt, while also
  // making a receipt that arrives with the task available for submission.
  useEffect(() => {
    if (!task?.proofOfPaymentUrl) return;
    setProofOfPaymentUrl((current) => current || task.proofOfPaymentUrl || "");
    setProofFileName((current) => current || task.proofOfPaymentUrl?.split("/").pop() || "");
  }, [task?.proofOfPaymentUrl]);

  useEffect(() => {
    if (!task?.id || task.paymentMethod !== "GCash link") {
      setPayment(undefined);
      return;
    }
    return subscribeToPayment(task.id, setPayment, () => setPayment(undefined));
  }, [task?.id, task?.paymentMethod]);

  useEffect(() => {
    if (!task?.id || !payment?.gcashQrPath) {
      setGcashQrPreviewUri("");
      return;
    }
    let active = true;
    void getPaymentProofDownloadUrl(task.id, payment.gcashQrPath)
      .then((uri) => { if (active) setGcashQrPreviewUri(uri); })
      .catch(() => { if (active) setGcashQrPreviewUri(""); });
    return () => { active = false; };
  }, [payment?.gcashQrPath, task?.id]);

  const clientProofPath = proofOfPaymentUrl || task?.proofOfPaymentUrl || "";
  const liveTrackingEnabled = shouldTrackTaskLocation(
    currentUser?.role,
    currentUser?.id,
    task?.workerId,
    task?.status
  );
  const liveTracking = useForegroundLocationWatch(liveTrackingEnabled);

  const employerCanViewWorkerLocation = currentUser?.role === "client"
    && currentUser.id === task?.clientId
    && Boolean(task?.workerId)
    && (task?.status === "Accepted" || task?.status === "In Progress");

  useEffect(() => {
    if (!employerCanViewWorkerLocation || !task?.id) {
      setSharedWorkerLocation(undefined);
      return;
    }
    return subscribeToTaskLiveLocation(task.id, setSharedWorkerLocation, () => setSharedWorkerLocation(undefined));
  }, [employerCanViewWorkerLocation, task?.id]);

  useEffect(() => {
    if (!liveTrackingEnabled || !task?.id || !currentUser?.id || !liveTracking.location) return;
    void publishTaskLiveLocation(task.id, currentUser.id, liveTracking.location).catch(() => {
      setActionWarning("Unable to share the live location right now. Check your connection and keep TaskLink open.");
    });
  }, [currentUser?.id, liveTracking.location, liveTrackingEnabled, task?.id]);

  useEffect(() => {
    if (!liveTrackingEnabled || !task?.id || currentUser?.role !== "worker" || currentUser.id !== task.workerId) return;
    return () => {
      void clearTaskLiveLocation(task.id);
    };
  }, [currentUser?.id, currentUser?.role, liveTrackingEnabled, task?.id, task?.workerId]);

  if (!task) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <TopBar initials={currentUser?.fullName?.[0] ?? "U"} onBack={goBack} />
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
  const visibleWorkerLocation = liveTrackingEnabled ? liveTracking.location : employerCanViewWorkerLocation ? sharedWorkerLocation : undefined;
  const visibleWorkerLocationIssue = getLiveLocationIssue(visibleWorkerLocation);
  const visibleWorkerLocationHealthy = Boolean(visibleWorkerLocation) && !visibleWorkerLocationIssue;
  const visibleWorkerDistanceKm = visibleWorkerLocation
    ? calculateDistanceKm(visibleWorkerLocation, task)
    : undefined;
  const changeRequestPending = hasPendingTaskChange(task);
  const assignedWorkerMustReviewChange = changeRequestPending && currentUser?.role === "worker" && currentUser.id === task.workerId;
  // The foreground watcher is a preview, not the authority for check-in. It can
  // be paused or still warming up even while the device can obtain a valid GPS
  // reading. Keep the action available and let updateTaskStatus perform its
  // fresh, authoritative location capture before changing task status.
  const primaryActionEnabled = action.enabled && !actionLoading && !assignedWorkerMustReviewChange;
  const primaryActionLabel = assignedWorkerMustReviewChange ? "Review task changes first" : getGeofenceActionLabel(
    action.label,
    action.nextStatus,
    primaryActionEnabled,
    liveTracking.status,
    liveLocationIssue,
    task.geofenceRadius
  );
  const clientHasRated = Boolean(
    currentUser?.role === "client" && task.workerId && ratings.some((rating) => rating.taskId === task.id && rating.reviewerId === currentUser.id)
  );
  const reportTargetId = currentUser?.id === task.clientId
    ? task.workerId
    : currentUser?.id === task.workerId
      ? task.clientId
      : undefined;
  const workerCanUploadPaymentEvidence = currentUser?.role === "worker" &&
    currentUser.id === task.workerId &&
    ["Accepted", "In Progress", "Pending Approval"].includes(task.status) &&
    task.paymentStatus !== "Verified";
  const cancellationEligibility = currentUser ? getCancellationEligibility(task, currentUser) : { allowed: false as const, reason: "Sign in to cancel a task." };
  const canCancelTask = cancellationEligibility.allowed;

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

      if (action.nextStatus === "Pending Approval" && currentUser?.role === "worker" && task.paymentMethod === "GCash link") {
        setGcashMobileNumber(normalizePhilippineMobileNumber(currentUser.mobileNumber) ?? "0");
        setGcashQrRemoved(false);
        setGcashDetailsConfirmed(false);
        setGcashDetailsOpen(true);
        return;
      }

      await updateTaskStatus(
        task.id,
        action.nextStatus,
        undefined,
        // Reuse only a location that already passes every check. Otherwise the
        // action obtains a new high-accuracy reading instead of treating a
        // delayed foreground-watch update as a failed check-in.
        liveLocationHealthy && geofenceCheck.allowed ? liveTracking.location : undefined
      );
    } catch (error) {
      // This screen renders action failures beside the controls. Do not also
      // present a location/check-in failure as a global data-sync error.
      clearError();
      setActionWarning(error instanceof Error ? error.message : "Unable to continue. Please try again.");
    }
  }

  if (!workerCanTrackTask) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <TopBar initials={currentUser?.fullName?.[0] ?? "U"} onBack={goBack} />
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
      await submitPaymentProof(task.id, proofOfPaymentText, clientProofPath || undefined);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to submit payment proof.");
    }
  }

  async function handleUploadPaymentProof() {
    if (!task) return;
    setUploadingProof(true);
    setActionWarning("");
    try {
      const uploaded = await pickAndUploadPaymentProof(task.id, "client");
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

  async function handleUploadWorkerPaymentProof() {
    if (!task) return;
    setUploadingWorkerProof(true);
    setActionWarning("");
    try {
      const uploaded = await pickAndUploadPaymentProof(task.id, "worker");
      if (!uploaded) return;
      await submitWorkerPaymentProof(task.id, workerProofOfPaymentText, uploaded.path);
      setWorkerProofOfPaymentUrl(uploaded.path);
      setWorkerProofFileName(uploaded.name);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to upload the tasker receipt.");
    } finally {
      setUploadingWorkerProof(false);
    }
  }

  async function handleOpenPaymentProof(path?: string) {
    if (!task || !path) return;
    try {
      setActionWarning("");
      await Linking.openURL(await getPaymentProofDownloadUrl(task.id, path));
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to open the payment receipt.");
    }
  }

  async function handleUploadGcashQr() {
    if (!task) return;
    setUploadingGcashQr(true);
    setActionWarning("");
    try {
      const uploaded = await pickAndUploadGcashQr(task.id);
      if (uploaded) {
        setGcashQrPath(uploaded.path);
        setGcashQrRemoved(false);
        setGcashQrFileName(uploaded.name);
      }
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to upload the GCash QR image.");
    } finally {
      setUploadingGcashQr(false);
    }
  }

  async function handleSubmitGcashDetails() {
    if (!task || !gcashDetailsConfirmed) return;
    try {
      setActionWarning("");
      await submitGcashReceivingDetails(task.id, gcashMobileNumber, gcashQrPath || undefined, gcashQrRemoved);
      setGcashDetailsOpen(false);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to save GCash receiving details.");
    }
  }

  async function handleCopyGcashNumber() {
    const number = payment?.gcashRecipientMobile;
    if (!number) return;
    await Clipboard.setStringAsync(number);
    setActionWarning("GCash number copied.");
  }

  async function handleUploadGcashProof() {
    if (!task) return;
    setUploadingGcashProof(true);
    setActionWarning("");
    try {
      const uploaded = await pickAndUploadPaymentProof(task.id, "client");
      if (uploaded) {
        setGcashProofPath(uploaded.path);
        setGcashProofFileName(uploaded.name);
      }
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to upload optional payment evidence.");
    } finally {
      setUploadingGcashProof(false);
    }
  }

  async function handleConfirmGcashSent() {
    if (!task) return;
    try {
      setActionWarning("");
      await confirmGcashPaymentSent(task.id, gcashReference, gcashProofPath || undefined);
      setGcashPayOpen(false);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to confirm that the GCash payment was sent.");
    }
  }

  async function handleConfirmGcashReceived() {
    if (!task) return;
    try {
      setActionWarning("");
      await confirmGcashPaymentReceived(task.id);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to confirm payment receipt.");
    }
  }

  async function handleGcashNotReceived() {
    if (!task) return;
    try {
      setActionWarning("");
      await reportGcashPaymentNotReceived(task.id);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to report the missing payment.");
    }
  }

  async function handleWithdrawApplication() {
    if (!task) return;
    try {
      setActionWarning("");
      await withdrawApplication(task.id);
    } catch (error) {
      setActionWarning(error instanceof Error ? error.message : "Unable to withdraw this application.");
    }
  }

  async function handleCancelTask() {
    if (!task) return;
    try {
      setActionWarning("");
      await cancelTask(task.id, cancellationReason);
      setCancelDialogOpen(false);
      setCancellationReason("");
    } catch (cancelError) {
      setActionWarning(cancelError instanceof Error ? cancelError.message : "Unable to cancel this task.");
    }
  }

  async function handleTaskChangeReview(accept: boolean) {
    if (!task) return;
    try {
      setActionWarning("");
      await respondToTaskChangeRequest(task.id, accept);
    } catch (reviewError) {
      setActionWarning(reviewError instanceof Error ? reviewError.message : "Unable to review the task changes.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <TopBar initials={currentUser?.fullName?.[0] ?? "U"} onBack={goBack} />
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
                color: "#2563EB",
                accuracyMeters: liveTracking.location.accuracyMeters
              }] : [])
            ]}
            radiusMeters={task.geofenceRadius}
            height={260}
            fitToMarkers={Boolean(liveTracking.location)}
            connectMarkers
          />
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>{task.status === "Finding Workers" ? "Open" : task.status}</Text>
          </View>
          {liveTrackingEnabled ? (
            <View style={[styles.mapTrackingBadge, liveLocationHealthy && insideGeofence ? styles.mapTrackingBadgeGood : styles.mapTrackingBadgePending]}>
              <Text style={[styles.mapTrackingBadgeText, liveLocationHealthy && insideGeofence ? styles.mapTrackingBadgeTextGood : undefined]}>
                {liveLocationHealthy
                  ? insideGeofence
                    ? "LIVE · Inside task radius"
                    : `LIVE · ${formatDistance(distanceKm)}`
                  : liveTracking.status === "starting"
                    ? "Locating device..."
                    : "Location needs attention"}
              </Text>
            </View>
          ) : null}
          <View style={styles.locationBadge}>
            <Text style={styles.locationText}>{task.location}</Text>
          </View>
        </View>

        <View style={styles.sheetWrap}>
          <View style={styles.card}>
            <View style={styles.jobHeader}>
              <View style={styles.jobTitleBlock}>
                <Text style={styles.title}>{task.title}</Text>
                <Text style={styles.metaText}>Duration: {formatTaskDuration(task)}</Text>
                <Text style={styles.metaText}>Schedule: {formatTaskSchedule(task)}</Text>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.price}>{formatTaskPrice(task)}</Text>
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
              <DetailBox label="Payment Method" value={formatPaymentMethod(task.paymentMethod)} icon="credit-card" />
              <DetailBox label="Required Capabilities" value={formatRequiredCapabilities(task)} icon="tool" />
            </View>

            <View style={styles.geoPanel}>
              <View style={styles.geoHeader}>
                <Text style={styles.sectionTitle}>Location Check</Text>
                <Text style={[styles.geoBadge, currentUser?.role === "worker" && insideGeofence ? styles.geoBadgeGood : styles.geoBadgeWarn]}>
                  {currentUser?.role === "worker"
                    ? insideGeofence ? "Inside task radius" : "Check-in needed"
                    : visibleWorkerLocationHealthy ? "Worker location live" : "Waiting for worker"}
                </Text>
              </View>
              <View style={styles.geoMapFrame}>
                <LocationMap
                  center={task.latitude !== undefined && task.longitude !== undefined ? { latitude: task.latitude, longitude: task.longitude } : undefined}
                  markers={[
                    ...(task.latitude !== undefined && task.longitude !== undefined
                      ? [{ id: `${task.id}-check`, latitude: task.latitude, longitude: task.longitude, title: "Task location", color: "#005C55" }]
                      : []),
                    ...(visibleWorkerLocation ? [{
                      id: "live-check-device",
                      latitude: visibleWorkerLocation.latitude,
                      longitude: visibleWorkerLocation.longitude,
                      title: currentUser?.role === "worker" ? "Your live location" : "Worker live location",
                      color: "#2563EB",
                      accuracyMeters: visibleWorkerLocation.accuracyMeters
                    }] : [])
                  ]}
                  radiusMeters={task.geofenceRadius}
                  height={240}
                  fitToMarkers={Boolean(visibleWorkerLocation)}
                  connectMarkers
                />
                <View style={styles.geoMapLegend}>
                  <View style={styles.geoLegendItem}>
                    <View style={[styles.geoLegendDot, styles.geoLegendTask]} />
                    <Text style={styles.geoLegendText}>Task pin and allowed radius</Text>
                  </View>
                  {liveTrackingEnabled || employerCanViewWorkerLocation ? (
                    <View style={styles.geoLegendItem}>
                      <View style={[styles.geoLegendDot, styles.geoLegendWorker]} />
                      <Text style={styles.geoLegendText}>{currentUser?.role === "worker" ? "Your live GPS position" : "Worker live GPS position"}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.geoText}>Task area: {task.locationAddress ?? task.location}</Text>
              <Text style={styles.geoText}>Distance: {formatDistance(currentUser?.role === "worker" ? distanceKm : visibleWorkerDistanceKm)}</Text>
              <Text style={styles.geoText}>Required start radius: {task.geofenceRadius !== undefined ? `${task.geofenceRadius} meters` : "Not recorded"}</Text>
              {liveTrackingEnabled || employerCanViewWorkerLocation ? (
                <View style={styles.liveLocationPanel}>
                  <View style={styles.geoHeader}>
                    <Text style={styles.liveLocationTitle}>{currentUser?.role === "worker" ? "Foreground live location" : "Worker live location"}</Text>
                    <Text style={[styles.geoBadge, visibleWorkerLocationHealthy ? styles.geoBadgeGood : styles.geoBadgeWarn]}>
                      {currentUser?.role === "worker"
                        ? liveLocationStatusLabel(liveTracking.status, liveLocationHealthy)
                        : visibleWorkerLocation ? visibleWorkerLocationHealthy ? "Live" : "Needs attention" : "Waiting"}
                    </Text>
                  </View>
                  {visibleWorkerLocation ? (
                    <>
                      <Text style={styles.geoText}>Last update: {formatLocationUpdateTime(visibleWorkerLocation.capturedAt)}</Text>
                      <Text style={styles.geoText}>
                        Accuracy: {Number.isFinite(visibleWorkerLocation.accuracyMeters)
                          ? `about ${Math.round(visibleWorkerLocation.accuracyMeters as number)} meters`
                          : "unavailable"}
                      </Text>
                    </>
                  ) : null}
                  <Text style={[styles.geoHint, visibleWorkerLocationIssue ? styles.liveLocationWarning : undefined]}>
                    {currentUser?.role === "worker"
                      ? liveTracking.status === "starting"
                        ? "Requesting a high-accuracy device location..."
                        : liveTracking.status === "paused"
                          ? "Live updates pause while TaskLink is in the background."
                          : liveLocationIssue ?? "Your marker is updating while this screen stays open."
                      : visibleWorkerLocation
                        ? visibleWorkerLocationIssue ?? "The worker marker is updating while they keep TaskLink open."
                        : "The worker's live marker will appear after they open this task and allow location access."}
                  </Text>
                  {currentUser?.role === "worker" ? <Text style={styles.privacyText}>This moving marker is visible only to the assigned employer while this task is accepted or in progress. Updates pause when TaskLink is in the background or closed.</Text> : null}
                  {currentUser?.role === "worker" && (liveTracking.status === "error" || (liveTracking.status === "watching" && Boolean(liveLocationIssue))) ? (
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
              <Text style={styles.geoText}>Method: {formatPaymentMethod(task.paymentMethod)}</Text>
              {task.paymentMethod === "GCash link" ? (
                <>
                  <Text style={styles.geoHint}>TaskLink does not process GCash payments. The employer pays the worker directly, then both participants confirm manually.</Text>
                  {currentUser?.role === "client" ? (
                    <>
                      {task.status === "Pending Approval" && task.paymentStatus === "Pending" ? <Text style={styles.geoHint}>Review the worker's receiving details, then pay before confirming task completion. The details are private to assigned participants.</Text> : null}
                      {task.status === "Pending Approval" && task.paymentStatus === "Pending" ? (
                        <Pressable accessibilityRole="button" disabled={!payment?.gcashRecipientMobile || actionLoading} onPress={() => setGcashPayOpen(true)} style={[styles.paymentButton, (!payment?.gcashRecipientMobile || actionLoading) && styles.primaryActionDisabled]}>
                          <Text style={styles.paymentButtonText}>Pay Now</Text>
                        </Pressable>
                      ) : null}
                      {task.paymentStatus === "Awaiting Worker Confirmation" ? <Text style={styles.geoHint}>You marked this payment as sent. Waiting for the worker to confirm receipt.</Text> : null}
                      {task.paymentStatus === "Verified" ? <Text style={styles.geoHint}>Both participants confirmed the manual GCash payment.</Text> : null}
                      {payment?.proofOfPaymentUrl ? <Pressable accessibilityRole="button" onPress={() => handleOpenPaymentProof(payment.proofOfPaymentUrl)} style={styles.paymentOutlineButton}><Text style={styles.paymentOutlineButtonText}>Open Optional Payment Evidence</Text></Pressable> : null}
                    </>
                  ) : (
                    <>
                      {task.status === "In Progress" ? <Text style={styles.geoHint}>When you finish work, add and confirm your GCash receiving number before submitting for approval.</Text> : null}
                      {task.status === "Pending Approval" && task.paymentStatus === "Pending" ? (
                        <>
                          <Text style={styles.geoHint}>Your GCash receiving details were submitted. You can update them until the employer starts payment.</Text>
                          <Pressable accessibilityRole="button" disabled={actionLoading} onPress={() => { setGcashMobileNumber(normalizePhilippineMobileNumber(payment?.gcashRecipientMobile ?? currentUser?.mobileNumber ?? "") ?? "0"); setGcashQrPath(payment?.gcashQrPath ?? ""); setGcashQrFileName(payment?.gcashQrPath?.split("/").pop() ?? ""); setGcashQrRemoved(false); setGcashDetailsConfirmed(false); setGcashDetailsOpen(true); }} style={styles.paymentOutlineButton}><Text style={styles.paymentOutlineButtonText}>Update GCash Receiving Details</Text></Pressable>
                        </>
                      ) : null}
                      {task.status === "Pending Approval" && task.paymentStatus === "Awaiting Worker Confirmation" ? (
                        <>
                          <Text style={styles.geoHint}>The employer marked the GCash payment as sent. Check your GCash account before confirming.</Text>
                          {payment?.gcashPaymentNotReceivedAt ? <Text style={styles.warningText}>You reported that this payment was not received. The employer has been notified.</Text> : null}
                          <Pressable accessibilityRole="button" disabled={actionLoading} onPress={handleConfirmGcashReceived} style={styles.paymentButton}><Text style={styles.paymentButtonText}>Payment Received</Text></Pressable>
                          <Pressable accessibilityRole="button" disabled={actionLoading} onPress={handleGcashNotReceived} style={styles.paymentOutlineButton}><Text style={styles.paymentOutlineButtonText}>Payment Not Received</Text></Pressable>
                        </>
                      ) : null}
                      {task.paymentStatus === "Verified" ? <Text style={styles.geoHint}>Both participants confirmed the manual GCash payment.</Text> : null}
                    </>
                  )}
                </>
              ) : currentUser?.role === "client" ? (
                <>
                  <TextInput
                    editable={task.paymentStatus !== "Submitted" && task.paymentStatus !== "Verified"}
                    multiline
                    onChangeText={setProofOfPaymentText}
                    placeholder="Optional reference number or payment note"
                    placeholderTextColor={palette.outline}
                    style={styles.paymentInput}
                    textAlignVertical="top"
                    value={proofOfPaymentText}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={uploadingProof || actionLoading || task.paymentStatus === "Submitted" || task.paymentStatus === "Verified"}
                    onPress={handleUploadPaymentProof}
                    style={styles.paymentOutlineButton}
                  >
                    <Text style={styles.paymentOutlineButtonText}>
                      {uploadingProof ? "Uploading..." : proofFileName || "Upload receipt image or PDF (optional, max 5 MB)"}
                    </Text>
                  </Pressable>
                  {!clientProofPath && task.paymentStatus !== "Submitted" && task.paymentStatus !== "Verified" ? <Text style={styles.geoHint}>Evidence is optional. Both participants still confirm the cash payment.</Text> : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={uploadingProof || actionLoading || task.paymentStatus === "Submitted" || task.paymentStatus === "Verified"}
                    onPress={handleSubmitPaymentProof}
                    style={({ pressed }) => [
                      styles.paymentButton,
                      (uploadingProof || actionLoading || task.paymentStatus === "Submitted" || task.paymentStatus === "Verified") && styles.primaryActionDisabled,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.paymentButtonText}>
                      {actionLoading
                        ? "Submitting..."
                        : task.paymentStatus === "Verified"
                          ? "Payment Confirmed"
                          : task.paymentStatus === "Submitted"
                            ? task.paymentMethod === "COD"
                              ? "Waiting for Tasker Confirmation"
                              : "Waiting for Payment Review"
                            : "Submit Payment Confirmation"}
                    </Text>
                  </Pressable>
                  {task.workerProofOfPaymentUrl ? (
                    <Pressable accessibilityRole="button" onPress={() => handleOpenPaymentProof(task.workerProofOfPaymentUrl)} style={styles.paymentOutlineButton}>
                      <Text style={styles.paymentOutlineButtonText}>Open Tasker Uploaded Receipt</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.geoHint}>{task.proofOfPaymentText || "Waiting for client payment confirmation."}</Text>
                  {task.proofOfPaymentUrl ? (
                    <Pressable accessibilityRole="button" onPress={() => handleOpenPaymentProof(task.proofOfPaymentUrl)} style={styles.paymentOutlineButton}>
                      <Text style={styles.paymentOutlineButtonText}>Open Employer Uploaded Receipt</Text>
                    </Pressable>
                  ) : null}
                  {workerCanUploadPaymentEvidence ? (
                    <>
                      <TextInput
                        multiline
                        onChangeText={setWorkerProofOfPaymentText}
                        placeholder="Optional tasker receipt note"
                        placeholderTextColor={palette.outline}
                        style={styles.paymentInput}
                        textAlignVertical="top"
                        value={workerProofOfPaymentText}
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={uploadingWorkerProof || actionLoading}
                        onPress={handleUploadWorkerPaymentProof}
                        style={styles.paymentOutlineButton}
                      >
                        <Text style={styles.paymentOutlineButtonText}>
                          {uploadingWorkerProof
                            ? "Uploading Tasker Receipt..."
                            : workerProofFileName || "Upload Tasker Receipt Image or PDF (max 5 MB)"}
                        </Text>
                      </Pressable>
                      <Text style={styles.geoHint}>
                        {workerProofOfPaymentUrl || task.workerProofOfPaymentUrl
                          ? "Your receipt is stored privately and attached to this payment."
                          : "Evidence is optional before confirming a cash payment."}
                      </Text>
                      {workerProofOfPaymentUrl || task.workerProofOfPaymentUrl ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleOpenPaymentProof(workerProofOfPaymentUrl || task.workerProofOfPaymentUrl)}
                          style={styles.paymentOutlineButton}
                        >
                          <Text style={styles.paymentOutlineButtonText}>Open Your Uploaded Receipt</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
                  {task.workerProofOfPaymentUrl && !workerCanUploadPaymentEvidence ? (
                    <Pressable accessibilityRole="button" onPress={() => handleOpenPaymentProof(task.workerProofOfPaymentUrl)} style={styles.paymentOutlineButton}>
                      <Text style={styles.paymentOutlineButtonText}>Open Your Uploaded Receipt</Text>
                    </Pressable>
                  ) : null}
                  {currentUser?.id === task.workerId && task.status === "Pending Approval" && task.paymentMethod === "COD" && task.paymentStatus === "Submitted" ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={actionLoading}
                      onPress={handleConfirmCashPayment}
                      style={styles.paymentButton}
                    >
                      <Text style={styles.paymentButtonText}>{actionLoading ? "Confirming..." : "Confirm Cash Received"}</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.trustRow}>
              <TrustItem text="Evidence stored privately" />
              <TrustItem text="Participants only" />
              <TrustItem text="Task history preserved" />
            </View>

            <View style={styles.statusPanel}>
              <Text style={styles.sectionTitle}>Current Status</Text>
              <StatusBadge status={task.status} />
            </View>

            {task.status === "Cancelled" ? (
              <View style={styles.cancellationRecord}>
                <Text style={styles.cancellationRecordTitle}>Cancellation record</Text>
                <Text style={styles.cancellationRecordText}>Cancelled by: {task.cancelledByRole === "worker" ? "Tasker" : "Employer"}</Text>
                <Text style={styles.cancellationRecordText}>Reason: {task.cancellationReason ?? "Not recorded"}</Text>
                <Text style={styles.cancellationRecordText}>Payment status preserved: {task.paymentStatusAtCancellation ?? task.paymentStatus ?? "Pending"}</Text>
              </View>
            ) : null}

            {changeRequestPending && task.changeRequest ? (
              <View style={styles.changeRequestPanel}>
                <Text style={styles.changeRequestTitle}>Task changes awaiting review</Text>
                <Text style={styles.changeRequestText}>
                  The employer proposed changes to {summarizeTaskTermChanges(task.changeRequest.changedFields)}. The current agreed terms remain in effect until the tasker responds.
                </Text>
                {assignedWorkerMustReviewChange ? (
                  <View style={styles.changeRequestActions}>
                    <Pressable accessibilityRole="button" disabled={actionLoading} onPress={() => void handleTaskChangeReview(false)} style={styles.changeDeclineButton}>
                      <Text style={styles.changeDeclineText}>Decline changes</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={actionLoading} onPress={() => void handleTaskChangeReview(true)} style={styles.changeAcceptButton}>
                      <Text style={styles.changeAcceptText}>{actionLoading ? "Saving..." : "Accept changes"}</Text>
                    </Pressable>
                  </View>
                ) : <Text style={styles.changeRequestHint}>The assigned tasker has been notified and must accept or decline before work starts.</Text>}
              </View>
            ) : null}

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
              <Pressable style={styles.dangerAction} onPress={handleWithdrawApplication}>
                <Text style={styles.dangerActionText}>Withdraw Application</Text>
              </Pressable>
            ) : null}

            {canCancelTask ? (
              <Pressable accessibilityRole="button" style={styles.dangerAction} onPress={() => setCancelDialogOpen(true)}>
                <Text style={styles.dangerActionText}>{currentUser?.role === "worker" ? "Cancel Assignment" : "Cancel Task"}</Text>
              </Pressable>
            ) : null}

            {currentUser?.role === "worker" && currentUser.id === task.workerId && !canCancelTask &&
            ["In Progress", "Pending Approval"].includes(task.status) ? (
              <View style={styles.cancellationFallback}>
                <Text style={styles.cancellationFallbackTitle}>Cancellation unavailable after check-in</Text>
                <Text style={styles.cancellationFallbackText}>TaskLink records the start only after its location check. It cannot independently verify physical arrival when location data is missing; contact the project coordinator if work has already started.</Text>
              </View>
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
          accessibilityState={{ disabled: !primaryActionEnabled }}
          disabled={!primaryActionEnabled}
          onPress={handlePrimaryAction}
          style={({ pressed }) => [
            styles.primaryAction,
            !primaryActionEnabled && styles.primaryActionDisabled,
            pressed && primaryActionEnabled && styles.pressed
          ]}
        >
          <Text
            allowFontScaling={false}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={[styles.primaryActionText, !primaryActionEnabled && styles.primaryActionTextDisabled]}
          >
            {primaryActionLabel}
          </Text>
        </Pressable>
        <Text style={styles.guidelineText}>By clicking, you agree to the TaskLink Community Guidelines.</Text>
      </View>
      <Modal animationType="slide" transparent visible={gcashDetailsOpen} onRequestClose={() => setGcashDetailsOpen(false)}>
        <View accessibilityViewIsModal style={styles.dialogBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled" style={styles.modalScrollView}>
            <View style={styles.dialogCard}>
              <Text style={styles.dialogTitle}>Confirm GCash receiving details</Text>
              <Text style={styles.dialogMessage}>Enter the GCash number where you want to receive payment. These details are visible only to you, the assigned employer, and authorized administrators.</Text>
              <Text style={styles.modalFieldLabel}>GCash mobile number</Text>
              <TextInput accessibilityLabel="GCash mobile number" autoComplete="tel" keyboardType="phone-pad" onChangeText={(value) => setGcashMobileNumber(value || "0")} placeholder="09XXXXXXXXX" placeholderTextColor={palette.outline} style={styles.modalInput} value={gcashMobileNumber} />
              <Pressable accessibilityRole="button" disabled={uploadingGcashQr || actionLoading} onPress={handleUploadGcashQr} style={styles.paymentOutlineButton}>
                <Text style={styles.paymentOutlineButtonText}>{uploadingGcashQr ? "Uploading QR..." : gcashQrFileName || "Upload GCash QR Image (optional)"}</Text>
              </Pressable>
              {gcashQrPath && !gcashQrRemoved ? <Pressable accessibilityRole="button" disabled={actionLoading} onPress={() => { setGcashQrPath(""); setGcashQrFileName(""); setGcashQrRemoved(true); }} style={styles.paymentOutlineButton}><Text style={styles.paymentOutlineButtonText}>Remove QR Image</Text></Pressable> : null}
              <Text style={styles.geoHint}>A QR image is optional. Your details lock after the employer starts payment.</Text>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: gcashDetailsConfirmed }} onPress={() => setGcashDetailsConfirmed((current) => !current)} style={styles.checkboxRow}>
                <View style={[styles.checkbox, gcashDetailsConfirmed && styles.checkboxChecked]}>{gcashDetailsConfirmed ? <Feather color={palette.white} name="check" size={15} /> : null}</View>
                <Text style={styles.checkboxText}>I confirm this is my GCash receiving number.</Text>
              </Pressable>
              <View style={styles.dialogActions}>
                <Pressable accessibilityRole="button" disabled={actionLoading} onPress={() => setGcashDetailsOpen(false)} style={styles.dialogCancel}><Text style={styles.dialogCancelText}>Cancel</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={actionLoading || !gcashDetailsConfirmed || !gcashMobileNumber.trim()} onPress={() => void handleSubmitGcashDetails()} style={[styles.dialogConfirm, (actionLoading || !gcashDetailsConfirmed || !gcashMobileNumber.trim()) && styles.primaryActionDisabled]}><Text style={styles.dialogConfirmText}>{actionLoading ? "Saving..." : "Submit for Approval"}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal animationType="slide" transparent visible={gcashPayOpen} onRequestClose={() => setGcashPayOpen(false)}>
        <View accessibilityViewIsModal style={styles.dialogBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled" style={styles.modalScrollView}>
            <View style={styles.dialogCard}>
              <Text style={styles.dialogTitle}>Pay worker via GCash</Text>
              <Text style={styles.dialogMessage}>Make the payment directly in your GCash app. TaskLink does not send or verify the transfer.</Text>
              <Text style={styles.modalFieldLabel}>Worker GCash number</Text>
              <Pressable accessibilityRole="button" onPress={() => void handleCopyGcashNumber()} style={styles.gcashNumberButton}>
                <Text style={styles.gcashNumber}>{formatPhilippineMobileNumber(payment?.gcashRecipientMobile)}</Text>
                <Text style={styles.gcashCopyText}>Copy number</Text>
              </Pressable>
              {gcashQrPreviewUri ? <Image accessibilityLabel="Worker GCash QR code" resizeMode="contain" source={{ uri: gcashQrPreviewUri }} style={styles.gcashQrPreview} /> : null}
              {payment?.gcashQrPath ? <Pressable accessibilityRole="button" onPress={() => handleOpenPaymentProof(payment.gcashQrPath)} style={styles.paymentOutlineButton}><Text style={styles.paymentOutlineButtonText}>Open QR Image</Text></Pressable> : null}
              <TextInput accessibilityLabel="Optional GCash reference" maxLength={500} onChangeText={setGcashReference} placeholder="Optional transaction reference or note" placeholderTextColor={palette.outline} style={styles.modalInput} value={gcashReference} />
              <Pressable accessibilityRole="button" disabled={uploadingGcashProof || actionLoading} onPress={handleUploadGcashProof} style={styles.paymentOutlineButton}><Text style={styles.paymentOutlineButtonText}>{uploadingGcashProof ? "Uploading..." : gcashProofFileName || "Upload Payment Evidence (optional)"}</Text></Pressable>
              <Text style={styles.geoHint}>After you confirm, the worker will be asked to confirm whether the payment was received. Optional evidence remains private to participants and authorized administrators.</Text>
              <View style={styles.dialogActions}>
                <Pressable accessibilityRole="button" disabled={actionLoading} onPress={() => setGcashPayOpen(false)} style={styles.dialogCancel}><Text style={styles.dialogCancelText}>Cancel</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={actionLoading || !payment?.gcashRecipientMobile} onPress={() => void handleConfirmGcashSent()} style={[styles.dialogConfirm, (actionLoading || !payment?.gcashRecipientMobile) && styles.primaryActionDisabled]}><Text style={styles.dialogConfirmText}>{actionLoading ? "Saving..." : "I Sent Payment"}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal animationType="fade" transparent visible={cancelDialogOpen} onRequestClose={() => setCancelDialogOpen(false)}>
        <View accessibilityViewIsModal style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>{currentUser?.role === "worker" ? "Cancel assignment?" : "Cancel task?"}</Text>
            <Text style={styles.dialogMessage}>
              {cancellationEligibility.allowed && cancellationEligibility.stage === "pre-check-in"
                ? "This is available until the task is marked In Progress. It will notify the other participant and preserve the task and payment history."
                : "This will close the task, notify active applicants, and preserve its history. Payment records will not be changed."}
            </Text>
            <TextInput
              accessibilityLabel="Cancellation reason"
              multiline
              maxLength={500}
              onChangeText={setCancellationReason}
              placeholder="Explain why you are cancelling (required)"
              placeholderTextColor={palette.outline}
              style={styles.cancellationReasonInput}
              textAlignVertical="top"
              value={cancellationReason}
            />
            <Text style={styles.cancellationReasonHint}>{cancellationReason.trim().length}/500 characters (minimum 5)</Text>
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" disabled={actionLoading} onPress={() => setCancelDialogOpen(false)} style={styles.dialogCancel}>
                <Text style={styles.dialogCancelText}>Keep Task Active</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={actionLoading || cancellationReason.trim().length < 5}
                onPress={() => void handleCancelTask()}
                style={[styles.dialogConfirm, (actionLoading || cancellationReason.trim().length < 5) && styles.primaryActionDisabled]}
              >
                <Text style={styles.dialogConfirmText}>{actionLoading ? "Cancelling..." : "Confirm Cancellation"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

function getGeofenceActionLabel(
  fallback: string,
  nextStatus: TaskStatus | undefined,
  ready: boolean,
  trackingStatus: "idle" | "starting" | "watching" | "paused" | "error",
  locationIssue: string | undefined,
  radiusMeters: number | undefined
) {
  if (ready || (nextStatus !== "In Progress" && nextStatus !== "Pending Approval")) return fallback;
  if (trackingStatus === "starting" || trackingStatus === "idle") return "Checking Live Location...";
  if (trackingStatus === "paused") return "Return to TaskLink for Location";
  if (trackingStatus === "error" || locationIssue) return "Fix Location to Continue";
  const action = nextStatus === "In Progress" ? "Start" : "Finish";
  return `Move Within ${radiusMeters ?? 500}m to ${action}`;
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
        <Feather accessibilityElementsHidden color={palette.primary} name="arrow-left" size={22} />
      </Pressable>
      <Text style={styles.brand}>TASKLINK</Text>
      <View style={styles.userAvatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    </View>
  );
}

function DetailBox({ label, value, icon }: { label: string; value: string; icon: "credit-card" | "tool" }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Feather accessibilityElementsHidden color={palette.primary} name={icon} size={18} />
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
    height: 260,
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
  mapTrackingBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    maxWidth: "58%",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  mapTrackingBadgeGood: { backgroundColor: "rgba(232,248,240,0.96)", borderColor: "#75B798" },
  mapTrackingBadgePending: { backgroundColor: "rgba(255,248,235,0.96)", borderColor: "#E7BC72" },
  mapTrackingBadgeText: { color: "#684000", fontSize: 11, lineHeight: 14, fontWeight: "900", textAlign: "center" },
  mapTrackingBadgeTextGood: { color: "#075E42" },
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
  changeRequestPanel: { padding: 14, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: "#F7C66A", backgroundColor: "#FFF8E7" },
  changeRequestTitle: { color: "#684000", fontSize: 16, lineHeight: 22, fontWeight: "900" },
  changeRequestText: { color: "#684000", fontSize: 13, lineHeight: 19 },
  changeRequestHint: { color: "#855300", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  changeRequestActions: { flexDirection: "row", gap: 10, marginTop: 2 },
  changeDeclineButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: "#B45309", backgroundColor: palette.surface },
  changeDeclineText: { color: "#92400E", fontSize: 13, fontWeight: "900" },
  changeAcceptButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: palette.primary },
  changeAcceptText: { color: palette.white, fontSize: 13, fontWeight: "900" },
  cancellationFallback: { padding: 14, gap: 6, borderRadius: 12, backgroundColor: "#FFF8E7", borderWidth: 1, borderColor: "#F7C66A" },
  cancellationFallbackTitle: { color: "#684000", fontSize: 15, lineHeight: 21, fontWeight: "900" },
  cancellationFallbackText: { color: "#684000", fontSize: 12, lineHeight: 18 },
  cancellationRecord: { padding: 14, gap: 5, borderRadius: 12, backgroundColor: palette.surfaceLow, borderWidth: 1, borderColor: palette.outlineVariant },
  cancellationRecordTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  cancellationRecordText: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  cancellationReasonInput: { minHeight: 96, paddingHorizontal: 12, paddingTop: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, color: palette.text, backgroundColor: palette.surface },
  cancellationReasonHint: { color: palette.muted, fontSize: 11, lineHeight: 16, textAlign: "right" },
  geoPanel: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, gap: 6 },
  geoMapFrame: { marginTop: 4, gap: 8 },
  geoMapLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  geoLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  geoLegendDot: { width: 10, height: 10, borderRadius: 5 },
  geoLegendTask: { backgroundColor: palette.primary },
  geoLegendWorker: { backgroundColor: "#2563EB" },
  geoLegendText: { color: palette.muted, fontSize: 11, lineHeight: 15, fontWeight: "700" },
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
  dialogBackdrop: { flex: 1, paddingHorizontal: 20, paddingVertical: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,24,39,0.55)" },
  dialogCard: { width: "100%", maxWidth: 460, padding: 20, borderRadius: 16, backgroundColor: palette.surface, gap: 12, elevation: 16 },
  dialogTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  dialogMessage: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  dialogCancel: { flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  dialogCancelText: { color: palette.text, fontSize: 13, fontWeight: "900", textAlign: "center" },
  dialogConfirm: { flex: 1, minHeight: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, backgroundColor: "#B91C1C" },
  dialogConfirmText: { color: palette.white, fontSize: 13, fontWeight: "900", textAlign: "center" },
  modalScrollView: { alignSelf: "stretch", width: "100%" },
  modalScroll: { flexGrow: 1, width: "100%", justifyContent: "center", alignItems: "center", paddingVertical: 16 },
  modalFieldLabel: { color: palette.textStrong, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  modalInput: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, color: palette.text, fontSize: 14, paddingHorizontal: 12 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: palette.outline, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { borderColor: palette.primary, backgroundColor: palette.primary },
  checkboxText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  gcashNumberButton: { minHeight: 56, borderRadius: 10, borderWidth: 1, borderColor: palette.primary, backgroundColor: "#EAF8F1", paddingHorizontal: 14, justifyContent: "center", gap: 2 },
  gcashNumber: { color: palette.textStrong, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  gcashCopyText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  gcashQrPreview: { width: "100%", height: 220, borderRadius: 10, backgroundColor: palette.surfaceLow },
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
  primaryActionTextDisabled: { color: palette.muted },
  guidelineText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
