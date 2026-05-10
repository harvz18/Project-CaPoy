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
  primaryContainer: "#0F766E",
  secondary: "#855300",
  secondaryContainer: "#FEA619",
  tertiaryContainer: "#9C573A",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  urgent: "#EF4444",
  pending: "#F97316",
  white: "#FFFFFF"
};

export default function ClientDashboardScreen() {
  const router = useRouter();
  const { currentUser, tasks, users } = useApp();
  const clientTasks = tasks.filter((task) => task.clientId === currentUser?.id);
  const activeClientTasks = clientTasks.filter((task) => task.status !== "Finished" && task.status !== "Archived");
  const finishedCount = clientTasks.filter((task) => task.status === "Finished").length;
  const finishedTasks = clientTasks.filter((task) => task.status === "Finished");
  const archivedTasks = clientTasks.filter((task) => task.status === "Archived");
  const activeWorkers = users.filter((user) => user.role === "worker");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <DashboardHeader onPostTask={() => router.push("/post-task")} initials="M" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroGrid}>
          <View style={styles.heroPanel}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Welcome back, {currentUser?.fullName?.split(" ")[0] ?? "Maria"}!</Text>
              <Text style={styles.heroText}>
                You have {clientTasks.length} tasks in your workspace and {finishedCount} completed jobs.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/post-task")}
                style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
              >
                <Text style={styles.heroButtonText}>Post New Task</Text>
              </Pressable>
            </View>
            <Text style={styles.heroMark}>TL</Text>
          </View>

          <View style={styles.healthCard}>
            <View style={styles.healthTop}>
              <Text style={styles.cardMutedBold}>System Health</Text>
              <View style={styles.healthDot} />
            </View>
            <View style={styles.healthBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.smallLabel}>Market Demand</Text>
                <Text style={styles.successText}>High</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
              </View>
              <Text style={styles.smallMuted}>Workers are currently very active in Bacolod City.</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Ongoing Jobs" value={String(activeClientTasks.length).padStart(2, "0")} tone="primary" />
          <StatCard label="Active Workers" value={String(activeWorkers.length).padStart(2, "0")} tone="secondary" />
          <StatCard label="Completed" value={String(finishedCount).padStart(2, "0")} tone="success" />
          <StatCard label="Total Spend" value={`P${getTotalSpend(clientTasks)}`} tone="primary" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ongoing Jobs</Text>
          <Text style={styles.linkText}>View All</Text>
        </View>

        <View style={styles.jobGrid}>
          {activeClientTasks.length ? (
            activeClientTasks.slice(0, 2).map((task, index) => (
              <ClientJobCard key={task.id} task={task} urgent={index === 0} onPress={() => router.push(`/task-status/${task.id}`)} />
            ))
          ) : (
            <View style={styles.archiveEmptyRow}>
              <Text style={styles.smallMuted}>Posted tasks will appear here.</Text>
            </View>
          )}
        </View>

        <View style={styles.completedPanel}>
          <Text style={styles.panelTitle}>Recently Completed</Text>
          {finishedTasks.length ? (
            finishedTasks.slice(0, 2).map((task) => (
              <HistoryRow
                key={task.id}
                icon={task.title[0] ?? "T"}
                title={task.title}
                subtitle={`Completed by ${users.find((user) => user.id === task.workerId)?.fullName ?? "worker"}`}
                amount={`P${task.wage}`}
                onPress={() => router.push(`/task-status/${task.id}`)}
              />
            ))
          ) : (
            <View style={styles.archiveEmptyRow}>
              <Text style={styles.smallMuted}>Finished work will appear here.</Text>
            </View>
          )}
        </View>

        <View style={styles.archivedPanel}>
          <View style={styles.archivedHeader}>
            <Text style={styles.panelTitle}>Archived Tasks</Text>
            <Text style={styles.smallMuted}>{archivedTasks.length} archived</Text>
          </View>
          {archivedTasks.length ? (
            archivedTasks.map((task) => (
              <ArchivedTaskRow key={task.id} task={task} onPress={() => router.push(`/task-status/${task.id}`)} />
            ))
          ) : (
            <View style={styles.archiveEmptyRow}>
              <Text style={styles.smallMuted}>Archived tasks will appear here after completed work is closed.</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Active Workers</Text>
        <View style={styles.workerPanel}>
          {activeWorkers.length ? (
            activeWorkers.slice(0, 3).map((worker) => (
              <WorkerRow
                key={worker.id}
                name={worker.fullName}
                rating={`${worker.rating || 0} (${worker.completedTasks ?? 0} Jobs)`}
                online={worker.availabilityStatus === "Available"}
              />
            ))
          ) : (
            <Text style={styles.smallMuted}>Registered workers will appear here.</Text>
          )}
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>i</Text>
          <Text style={styles.tipText}>Tip: Jobs with a P500+ rate get accepted faster.</Text>
        </View>
      </ScrollView>
      <BottomNav active="home" router={router} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/post-task")}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function getTotalSpend(tasks: Task[]) {
  return tasks.reduce((total, task) => total + Number(task.wage || 0), 0).toLocaleString("en-PH");
}

function DashboardHeader({ onPostTask, initials }: { onPostTask: () => void; initials: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.menuText}>≡</Text>
        <Text style={styles.brand}>TASKLINK</Text>
      </View>
      <View style={styles.headerRight}>
        <Pressable accessibilityRole="button" onPress={onPostTask} style={styles.headerPostButton}>
          <Text style={styles.headerPostText}>+ Post Task</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>
    </View>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "primary" | "secondary" | "success" }) {
  const color = tone === "secondary" ? palette.secondary : tone === "success" ? palette.success : palette.primary;

  return (
    <View style={styles.statCard}>
      <Text style={styles.smallMuted}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function ClientJobCard({ task, urgent, onPress }: { task: Task; urgent?: boolean; onPress: () => void }) {
  return (
    <View style={[styles.jobCard, { borderLeftColor: urgent ? palette.urgent : palette.success }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.statusChip, urgent ? styles.urgentChip : styles.scheduledChip]}>{urgent ? "URGENT" : "SCHEDULED"}</Text>
        <Text style={styles.priceText}>P{task.wage}</Text>
      </View>
      <Text style={styles.jobTitle}>{task.title}</Text>
      <Text style={styles.smallMuted}>{task.location}</Text>
      <View style={styles.jobFooter}>
        <View style={styles.workerStack}>
          <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>W</Text></View>
          <View style={styles.smallAvatarMuted}><Text style={styles.smallAvatarText}>+2</Text></View>
        </View>
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.detailButton}>
          <Text style={styles.detailButtonText}>Details</Text>
        </Pressable>
      </View>
      <StatusBadge status={task.status} />
    </View>
  );
}

function HistoryRow({
  icon,
  title,
  subtitle,
  amount,
  onPress
}: {
  icon: string;
  title: string;
  subtitle: string;
  amount: string;
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
      <View style={styles.historyLeft}>
        <View style={styles.historyIcon}><Text style={styles.historyIconText}>{icon}</Text></View>
        <View>
          <Text style={styles.historyTitle}>{title}</Text>
          <Text style={styles.smallMuted}>{subtitle}</Text>
        </View>
      </View>
      <Text style={styles.successText}>{amount}</Text>
    </Pressable>
  );
}

function ArchivedTaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
      <View style={styles.historyLeft}>
        <View style={styles.historyIcon}><Text style={styles.historyIconText}>A</Text></View>
        <View>
          <Text style={styles.historyTitle}>{task.title}</Text>
          <Text style={styles.smallMuted}>{task.location}</Text>
        </View>
      </View>
      <Text style={styles.successText}>P{task.wage}</Text>
    </Pressable>
  );
}

function WorkerRow({ name, rating, online }: { name: string; rating: string; online?: boolean }) {
  return (
    <View style={styles.workerRow}>
      <View style={styles.workerLeft}>
        <View style={styles.workerAvatar}>
          <Text style={styles.avatarText}>{name[0]}</Text>
          <View style={[styles.onlineDot, { backgroundColor: online ? palette.success : palette.pending }]} />
        </View>
        <View>
          <Text style={styles.workerName}>{name}</Text>
          <Text style={styles.ratingText}>* {rating}</Text>
        </View>
      </View>
      <Text style={styles.chatButton}>Chat</Text>
    </View>
  );
}

function BottomNav({ active, router }: { active: string; router: ReturnType<typeof useRouter> }) {
  const insets = useSafeAreaInsets();
  const items = [
    { key: "home", label: "Home", route: "/client-dashboard" },
    { key: "jobs", label: "Jobs", route: "/post-task" },
    { key: "chat", label: "Chat", route: "/chat" },
    { key: "profile", label: "Profile", route: "/profile" }
  ];

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
        const selected = item.key === active;
        const color = selected ? "#684000" : palette.muted;
        return (
          <Pressable key={item.key} onPress={() => router.push(item.route as never)} style={[styles.navItem, selected && styles.navItemActive]}>
            <BottomNavIcon name={item.key as "home" | "jobs" | "chat" | "profile"} color={color} />
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuText: { color: palette.primary, fontSize: 24, fontWeight: "800" },
  brand: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "800" },
  headerPostButton: { display: "none" },
  headerPostText: { color: "#684000", fontSize: 14, fontWeight: "800" },
  avatar: {
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
  content: { padding: 16, paddingBottom: 112, gap: 12 },
  heroGrid: { gap: 12 },
  heroPanel: {
    minHeight: 178,
    borderRadius: 12,
    padding: 24,
    backgroundColor: palette.primaryContainer,
    overflow: "hidden",
    flexDirection: "row"
  },
  heroCopy: { flex: 1, justifyContent: "center" },
  heroTitle: { color: "#A3FAEF", fontSize: 20, lineHeight: 28, fontWeight: "800", marginBottom: 8 },
  heroText: { color: "#DFF8F4", fontSize: 16, lineHeight: 24, marginBottom: 20 },
  heroButton: {
    alignSelf: "flex-start",
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.secondaryContainer
  },
  heroButtonText: { color: "#684000", fontWeight: "900", fontSize: 14 },
  heroMark: { position: "absolute", right: 18, top: 24, color: "rgba(255,255,255,0.12)", fontSize: 80, fontWeight: "900" },
  healthCard: { padding: 20, borderRadius: 12, backgroundColor: palette.surface, elevation: 2, gap: 18 },
  healthTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  healthDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.success },
  healthBody: { gap: 10 },
  cardMutedBold: { color: palette.muted, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: palette.surfaceContainer, overflow: "hidden" },
  progressFill: { width: "85%", height: 8, borderRadius: 8, backgroundColor: palette.success },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47.8%", padding: 16, borderRadius: 12, backgroundColor: palette.surfaceLow, borderWidth: 1, borderColor: palette.outlineVariant },
  statValue: { fontSize: 24, lineHeight: 32, fontWeight: "900", marginTop: 4 },
  sectionHeader: { marginTop: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  linkText: { color: palette.primary, fontSize: 14, fontWeight: "800" },
  jobGrid: { gap: 12 },
  jobCard: { padding: 16, borderRadius: 12, borderLeftWidth: 4, backgroundColor: palette.surface, elevation: 2, gap: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusChip: { overflow: "hidden", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "900" },
  urgentChip: { backgroundColor: "#FFDAD6", color: "#93000A" },
  scheduledChip: { backgroundColor: palette.surfaceContainer, color: palette.muted },
  priceText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  jobTitle: { color: palette.text, fontSize: 18, lineHeight: 26, fontWeight: "800" },
  smallMuted: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  smallLabel: { color: palette.text, fontSize: 12, lineHeight: 16 },
  successText: { color: palette.success, fontSize: 12, fontWeight: "900" },
  jobFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.outlineVariant, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workerStack: { flexDirection: "row" },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary, borderWidth: 2, borderColor: palette.white },
  smallAvatarMuted: { width: 32, height: 32, borderRadius: 16, marginLeft: -8, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceContainer, borderWidth: 2, borderColor: palette.white },
  smallAvatarText: { color: palette.white, fontSize: 10, fontWeight: "900" },
  detailButton: { minHeight: 38, borderRadius: 8, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  detailButtonText: { color: palette.white, fontSize: 14, fontWeight: "800" },
  completedPanel: { padding: 20, borderRadius: 12, backgroundColor: palette.surfaceLow, gap: 12 },
  archivedPanel: { padding: 20, borderRadius: 12, backgroundColor: palette.surfaceLow, gap: 12 },
  archivedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  archiveEmptyRow: { padding: 12, borderRadius: 8, backgroundColor: palette.surface },
  panelTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  historyRow: { padding: 12, borderRadius: 8, backgroundColor: palette.surface, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  historyIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.tertiaryContainer },
  historyIconText: { color: "#FFE5DB", fontWeight: "900" },
  historyTitle: { color: palette.text, fontSize: 14, fontWeight: "800" },
  workerPanel: { padding: 16, borderRadius: 12, backgroundColor: palette.surface, elevation: 2 },
  workerRow: { minHeight: 68, borderBottomWidth: 1, borderBottomColor: palette.outlineVariant, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  workerAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceContainer },
  onlineDot: { position: "absolute", right: 1, bottom: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: palette.white },
  workerName: { color: palette.text, fontSize: 14, fontWeight: "800" },
  ratingText: { color: palette.text, fontSize: 10, fontWeight: "800" },
  chatButton: { color: palette.primary, fontSize: 12, fontWeight: "900" },
  tipCard: { padding: 16, borderRadius: 12, backgroundColor: "#FFF8EE", borderWidth: 1, borderColor: "#E7C18C", flexDirection: "row", alignItems: "center", gap: 12 },
  tipIcon: { color: palette.secondary, fontSize: 18, fontWeight: "900" },
  tipText: { color: "#684000", flex: 1, fontSize: 12, lineHeight: 16 },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 72,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surface,
    flexDirection: "row",
    justifyContent: "space-around",
    elevation: 10
  },
  navItem: { minWidth: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navItemActive: { backgroundColor: palette.secondaryContainer },
  navLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  navTextActive: { color: "#684000" },
  fab: { position: "absolute", right: 20, bottom: 88, width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.secondaryContainer, elevation: 12 },
  fabText: { color: "#684000", fontSize: 30, lineHeight: 32, fontWeight: "600" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
