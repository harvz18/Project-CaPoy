import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "../src/components/BottomNavIcon";
import { StatusBadge } from "../src/components/StatusBadge";
import { useApp } from "../src/context/AppContext";
import { Task } from "../src/types";

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
  const { currentUser, tasks, acceptTask } = useApp();
  const postedTasks = tasks.filter((task) => task.status === "Finding Workers" || task.status === "Applied");
  const acceptedTasks = tasks.filter(
    (task) =>
      task.applicantIds?.includes(currentUser?.id ?? "") &&
      task.status !== "Finished" &&
      task.status !== "Archived"
  );
  const finishedTasks = tasks.filter(
    (task) => task.workerId === currentUser?.id && task.status === "Finished"
  );
  const featuredJobs = postedTasks.slice(0, 2);

  async function handleQuickApply(task: Task) {
    await acceptTask(task.id);
    router.push(`/task-status/${task.id}`);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <DashboardHeader initials={currentUser?.fullName?.[0] ?? "J"} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Worker Home</Text>
            <Text style={styles.heroTitle}>Welcome back, {currentUser?.fullName?.split(" ")[0] ?? "Juan"}.</Text>
            <Text style={styles.heroText}>You are visible to nearby clients in Bacolod City. Open the full board for all available jobs.</Text>
          </View>
          <View style={styles.availabilityPill}>
            <Text style={styles.availabilityText}>{currentUser?.availabilityStatus ?? "Available"}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Available Jobs" value={String(postedTasks.length).padStart(2, "0")} />
          <StatCard label="Applications" value={String(acceptedTasks.length).padStart(2, "0")} />
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Accepted Applications</Text>
            <Text style={styles.sectionSubtitle}>Track applied jobs and start once the client accepts.</Text>
          </View>
        </View>

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

        <View style={styles.mapPanel}>
          <View style={styles.mapGrid}>
            <View style={styles.mapLineHorizontal} />
            <View style={styles.mapLineVertical} />
            <View style={[styles.mapPin, styles.mapPinOne]} />
            <View style={[styles.mapPin, styles.mapPinTwo]} />
          </View>
          <View style={styles.locationBadge}>
            <Text style={styles.locationIcon}>•</Text>
            <Text style={styles.locationText}>2 hot areas near you</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Top Opportunities</Text>
            <Text style={styles.sectionSubtitle}>A quick glance. Jobs has the full board with filters.</Text>
          </View>
          <Pressable onPress={() => router.push("/jobs")} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>

        <View style={styles.jobGrid}>
          {featuredJobs.length ? (
            featuredJobs.map((task, index) => (
              <WorkerJobCard
                key={task.id}
                task={task}
                urgent={index === 0 || task.wage === "1200"}
                detail={workerDetails[index % workerDetails.length]}
                onOpen={() => router.push(`/task/${task.id}`)}
                onQuickAccept={() => handleQuickApply(task)}
              />
            ))
          ) : (
            <View style={styles.emptyApplicationCard}>
              <Text style={styles.emptyApplicationTitle}>No jobs posted yet</Text>
              <Text style={styles.emptyApplicationText}>Available tasks from clients will appear here.</Text>
            </View>
          )}
        </View>

        <Pressable onPress={() => router.push("/jobs")} style={styles.fullBoardButton}>
          <Text style={styles.fullBoardText}>Open Full Job Board</Text>
        </Pressable>

        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Finished Jobs</Text>
            <Text style={styles.historyMeta}>{finishedTasks.length} completed</Text>
          </View>
          {finishedTasks.length ? (
            finishedTasks.map((task) => (
              <HistoryRow key={task.id} task={task} onOpen={() => router.push(`/task-status/${task.id}`)} />
            ))
          ) : (
            <View style={styles.emptyHistoryRow}>
              <Text style={styles.emptyApplicationText}>Finished jobs will appear here after both sides confirm completion.</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav active="home" router={router} />
    </SafeAreaView>
  );
}

const workerDetails = [
  { distance: "0.8 km away", area: "Lacson St.", load: "Light load" },
  { distance: "2.4 km away", area: "Mansilingan", load: "Tools provided" }
];

function DashboardHeader({ initials }: { initials: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.menuText}>≡</Text>
        <Text style={styles.brand}>TASKLINK</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    </View>
  );
}

function WorkerJobCard({
  task,
  urgent,
  detail,
  onQuickAccept,
  onOpen
}: {
  task: Task;
  urgent?: boolean;
  detail: { distance: string; area: string; load: string };
  onQuickAccept: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.jobCard}>
      {urgent ? (
        <View style={styles.urgentBadge}>
          <Text style={styles.urgentText}>URGENT</Text>
        </View>
      ) : null}
      <View style={styles.priceRow}>
        <Text style={styles.price}>P{task.wage}</Text>
      </View>
      <Text style={styles.jobTitle}>{task.title}</Text>
      <Text style={styles.jobMeta}>{detail.distance} • {detail.area}</Text>
      <View style={styles.jobInfoRow}>
        <Text style={styles.jobInfo}>{task.estimatedDuration}</Text>
        <Text style={styles.jobInfo}>{detail.load}</Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable accessibilityRole="button" onPress={onOpen} style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>Details</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onQuickAccept} style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}>
          <Text style={styles.quickButtonText}>Quick Apply</Text>
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
        <Text style={styles.applicationPrice}>P{task.wage}</Text>
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

function HistoryRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
      <View style={styles.historyIcon}>
        <Text style={styles.historyIconText}>OK</Text>
      </View>
      <View style={styles.historyCopy}>
        <Text style={styles.historyJobTitle}>{task.title}</Text>
        <Text style={styles.historyJobMeta}>{task.location}</Text>
      </View>
      <Text style={styles.historyAmount}>P{task.wage}</Text>
    </Pressable>
  );
}

function BottomNav({ active, router }: { active: string; router: ReturnType<typeof useRouter> }) {
  const insets = useSafeAreaInsets();
  const items = [
    { key: "home", label: "Home", route: "/worker-dashboard" },
    { key: "jobs", label: "Jobs", route: "/jobs" },
    { key: "chat", label: "Chat", route: "/chat" },
    { key: "profile", label: "Profile", route: "/profile" }
  ] as const;

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
        const selected = item.key === active;
        const color = selected ? "#684000" : palette.muted;
        return (
          <Pressable key={item.key} onPress={() => router.push(item.route as never)} style={[styles.navItem, selected && styles.navItemActive]}>
            <BottomNavIcon name={item.key} color={color} />
            <Text style={[styles.navLabel, selected && styles.navTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
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
  menuText: { color: palette.primary, fontSize: 24, fontWeight: "800" },
  brand: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "800" },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.secondaryContainer, borderWidth: 1, borderColor: palette.outlineVariant },
  avatarText: { color: "#684000", fontWeight: "900" },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  heroPanel: { minHeight: 172, borderRadius: 12, padding: 20, backgroundColor: palette.primary, justifyContent: "space-between", overflow: "hidden" },
  heroCopy: { gap: 6 },
  heroKicker: { color: "#A3FAEF", fontSize: 12, lineHeight: 16, fontWeight: "900", textTransform: "uppercase" },
  heroTitle: { color: palette.white, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  heroText: { color: "#DDF8F4", fontSize: 14, lineHeight: 20 },
  availabilityPill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#A3FAEF" },
  availabilityText: { color: palette.primary, fontSize: 12, fontWeight: "900" },
  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, borderRadius: 12, padding: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant },
  statValue: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  statLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 4 },
  mapPanel: { height: 132, borderRadius: 12, overflow: "hidden", backgroundColor: "#DDEDEA", elevation: 2 },
  mapGrid: { flex: 1, backgroundColor: "#E7F3F0" },
  mapLineHorizontal: { position: "absolute", left: -20, right: -20, top: 58, height: 14, backgroundColor: "#C8DBD7", transform: [{ rotate: "-10deg" }] },
  mapLineVertical: { position: "absolute", top: -20, bottom: -20, left: "56%", width: 16, backgroundColor: "#D6C29E", transform: [{ rotate: "18deg" }] },
  mapPin: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: palette.secondary, borderWidth: 3, borderColor: palette.white },
  mapPinOne: { left: "24%", top: 42 },
  mapPinTwo: { left: "62%", top: 72, backgroundColor: palette.primary },
  locationBadge: { position: "absolute", left: 12, bottom: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  locationIcon: { color: palette.primary, fontSize: 18, fontWeight: "900" },
  locationText: { color: palette.text, fontSize: 12, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  sectionSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  viewAllButton: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceContainer },
  viewAllText: { color: palette.primary, fontSize: 12, fontWeight: "900" },
  jobGrid: { gap: 12 },
  applicationGrid: { gap: 10 },
  applicationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.45)",
    backgroundColor: palette.surface,
    gap: 14,
    elevation: 2
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
  jobCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, elevation: 2, gap: 12 },
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
  historyPanel: { padding: 16, borderRadius: 12, backgroundColor: palette.surfaceLow, gap: 12 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  historyTitle: { color: palette.textStrong, fontSize: 18, lineHeight: 26, fontWeight: "900" },
  historyMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  historyRow: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: palette.surface,
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
  emptyHistoryRow: { padding: 12, borderRadius: 8, backgroundColor: palette.surface },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 72, paddingHorizontal: 8, paddingTop: 8, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderTopWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, flexDirection: "row", justifyContent: "space-around", elevation: 10 },
  navItem: { minWidth: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navItemActive: { backgroundColor: palette.secondaryContainer },
  navLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  navTextActive: { color: "#684000" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
