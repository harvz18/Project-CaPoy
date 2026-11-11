import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { MotionPressable as Pressable } from "../src/components/MotionPressable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedBottomNav } from "../src/components/AnimatedBottomNav";
import { HelpShortcut } from "../src/components/HelpShortcut";
import { NotificationShortcut } from "../src/components/NotificationShortcut";
import { StatusBadge } from "../src/components/StatusBadge";
import { StoredImage } from "../src/components/StoredImage";
import { useApp } from "../src/context/AppContext";
import { useMotionLayout } from "../src/hooks/useMotionLayout";
import { formatTaskPrice, getScheduleBasedAvailability } from "../src/domain/taskMarketplace";
import { screenPalette } from "../src/theme";
import { Task } from "../src/types";
import { typography } from "../src/typography";
import { AppText as Text } from "../src/components/AppText";

const palette = screenPalette;

export default function ClientDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prepareLayout = useMotionLayout();
  const { currentUser, notifications, tasks, users } = useApp();
  const [showAllOngoing, setShowAllOngoing] = useState(false);
  const clientTasks = tasks.filter((task) => task.clientId === currentUser?.id);
  const activeClientTasks = clientTasks.filter((task) => ["Finding Workers", "Applied", "Accepted", "In Progress", "Pending Approval", "Disputed"].includes(task.status));
  const finishedCount = clientTasks.filter((task) => task.status === "Finished").length;
  const finishedTasks = clientTasks.filter((task) => task.status === "Finished");
  const archivedTasks = clientTasks.filter((task) => task.status === "Archived");
  const registeredWorkers = users.filter((user) => user.role === "worker");
  const availableWorkers = registeredWorkers.filter((user) => getScheduleBasedAvailability(tasks, user.id) === "Available");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <DashboardHeader
        initials={currentUser?.fullName?.[0] ?? "U"}
        onHelp={() => router.push("/help")}
        onNotifications={() => router.push("/notifications")}
        onProfile={() => router.push("/profile")}
        profilePhotoUrl={currentUser?.profilePhotoUrl}
        onPostTask={() => router.push("/post-task")}
        unreadCount={notifications.filter((notification) => notification.userId === currentUser?.id && !notification.readStatus).length}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroGrid}>
          <View style={styles.heroPanel}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Welcome back, {currentUser?.fullName?.split(" ")[0] ?? "there"}!</Text>
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
          </View>

        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Ongoing Jobs" value={String(activeClientTasks.length).padStart(2, "0")} tone="primary" />
          <StatCard label="Available Workers" value={String(availableWorkers.length).padStart(2, "0")} tone="secondary" />
          <StatCard label="Completed" value={String(finishedCount).padStart(2, "0")} tone="success" />
          <StatCard label="Verified Work Total" value={`P${getVerifiedWorkTotal(clientTasks)}`} tone="primary" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ongoing Jobs</Text>
          {activeClientTasks.length > 2 ? (
            <Pressable accessibilityRole="button" onPress={() => { prepareLayout(); setShowAllOngoing((value) => !value); }}>
              <Text style={styles.linkText}>{showAllOngoing ? "Show Less" : "View All"}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.jobGrid}>
          {activeClientTasks.length ? (
            activeClientTasks.slice(0, showAllOngoing ? undefined : 2).map((task) => (
              <ClientJobCard key={task.id} task={task} onPress={() => router.push(`/task/${task.id}`)} />
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
                amount={formatTaskPrice(task)}
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

        <Text style={styles.sectionTitle}>Available Workers</Text>
        <View style={styles.workerPanel}>
          {availableWorkers.length ? (
            availableWorkers.slice(0, 3).map((worker) => (
              <WorkerRow
                key={worker.id}
                name={worker.fullName}
                rating={worker.rating > 0 ? `${worker.rating.toFixed(1)} rating · ${worker.completedTasks ?? 0} jobs` : `Not rated · ${worker.completedTasks ?? 0} jobs`}
              />
            ))
          ) : (
            <Text style={styles.smallMuted}>No workers are currently marked available.</Text>
          )}
        </View>
      </ScrollView>
      <AnimatedBottomNav active="home" role={currentUser?.role} />
      <Pressable
        accessibilityLabel="Post a task"
        accessibilityRole="button"
        onPress={() => router.push("/post-task")}
        style={({ pressed }) => [styles.fab, { bottom: 80 + Math.max(insets.bottom, 10) }, pressed && styles.pressed]}
      >
        <Text style={styles.fabText}>Post</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function getVerifiedWorkTotal(tasks: Task[]) {
  return tasks
    .filter((task) => ["Finished", "Archived"].includes(task.status) && task.paymentStatus === "Verified")
    .reduce((total, task) => total + Number(task.agreedAmount || task.wage || 0), 0)
    .toLocaleString("en-PH");
}

function DashboardHeader({ onPostTask, onHelp, onNotifications, onProfile, initials, profilePhotoUrl, unreadCount }: {
  onPostTask: () => void;
  onHelp: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  initials: string;
  profilePhotoUrl?: string;
  unreadCount: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.brand}>TASKLINK</Text>
      </View>
      <View style={styles.headerRight}>
        <Pressable accessibilityRole="button" onPress={onPostTask} style={styles.headerPostButton}>
          <Text style={styles.headerPostText}>Post Task</Text>
        </Pressable>
        <HelpShortcut onPress={onHelp} />
        <NotificationShortcut onPress={onNotifications} unreadCount={unreadCount} />
        <Pressable accessibilityLabel="Open employer profile" accessibilityRole="button" onPress={onProfile} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
          <StoredImage accessibilityLabel="Employer profile photo" sourceUri={profilePhotoUrl} style={styles.avatarImage} fallback={<Text style={styles.avatarText}>{initials}</Text>} />
        </Pressable>
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

function ClientJobCard({ task, onPress }: { task: Task; onPress: () => void }) {
  return (
    <View style={[styles.jobCard, { borderLeftColor: palette.primary }]}>
      <View style={styles.rowBetween}>
        <StatusBadge status={task.status} />
        <Text style={styles.priceText}>{formatTaskPrice(task)}</Text>
      </View>
      <Text style={styles.jobTitle}>{task.title}</Text>
      <Text style={styles.smallMuted}>{task.location}</Text>
      <View style={styles.jobFooter}>
        <Text style={styles.smallMuted}>{task.applicantIds?.length ?? 0} applicant{task.applicantIds?.length === 1 ? "" : "s"}</Text>
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.detailButton}>
          <Text style={styles.detailButtonText}>Details</Text>
        </Pressable>
      </View>
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
      <Text style={styles.successText}>{formatTaskPrice(task)}</Text>
    </Pressable>
  );
}

function WorkerRow({ name, rating }: { name: string; rating: string }) {
  return (
    <View style={styles.workerRow}>
      <View style={styles.workerLeft}>
        <View style={styles.workerAvatar}>
          <Text style={styles.avatarText}>{name[0]}</Text>
          <View style={[styles.onlineDot, { backgroundColor: palette.success }]} />
        </View>
        <View>
          <Text style={styles.workerName}>{name}</Text>
          <Text style={styles.ratingText}>{rating}</Text>
        </View>
      </View>
      <Text style={styles.availableText}>Available</Text>
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
    borderBottomColor: "rgba(207, 249, 255, 0.20)"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuText: { ...typography.bodyMedium, color: palette.primary },
  brand: { ...typography.screenTitle, color: palette.primary },
  headerPostButton: { display: "none" },
  headerPostText: { ...typography.bodyMedium, color: "#F4C95D" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.secondaryContainer,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.outlineVariant
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { ...typography.bodyMedium, color: "#F4C95D" },
  content: { padding: 16, gap: 12 },
  heroGrid: { gap: 12 },
  heroPanel: {
    minHeight: 178,
    borderRadius: 24,
    padding: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    overflow: "hidden",
    elevation: 5
  },
  heroCopy: { flex: 1, justifyContent: "center" },
  heroTitle: { ...typography.screenTitle, color: palette.textStrong, marginBottom: 8 },
  heroText: { ...typography.cardTitle, color: palette.muted, marginBottom: 20 },
  heroButton: {
    alignSelf: "flex-start",
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
    borderWidth: 1,
    borderColor: palette.primaryFixed
  },
  heroButtonText: { ...typography.button, color: palette.white },
  healthCard: { padding: 20, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant, elevation: 2, gap: 18 },
  healthTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  healthDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.success },
  healthBody: { gap: 10 },
  cardMutedBold: { ...typography.body, color: palette.muted },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: palette.surfaceContainer, overflow: "hidden" },
  progressFill: { width: "85%", height: 8, borderRadius: 8, backgroundColor: palette.success },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47.8%", minHeight: 116, padding: 16, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant, justifyContent: "center" },
  statValue: { ...typography.heroNumber, marginTop: 4 },
  sectionHeader: { marginTop: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { ...typography.sectionTitle, color: palette.text },
  linkText: { ...typography.button, color: palette.primary },
  jobGrid: { gap: 12 },
  jobCard: { padding: 18, borderRadius: 20, borderWidth: 1, borderLeftWidth: 4, borderColor: palette.outlineVariant, backgroundColor: palette.surface, elevation: 2, gap: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusChip: { ...typography.badge, overflow: "hidden", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  urgentChip: { backgroundColor: "rgba(255, 125, 140, 0.16)", color: "#FF7D8C" },
  scheduledChip: { backgroundColor: palette.surfaceContainer, color: palette.muted },
  priceText: { ...typography.price, color: palette.primary },
  jobTitle: { ...typography.cardTitleStrong, color: palette.text },
  smallMuted: { ...typography.metadata, color: palette.muted },
  smallLabel: { ...typography.fieldLabel, color: palette.text },
  successText: { ...typography.badge, color: palette.success },
  jobFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.outlineVariant, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workerStack: { flexDirection: "row" },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary, borderWidth: 2, borderColor: palette.white },
  smallAvatarMuted: { width: 32, height: 32, borderRadius: 16, marginLeft: -8, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceContainer, borderWidth: 2, borderColor: palette.white },
  smallAvatarText: { ...typography.overline, color: palette.white },
  detailButton: { minHeight: 38, borderRadius: 8, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  detailButtonText: { ...typography.button, color: palette.white },
  completedPanel: { padding: 20, borderRadius: 12, backgroundColor: palette.surfaceLow, gap: 12 },
  archivedPanel: { padding: 20, borderRadius: 12, backgroundColor: palette.surfaceLow, gap: 12 },
  archivedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  archiveEmptyRow: { padding: 12, borderRadius: 8, backgroundColor: palette.surface },
  panelTitle: { ...typography.cardTitleStrong, color: palette.text },
  historyRow: { padding: 12, borderRadius: 8, backgroundColor: palette.surface, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  historyIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.tertiaryContainer },
  historyIconText: { ...typography.bodyMedium, color: palette.danger },
  historyTitle: { ...typography.cardTitleStrong, color: palette.text },
  workerPanel: { padding: 16, borderRadius: 12, backgroundColor: palette.surface, elevation: 2 },
  workerRow: { minHeight: 68, borderBottomWidth: 1, borderBottomColor: palette.outlineVariant, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  workerAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceContainer },
  onlineDot: { position: "absolute", right: 1, bottom: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: palette.white },
  workerName: { ...typography.cardTitleStrong, color: palette.text },
  ratingText: { ...typography.overline, color: palette.text },
  availableText: { ...typography.badge, color: palette.success },
  tipCard: { padding: 16, borderRadius: 12, backgroundColor: "rgba(244, 201, 93, 0.16)", borderWidth: 1, borderColor: palette.warning, flexDirection: "row", alignItems: "center", gap: 12 },
  tipIcon: { ...typography.sectionTitleSmall, color: palette.secondary },
  tipText: { ...typography.metadata, color: "#F4C95D", flex: 1 },
  fab: { position: "absolute", right: 20, minWidth: 64, height: 56, paddingHorizontal: 12, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary, borderWidth: 1, borderColor: palette.primaryFixed, elevation: 12 },
  fabText: { ...typography.button, color: palette.white },
  pressed: { opacity: 0.78 }
});
