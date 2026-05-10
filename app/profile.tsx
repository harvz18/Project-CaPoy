import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "../src/components/StatusBadge";
import { useApp } from "../src/context/AppContext";

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
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  danger: "#BA1A1A",
  white: "#FFFFFF"
};

const skillOptions = ["Cleaning", "Delivery", "Unloading", "Transfer"];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, logout, setRole } = useApp();
  const [fullName, setFullName] = useState(currentUser?.fullName ?? "Prototype User");
  const [mobileNumber, setMobileNumber] = useState(currentUser?.mobileNumber ?? "09170000000");
  const [address, setAddress] = useState(currentUser?.address ?? "Bacolod City");
  const [bio, setBio] = useState(
    currentUser?.role === "client"
      ? currentUser?.businessName ?? "Reliable client looking for trusted local help."
      : "Professional local worker available for nearby tasks."
  );
  const [skills, setSkills] = useState(currentUser?.skills?.length ? currentUser.skills : ["Cleaning", "Delivery"]);
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false);
  const [jobRadius, setJobRadius] = useState("Nearby barangays");
  const [taskBudget, setTaskBudget] = useState("P300 - P800");

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  function toggleSkill(skill: string) {
    setSkills((items) => (items.includes(skill) ? items.filter((item) => item !== skill) : [...items, skill]));
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
          <Text style={styles.avatarText}>{fullName[0] ?? "U"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.photoWrap}>
              <View style={styles.profilePhoto}>
                <Text style={styles.profilePhotoText}>{fullName[0] ?? "U"}</Text>
              </View>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{fullName}</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.star}>*</Text>
                <Text style={styles.ratingValue}>{currentUser?.rating ?? 4.9}</Text>
                <Text style={styles.reviewCount}>(210 reviews)</Text>
              </View>
              <Text style={styles.bio}>{bio}</Text>
              {currentUser?.role === "worker" ? <StatusBadge status={currentUser.availabilityStatus ?? "Available"} /> : null}
              <View style={styles.statsGrid}>
                <StatBox label={currentUser?.role === "client" ? "Tasks Posted" : "Jobs Completed"} value={currentUser?.role === "client" ? "18" : "124"} />
                <StatBox label="Member since" value="2023" />
              </View>
            </View>
          </View>
        </View>

        <SettingsCard title="Edit Profile">
          <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Full name" />
          <Field label="Mobile Number" value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" placeholder="Mobile number" />
          <Field label="Address / Barangay" value={address} onChangeText={setAddress} placeholder="Address or barangay" />
          <Field label={currentUser?.role === "client" ? "Business Bio" : "Worker Bio"} value={bio} onChangeText={setBio} placeholder="Tell people about yourself" multiline />
        </SettingsCard>

        {currentUser?.role === "worker" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills & Specialties</Text>
            <View style={styles.skillRow}>
              {skills.map((skill) => (
                <Pressable key={skill} onPress={() => toggleSkill(skill)} style={styles.skillChip}>
                  <Text style={styles.skillText}>{skill} x</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setSkillDropdownOpen(true)} style={styles.dropdownButton}>
              <Text style={styles.dropdownText}>Add or remove skills</Text>
              <Text style={styles.dropdownIcon}>v</Text>
            </Pressable>
          </View>
        ) : (
          <SettingsCard title="Client Preferences">
            <Field label="Preferred Job Radius" value={jobRadius} onChangeText={setJobRadius} placeholder="Preferred area" />
            <Field label="Typical Task Budget" value={taskBudget} onChangeText={setTaskBudget} placeholder="Budget range" />
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Switch to worker mode</Text>
                <Text style={styles.settingText}>Use TaskLink to browse and accept nearby jobs.</Text>
              </View>
              <Pressable onPress={() => setRole("worker")} style={styles.outlineButton}>
                <Text style={styles.outlineButtonText}>Switch</Text>
              </Pressable>
            </View>
          </SettingsCard>
        )}

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
            <Text style={styles.coverageTitle}>{currentUser?.role === "client" ? "Preferred Service Area" : "Service Coverage"}</Text>
          </View>
          <View style={styles.coverageMap}>
            <View style={styles.mapRoadOne} />
            <View style={styles.mapRoadTwo} />
            <View style={styles.coverageBadge}>
              <Text style={styles.coverageBadgeText}>{address}</Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <Modal animationType="fade" transparent visible={skillDropdownOpen} onRequestClose={() => setSkillDropdownOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSkillDropdownOpen(false)}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownTitle}>Worker Skills</Text>
            {skillOptions.map((skill) => {
              const selected = skills.includes(skill);
              return (
                <Pressable key={skill} onPress={() => toggleSkill(skill)} style={styles.dropdownOption}>
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionSelected]}>
                    {selected ? "✓ " : ""}{skill}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingsCard}>
      <Text style={styles.settingsTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.outline}
        style={[styles.input, multiline && styles.textArea]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
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
  settingsCard: { padding: 16, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant, gap: 12 },
  settingsTitle: { color: palette.textStrong, fontSize: 18, lineHeight: 26, fontWeight: "900" },
  field: { gap: 6 },
  fieldLabel: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  input: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, color: palette.text, fontSize: 16, paddingHorizontal: 14 },
  textArea: { minHeight: 96, paddingTop: 12 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  viewAll: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: palette.primaryContainer, borderWidth: 1, borderColor: "rgba(0,92,85,0.2)" },
  skillText: { color: "#A3FAEF", fontSize: 14, lineHeight: 20, fontWeight: "900" },
  dropdownButton: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  dropdownText: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  dropdownIcon: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  settingCopy: { flex: 1 },
  settingTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  settingText: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  outlineButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  outlineButtonText: { color: palette.primary, fontWeight: "900" },
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
  saveButton: { minHeight: 48, borderRadius: 10, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  saveButtonText: { color: palette.white, fontSize: 14, fontWeight: "900" },
  logoutButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: "#FFDAD6", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF7F6" },
  logoutText: { color: palette.danger, fontSize: 14, fontWeight: "900" },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(24,28,28,0.32)", alignItems: "center", justifyContent: "center" },
  dropdownMenu: { width: "100%", maxWidth: 420, borderRadius: 12, padding: 12, backgroundColor: palette.surface },
  dropdownTitle: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 8 },
  dropdownOption: { minHeight: 48, borderRadius: 8, justifyContent: "center", paddingHorizontal: 12 },
  dropdownOptionText: { color: palette.muted, fontSize: 16, lineHeight: 24, fontWeight: "700" },
  dropdownOptionSelected: { color: palette.primary, fontWeight: "900" }
});
