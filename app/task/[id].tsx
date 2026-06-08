import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "../../src/components/StatusBadge";
import { useApp } from "../../src/context/AppContext";

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
  const insets = useSafeAreaInsets();
  const { currentUser, users, getUserById, tasks, acceptTask, updateTaskStatus } = useApp();
  const task = tasks.find((item) => item.id === id);

  if (!task) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <TopBar title="Task" onBack={() => router.back()} />
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
  const applicants = users.filter((user) => applicantIds.includes(user.id));
  const applicantCount = applicantIds.length;
  const hasAcceptedWorker = task.status === "Accepted" && Boolean(task.workerId);
  const worker = getUserById(task.workerId);
  const hasApplied = Boolean(currentUser?.id && task.applicantIds?.includes(currentUser.id));

  async function handleWorkerAccept() {
    const taskId = task?.id;
    if (!taskId) {
      return;
    }
    await acceptTask(taskId);
    router.replace(`/task-status/${taskId}`);
  }

  async function handleClientAcceptWorker(workerId: string) {
    const taskId = task?.id;
    if (!taskId) {
      return;
    }
    await updateTaskStatus(taskId, "Accepted", workerId);
    router.push(`/task-status/${taskId}`);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <TopBar title={isClient ? "Task Details" : "Job Details"} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>{task.category}</Text>
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.description}>{task.description}</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.price}>P{task.wage}</Text>
              <Text style={styles.rateText}>Fixed Rate</Text>
            </View>
          </View>
          <StatusBadge status={task.status} />
        </View>

        <View style={styles.detailsGrid}>
          <DetailBox label="Location" value={task.location} />
          <DetailBox label="Duration" value={task.estimatedDuration} />
          <DetailBox label="Payment" value={task.paymentMethod} />
          <DetailBox label="Applicants" value={hasAcceptedWorker ? "1 accepted" : `${applicantCount} applied`} />
          <DetailBox label="Capability" value={task.requiredCapability ?? task.category} />
          <DetailBox label="Task Radius" value={`${task.geofenceRadius ?? 500} meters`} />
        </View>

        {isClient ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{task.status === "Accepted" ? "Assigned Worker" : "Worker Applications"}</Text>
              <Text style={styles.sectionMeta}>{task.status === "Accepted" ? "Ready to start" : "Review before accepting"}</Text>
            </View>
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
                    <Text style={styles.workerMeta}>* {worker?.rating ?? "-"} • {worker?.completedTasks ?? 0} jobs</Text>
                    <Text style={styles.workerNote}>{worker?.availabilityStatus ?? "Available for this task."}</Text>
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
                      <Text style={styles.workerMeta}>* {applicant.rating ?? "-"} • {applicant.completedTasks ?? 0} jobs</Text>
                      <Text style={styles.workerNote}>{applicant.availabilityStatus ?? "Available for this task."}</Text>
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
                    <Pressable style={styles.primaryButton} onPress={() => handleClientAcceptWorker(applicant.id)}>
                      <Text style={styles.primaryButtonText}>Accept</Text>
                    </Pressable>
                  </View>
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
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ready to take this job?</Text>
            {task.status === "Finding Workers" || task.status === "Applied" ? (
              hasApplied ? (
                <Pressable style={styles.primaryButtonLarge} onPress={() => router.push(`/task-status/${task.id}`)}>
                  <Text style={styles.primaryButtonText}>Open Task Status</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.primaryButtonLarge} onPress={handleWorkerAccept}>
                  <Text style={styles.primaryButtonText}>Apply</Text>
                </Pressable>
              )
            ) : (
              <Pressable style={styles.primaryButtonLarge} onPress={() => router.push(`/task-status/${task.id}`)}>
                <Text style={styles.primaryButtonText}>Open Task Status</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/chat/${task.id}`)}>
            <Text style={styles.secondaryButtonText}>Chat</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/task-status/${task.id}`)}>
            <Text style={styles.secondaryButtonText}>Status</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <Text style={styles.brand}>TASKLINK</Text>
    </View>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    justifyContent: "space-between"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { color: palette.primary, fontSize: 34, lineHeight: 36 },
  headerTitle: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  brand: { color: palette.primary, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  content: { padding: 16, gap: 14 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  heroCard: { padding: 20, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: "rgba(189,201,198,0.35)", gap: 16, elevation: 2 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  flex: { flex: 1 },
  eyebrow: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900", textTransform: "uppercase" },
  title: { color: palette.textStrong, fontSize: 22, lineHeight: 30, fontWeight: "900" },
  description: { color: palette.muted, fontSize: 16, lineHeight: 24, marginTop: 6 },
  priceBlock: { alignItems: "flex-end" },
  price: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  rateText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detailBox: { width: "48.4%", padding: 12, borderRadius: 10, backgroundColor: palette.surfaceLow, borderWidth: 1, borderColor: palette.outlineVariant },
  detailLabel: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  detailValue: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900", marginTop: 4 },
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
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: palette.surfaceContainer, color: palette.muted, fontSize: 12, fontWeight: "800" },
  workerActions: { flexDirection: "row", gap: 10 },
  emptyWorkerState: { padding: 16, borderRadius: 12, backgroundColor: palette.surfaceLow, borderWidth: 1, borderColor: palette.outlineVariant, gap: 4 },
  emptyWorkerTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  emptyWorkerText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  primaryButtonLarge: { minHeight: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  primaryButtonText: { color: palette.white, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center", backgroundColor: palette.surface },
  secondaryButtonText: { color: palette.primary, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  disabledButton: { backgroundColor: palette.surfaceHigh },
});
