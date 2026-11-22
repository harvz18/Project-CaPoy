import Feather from "@expo/vector-icons/Feather";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../src/components/AppText";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LocationMap from "../src/components/LocationMap";
import { workerCapabilities } from "../src/constants/capabilities";
import { useApp } from "../src/context/AppContext";
import { calculateVerificationProgress } from "../src/domain/verificationProgress";
import { isIdentityLocked } from "../src/domain/profileIdentity";
import { pickAndUploadPrivateDocument, pickAndUploadProfilePhoto, UploadSource } from "../src/services/fileUploadService";
import { AddressSearchResult, reverseGeocodeSelectedPin, searchAddressOnMap } from "../src/services/reverseGeocoding";
import { refreshVerificationProgress, submitMissingVerificationDocuments, submitVerificationRequest, subscribeToVerificationRequest } from "../src/services/verificationService";
import type { VerificationRequest } from "../src/types";
import { parseCoordinate } from "../src/utils/location";
import { AddressDetails, formatAddressDetails } from "../src/utils/address";
import { PhilippineAddressPicker } from "../src/components/PhilippineAddressPicker";
import type { MapCoordinate } from "../src/components/LocationMap.types";

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
const validIdTypes = [
  "Philippine Identification (PhilSys) ID / ePhilID",
  "Driver's License (LTO)",
  "Passport (DFA)",
  "UMID / SSS ID",
  "PhilHealth ID",
  "TIN ID",
  "Postal ID",
  "Voter's ID / COMELEC Certificate",
  "PRC ID",
  "GSIS eCard",
  "Senior Citizen ID",
  "PWD ID"
];

export type ProfileManagementSection = "edit" | "work" | "service" | "verification" | "reviews" | "settings";

const managementTitles: Record<ProfileManagementSection, string> = {
  edit: "Edit Profile",
  work: "Work Information",
  service: "Service Area",
  verification: "Identity Verification",
  reviews: "Reviews & Ratings",
  settings: "Settings"
};

function getManagementSection(value: string | string[] | undefined): ProfileManagementSection {
  const section = Array.isArray(value) ? value[0] : value;
  return section && section in managementTitles ? section as ProfileManagementSection : "edit";
}

export function ProfileManagementContent({
  embeddedSection,
  hideHeader = false,
  onClose,
  onOpenPhoneVerification,
  onUnsavedChange
}: {
  embeddedSection?: ProfileManagementSection;
  hideHeader?: boolean;
  onClose?: () => void;
  onOpenPhoneVerification?: () => void;
  onUnsavedChange?: (dirty: boolean) => void;
} = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const section = embeddedSection ?? getManagementSection(params.section);
  const embedded = Boolean(embeddedSection);
  const insets = useSafeAreaInsets();
  const { actionLoading, currentUser, error, logout, ratings, tasks, users, updateProfile } = useApp();
  const [fullName, setFullName] = useState(currentUser?.fullName ?? "");
  const [mobileNumber, setMobileNumber] = useState(currentUser?.mobileNumber ?? "");
  const [addressDetails, setAddressDetails] = useState<AddressDetails>(() => ({
    region: currentUser?.region,
    regionCode: currentUser?.regionCode,
    province: currentUser?.province,
    provinceCode: currentUser?.provinceCode,
    cityMunicipality: currentUser?.cityMunicipality,
    cityMunicipalityCode: currentUser?.cityMunicipalityCode,
    barangay: currentUser?.barangay,
    barangayCode: currentUser?.barangayCode
  }));
  const [addressChanged, setAddressChanged] = useState(false);
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
  // Existing location pins remain available until the worker saves a dedicated service area.
  const [serviceAreaLatitude, setServiceAreaLatitude] = useState(String(currentUser?.serviceAreaLatitude ?? currentUser?.currentLatitude ?? ""));
  const [serviceAreaLongitude, setServiceAreaLongitude] = useState(String(currentUser?.serviceAreaLongitude ?? currentUser?.currentLongitude ?? ""));
  const [serviceAreaUpdatedAt, setServiceAreaUpdatedAt] = useState(currentUser?.serviceAreaUpdatedAt ?? currentUser?.locationUpdatedAt);
  const [locationMessage, setLocationMessage] = useState("");
  const [preferredRadiusKm, setPreferredRadiusKm] = useState(String(currentUser?.preferredRadiusKm ?? 5));
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false);
  const [skillDraft, setSkillDraft] = useState<string[]>([]);
  const [validIdTypePickerOpen, setValidIdTypePickerOpen] = useState(false);
  const [uploadSourceTarget, setUploadSourceTarget] = useState<"profile-photo" | "valid-id" | "selfie-with-id" | "medical-certificate" | "police-clearance">();
  const [selfieWithIdUrl, setSelfieWithIdUrl] = useState(currentUser?.selfieWithIdUrl ?? "");
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest>();
  const hasVerificationDocuments = Boolean(validIdUrl && selfieWithIdUrl && medicalCertificateUrl && policeClearanceUrl);
  const displayedVerificationStatus = currentUser?.verificationStatus === "Pending Verification" && !hasVerificationDocuments
    ? "Not Submitted"
    : currentUser?.verificationStatus ?? "Not Submitted";
  const fullNameLocked = isIdentityLocked(currentUser);
  const approvedDocumentLocked = (path: string, kind: "valid-id" | "selfie-with-id" | "medical-certificate" | "police-clearance") => {
    if (!path) return false;
    const documentStatus = verificationRequest?.documentReviews?.[kind]?.status;
    return documentStatus ? documentStatus === "Verified" : fullNameLocked;
  };
  const profileRatings = ratings
    .filter((rating) => rating.targetUserId === currentUser?.id)
    .map((rating) => ({
      ...rating,
      reviewerName: users.find((user) => user.id === rating.reviewerId)?.fullName ?? "TaskLink User",
      reviewContext: tasks.find((task) => task.id === rating.taskId)?.title ?? "Task review"
    }));
  const mapCenter = parseCoordinate(serviceAreaLatitude) !== undefined && parseCoordinate(serviceAreaLongitude) !== undefined
    ? { latitude: parseCoordinate(serviceAreaLatitude) as number, longitude: parseCoordinate(serviceAreaLongitude) as number }
    : undefined;
  const verificationProgress = currentUser ? calculateVerificationProgress(currentUser, verificationRequest) : undefined;
  const hasUnsavedChanges = section === "edit"
    ? fullName !== (currentUser?.fullName ?? "")
      || (currentUser?.role === "client" ? bio !== (currentUser.businessName ?? "") : experienceDescription !== (currentUser?.experienceDescription ?? ""))
      || addressChanged
    : section === "work"
      ? yearsOfExperience !== (currentUser?.yearsOfExperience ?? "") || experienceDescription !== (currentUser?.experienceDescription ?? "")
      : section === "service"
        ? parseCoordinate(serviceAreaLatitude) !== (currentUser?.serviceAreaLatitude ?? currentUser?.currentLatitude)
          || parseCoordinate(serviceAreaLongitude) !== (currentUser?.serviceAreaLongitude ?? currentUser?.currentLongitude)
          || Number(preferredRadiusKm) !== (currentUser?.preferredRadiusKm ?? 5)
        : section === "verification" ? documentsChanged : false;

  useEffect(() => {
    onUnsavedChange?.(hasUnsavedChanges);
    return () => onUnsavedChange?.(false);
  }, [hasUnsavedChanges, onUnsavedChange]);

  useEffect(() => {
    if (registrationBarangayLoaded.current || !currentUser?.address) return;
    registrationBarangayLoaded.current = true;
    // Old accounts keep their original free-form address until they choose a
    // structured replacement. Never guess its PSGC hierarchy.
    setAddressDetails((current) => current.barangay ? current : { ...current, barangay: currentUser.address });
  }, [currentUser?.address]);

  useEffect(() => {
    if (!currentUser?.id) {
      setVerificationRequest(undefined);
      return;
    }
    return subscribeToVerificationRequest(currentUser.id, setVerificationRequest, () => setVerificationRequest(undefined));
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || !["worker", "client"].includes(currentUser.role)) return;
    // Bring accounts created under an earlier percentage breakdown forward as
    // soon as their owner opens this screen. A failed refresh never blocks
    // profile viewing or editing.
    void refreshVerificationProgress().catch(() => undefined);
  }, [currentUser?.id, currentUser?.role]);

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
      const savedServiceAreaLatitude = parseCoordinate(serviceAreaLatitude);
      const savedServiceAreaLongitude = parseCoordinate(serviceAreaLongitude);
      const hasSavedServiceArea = savedServiceAreaLatitude !== undefined && savedServiceAreaLongitude !== undefined;
      await updateProfile({
        fullName: fullNameLocked ? undefined : fullName,
        address: detailedAddress || currentUser?.address || "",
        region: addressDetails.region,
        regionCode: addressDetails.regionCode,
        province: addressDetails.province,
        provinceCode: addressDetails.provinceCode,
        cityMunicipality: addressDetails.cityMunicipality,
        cityMunicipalityCode: addressDetails.cityMunicipalityCode,
        barangay: addressDetails.barangay,
        barangayCode: addressDetails.barangayCode,
        skills: currentUser?.role === "worker" ? skills : undefined,
        capabilities: currentUser?.role === "worker" ? skills : undefined,
        profilePhotoUrl,
        experienceDescription: currentUser?.role === "worker" ? experienceDescription : undefined,
        yearsOfExperience: currentUser?.role === "worker" ? yearsOfExperience : undefined,
        serviceAreaLatitude: currentUser?.role === "worker" ? savedServiceAreaLatitude : undefined,
        serviceAreaLongitude: currentUser?.role === "worker" ? savedServiceAreaLongitude : undefined,
        serviceAreaUpdatedAt: currentUser?.role === "worker" && hasSavedServiceArea
          ? serviceAreaUpdatedAt ?? new Date().toISOString()
          : undefined,
        preferredRadiusKm: currentUser?.role === "worker" ? Number(preferredRadiusKm) || 5 : undefined,
        businessName: currentUser?.role === "client" ? bio : undefined
      });
      setAddressChanged(false);
      if (currentUser && documentsChanged) {
        const verificationInput: Parameters<typeof submitVerificationRequest>[0] = {
          userId: currentUser.id,
          role: currentUser.role === "client" ? "client" : "worker",
          validIdType,
          validIdPath: validIdUrl,
          selfieWithIdPath: selfieWithIdUrl,
          medicalCertificatePath: medicalCertificateUrl,
          policeClearancePath: policeClearanceUrl
        };
        if (fullNameLocked) {
          await submitMissingVerificationDocuments(verificationInput);
        } else {
          await submitVerificationRequest(verificationInput);
        }
        setDocumentsChanged(false);
        setUploadMessage("Verification documents submitted for administrator review.");
      } else {
        setUploadMessage("Profile changes saved.");
      }
    } catch (saveError) {
      setUploadMessage(saveError instanceof Error ? saveError.message : "Unable to save this profile.");
    }
  }

  async function uploadProfilePhoto(source: UploadSource = "library") {
    if (!currentUser) return;
    setUploadingField("profile-photo");
    setUploadMessage("");
    try {
      const uploaded = await pickAndUploadProfilePhoto(currentUser.id, source);
      if (uploaded) {
        setProfilePhotoUrl(uploaded.url);
        await updateProfile({ profilePhotoUrl: uploaded.url });
        await refreshVerificationProgress();
        setUploadMessage("Profile photo uploaded and saved.");
      }
    } catch (uploadError) {
      setUploadMessage(uploadError instanceof Error ? uploadError.message : "Unable to upload profile photo.");
    } finally {
      setUploadingField(undefined);
    }
  }

  async function uploadVerificationDocument(kind: "valid-id" | "selfie-with-id" | "medical-certificate" | "police-clearance", source: UploadSource = "library") {
    if (!currentUser) return;
    setUploadingField(kind);
    setUploadMessage("");
    try {
      const uploaded = await pickAndUploadPrivateDocument(currentUser.id, kind, source);
      if (uploaded) {
        if (kind === "valid-id") setValidIdUrl(uploaded.path);
        else if (kind === "selfie-with-id") setSelfieWithIdUrl(uploaded.path);
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

  async function selectUploadSource(source: UploadSource) {
    const target = uploadSourceTarget;
    setUploadSourceTarget(undefined);
    if (target === "profile-photo") await uploadProfilePhoto(source);
    else if (target) await uploadVerificationDocument(target, source);
  }

  function openSkillSelector() {
    setSkillDraft(skills);
    setSkillDropdownOpen(true);
  }

  function toggleSkill(skill: string) {
    setSkillDraft((items) => (items.includes(skill) ? items.filter((item) => item !== skill) : [...items, skill]));
  }

  function selectValidIdType(value: string) {
    setValidIdType(value);
    setDocumentsChanged(true);
    setValidIdTypePickerOpen(false);
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

  function selectMapCoordinate(coordinate: { latitude: number; longitude: number }) {
    setServiceAreaLatitude(String(coordinate.latitude));
    setServiceAreaLongitude(String(coordinate.longitude));
    setServiceAreaUpdatedAt(new Date().toISOString());
    setLocationMessage("Service-area pin updated. Save changes to use it for Smart Match.");
  }

  function updateAddressDetail(field: keyof AddressDetails, value: string) {
    setAddressDetails((current) => ({ ...current, [field]: value }));
    setAddressChanged(true);
  }

  function applyAddressDetails(details: AddressDetails, message: string) {
    setAddressDetails((current) => ({
      ...details,
      city: "Bacolod City",
      // A building/house number is optional and commonly absent from map data;
      // never erase a value the user already entered manually.
      houseNumber: current.houseNumber?.trim() || details.houseNumber
    }));
    setAddressChanged(true);
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

  function handleBack() {
    if (!hasUnsavedChanges) {
      if (onClose) onClose();
      else router.back();
      return;
    }
    Alert.alert(
      "Discard unsaved changes?",
      "Changes on this screen have not been saved.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => onClose ? onClose() : router.back() }
      ]
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, embedded && styles.embeddedRoot]} edges={embedded ? [] : ["top", "left", "right"]}>
      {!hideHeader ? <View style={styles.managementHeader}>
        <Pressable accessibilityLabel="Back to Profile" accessibilityRole="button" onPress={handleBack} style={styles.managementHeaderButton}>
          <Feather accessibilityElementsHidden color={palette.textStrong} name="arrow-left" size={22} />
        </Pressable>
        <Text numberOfLines={1} style={styles.managementHeaderTitle}>{managementTitles[section]}</Text>
        <View style={styles.managementHeaderButton} />
      </View> : null}

      <ScrollView
        contentContainerStyle={[styles.content, embedded && styles.embeddedContent, { paddingBottom: embedded ? 12 : 28 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={embedded ? styles.embeddedScroll : undefined}
      >
        {section === "edit" ? <SettingsCard title="Personal Information">
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
            label="Mobile Number"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            placeholder="Mobile number"
          />
          <UploadField
            disabled={uploadingField === "profile-photo"}
            label="Profile Photo"
            uploading={uploadingField === "profile-photo"}
            value={profilePhotoUrl}
            placeholder="Tap to upload profile photo"
            onSelect={() => setUploadSourceTarget("profile-photo")}
          />
          <View style={styles.twoColumn}>
            <View style={styles.flex}><Field label="House / Building" value={addressDetails.houseNumber ?? ""} onChangeText={(value) => updateAddressDetail("houseNumber", value)} placeholder="Optional" /></View>
            <View style={styles.flex}><Field label="Street" value={addressDetails.street ?? ""} onChangeText={(value) => updateAddressDetail("street", value)} placeholder="Optional" /></View>
          </View>
          <PhilippineAddressPicker value={addressDetails} onChange={(value) => { setAddressDetails(value); setAddressChanged(true); }} />
          <View style={styles.flex}><Field label="Postal Code" value={addressDetails.postalCode ?? ""} onChangeText={(value) => updateAddressDetail("postalCode", value.replace(/\D/g, ""))} placeholder="Optional" /></View>
          <Pressable accessibilityRole="button" onPress={() => setAddressMapOpen(true)} style={styles.selectMapButton}>
            <Feather accessibilityElementsHidden color={palette.primary} name="map-pin" size={18} />
            <Text style={styles.selectMapButtonText}>Select on map</Text>
          </Pressable>
          <Text style={styles.helperText}>Choose Region, Province, City/Municipality, then Barangay. Map search can suggest details but never changes your task service-area restriction. House/building and postal code are optional.</Text>
          {addressLookupMessage ? <Text style={styles.locationMessage}>{addressLookupMessage}</Text> : null}
          <Field
            label={currentUser?.role === "client" ? "Business Bio" : "Worker Bio"}
            value={currentUser?.role === "client" ? bio : experienceDescription}
            onChangeText={currentUser?.role === "client" ? setBio : setExperienceDescription}
            placeholder="Tell people about yourself"
            multiline
          />
        </SettingsCard> : null}

        {section === "work" && currentUser?.role === "worker" ? (
          <View style={styles.settingsCard}>
            <View style={styles.workSkillsHeader}>
              <Text style={[styles.fieldLabel, styles.workFieldLabel]}>Skills & Services</Text>
              <Pressable accessibilityLabel="Add more worker capabilities" accessibilityRole="button" onPress={openSkillSelector} style={styles.addMoreButton}>
                <Text style={styles.addMoreText}>Add more</Text>
                <View pointerEvents="none" style={styles.addMoreUnderline} />
              </Pressable>
            </View>
            <View style={styles.skillRow}>
              {skills.length ? skills.map((skill) => (
                  <View key={skill} style={styles.skillChip}>
                  <Text style={styles.skillText}>{skill}</Text>
                  </View>
              )) : <Text style={styles.helperText}>No skills added yet.</Text>}
            </View>
            <Field emphasizedLabel label="Years of Experience" value={yearsOfExperience} onChangeText={setYearsOfExperience} placeholder="e.g. 2 years" />
            <Field
              emphasizedLabel
              label="Experience Description"
              value={experienceDescription}
              onChangeText={setExperienceDescription}
              placeholder="Describe your work experience"
              multiline
            />
          </View>
        ) : null}

        {section === "verification" && currentUser ? <View style={styles.settingsCard}>
              <View style={styles.verificationStatusRow}>
                <Text style={styles.settingTitle}>Status</Text>
                <View style={styles.verificationBadge}>
                  <Text style={styles.verificationBadgeText}>{displayedVerificationStatus}</Text>
                </View>
              </View>
              <Text style={styles.helperText}>{displayedVerificationStatus === "Pending Verification"
                ? "Your verification is pending administrator review after all required documents are submitted."
                : currentUser.verificationReviewReason || "Upload the four required documents, then save changes to submit them for review."}</Text>
              {verificationProgress ? <View style={styles.progressCard}>
                <View style={styles.verificationStatusRow}>
                  <Text style={styles.settingTitle}>Verification Progress</Text>
                  <Text style={styles.progressValue}>{verificationProgress.percentage}%</Text>
                </View>
                <View accessibilityLabel={`Verification progress ${verificationProgress.percentage}%`} style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${verificationProgress.percentage}%` }]} />
                </View>
                <Text style={styles.helperText}>{verificationProgress.level}. Only an administrator’s final review can mark an account as Verified.</Text>
                {verificationProgress.criteria.map((criterion) => <View key={criterion.label} style={styles.progressRow}>
                  <Feather accessibilityElementsHidden color={criterion.complete ? palette.success : palette.outline} name={criterion.complete ? "check-circle" : "circle"} size={16} />
                  <Text style={styles.progressLabel}>{criterion.label} ({criterion.percentage}%)</Text>
                </View>)}
                {(["valid-id", "selfie-with-id", "medical-certificate", "police-clearance"] as const).map((kind) => {
                  const review = verificationRequest?.documentReviews?.[kind];
                  return review?.reason && review.status !== "Verified" ? <Text key={kind} style={styles.progressReason}>{kind.replace(/-/g, " ")}: {review.reason}</Text> : null;
                })}
              </View> : null}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Valid ID Type</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: approvedDocumentLocked(validIdUrl, "valid-id") }}
                  disabled={approvedDocumentLocked(validIdUrl, "valid-id")}
                  onPress={() => setValidIdTypePickerOpen(true)}
                  style={[styles.idTypePicker, approvedDocumentLocked(validIdUrl, "valid-id") && styles.uploadDisabled]}
                >
                  <Text style={[styles.idTypePickerText, !validIdType && styles.uploadPlaceholder]} numberOfLines={2}>
                    {validIdType || "Choose a Philippine government-issued ID"}
                  </Text>
                  <Feather accessibilityElementsHidden color={palette.primary} name="chevron-down" size={20} />
                </Pressable>
              </View>
              <UploadField
                disabled={approvedDocumentLocked(validIdUrl, "valid-id") || uploadingField === "valid-id"}
                label="Valid ID"
                uploading={uploadingField === "valid-id"}
                value={validIdUrl}
                placeholder="Tap to upload valid ID"
                onSelect={() => setUploadSourceTarget("valid-id")}
              />
              <UploadField
                disabled={approvedDocumentLocked(selfieWithIdUrl, "selfie-with-id") || uploadingField === "selfie-with-id"}
                label="Selfie Holding the Same ID"
                uploading={uploadingField === "selfie-with-id"}
                value={selfieWithIdUrl}
                placeholder="Tap to upload a clear selfie with your ID"
                onSelect={() => setUploadSourceTarget("selfie-with-id")}
              />
              <UploadField
                disabled={approvedDocumentLocked(medicalCertificateUrl, "medical-certificate") || uploadingField === "medical-certificate"}
                label="Medical Certificate"
                uploading={uploadingField === "medical-certificate"}
                value={medicalCertificateUrl}
                placeholder="Tap to upload medical certificate"
                onSelect={() => setUploadSourceTarget("medical-certificate")}
              />
              <UploadField
                disabled={approvedDocumentLocked(policeClearanceUrl, "police-clearance") || uploadingField === "police-clearance"}
                label="Police Clearance"
                uploading={uploadingField === "police-clearance"}
                value={policeClearanceUrl}
                placeholder="Tap to upload police clearance"
                onSelect={() => setUploadSourceTarget("police-clearance")}
              />
              <Text style={styles.helperText}>{fullNameLocked
                ? "Approved documents are locked. Any missing document remains available for upload and will be sent for another administrator review."
                : "Upload a valid ID, a clear selfie holding that same ID, a medical certificate, and police clearance (images or PDFs up to 5 MB; selfie must be an image). Files are private; save changes after all four are ready to submit them for review."}</Text>
              {uploadMessage ? <Text style={styles.locationMessage}>{uploadMessage}</Text> : null}
            </View> : null}

        {section === "service" && currentUser?.role === "worker" ? <View style={styles.settingsCard}>
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
                height={260}
              />
              <Text style={styles.helperText}>Move or zoom the map, then tap or click to place your saved matching-area pin. Drag the pin to adjust it.</Text>
              <Text style={styles.helperText}>Smart Match uses this saved pin, not your live device location. Live GPS is requested only when starting or tracking an accepted task.</Text>
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
            </View> : null}

        {section === "reviews" ? <View style={styles.section}>
          {profileRatings.length ? (
            profileRatings.map((rating) => (
              <ReviewCard
                key={rating.id}
                initials={rating.reviewerName[0] ?? "U"}
                name={rating.reviewerName}
                date={rating.reviewContext}
                stars={rating.score}
                text={rating.feedback}
              />
            ))
          ) : (
            <View style={styles.reviewEmptyCard}>
              <Text style={styles.reviewEmptyText}>No reviews yet. Reviews from completed jobs will appear here.</Text>
            </View>
          )}
        </View> : null}

        {section === "settings" ? <>
          <SettingsCard title="Account">
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
          {currentUser ? <SettingsCard title="Account Security">
            <View style={styles.verificationStatusRow}>
              <Text style={styles.settingTitle}>Mobile number</Text>
              <View style={styles.verificationBadge}>
                <Text style={styles.verificationBadgeText}>{currentUser.phoneVerified ? "Verified" : "Not verified"}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => onOpenPhoneVerification ? onOpenPhoneVerification() : router.push("/phone-verification" as Href)} style={styles.locationButton}>
              <Text style={styles.locationButtonText}>{currentUser.phoneVerified ? "View mobile verification" : "Verify mobile number"}</Text>
            </Pressable>
          </SettingsCard> : null}
          <Pressable accessibilityRole="button" onPress={() => router.push("/help" as Href)} style={styles.supportButton}>
            <Text style={styles.supportButtonText}>Privacy, limitations, and beta support</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </> : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {uploadMessage && section !== "verification" ? <Text style={styles.locationMessage}>{uploadMessage}</Text> : null}
        {section === "edit" || section === "work" || section === "service" || section === "verification" ? (
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: actionLoading }} disabled={actionLoading} style={[styles.saveButton, actionLoading && styles.uploadDisabled]} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{actionLoading ? "Saving..." : "Save Changes"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>


      <Modal animationType="fade" transparent visible={skillDropdownOpen} onRequestClose={() => setSkillDropdownOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSkillDropdownOpen(false)}>
          <View style={styles.dropdownMenu}>
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

      <Modal animationType="fade" transparent visible={validIdTypePickerOpen} onRequestClose={() => setValidIdTypePickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setValidIdTypePickerOpen(false)}>
          <View style={styles.idTypeMenu}>
            <View style={styles.idTypeMenuHeader}>
              <View style={styles.flex}>
                <Text style={styles.dropdownTitle}>Valid ID Type</Text>
                <Text style={styles.helperText}>Choose the government-issued ID you are uploading.</Text>
              </View>
              <Pressable accessibilityLabel="Close valid ID type picker" accessibilityRole="button" onPress={() => setValidIdTypePickerOpen(false)} style={styles.addressMapClose}>
                <Feather color={palette.primary} name="x" size={22} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.idTypeOptions} showsVerticalScrollIndicator={false}>
              {validIdTypes.map((type) => {
                const selected = validIdType === type;
                return (
                  <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={type} onPress={() => selectValidIdType(type)} style={[styles.dropdownOption, selected && styles.dropdownOptionActive]}>
                    <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionSelected]}>{type}</Text>
                    {selected ? <Feather accessibilityElementsHidden color={palette.primary} name="check" size={20} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={Boolean(uploadSourceTarget)} onRequestClose={() => setUploadSourceTarget(undefined)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setUploadSourceTarget(undefined)}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownTitle}>{uploadSourceTarget === "profile-photo" ? "Profile Photo" : "Upload document"}</Text>
            <Text style={styles.helperText}>Use your camera or choose an existing file.</Text>
            <Pressable accessibilityRole="button" onPress={() => void selectUploadSource("camera")} style={styles.dropdownOption}>
              <Feather accessibilityElementsHidden color={palette.primary} name="camera" size={20} />
              <Text style={styles.dropdownOptionText}>Take a photo</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void selectUploadSource("library")} style={styles.dropdownOption}>
              <Feather accessibilityElementsHidden color={palette.primary} name="image" size={20} />
              <Text style={styles.dropdownOptionText}>{uploadSourceTarget === "profile-photo" ? "Choose from gallery" : "Choose image or PDF"}</Text>
            </Pressable>
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

export default function ProfileManagementScreen() {
  return <ProfileManagementContent />;
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
  helper,
  emphasizedLabel = false
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "decimal-pad";
  multiline?: boolean;
  editable?: boolean;
  helper?: string;
  emphasizedLabel?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, emphasizedLabel && styles.workFieldLabel]}>{label}</Text>
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
  uploading = false,
  value,
  placeholder,
  onSelect
}: {
  disabled?: boolean;
  label: string;
  uploading?: boolean;
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
          {selectedFile ? <Text style={styles.uploadMeta}>Uploaded — save changes to submit</Text> : null}
        </View>
        <View style={styles.uploadButton}>
          <Text style={styles.uploadButtonText}>{uploading ? "Uploading..." : disabled ? "Locked" : selectedFile ? "Change" : "Upload"}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function getUploadedFileName(value: string) {
  if (!value) return "";
  if (value.startsWith("http") || value.startsWith("data:image/")) return "Profile photo uploaded";
  return value.split("/").pop()?.replace(/^\d+_/, "") ?? value;
}

function ReviewCard({ initials, name, date, stars, text }: { initials: string; name: string; date: string; stars: number; text: string }) {
  const score = Number.isFinite(stars) ? Math.min(5, Math.max(0, stars)) : 0;
  const displayScore = score.toFixed(1);
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        <View style={styles.reviewPerson}>
          <View style={styles.reviewAvatar}>
            <Text style={styles.reviewAvatarText}>{initials}</Text>
          </View>
          <View style={styles.reviewPersonCopy}>
            <Text numberOfLines={2} style={styles.reviewName}>{name}</Text>
            <Text style={styles.reviewDate}>{date}</Text>
          </View>
        </View>
        <View accessibilityLabel={`${displayScore} out of 5 stars`} accessible style={styles.reviewRating}>
          <Feather accessibilityElementsHidden color={palette.secondary} name="star" size={16} />
          <Text style={styles.reviewScore}>{displayScore}</Text>
        </View>
      </View>
      {text.trim() ? <Text style={styles.reviewText}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  // The parent popup supplies the viewport. Fill it so every management
  // section (including long verification and service-area forms) is visible
  // and scrollable instead of collapsing.
  embeddedRoot: { flex: 1, minHeight: 0, backgroundColor: "transparent" },
  embeddedScroll: { flex: 1, minHeight: 0 },
  embeddedContent: { padding: 12, paddingTop: 0, gap: 12 },
  managementHeader: { minHeight: 56, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: "#EDF1EF" },
  managementHeaderButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  managementHeaderTitle: { flex: 1, color: palette.textStrong, fontSize: 20, lineHeight: 26, fontWeight: "700", textAlign: "center" },
  avatarText: { color: palette.secondary, fontWeight: "900" },
  content: { padding: 16, paddingTop: 24, gap: 16 },
  profileCard: { padding: 24, borderRadius: 12, borderWidth: 1, borderColor: "rgba(189,201,198,0.35)", backgroundColor: palette.surface, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  profileHeader: { alignItems: "center", gap: 20 },
  photoWrap: { position: "relative" },
  profilePhoto: { width: 132, height: 132, borderRadius: 66, borderWidth: 4, borderColor: palette.primaryFixed, backgroundColor: palette.secondaryContainer, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  profilePhotoImage: { width: "100%", height: "100%" },
  profilePhotoText: { color: "#684000", fontSize: 42, fontWeight: "900" },
  verifiedPill: { position: "absolute", right: -4, bottom: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: palette.success },
  verifiedText: { color: palette.white, fontSize: 10, fontWeight: "900" },
  profileCopy: { width: "100%", alignItems: "center", gap: 8 },
  profileName: { color: palette.textStrong, fontSize: 24, lineHeight: 32, fontWeight: "900", textAlign: "center" },
  ratingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  star: { color: palette.secondary, fontSize: 18, fontWeight: "900" },
  ratingValue: { color: palette.secondary, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  bio: { color: palette.muted, fontSize: 16, lineHeight: 24, textAlign: "center" },
  statsGrid: { flexDirection: "row", gap: 8, width: "100%", paddingTop: 8 },
  statBox: { alignItems: "center", backgroundColor: palette.surfaceContainer, borderRadius: 8, flex: 1, justifyContent: "center", minHeight: 82, paddingHorizontal: 8, paddingVertical: 10 },
  statLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, textAlign: "center" },
  statValue: { color: palette.primary, fontSize: 20, lineHeight: 28, fontWeight: "900", textAlign: "center" },
  settingsCard: { padding: 16, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant, gap: 12 },
  settingsTitle: { color: palette.textStrong, fontSize: 18, lineHeight: 26, fontWeight: "900" },
  settingsToggle: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  settingsSummary: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 1 },
  field: { gap: 6 },
  fieldLabel: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  workFieldLabel: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  input: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, color: palette.text, fontSize: 16, paddingHorizontal: 14 },
  inputDisabled: { color: palette.outline, backgroundColor: palette.surfaceContainer },
  textArea: { minHeight: 96, paddingTop: 12 },
  uploadInput: {
    minHeight: 50,
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
  idTypePicker: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow, color: palette.text, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14 },
  idTypePickerText: { flex: 1, color: palette.text, fontSize: 16, lineHeight: 21 },
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
  skillChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: palette.primaryContainer, borderWidth: 1, borderColor: "rgba(0,92,85,0.2)", flexDirection: "row", alignItems: "center", gap: 4 },
  skillText: { color: "#A3FAEF", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  workSkillsHeader: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  addMoreButton: { minHeight: 40, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  addMoreText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  addMoreUnderline: { alignSelf: "stretch", height: 1, marginTop: 1, backgroundColor: palette.primary },
  settingTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  verificationStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  verificationBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#EAF8F1" },
  verificationBadgeText: { color: palette.success, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  progressCard: { gap: 8, borderRadius: 10, padding: 12, backgroundColor: palette.surfaceLow, borderWidth: 1, borderColor: palette.outlineVariant },
  progressValue: { color: palette.primary, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: palette.surfaceHigh },
  progressFill: { height: "100%", minWidth: 0, borderRadius: 999, backgroundColor: palette.primary },
  progressRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  progressLabel: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 17 },
  progressReason: { color: palette.danger, fontSize: 12, lineHeight: 16 },
  serviceHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  availabilityChip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  availabilityChipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  availabilityText: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  availabilityTextSelected: { color: palette.white },
  locationButton: { minHeight: 44, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  locationButtonText: { color: palette.white, fontSize: 13, fontWeight: "900" },
  selectMapButton: { alignItems: "center", alignSelf: "flex-start", borderColor: palette.primary, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 42, paddingHorizontal: 14 },
  selectMapButtonText: { color: palette.primary, fontSize: 13, fontWeight: "900" },
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
  reviewCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(189,201,198,0.35)", backgroundColor: palette.surface, gap: 6 },
  reviewEmptyCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceLow },
  reviewEmptyText: { color: palette.muted, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  reviewTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  reviewPerson: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  reviewPersonCopy: { flex: 1, minWidth: 0 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.secondaryFixed, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  reviewAvatarText: { color: "#2A1700", fontWeight: "900" },
  reviewName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  reviewDate: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  reviewRating: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0, paddingTop: 1 },
  reviewText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
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
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: "rgba(24,28,28,0.32)", alignItems: "center", justifyContent: "center" },
  dropdownMenu: { width: "100%", maxWidth: 420, borderRadius: 12, padding: 12, backgroundColor: palette.surface },
  idTypeMenu: { width: "100%", maxWidth: 420, maxHeight: "78%", borderRadius: 12, padding: 12, backgroundColor: palette.surface },
  idTypeMenuHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 8, paddingBottom: 8 },
  idTypeOptions: { paddingBottom: 4 },
  dropdownTitle: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 8 },
  dropdownOption: { minHeight: 48, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 },
  dropdownOptionText: { color: palette.muted, fontSize: 16, lineHeight: 24, fontWeight: "700" },
  addressMapModal: { backgroundColor: palette.surface, borderRadius: 16, gap: 12, maxHeight: "92%", maxWidth: 560, padding: 16, width: "100%" },
  addressMapHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  addressMapClose: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  addressSearchRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  addressSearchInput: { flex: 1 },
  addressSearchButton: { alignItems: "center", backgroundColor: palette.primary, borderRadius: 8, justifyContent: "center", minHeight: 48, minWidth: 72, paddingHorizontal: 10 },
  addressSearchButtonText: { color: palette.white, fontSize: 13, fontWeight: "900" },
  addressSearchResults: { borderColor: palette.outlineVariant, borderRadius: 8, borderWidth: 1, maxHeight: 132 },
  addressSearchResult: { borderBottomColor: palette.outlineVariant, borderBottomWidth: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8 },
  addressSearchResultText: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  dropdownOptionSelected: { color: palette.primary, fontWeight: "900" },
  dropdownOptionActive: { backgroundColor: "#E5F1EE" },
  capabilityActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  capabilityCancelButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: palette.primary },
  capabilityCancelText: { color: palette.primary, fontSize: 13, fontWeight: "900" },
  capabilitySaveButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 14, borderRadius: 8, backgroundColor: palette.primary },
  capabilitySaveText: { color: palette.white, fontSize: 13, fontWeight: "900" },
  reviewScore: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: "800" }
});
