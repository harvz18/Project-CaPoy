import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "../src/components/BottomNavIcon";
import { StatusBadge } from "../src/components/StatusBadge";
import { workerCapabilities } from "../src/constants/capabilities";
import { useApp } from "../src/context/AppContext";
import { parseCoordinate } from "../src/utils/location";

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

const skillOptions = workerCapabilities;
const workerAreaPresets = [
  { label: "Downtown", address: "Downtown Bacolod", latitude: "10.6765", longitude: "122.9509" },
  { label: "Mandalagan", address: "Barangay Mandalagan", latitude: "10.7012", longitude: "122.9663" },
  { label: "Alijis", address: "Barangay Alijis", latitude: "10.6426", longitude: "122.9338" },
  { label: "Taculing", address: "Barangay Taculing", latitude: "10.6556", longitude: "122.9557" }
];
const workerRadiusOptions = [
  { label: "Nearby", value: "2", helper: "Best for quick nearby tasks" },
  { label: "Barangay", value: "5", helper: "Covers nearby barangays" },
  { label: "City-wide", value: "10", helper: "Shows more Bacolod tasks" }
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { actionLoading, currentUser, error, logout, ratings, users, updateProfile } = useApp();
  const [fullName, setFullName] = useState(currentUser?.fullName ?? "TaskLink User");
  const [mobileNumber, setMobileNumber] = useState(currentUser?.mobileNumber ?? "09170000000");
  const [address, setAddress] = useState(currentUser?.address ?? "Bacolod City");
  const [bio, setBio] = useState(
    currentUser?.role === "client"
      ? currentUser?.businessName ?? "Reliable client looking for trusted local help."
      : "Professional local worker available for nearby tasks."
  );
  const [skills, setSkills] = useState(currentUser?.skills?.length ? currentUser.skills : ["Cleaning", "Delivery"]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(currentUser?.profilePhotoUrl ?? "");
  const [experienceDescription, setExperienceDescription] = useState(currentUser?.experienceDescription ?? "");
  const [yearsOfExperience, setYearsOfExperience] = useState(currentUser?.yearsOfExperience ?? "");
  const [validIdType, setValidIdType] = useState(currentUser?.validIdType ?? "");
  const [validIdUrl, setValidIdUrl] = useState(currentUser?.validIdUrl ?? "");
  const [medicalCertificateUrl, setMedicalCertificateUrl] = useState(currentUser?.medicalCertificateUrl ?? "");
  const [availability, setAvailability] = useState(currentUser?.availability ?? currentUser?.availabilityStatus ?? "Available");
  const [currentLatitude, setCurrentLatitude] = useState(String(currentUser?.currentLatitude ?? 10.6765));
  const [currentLongitude, setCurrentLongitude] = useState(String(currentUser?.currentLongitude ?? 122.9509));
  const [preferredRadiusKm, setPreferredRadiusKm] = useState(String(currentUser?.preferredRadiusKm ?? 5));
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false);
  const profileRatings = ratings
    .filter((rating) => rating.targetUserId === currentUser?.id)
    .slice(0, 2)
    .map((rating) => ({
      ...rating,
      reviewerName: users.find((user) => user.id === rating.reviewerId)?.fullName ?? "TaskLink User"
    }));
  const averageRating = profileRatings.length
    ? (profileRatings.reduce((total, rating) => total + rating.score, 0) / profileRatings.length).toFixed(1)
    : (currentUser?.rating ?? 4.9).toFixed(1);
  const reviewCountLabel = profileRatings.length ? `${profileRatings.length} reviews` : "No reviews yet";
  const selectedWorkerArea =
    workerAreaPresets.find((area) => area.latitude === currentLatitude && area.longitude === currentLongitude) ??
    workerAreaPresets[0];
  const workerRadiusScale = getWorkerRadiusScale(preferredRadiusKm);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  async function handleSave() {
    try {
      await updateProfile({
        fullName,
        mobileNumber,
        address,
        skills: currentUser?.role === "worker" ? skills : undefined,
        capabilities: currentUser?.role === "worker" ? skills : undefined,
        profilePhotoUrl: currentUser?.role === "worker" ? profilePhotoUrl : undefined,
        experienceDescription: currentUser?.role === "worker" ? experienceDescription : undefined,
        yearsOfExperience: currentUser?.role === "worker" ? yearsOfExperience : undefined,
        validIdType: currentUser?.role === "worker" ? validIdType : undefined,
        validIdUrl: currentUser?.role === "worker" ? validIdUrl : undefined,
        medicalCertificateUrl: currentUser?.role === "worker" ? medicalCertificateUrl : undefined,
        availability: currentUser?.role === "worker" ? availability : undefined,
        availabilityStatus: currentUser?.role === "worker" && availability !== "Unavailable" ? availability : undefined,
        currentLatitude: currentUser?.role === "worker" ? parseCoordinate(currentLatitude) : undefined,
        currentLongitude: currentUser?.role === "worker" ? parseCoordinate(currentLongitude) : undefined,
        preferredRadiusKm: currentUser?.role === "worker" ? Number(preferredRadiusKm) || 5 : undefined,
        verificationStatus:
          currentUser?.role === "worker" ? currentUser.verificationStatus ?? "Pending Verification" : undefined,
        businessName: currentUser?.role === "client" ? bio : undefined
      });
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  function toggleSkill(skill: string) {
    setSkills((items) => (items.includes(skill) ? items.filter((item) => item !== skill) : [...items, skill]));
  }

  function selectWorkerArea(area: (typeof workerAreaPresets)[number]) {
    setAddress(area.address);
    setCurrentLatitude(area.latitude);
    setCurrentLongitude(area.longitude);
    if (area.label === "Downtown") {
      setPreferredRadiusKm("10");
    }
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

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.photoWrap}>
              <View style={styles.profilePhoto}>
                <Text style={styles.profilePhotoText}>{fullName[0] ?? "U"}</Text>
              </View>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>{currentUser?.verificationStatus ?? "Pending Verification"}</Text>
              </View>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{fullName}</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.star}>*</Text>
                <Text style={styles.ratingValue}>{averageRating}</Text>
                <Text style={styles.reviewCount}>({reviewCountLabel})</Text>
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
            <Text style={styles.sectionTitle}>Capabilities</Text>
            <View style={styles.skillRow}>
              {skills.map((skill) => (
                <Pressable key={skill} onPress={() => toggleSkill(skill)} style={styles.skillChip}>
                  <Text style={styles.skillText}>{skill} x</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setSkillDropdownOpen(true)} style={styles.dropdownButton}>
              <Text style={styles.dropdownText}>Add or remove capabilities</Text>
              <Text style={styles.dropdownIcon}>v</Text>
            </Pressable>
          </View>
        ) : null}

        {currentUser?.role === "worker" ? (
          <>
            <SettingsCard title="Worker Verification">
              <View style={styles.verificationStatusRow}>
                <Text style={styles.settingTitle}>Status</Text>
                <View style={styles.verificationBadge}>
                  <Text style={styles.verificationBadgeText}>{currentUser?.verificationStatus ?? "Pending Verification"}</Text>
                </View>
              </View>
              <UploadField
                label="Profile Photo"
                value={profilePhotoUrl}
                placeholder="Tap to upload profile photo"
                sampleFileName="profile-photo.jpg"
                onSelect={setProfilePhotoUrl}
              />
              <Field label="Years of Experience" value={yearsOfExperience} onChangeText={setYearsOfExperience} placeholder="e.g. 2 years" />
              <Field
                label="Experience Description"
                value={experienceDescription}
                onChangeText={setExperienceDescription}
                placeholder="Describe your work experience"
                multiline
              />
              <Field label="Valid ID Type" value={validIdType} onChangeText={setValidIdType} placeholder="e.g. National ID, Driver's License" />
              <UploadField
                label="Valid ID"
                value={validIdUrl}
                placeholder="Tap to upload valid ID"
                sampleFileName="valid-id-document.pdf"
                onSelect={setValidIdUrl}
              />
              <UploadField
                label="Medical Certificate"
                value={medicalCertificateUrl}
                placeholder="Tap to upload medical certificate"
                sampleFileName="medical-certificate.pdf"
                onSelect={setMedicalCertificateUrl}
              />
              <Text style={styles.helperText}>Upload the required documents so the account can be reviewed.</Text>
            </SettingsCard>

            <SettingsCard title="Service Area">
              <View style={styles.serviceHeader}>
                <View style={styles.flex}>
                  <Text style={styles.settingTitle}>Availability</Text>
                  <Text style={styles.helperText}>Choose when you want to appear for matching.</Text>
                </View>
              </View>
              <View style={styles.skillRow}>
                {(["Available", "Busy", "Unavailable"] as const).map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setAvailability(item)}
                    style={[styles.availabilityChip, availability === item && styles.availabilityChipSelected]}
                  >
                    <Text style={[styles.availabilityText, availability === item && styles.availabilityTextSelected]}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.workerMapCard}>
                <View style={styles.mapRoadOne} />
                <View style={styles.mapRoadTwo} />
                <View style={[styles.workerRadiusRing, getWorkerRadiusRingStyle(workerRadiusScale)]} />
                <View style={styles.workerPin}>
                  <Text style={styles.workerPinText}>You</Text>
                </View>
                <View style={styles.workerMapBadge}>
                  <Text style={styles.workerMapBadgeLabel}>Service area</Text>
                  <Text style={styles.workerMapBadgeText}>{selectedWorkerArea.label}</Text>
                </View>
              </View>

              <View style={styles.areaPresetGrid}>
                {workerAreaPresets.map((area) => {
                  const selected = currentLatitude === area.latitude && currentLongitude === area.longitude;
                  return (
                    <Pressable
                      key={area.label}
                      onPress={() => selectWorkerArea(area)}
                      style={[styles.areaPresetChip, selected && styles.areaPresetChipSelected]}
                    >
                      <Text style={[styles.areaPresetText, selected && styles.areaPresetTextSelected]}>{area.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.radiusGrid}>
                {workerRadiusOptions.map((option) => {
                  const selected = preferredRadiusKm === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setPreferredRadiusKm(option.value)}
                      style={[styles.radiusCard, selected && styles.radiusCardSelected]}
                    >
                      <Text style={[styles.radiusTitle, selected && styles.radiusTitleSelected]}>{option.label}</Text>
                      <Text style={[styles.radiusValue, selected && styles.radiusValueSelected]}>{option.value} km</Text>
                      <Text style={[styles.radiusHelper, selected && styles.radiusHelperSelected]}>{option.helper}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SettingsCard>
          </>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reviews</Text>
            <View style={styles.viewAllComingSoon}>
              <Text style={styles.viewAll}>View All</Text>
              <Text style={styles.viewAllHint}>Coming soon</Text>
            </View>
          </View>
          {profileRatings.length ? (
            profileRatings.map((rating) => (
              <ReviewCard
                key={rating.id}
                initials={rating.reviewerName[0] ?? "U"}
                name={rating.reviewerName}
                date="Task review"
                stars={rating.score}
                text={rating.feedback}
              />
            ))
          ) : (
            <View style={styles.reviewEmptyCard}>
              <Text style={styles.reviewEmptyText}>No reviews yet</Text>
            </View>
          )}
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{actionLoading ? "Saving..." : "Save Changes"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <BottomNav active="profile" role={currentUser?.role} router={router} />

      <Modal animationType="fade" transparent visible={skillDropdownOpen} onRequestClose={() => setSkillDropdownOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSkillDropdownOpen(false)}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownTitle}>Worker Capabilities</Text>
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

function UploadField({
  label,
  value,
  placeholder,
  sampleFileName,
  onSelect
}: {
  label: string;
  value: string;
  placeholder: string;
  sampleFileName: string;
  onSelect: (value: string) => void;
}) {
  const selectedFile = getUploadedFileName(value);

  function handleSelect() {
    onSelect(`Uploaded file: ${sampleFileName}`);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={handleSelect} style={styles.uploadInput}>
        <View style={styles.uploadCopy}>
          <Text style={[styles.uploadText, !selectedFile && styles.uploadPlaceholder]}>
            {selectedFile || placeholder}
          </Text>
          {selectedFile ? <Text style={styles.uploadMeta}>Ready for review</Text> : null}
        </View>
        <View style={styles.uploadButton}>
          <Text style={styles.uploadButtonText}>{selectedFile ? "Change" : "Upload"}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function getUploadedFileName(value: string) {
  return value.replace("Uploaded file: ", "").trim();
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

function getWorkerRadiusScale(radiusKm: string) {
  switch (radiusKm) {
    case "2":
      return 0.72;
    case "10":
      return 1.25;
    default:
      return 1;
  }
}

function getWorkerRadiusRingStyle(scale: number) {
  const size = 118 * scale;

  return {
    width: size,
    height: size,
    borderRadius: size / 2
  };
}

function BottomNav({
  active,
  role,
  router
}: {
  active: string;
  role?: string;
  router: ReturnType<typeof useRouter>;
}) {
  const insets = useSafeAreaInsets();
  const items =
    role === "client"
      ? [
          { key: "home", label: "Home", route: "/client-dashboard" },
          { key: "jobs", label: "Jobs", route: "/post-task" },
          { key: "chat", label: "Chat", route: "/chat" },
          { key: "profile", label: "Profile", route: "/profile" }
        ]
      : [
          { key: "home", label: "Home", route: "/worker-dashboard" },
          { key: "jobs", label: "Jobs", route: "/jobs" },
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
  uploadInput: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceLow,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  uploadCopy: { flex: 1, gap: 2 },
  uploadText: { color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  uploadPlaceholder: { color: palette.outline, fontWeight: "500" },
  uploadMeta: { color: palette.success, fontSize: 11, lineHeight: 14, fontWeight: "800" },
  uploadButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary
  },
  uploadButtonText: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  flex: { flex: 1 },
  twoColumn: { flexDirection: "row", gap: 10 },
  helperText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  viewAll: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  viewAllComingSoon: { alignItems: "flex-end" },
  viewAllHint: { color: palette.muted, fontSize: 10, lineHeight: 14, fontWeight: "700" },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: palette.primaryContainer, borderWidth: 1, borderColor: "rgba(0,92,85,0.2)" },
  skillText: { color: "#A3FAEF", fontSize: 14, lineHeight: 20, fontWeight: "900" },
  dropdownButton: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  dropdownText: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  dropdownIcon: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  settingTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  verificationStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  verificationBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#EAF8F1" },
  verificationBadgeText: { color: palette.success, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  serviceHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  availabilityChip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  availabilityChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  availabilityText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  availabilityTextSelected: { color: palette.white },
  workerMapCard: { height: 150, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: "#E5F1EE", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  workerRadiusRing: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 2,
    borderColor: "rgba(0,92,85,0.25)",
    backgroundColor: "rgba(0,92,85,0.07)"
  },
  workerPin: { width: 52, height: 52, borderRadius: 26, borderWidth: 4, borderColor: palette.white, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", elevation: 5 },
  workerPinText: { color: palette.white, fontSize: 11, lineHeight: 14, fontWeight: "900" },
  workerMapBadge: { position: "absolute", left: 12, bottom: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "rgba(189,201,198,0.75)" },
  workerMapBadgeLabel: { color: palette.muted, fontSize: 10, lineHeight: 14, fontWeight: "800", textTransform: "uppercase" },
  workerMapBadgeText: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  areaPresetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  areaPresetChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  areaPresetChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  areaPresetText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  areaPresetTextSelected: { color: palette.white },
  radiusGrid: { gap: 8 },
  radiusCard: { minHeight: 64, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, padding: 12 },
  radiusCardSelected: { borderColor: palette.primary, backgroundColor: "#E5F1EE" },
  radiusTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  radiusTitleSelected: { color: palette.primary },
  radiusValue: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: "900", marginTop: 2 },
  radiusValueSelected: { color: palette.primary },
  radiusHelper: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  radiusHelperSelected: { color: palette.text },
  reviewCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(189,201,198,0.35)", backgroundColor: palette.surface, gap: 10 },
  reviewEmptyCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow },
  reviewEmptyText: { color: palette.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" },
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
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 16, fontWeight: "700" },
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
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(24,28,28,0.32)", alignItems: "center", justifyContent: "center" },
  dropdownMenu: { width: "100%", maxWidth: 420, borderRadius: 12, padding: 12, backgroundColor: palette.surface },
  dropdownTitle: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 8 },
  dropdownOption: { minHeight: 48, borderRadius: 8, justifyContent: "center", paddingHorizontal: 12 },
  dropdownOptionText: { color: palette.muted, fontSize: 16, lineHeight: 24, fontWeight: "700" },
  dropdownOptionSelected: { color: palette.primary, fontWeight: "900" }
});
