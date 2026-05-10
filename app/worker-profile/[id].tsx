import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "../../src/components/StatusBadge";
import { useApp } from "../../src/context/AppContext";
import { mockUsers } from "../../src/data/mockData";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  surfaceHigh: "#E5E9E7",
  primary: "#005C55",
  primaryFixed: "#9CF2E8",
  primaryContainer: "#0F766E",
  secondary: "#855300",
  secondaryFixed: "#FFDDB8",
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  white: "#FFFFFF"
};

export default function WorkerPublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, taskId } = useLocalSearchParams<{ id: string; taskId?: string }>();
  const { updateTaskStatus } = useApp();
  const worker = mockUsers.find((user) => user.id === id) ?? mockUsers.find((user) => user.role === "worker");
  const skills = worker?.skills?.length ? worker.skills : ["Aircon Cleaning", "Plumbing", "Electrical", "Handyman"];
  const name = worker?.fullName ?? "Juan Dela Cruz";

  async function handleAcceptWorker() {
    if (!taskId || !worker) {
      return;
    }
    await updateTaskStatus(taskId, "Accepted", worker.id);
    router.replace(`/task-status/${taskId}`);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.brand}>TASKLINK</Text>
        </View>
        <View style={styles.smallAvatar}>
          <Text style={styles.avatarText}>{name[0]}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 118 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.photoWrap}>
              <View style={styles.profilePhoto}>
                <Text style={styles.profilePhotoText}>{name[0]}</Text>
              </View>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{name}</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.star}>*</Text>
                <Text style={styles.ratingValue}>{worker?.rating ?? 4.9}</Text>
                <Text style={styles.reviewCount}>(210 reviews)</Text>
              </View>
              <Text style={styles.bio}>
                Professional multi-skilled worker with strong experience in local maintenance and service tasks.
              </Text>
              <StatusBadge status={worker?.availabilityStatus ?? "Available"} />
              <View style={styles.statsGrid}>
                <StatBox label="Jobs Completed" value="124" />
                <StatBox label="Member since" value="2023" />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills & Specialties</Text>
          <View style={styles.skillRow}>
            {skills.map((skill, index) => (
              <View key={`${skill}-${index}`} style={[styles.skillChip, index > 2 && styles.skillChipMuted]}>
                <Text style={[styles.skillText, index > 2 && styles.skillTextMuted]}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
            <Text style={styles.viewAll}>View All</Text>
          </View>
          <ReviewCard initials="MA" name="Maria Santos" date="2 days ago" stars={5} text="Very professional and arrived on time. The work was done quickly and cleanly. Highly recommended." />
          <ReviewCard initials="RP" name="Ricardo Pangilinan" date="1 week ago" stars={4} text="Excellent service. Very thorough, respectful, and easy to coordinate with." />
        </View>

        <View style={styles.coverageCard}>
          <View style={styles.coverageHeader}>
            <Text style={styles.coverageIcon}>•</Text>
            <Text style={styles.coverageTitle}>Service Coverage</Text>
          </View>
          <View style={styles.coverageMap}>
            <View style={styles.mapRoadOne} />
            <View style={styles.mapRoadTwo} />
            <View style={styles.coverageBadge}>
              <Text style={styles.coverageBadgeText}>{worker?.address ?? "Bacolod City"}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable style={styles.messageButton} onPress={() => router.push(`/chat/${taskId ?? "task-1"}`)}>
          <Text style={styles.messageButtonText}>Message</Text>
        </Pressable>
        <Pressable disabled={!taskId} style={[styles.hireButton, !taskId && styles.hireButtonDisabled]} onPress={handleAcceptWorker}>
          <Text style={styles.hireButtonText}>{taskId ? "Accept Worker" : "No Task Selected"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ReviewCard({ initials, name, date, stars, text }: { initials: string; name: string; date: string; stars: number; text: string }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        <View style={styles.reviewPerson}>
          <View style={styles.reviewAvatar}>
            <Text style={styles.reviewAvatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.reviewName}>{name}</Text>
            <Text style={styles.reviewDate}>{date}</Text>
          </View>
        </View>
        <Text style={styles.reviewStars}>{"*".repeat(stars)}</Text>
      </View>
      <Text style={styles.reviewText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: "#EDF1EF" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { color: palette.text, fontSize: 34, lineHeight: 36 },
  brand: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.surfaceHigh, alignItems: "center", justifyContent: "center" },
  avatarText: { color: palette.secondary, fontWeight: "900" },
  content: { padding: 16, paddingTop: 24, gap: 16 },
  profileCard: { padding: 24, borderRadius: 12, borderWidth: 1, borderColor: "rgba(189,201,198,0.35)", backgroundColor: palette.surface, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  profileHeader: { alignItems: "center", gap: 20 },
  photoWrap: { position: "relative" },
  profilePhoto: { width: 132, height: 132, borderRadius: 66, borderWidth: 4, borderColor: palette.primaryFixed, backgroundColor: palette.secondaryContainer, alignItems: "center", justifyContent: "center" },
  profilePhotoText: { color: "#684000", fontSize: 42, fontWeight: "900" },
  verifiedPill: { position: "absolute", right: -4, bottom: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: palette.success },
  verifiedText: { color: palette.white, fontSize: 10, fontWeight: "900" },
  profileCopy: { width: "100%", alignItems: "center", gap: 8 },
  profileName: { color: palette.textStrong, fontSize: 24, lineHeight: 32, fontWeight: "900", textAlign: "center" },
  ratingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  star: { color: palette.secondary, fontSize: 18, fontWeight: "900" },
  ratingValue: { color: palette.secondary, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  reviewCount: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  bio: { color: palette.muted, fontSize: 16, lineHeight: 24, textAlign: "center" },
  statsGrid: { flexDirection: "row", gap: 12, width: "100%", paddingTop: 8 },
  statBox: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: palette.surfaceContainer, alignItems: "center" },
  statLabel: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  statValue: { color: palette.primary, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  viewAll: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: palette.primaryContainer, borderWidth: 1, borderColor: "rgba(0,92,85,0.2)" },
  skillChipMuted: { backgroundColor: palette.surfaceHigh, borderColor: palette.surfaceHigh },
  skillText: { color: "#A3FAEF", fontSize: 14, lineHeight: 20, fontWeight: "900" },
  skillTextMuted: { color: palette.muted },
  reviewCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(189,201,198,0.35)", backgroundColor: palette.surface, gap: 10 },
  reviewTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  reviewPerson: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.secondaryFixed, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { color: "#2A1700", fontWeight: "900" },
  reviewName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  reviewDate: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  reviewStars: { color: palette.secondary, fontSize: 14, fontWeight: "900" },
  reviewText: { color: palette.muted, fontSize: 16, lineHeight: 24 },
  coverageCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(189,201,198,0.35)", backgroundColor: palette.surfaceLow, gap: 12 },
  coverageHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  coverageIcon: { color: palette.primary, fontSize: 24, fontWeight: "900" },
  coverageTitle: { color: palette.textStrong, fontSize: 14, lineHeight: 20, fontWeight: "900", textTransform: "uppercase" },
  coverageMap: { height: 128, borderRadius: 8, backgroundColor: "#E5F1EE", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  mapRoadOne: { position: "absolute", left: -18, right: -18, top: 58, height: 14, backgroundColor: "#C8DBD7", transform: [{ rotate: "-12deg" }] },
  mapRoadTwo: { position: "absolute", top: -12, bottom: -12, left: "58%", width: 16, backgroundColor: "#D6C29E", transform: [{ rotate: "18deg" }] },
  coverageBadge: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: palette.surface },
  coverageBadgeText: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  bottomAction: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.outlineVariant, backgroundColor: palette.surface, flexDirection: "row", gap: 12, elevation: 12 },
  messageButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceHigh },
  messageButtonText: { color: palette.text, fontSize: 14, fontWeight: "900" },
  hireButton: { flex: 2, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  hireButtonDisabled: { backgroundColor: palette.surfaceHigh },
  hireButtonText: { color: palette.white, fontSize: 14, fontWeight: "900" }
});
