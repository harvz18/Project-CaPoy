import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Href, useRouter } from "expo-router";
import { useApp } from "../src/context/AppContext";
import {
  getPrivateFileUrl,
  loadAdminAnalytics,
  reviewPayment,
  reviewWorkerVerification,
  subscribeToAdminData
} from "../src/services/adminService";
import {
  AdminAnalyticsRangePreset,
  AdminAnalyticsReport,
  AuditLog,
  Payment,
  Task,
  UserProfile,
  VerificationRequest
} from "../src/types";
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
  const [analytics, setAnalytics] = useState<AdminAnalyticsReport>();
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsPreset, setAnalyticsPreset] = useState<AdminAnalyticsRangePreset>("7d");
  const [analyticsStartDate, setAnalyticsStartDate] = useState(manilaToday());
  const [analyticsEndDate, setAnalyticsEndDate] = useState(manilaToday());
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);

  useEffect(() => subscribeToAdminData(setData, (subscriptionError) => setError(subscriptionError.message)), []);

  useEffect(() => {
    if (authority !== "admin" && authority !== "superadmin") {
      setAnalytics(undefined);
      setAnalyticsError("");
      setAnalyticsLoading(false);
      return;
    }
    let active = true;
    setAnalyticsLoading(true);
    setAnalyticsError("");
    loadAdminAnalytics({
      preset: analyticsPreset,
      ...(analyticsPreset === "custom" ? { startDate: analyticsStartDate, endDate: analyticsEndDate } : {})
    }).then((report) => {
      if (!active) return;
      setAnalytics(report);
    }).catch((analyticsFailure: unknown) => {
      if (!active) return;
      setAnalyticsError(analyticsFailure instanceof Error
        ? analyticsFailure.message
        : "Trusted analytics are unavailable.");
    }).finally(() => {
      if (active) setAnalyticsLoading(false);
    });
    return () => { active = false; };
  }, [authority, analyticsPreset, analyticsRefreshKey]);

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
            <Pressable accessibilityRole="button" onPress={() => router.push("/superadmin" as Href)} style={styles.controlLink}>
              <Text style={styles.controlLinkText}>Account controls</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.logout}><Text style={styles.logoutText}>Log out</Text></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AnalyticsPanel
          analytics={analytics}
          endDate={analyticsEndDate}
          error={analyticsError}
          loading={analyticsLoading}
          onEndDateChange={setAnalyticsEndDate}
          onPresetChange={setAnalyticsPreset}
          onRefresh={() => setAnalyticsRefreshKey((value) => value + 1)}
          onStartDateChange={setAnalyticsStartDate}
          preset={analyticsPreset}
          startDate={analyticsStartDate}
        />

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

const analyticsTaskStatuses: Task["status"][] = [
  "Finding Workers", "Applied", "Accepted", "In Progress", "Pending Approval",
  "Finished", "Archived", "Cancelled", "Disputed", "Expired"
];

function manilaToday() {
  return new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function optionalMetric(value: number | null, suffix = "") {
  return value === null ? "Unavailable" : `${value}${suffix}`;
}

function AnalyticsPanel({
  analytics,
  endDate,
  error,
  loading,
  onEndDateChange,
  onPresetChange,
  onRefresh,
  onStartDateChange,
  preset,
  startDate
}: {
  analytics?: AdminAnalyticsReport;
  endDate: string;
  error: string;
  loading: boolean;
  onEndDateChange: (value: string) => void;
  onPresetChange: (value: AdminAnalyticsRangePreset) => void;
  onRefresh: () => void;
  onStartDateChange: (value: string) => void;
  preset: AdminAnalyticsRangePreset;
  startDate: string;
}) {
  const latestDays = analytics?.daily.slice(-14) ?? [];
  return (
    <View style={styles.analyticsSection}>
      <View style={styles.analyticsHeader}>
        <View style={styles.analyticsHeaderCopy}>
          <Text style={styles.sectionTitle}>Trusted beta analytics</Text>
          <Text style={styles.help}>Sanitized aggregate values generated by an administrator-only Function. Dates use Asia/Manila.</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={loading} onPress={onRefresh} style={[styles.refreshButton, loading && styles.disabled]}>
          <Text style={styles.refreshButtonText}>{loading ? "Loading..." : "Refresh"}</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(["today", "7d", "30d", "custom"] as AdminAnalyticsRangePreset[]).map((value) => (
          <Pressable
            accessibilityRole="button"
            key={value}
            onPress={() => onPresetChange(value)}
            style={[styles.filterButton, preset === value && styles.filterButtonActive]}
          >
            <Text style={[styles.filterButtonText, preset === value && styles.filterButtonTextActive]}>
              {value === "today" ? "Today" : value === "7d" ? "7 days" : value === "30d" ? "30 days" : "Custom"}
            </Text>
          </Pressable>
        ))}
      </View>

      {preset === "custom" ? (
        <View style={styles.customRangeRow}>
          <TextInput accessibilityLabel="Analytics start date" onChangeText={onStartDateChange} placeholder="YYYY-MM-DD" style={styles.dateInput} value={startDate} />
          <TextInput accessibilityLabel="Analytics end date" onChangeText={onEndDateChange} placeholder="YYYY-MM-DD" style={styles.dateInput} value={endDate} />
          <Pressable accessibilityRole="button" disabled={loading} onPress={onRefresh} style={[styles.applyRangeButton, loading && styles.disabled]}>
            <Text style={styles.applyRangeButtonText}>Apply dates</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <View style={styles.analyticsUnavailable}>
          <Text style={styles.analyticsUnavailableTitle}>Trusted analytics unavailable</Text>
          <Text style={styles.help}>{error}</Text>
          <Text style={styles.help}>The callable analytics Function must be deployed before online values can be generated. No private-data client fallback is used.</Text>
        </View>
      ) : null}

      {analytics ? (
        <>
          <Text style={styles.analyticsStamp}>
            {analytics.range.label} · generated {formatDate(analytics.generatedAt)}{error ? " · showing last successful snapshot" : ""}
          </Text>

          <MetricGroup title="Current account snapshot" note="Current all-time account state; unaffected by the activity date filter.">
            <Stat label="Employers" value={analytics.accounts.employers} />
            <Stat label="Taskers" value={analytics.accounts.taskers} />
            <Stat label="Active accounts" value={analytics.accounts.active} />
            <Stat label="Restricted accounts" value={analytics.accounts.restricted} />
          </MetricGroup>

          <MetricGroup title="Current verification snapshot" note="Latest state of all submitted worker verification requests.">
            <Stat label="Pending" value={analytics.verification.pending} />
            <Stat label="Approved" value={analytics.verification.approved} />
            <Stat label="Rejected" value={analytics.verification.rejected} />
            <Stat label="Needs resubmission" value={analytics.verification.resubmission} />
          </MetricGroup>

          <MetricGroup title={`Workflow activity · ${analytics.range.label}`}>
            <Stat label="Posted" value={analytics.activity.posted} />
            <Stat label="Matched tasks" value={analytics.activity.matched} />
            <Stat label="Applications" value={analytics.activity.applications} />
            <Stat label="Accepted" value={analytics.activity.accepted} />
            <Stat label="Completed" value={analytics.activity.completed} />
            <Stat label="Cancelled" value={analytics.activity.cancelled} />
            <Stat label="Disputed" value={analytics.activity.disputed} />
          </MetricGroup>

          <View style={styles.analyticsCard}>
            <Text style={styles.cardTitle}>Current task lifecycle · {analytics.taskInventory.total} total</Text>
            {analyticsTaskStatuses.map((status) => (
              <BreakdownRow key={status} label={status} value={analytics.taskInventory.byStatus[status]} />
            ))}
          </View>

          <MetricGroup title={`Payment records created · ${analytics.range.label}`}>
            <Stat label="Pending" value={analytics.payments.Pending} />
            <Stat label="Submitted" value={analytics.payments.Submitted} />
            <Stat label="Verified" value={analytics.payments.Verified} />
            <Stat label="Rejected" value={analytics.payments.Rejected} />
            <Stat label="Unresolved GCash reviews" value={analytics.payments.unresolvedReviews} />
          </MetricGroup>

          <MetricGroup title="Matching and geofence funnel" note={analytics.matching.telemetryAvailable
            ? "Notification metrics use matching notifications created in the selected period."
            : "Matching notification telemetry has not been materialized, so notification metrics are unavailable rather than assumed to be zero."}>
            <Stat label="Eligible notifications" value={analytics.matching.telemetryAvailable ? analytics.matching.notificationsSent : "Unavailable"} />
            <Stat label="Opened" value={analytics.matching.telemetryAvailable ? analytics.matching.opened : "Unavailable"} />
            <Stat label="Converted to application" value={analytics.matching.telemetryAvailable ? analytics.matching.converted : "Unavailable"} />
            <Stat label="Open rate" value={optionalMetric(analytics.matching.openRatePercent, "%")} />
            <Stat label="Conversion rate" value={optionalMetric(analytics.matching.conversionRatePercent, "%")} />
            <Stat label="Avg. eligible taskers / post" value={optionalMetric(analytics.matching.averageEligibleTaskersPerPostedTask)} />
            <Stat label="Avg. minutes to first application" value={optionalMetric(analytics.matching.averageMinutesToFirstApplication)} />
            <Stat label="Avg. minutes to acceptance" value={optionalMetric(analytics.matching.averageMinutesToAcceptance)} />
          </MetricGroup>

          <View style={styles.analyticsCard}>
            <Text style={styles.cardTitle}>Posted task categories · {analytics.range.label}</Text>
            {analytics.activity.byCategory.length
              ? analytics.activity.byCategory.map((item) => <BreakdownRow key={item.category} label={item.category} value={item.count} />)
              : <Text style={styles.emptyInline}>No tasks were posted in this period.</Text>}
          </View>

          <View style={styles.analyticsCard}>
            <Text style={styles.cardTitle}>Daily activity {analytics.daily.length > 14 ? "· latest 14 days shown" : ""}</Text>
            {latestDays.map((day) => (
              <View key={day.date} style={styles.trendRow}>
                <Text style={styles.trendDate}>{day.date}</Text>
                <Text style={styles.trendValue}>Posts {day.posted} · Apps {day.applications} · Accepted {day.accepted} · Done {day.completed}</Text>
              </View>
            ))}
          </View>
        </>
      ) : loading ? <Text style={styles.analyticsLoading}>Generating sanitized analytics...</Text> : null}
    </View>
  );
}

function MetricGroup({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={styles.metricGroup}>
      <Text style={styles.cardTitle}>{title}</Text>
      {note ? <Text style={styles.help}>{note}</Text> : null}
      <View style={styles.stats}>{children}</View>
    </View>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return <View style={styles.breakdownRow}><Text style={styles.meta}>{label}</Text><Text style={styles.breakdownValue}>{value}</Text></View>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
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
  analyticsSection: { gap: 12 },
  analyticsHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  analyticsHeaderCopy: { flex: 1, gap: 4 },
  refreshButton: { minHeight: 40, borderRadius: 9, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  refreshButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterButton: { minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterButtonText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  filterButtonTextActive: { color: colors.white },
  customRangeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateInput: { minHeight: 42, minWidth: 140, flexGrow: 1, borderRadius: 9, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.card, color: colors.text },
  applyRangeButton: { minHeight: 42, borderRadius: 9, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  applyRangeButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  analyticsUnavailable: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningLight, gap: 4 },
  analyticsUnavailableTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  analyticsStamp: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  analyticsLoading: { color: colors.muted, padding: 16, textAlign: "center" },
  metricGroup: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 8 },
  analyticsCard: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 8 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, minWidth: 130, padding: 14, backgroundColor: colors.mutedLight, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  breakdownRow: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  breakdownValue: { color: colors.primary, fontWeight: "900" },
  emptyInline: { color: colors.muted, fontSize: 12, paddingVertical: 8 },
  trendRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 3 },
  trendDate: { color: colors.text, fontSize: 12, fontWeight: "900" },
  trendValue: { color: colors.muted, fontSize: 11, lineHeight: 16 },
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
