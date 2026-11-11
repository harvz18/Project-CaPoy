import Feather from "@expo/vector-icons/Feather";
import { Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { MotionModal as Modal } from "../src/components/MotionModal";
import { MotionPressable as Pressable } from "../src/components/MotionPressable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedBottomNav } from "../src/components/AnimatedBottomNav";
import LocationMap from "../src/components/LocationMap";
import { StatusBadge } from "../src/components/StatusBadge";
import { workerCapabilities } from "../src/constants/capabilities";
import { FREE_WEB_DEMO } from "../src/config/release";
import { useApp } from "../src/context/AppContext";
import { getScheduleBasedAvailability, getUserTaskHistory } from "../src/domain/taskMarketplace";
import { isIdentityLocked } from "../src/domain/profileIdentity";
import { captureForegroundLocation } from "../src/services/locationService";
import { pickAndUploadPrivateDocument, pickAndUploadProfilePhoto } from "../src/services/fileUploadService";
import { AddressSearchResult, reverseGeocodeSelectedPin, searchAddressOnMap } from "../src/services/reverseGeocoding";
import { submitVerificationRequest } from "../src/services/verificationService";
import { parseCoordinate } from "../src/utils/location";
import { AddressDetails, formatAddressDetails } from "../src/utils/address";
import type { MapCoordinate } from "../src/components/LocationMap.types";
import { screenPalette } from "../src/theme";
import { typography } from "../src/typography";
import { AppText as Text, AppTextInput as TextInput } from "../src/components/AppText";

const palette = screenPalette;
const PROFILE_CITY = "Bacolod City";

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
  const [addressDetails, setAddressDetails] = useState<AddressDetails>(() => ({
    // Registration currently collects one Barangay value. Keep that value in the
    // single Barangay field instead of showing a duplicate generic address box.
    barangay: currentUser?.address ?? "",
    city: PROFILE_CITY
  }));
  const [addressMapOpen, setAddressMapOpen] = useState(false);
  const [addressMapCoordinate, setAddressMapCoordinate] = useState<MapCoordinate>();
  const [addressSearchQuery, setAddressSearchQuery] = useState("");
  const [addressSearchResults, setAddressSearchResults] = useState<AddressSearchResult[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressLookupMessage, setAddressLookupMessage] = useState("");
  const registrationBarangayLoaded = useRef(false);
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
  const [policeClearanceUrl, setPoliceClearanceUrl] = useState(currentUser?.policeClearanceUrl ?? "");
  const [documentsChanged, setDocumentsChanged] = useState(false);
  const [uploadingField, setUploadingField] = useState<string>();
  const [uploadMessage, setUploadMessage] = useState("");
  const [currentLatitude, setCurrentLatitude] = useState(String(currentUser?.currentLatitude ?? ""));
  const [currentLongitude, setCurrentLongitude] = useState(String(currentUser?.currentLongitude ?? ""));
  const [locationSource, setLocationSource] = useState(currentUser?.locationSource);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState(currentUser?.locationUpdatedAt);
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState(currentUser?.locationAccuracyMeters);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [preferredRadiusKm, setPreferredRadiusKm] = useState(String(currentUser?.preferredRadiusKm ?? 5));
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false);
  const [skillDraft, setSkillDraft] = useState<string[]>([]);
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
  const taskHistory = currentUser && currentUser.role !== "admin"
    ? getUserTaskHistory(tasks, currentUser.id, currentUser.role)
    : undefined;
  const memberSince = currentUser?.createdAt && Number.isFinite(new Date(currentUser.createdAt).getTime())
    ? String(new Date(currentUser.createdAt).getFullYear())
    : "Not recorded";
  const mapCenter = parseCoordinate(currentLatitude) !== undefined && parseCoordinate(currentLongitude) !== undefined
    ? { latitude: parseCoordinate(currentLatitude) as number, longitude: parseCoordinate(currentLongitude) as number }
    : undefined;
  const formattedAddress = formatAddressDetails(addressDetails) || currentUser?.address || "";

  useEffect(() => {
    if (registrationBarangayLoaded.current || !currentUser?.address) return;
    registrationBarangayLoaded.current = true;
    setAddressDetails((current) => current.barangay ? current : { ...current, barangay: currentUser.address });
  }, [currentUser?.address]);

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
      const detailedAddress = formatAddressDetails(addressDetails);
      await updateProfile({
        fullName: fullNameLocked ? undefined : fullName,
        address: detailedAddress || currentUser?.address || "",
        skills: currentUser?.role === "worker" ? skills : undefined,
        capabilities: currentUser?.role === "worker" ? skills : undefined,
        profilePhotoUrl,
        experienceDescription: currentUser?.role === "worker" ? experienceDescription : undefined,
        yearsOfExperience: currentUser?.role === "worker" ? yearsOfExperience : undefined,
        currentLatitude: currentUser?.role === "worker" ? parseCoordinate(currentLatitude) : undefined,
        currentLongitude: currentUser?.role === "worker" ? parseCoordinate(currentLongitude) : undefined,
        locationSource: currentUser?.role === "worker" ? locationSource : undefined,
        locationUpdatedAt: currentUser?.role === "worker" ? locationUpdatedAt : undefined,
        locationAccuracyMeters: currentUser?.role === "worker" ? locationAccuracyMeters : undefined,
        preferredRadiusKm: currentUser?.role === "worker" ? Number(preferredRadiusKm) || 5 : undefined,
        businessName: currentUser?.role === "client" ? bio : undefined
      });
      if (currentUser && documentsChanged) {
        await submitVerificationRequest({
          userId: currentUser.id,
          role: currentUser.role === "client" ? "client" : "worker",
          validIdType,
          validIdPath: validIdUrl,
          medicalCertificatePath: medicalCertificateUrl,
          policeClearancePath: policeClearanceUrl
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
        await updateProfile({ profilePhotoUrl: uploaded.url });
        setUploadMessage("Profile photo uploaded and saved.");
      }
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : "Unable to upload profile photo.");
    } finally {
      setUploadingField(undefined);
    }
  }

  async function uploadVerificationDocument(kind: "valid-id" | "medical-certificate" | "police-clearance") {
    if (!currentUser) return;
    setUploadingField(kind);
    setUploadMessage("");
    try {
      const uploaded = await pickAndUploadPrivateDocument(currentUser.id, kind);
      if (uploaded) {
        if (kind === "valid-id") setValidIdUrl(uploaded.path);
        else if (kind === "medical-certificate") setMedicalCertificateUrl(uploaded.path);
        else setPoliceClearanceUrl(uploaded.path);
        setDocumentsChanged(true);
        setUploadMessage(`${uploaded.name} uploaded privately. Save changes to submit it for review.`);
      }
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : "Unable to upload this document.");
    } finally {
      setUploadingField(undefined);
    }
  }

  function openSkillSelector() {
    setSkillDraft(skills);
    setSkillDropdownOpen(true);
  }

  function toggleSkill(skill: string) {
    setSkillDraft((items) => (items.includes(skill) ? items.filter((item) => item !== skill) : [...items, skill]));
  }

  async function saveSkills() {
    if (!currentUser) return;
    try {
      await updateProfile({ skills: skillDraft, capabilities: skillDraft });
      setSkills(skillDraft);
      setSkillDropdownOpen(false);
      setUploadMessage("Capabilities saved.");
    } catch (saveError) {
      setUploadMessage(saveError instanceof Error ? saveError.message : "Unable to save capabilities.");
    }
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

  function updateAddressDetail(field: keyof AddressDetails, value: string) {
    setAddressDetails((current) => ({ ...current, [field]: field === "city" ? PROFILE_CITY : value }));
  }

  function applyAddressDetails(details: AddressDetails, message: string) {
    setAddressDetails((current) => ({
      ...details,
      // TaskLink currently operates in Bacolod City. Map data may use a nearby
      // locality label, but the profile's required service city is fixed.
      city: PROFILE_CITY,
      // A building/house number is optional and commonly absent from map data;
      // never erase a value the user already entered manually.
      houseNumber: current.houseNumber?.trim() || details.houseNumber
    }));
    setAddressLookupMessage(message);
  }

  async function selectAddressPin(coordinate: MapCoordinate) {
    setAddressMapCoordinate(coordinate);
    setAddressLookupLoading(true);
    setAddressLookupMessage("Looking up the selected pin...");
    try {
      const result = await reverseGeocodeSelectedPin(coordinate);
      applyAddressDetails(result.details, "Address fields filled from the selected map pin. Review and correct any detail before saving.");
    } catch (lookupError) {
      setAddressLookupMessage(lookupError instanceof Error ? lookupError.message : "Unable to look up this map pin. Enter the address manually.");
    } finally {
      setAddressLookupLoading(false);
    }
  }

  async function searchAddress() {
    setAddressLookupLoading(true);
    setAddressLookupMessage("");
    try {
      const results = await searchAddressOnMap(addressSearchQuery);
      setAddressSearchResults(results);
      if (!results.length) setAddressLookupMessage("No matching address was found. Try a more specific search or place the pin manually.");
    } catch (lookupError) {
      setAddressSearchResults([]);
      setAddressLookupMessage(lookupError instanceof Error ? lookupError.message : "Unable to search the map. Try again later.");
    } finally {
      setAddressLookupLoading(false);
    }
  }

  function chooseAddressSearchResult(result: AddressSearchResult) {
    setAddressMapCoordinate(result.coordinate);
    setAddressSearchResults([]);
    applyAddressDetails(result.details, "Address fields filled from the selected search result. Review and correct any detail before saving.");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
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
                {profilePhotoUrl ? <Image source={{ uri: profilePhotoUrl }} style={styles.profilePhotoImage} /> : <Text style={styles.profilePhotoText}>{fullName[0] ?? "U"}</Text>}
              </View>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>{currentUser?.verificationStatus ?? "Not Submitted"}</Text>
              </View>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{fullName}</Text>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingValue}>{averageRating}</Text>
                <Text style={styles.reviewCount}>({reviewCountLabel})</Text>
              </View>
              <Text style={styles.bio}>{bio}</Text>
              {currentUser?.role === "worker" ? <StatusBadge status={getScheduleBasedAvailability(tasks, currentUser.id)} /> : null}
              <View style={styles.statsGrid}>
                <StatBox label="Applications" value={String(taskHistory?.total ?? completedOrPosted)} />
                <StatBox label="Completed" value={String(taskHistory?.completed ?? completedOrPosted)} />
                <StatBox label="Member Since" value={memberSince} />
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
          <View style={styles.twoColumn}>
            <View style={styles.flex}><Field label="House / Building" value={addressDetails.houseNumber ?? ""} onChangeText={(value) => updateAddressDetail("houseNumber", value)} placeholder="Optional" /></View>
            <View style={styles.flex}><Field label="Street" value={addressDetails.street ?? ""} onChangeText={(value) => updateAddressDetail("street", value)} placeholder="Optional" /></View>
          </View>
          <View style={styles.twoColumn}>
            <View style={styles.flex}><Field label="Barangay" value={addressDetails.barangay ?? ""} onChangeText={(value) => updateAddressDetail("barangay", value)} placeholder="Barangay" /></View>
            <View style={styles.flex}><Field editable={false} helper="Required service city" label="City" value={PROFILE_CITY} onChangeText={() => undefined} placeholder="Bacolod City" /></View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setAddressMapOpen(true)} style={styles.selectMapButton}>
            <Feather accessibilityElementsHidden color={palette.primary} name="map-pin" size={18} />
            <Text style={styles.selectMapButtonText}>Select on map</Text>
          </Pressable>
          <Text style={styles.helperText}>Choose a map pin or search an address to fill these fields. House/building is optional.</Text>
          {addressLookupMessage ? <Text style={styles.locationMessage}>{addressLookupMessage}</Text> : null}
          <Field label={currentUser?.role === "client" ? "Business Bio" : "Worker Bio"} value={bio} onChangeText={setBio} placeholder="Tell people about yourself" multiline />
        </SettingsCard>

        <SettingsCard title="Account Mode">
          <Text style={styles.helperText}>You are currently using TaskLink as {currentUser?.role === "client" ? "an employer" : "a tasker"}.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(currentUser?.activeTaskId) }}
            disabled={Boolean(currentUser?.activeTaskId)}
            onPress={() => router.push("/role-selection")}
            style={[styles.locationButton, currentUser?.activeTaskId && styles.uploadDisabled]}
          >
            <Text style={styles.locationButtonText}>Switch account mode</Text>
          </Pressable>
          {currentUser?.activeTaskId ? <Text style={styles.helperText}>Finish the active task before switching account mode.</Text> : null}
        </SettingsCard>

        {currentUser?.role === "worker" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Capabilities</Text>
            <View style={styles.skillRow}>
              {skills.map((skill) => (
                  <View key={skill} style={styles.skillChip}>
                  <Text style={styles.skillText}>{skill}</Text>
                  </View>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={openSkillSelector} style={styles.dropdownButton}>
              <Text style={styles.dropdownText}>Add or remove capabilities</Text>
              <Feather accessibilityElementsHidden color={palette.primary} name="chevron-down" size={20} />
            </Pressable>
          </View>
        ) : null}

        {currentUser ? (
          <>
            <SettingsCard title="User Verification">
              <View style={styles.verificationStatusRow}>
                <Text style={styles.settingTitle}>Status</Text>
                <View style={styles.verificationBadge}>
                  <Text style={styles.verificationBadgeText}>{currentUser?.verificationStatus ?? "Not Submitted"}</Text>
                </View>
              </View>
              {currentUser.role === "worker" ? <>
                <Field label="Years of Experience" value={yearsOfExperience} onChangeText={setYearsOfExperience} placeholder="e.g. 2 years" />
                <Field
                  label="Experience Description"
                  value={experienceDescription}
                  onChangeText={setExperienceDescription}
                  placeholder="Describe your work experience"
                  multiline
                />
              </> : null}
              {FREE_WEB_DEMO ? (
                <Text style={styles.helperText}>Profile-photo and verification-document uploads are unavailable in this no-billing web deployment because Firebase Storage is not active. Existing saved photos remain visible; account and task features continue to work.</Text>
              ) : <>
                <UploadField
                  disabled={uploadingField === "profile-photo"}
                  label="Profile Photo"
                  value={profilePhotoUrl}
                  placeholder="Tap to upload profile photo"
                  onSelect={uploadProfilePhoto}
                />
                  <Field editable={!fullNameLocked} label="Valid ID Type" value={validIdType} onChangeText={(value) => {
                    setValidIdType(value);
                    setDocumentsChanged(true);
                  }} placeholder="e.g. National ID, Driver's License" />
                  <UploadField
                    disabled={fullNameLocked || uploadingField === "valid-id"}
                    label="Valid ID"
                    value={validIdUrl}
                    placeholder="Tap to upload valid ID"
                    onSelect={() => uploadVerificationDocument("valid-id")}
                  />
                  <UploadField
                    disabled={fullNameLocked || uploadingField === "medical-certificate"}
                    label="Medical Certificate"
                    value={medicalCertificateUrl}
                    placeholder="Tap to upload medical certificate"
                    onSelect={() => uploadVerificationDocument("medical-certificate")}
                  />
                  <UploadField
                    disabled={fullNameLocked || uploadingField === "police-clearance"}
                    label="Police Clearance"
                    value={policeClearanceUrl}
                    placeholder="Tap to upload police clearance"
                    onSelect={() => uploadVerificationDocument("police-clearance")}
                  />
                  <Text style={styles.helperText}>{fullNameLocked
                    ? "Your approved identity details are locked. Contact support if a correction is needed."
                    : "Submit a valid ID, medical certificate, and police clearance. Documents are private and available only to you and authorized administrators."}</Text>
              </>}
              {uploadMessage ? <Text style={styles.locationMessage}>{uploadMessage}</Text> : null}
            </SettingsCard>

            {currentUser.role === "worker" ? <SettingsCard title="Service Area">
              <View style={styles.serviceHeader}>
                <View style={styles.flex}>
                  <Text style={styles.settingTitle}>Availability</Text>
                  <Text style={styles.helperText}>Choose when you want to appear for matching.</Text>
                </View>
              </View>
              <View style={styles.skillRow}>
                <Text style={styles.helperText}>Availability is determined automatically from your confirmed task schedules.</Text>
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
            </SettingsCard> : null}
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
          <LocationMap center={mapCenter} markers={mapCenter ? [{ id: "coverage", ...mapCenter, title: formattedAddress }] : []} height={128} />
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

      <AnimatedBottomNav active="profile" role={currentUser?.role} />

      <Modal animationType="fade" transparent visible={skillDropdownOpen} onRequestClose={() => setSkillDropdownOpen(false)}>
        <Pressable accessibilityLabel="Close worker capabilities" accessibilityRole="button" motionDisabled style={styles.modalBackdrop} onPress={() => setSkillDropdownOpen(false)}>
          <View accessibilityViewIsModal style={styles.dropdownMenu}>
            <Text style={styles.dropdownTitle}>Worker Capabilities</Text>
            {skillOptions.map((skill) => {
              const selected = skillDraft.includes(skill);
              return (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={skill} onPress={() => toggleSkill(skill)} style={[styles.dropdownOption, selected && styles.dropdownOptionActive]}>
                  <Feather accessibilityElementsHidden color={selected ? palette.primary : palette.outline} name={selected ? "check-square" : "square"} size={20} />
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionSelected]}>
                    {skill}
                  </Text>
                </Pressable>
              );
            })}
            <View style={styles.capabilityActions}>
              <Pressable accessibilityRole="button" onPress={() => setSkillDropdownOpen(false)} style={styles.capabilityCancelButton}>
                <Text style={styles.capabilityCancelText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void saveSkills()} style={styles.capabilitySaveButton}>
                <Text style={styles.capabilitySaveText}>Save capabilities</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal animationType="slide" transparent visible={addressMapOpen} onRequestClose={() => setAddressMapOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.addressMapModal}>
            <View style={styles.addressMapHeader}>
              <View style={styles.flex}>
                <Text style={styles.dropdownTitle}>Select address on map</Text>
                <Text style={styles.helperText}>Search, then choose a result, or tap and drag the pin on the map.</Text>
              </View>
              <Pressable accessibilityLabel="Close address map" accessibilityRole="button" onPress={() => setAddressMapOpen(false)} style={styles.addressMapClose}>
                <Feather color={palette.primary} name="x" size={22} />
              </Pressable>
            </View>
            <View style={styles.addressSearchRow}>
              <TextInput
                accessibilityLabel="Search address on map"
                onChangeText={setAddressSearchQuery}
                onSubmitEditing={() => void searchAddress()}
                placeholder="Search street, barangay, city"
                placeholderTextColor={palette.outline}
                returnKeyType="search"
                style={[styles.input, styles.addressSearchInput]}
                value={addressSearchQuery}
              />
              <Pressable accessibilityRole="button" disabled={addressLookupLoading} onPress={() => void searchAddress()} style={[styles.addressSearchButton, addressLookupLoading && styles.uploadDisabled]}>
                <Text style={styles.addressSearchButtonText}>{addressLookupLoading ? "..." : "Search"}</Text>
              </Pressable>
            </View>
            {addressSearchResults.length ? (
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.addressSearchResults}>
                {addressSearchResults.map((result) => (
                  <Pressable accessibilityRole="button" key={`${result.coordinate.latitude}:${result.coordinate.longitude}:${result.formattedAddress}`} onPress={() => chooseAddressSearchResult(result)} style={styles.addressSearchResult}>
                    <Text numberOfLines={2} style={styles.addressSearchResultText}>{result.formattedAddress}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <LocationMap
              center={addressMapCoordinate}
              height={300}
              interactive
              markers={addressMapCoordinate ? [{ id: "selected", ...addressMapCoordinate, title: "Selected home address" }] : []}
              onSelectCoordinate={selectAddressPin}
            />
            <Pressable accessibilityRole="button" onPress={() => setAddressMapOpen(false)} style={styles.locationButton}>
              <Text style={styles.locationButtonText}>Use this address</Text>
            </Pressable>
          </View>
        </View>
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
        accessibilityLabel={label}
        accessibilityHint={helper}
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
  const score = Number.isFinite(stars) ? Math.min(5, Math.max(0, Math.round(stars))) : 0;
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
        <Text accessibilityLabel={`${score} out of 5 stars`} style={styles.reviewStars}>{"★".repeat(score)}{"☆".repeat(5 - score)} <Text style={styles.reviewScore}>{score}/5</Text></Text>
      </View>
      <Text style={styles.reviewText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: "rgba(207, 249, 255, 0.20)" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  brand: { ...typography.screenTitle, color: palette.primary },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.surfaceHigh, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.bodyMedium, color: palette.secondary },
  content: { padding: 16, paddingTop: 24, gap: 16 },
  profileCard: { padding: 24, borderRadius: 24, borderWidth: 1, borderColor: palette.primaryFixed, backgroundColor: palette.surface, shadowColor: palette.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 6 },
  profileHeader: { alignItems: "center", gap: 20 },
  photoWrap: { position: "relative" },
  profilePhoto: { width: 132, height: 132, borderRadius: 66, borderWidth: 4, borderColor: palette.primaryFixed, backgroundColor: palette.secondaryContainer, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  profilePhotoImage: { width: "100%", height: "100%" },
  profilePhotoText: { ...typography.heroNumber, color: "#F4C95D" },
  verifiedPill: { position: "absolute", right: -4, bottom: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: palette.success },
  verifiedText: { ...typography.badge, color: palette.white },
  profileCopy: { width: "100%", alignItems: "center", gap: 8 },
  profileName: { ...typography.screenTitle, color: palette.textStrong, textAlign: "center" },
  ratingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  star: { ...typography.sectionTitleSmall, color: palette.secondary },
  ratingValue: { ...typography.sectionTitle, color: palette.secondary },
  reviewCount: { ...typography.heroNumber, color: palette.muted },
  bio: { ...typography.cardTitle, color: palette.muted, textAlign: "center" },
  statsGrid: { flexDirection: "row", gap: 8, width: "100%", paddingTop: 8 },
  statBox: { alignItems: "center", backgroundColor: palette.surfaceContainer, borderRadius: 16, borderWidth: 1, borderColor: palette.outlineVariant, flex: 1, justifyContent: "center", minHeight: 92, paddingHorizontal: 8, paddingVertical: 10 },
  statLabel: { ...typography.fieldLabel, color: palette.muted, textAlign: "center" },
  statValue: { ...typography.heroNumber, color: palette.primary, textAlign: "center" },
  settingsCard: { padding: 18, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant, gap: 12 },
  settingsTitle: { ...typography.sectionTitleSmall, color: palette.textStrong },
  field: { gap: 6 },
  fieldLabel: { ...typography.fieldLabel, color: palette.text },
  input: { ...typography.inputText, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceHigh, color: palette.text, paddingHorizontal: 14 },
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
  uploadText: { ...typography.bodyMedium, color: palette.text },
  uploadPlaceholder: { ...typography.body, color: palette.outline },
  uploadMeta: { ...typography.metadata, color: palette.success },
  uploadButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary
  },
  uploadButtonText: { ...typography.button, color: palette.white },
  flex: { flex: 1 },
  twoColumn: { flexDirection: "row", gap: 10 },
  helperText: { ...typography.metadata, color: palette.muted },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { ...typography.sectionTitle, color: palette.textStrong },
  viewAll: { ...typography.button, color: palette.primary },
  viewAllComingSoon: { alignItems: "flex-end" },
  viewAllHint: { ...typography.button, color: palette.muted },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: palette.primaryContainer, borderWidth: 1, borderColor: "rgba(0,201,179,0.24)", flexDirection: "row", alignItems: "center", gap: 6 },
  skillText: { ...typography.bodyMedium, color: "#7FF6E6" },
  dropdownButton: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  dropdownText: { ...typography.bodyMedium, color: palette.primary },
  dropdownIcon: { ...typography.bodyMedium, color: palette.primary },
  settingTitle: { ...typography.bodyMedium, color: palette.text },
  verificationStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  verificationBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(38, 229, 178, 0.16)" },
  verificationBadgeText: { ...typography.badge, color: palette.success },
  serviceHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  availabilityChip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  availabilityChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  availabilityText: { ...typography.badge, color: palette.muted },
  availabilityTextSelected: { color: palette.white },
  locationButton: { minHeight: 44, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  locationButtonText: { ...typography.button, color: palette.white },
  selectMapButton: { alignItems: "center", alignSelf: "flex-start", borderColor: palette.primary, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 42, paddingHorizontal: 14 },
  selectMapButtonText: { ...typography.button, color: palette.primary },
  locationMessage: { ...typography.metadata, color: palette.primary },
  workerMapCard: { height: 150, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: "rgba(20, 217, 226, 0.12)", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  workerRadiusRing: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 2,
    borderColor: "rgba(0,201,179,0.30)",
    backgroundColor: "rgba(0,201,179,0.10)"
  },
  workerPin: { width: 52, height: 52, borderRadius: 26, borderWidth: 4, borderColor: palette.white, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", elevation: 5 },
  workerPinText: { ...typography.badge, color: palette.white },
  workerMapBadge: { position: "absolute", left: 12, bottom: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(3,35,52,0.94)", borderWidth: 1, borderColor: "rgba(207,249,255,0.42)" },
  workerMapBadgeLabel: { ...typography.badge, color: palette.muted },
  workerMapBadgeText: { ...typography.badge, color: palette.text },
  areaPresetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  areaPresetChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  areaPresetChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  areaPresetText: { ...typography.badge, color: palette.muted },
  areaPresetTextSelected: { color: palette.white },
  radiusGrid: { gap: 8 },
  radiusCard: { minHeight: 64, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, padding: 12 },
  radiusCardSelected: { borderColor: palette.primary, backgroundColor: "rgba(20, 217, 226, 0.12)" },
  radiusTitle: { ...typography.bodyMedium, color: palette.text },
  radiusTitleSelected: { color: palette.primary },
  radiusValue: { ...typography.badge, color: palette.secondary, marginTop: 2 },
  radiusValueSelected: { color: palette.primary },
  radiusHelper: { ...typography.metadata, color: palette.muted, marginTop: 2 },
  radiusHelperSelected: { color: palette.text },
  reviewCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(207,249,255,0.28)", backgroundColor: palette.surface, gap: 10 },
  reviewEmptyCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow },
  reviewEmptyText: { ...typography.bodyMedium, color: palette.muted },
  reviewTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  reviewPerson: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.secondaryFixed, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { ...typography.bodyMedium, color: "#F5FCFF" },
  reviewName: { ...typography.bodyMedium, color: palette.text },
  reviewDate: { ...typography.metadata, color: palette.muted },
  reviewStars: { ...typography.sectionTitleSmall, color: palette.secondary },
  reviewText: { ...typography.cardTitle, color: palette.muted },
  coverageCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(207,249,255,0.28)", backgroundColor: palette.surfaceLow, gap: 12 },
  coverageHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  coverageIcon: { ...typography.heroNumber, color: palette.primary },
  coverageTitle: { ...typography.bodyMedium, color: palette.textStrong },
  coverageMap: { height: 128, borderRadius: 8, backgroundColor: "rgba(20, 217, 226, 0.12)", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  mapRoadOne: { position: "absolute", left: -18, right: -18, top: 58, height: 14, backgroundColor: "#17607A", transform: [{ rotate: "-12deg" }] },
  mapRoadTwo: { position: "absolute", top: -12, bottom: -12, left: "58%", width: 16, backgroundColor: "#14556D", transform: [{ rotate: "18deg" }] },
  coverageBadge: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: palette.surface },
  coverageBadgeText: { ...typography.badge, color: palette.primary },
  saveButton: { minHeight: 48, borderRadius: 10, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  saveButtonText: { ...typography.button, color: palette.white },
  supportButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, backgroundColor: palette.surface },
  supportButtonText: { ...typography.button, color: palette.primary, textAlign: "center" },
  logoutButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255, 125, 140, 0.16)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 125, 140, 0.14)" },
  logoutText: { ...typography.button, color: palette.danger },
  errorText: { ...typography.metadata, color: palette.danger },
  fieldHelper: { ...typography.metadata, color: palette.muted },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(1,15,25,0.56)", alignItems: "center", justifyContent: "center" },
  dropdownMenu: { width: "100%", maxWidth: 420, borderRadius: 12, padding: 12, backgroundColor: palette.surface },
  dropdownTitle: { ...typography.cardTitleStrong, color: palette.text, paddingHorizontal: 8, paddingVertical: 8 },
  dropdownOption: { minHeight: 48, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 },
  dropdownOptionText: { ...typography.bodyMedium, color: palette.muted },
  addressMapModal: { backgroundColor: palette.surface, borderRadius: 16, gap: 12, maxHeight: "92%", maxWidth: 560, padding: 16, width: "100%" },
  addressMapHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  addressMapClose: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  addressSearchRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  addressSearchInput: { flex: 1 },
  addressSearchButton: { alignItems: "center", backgroundColor: palette.primary, borderRadius: 8, justifyContent: "center", minHeight: 48, minWidth: 72, paddingHorizontal: 10 },
  addressSearchButtonText: { ...typography.button, color: palette.white },
  addressSearchResults: { borderColor: palette.outlineVariant, borderRadius: 8, borderWidth: 1, maxHeight: 132 },
  addressSearchResult: { borderBottomColor: palette.outlineVariant, borderBottomWidth: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8 },
  addressSearchResultText: { ...typography.bodyMedium, color: palette.text },
  dropdownOptionSelected: { ...typography.bodyMedium, color: palette.primary },
  dropdownOptionActive: { backgroundColor: "rgba(20, 217, 226, 0.12)" },
  capabilityActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  capabilityCancelButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: palette.primary },
  capabilityCancelText: { ...typography.button, color: palette.primary },
  capabilitySaveButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 14, borderRadius: 8, backgroundColor: palette.primary },
  capabilitySaveText: { ...typography.button, color: palette.white },
  reviewScore: { ...typography.badge, color: palette.muted }
});
