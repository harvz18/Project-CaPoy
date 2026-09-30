import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Href, useRouter } from "expo-router";
import { useApp } from "../src/context/AppContext";
import {
  getPrivateFileUrl,
  reviewPayment,
  reviewWorkerVerification,
  subscribeToAdminData
} from "../src/services/adminService";
import { AuditLog, Payment, Task, UserProfile, VerificationRequest } from "../src/types";
import { colors } from "../src/theme";

type AdminData = {
  verifications: VerificationRequest[];
  payments: Payment[];
  users: UserProfile[];
  tasks: Task[];
  auditLogs: AuditLog[];
};

const emptyData: AdminData = { verifications: [], payments: [], users: [], tasks: [], auditLogs: [] };

export default function AdminScreen() {
  const router = useRouter();
  const { authority, currentUser, logout } = useApp();
  const [data, setData] = useState<AdminData>(emptyData);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => subscribeToAdminData(setData, (subscriptionError) => setError(subscriptionError.message)), []);

  const pendingVerifications = useMemo(
    () => data.verifications.filter((item) => item.status === "Pending Verification"),
    [data.verifications]
  );
  const submittedPayments = useMemo(
    () => data.payments.filter((item) => item.paymentMethod === "GCash link" && item.paymentStatus === "Submitted"),
    [data.payments]
  );
  const disputedTasks = useMemo(() => data.tasks.filter((item) => item.status === "Disputed"), [data.tasks]);
  const recentAudit = useMemo(
    () => [...data.auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
    [data.auditLogs]
  );

  async function run(key: string, action: () => Promise<unknown>) {
    setBusyKey(key);
    setError("");
    try {
      await action();
      setReason("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to complete the administrator action.");
    } finally {
      setBusyKey("");
    }
  }

  async function openPrivateFile(path: string) {
    await run(`file:${path}`, async () => Linking.openURL(await getPrivateFileUrl(path)));
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const nameFor = (id?: string) => data.users.find((user) => user.id === id)?.fullName ?? id ?? "Unknown user";
  const taskFor = (id: string) => data.tasks.find((task) => task.id === id);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TASKLINK CONTROL</Text>
          <Text style={styles.title}>Administrator review</Text>
          <Text style={styles.subtitle}>{currentUser?.fullName ?? "Administrator"}</Text>
        </View>
        <View style={styles.headerActions}>
          {authority === "superadmin" ? (
            <Pressable onPress={() => router.push("/superadmin" as Href)} style={styles.controlLink}>
              <Text style={styles.controlLinkText}>Account controls</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={handleLogout} style={styles.logout}><Text style={styles.logoutText}>Log out</Text></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stats}>
          <Stat label="Worker checks" value={pendingVerifications.length} />
          <Stat label="Payment checks" value={submittedPayments.length} />
          <Stat label="Disputes" value={disputedTasks.length} />
          <Stat label="Users" value={data.users.filter((user) => user.role !== "admin").length} />
        </View>

        <View style={styles.reasonCard}>
          <Text style={styles.cardTitle}>Review note</Text>
          <Text style={styles.help}>Required for rejections and resubmission requests.</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Write a clear reason"
            multiline
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Section title="Worker verification queue" empty="No worker documents are waiting for review.">
          {pendingVerifications.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{nameFor(item.userId)}</Text>
              <Text style={styles.meta}>{item.validIdType} · submitted {formatDate(item.submittedAt)}</Text>
              <View style={styles.row}>
                <Action label="View ID" tone="neutral" disabled={Boolean(busyKey)} onPress={() => openPrivateFile(item.validIdPath)} />
                <Action label="View medical certificate" tone="neutral" disabled={Boolean(busyKey)} onPress={() => openPrivateFile(item.medicalCertificatePath)} />
              </View>
              <View style={styles.row}>
                <Action label="Approve" tone="positive" disabled={Boolean(busyKey)} onPress={() => run(`verify:${item.id}`, () => reviewWorkerVerification(item.userId, "Verified", reason))} />
                <Action label="Resubmit" tone="warning" disabled={Boolean(busyKey)} onPress={() => run(`resubmit:${item.id}`, () => reviewWorkerVerification(item.userId, "Needs Resubmission", reason))} />
                <Action label="Reject" tone="danger" disabled={Boolean(busyKey)} onPress={() => run(`reject-verification:${item.id}`, () => reviewWorkerVerification(item.userId, "Rejected", reason))} />
              </View>
            </View>
          ))}
        </Section>

        <Section title="GCash payment evidence" empty="No submitted GCash proof is waiting for review.">
          {submittedPayments.map((payment) => {
            const task = taskFor(payment.taskId);
            return (
              <View key={payment.id} style={styles.card}>
                <Text style={styles.cardTitle}>{task?.title ?? payment.taskId}</Text>
                <Text style={styles.meta}>Client: {nameFor(payment.clientId)} · Worker: {nameFor(payment.workerId)}</Text>
                <Text style={styles.body}>{payment.proofOfPaymentText || "No payment note"}</Text>
                {payment.proofOfPaymentUrl ? <Action label="Open payment proof" tone="neutral" disabled={Boolean(busyKey)} onPress={() => openPrivateFile(payment.proofOfPaymentUrl!)} /> : null}
                <View style={styles.row}>
                  <Action label="Verify payment" tone="positive" disabled={Boolean(busyKey)} onPress={() => run(`pay-ok:${payment.id}`, () => reviewPayment(payment.taskId, "Verified", reason))} />
                  <Action label="Reject payment" tone="danger" disabled={Boolean(busyKey)} onPress={() => run(`pay-no:${payment.id}`, () => reviewPayment(payment.taskId, "Rejected", reason))} />
                </View>
              </View>
            );
          })}
        </Section>

        <Section title="Disputed tasks" empty="No tasks are currently disputed.">
          {disputedTasks.map((task) => (
            <View key={task.id} style={styles.card}>
              <Text style={styles.cardTitle}>{task.title}</Text>
              <Text style={styles.meta}>{nameFor(task.clientId)} · {nameFor(task.workerId)} · {task.paymentStatus ?? "Pending payment"}</Text>
              <Text style={styles.body}>{task.description}</Text>
            </View>
          ))}
        </Section>

        <Section title="Recent audit log" empty="Administrator actions will appear here.">
          {recentAudit.map((entry) => (
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
    <Pressable disabled={disabled} onPress={onPress} style={[styles.action, styles[`action_${tone}`], disabled && styles.disabled]}>
      <Text style={[styles.actionText, tone !== "neutral" && styles.actionTextLight]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: colors.border },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 3 },
  subtitle: { color: colors.muted, marginTop: 2 },
  logout: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  logoutText: { color: colors.danger, fontWeight: "800" },
  headerActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  controlLink: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
  controlLinkText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  content: { padding: 18, paddingBottom: 48, gap: 18 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, minWidth: 130, padding: 16, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.primary, fontSize: 26, fontWeight: "900" },
  reasonCard: { backgroundColor: colors.infoLight, borderRadius: 14, padding: 16, gap: 8 },
  input: { minHeight: 76, backgroundColor: "#FFFFFF", borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, textAlignVertical: "top" },
  help: { color: colors.muted, fontSize: 13 },
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
  auditRow: { backgroundColor: "#FFFFFF", borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 13, gap: 4 }
});
