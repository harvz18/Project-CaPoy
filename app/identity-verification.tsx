import Feather from "@expo/vector-icons/Feather";
import { Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../src/components/AppText";
import { useApp } from "../src/context/AppContext";
import { pickAndUploadPrivateDocument } from "../src/services/fileUploadService";
import { submitVerificationRequest } from "../src/services/verificationService";
import { colors, radii, spacing } from "../src/theme";
import type { Role } from "../src/types";

const validIdTypes = [
  "Philippine Identification (PhilSys) ID / ePhilID",
  "Driver's License (LTO)",
  "Passport (DFA)",
  "UMID",
  "Postal ID",
  "Voter's ID / Certificate of Registration",
  "PRC ID"
];

type CaptureKind = "valid-id" | "selfie-with-id";

function homeRoute(role: Role) {
  if (role === "admin") return "/admin" as Href;
  return (role === "worker" ? "/worker-dashboard" : "/client-dashboard") as Href;
}

export default function IdentityVerificationScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const [validIdType, setValidIdType] = useState(currentUser?.validIdType ?? "");
  const [validIdPath, setValidIdPath] = useState(currentUser?.validIdUrl ?? "");
  const [selfieWithIdPath, setSelfieWithIdPath] = useState(currentUser?.selfieWithIdUrl ?? "");
  const [idTypePickerOpen, setIdTypePickerOpen] = useState(false);
  const [capturing, setCapturing] = useState<CaptureKind>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const hasPriorityIdentityDocuments = Boolean(currentUser?.validIdUrl?.trim() && currentUser?.selfieWithIdUrl?.trim());

  useEffect(() => {
    if (!currentUser) router.replace("/login");
  }, [currentUser, router]);

  useEffect(() => {
    if (submitted && currentUser && hasPriorityIdentityDocuments) {
      router.replace(homeRoute(currentUser.role));
    }
  }, [currentUser, hasPriorityIdentityDocuments, router, submitted]);

  async function capture(kind: CaptureKind) {
    if (!currentUser || capturing || submitting) return;
    setCapturing(kind);
    setMessage("");
    try {
      const uploaded = await pickAndUploadPrivateDocument(currentUser.id, kind, "camera");
      if (!uploaded) return;
      if (kind === "valid-id") setValidIdPath(uploaded.path);
      else setSelfieWithIdPath(uploaded.path);
      setMessage(kind === "valid-id" ? "Government ID captured securely." : "Matching selfie captured securely.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to capture this document.");
    } finally {
      setCapturing(undefined);
    }
  }

  async function submit() {
    if (!currentUser || submitting) return;
    if (!validIdType || !validIdPath || !selfieWithIdPath) {
      setMessage("Choose an ID type and capture both your government ID and matching selfie.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await submitVerificationRequest({
        userId: currentUser.id,
        role: currentUser.role === "worker" ? "worker" : "client",
        validIdType,
        validIdPath,
        selfieWithIdPath
      });
      setSubmitted(true);
      setMessage("Identity documents submitted. Opening your home screen while the administrator reviews them…");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit your identity documents.");
      setSubmitting(false);
    }
  }

  if (!currentUser || (submitted && hasPriorityIdentityDocuments)) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Feather accessibilityElementsHidden color={colors.primary} name="shield" size={30} />
        </View>
        <Text style={styles.eyebrow}>ONE REQUIRED STEP</Text>
        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.copy}>Before entering TaskLink, take a clear photo of your government ID and a selfie while holding the same ID. An administrator will review both.</Text>

        <View style={styles.notice}>
          <Feather accessibilityElementsHidden color={colors.primary} name="lock" size={18} />
          <Text style={styles.noticeText}>Your ID and selfie are stored privately. Medical certificate and police clearance can be added later.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Government-issued ID type</Text>
          <Pressable accessibilityRole="button" onPress={() => setIdTypePickerOpen(true)} style={styles.selectButton}>
            <Text numberOfLines={2} style={[styles.selectText, !validIdType && styles.placeholder]}>{validIdType || "Choose your valid ID"}</Text>
            <Feather accessibilityElementsHidden color={colors.primary} name="chevron-down" size={20} />
          </Pressable>
        </View>

        <CaptureCard
          complete={Boolean(validIdPath)}
          description="Use your camera to capture the front of your selected government ID."
          disabled={Boolean(capturing) || submitting}
          icon="credit-card"
          loading={capturing === "valid-id"}
          onPress={() => void capture("valid-id")}
          title="Government ID"
        />
        <CaptureCard
          complete={Boolean(selfieWithIdPath)}
          description="Use the front camera. Keep your face and the same ID clearly visible in one photo."
          disabled={Boolean(capturing) || submitting}
          icon="camera"
          loading={capturing === "selfie-with-id"}
          onPress={() => void capture("selfie-with-id")}
          title="Selfie holding the same ID"
        />

        {message ? <Text accessibilityRole="status" style={[styles.message, submitted ? styles.successMessage : undefined]}>{message}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitting || Boolean(capturing)}
          onPress={() => void submit()}
          style={({ pressed }) => [styles.submitButton, (submitting || capturing) && styles.disabled, pressed && styles.pressed]}
        >
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Submit ID & Selfie</Text>}
        </Pressable>
        <Text style={styles.footer}>You can continue to your home screen immediately after submission while administrator review is pending.</Text>
      </ScrollView>

      <Modal animationType="fade" transparent visible={idTypePickerOpen} onRequestClose={() => setIdTypePickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIdTypePickerOpen(false)}>
          <Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.menu}>
            <Text style={styles.menuTitle}>Choose valid ID type</Text>
            {validIdTypes.map((type) => <Pressable accessibilityRole="button" key={type} onPress={() => { setValidIdType(type); setIdTypePickerOpen(false); }} style={styles.option}>
              <Text style={styles.optionText}>{type}</Text>
              {validIdType === type ? <Feather accessibilityElementsHidden color={colors.primary} name="check" size={18} /> : null}
            </Pressable>)}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function CaptureCard({ complete, description, disabled, icon, loading, onPress, title }: {
  complete: boolean;
  description: string;
  disabled: boolean;
  icon: "camera" | "credit-card";
  loading: boolean;
  onPress: () => void;
  title: string;
}) {
  return <View style={[styles.captureCard, complete && styles.captureComplete]}>
    <View style={styles.captureIcon}><Feather accessibilityElementsHidden color={colors.primary} name={complete ? "check-circle" : icon} size={22} /></View>
    <View style={styles.captureCopy}><Text style={styles.captureTitle}>{title}</Text><Text style={styles.captureDescription}>{description}</Text></View>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.cameraButton, disabled && styles.disabled, pressed && styles.pressed]}>
      {loading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.cameraText}>{complete ? "Retake" : "Camera"}</Text>}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center", padding: spacing.xl, gap: spacing.md },
  iconWrap: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, backgroundColor: colors.infoLight },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: "900" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  notice: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: "#8ED9CF", borderRadius: radii.md, backgroundColor: "#F2FFFC" },
  noticeText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  section: { gap: spacing.xs, marginTop: spacing.xs },
  label: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  selectButton: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: colors.card },
  selectText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  placeholder: { color: colors.muted, fontWeight: "500" },
  captureCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.card },
  captureComplete: { borderColor: "#83CDBE", backgroundColor: "#F7FFFC" },
  captureIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.infoLight },
  captureCopy: { flex: 1, minWidth: 0, gap: 2 },
  captureTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "800" },
  captureDescription: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  cameraButton: { minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.primary },
  cameraText: { color: colors.white, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  submitButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radii.md, marginTop: spacing.sm, backgroundColor: colors.primary },
  submitText: { color: colors.white, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  message: { color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  successMessage: { color: colors.success },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  disabled: { opacity: 0.58 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.45)", padding: spacing.lg },
  menu: { maxHeight: "78%", overflow: "hidden", borderRadius: radii.lg, backgroundColor: colors.card, paddingVertical: spacing.sm },
  menuTitle: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, color: colors.text, fontSize: 17, fontWeight: "900" },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E9E7", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  optionText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" }
});
