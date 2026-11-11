import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { MotionPressable as Pressable } from "./MotionPressable";
import { useRouter } from "expo-router";
import { useApp } from "../context/AppContext";
import { correctLockedFullName, loadSuperadminOverview, moderateUserAccount, reviewPayment, reviewWorkerVerification, subscribeToAdminData, SuperadminOverview } from "../services/adminService";
import { ModerationUser, Payment, UserProfile, VerificationRequest } from "../types";
import { colors, glass, shadows } from "../theme";
import { typography } from "../typography";
import { AppText as Text, AppTextInput as TextInput } from "./AppText";

type AdminData = { verifications: VerificationRequest[]; payments: Payment[]; users: UserProfile[]; tasks: unknown[]; auditLogs: unknown[] };
const blank: AdminData = { verifications: [], payments: [], users: [], tasks: [], auditLogs: [] };

export default function AdminWebDashboard() {
  const router = useRouter(); const { currentUser, logout } = useApp(); const [data, setData] = useState<AdminData>(blank); const [tab, setTab] = useState("Overview"); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  useEffect(() => subscribeToAdminData(setData, e => setError(e.message)), []);
  const requests = data.verifications.filter(x => x.status === "Pending Verification"); const payments = data.payments.filter(x => x.paymentStatus === "Submitted");
  async function review(key: string, work: () => Promise<unknown>) { if (!reason.trim()) { setError("Enter a review reason first."); return; } setBusy(key); try { await work(); setReason(""); } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); } finally { setBusy(""); } }
  return <Shell title="Administrator dashboard" user={currentUser?.fullName ?? "Administrator"} tab={tab} setTab={setTab} items={["Overview", "Accounts", "Verifications", "Payments"]} onLogout={() => void logout().then(() => router.replace("/login"))} error={error}>
    {tab === "Overview" ? <Metrics values={[["Live accounts", data.users.length], ["Verification queue", requests.length], ["Payment reviews", payments.length], ["Tasks", data.tasks.length]]} /> : null}
    {tab === "Accounts" ? <Panel title="Live user directory">{data.users.map(u => <Row key={u.id} title={u.fullName} detail={`${u.role === "worker" ? "Tasker" : "Employer"} · ${u.verificationStatus ?? "Not submitted"} · rating ${u.rating ?? 0}`} />)}{!data.users.length ? <Empty /> : null}</Panel> : null}
    {tab === "Verifications" ? <Panel title="Tasker and employer verification requests"><Reason value={reason} onChange={setReason} />{requests.map(r => <Row key={r.id} title={r.validIdType || "Identity verification"} detail={`Account ${r.userId.slice(0, 8)} · ${stamp(r.submittedAt)}`} actions={<><Button label="Verify" busy={busy === r.id} onPress={() => review(r.id, () => reviewWorkerVerification(r.userId, "Verified", reason.trim()))} /><Button label="Request update" quiet busy={busy === r.id} onPress={() => review(r.id, () => reviewWorkerVerification(r.userId, "Needs Resubmission", reason.trim()))} /><Button label="Reject" danger busy={busy === r.id} onPress={() => review(r.id, () => reviewWorkerVerification(r.userId, "Rejected", reason.trim()))} /></>} />)}{!requests.length ? <Empty /> : null}</Panel> : null}
    {tab === "Payments" ? <Panel title="Live GCash payment reviews"><Reason value={reason} onChange={setReason} />{payments.map(p => <Row key={p.id} title={p.agreedAmount ? `PHP ${p.agreedAmount}` : "Payment evidence"} detail={`Task ${p.taskId.slice(0, 8)} · ${stamp(p.updatedAt ?? p.createdAt)}`} actions={<><Button label="Verify" busy={busy === p.id} onPress={() => review(p.id, () => reviewPayment(p.taskId, "Verified", reason.trim()))} /><Button label="Reject" danger busy={busy === p.id} onPress={() => review(p.id, () => reviewPayment(p.taskId, "Rejected", reason.trim()))} /></>} />)}{!payments.length ? <Empty /> : null}</Panel> : null}
  </Shell>;
}

export function SuperadminWebDashboard() {
  const router = useRouter(); const { currentUser, logout } = useApp(); const [data, setData] = useState<SuperadminOverview>({ users: [], reports: [], auditLogs: [] }); const [tab, setTab] = useState("Overview"); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(""); const [nameUser, setNameUser] = useState<ModerationUser | null>(null); const [newName, setNewName] = useState("");
  const refresh = useCallback(() => loadSuperadminOverview().then(x => { setData(x); setError(""); }).catch(e => setError(e instanceof Error ? e.message : "Unable to load live data.")), []); useEffect(() => { void refresh(); const id = setInterval(() => void refresh(), 20000); return () => clearInterval(id); }, [refresh]);
  const open = useMemo(() => data.reports.filter(r => r.status === "Open"), [data.reports]);
  async function change(key: string, work: () => Promise<unknown>) { if (!reason.trim()) { setError("Enter a reason first."); return; } setBusy(key); try { await work(); setReason(""); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); } finally { setBusy(""); } }
  return <Shell title="Superadmin dashboard" user={currentUser?.fullName ?? "Superadministrator"} tab={tab} setTab={setTab} items={["Overview", "User management", "Reports", "Activity"]} onLogout={() => void logout().then(() => router.replace("/login"))} error={error}>
    {tab === "Overview" ? <Metrics values={[["All accounts", data.users.length], ["Taskers", data.users.filter(u => u.role === "worker").length], ["Employers", data.users.filter(u => u.role === "client").length], ["Open reports", open.length]]} /> : null}
    {tab === "User management" ? <Panel title="Live account management"><Reason value={reason} onChange={setReason} />{nameUser ? <View style={s.nameEditor}><TextInput accessibilityLabel="Corrected full name" value={newName} onChangeText={setNewName} placeholder="Correct full name" placeholderTextColor="#92B2C0" style={s.input} /><View style={s.actions}><Button label="Save name" busy={busy === `name-${nameUser.id}`} onPress={() => change(`name-${nameUser.id}`, () => correctLockedFullName(nameUser.id, newName.trim(), reason.trim()))} /><Button label="Cancel" quiet onPress={() => { setNameUser(null); setNewName(""); }} /></View></View> : null}{data.users.map(u => <Row key={u.id} title={u.fullName} detail={`${u.role === "worker" ? "Tasker" : "Employer"} · ${u.identityStatus ?? "Unverified"} · ${u.accountStatus ?? "active"}`} actions={<><Button label={u.accountStatus === "suspended" ? "Reactivate" : "Restrict"} danger={u.accountStatus !== "suspended"} busy={busy === u.id} onPress={() => change(u.id, () => moderateUserAccount(u.id, u.accountStatus === "suspended" ? "active" : "suspended", reason.trim()))} /><Button label="Correct name" quiet onPress={() => { setNameUser(u); setNewName(u.fullName); }} /></>} />)}{!data.users.length ? <Empty /> : null}</Panel> : null}
    {tab === "Reports" ? <Panel title="Live violation reports"><Reason value={reason} onChange={setReason} />{open.map(r => <Row key={r.id} title={`${r.category} report`} detail={r.reason} actions={<Button label="Restrict account" danger busy={busy === r.id} onPress={() => change(r.id, () => moderateUserAccount(r.targetUserId, "suspended", reason.trim(), "", r.id))} />} />)}{!open.length ? <Empty /> : null}</Panel> : null}
    {tab === "Activity" ? <Panel title="Live system activity">{data.auditLogs.map(x => <Row key={x.id} title={x.action} detail={`${x.targetType} · ${stamp(x.createdAt)}`} />)}{!data.auditLogs.length ? <Empty /> : null}</Panel> : null}
  </Shell>;
}

function Shell({ title, user, tab, setTab, items, onLogout, error, children }: any) { return <View style={s.page}><View style={s.side}><Text style={s.logo}>TASKLINK</Text><Text style={s.role}>{title.replace(" dashboard", "").toUpperCase()}</Text><View accessibilityRole="tablist" style={s.nav}>{items.map((x: string) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === x }} key={x} onPress={() => setTab(x)} style={[s.navItem, tab === x && s.active]}><Text style={[s.navText, tab === x && s.activeText]}>{x}</Text></Pressable>)}</View><Text style={s.user}>{user}</Text><Pressable accessibilityRole="button" onPress={onLogout} style={s.signOut}><Text style={s.out}>Sign out</Text></Pressable></View><ScrollView contentContainerStyle={s.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"><Text style={s.eyebrow}>LIVE TASKLINK DATA</Text><Text accessibilityRole="header" style={s.title}>{title}</Text>{error ? <Text accessibilityLiveRegion="assertive" style={s.error}>{error}</Text> : null}{children}</ScrollView></View>; }
function Metrics({ values }: { values: [string, number][] }) { return <View style={s.metrics}>{values.map(([l, v]) => <View key={l} style={s.metric}><Text style={s.value}>{v}</Text><Text style={s.label}>{l}</Text></View>)}</View>; }
function Panel({ title, children }: any) { return <View style={s.panel}><Text accessibilityRole="header" style={s.panelTitle}>{title}</Text>{children}</View>; } function Reason({ value, onChange }: any) { return <View><Text style={s.inputLabel}>Action reason</Text><TextInput accessibilityLabel="Action reason" accessibilityHint="Required before moderation, verification, or payment review actions." value={value} onChangeText={onChange} placeholder="Explain this action" placeholderTextColor="#92B2C0" style={s.input} /></View>; }
function Row({ title, detail, actions }: any) { return <View style={s.row}><View style={s.main}><Text style={s.rowTitle}>{title}</Text><Text style={s.detail}>{detail}</Text></View><View style={s.actions}>{actions}</View></View>; } function Button({ label, onPress, danger, quiet, busy }: any) { return <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onPress} style={[s.button, danger ? s.danger : quiet ? s.quiet : s.primary, busy && s.disabled]}><Text style={[s.buttonText, quiet && s.quietText]}>{busy ? "Saving..." : label}</Text></Pressable>; } function Empty() { return <Text accessibilityLiveRegion="polite" style={s.empty}>No live records available.</Text>; } function stamp(v?: string) { return v ? new Date(v).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"; }
const s = StyleSheet.create({
  page: { flex: 1, minHeight: "100vh" as unknown as number, flexDirection: "row", backgroundColor: colors.canvas },
  side: { width: 250, padding: 26, justifyContent: "space-between", backgroundColor: glass.solid, borderRightWidth: 1, borderRightColor: colors.border },
  logo: { ...typography.sectionTitle, color: colors.text, letterSpacing: 2 },
  role: { ...typography.overline, marginTop: 5, color: colors.accent },
  nav: { marginTop: 48, gap: 7 },
  navItem: { padding: 13, borderRadius: 12 },
  active: { backgroundColor: colors.primary, ...shadows.resting },
  navText: { ...typography.bodyMedium, color: colors.muted },
  activeText: { color: colors.white },
  user: { ...typography.badge, color: colors.text },
  signOut: { minHeight: 48, justifyContent: "center" },
  out: { ...typography.badge, color: colors.warning },
  content: { flexGrow: 1, width: "100%", maxWidth: 1400, padding: 42, gap: 20, backgroundColor: colors.background },
  eyebrow: { ...typography.overline, color: colors.accent, letterSpacing: 1.4 },
  title: { ...typography.screenTitle, color: colors.text },
  error: { padding: 12, borderRadius: 10, color: colors.danger, backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  metric: { minWidth: 170, flexGrow: 1, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.borderHighlight, backgroundColor: glass.elevated, ...shadows.raised },
  value: { ...typography.heroNumber, color: colors.text },
  label: { ...typography.fieldLabel, marginTop: 4, color: colors.muted },
  panel: { padding: 21, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 10, ...shadows.raised },
  panelTitle: { ...typography.cardTitleStrong, color: colors.text },
  input: { minHeight: 43, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: "rgba(3,35,52,0.62)" },
  inputLabel: { ...typography.fieldLabel, marginBottom: 6, color: colors.text },
  nameEditor: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: glass.standard },
  row: { paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: colors.border },
  main: { flex: 1 },
  rowTitle: { ...typography.cardTitleStrong, color: colors.text },
  detail: { ...typography.metadata, marginTop: 4, color: colors.muted },
  actions: { flexDirection: "row", gap: 6 },
  button: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.55 },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: "#C84F62" },
  quiet: { backgroundColor: glass.standard, borderWidth: 1, borderColor: colors.border },
  buttonText: { ...typography.button, color: colors.white },
  quietText: { color: colors.text },
  empty: { padding: 22, color: colors.muted, textAlign: "center" }
});
