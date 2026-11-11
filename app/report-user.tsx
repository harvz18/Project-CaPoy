import { useState } from "react";
import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, View } from "react-native";
import { MotionPressable as Pressable } from "../src/components/MotionPressable";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useApp } from "../src/context/AppContext";
import { useTasklinkBack } from "../src/hooks/useTasklinkBack";
import { submitViolationReport } from "../src/services/adminService";
import { colors } from "../src/theme";
import { ViolationReport } from "../src/types";
import { typography } from "../src/typography";
import { AppText as Text, AppTextInput as TextInput } from "../src/components/AppText";

const categories: ViolationReport["category"][] = ["Safety", "Fraud", "Harassment", "Payment", "Other"];

export default function ReportUserScreen() {
  const router = useRouter();
  const goBack = useTasklinkBack();
  const { targetUserId, taskId } = useLocalSearchParams<{ targetUserId?: string; taskId?: string }>();
  const { currentUser, getUserById } = useApp();
  const [category, setCategory] = useState<ViolationReport["category"]>("Safety");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const target = getUserById(targetUserId);

  async function submit() {
    if (!currentUser || !targetUserId) {
      setError("A signed-in reporting account and target user are required.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Describe what happened using at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitViolationReport({
        targetUserId,
        category,
        reason,
        evidenceReference: evidenceReference.trim() || undefined,
        taskId: taskId?.trim() || undefined
      });
      setConfirmation("Your report was recorded for superadministrator review.");
      setReason("");
      setEvidenceReference("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit this report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={goBack} style={styles.back}><Feather accessibilityElementsHidden color={colors.primary} name="arrow-left" size={22} /></Pressable>
        <Text style={styles.eyebrow}>TASKLINK SAFETY</Text>
        <Text style={styles.title}>Report a user</Text>
        <Text style={styles.subtitle}>
          Report concerning behavior involving {target?.fullName ?? "the other task participant"}. Reports are visible only to trusted reviewers.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {categories.map((item) => (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: category === item }} key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipSelected]}>
              <Text style={[styles.chipText, category === item && styles.chipTextSelected]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>What happened?</Text>
        <TextInput
          accessibilityLabel="What happened"
          accessibilityHint="Required. Describe the incident using at least 10 characters."
          value={reason}
          onChangeText={setReason}
          placeholder="Describe the incident clearly (at least 10 characters)"
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.details]}
        />

        <Text style={styles.label}>Evidence reference (optional)</Text>
        <TextInput
          accessibilityLabel="Evidence reference, optional"
          value={evidenceReference}
          onChangeText={setEvidenceReference}
          placeholder="Receipt number, file path, or other reference"
          style={styles.input}
        />
        {taskId ? <Text style={styles.meta}>Related task: {taskId}</Text> : null}
        <Text style={styles.meta}>{reason.trim().length} characters entered; minimum 10.</Text>
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        {confirmation ? <Text accessibilityLiveRegion="polite" style={styles.success}>{confirmation}</Text> : null}

        <Pressable accessibilityLabel="Submit report" accessibilityRole="button" accessibilityState={{ busy: submitting, disabled: submitting || Boolean(confirmation) }} disabled={submitting || Boolean(confirmation)} onPress={submit} style={[styles.submit, (submitting || Boolean(confirmation)) && styles.disabled]}>
          <Text style={styles.submitText}>{submitting ? "Submitting..." : confirmation ? "Report submitted" : "Submit report"}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  back: { alignSelf: "flex-start", paddingVertical: 8, paddingRight: 16 },
  backText: { ...typography.button, color: colors.primary },
  eyebrow: { ...typography.overline, color: colors.primary, letterSpacing: 1.2 },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted },
  card: { marginTop: 18, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(91, 169, 188, 0.18)", gap: 12 },
  label: { ...typography.fieldLabel, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.badge, color: colors.text },
  chipTextSelected: { color: "#FFFFFF" },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, backgroundColor: colors.background },
  details: { minHeight: 120 },
  meta: { ...typography.metadata, color: colors.muted },
  error: { ...typography.metadata, color: colors.danger },
  success: { ...typography.bodyMedium, color: colors.success },
  submit: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary },
  submitText: { ...typography.button, color: "#FFFFFF" },
  disabled: { opacity: 0.55 }
});
