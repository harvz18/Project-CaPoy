import { Href, useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavIcon } from "../src/components/BottomNavIcon";
import LocationMap from "../src/components/LocationMap";
import { StatusBadge } from "../src/components/StatusBadge";
import { workerCapabilities } from "../src/constants/capabilities";
import { useApp } from "../src/context/AppContext";
import { isIdentityLocked } from "../src/domain/profileIdentity";
import { captureForegroundLocation } from "../src/services/locationService";
import { pickAndUploadPrivateDocument, pickAndUploadProfilePhoto } from "../src/services/fileUploadService";
import { submitVerificationRequest } from "../src/services/verificationService";
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
const workerRadiusOptions = [
  { label: "Nearby", value: "2", helper: "Best for quick nearby tasks" },
  { label: "Barangay", value: "5", helper: "Covers nearby barangays" },
  { label: "Wide area", value: "10", helper: "Shows tasks within a broader radius" }
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { actionLoading, currentUser, error, logout, ratings, tasks, users, updateProfile } = useApp();
  const [fullName, setFullName] = useState(currentUser?.fullName ?? "");
  const [mobileNumber, setMobileNumber] = useState(currentUser?.mobileNumber ?? "");
  const [address, setAddress] = useState(currentUser?.address ?? "");
  const [bio, setBio] = useState(
    currentUser?.role === "client"
      ? currentUser?.businessName ?? ""
      : currentUser?.experienceDescription ?? ""
  );
  const [skills, setSkills] = useState(currentUser?.skills?.length ? currentUser.skills : []);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(currentUser?.profilePhotoUrl ?? "");
  const [experienceDescription, setExperienceDescription] = useState(currentUser?.experienceDescription ?? "");
  const [yearsOfExperience, setYearsOfExperience] = useState(currentUser?.yearsOfExperience ?? "");
  const [validIdType, setValidIdType] = useState(currentUser?.validIdType ?? "");
  const [validIdUrl, setValidIdUrl] = useState(currentUser?.validIdUrl ?? "");
  const [medicalCertificateUrl, setMedicalCertificateUrl] = useState(currentUser?.medicalCertificateUrl ?? "");
  const [documentsChanged, setDocumentsChanged] = useState(false);
  const [uploadingField, setUploadingField] = useState<string>();
  const [uploadMessage, setUploadMessage] = useState("");
  const [availability, setAvailability] = useState(currentUser?.availability ?? currentUser?.availabilityStatus ?? "Available");
  const [currentLatitude, setCurrentLatitude] = useState(String(currentUser?.currentLatitude ?? ""));
  const [currentLongitude, setCurrentLongitude] = useState(String(currentUser?.currentLongitude ?? ""));
  const [locationSource, setLocationSource] = useState(currentUser?.locationSource);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState(currentUser?.locationUpdatedAt);
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState(currentUser?.locationAccuracyMeters);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [preferredRadiusKm, setPreferredRadiusKm] = useState(String(currentUser?.preferredRadiusKm ?? 5));
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false);
  const fullNameLocked = isIdentityLocked(currentUser);
  const profileRatings = ratings
    .filter((rating) => rating.targetUserId === currentUser?.id)
    .map((rating) => ({
      ...rating,
      reviewerName: users.find((user) => user.id === rating.reviewerId)?.fullName ?? "TaskLink User"
    }));
  const averageRating = profileRatings.length
    ? (profileRatings.reduce((total, rating) => total + rating.score, 0) / profileRatings.length).toFixed(1)
    : currentUser && currentUser.rating > 0 ? currentUser.rating.toFixed(1) : "Not rated";
  const reviewCountLabel = profileRatings.length ? `${profileRatings.length} reviews` : "No reviews yet";
  const completedOrPosted = currentUser?.role === "client"
    ? tasks.filter((task) => task.clientId === currentUser.id).length
    : currentUser?.completedTasks ?? 0;
  const memberSince = currentUser?.createdAt && Number.isFinite(new Date(currentUser.createdAt).getTime())
    ? String(new Date(currentUser.createdAt).getFullYear())
    : "Not recorded";
  const mapCenter = parseCoordinate(currentLatitude) !== undefined && parseCoordinate(currentLongitude) !== undefined
    ? { latitude: parseCoordinate(currentLatitude) as number, longitude: parseCoordinate(currentLongitude) as number }
    : undefined;

  async function handleLogout() {
    try {
      await logout();
      router.replace("/login");
    } catch (logoutError) {
      setUploadMessage(logoutError instanceof Error ? logoutError.message : "Unable to log out.");
    }
  }

  async function handleSave() {
    try {
      await updateProfile({
        fullName: fullNameLocked ? undefined : fullName,
        address,
        skills: currentUser?.role === "worker" ? skills : undefined,
        capabilities: currentUser?.role === "worker" ? skills : undefined,
        profilePhotoUrl: currentUser?.role === "worker" ? profilePhotoUrl : undefined,
        experienceDescription: currentUser?.role === "worker" ? experienceDescription : undefined,
        yearsOfExperience: currentUser?.role === "worker" ? yearsOfExperience : undefined,
        availability: currentUser?.role === "worker" ? availability : undefined,
        availabilityStatus: currentUser?.role === "worker" && availability !== "Unavailable" ? availability : undefined,
        currentLatitude: currentUser?.role === "worker" ? parseCoordinate(currentLatitude) : undefined,
        currentLongitude: currentUser?.role === "worker" ? parseCoordinate(currentLongitude) : undefined,
        locationSource: currentUser?.role === "worker" ? locationSource : undefined,
        locationUpdatedAt: currentUser?.role === "worker" ? locationUpdatedAt : undefined,
        locationAccuracyMeters: currentUser?.role === "worker" ? locationAccuracyMeters : undefined,
        preferredRadiusKm: currentUser?.role === "worker" ? Number(preferredRadiusKm) || 5 : undefined,
        businessName: currentUser?.role === "client" ? bio : undefined
      });
      if (currentUser?.role === "worker" && documentsChanged) {
        await submitVerificationRequest({
          userId: currentUser.id,
          validIdType,
          validIdPath: validIdUrl,
          medicalCertificatePath: medicalCertificateUrl
        });
        setDocumentsChanged(false);
        setUploadMessage("Verification documents submitted for administrator review.");
      }
    } catch (saveError) {
      setUploadMessage(saveError instanceof Error ? saveError.message : "Unable to save this profile.");
    }
  }

  async function uploadProfilePhoto() {
    if (!currentUser) return;
    setUploadingField("profile-photo");
    setUploadMessage("");
    try {
      const uploaded = await pickAndUploadProfilePhoto(currentUser.id);
      if (uploaded) {
        setProfilePhotoUrl(uploaded.url);
        setUploadMessage("Profile photo uploaded. Save changes to publish it.");
      }
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : "Unable to upload profile photo.");
    } finally {
      setUploadingField(undefined);
    }
  }

  async function uploadVerificationDocument(kind: "valid-id" | "medical-certificate") {
    if (!currentUser) return;
    setUploadingField(kind);
    setUploadMessage("");
    try {
      const uploaded = await pickAndUploadPrivateDocument(currentUser.id, kind);
      if (uploaded) {
        if (kind === "valid-id") setValidIdUrl(uploaded.path);
        else setMedicalCertificateUrl(uploaded.path);
        setDocumentsChanged(true);
        setUploadMessage(`${uploaded.name} uploaded privately. Save changes to submit it for review.`);
      }
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : "Unable to upload this document.");
    } finally {
      setUploadingField(undefined);
    }
  }

  function toggleSkill(skill: string) {
    setSkills((items) => (items.includes(skill) ? items.filter((item) => item !== skill) : [...items, skill]));
  }

  async function useDeviceLocation() {
    setLocating(true);
    setLocationMessage("");
    try {
      const captured = await captureForegroundLocation();
      setCurrentLatitude(String(captured.latitude));
      setCurrentLongitude(String(captured.longitude));
      setLocationSource(captured.source);
      setLocationUpdatedAt(captured.capturedAt);
      setLocationAccuracyMeters(captured.accuracyMeters);
      setLocationMessage(`Device location captured${captured.accuracyMeters ? ` (about ${Math.round(captured.accuracyMeters)} m accuracy)` : ""}. Save changes to keep it.`);
    } catch (locationError) {
      setLocationMessage(locationError instanceof Error ? locationError.message : "Unable to capture location.");
    } finally {
      setLocating(false);
    }
  }

  function selectMapCoordinate(coordinate: { latitude: number; longitude: number }) {
    setCurrentLatitude(String(coordinate.latitude));
    setCurrentLongitude(String(coordinate.longitude));
    setLocationSource("manual");
    setLocationUpdatedAt(new Date().toISOString());
    setLocationAccuracyMeters(undefined);
    setLocationMessage("Location pin updated. Save changes to keep it.");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
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
                <Text style={styles.ratingValue}>{averageRating}</Text>
                <Text style={styles.reviewCount}>({reviewCountLabel})</Text>
              </View>
              <Text style={styles.bio}>{bio}</Text>
              {currentUser?.role === "worker" ? <StatusBadge status={currentUser.availabilityStatus ?? "Available"} /> : null}
              <View style={styles.statsGrid}>
                <StatBox label={currentUser?.role === "client" ? "Tasks Posted" : "Jobs Completed"} value={String(completedOrPosted)} />
                <StatBox label="Member since" value={memberSince} />
              </View>
            </View>
          </View>
        </View>

        <SettingsCard title="Edit Profile">
          <Field
            editable={!fullNameLocked}
            helper={fullNameLocked ? "Locked after identity approval. Contact support to request a correction." : "This name will lock after identity approval."}
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
          />
          <Field
            editable={false}
            label="Mobile Number (verified identity)"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            placeholder="Mobile number"
          />
          <Field label="Address / Barangay" value={address} onChangeText={setAddress} placeholder="Address or barangay" />
          <Field label={currentUser?.role === "client" ? "Business Bio" : "Worker Bio"} value={bio} onChangeText={setBio} placeholder="Tell people about yourself" multiline />
        </SettingsCard>

        {currentUser?.role === "worker" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Capabilities</Text>
            <View style={styles.skillRow}>
              {skills.map((skill) => (
                <Pressable accessibilityLabel={`Remove ${skill}`} accessibilityRole="button" key={skill} onPress={() => toggleSkill(skill)} style={styles.skillChip}>
                  <Text style={styles.skillText}>{skill} x</Text>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setSkillDropdownOpen(true)} style={styles.dropdownButton}>
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
                disabled={uploadingField === "profile-photo"}
                label="Profile Photo"
                value={profilePhotoUrl}
                placeholder="Tap to upload profile photo"
                onSelect={uploadProfilePhoto}
              />
              <Field label="Years of Experience" value={yearsOfExperience} onChangeText={setYearsOfExperience} placeholder="e.g. 2 years" />
              <Field
                label="Experience Description"
                value={experienceDescription}
                onChangeText={setExperienceDescription}
                placeholder="Describe your work experience"
                multiline
              />
              <Field label="Valid ID Type" value={validIdType} onChangeText={(value) => {
                setValidIdType(value);
                setDocumentsChanged(true);
              }} placeholder="e.g. National ID, Driver's License" />
              <UploadField
                disabled={uploadingField === "valid-id"}
                label="Valid ID"
                value={validIdUrl}
                placeholder="Tap to upload valid ID"
                onSelect={() => uploadVerificationDocument("valid-id")}
              />
              <UploadField
                disabled={uploadingField === "medical-certificate"}
                label="Medical Certificate"
                value={medicalCertificateUrl}
                placeholder="Tap to upload medical certificate"
                onSelect={() => uploadVerificationDocument("medical-certificate")}
              />
              <Text style={styles.helperText}>Upload the required documents so the account can be reviewed.</Text>
              {uploadMessage ? <Text style={styles.locationMessage}>{uploadMessage}</Text> : null}
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
                    accessibilityRole="button"
                    accessibilityState={{ selected: availability === item }}
                    key={item}
                    onPress={() => setAvailability(item)}
                    style={[styles.availabilityChip, availability === item && styles.availabilityChipSelected]}
                  >
                    <Text style={[styles.availabilityText, availability === item && styles.availabilityTextSelected]}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <LocationMap
                center={mapCenter}
                interactive
                markers={mapCenter ? [{ id: "selected", ...mapCenter, title: "Your saved location" }] : []}
                onSelectCoordinate={selectMapCoordinate}
                radiusMeters={(Number(preferredRadiusKm) || 0) * 1000}
                showUserLocation
                height={260}
              />
              <Text style={styles.helperText}>Move or zoom the map, then tap or click to place your matching-area pin. Drag the pin to adjust it.</Text>
              <Pressable accessibilityRole="button" disabled={locating} onPress={useDeviceLocation} style={styles.locationButton}>
                <Text style={styles.locationButtonText}>{locating ? "Getting location..." : "Use current device location"}</Text>
              </Pressable>
              <Text style={styles.helperText}>Your saved pin stays in your private profile. Clients see only matching reasons and distance.</Text>
              {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}

              <View style={styles.radiusGrid}>
                {workerRadiusOptions.map((option) => {
                  const selected = preferredRadiusKm === option.value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
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
            <Text style={styles.sectionTitle}>Reviews</Text>
            <Text style={styles.reviewCount}>{reviewCountLabel}</Text>
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
            <Text style={styles.coverageTitle}>{currentUser?.role === "client" ? "Preferred Service Area" : "Service Coverage"}</Text>
          </View>
          <LocationMap center={mapCenter} markers={mapCenter ? [{ id: "coverage", ...mapCenter, title: address }] : []} height={128} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: actionLoading }} disabled={actionLoading} style={[styles.saveButton, actionLoading && styles.uploadDisabled]} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{actionLoading ? "Saving..." : "Save Changes"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/help" as Href)} style={styles.supportButton}>
          <Text style={styles.supportButtonText}>Privacy, limitations, and beta support</Text>
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
                <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={skill} onPress={() => toggleSkill(skill)} style={styles.dropdownOption}>
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionSelected]}>
                    {selected ? "Selected: " : ""}{skill}
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
  multiline,
  editable = true,
  helper
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "decimal-pad";
  multiline?: boolean;
  editable?: boolean;
  helper?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.outline}
        style={[styles.input, !editable && styles.inputDisabled, multiline && styles.textArea]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

function UploadField({
  disabled,
  label,
  value,
  placeholder,
  onSelect
}: {
  disabled?: boolean;
  label: string;
  value: string;
  placeholder: string;
  onSelect: () => void | Promise<void>;
}) {
  const selectedFile = getUploadedFileName(value);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void onSelect()} style={[styles.uploadInput, disabled && styles.uploadDisabled]}>
        <View style={styles.uploadCopy}>
          <Text style={[styles.uploadText, !selectedFile && styles.uploadPlaceholder]}>
            {selectedFile || placeholder}
          </Text>
          {selectedFile ? <Text style={styles.uploadMeta}>Ready for review</Text> : null}
        </View>
        <View style={styles.uploadButton}>
          <Text style={styles.uploadButtonText}>{disabled ? "Uploading..." : selectedFile ? "Change" : "Upload"}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function getUploadedFileName(value: string) {
  if (!value) return "";
  if (value.startsWith("http")) return "Profile photo uploaded";
  return value.split("/").pop()?.replace(/^\d+_/, "") ?? value;
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
          <Pressable accessibilityLabel={item.label} accessibilityRole="button" accessibilityState={{ selected }} key={item.key} onPress={() => router.push(item.route as never)} style={[styles.navItem, selected && styles.navItemActive]}>
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
  backButton: { minWidth: 48, minHeight: 44, alignItems: "center", justifyContent: "center" },
  backText: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: "900" },
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
  inputDisabled: { color: palette.outline, backgroundColor: palette.surfaceContainer },
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
  uploadDisabled: { opacity: 0.6 },
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
  locationButton: { minHeight: 44, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  locationButtonText: { color: palette.white, fontSize: 13, fontWeight: "900" },
  locationMessage: { color: palette.primary, fontSize: 12, lineHeight: 17, fontWeight: "700" },
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
  supportButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, backgroundColor: palette.surface },
  supportButtonText: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: "900", textAlign: "center" },
  logoutButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: "#FFDAD6", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF7F6" },
  logoutText: { color: palette.danger, fontSize: 14, fontWeight: "900" },
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  fieldHelper: { color: palette.muted, fontSize: 12, lineHeight: 16 },
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
