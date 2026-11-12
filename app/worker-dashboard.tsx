import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { AppText as Text } from "../src/components/AppText";
import { interactiveCardShadow } from "../src/styles";
import { SafeAreaView } from "react-native-safe-area-context";
import { NotificationShortcut } from "../src/components/NotificationShortcut";
import LocationMap from "../src/components/LocationMap";
import { StatusBadge } from "../src/components/StatusBadge";
import { useApp } from "../src/context/AppContext";
import { formatTaskPrice, getScheduleBasedAvailability } from "../src/domain/taskMarketplace";
import { MatchResult, rankTasksForWorker } from "../src/domain/matching";
import { Task } from "../src/types";
import { formatDistance } from "../src/utils/location";
import { formatRelativeTime } from "../src/utils/relativeTime";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  primary: "#005C55",
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

export default function WorkerDashboardScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<"active" | "finished">("active");
  const [applicationsExpanded, setApplicationsExpanded] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const { height: viewportHeight } = useWindowDimensions();
  const { actionLoading, currentUser, notifications, tasks, ratings, acceptTask } = useApp();
  const postedTasks = tasks.filter((task) => task.status === "Finding Workers" || task.status === "Applied");
  const rankedPostedTasks = currentUser ? rankTasksForWorker(postedTasks, currentUser) : [];
  const acceptedTasks = tasks.filter(
    (task) =>
      task.applicantIds?.includes(currentUser?.id ?? "") &&
      (task.status === "Applied" || task.workerId === currentUser?.id) &&
      task.status !== "Finished" &&
      task.status !== "Archived"
  );
  const finishedTasks = tasks.filter(
    (task) => task.workerId === currentUser?.id && (task.status === "Finished" || task.status === "Archived")
  );
  const featuredJobs = rankedPostedTasks.slice(0, 2);
  const workerMapCenter = currentUser?.currentLatitude !== undefined && currentUser.currentLongitude !== undefined
    ? { latitude: currentUser.currentLatitude, longitude: currentUser.currentLongitude }
    : undefined;
  const workerMapMarkers = postedTasks.flatMap((task) => task.latitude !== undefined && task.longitude !== undefined
    ? [{ id: task.id, latitude: task.latitude, longitude: task.longitude, title: task.title }]
    : []);

  async function handleQuickApply(task: Task) {
    try {
      setActionMessage("");
      await acceptTask(task.id);
      router.push(`/task-status/${task.id}`);
    } catch (applyError) {
      setActionMessage(applyError instanceof Error ? applyError.message : "Unable to submit this application.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <DashboardHeader
        onNotifications={() => router.push("/notifications")}
        unreadCount={notifications.filter((notification) => notification.userId === currentUser?.id && !notification.readStatus).length}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeRow}>
          <View style={styles.welcomeCopy}>
            <Text numberOfLines={1} style={styles.welcomeTitle} variant="screenTitle">Welcome back, {currentUser?.fullName?.split(" ")[0] ?? "there"}.</Text>
            <Text numberOfLines={1} style={styles.welcomeLocation} variant="metadata">{currentUser?.address || "Location not set"}</Text>
          </View>
          <View accessible accessibilityLabel={`Availability: ${currentUser ? getScheduleBasedAvailability(tasks, currentUser.id) : "Not set"}`} style={styles.availabilityPill}>
            <Text style={styles.availabilityText} variant="badge">{currentUser ? getScheduleBasedAvailability(tasks, currentUser.id) : "Not set"}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Open Jobs" value={String(postedTasks.length).padStart(2, "0")} />
          <StatCard label="Applications" value={String(acceptedTasks.length).padStart(2, "0")} />
        </View>

        <View style={styles.tabRow}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedTab === "active" }}
            onPress={() => setSelectedTab("active")}
            style={[styles.tabButton, selectedTab === "active" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, selectedTab === "active" && styles.tabButtonTextActive]}>Active</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedTab === "finished" }}
            onPress={() => setSelectedTab("finished")}
            style={[styles.tabButton, selectedTab === "finished" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, selectedTab === "finished" && styles.tabButtonTextActive]}>Finished</Text>
          </Pressable>
        </View>

        {selectedTab === "active" ? (
          <View style={styles.applicationSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: applicationsExpanded }}
              onPress={() => setApplicationsExpanded((expanded) => !expanded)}
              style={({ pressed }) => [styles.applicationHeader, pressed && styles.pressed]}
            >
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Applications</Text>
                <Text style={styles.sectionSubtitle}>{acceptedTasks.length} active · Tap to {applicationsExpanded ? "hide" : "show"}</Text>
              </View>
              <Text style={styles.applicationToggle}>{applicationsExpanded ? "Hide −" : "Show +"}</Text>
            </Pressable>
            {applicationsExpanded ? (
              <View style={styles.applicationGrid}>
                {acceptedTasks.length ? (
                  acceptedTasks.map((task) => (
                    <ApplicationCard key={task.id} task={task} onOpen={() => router.push(`/task-status/${task.id}`)} />
                  ))
                ) : (
                  <View style={styles.emptyApplicationCard}>
                    <Text style={styles.emptyApplicationTitle}>No applications yet</Text>
                    <Text style={styles.emptyApplicationText}>Apply to a job and it will stay here while the client reviews it.</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>Finished Jobs</Text>
                <Text style={styles.historyMeta}>{finishedTasks.length} completed</Text>
              </View>
            </View>
            {finishedTasks.length ? (
              <View style={styles.historyList}>
                {finishedTasks.map((task) => (
                    <HistoryRow
                      key={task.id}
                      task={task}
                      rated={ratings.some((rating) => rating.taskId === task.id && rating.reviewerId === currentUser?.id)}
                      onOpen={() => router.push(`/task-status/${task.id}`)}
                      onChat={() => router.push(`/chat/${task.id}`)}
                      onRate={() => router.push(`/rating/${task.id}`)}
                    />
                ))}
              </View>
            ) : (
              <View style={styles.emptyHistoryRow}>
                <Text style={styles.emptyApplicationText}>Finished jobs will appear here after both sides confirm completion.</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.mapPanel}>
          <LocationMap
            center={workerMapCenter}
            interactive
            markers={workerMapMarkers}
            showUserLocation
            height={208}
          />
          <View style={styles.locationBadge}>
            <Text style={styles.locationText}>{rankedPostedTasks.filter(({ match }) => match.eligible).length} recommended jobs near you</Text>
          </View>
          <Pressable accessibilityLabel="Open full screen map" accessibilityRole="button" onPress={() => setMapFullscreen(true)} style={styles.expandMapButton}>
            <Text style={styles.expandMapButtonText}>Expand map</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Top Opportunities</Text>
            <Text style={styles.sectionSubtitle}>A quick glance. Jobs has the full board with filters.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push("/jobs")} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>

        <View style={styles.jobGrid}>
          {featuredJobs.length ? (
            featuredJobs.map(({ task, match }) => (
                <WorkerJobCard
                key={task.id}
                task={task}
                match={match}
                onOpen={() => router.push(`/task/${task.id}`)}
                onQuickAccept={() => task.pricingMode === "bidding" ? router.push(`/task/${task.id}`) : handleQuickApply(task)}
                applying={actionLoading}
                hasApplied={task.applicantIds?.includes(currentUser?.id ?? "") ?? false}
              />
            ))
          ) : (
            <View style={styles.emptyApplicationCard}>
              <Text style={styles.emptyApplicationTitle}>No jobs posted yet</Text>
              <Text style={styles.emptyApplicationText}>Available tasks from clients will appear here.</Text>
            </View>
          )}
        </View>

        {actionMessage ? <Text accessibilityRole="alert" style={styles.actionMessage}>{actionMessage}</Text> : null}

        <Pressable accessibilityRole="button" onPress={() => router.push("/jobs")} style={styles.fullBoardButton}>
          <Text style={styles.fullBoardText}>Open Full Job Board</Text>
        </Pressable>

      </ScrollView>
      <Modal animationType="slide" onRequestClose={() => setMapFullscreen(false)} presentationStyle="fullScreen" visible={mapFullscreen}>
        <SafeAreaView style={styles.fullscreenMap} edges={["top", "bottom", "left", "right"]}>
          <LocationMap
            center={workerMapCenter}
            fitToMarkers
            interactive
            markers={workerMapMarkers}
            showUserLocation
            height={Math.max(320, viewportHeight - 24)}
          />
          <Pressable accessibilityLabel="Close full screen map" accessibilityRole="button" onPress={() => setMapFullscreen(false)} style={styles.closeMapButton}>
            <Text style={styles.closeMapButtonText}>×</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function DashboardHeader({ onNotifications, unreadCount }: {
  onNotifications: () => void;
  unreadCount: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image accessibilityLabel="TaskLink" resizeMode="contain" source={require("../assets/tasklink-logo.jpg")} style={styles.brandLogo} />
      </View>
      <View style={styles.headerRight}>
        <NotificationShortcut compact onPress={onNotifications} unreadCount={unreadCount} />
      </View>
    </View>
  );
}

function WorkerJobCard({
  task,
  match,
  onQuickAccept,
  onOpen,
  applying,
  hasApplied
}: {
  task: Task;
  match: MatchResult;
  onQuickAccept: () => void;
  onOpen: () => void;
  applying: boolean;
  hasApplied: boolean;
}) {
  return (
    <View style={styles.jobCard}>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatTaskPrice(task)}</Text>
      </View>
      <Text style={styles.jobTitle}>{task.title}</Text>
      <Text style={styles.jobMeta}>{formatRelativeTime(task.createdAt)}</Text>
      <Text style={styles.jobMeta}>{formatDistance(match.distanceKm)} · {task.locationAddress ?? task.location}</Text>
      <Text style={styles.jobMeta}>{match.score}% match · {match.reasons.slice(0, 2).join(" · ")}</Text>
      <View style={styles.jobInfoRow}>
        <Text style={styles.jobInfo}>{task.estimatedDuration}</Text>
        <Text style={styles.jobInfo}>{task.requiredCapability ?? task.category}</Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable accessibilityRole="button" onPress={onOpen} style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>Details</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={applying || hasApplied} onPress={onQuickAccept} style={({ pressed }) => [styles.quickButton, (applying || hasApplied) && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.quickButtonText}>{hasApplied ? "Applied" : applying ? "Applying..." : task.pricingMode === "bidding" ? "Make Offer" : "Quick Apply"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ApplicationCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.applicationCard, pressed && styles.pressed]}>
      <View style={styles.applicationTop}>
        <View style={styles.applicationCopy}>
          <Text style={styles.applicationTitle}>{task.title}</Text>
          <Text style={styles.applicationMeta}>{getApplicationMessage(task.status)}</Text>
        </View>
        <Text style={styles.applicationPrice}>{formatTaskPrice(task)}</Text>
      </View>
      <View style={styles.applicationFooter}>
        <StatusBadge status={task.status} />
        <Text style={styles.applicationAction}>{getApplicationAction(task.status)}</Text>
      </View>
    </Pressable>
  );
}

function getApplicationMessage(status: Task["status"]) {
  if (status === "Applied") {
    return "Waiting for the client to accept your application.";
  }

  if (status === "Accepted") {
    return "Application accepted. You can start this task.";
  }

  if (status === "In Progress") {
    return "Task is in progress.";
  }

  if (status === "Pending Approval") {
    return "Waiting for client completion approval.";
  }

  return "Open this task for details.";
}

function getApplicationAction(status: Task["status"]) {
  if (status === "Accepted") {
    return "Start Task";
  }

  if (status === "In Progress") {
    return "Mark Finished";
  }

  if (status === "Pending Approval") {
    return "Pending Approval";
  }

  return "View Status";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function HistoryRow({
  task,
  rated,
  onOpen,
  onChat,
  onRate
}: {
  task: Task;
  rated?: boolean;
  onOpen: () => void;
  onChat?: () => void;
  onRate?: () => void;
}) {
  return (
    <View style={styles.historyCard}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
        <View style={styles.historyIcon}>
          <Text style={styles.historyIconText}>OK</Text>
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyJobTitle}>{task.title}</Text>
          <Text style={styles.historyJobMeta}>{task.location}</Text>
        </View>
        <Text style={styles.historyAmount}>{formatTaskPrice(task)}</Text>
      </Pressable>
      <View style={styles.historyDivider} />
      {onChat || onRate ? (
        <View style={styles.historyActions}>
          {onChat ? (
            <Pressable accessibilityRole="button" onPress={onChat} style={styles.historyActionButton}>
              <Text style={styles.historyActionButtonText}>Chat</Text>
            </Pressable>
          ) : null}
          {onRate ? (
            <Pressable
              accessibilityRole="button"
              disabled={rated}
              onPress={onRate}
              style={({ pressed }) => [
                styles.historyActionButtonPrimary,
                rated && styles.historyActionButtonDisabled,
                pressed && !rated && styles.pressed
              ]}
            >
              <Text style={[styles.historyActionButtonPrimaryText, rated && styles.historyActionButtonPrimaryTextDisabled]}>
                {rated ? "Client Rated" : "Rate Client"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerRight: { flexDirection: "row", alignItems: "center" },
  menuText: { color: palette.primary, fontSize: 24, fontWeight: "800" },
  brandLogo: { width: 44, height: 44 },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  welcomeRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 },
  welcomeCopy: { flex: 1, minWidth: 0, gap: 3 },
  welcomeTitle: { color: palette.textStrong },
  welcomeLocation: { color: palette.muted },
  availabilityPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#A3FAEF" },
  availabilityText: { color: palette.primary },
  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, borderRadius: 12, padding: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant },
  statValue: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  statLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 4 },
  mapPanel: { height: 132, borderRadius: 12, overflow: "hidden", backgroundColor: "#DDEDEA", elevation: 2 },
  fullscreenMap: { flex: 1, backgroundColor: palette.background, padding: 12 },
  mapGrid: { flex: 1, backgroundColor: "#E7F3F0" },
  mapLineHorizontal: { position: "absolute", left: -20, right: -20, top: 58, height: 14, backgroundColor: "#C8DBD7", transform: [{ rotate: "-10deg" }] },
  mapLineVertical: { position: "absolute", top: -20, bottom: -20, left: "56%", width: 16, backgroundColor: "#D6C29E", transform: [{ rotate: "18deg" }] },
  mapPin: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: palette.secondary, borderWidth: 3, borderColor: palette.white },
  mapPinOne: { left: "24%", top: 42 },
  mapPinTwo: { left: "62%", top: 72, backgroundColor: palette.primary },
  locationBadge: { position: "absolute", left: 12, bottom: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  locationIcon: { color: palette.primary, fontSize: 18, fontWeight: "900" },
  locationText: { color: palette.text, fontSize: 12, fontWeight: "800" },
  expandMapButton: { position: "absolute", right: 12, top: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: palette.outlineVariant, minHeight: 34, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  expandMapButtonText: { color: palette.primary, fontSize: 11, fontWeight: "900" },
  closeMapButton: { position: "absolute", right: 22, top: 22, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: palette.outlineVariant },
  closeMapButtonText: { color: palette.textStrong, fontSize: 29, lineHeight: 32, fontWeight: "500" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  sectionSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  tabRow: { flexDirection: "row", gap: 8, padding: 4, borderRadius: 12, backgroundColor: palette.surfaceLow },
  tabButton: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabButtonActive: { backgroundColor: palette.primary },
  tabButtonText: { color: palette.muted, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  tabButtonTextActive: { color: palette.white },
  viewAllButton: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceContainer },
  viewAllText: { color: palette.primary, fontSize: 12, fontWeight: "900" },
  jobGrid: { gap: 12 },
  applicationSection: { borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, overflow: "hidden" },
  applicationHeader: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  applicationToggle: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  applicationGrid: { gap: 10, paddingHorizontal: 12, paddingBottom: 12 },
  applicationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.45)",
    backgroundColor: palette.surface,
    gap: 14,
    ...interactiveCardShadow
  },
  applicationTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  applicationCopy: { flex: 1, gap: 4 },
  applicationTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  applicationMeta: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  applicationPrice: { color: palette.primary, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  applicationFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(189,201,198,0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  applicationAction: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  emptyApplicationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceLow,
    gap: 4
  },
  emptyApplicationTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  emptyApplicationText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  jobCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, gap: 12, ...interactiveCardShadow },
  urgentBadge: { position: "absolute", left: 16, top: 16, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: palette.secondaryContainer },
  urgentText: { color: "#684000", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  priceRow: { alignItems: "flex-end" },
  price: { color: palette.primary, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  jobTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  jobMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  jobInfoRow: { paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(189,201,198,0.45)", flexDirection: "row", gap: 16 },
  jobInfo: { color: palette.outline, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  cardActions: { flexDirection: "row", gap: 10 },
  detailsButton: { flex: 1, minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center", backgroundColor: palette.surface },
  detailsButtonText: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  quickButton: { flex: 1.3, minHeight: 46, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  quickButtonText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  fullBoardButton: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.secondaryContainer },
  fullBoardText: { color: "#684000", fontSize: 14, fontWeight: "900" },
  actionMessage: { color: "#BA1A1A", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  historyPanel: { padding: 16, borderRadius: 12, backgroundColor: palette.surfaceLow, gap: 12 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  historyList: { gap: 10 },
  historyCard: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    ...interactiveCardShadow
  },
  historyTitle: { color: palette.textStrong, fontSize: 18, lineHeight: 26, fontWeight: "900" },
  historyMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8F1"
  },
  historyIconText: { color: palette.success, fontSize: 10, fontWeight: "900" },
  historyCopy: { flex: 1 },
  historyJobTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  historyJobMeta: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  historyAmount: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  historyDivider: { height: 1, backgroundColor: "rgba(189,201,198,0.65)" },
  historyActions: { flexDirection: "row", gap: 10 },
  historyActionButton: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceLow, borderWidth: 1, borderColor: palette.outlineVariant },
  historyActionButtonText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  historyActionButtonPrimary: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  historyActionButtonPrimaryText: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  historyActionButtonPrimaryTextDisabled: { color: palette.textStrong },
  historyActionButtonDisabled: { backgroundColor: palette.surfaceContainer, borderWidth: 1, borderColor: palette.outlineVariant },
  emptyHistoryRow: { padding: 12, borderRadius: 8, backgroundColor: palette.surface },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
