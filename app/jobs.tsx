import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "../src/components/BottomNavIcon";
import { StatusBadge } from "../src/components/StatusBadge";
import { useApp } from "../src/context/AppContext";
import { Task, UserProfile } from "../src/types";
import { formatDistance, getTaskDistanceKm, isTaskWithinPreferredRadius } from "../src/utils/location";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceHigh: "#E5E9E7",
  primary: "#005C55",
  secondary: "#855300",
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  white: "#FFFFFF"
};

const filters = ["All Jobs", "Delivery", "Repair", "Cleaning", "Unloading"];

export default function JobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tasks, acceptTask, currentUser } = useApp();
  const postedTasks = tasks
    .filter((task) => task.status === "Finding Workers" || task.status === "Applied")
    .sort((a, b) => Number(isTaskWithinPreferredRadius(currentUser, b)) - Number(isTaskWithinPreferredRadius(currentUser, a)));
  const appliedTasks = tasks.filter(
    (task) =>
      task.applicantIds?.includes(currentUser?.id ?? "") &&
      (task.status === "Applied" || task.workerId === currentUser?.id) &&
      task.status !== "Finished" &&
      task.status !== "Archived"
  );
  const jobs = postedTasks;

  async function handleQuickApply(task: Task) {
    await acceptTask(task.id);
    router.push(`/task-status/${task.id}`);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.brand}>TASKLINK</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{currentUser?.fullName?.[0] ?? "J"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 98 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.mapPanel}>
          <View style={styles.mapGrid}>
            <View style={styles.mapLineHorizontal} />
            <View style={styles.mapLineVertical} />
            <View style={[styles.mapPin, styles.mapPinOne]} />
            <View style={[styles.mapPin, styles.mapPinTwo]} />
            <View style={[styles.mapPin, styles.mapPinThree]} />
          </View>
          <View style={styles.locationBadge}>
            <Text style={styles.locationIcon}>•</Text>
            <View style={styles.locationCopy}>
              <Text style={styles.locationTitle}>Nearby Jobs</Text>
              <Text style={styles.locationText}>Bacolod City opportunities around you</Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((filter, index) => (
            <View key={filter} style={[styles.filterChip, index === 0 && styles.filterChipActive]}>
              <Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>{filter}</Text>
            </View>
          ))}
        </ScrollView>

        {appliedTasks.length ? (
          <View style={styles.applicationSection}>
            <View style={styles.applicationHeader}>
              <Text style={styles.applicationSectionTitle}>Your Applications</Text>
              <Text style={styles.applicationSectionMeta}>{appliedTasks.length} active</Text>
            </View>
            <View style={styles.applicationGrid}>
              {appliedTasks.map((task) => (
                <ApplicationCard key={task.id} task={task} onOpen={() => router.push(`/task-status/${task.id}`)} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.boardHeader}>
          <View>
            <Text style={styles.screenTitle}>Job Board</Text>
            <Text style={styles.screenSubtitle}>{jobs.length} available task{jobs.length === 1 ? "" : "s"}</Text>
          </View>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        </View>

        <View style={styles.jobGrid}>
          {jobs.length ? (
            jobs.map((task, index) => (
              <JobCard
                key={task.id}
                task={task}
                urgent={index === 0 || Number(task.wage) >= 800}
                detail={jobDetails[index % jobDetails.length]}
                currentUser={currentUser}
                onOpen={() => router.push(`/task/${task.id}`)}
                onQuickAccept={() => handleQuickApply(task)}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No nearby jobs</Text>
              <Text style={styles.emptyText}>Open tasks in Bacolod City will appear here.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNav active="jobs" router={router} bottom={insets.bottom} />
    </SafeAreaView>
  );
}

const jobDetails = [
  { distance: "0.8 km away", area: "Lacson St.", load: "Light load" },
  { distance: "2.4 km away", area: "Mansilingan", load: "Tools provided" },
  { distance: "1.2 km away", area: "Bata Subd.", load: "Heavy load" },
  { distance: "3.5 km away", area: "Alijis", load: "Outdoor task" }
];

function JobCard({
  task,
  urgent,
  detail,
  currentUser,
  onOpen,
  onQuickAccept
}: {
  task: Task;
  urgent?: boolean;
  detail: { distance: string; area: string; load: string };
  currentUser: UserProfile | null;
  onOpen: () => void;
  onQuickAccept: () => void;
}) {
  const distance = getTaskDistanceKm(currentUser, task);
  const withinRadius = isTaskWithinPreferredRadius(currentUser, task);
  const capabilities = currentUser?.capabilities ?? currentUser?.skills ?? [];
  const capabilityMatch = !task.requiredCapability || capabilities.includes(task.requiredCapability);

  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.jobCard, pressed && styles.pressed]}>
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
      <Text style={styles.jobDescription} numberOfLines={2}>{task.description}</Text>
      <View style={styles.matchRow}>
        <Text style={styles.matchChip}>{formatDistance(distance)}</Text>
        <Text style={[styles.matchChip, withinRadius ? styles.matchChipGood : styles.matchChipWarn]}>
          {withinRadius ? "Within service area" : "Outside preferred radius"}
        </Text>
        <Text style={[styles.matchChip, capabilityMatch ? styles.matchChipGood : styles.matchChipWarn]}>
          {capabilityMatch ? "Capability match" : `Needs ${task.requiredCapability ?? "capability"}`}
        </Text>
      </View>
      <View style={styles.jobInfoRow}>
        <Text style={styles.jobInfo}>{task.estimatedDuration}</Text>
        <Text style={styles.jobInfo}>{detail.load}</Text>
      </View>
      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" onPress={onOpen} style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>Details</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onQuickAccept} style={styles.quickButton}>
          <Text style={styles.quickButtonText}>Quick Apply</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function ApplicationCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.applicationCard, pressed && styles.pressed]}>
      <View style={styles.applicationCopy}>
        <Text style={styles.applicationTitle}>{task.title}</Text>
        <Text style={styles.applicationMeta}>{getApplicationMessage(task.status)}</Text>
      </View>
      <View style={styles.applicationFooter}>
        <StatusBadge status={task.status} />
        <Text style={styles.applicationAction}>Open</Text>
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

  if (status === "Pending Approval") {
    return "Waiting for client completion approval.";
  }

  return "Track this task status.";
}

function BottomNav({ active, router, bottom }: { active: string; router: ReturnType<typeof useRouter>; bottom: number }) {
  const items = [
    { key: "home", label: "Home", route: "/worker-dashboard" },
    { key: "jobs", label: "Jobs", route: "/jobs" },
    { key: "chat", label: "Chat", route: "/chat" },
    { key: "profile", label: "Profile", route: "/profile" }
  ] as const;

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(bottom, 10) }]}>
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
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: "#EDF1EF" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { color: palette.primary, fontSize: 34, lineHeight: 36 },
  brand: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.secondaryContainer, borderWidth: 1, borderColor: palette.outlineVariant },
  avatarText: { color: "#684000", fontWeight: "900" },
  content: { paddingBottom: 104 },
  mapPanel: { height: 208, overflow: "hidden", backgroundColor: "#DDEDEA", elevation: 2 },
  mapGrid: { flex: 1, backgroundColor: "#E7F3F0" },
  mapLineHorizontal: { position: "absolute", left: -20, right: -20, top: 92, height: 18, backgroundColor: "#C8DBD7", transform: [{ rotate: "-10deg" }] },
  mapLineVertical: { position: "absolute", top: -20, bottom: -20, left: "56%", width: 20, backgroundColor: "#D6C29E", transform: [{ rotate: "18deg" }] },
  mapPin: { position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: palette.secondary, borderWidth: 3, borderColor: palette.white },
  mapPinOne: { left: "24%", top: 58 },
  mapPinTwo: { left: "62%", top: 84, backgroundColor: palette.primary },
  mapPinThree: { left: "46%", top: 138 },
  locationBadge: { position: "absolute", left: 16, bottom: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  locationIcon: { color: palette.primary, fontSize: 22, fontWeight: "900" },
  locationCopy: { gap: 1 },
  locationTitle: { color: palette.text, fontSize: 14, fontWeight: "900" },
  locationText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  filterChip: { minHeight: 40, borderRadius: 20, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceHigh },
  filterChipActive: { backgroundColor: palette.primary },
  filterText: { color: palette.muted, fontSize: 14, fontWeight: "800" },
  filterTextActive: { color: palette.white },
  boardHeader: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  applicationSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  applicationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  applicationSectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  applicationSectionMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  applicationGrid: { gap: 10 },
  applicationCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(189,201,198,0.45)", backgroundColor: palette.surface, gap: 12 },
  applicationCopy: { gap: 4 },
  applicationTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  applicationMeta: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  applicationFooter: { paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(189,201,198,0.45)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  applicationAction: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  screenTitle: { color: palette.textStrong, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  screenSubtitle: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  liveBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#EAF8F1" },
  liveBadgeText: { color: "#0B7A52", fontSize: 12, fontWeight: "900" },
  jobGrid: { paddingHorizontal: 16, gap: 12 },
  jobCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, elevation: 2, gap: 12 },
  urgentBadge: { position: "absolute", left: 16, top: 16, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: palette.secondaryContainer },
  urgentText: { color: "#684000", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  priceRow: { alignItems: "flex-end" },
  price: { color: palette.primary, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  jobTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  jobMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  jobDescription: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  matchRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  matchChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: palette.surfaceHigh, color: palette.muted, fontSize: 11, lineHeight: 14, fontWeight: "900" },
  matchChipGood: { backgroundColor: "#EAF8F1", color: "#0B7A52" },
  matchChipWarn: { backgroundColor: "#FFF8EE", color: "#684000" },
  jobInfoRow: { paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(189,201,198,0.45)", flexDirection: "row", gap: 16 },
  jobInfo: { color: palette.outline, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 10 },
  detailsButton: { flex: 1, minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center", backgroundColor: palette.surface },
  detailsButtonText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  quickButton: { flex: 1.3, minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  quickButtonText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  emptyCard: { padding: 24, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: "center", gap: 8 },
  emptyTitle: { color: palette.textStrong, fontSize: 18, lineHeight: 26, fontWeight: "900" },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 72, paddingHorizontal: 8, paddingTop: 8, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderTopWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, flexDirection: "row", justifyContent: "space-around", elevation: 10 },
  navItem: { minWidth: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  navItemActive: { backgroundColor: palette.secondaryContainer },
  navLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  navTextActive: { color: "#684000" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
