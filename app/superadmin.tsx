import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Href, useRouter } from "expo-router";
import { useApp } from "../src/context/AppContext";
import {
  correctLockedFullName,
  loadSuperadminOverview,
  moderateUserAccount,
  SuperadminOverview
} from "../src/services/adminService";
import { ModerationUser } from "../src/types";
import { colors } from "../src/theme";

const emptyOverview: SuperadminOverview = { users: [], reports: [], auditLogs: [] };

export default function SuperadminScreen() {
  const router = useRouter();
  const { currentUser, logout } = useApp();
  const [data, setData] = useState<SuperadminOverview>(emptyOverview);
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [correctionTarget, setCorrectionTarget] = useState<ModerationUser | null>(null);
  const [correctedName, setCorrectedName] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      setData(await loadSuperadminOverview());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load account controls.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openReports = useMemo(() => data.reports.filter((report) => report.status === "Open"), [data.reports]);
  const restrictedCount = useMemo(
    () => data.users.filter((user) => user.accountStatus === "suspended").length,
    [data.users]
  );

  async function run(key: string, action: () => Promise<unknown>) {
    setBusyKey(key);
    setError("");
    try {
      await action();
      await refresh();
      setReason("");
      setEvidenceReference("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to complete this action.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  function selectCorrection(user: ModerationUser) {
    setCorrectionTarget(user);
    setCorrectedName(user.fullName);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={styles.eyebrow}>TASKLINK SUPERADMIN</Text>
          <Text style={styles.title}>Account protection</Text>
          <Text style={styles.subtitle}>{currentUser?.fullName ?? "Superadministrator"}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/admin" as Href)} style={styles.reviewLink}>
            <Text style={styles.reviewLinkText}>Admin reviews</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.logout}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.stats}>
          <Stat label="Public accounts" value={data.users.length} />
          <Stat label="Restricted" value={restrictedCount} />
          <Stat label="Open reports" value={openReports.length} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.cardTitle}>Required moderation record</Text>
          <Text style={styles.help}>
            Give a clear reason. Restricting an account also requires an evidence reference or a linked violation report.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Decision reason (at least 10 characters)"
            multiline
            style={[styles.input, styles.multiline]}
          />
          <TextInput
            value={evidenceReference}
            onChangeText={setEvidenceReference}
            placeholder="Evidence URL, file path, or external reference"
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Section title="Open violation reports" empty="No open violation reports.">
          {openReports.map((report) => {
            const target = data.users.find((user) => user.id === report.targetUserId);
            return (
              <View key={report.id} style={styles.card}>
                <Text style={styles.cardTitle}>{report.category}: {target?.fullName ?? report.targetUserId}</Text>
                <Text style={styles.meta}>Report {report.id} · {formatDate(report.createdAt)}</Text>
                <Text style={styles.body}>{report.reason}</Text>
                <Action
                  label="Restrict from this report"
                  tone="danger"
                  disabled={Boolean(busyKey) || target?.accountStatus === "suspended"}
                  onPress={() => run(`report:${report.id}`, () => moderateUserAccount(
                    report.targetUserId,
                    "suspended",
                    reason,
                    evidenceReference,
                    report.id
                  ))}
                />
              </View>
            );
          })}
        </Section>

        <Section title="Employer and tasker accounts" empty="No public accounts found.">
          {data.users.map((user) => {
            const suspended = user.accountStatus === "suspended";
            return (
              <View key={user.id} style={styles.userRow}>
                <View style={styles.grow}>
                  <Text style={styles.cardTitle}>{user.fullName}</Text>
                  <Text style={styles.meta}>{user.role} · {user.accountStatus ?? "active"} · identity {user.identityStatus ?? "legacy"}</Text>
                  {user.restrictionReason ? <Text style={styles.body}>Restriction: {user.restrictionReason}</Text> : null}
                </View>
                <View style={styles.row}>
                  <Action
                    label={suspended ? "Reactivate" : "Restrict"}
                    tone={suspended ? "positive" : "danger"}
                    disabled={Boolean(busyKey)}
                    onPress={() => run(`account:${user.id}`, () => moderateUserAccount(
                      user.id,
                      suspended ? "active" : "suspended",
                      reason,
                      evidenceReference
                    ))}
                  />
                  <Action
                    label="Correct locked name"
                    tone="neutral"
                    disabled={Boolean(busyKey)}
                    onPress={() => selectCorrection(user)}
                  />
                </View>
              </View>
            );
          })}
        </Section>

        {correctionTarget ? (
          <View style={styles.notice}>
            <Text style={styles.sectionTitle}>Correct locked name</Text>
            <Text style={styles.help}>Selected: {correctionTarget.fullName}. Only approved identities can use this action.</Text>
            <TextInput value={correctedName} onChangeText={setCorrectedName} style={styles.input} />
            <View style={styles.row}>
              <Action
                label="Save correction"
                tone="warning"
                disabled={Boolean(busyKey)}
                onPress={() => run(`name:${correctionTarget.id}`, async () => {
                  await correctLockedFullName(
                    correctionTarget.id,
                    correctedName,
                    reason,
                    evidenceReference
                  );
                  setCorrectionTarget(null);
                  setCorrectedName("");
                })}
              />
              <Action label="Cancel" tone="neutral" disabled={Boolean(busyKey)} onPress={() => setCorrectionTarget(null)} />
            </View>
          </View>
        ) : null}

        <Section title="Recent immutable audit" empty="No moderation actions recorded.">
          {data.auditLogs.slice(0, 20).map((entry) => (
            <View key={entry.id} style={styles.auditRow}>
              <Text style={styles.cardTitle}>{entry.action.replaceAll("_", " ")}</Text>
              <Text style={styles.meta}>{entry.targetType}: {entry.targetId} · {formatDate(entry.createdAt)}</Text>
              {entry.reason ? <Text style={styles.body}>{entry.reason}</Text> : null}
            </View>
          ))}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(value?: string) {
  if (!value) return "unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.meta}>{label}</Text></View>;
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{hasChildren ? children : <Text style={styles.empty}>{empty}</Text>}</View>;
}

type Tone = "neutral" | "positive" | "warning" | "danger";
function Action({ label, tone, disabled, onPress }: { label: string; tone: Tone; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, styles[`action_${tone}`], disabled && styles.disabled]}>
      <Text style={[styles.actionText, tone !== "neutral" && styles.actionTextLight]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: colors.border },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 3 },
  subtitle: { color: colors.muted, marginTop: 2 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 },
  reviewLink: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
  reviewLinkText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  logout: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  logoutText: { color: colors.danger, fontWeight: "800", fontSize: 12 },
  content: { padding: 18, paddingBottom: 48, gap: 18 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, minWidth: 130, padding: 16, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.primary, fontSize: 26, fontWeight: "900" },
  notice: { backgroundColor: colors.infoLight, borderRadius: 14, padding: 16, gap: 10 },
  input: { minHeight: 44, backgroundColor: "#FFFFFF", borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12 },
  multiline: { minHeight: 76, textAlignVertical: "top" },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: "700" },
  section: { gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, lineHeight: 20 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 38, justifyContent: "center", alignItems: "center", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.mutedLight },
  action_neutral: { borderWidth: 1, borderColor: colors.border },
  action_positive: { backgroundColor: colors.success },
  action_warning: { backgroundColor: colors.warning },
  action_danger: { backgroundColor: colors.danger },
  actionText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  actionTextLight: { color: "#FFFFFF" },
  disabled: { opacity: 0.5 },
  empty: { color: colors.muted, padding: 16, backgroundColor: "#FFFFFF", borderRadius: 12 },
  userRow: { gap: 10, backgroundColor: "#FFFFFF", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  grow: { flex: 1 },
  auditRow: { backgroundColor: "#FFFFFF", borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 13, gap: 4 }
});
