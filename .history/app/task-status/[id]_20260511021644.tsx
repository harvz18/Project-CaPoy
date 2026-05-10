import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "../../src/components/StatusBadge";
import { useApp } from "../../src/context/AppContext";
import { Task, TaskStatus } from "../../src/types";

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
  const { currentUser, tasks, updateTaskStatus } = useApp();
  const task = tasks.find((item) => item.id === id);

  if (!task) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={styles.title}>Task not found</Text>
          <Pressable style={styles.secondaryAction} onPress={() => router.replace("/worker-dashboard")}>
            <Text style={styles.secondaryActionText}>Back to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const action = getPrimaryAction(task.status, currentUser?.role);

  async function handlePrimaryAction() {
    if (!task || !action.nextStatus) {
      return;
    }

    await updateTaskStatus(
      task.id,
      action.nextStatus,
      action.nextStatus === "Applied" && currentUser?.role === "worker" ? currentUser.id : undefined
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 132 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.mapHero}>
          <View style={styles.mapGrid}>
            <View style={styles.mapRoadOne} />
            <View style={styles.mapRoadTwo} />
            <View style={styles.mapPark} />
            <View style={styles.mapPin} />
          </View>
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>{task.status === "Finding Workers" ? "Open" : task.status}</Text>
          </View>
          <View style={styles.locationBadge}>
            <Text style={styles.locationDot}>•</Text>
            <Text style={styles.locationText}>{task.location}</Text>
          </View>
        </View>

        <View style={styles.sheetWrap}>
          <View style={styles.card}>
            <View style={styles.jobHeader}>
              <View style={styles.jobTitleBlock}>
                <Text style={styles.title}>{task.title}</Text>
                <View style={styles.inlineMeta}>
                  <Text style={styles.metaIcon}>⏱</Text>
                  <Text style={styles.metaText}>Estimated {task.estimatedDuration}</Text>
                </View>
              </View>
              <View style={styles.priceBlock}>
                <Text style={styles.price}>P{task.wage}</Text>
                <Text style={styles.rateText}>Fixed Rate</Text>
              </View>
            </View>

            <View style={styles.employerCard}>
              <View style={styles.employerLeft}>
                <View style={styles.employerAvatar}>
                  <Text style={styles.avatarText}>M</Text>
                </View>
                <View>
                  <Text style={styles.employerName}>Mrs. Maria Santos</Text>
                  <Text style={styles.rating}>* 4.9 (24 tasks)</Text>
                </View>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Task Description</Text>
              <Text style={styles.description}>{task.description}</Text>
            </View>

            <View style={styles.detailsGrid}>
              <DetailBox label="Payment Method" value={task.paymentMethod} icon="P" />
              <DetailBox label="Tools Required" value={task.category.toLowerCase().includes("clean") ? "Provided" : "As needed"} icon="T" />
            </View>

            <View style={styles.trustRow}>
              <TrustItem text="Payment Secured" />
              <TrustItem text="Accident Insurance" />
              <TrustItem text="24/7 Support" />
            </View>

            <View style={styles.statusPanel}>
              <Text style={styles.sectionTitle}>Current Status</Text>
              <StatusBadge status={task.status} />
            </View>

            {currentUser?.role !== "client" ? (
              <View style={styles.secondaryRow}>
                <Pressable style={styles.secondaryAction} onPress={() => router.push(`/chat/${task.id}`)}>
                  <Text style={styles.secondaryActionText}>Chat</Text>
                </Pressable>
                <Pressable style={styles.secondaryAction} onPress={() => router.push(`/rating/${task.id}`)}>
                  <Text style={styles.secondaryActionText}>Rate User</Text>
                </Pressable>
              </View>
            ) : null}
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
          <Text style={styles.primaryActionText}>{action.label}</Text>
        </Pressable>
        <Text style={styles.guidelineText}>By clicking, you agree to the TaskLink Community Guidelines.</Text>
      </View>
    </SafeAreaView>
  );
}

function getPrimaryAction(status: TaskStatus, role?: string) {
  if (role === "client" && status === "Applied") {
    return { label: "Accept Application", nextStatus: "Accepted" as TaskStatus, enabled: true };
  }

  if (role === "client" && status === "Pending Approval") {
    return { label: "Confirm Finished", nextStatus: "Finished" as TaskStatus, enabled: true };
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
    return { label: "Waiting for Client", enabled: false };
  }

  if (role === "worker" && status === "Accepted") {
    return { label: "Start Task", nextStatus: "In Progress" as TaskStatus, enabled: true };
  }

  if (role === "worker" && status === "In Progress") {
    return { label: "Mark as Finished", nextStatus: "Pending Approval" as TaskStatus, enabled: true };
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

  return { label: "Status Updated", enabled: false };
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text style={styles.brand}>TASKLINK</Text>
      <View style={styles.userAvatar}>
        <Text style={styles.avatarText}>J</Text>
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
      <Text style={styles.trustCheck}>✓</Text>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  backText: { color: palette.primary, fontSize: 34, lineHeight: 38, fontWeight: "500" },
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
  secondaryRow: { flexDirection: "row", gap: 12 },
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
  primaryActionText: { color: palette.white, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  guidelineText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
