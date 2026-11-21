import Feather from "@expo/vector-icons/Feather";
import { BlurTargetView, BlurView } from "expo-blur";
import { Href, useRouter } from "expo-router";
import { ComponentRef, useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "../src/components/AppText";
import { NotificationShortcut } from "../src/components/NotificationShortcut";
import { usePrefersReducedMotion } from "../src/components/RouteTransition";
import { useApp } from "../src/context/AppContext";
import { getScheduleBasedAvailability, getUserTaskHistory } from "../src/domain/taskMarketplace";
import { colors, radii, spacing } from "../src/theme";
import { PhoneVerificationContent } from "./phone-verification";
import { ProfileManagementContent, ProfileManagementSection } from "./profile-manage";

type ProfileOverlayKey = "phone" | Exclude<ProfileManagementSection, "edit">;

const overlayTitles: Record<ProfileOverlayKey, string> = {
  phone: "Verify Mobile Number",
  work: "Work Information",
  service: "Availability & Service Area",
  verification: "Identity Verification",
  reviews: "Reviews & Ratings",
  settings: "Settings"
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = usePrefersReducedMotion();
  const { actionLoading, currentUser, notifications, ratings, tasks, users } = useApp();
  const blurTargetRef = useRef<ComponentRef<typeof View>>(null);
  const overlayScale = useRef(new Animated.Value(0.82)).current;
  const overlayClosingRef = useRef(false);
  const [activeOverlay, setActiveOverlay] = useState<ProfileOverlayKey>();
  const [overlayClosing, setOverlayClosing] = useState(false);
  const [overlayDirty, setOverlayDirty] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);

  useEffect(() => {
    if (!activeOverlay) return;
    overlayClosingRef.current = false;
    setOverlayClosing(false);
    overlayScale.stopAnimation();
    overlayScale.setValue(reduceMotion ? 1 : 0.82);
    if (reduceMotion) return;
    const animation = Animated.sequence([
      Animated.timing(overlayScale, {
        toValue: 1.045,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(overlayScale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true
      })
    ]);
    animation.start();
    return () => animation.stop();
  }, [activeOverlay, overlayScale, reduceMotion]);

  useEffect(() => () => overlayScale.stopAnimation(), [overlayScale]);

  if (!currentUser) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Profile</Text>
        </View>
        <View style={styles.unavailableState}>
          <Text style={styles.emptyTitle}>Profile unavailable</Text>
          <Text style={styles.emptyText}>Sign in again to view your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isWorker = currentUser.role === "worker";
  const availability = isWorker ? getScheduleBasedAvailability(tasks, currentUser.id) : undefined;
  const profileRatings = ratings
    .filter((rating) => rating.targetUserId === currentUser.id)
    .map((rating) => ({
      ...rating,
      reviewerName: users.find((user) => user.id === rating.reviewerId)?.fullName ?? "TaskLink User",
      taskTitle: tasks.find((task) => task.id === rating.taskId)?.title ?? "Completed task"
    }));
  const latestReview = [...profileRatings].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  })[0];
  const averageRating = profileRatings.length
    ? profileRatings.reduce((total, rating) => total + rating.score, 0) / profileRatings.length
    : currentUser.rating > 0 ? currentUser.rating : undefined;
  const reviewCount = profileRatings.length || currentUser.ratingCount || 0;
  const taskHistory = currentUser.role !== "admin"
    ? getUserTaskHistory(tasks, currentUser.id, currentUser.role)
    : undefined;
  const completedJobs = isWorker ? taskHistory?.completed ?? currentUser.completedTasks ?? 0 : undefined;
  const verified = currentUser.verificationStatus === "Verified" || currentUser.identityStatus === "Approved";
  const verificationLabel = getVerificationLabel(currentUser.verificationStatus, currentUser.identityStatus);
  const visibleSkills = (currentUser.skills?.length ? currentUser.skills : currentUser.capabilities ?? []).slice(0, 2);
  const skillCount = currentUser.skills?.length ? currentUser.skills.length : currentUser.capabilities?.length ?? 0;
  const serviceArea = [currentUser.barangay, currentUser.cityMunicipality]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ") || currentUser.address || "Service location not set";
  const unreadCount = notifications.filter((notification) => notification.userId === currentUser.id && !notification.readStatus).length;

  function openEditProfile() {
    router.push("/profile-manage?section=edit" as Href);
  }

  function openOverlay(overlay: ProfileOverlayKey) {
    if (activeOverlay || overlayClosingRef.current) return;
    setPhoneBusy(false);
    setOverlayDirty(false);
    setActiveOverlay(overlay);
  }

  function closeOverlay(afterClose?: () => void, discardConfirmed = false) {
    if (!activeOverlay || overlayClosingRef.current || actionLoading || phoneBusy) return;
    if (overlayDirty && !discardConfirmed) {
      Alert.alert(
        "Discard unsaved changes?",
        "Changes in this popup have not been saved.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => closeOverlay(afterClose, true) }
        ]
      );
      return;
    }
    if (reduceMotion) {
      setActiveOverlay(undefined);
      setPhoneBusy(false);
      setOverlayDirty(false);
      afterClose?.();
      return;
    }
    overlayClosingRef.current = true;
    setOverlayClosing(true);
    overlayScale.stopAnimation();
    Animated.sequence([
      Animated.timing(overlayScale, {
        toValue: 1.035,
        duration: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(overlayScale, {
        toValue: 0.82,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (!finished) return;
      overlayClosingRef.current = false;
      setOverlayClosing(false);
      setActiveOverlay(undefined);
      setPhoneBusy(false);
      setOverlayDirty(false);
      afterClose?.();
    });
  }

  return (
    <>
    <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <NotificationShortcut onPress={() => router.push("/notifications")} unreadCount={unreadCount} />
          <Pressable
            accessibilityLabel="Open Settings"
            accessibilityRole="button"
            onPress={() => openOverlay("settings")}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather accessibilityElementsHidden color={colors.text} name="settings" size={21} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identitySection}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              {currentUser.profilePhotoUrl ? (
                <Image accessibilityLabel={`${currentUser.fullName} profile photo`} source={{ uri: currentUser.profilePhotoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{currentUser.fullName.trim()[0]?.toUpperCase() ?? "U"}</Text>
              )}
            </View>
            <View style={styles.identityCopy}>
              <View style={styles.nameRow}>
                <Text numberOfLines={2} style={styles.profileName}>{currentUser.fullName || "TaskLink User"}</Text>
                {verified ? <Feather accessibilityLabel="Identity verified" color={colors.success} name="check-circle" size={17} /> : null}
              </View>
              <Text style={styles.roleLine}>{isWorker ? "Tasker" : "Employer"}{availability ? ` Â· ${availability}` : ""}</Text>
              <View style={styles.ratingLine}>
                {averageRating !== undefined ? <>
                  <Feather accessibilityElementsHidden color="#D99A00" name="star" size={14} />
                  <Text style={styles.ratingText}>{averageRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})</Text>
                </> : <Text style={styles.mutedText}>No reviews yet</Text>}
                {completedJobs !== undefined ? <Text style={styles.ratingText}> Â· {completedJobs} completed {completedJobs === 1 ? "job" : "jobs"}</Text> : null}
              </View>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={openEditProfile}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          >
            <Feather accessibilityElementsHidden color={colors.primary} name="edit-2" size={16} />
            <Text style={styles.outlineButtonText}>Edit Profile</Text>
          </Pressable>
        </View>

        {!currentUser.phoneVerified ? (
          <Pressable
            accessibilityLabel="Verify your mobile number"
            accessibilityRole="button"
            onPress={() => openOverlay("phone")}
            style={({ pressed }) => [styles.noticeRow, pressed && styles.pressed]}
          >
            <Feather accessibilityElementsHidden color={colors.primary} name="shield" size={20} />
            <View style={styles.flex}>
              <Text style={styles.noticeTitle}>Verify your mobile number</Text>
              <Text style={styles.noticeText}>Complete your account security setup</Text>
            </View>
            <Feather accessibilityElementsHidden color={colors.muted} name="chevron-right" size={20} />
          </Pressable>
        ) : null}

        {isWorker ? <View style={styles.section}>
          <SectionHeader action="Edit" onPress={() => openOverlay("work")} title="Work Information" />
          <View style={styles.summaryCard}>
            <Text style={styles.cardLabel}>Skills & Services</Text>
            <View style={styles.chipRow}>
              {visibleSkills.length ? visibleSkills.map((skill) => (
                <View key={skill} style={styles.skillChip}><Text numberOfLines={1} style={styles.skillChipText}>{skill}</Text></View>
              )) : <Text style={styles.emptyText}>No skills added yet</Text>}
              {skillCount > visibleSkills.length ? <View style={styles.skillChip}><Text style={styles.skillChipText}>+{skillCount - visibleSkills.length}</Text></View> : null}
            </View>
            <View style={styles.divider} />
            <View style={styles.valueRow}>
              <Text style={styles.bodyText}>Experience</Text>
              <Text style={styles.valueText}>{currentUser.yearsOfExperience?.trim() || "Not added"}</Text>
            </View>
            <Text numberOfLines={2} style={styles.summaryText}>{currentUser.experienceDescription?.trim() || "Add a short summary of your work experience."}</Text>
          </View>
        </View> : null}

        {isWorker ? <View style={styles.section}>
          <SectionHeader action="Manage" onPress={() => openOverlay("service")} title="Availability & Service Area" />
          <View style={styles.summaryCard}>
            <View style={styles.valueRow}>
              <Text style={styles.bodyText}>Available for jobs</Text>
              <View style={[styles.statusPill, availability === "Busy" && styles.statusPillMuted]}>
                <Text style={[styles.statusPillText, availability === "Busy" && styles.statusPillTextMuted]}>{availability}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.locationRow}>
              <Feather accessibilityElementsHidden color={colors.muted} name="map-pin" size={19} />
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.bodyText}>{serviceArea}</Text>
                <Text style={styles.mutedText}>{currentUser.preferredRadiusKm ? `Within ${currentUser.preferredRadiusKm} km` : "Service radius not set"}</Text>
              </View>
              <Feather accessibilityElementsHidden color={colors.muted} name="chevron-right" size={20} />
            </View>
          </View>
        </View> : null}

        <View style={styles.section}>
          <SectionHeader action="View details" onPress={() => openOverlay("verification")} title="Verification" />
          <Pressable
            accessibilityRole="button"
            onPress={() => openOverlay("verification")}
            style={({ pressed }) => [styles.compactRow, pressed && styles.pressed]}
          >
            <Feather accessibilityElementsHidden color={verified ? colors.success : colors.primary} name="shield" size={20} />
            <Text style={styles.compactRowLabel}>Identity verification</Text>
            <View style={[styles.statusPill, !verified && styles.statusPillNeutral]}>
              <Text style={[styles.statusPillText, !verified && styles.statusPillTextNeutral]}>{verificationLabel}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeader action="See all" onPress={() => openOverlay("reviews")} title="Reviews & Ratings" />
          {latestReview ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => openOverlay("reviews")}
              style={({ pressed }) => [styles.reviewCard, pressed && styles.pressed]}
            >
              <View style={styles.reviewTopRow}>
                <Text numberOfLines={1} style={styles.reviewName}>{latestReview.reviewerName}</Text>
                <View style={styles.reviewScoreRow}>
                  <Feather accessibilityElementsHidden color="#D99A00" name="star" size={14} />
                  <Text style={styles.reviewScore}>{latestReview.score}/5</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.reviewTask}>{latestReview.taskTitle}</Text>
              {latestReview.feedback.trim() ? <Text numberOfLines={2} style={styles.summaryText}>{latestReview.feedback}</Text> : null}
            </Pressable>
          ) : (
            <View style={styles.reviewCard}>
              <Text style={styles.emptyText}>No reviews yet. Reviews from completed jobs will appear here.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
    </BlurTargetView>
    <Modal
      animationType="none"
      onRequestClose={() => closeOverlay()}
      statusBarTranslucent
      transparent
      visible={Boolean(activeOverlay)}
    >
      <View
        accessibilityViewIsModal
        pointerEvents={overlayClosing ? "none" : "auto"}
        style={styles.overlayRoot}
      >
        <BlurView
          blurMethod="dimezisBlurViewSdk31Plus"
          blurReductionFactor={1}
          blurTarget={blurTargetRef}
          intensity={34}
          pointerEvents="none"
          style={styles.overlayFill}
          tint="dark"
        />
        <Pressable
          accessibilityLabel="Close profile popup"
          accessibilityRole="button"
          disabled={actionLoading || phoneBusy}
          onPress={() => closeOverlay()}
          style={styles.overlayBackdrop}
        />
        {activeOverlay ? <Animated.View
          style={[
            styles.overlaySurface,
            {
              opacity: overlayScale.interpolate({
                inputRange: [0.82, 1],
                outputRange: [0, 1],
                extrapolate: "clamp"
              }),
              transform: [{ scale: overlayScale }]
            }
          ]}
        >
          <View style={styles.overlayHeader}>
            <View style={styles.overlayTitleGroup}>
              <Text numberOfLines={2} style={styles.overlayTitle}>{overlayTitles[activeOverlay]}</Text>
              {activeOverlay === "reviews" ? (
                <Text style={styles.overlaySubtitle}>{reviewCount ? `${reviewCount} total ${reviewCount === 1 ? "review" : "reviews"}` : "No reviews yet"}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel={`Close ${overlayTitles[activeOverlay]}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: actionLoading || phoneBusy }}
              disabled={actionLoading || phoneBusy}
              onPress={() => closeOverlay()}
              style={({ pressed }) => [styles.overlayCloseButton, pressed && styles.overlayClosePressed]}
            >
              <Feather accessibilityElementsHidden color="#BA1A1A" name="x" size={24} />
            </Pressable>
          </View>
          <View style={styles.overlayBody}>
            {activeOverlay === "phone" ? (
              <ScrollView contentContainerStyle={styles.phoneOverlayContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.phoneOverlayScroll}>
                <PhoneVerificationContent
                  closeLabel="Done"
                  onBusyChange={setPhoneBusy}
                  onClose={() => closeOverlay()}
                />
              </ScrollView>
            ) : (
              <ProfileManagementContent
                embeddedSection={activeOverlay}
                hideHeader
                onClose={() => closeOverlay()}
                onOpenPhoneVerification={() => closeOverlay(() => setActiveOverlay("phone"))}
                onUnsavedChange={setOverlayDirty}
              />
            )}
          </View>
        </Animated.View> : null}
      </View>
    </Modal>
    </>
  );
}

function SectionHeader({ action, onPress, title }: { action: string; onPress: () => void; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable accessibilityLabel={`${action} ${title}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}>
        <Text style={styles.sectionActionText}>{action}</Text>
        <Feather accessibilityElementsHidden color={colors.muted} name="chevron-right" size={16} />
      </Pressable>
    </View>
  );
}

function getVerificationLabel(verificationStatus?: string, identityStatus?: string) {
  if (verificationStatus === "Verified" || identityStatus === "Approved") return "Verified";
  if (verificationStatus === "Pending Verification" || identityStatus === "Pending Approval") return "Pending review";
  if (verificationStatus === "Needs Resubmission" || identityStatus === "Needs Resubmission") return "Resubmit";
  if (verificationStatus === "Rejected" || identityStatus === "Rejected") return "Rejected";
  return "Not started";
}

const styles = StyleSheet.create({
  blurTarget: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EF"
  },
  screenTitle: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: 18 },
  identitySection: { gap: spacing.md },
  identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: colors.infoLight, borderWidth: 1, borderColor: colors.border },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: colors.primary, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  identityCopy: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileName: { flexShrink: 1, color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  roleLine: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  ratingLine: { minHeight: 20, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 3 },
  ratingText: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  outlineButton: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.card },
  outlineButtonText: { color: colors.primary, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  noticeRow: { minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.infoLight },
  noticeTitle: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  noticeText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  section: { gap: 10 },
  sectionHeader: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  sectionAction: { minHeight: 40, paddingLeft: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
  sectionActionText: { color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  summaryCard: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 10 },
  cardLabel: { color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  chipRow: { minHeight: 28, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  skillChip: { maxWidth: "46%", minHeight: 26, paddingHorizontal: 9, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.mutedLight },
  skillChipText: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#EDF1EF" },
  valueRow: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  bodyText: { flexShrink: 1, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  valueText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  summaryText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  statusPill: { minHeight: 28, paddingHorizontal: 10, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.successLight },
  statusPillText: { color: colors.success, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  statusPillMuted: { backgroundColor: colors.mutedLight },
  statusPillTextMuted: { color: colors.muted },
  statusPillNeutral: { backgroundColor: colors.infoLight },
  statusPillTextNeutral: { color: colors.primary },
  locationRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  compactRow: { minHeight: 58, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card },
  compactRowLabel: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  reviewCard: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 6 },
  reviewTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  reviewName: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  reviewScoreRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewScore: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  reviewTask: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  mutedText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  emptyTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  unavailableState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.xs },
  overlayRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  overlayFill: { position: "absolute", inset: 0 },
  overlayBackdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(35,43,48,0.1)" },
  overlaySurface: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "84%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "#E9EDF0",
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10
  },
  overlayHeader: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  overlayTitleGroup: { flex: 1, gap: 2 },
  overlayTitle: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  overlaySubtitle: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  overlayCloseButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "#BA1A1A", alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  overlayClosePressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  overlayBody: { flexShrink: 1, minHeight: 0 },
  phoneOverlayScroll: { flexGrow: 0, flexShrink: 1 },
  phoneOverlayContent: { paddingHorizontal: 12, paddingTop: 0, paddingBottom: 12 },
  flex: { flex: 1 },
  pressed: { opacity: 0.68 }
});
