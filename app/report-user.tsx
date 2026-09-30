import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useApp } from "../src/context/AppContext";
import { submitViolationReport } from "../src/services/adminService";
import { colors } from "../src/theme";
import { ViolationReport } from "../src/types";

const categories: ViolationReport["category"][] = ["Safety", "Fraud", "Harassment", "Payment", "Other"];

export default function ReportUserScreen() {
  const router = useRouter();
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
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>Back</Text></Pressable>
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
            <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipSelected]}>
              <Text style={[styles.chipText, category === item && styles.chipTextSelected]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>What happened?</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Describe the incident clearly (at least 10 characters)"
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.details]}
        />

        <Text style={styles.label}>Evidence reference (optional)</Text>
        <TextInput
          value={evidenceReference}
          onChangeText={setEvidenceReference}
          placeholder="Receipt number, file path, or other reference"
          style={styles.input}
        />
        {taskId ? <Text style={styles.meta}>Related task: {taskId}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {confirmation ? <Text style={styles.success}>{confirmation}</Text> : null}

        <Pressable disabled={submitting || Boolean(confirmation)} onPress={submit} style={[styles.submit, (submitting || Boolean(confirmation)) && styles.disabled]}>
          <Text style={styles.submitText}>{submitting ? "Submitting..." : confirmation ? "Report submitted" : "Submit report"}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  back: { alignSelf: "flex-start", paddingVertical: 8, paddingRight: 16 },
  backText: { color: colors.primary, fontWeight: "800" },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  subtitle: { color: colors.muted, lineHeight: 20 },
  card: { marginTop: 18, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", gap: 12 },
  label: { color: colors.text, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  chipTextSelected: { color: "#FFFFFF" },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text, backgroundColor: colors.background },
  details: { minHeight: 120 },
  meta: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontWeight: "700" },
  success: { color: colors.success, fontWeight: "800" },
  submit: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary },
  submitText: { color: "#FFFFFF", fontWeight: "900" },
  disabled: { opacity: 0.55 }
});
