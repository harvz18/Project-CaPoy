import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Bell,
  BarChart3,
  CheckCircle2,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Flag,
  FileDown,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth";
import { firebaseConfigured } from "./firebase";
import {
  changeAccountStatus,
  deleteDemoUser,
  getAdminModerationUsers,
  getBasicDashboardCounts,
  getFeedbackCount,
  getRevenueAnalytics,
  getPlatformRevenueConfig,
  getSuperadminOverview,
  getVerificationDocumentUrl,
  loadPortalPage,
  loadPendingVerifications,
  loadProfilesById,
  loadSubmittedPayments,
  loadSubmittedPlatformFees,
  getPlatformFeeReceiptUrl,
  loadAuditLogPage,
  loadTasksById,
  PortalList,
  reviewPayment,
  reviewPlatformFee,
  reviewVerification,
  reviewVerificationDocument,
  resetDemoUser,
  updatePlatformRevenueConfig,
} from "./services";
import {
  AuditLog,
  BasicDashboardCounts,
  Payment,
  PlatformFee,
  RevenueAnalyticsRangePreset,
  RevenueAnalyticsReport,
  Profile,
  Rating,
  Task,
  TaskMatch,
  VerificationRequest,
  VerificationDocumentKind,
  ViolationReport,
} from "./types";

const USER_DELETION_MODE_KEY = "tasklink-superadmin-user-deletion-until";
const USER_DELETION_MODE_MS = 10 * 60 * 1000;

function userDeletionModeUntil() {
  try {
    const expiresAt = Number(window.sessionStorage.getItem(USER_DELETION_MODE_KEY));
    return Number.isFinite(expiresAt) && expiresAt > Date.now() ? expiresAt : 0;
  } catch {
    return 0;
  }
}

function enableUserDeletionMode() {
  const expiresAt = Date.now() + USER_DELETION_MODE_MS;
  window.sessionStorage.setItem(USER_DELETION_MODE_KEY, String(expiresAt));
  return expiresAt;
}
import "./styles.css";
import "./v5.css";

const PAGE_SIZE = 10;
type SortDirection = "asc" | "desc";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});
function date(value?: unknown) {
  if (!value) return "Date unavailable";
  const timestamp = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  const parsed = value instanceof Date
    ? value
    : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : typeof timestamp.toDate === "function"
        ? timestamp.toDate()
        : typeof timestamp.seconds === "number"
          ? new Date(timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds ?? 0) / 1_000_000))
          : new Date(NaN);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : DATE_FORMATTER.format(parsed);
}
function timestamp(value?: unknown) {
  if (!value) return 0;
  const candidate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  const parsed = value instanceof Date
    ? value
    : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : typeof candidate.toDate === "function"
        ? candidate.toDate()
        : typeof candidate.seconds === "number"
          ? new Date(candidate.seconds * 1000 + Math.floor((candidate.nanoseconds ?? 0) / 1_000_000))
          : new Date(NaN);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}
function sortByDate<T>(items: T[], getValue: (item: T) => unknown, direction: SortDirection) {
  return [...items].sort((left, right) => (timestamp(getValue(left)) - timestamp(getValue(right))) * (direction === "asc" ? 1 : -1));
}
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^Firebase: /, "")
    : "The request could not be completed.";
}
function roleLabel(role?: string) {
  return role === "worker" ? "Tasker" : role === "client" ? "Employer" : "—";
}
function taskTitle(task?: Task) {
  return task?.title || "Untitled task";
}
type Notice = { tone: "success" | "error"; message: string } | null;
type AnalyticsReport = Omit<RevenueAnalyticsReport, "daily"> & {
  accounts: { employers: number; taskers: number; active: number; restricted: number };
  verification: { pending: number; approved: number; rejected: number; resubmission: number };
  taskInventory: { total: number; byStatus: Record<string, number> };
  activity: { posted: number; applications: number; accepted: number; completed: number; cancelled: number; disputed: number; byCategory: Array<{ category: string; count: number }> };
  payments: { unresolvedReviews: number };
  daily: Array<{ date: string; posted: number; applications: number; completed: number; feeObligations: number; netRetainedRevenueCentavos: number }>;
};

function App() {
  if (!firebaseConfigured) return <ConfigurationRequired />;
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireStaff />}>
          <Route path="/admin/:section?" element={<Portal scope="admin" />} />
          <Route element={<RequireSuperadmin />}>
            <Route
              path="/superadmin/:section?"
              element={<Portal scope="superadmin" />}
            />
          </Route>
        </Route>
        <Route path="*" element={<EntryRedirect />} />
      </Routes>
    </AuthProvider>
  );
}

function ConfigurationRequired() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="brand">TASKLINK</p>
        <h1>Portal configuration required</h1>
        <p>
          Add the Firebase web configuration values to{" "}
          <code>admin-portal/.env</code>. Use the provided{" "}
          <code>.env.example</code> as the safe template; never add an Admin SDK
          key.
        </p>
      </section>
    </main>
  );
}
function EntryRedirect() {
  const { authority } = useAuth();
  if (authority === "loading") return <LoadingScreen />;
  if (authority === "superadmin")
    return <Navigate to="/superadmin/dashboard" replace />;
  if (authority === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (authority === "denied") return <DeniedScreen />;
  return <Navigate to="/login" replace />;
}
function RequireStaff() {
  const { authority } = useAuth();
  if (authority === "loading") return <LoadingScreen />;
  if (authority === "denied") return <DeniedScreen />;
  return authority === "admin" || authority === "superadmin" ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace />
  );
}
function RequireSuperadmin() {
  const { authority } = useAuth();
  return authority === "superadmin" ? (
    <Outlet />
  ) : (
    <Navigate to="/admin/dashboard" replace />
  );
}

function Login() {
  const { authority, signIn } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (authority === "admin") navigate("/admin/dashboard", { replace: true });
    if (authority === "superadmin")
      navigate("/superadmin/dashboard", { replace: true });
  }, [authority, navigate]);
  if (authority === "denied") return <DeniedScreen />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(mobile, password);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="brand">TASKLINK</p>
        <h1>Administration portal</h1>
        <p className="subtle">Sign in with an authorized staff account.</p>
        <form onSubmit={submit}>
          <label>
            Mobile number
            <input
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              autoComplete="username"
              inputMode="tel"
              placeholder="09123456789"
              required
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              type="password"
              required
            />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <button className="button primary full" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="spin" size={17} /> Signing in
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
function LoadingScreen() {
  return (
    <main className="auth-page">
      <LoaderCircle className="spin brand-icon" size={32} />
      <p>Restoring secure session…</p>
    </main>
  );
}
function DeniedScreen() {
  const { user, signOut } = useAuth();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="brand">TASKLINK</p>
        <h1>Access denied</h1>
        <p className="subtle">
          {user?.email || "This account"} is not authorized to use the TaskLink
          Administration Portal.
        </p>
        <button
          className="button secondary full"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

type Scope = "admin" | "superadmin";
const adminNavigation = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["revenue", "Revenue", TrendingUp],
  ["tasks", "Tasks", ListChecks],
  ["users", "Users", Users],
  ["insights", "Insights", Lightbulb],
  ["reports", "Reports", FileDown],
] as const;
const superNavigation = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["users", "Users", Users],
  ["tasks", "Tasks", ListChecks],
  ["applications", "Applications", FileText],
  ["verifications", "Identity review", ClipboardCheck],
  ["financial", "Financial review", TrendingUp],
  ["feedback", "Feedbacks", Star],
  ["reports", "Violation reports", Flag],
  ["audit", "Audit log", ShieldCheck],
  ["configuration", "Configurations", Settings],
] as const;

function Portal({ scope }: { scope: Scope }) {
  const { section = "dashboard" } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const navigation = scope === "superadmin" ? superNavigation : adminNavigation;
  const validSection = navigation.some(([id]) => id === section)
    ? section
    : "dashboard";
  useEffect(() => {
    if (section !== validSection)
      navigate(`/${scope}/${validSection}`, { replace: true });
  }, [section, validSection, navigate, scope]);
  return (
    <div className="portal-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <span className="brand">TASKLINK</span>
          <button
            className="icon-button close-menu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>
        <p className="portal-role">
          {scope === "superadmin" ? "SUPERADMIN PORTAL" : "ADMIN PORTAL"}
        </p>
        <nav>
          {navigation.map(([id, label, Icon]) => (
            <NavLink
              key={id}
              to={`/${scope}/${id}`}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `side-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>{user?.email}</p>
          <button className="logout" onClick={() => void signOut()}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
      <main className="workspace">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div>
            <p className="eyebrow">
              {scope === "superadmin" ? "SYSTEM OVERSIGHT" : "OPERATIONS"}
            </p>
            <h1>
              {navigation.find(([id]) => id === validSection)?.[1] ??
                "Dashboard"}
            </h1>
          </div>
          <div className="staff-chip">
            <ShieldCheck size={17} />
            <span>{scope === "superadmin" ? "Superadmin" : "Admin"}</span>
          </div>
          <button className="icon-button notification-button" aria-label="Notifications">
            <Bell size={18} /><span aria-hidden="true" />
          </button>
        </header>
        {notice ? (
          <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
        ) : null}
        <Page section={validSection} scope={scope} notify={setNotice} />
      </main>
    </div>
  );
}

function Page({
  section,
  scope,
  notify,
}: {
  section: string;
  scope: Scope;
  notify: (notice: Notice) => void;
}) {
  if (section === "dashboard") return <OperationsDashboard scope={scope} />;
  if (scope === "admin" && section === "revenue") return <RevenuePage />;
  if (scope === "admin" && section === "tasks") return <TasksPage scope="admin" />;
  if (scope === "admin" && section === "users") return <UsersPage scope="admin" notify={notify} />;
  if (scope === "admin" && section === "insights") return <DecisionSupportPage />;
  if (scope === "admin" && section === "reports") return <AnalyticsReportsPage />;
  if (scope === "superadmin" && section === "users") return <UsersPage scope={scope} notify={notify} />;
  if (scope === "superadmin" && section === "tasks") return <TasksPage scope="superadmin" />;
  if (scope === "superadmin" && section === "applications") return <ApplicationsPage />;
  if (scope === "superadmin" && section === "verifications") return <VerificationPage notify={notify} />;
  if (scope === "superadmin" && section === "financial") return <FinancialReviewPage notify={notify} />;
  if (scope === "superadmin" && section === "feedback") return <FeedbackPage />;
  if (scope === "superadmin" && section === "reports") return <ReportsPage notify={notify} />;
  if (scope === "superadmin" && section === "audit") return <AuditPage />;
  if (scope === "superadmin" && section === "configuration") return <ConfigurationPage />;
  return <Navigate to={`/${scope}/dashboard`} replace />;
}

function php(centavos: number) {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RevenuePage() {
  const [analytics, setAnalytics] = useState<RevenueAnalyticsReport | null>(null);
  const [preset, setPreset] = useState<RevenueAnalyticsRangePreset>("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setAnalytics(await getRevenueAnalytics(preset)); }
    catch (failure) { setError(errorText(failure)); }
    finally { setLoading(false); }
  }, [preset]);
  useEffect(() => { void load(); }, [load]);
  return <div className="page-stack">
    <div className="page-heading"><div><h2>TASKLINK service-fee revenue</h2><p>Only administrator-verified service fees count as collected revenue. Worker wages and unverified receipts are excluded.</p></div><button className="button secondary" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
    <div className="row-actions">{(["1d", "3d", "7d", "30d"] as RevenueAnalyticsRangePreset[]).map((value) => <button key={value} className={`button ${preset === value ? "primary" : "secondary"}`} onClick={() => setPreset(value)} disabled={loading}>{value === "1d" ? "1 day" : value === "3d" ? "3 days" : value === "7d" ? "1 week" : "1 month"}</button>)}</div>
    {loading && !analytics ? <SkeletonCards /> : null}
    {error && !analytics ? <ErrorState message={error} retry={() => void load()} /> : null}
    {analytics ? <>
      <p className="subtle">{analytics.range.label} · Asia/Manila · generated {date(analytics.generatedAt)}</p>
      <section className="metric-grid">
        <Metric label="Net retained" value={php(analytics.revenue.netRetainedRevenueCentavos)} icon={<CheckCircle2 />} />
        <Metric label="Gross verified" value={php(analytics.revenue.grossVerifiedCollectionsCentavos)} icon={<CheckCircle2 />} />
        <Metric label="Awaiting review" value={php(analytics.revenue.submittedForReviewCentavos)} icon={<ClipboardCheck />} />
        <Metric label="Outstanding obligations" value={php(analytics.revenue.outstandingFeeObligationsCentavos)} icon={<FileText />} />
      </section>
      <section className="dashboard-grid">
        <Panel title="Fee obligations" description="Selected-period obligations and their current review state."><Table headers={["Metric", "Amount / count"]}><tr><td>Pending employer payment</td><td>{php(analytics.revenue.pendingServiceFeesCentavos)}</td></tr><tr><td>Rejected fee submissions</td><td>{php(analytics.revenue.rejectedFeesCentavos)}</td></tr><tr><td>Outstanding fees</td><td>{analytics.revenue.outstandingFeeObligations} · {php(analytics.revenue.outstandingFeeObligationsCentavos)}</td></tr><tr><td>Tasks generating fees</td><td>{analytics.revenue.feeGeneratingTasks}</td></tr><tr><td>Refunds / credits</td><td>{php(analytics.revenue.refundsCentavos)}</td></tr></Table></Panel>
        <Panel title="Verified revenue by category" description="Only verified fee collections in the selected period."><Table headers={["Category", "Revenue"]}>{analytics.revenue.byCategory.map((item) => <tr key={item.category}><td>{item.category}</td><td>{php(item.feeCentavos)}</td></tr>)}</Table>{!analytics.revenue.byCategory.length ? <EmptyState title="No verified service fees yet" /> : null}</Panel>
        <Panel title="Revenue by month" description="Verified TASKLINK service fees in the selected period."><Table headers={["Month", "Revenue"]}>{analytics.revenue.byMonth.map((item) => <tr key={item.month}><td>{item.month}</td><td>{php(item.feeCentavos)}</td></tr>)}</Table>{!analytics.revenue.byMonth.length ? <EmptyState title="No verified service fees yet" /> : null}</Panel>
        <Panel title="Revenue by day" description="Net retained verified revenue after any recorded refunds or credits."><Table headers={["Date", "Fee tasks", "Net revenue"]}>{analytics.daily.map((item) => <tr key={item.date}><td>{item.date}</td><td>{item.feeObligations}</td><td>{php(item.netRetainedRevenueCentavos)}</td></tr>)}</Table></Panel>
      </section>
    </> : null}
  </div>;
}

function Dashboard({ scope }: { scope: Scope }) {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<BasicDashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCounts(await getBasicDashboardCounts());
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Live TaskLink overview</h2>
          <p>Current totals from the TaskLink database.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {loading && !counts ? <SkeletonCards /> : null}
      {error && !counts ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : null}
      {counts ? (
        <>
          <section className="metric-grid">
            <Metric label="Total users" value={counts.users} icon={<Users />} onClick={() => navigate(`/${scope}/users`)} />
            <Metric
              label="Employers"
              value={counts.employers}
              icon={<Users />}
              onClick={() => navigate(`/${scope}/users?role=client`)}
            />
            <Metric label="Taskers" value={counts.taskers} icon={<Users />} onClick={() => navigate(`/${scope}/users?role=worker`)} />
            <Metric
              label="Total tasks"
              value={counts.tasks}
              icon={<ListChecks />}
              onClick={() => navigate(`/${scope}/tasks`)}
            />
            <Metric
              label="Active tasks"
              value={counts.activeTasks}
              icon={<ListChecks />}
              onClick={() => navigate(`/${scope}/tasks?status=Finding%20Workers`)}
            />
            <Metric
              label="Completed tasks"
              value={counts.completedTasks}
              icon={<CheckCircle2 />}
              onClick={() => navigate(`/${scope}/tasks?status=Finished`)}
            />
            <Metric
              label="Payment records"
              value={counts.paymentRecords}
              icon={<FileText />}
            />
            <Metric
              label="Pending payments"
              value={counts.submittedPayments}
              icon={<FileText />}
            />
            <Metric
              label="Pending verification"
              value={counts.pendingVerifications}
              icon={<ClipboardCheck />}
              onClick={() => navigate(`/${scope}/verifications`)}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function useAnalytics(preset: RevenueAnalyticsRangePreset = "7d") {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setReport(await getRevenueAnalytics(preset) as AnalyticsReport); }
    catch (failure) { setError(errorText(failure)); }
    finally { setLoading(false); }
  }, [preset]);
  useEffect(() => { void reload(); }, [reload]);
  return { report, loading, error, reload };
}

function AnalyticsFilters({ preset, setPreset, reload, loading }: { preset: RevenueAnalyticsRangePreset; setPreset: (value: RevenueAnalyticsRangePreset) => void; reload: () => void; loading: boolean }) {
  return <div className="toolbar analytics-filters">
    {(["1d", "3d", "7d", "30d"] as RevenueAnalyticsRangePreset[]).map((value) => <button key={value} className={`button ${preset === value ? "primary" : "secondary"}`} onClick={() => setPreset(value)} disabled={loading}>{value === "1d" ? "1 day" : value === "3d" ? "3 days" : value === "7d" ? "1 week" : "1 month"}</button>)}
    <button className="button secondary" onClick={reload} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
  </div>;
}

function OperationsDashboard({ scope }: { scope: Scope }) {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<RevenueAnalyticsRangePreset>("7d");
  const { report, loading, error, reload } = useAnalytics(preset);
  if (loading && !report) return <div className="page-stack"><SkeletonCards /></div>;
  if (error && !report) return <div className="page-stack"><ErrorState message={error} retry={reload} /></div>;
  if (!report) return null;
  const active = Object.entries(report.taskInventory.byStatus).filter(([status]) => ["Finding Workers", "Applied", "Accepted", "In Progress", "Pending Approval"].includes(status)).reduce((sum, [, value]) => sum + value, 0);
  return <div className="page-stack">
    <div className="page-heading"><div><h2>Operations overview</h2><p>Trusted live metrics · {report.range.label} · Asia/Manila</p></div><AnalyticsFilters preset={preset} setPreset={setPreset} reload={reload} loading={loading} /></div>
    {error ? <ErrorState message={error} retry={reload} /> : null}
    <section className="metric-grid">
      <Metric label="Active tasks" value={active} icon={<ListChecks />} onClick={scope === "superadmin" ? () => navigate("/superadmin/tasks") : undefined} />
      <Metric label="Completed tasks" value={report.activity.completed} icon={<CheckCircle2 />} />
      <Metric label="Pending verifications" value={report.verification.pending} icon={<ClipboardCheck />} onClick={scope === "superadmin" ? () => navigate("/superadmin/verifications") : undefined} />
      <Metric label="Applications" value={report.activity.applications} icon={<FileText />} onClick={scope === "superadmin" ? () => navigate("/superadmin/applications") : undefined} />
    </section>
    <section className="dashboard-grid">
      <Panel title="Completed tasks over time" description="Completed lifecycle events in the selected period."><MiniBarChart values={report.daily.map((row) => ({ label: row.date.slice(5), value: row.completed }))} empty="No completed tasks in this period." /></Panel>
      <Panel title="Task status distribution" description="Current status of all TaskLink tasks."><StatusDistribution statuses={report.taskInventory.byStatus} /></Panel>
      <Panel title={scope === "superadmin" ? "Governance queue" : "Operational backlog"} description={scope === "superadmin" ? "Open records needing authorized review." : "Read-only workload indicators."}><QueueSummary report={report} scope={scope} navigate={navigate} /></Panel>
      <Panel title="Most requested categories" description="Live task-posting demand in the selected period."><HorizontalBars values={report.activity.byCategory.map((item) => ({ label: item.category, value: item.count }))} empty="No task postings in this period." /></Panel>
    </section>
  </div>;
}

function MiniBarChart({ values, empty }: { values: Array<{ label: string; value: number }>; empty: string }) {
  const max = Math.max(...values.map((item) => item.value), 0);
  if (!max) return <EmptyState title={empty} />;
  return <div className="mini-bars" aria-label="Bar chart">{values.map((item) => <div className="mini-bar-item" key={item.label}><span className="mini-bar-value">{item.value}</span><div className="mini-bar-track"><i style={{ height: `${Math.max(7, (item.value / max) * 100)}%` }} /></div><small>{item.label}</small></div>)}</div>;
}
function HorizontalBars({ values, empty }: { values: Array<{ label: string; value: number }>; empty: string }) {
  const max = Math.max(...values.map((item) => item.value), 0);
  if (!max) return <EmptyState title={empty} />;
  return <div className="horizontal-bars">{values.slice(0, 6).map((item) => <div className="horizontal-bar" key={item.label}><span>{item.label}</span><div><i style={{ width: `${(item.value / max) * 100}%` }} /></div><strong>{item.value}</strong></div>)}</div>;
}
function StatusDistribution({ statuses }: { statuses: Record<string, number> }) {
  const entries = Object.entries(statuses).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return <EmptyState title="No task statuses available." />;
  const colors = ["#007d67", "#159b74", "#6fc8b6", "#b8eee0", "#d0e1dd", "#e1a532"];
  let offset = 0;
  const stops = entries.map(([, value], index) => { const start = offset; offset += (value / total) * 100; return `${colors[index % colors.length]} ${start}% ${offset}%`; });
  return <div className="donut-layout"><div className="donut" style={{ background: `conic-gradient(${stops.join(",")})` }}><strong>{total}</strong><small>tasks</small></div><div className="chart-legend">{entries.slice(0, 6).map(([label, value], index) => <p key={label}><i style={{ background: colors[index % colors.length] }} />{label}<b>{Math.round((value / total) * 100)}%</b></p>)}</div></div>;
}
function QueueSummary({ report, scope, navigate }: { report: AnalyticsReport; scope: Scope; navigate: ReturnType<typeof useNavigate> }) {
  const rows = [["Identity reviews", report.verification.pending, "verifications"], ["Payment reviews", report.payments.unresolvedReviews, "financial"], ["Platform-fee reviews", report.revenue.submittedForReviewCentavos, "financial"], ["Open disputes", report.activity.disputed, "feedback"]] as const;
  return <div className="queue-list">{rows.map(([label, value, route]) => <button key={label} className="queue-row" disabled={scope !== "superadmin"} onClick={() => navigate(`/superadmin/${route}`)}><span>{label}</span><b>{label === "Platform-fee reviews" ? php(value) : value}</b><small>{scope === "superadmin" ? "Review" : "Read-only"}</small></button>)}</div>;
}

function AnalyticsPage({ kind }: { kind: "tasks" | "users" | "categories" }) {
  const [preset, setPreset] = useState<RevenueAnalyticsRangePreset>("30d");
  const { report, loading, error, reload } = useAnalytics(preset);
  const labels = { tasks: ["Task analytics", "Task activity and lifecycle performance based on recorded events."], users: ["User analytics", "Registered account and participation indicators."], categories: ["Category trends", "Demand and platform-fee trends by actual task category."] } as const;
  if (loading && !report) return <div className="page-stack"><SkeletonCards /></div>;
  if (error && !report) return <div className="page-stack"><ErrorState message={error} retry={reload} /></div>;
  if (!report) return null;
  const content = kind === "tasks" ? <><section className="metric-grid"><Metric label="Posted" value={report.activity.posted} icon={<FileText />} /><Metric label="Completed" value={report.activity.completed} icon={<CheckCircle2 />} /><Metric label="Cancelled" value={report.activity.cancelled} icon={<X />} /><Metric label="Completion rate" value={report.activity.posted ? `${Math.round((report.activity.completed / report.activity.posted) * 100)}%` : "—"} icon={<TrendingUp />} /></section><section className="dashboard-grid"><Panel title="Task activity by date"><MiniBarChart values={report.daily.map((row) => ({ label: row.date.slice(5), value: row.posted }))} empty="No task postings in this period." /></Panel><Panel title="Task status distribution"><StatusDistribution statuses={report.taskInventory.byStatus} /></Panel></section></> : kind === "users" ? <><section className="metric-grid"><Metric label="Employers" value={report.accounts.employers} icon={<Users />} /><Metric label="Taskers" value={report.accounts.taskers} icon={<Users />} /><Metric label="Active accounts" value={report.accounts.active} icon={<CheckCircle2 />} /><Metric label="Applications" value={report.activity.applications} icon={<FileText />} /></section><Panel title="Engagement indicators" description="Uses recorded applications and account state; it does not infer activity where data is absent."><Table headers={["Indicator", "Value", "Calculation basis"]}><tr><td>Average applications per posted task</td><td>{report.activity.posted ? (report.activity.applications / report.activity.posted).toFixed(1) : "—"}</td><td>Applications created ÷ tasks posted in selected period</td></tr><tr><td>Active-account share</td><td>{report.accounts.employers + report.accounts.taskers ? `${Math.round((report.accounts.active / (report.accounts.employers + report.accounts.taskers)) * 100)}%` : "—"}</td><td>Accounts with active or pending-verification state</td></tr></Table></Panel></> : <><section className="dashboard-grid"><Panel title="Demand by category"><HorizontalBars values={report.activity.byCategory.map((item) => ({ label: item.category, value: item.count }))} empty="No category demand data in this period." /></Panel><Panel title="Verified fee revenue by category"><HorizontalBars values={report.revenue.byCategory.map((item) => ({ label: item.category, value: item.feeCentavos }))} empty="No verified platform-fee revenue in this period." /></Panel></section></>;
  return <div className="page-stack"><div className="page-heading"><div><h2>{labels[kind][0]}</h2><p>{labels[kind][1]} {report.range.label} · Asia/Manila.</p></div><AnalyticsFilters preset={preset} setPreset={setPreset} reload={reload} loading={loading} /></div>{error ? <ErrorState message={error} retry={reload} /> : null}{content}</div>;
}

function TaskCategoryInsights() {
  const { report, loading, error, reload } = useAnalytics("30d");
  return <Panel title="Category insights" description="Live demand and completed-task indicators for the last 30 days." action={<button className="button secondary" onClick={reload} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>}>
    {error ? <ErrorState message={error} retry={reload} /> : null}
    {!report && loading ? <TableLoading /> : null}
    {report ? <div className="dashboard-grid"><div><h4>Most requested categories</h4><HorizontalBars values={report.activity.byCategory.map((item) => ({ label: item.category, value: item.count }))} empty="No category demand data in this period." /></div><div><h4>Completion and demand</h4><Table headers={["Metric", "Value"]}><tr><td>Tasks posted</td><td>{report.activity.posted}</td></tr><tr><td>Tasks completed</td><td>{report.activity.completed}</td></tr><tr><td>Completion rate</td><td>{report.activity.posted ? `${Math.round((report.activity.completed / report.activity.posted) * 100)}%` : "—"}</td></tr></Table></div></div> : null}
  </Panel>;
}

function DecisionSupportPage() {
  const [preset, setPreset] = useState<RevenueAnalyticsRangePreset>("30d"); const { report, loading, error, reload } = useAnalytics(preset);
  if (loading && !report) return <div className="page-stack"><SkeletonCards /></div>; if (error && !report) return <div className="page-stack"><ErrorState message={error} retry={reload} /></div>; if (!report) return null;
  const top = report.activity.byCategory[0]; const insights = [
    top ? ["Highest task demand", `${top.category} has ${top.count} posted task${top.count === 1 ? "" : "s"} in ${report.range.label.toLowerCase()}.`, "Review worker capability coverage and recruitment for this category.", "tasks.category + tasks.createdAt"] : null,
    report.activity.posted ? ["Task completion", `${report.activity.completed} of ${report.activity.posted} posted tasks were completed in the selected period.`, "Review categories with lower completion and identify workflow bottlenecks.", "tasks.createdAt + tasks.finishedAt"] : null,
    report.activity.posted ? ["Application coverage", `${report.activity.applications} application${report.activity.applications === 1 ? "" : "s"} were recorded across ${report.activity.posted} posted task${report.activity.posted === 1 ? "" : "s"}.`, "Prioritize outreach or simplify task requirements where applications remain low.", "taskMatches.createdAt + tasks.createdAt"] : null,
    ["Worker engagement", `${report.activity.applications} application activity record${report.activity.applications === 1 ? "" : "s"} was logged in ${report.range.label.toLowerCase()}.`, "Monitor whether the available tasker base is responding to posted work.", "taskMatches.createdAt"],
    ["Verification backlog", `${report.verification.pending} identity record(s) are awaiting review.`, "Schedule authorized Superadmin review capacity when the queue grows.", "verificationRequests.status"],
    ["Cancellation pattern", `${report.activity.cancelled} task cancellation${report.activity.cancelled === 1 ? "" : "s"} was recorded in the selected period.`, "Review cancellation reasons and task terms when the count increases.", "tasks.status + tasks.updatedAt"],
    ["Fee collection backlog", `${php(report.revenue.outstandingFeeObligationsCentavos)} remains outstanding across ${report.revenue.outstandingFeeObligations} obligation(s).`, "Monitor follow-up policy; only verified amounts are counted as revenue.", "platformFees.status + verifiedAt"]
  ].filter(Boolean) as string[][];
  return <div className="page-stack"><div className="page-heading"><div><h2>Insights</h2><p>Explainable descriptive insights only; no predictions are generated.</p></div><AnalyticsFilters preset={preset} setPreset={setPreset} reload={reload} loading={loading} /></div>{error ? <ErrorState message={error} retry={reload} /> : null}<section className="insight-grid">{insights.map(([title, metric, action, source]) => <article className="insight-card" key={title}><Lightbulb size={19} /><h3>{title}</h3><p><strong>{metric}</strong></p><p>{action}</p><small>Source: {source}</small></article>)}</section></div>;
}

function AnalyticsReportsPage() {
  const { report, loading, error, reload } = useAnalytics("30d");
  const exportReport = () => { if (!report) return; const lines = [["Metric", "Value"], ["Period", report.range.label], ["Tasks posted", report.activity.posted], ["Tasks completed", report.activity.completed], ["Applications", report.activity.applications], ["Verified platform revenue", php(report.revenue.netRetainedRevenueCentavos)], ["Outstanding platform fees", php(report.revenue.outstandingFeeObligationsCentavos)]].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([lines], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = `tasklink-operational-report-${report.range.startDate}-to-${report.range.endDate}.csv`; link.click(); URL.revokeObjectURL(url); };
  return <div className="page-stack"><div className="page-heading"><div><h2>Reports</h2><p>Export only the displayed, authorized operational summary.</p></div><button className="button primary" onClick={exportReport} disabled={!report || loading}><FileDown size={16} /> Export CSV</button></div>{loading && !report ? <SkeletonCards /> : null}{error ? <ErrorState message={error} retry={reload} /> : null}{report ? <Panel title="Operational summary" description={`${report.range.label} · generated from trusted analytics.`}><Table headers={["Metric", "Value"]}><tr><td>Tasks posted</td><td>{report.activity.posted}</td></tr><tr><td>Tasks completed</td><td>{report.activity.completed}</td></tr><tr><td>Applications</td><td>{report.activity.applications}</td></tr><tr><td>Verified platform revenue</td><td>{php(report.revenue.netRetainedRevenueCentavos)}</td></tr><tr><td>Outstanding service fees</td><td>{php(report.revenue.outstandingFeeObligationsCentavos)}</td></tr></Table></Panel> : null}</div>;
}

function FinancialReviewPage({ notify }: { notify: (notice: Notice) => void }) {
  const [fees, setFees] = useState<PlatformFee[]>([]); const [payments, setPayments] = useState<Payment[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [modal, setModal] = useState<{ kind: "payment"; item: Payment; decision: "Verified" | "Rejected" } | { kind: "platform-fee"; item: PlatformFee; decision: "verified" | "rejected" } | null>(null);
  const [dateOrder, setDateOrder] = useState<SortDirection>("desc");
  const refresh = useCallback(async () => { setLoading(true); setError(""); try { const [nextFees, nextPayments] = await Promise.all([loadSubmittedPlatformFees(), loadSubmittedPayments()]); setFees(nextFees); setPayments(nextPayments); } catch (failure) { setError(errorText(failure)); } finally { setLoading(false); } }, []); useEffect(() => { void refresh(); }, [refresh]);
  const sortedFees = sortByDate(fees, (fee) => fee.submittedAt, dateOrder);
  const sortedPayments = sortByDate(payments, (payment) => payment.updatedAt || payment.createdAt, dateOrder);
  const feePage = useLocalTablePage(sortedFees);
  const paymentPage = useLocalTablePage(sortedPayments);
  const sort = <SortButton direction={dateOrder} onToggle={() => setDateOrder((current) => current === "desc" ? "asc" : "desc")} />;
  return <div className="page-stack"><div className="page-heading"><div><h2>Financial review</h2><p>Evidence is reviewed only by Superadmin. Verification remains a human financial-control decision.</p></div><button className="button secondary" onClick={() => void refresh()} disabled={loading}>Refresh</button></div>{error ? <ErrorState message={error} retry={() => void refresh()} /> : null}<Panel title="TASKLINK service fees" description="Submitted service-fee receipts awaiting review." action={sort}><Table className="review-table" headers={["Task", "Amount", "Submitted", "Actions"]}>{feePage.items.map((fee) => <tr key={fee.id}><td>{fee.taskTitle || fee.taskId || fee.id}</td><td>{php(fee.feeCentavos || 0)}</td><td>{date(fee.submittedAt)}</td><td><div className="row-actions"><button className="text-button success-text" onClick={() => setModal({ kind: "platform-fee", item: fee, decision: "verified" })}>Verify</button><button className="text-button danger-text" onClick={() => setModal({ kind: "platform-fee", item: fee, decision: "rejected" })}>Reject</button></div></td></tr>)}</Table>{loading ? <TableLoading /> : null}{!loading && !fees.length ? <EmptyState title="No submitted service-fee receipts" /> : null}{fees.length > PAGE_SIZE ? <Pager loading={loading} hasMore={feePage.hasMore} next={feePage.next} previous={feePage.previous} canGoBack={feePage.canGoBack} pageNumber={feePage.pageNumber} /> : null}</Panel><Panel title="Existing payment reviews" description="Submitted GCash task payment evidence." action={sort}><Table className="review-table" headers={["Task", "Method", "Submitted", "Actions"]}>{paymentPage.items.map((payment) => <tr key={payment.id}><td>{payment.taskId || payment.id}</td><td>{payment.paymentMethod || "—"}</td><td>{date(payment.updatedAt || payment.createdAt)}</td><td><div className="row-actions"><button className="text-button success-text" onClick={() => setModal({ kind: "payment", item: payment, decision: "Verified" })}>Verify</button><button className="text-button danger-text" onClick={() => setModal({ kind: "payment", item: payment, decision: "Rejected" })}>Reject</button></div></td></tr>)}</Table>{loading ? <TableLoading /> : null}{!loading && !payments.length ? <EmptyState title="No submitted payment evidence" /> : null}{payments.length > PAGE_SIZE ? <Pager loading={loading} hasMore={paymentPage.hasMore} next={paymentPage.next} previous={paymentPage.previous} canGoBack={paymentPage.canGoBack} pageNumber={paymentPage.pageNumber} /> : null}</Panel>{modal ? <ReviewModal modal={modal} close={() => setModal(null)} refreshPayments={refresh} notify={notify} /> : null}</div>;
}

function ConfigurationPage() {
  const { reauthenticate } = useAuth();
  const [deletionPassword, setDeletionPassword] = useState("");
  const [deletionModalOpen, setDeletionModalOpen] = useState(false);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const [deletionUntil, setDeletionUntil] = useState(userDeletionModeUntil);
  const [name, setName] = useState(""); const [number, setNumber] = useState(""); const [rate, setRate] = useState("5"); const [instructions, setInstructions] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const { config } = await getPlatformRevenueConfig(); setName(config?.gcashAccountName || ""); setNumber(config?.gcashNumber || ""); setRate(String((config?.rateBasisPoints ?? 500) / 100)); setInstructions(config?.instructions || ""); } catch (failure) { setError(errorText(failure)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(event: FormEvent) { event.preventDefault(); const percent = Number(rate); if (!Number.isFinite(percent) || percent < 0 || percent > 100) { setError("Service fee must be between 0% and 100%."); return; } setSaving(true); setError(""); setNotice(""); try { await updatePlatformRevenueConfig({ gcashAccountName: name.trim(), gcashNumber: number.trim(), instructions: instructions.trim(), rateBasisPoints: Math.round(percent * 100) }); setNotice("Configuration saved and audit logged."); } catch (failure) { setError(errorText(failure)); } finally { setSaving(false); } }
  async function allowUserDeletion(event: FormEvent) {
    event.preventDefault();
    setDeletionBusy(true);
    setDeletionError("");
    try {
      await reauthenticate(deletionPassword);
      setDeletionUntil(enableUserDeletionMode());
      setDeletionPassword("");
      setDeletionModalOpen(false);
      setNotice("User deletion is enabled for this browser session for 10 minutes. Each deletion still requires your password.");
    } catch (failure) {
      setDeletionError(errorText(failure));
    } finally {
      setDeletionBusy(false);
    }
  }
  const deletionEnabled = deletionUntil > Date.now();
  return <div className="page-stack"><div className="page-heading"><div><h2>System configurations</h2><p>Authorized Superadmin settings only. Authentication secrets are never shown here.</p></div><button className="button secondary" onClick={() => void load()} disabled={loading || saving}>Refresh</button></div>{error ? <ErrorState message={error} retry={() => void load()} /> : null}{notice ? <div className="notice success"><p>{notice}</p><button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div> : null}<Panel title="TASKLINK service-fee destination" description="Changes are validated by the trusted backend and written to the immutable audit history.">{loading ? <TableLoading /> : <form onSubmit={save}><label>Official GCash account name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Official GCash number<input required inputMode="tel" value={number} onChange={(event) => setNumber(event.target.value)} /></label><label>Service fee percentage<input required inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} /></label><label>Employer instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1000} /></label><div className="modal-actions"><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save configuration"}</button></div></form>}</Panel><Panel title="Demo account deletion" description={deletionEnabled ? `Deletion mode is active until ${new Date(deletionUntil).toLocaleTimeString()}. Every deletion still requires your password and accounts with history are protected.` : "For repeat registration testing only. It opens a 10-minute deletion window in this browser; every account deletion requires a second password confirmation."}><button className={`button ${deletionEnabled ? "secondary" : "danger"}`} onClick={() => { setDeletionError(""); setDeletionPassword(""); setDeletionModalOpen(true); }}>{deletionEnabled ? "User deletion enabled" : "Allow User Deletion"}</button></Panel>{deletionModalOpen ? <Modal title="Allow User Deletion" close={() => !deletionBusy && setDeletionModalOpen(false)}><form onSubmit={allowUserDeletion}><p>Confirm your Superadmin password to enable the temporary delete controls. This does not delete an account yet.</p><label>Superadmin password<input type="password" autoComplete="current-password" value={deletionPassword} onChange={(event) => setDeletionPassword(event.target.value)} required autoFocus /></label>{deletionError ? <p className="inline-error">{deletionError}</p> : null}<ModalActions busy={deletionBusy} close={() => setDeletionModalOpen(false)} confirm="Enable for 10 minutes" danger /></form></Modal> : null}</div>;
}

function usePaged<T>(
  name: PortalList,
  filters: { search?: string; role?: string; status?: string } = {},
  sortDirection: SortDirection = "desc",
) {
  const [items, setItems] = useState<T[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const filterKey = JSON.stringify(filters);
  const load = useCallback(
    async (requestedPage = pageNumber) => {
      setLoading(true);
      setError("");
      try {
        const page = await loadPortalPage<T>(
          name,
          { page: requestedPage, pageSize: PAGE_SIZE, direction: sortDirection, ...filters },
        );
        setItems(page.items);
        setPageNumber(page.page);
        setTotal(page.total);
        setHasMore(page.hasMore);
      } catch (failure) {
        setError(errorText(failure));
      } finally {
        setLoading(false);
      }
    },
    [filterKey, name, pageNumber, sortDirection],
  );
  useEffect(() => {
    setPageNumber(1);
  }, [filterKey, name, sortDirection]);
  useEffect(() => { void load(pageNumber); }, [load, pageNumber]);
  return {
    items,
    loading,
    error,
    hasMore,
    total,
    next: () => setPageNumber((current) => current + 1),
    previous: () => setPageNumber((current) => Math.max(1, current - 1)),
    canGoBack: pageNumber > 1,
    refresh: () => load(pageNumber),
    pageNumber,
  };
}

function useLocalTablePage<T extends { id: string }>(items: T[], pageSize = PAGE_SIZE) {
  const itemKey = items.map((item) => item.id).join("|");
  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => {
    setPageNumber(1);
  }, [itemKey, pageSize]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(pageNumber, totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pageNumber: currentPage,
    hasMore: currentPage < totalPages,
    canGoBack: currentPage > 1,
    next: () => setPageNumber((current) => Math.min(totalPages, current + 1)),
    previous: () => setPageNumber((current) => Math.max(1, current - 1)),
  };
}

function useRecordLookup<T>(
  ids: string[],
  loader: (ids: string[]) => Promise<Record<string, T>>,
) {
  const key = [...new Set(ids.filter(Boolean))].sort().join("|");
  const [data, setData] = useState<Record<string, T>>({});
  useEffect(() => {
    let active = true;
    if (!key) {
      setData({});
      return () => {
        active = false;
      };
    }
    void loader(key.split("|"))
      .then((next) => {
        if (active) setData(next);
      })
      .catch(() => {
        if (active) setData({});
      });
    return () => {
      active = false;
    };
  }, [key, loader]);
  return data;
}

function UsersPage({
  scope,
  notify,
}: {
  scope: Scope;
  notify: (notice: Notice) => void;
}) {
  const { reauthenticate } = useAuth();
  const [nameOrder, setNameOrder] = useState<SortDirection>("asc");
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(() => searchParams.get("role") === "client" || searchParams.get("role") === "worker" ? searchParams.get("role") as string : "all");
  const [status, setStatus] = useState("all");
  const page = usePaged<Profile>("users", { search, role, status }, nameOrder);
  const [modal, setModal] = useState<{
    user: Profile;
    action: "suspend" | "active";
  } | null>(null);
  const [details, setDetails] = useState<Profile | null>(null);
  const [deletionUser, setDeletionUser] = useState<Profile | null>(null);
  const [deletionUntil, setDeletionUntil] = useState(userDeletionModeUntil);
  const users = page.items;
  useEffect(() => {
    const requestedRole = searchParams.get("role");
    setRole(requestedRole === "client" || requestedRole === "worker" ? requestedRole : "all");
  }, [searchParams]);
  useEffect(() => {
    if (!deletionUntil) return;
    const delay = Math.max(0, deletionUntil - Date.now()) + 1;
    const timeout = window.setTimeout(() => setDeletionUntil(userDeletionModeUntil()), delay);
    return () => window.clearTimeout(timeout);
  }, [deletionUntil]);
  const deletionEnabled = scope === "superadmin" && deletionUntil > Date.now();
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>User directory</h2>
          <p>
            Public profile data only. Sensitive account changes require trusted
            server authorization.
          </p>
        </div>
        <div className="toolbar">
          <SearchBox value={search} onChange={setSearch} />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="all">All roles</option>
            <option value="worker">Taskers</option>
            <option value="client">Employers</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Restricted</option>
            <option value="pending_verification">Pending verification</option>
          </select>
        </div>
      </div>
      <Panel
        title="Accounts"
        description={`Live account records from the authorized Render API. ${page.total} matching account${page.total === 1 ? "" : "s"}.`}
        action={<SortButton direction={nameOrder} ascendingLabel="Oldest registered" descendingLabel="Newest registered" onToggle={() => setNameOrder((current) => current === "asc" ? "desc" : "asc")} />}
      >
        <Table
          headers={[
            "Name",
            "Role",
            "Account status",
            "Verification",
            "Registered",
            "Activity",
            "Details",
            ...(scope === "superadmin" ? ["Action"] : []),
          ]}
        >
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="profile-cell">
                  <ProfileAvatar profile={user} />
                  <strong>{user.fullName || "Unnamed account"}</strong>
                </div>
                {user.businessName ? <small>{user.businessName}</small> : null}
              </td>
              <td>
                <Badge value={roleLabel(user.role)} />
              </td>
              <td>
                <Badge value={user.accountStatus === "suspended" ? "Restricted" : user.accountStatus || "Active"} />
              </td>
              <td>
                {user.verificationStatus || user.identityStatus || "Not submitted"}
                {typeof user.verificationProgress === "number" ? <small>{user.verificationProgress}% eligibility progress</small> : null}
              </td>
              <td>{date(user.createdAt)}</td>
              <td>{user.activitySummary || "No task activity"}</td>
              <td><button className="text-button" onClick={() => setDetails(user)}>View profile</button></td>
              {scope === "superadmin" ? <td>
                <div className="row-actions">
                  {user.accountStatus === "suspended" ? <button
                    className="text-button"
                    onClick={() => setModal({ user, action: "active" })}
                  >
                    Reactivate
                  </button> : <button
                    className="text-button danger-text"
                    onClick={() => setModal({ user, action: "suspend" })}
                  >
                    Restrict
                  </button>}
                  {deletionEnabled ? <button className="text-button danger-text" onClick={() => setDeletionUser(user)}>Explicit Actions</button> : null}
                </div>
              </td> : null}
            </tr>
          ))}
        </Table>
        {!page.loading && !users.length ? (
          <EmptyState title="No accounts in this result" />
        ) : null}
        {page.error ? (
          <ErrorState message={page.error} retry={() => { void page.refresh(); }} />
        ) : null}
        <Pager {...page} />
      </Panel>
      {modal ? (
        <UserActionModal
          modal={modal}
          close={() => setModal(null)}
          notify={notify}
          refreshed={() => { void page.refresh(); }}
        />
      ) : null}
      {details ? <ReadOnlyDetailsModal title="Account profile" close={() => setDetails(null)} rows={[["Name", details.fullName || "Unnamed account"], ["Role", roleLabel(details.role)], ["Account status", details.accountStatus === "suspended" ? "Restricted" : details.accountStatus || "Active"], ["Verification", details.verificationStatus || details.identityStatus || "Not submitted"], ["Eligibility progress", typeof details.verificationProgress === "number" ? `${details.verificationProgress}%` : "Unavailable"], ["Registered", date(details.createdAt)], ["Activity", details.activitySummary || "No task activity"]]} /> : null}
      {deletionUser ? <ExplicitUserActionsModal user={deletionUser} close={() => setDeletionUser(null)} reauthenticate={reauthenticate} notify={notify} refreshed={() => { void page.refresh(); }} /> : null}
    </div>
  );
}

function TasksPage({ scope }: { scope: Scope }) {
  const [dateOrder, setDateOrder] = useState<SortDirection>("desc");
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "all");
  const page = usePaged<Task>("tasks", { search, status }, dateOrder);
  const tasks = page.items;
  const [details, setDetails] = useState<Task | null>(null);
  useEffect(() => {
    setStatus(searchParams.get("status") ?? "all");
  }, [searchParams]);
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>{scope === "admin" ? "Tasks" : "Task oversight"}</h2>
          <p>Live task postings and workflow status. This table is read-only.</p>
        </div>
        <div className="toolbar">
          <SearchBox value={search} onChange={setSearch} />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {[
              "Finding Workers",
              "Applied",
              "Accepted",
              "In Progress",
              "Pending Approval",
              "Finished",
              "Archived",
              "Cancelled",
              "Disputed",
              "Expired",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
      {scope === "admin" ? <TaskCategoryInsights /> : null}
      <Panel title="Task postings" description={`${page.total} matching task${page.total === 1 ? "" : "s"}.`} action={<SortButton direction={dateOrder} onToggle={() => setDateOrder((current) => current === "desc" ? "asc" : "desc")} />}>
        <Table
          headers={[
            "Task title",
            "Category",
            "Employer",
            "Assigned worker",
            "Agreed wage",
            "Status",
            "Created",
            "Details",
          ]}
        >
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <strong>{taskTitle(task)}</strong>
                <small>
                  {task.location || "Location unavailable"}
                </small>
              </td>
              <td>{task.category || "—"}</td>
              <td>{task.employerName || "Employer unavailable"}</td>
              <td>{task.workerName || "Unassigned"}</td>
              <td>{task.agreedAmount || task.wage || "—"}</td>
              <td>
                <Badge value={task.status || "Unknown"} />
              </td>
              <td>{date(task.createdAt)}</td>
              <td><button className="text-button" onClick={() => setDetails(task)}>View task</button></td>
            </tr>
          ))}
        </Table>
        {!page.loading && !tasks.length ? (
          <EmptyState title="No tasks in this result" />
        ) : null}
        {page.error ? (
          <ErrorState message={page.error} retry={page.refresh} />
        ) : null}
        <Pager {...page} />
      </Panel>
      {details ? <ReadOnlyDetailsModal title="Task details" close={() => setDetails(null)} rows={[["Title", taskTitle(details)], ["Category", details.category || "—"], ["Employer", details.employerName || "Employer unavailable"], ["Assigned worker", details.workerName || "Unassigned"], ["Agreed wage", details.agreedAmount || details.wage || "—"], ["Status", details.status || "Unknown"], ["Location", details.location || "Unavailable"], ["Created", date(details.createdAt)]]} /> : null}
    </div>
  );
}

function ApplicationsPage() {
  const [dateOrder, setDateOrder] = useState<SortDirection>("desc");
  const [search, setSearch] = useState("");
  const page = usePaged<TaskMatch>("applications", { search }, dateOrder);
  const tasks = useRecordLookup<Task>(
    page.items.map((match) => match.taskId || ""),
    loadTasksById,
  );
  const profiles = useRecordLookup<Profile>(
    page.items.flatMap((match) => [match.workerId || "", match.clientId || ""]),
    loadProfilesById,
  );
  const filtered = page.items;
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Applications monitoring</h2>
          <p>
            Applications are read-only in this portal. Only the employer who posted the task can accept or decline worker applications. Administrators may monitor application records but cannot make hiring decisions on behalf of employers.
          </p>
        </div>
        <div className="toolbar">
          <SearchBox value={search} onChange={setSearch} />
        </div>
      </div>
      <Panel title="Task applications" description={`${page.total} matching application${page.total === 1 ? "" : "s"}.`} action={<SortButton direction={dateOrder} onToggle={() => setDateOrder((current) => current === "desc" ? "asc" : "desc")} />}>
        <Table
          headers={[
            "Task",
            "Tasker",
            "Employer",
            "Proposed bid",
            "Status",
            "Applied",
          ]}
        >
          {filtered.map((match) => (
            <tr key={match.id}>
              <td>
                <strong>{taskTitle(tasks[match.taskId || ""])}</strong>
              </td>
              <td>
                {profiles[match.workerId || ""]?.fullName ||
                  "Tasker unavailable"}
              </td>
              <td>
                {profiles[match.clientId || ""]?.fullName ||
                  "Employer unavailable"}
              </td>
              <td>{match.proposedAmount || "—"}</td>
              <td>
                <Badge value={match.acceptanceStatus || "Unknown"} />
              </td>
              <td>{date(match.createdAt)}</td>
            </tr>
          ))}
        </Table>
        {!page.loading && !filtered.length ? (
          <EmptyState title="No applications in this result" />
        ) : null}
        {page.error ? (
          <ErrorState message={page.error} retry={page.refresh} />
        ) : null}
        <Pager {...page} />
      </Panel>
    </div>
  );
}

function VerificationPage({ notify }: { notify: (notice: Notice) => void }) {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    | {
        kind: "verification";
        item: VerificationRequest;
        decision: "Verified" | "Rejected" | "Needs Resubmission";
      }
    | {
        kind: "verification-document";
        item: VerificationRequest;
        documentKind: VerificationDocumentKind;
        decision: "Verified" | "Rejected" | "Needs Resubmission";
      }
    | null
  >(null);
  const [document, setDocument] = useState<{
    path: string;
    label: string;
  } | null>(null);
  const [requestOrder, setRequestOrder] = useState<SortDirection>("desc");
  const profiles = useRecordLookup<Profile>(
    requests.map((item) => item.userId),
    loadProfilesById,
  );
  const refreshReviewData = useCallback(async () => {
    setLoading(true);
    try {
      const nextRequests = await loadPendingVerifications();
      setRequests(nextRequests);
      setError("");
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshReviewData();
  }, [refreshReviewData]);
  const sortedRequests = sortByDate(requests, (item) => item.submittedAt, requestOrder);
  const requestPage = useLocalTablePage(sortedRequests);
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Identity Review</h2>
          <p>
            Open the valid ID, selfie with ID, medical certificate, and police clearance before
            deciding. Decisions update the user profile through a trusted
            Render Admin API.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => void refreshReviewData()}
        >
          Refresh reviews
        </button>
      </div>
      {error ? (
        <ErrorState message={error} retry={() => void refreshReviewData()} />
      ) : null}
      <section className="review-table-stack">
        <Panel
          title={`Identity review (${requests.length})`}
          description="Pending Tasker and Employer requests"
          action={<SortButton direction={requestOrder} onToggle={() => setRequestOrder((current) => current === "desc" ? "asc" : "desc")} />}
        >
          <Table
            className="review-table"
            headers={[
              "Account",
              "Progress",
              "Uploaded requirements",
              "Submitted",
              "Decision",
            ]}
          >
          {requestPage.items.map((item) => {
            return <tr key={item.id}>
                <td>{profiles[item.userId]?.fullName || "Account unavailable"}</td>
                <td><strong>{profiles[item.userId]?.verificationProgress ?? 0}%</strong><small>{profiles[item.userId]?.verificationProgressLevel || "Incomplete"}</small></td>
                <td>
                  <strong>{item.validIdType || "Identity document"}</strong>
                  <div className="row-actions document-actions">
                    {item.validIdPath ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          setDocument({
                            path: item.validIdPath || "",
                            label: "Valid ID",
                          })
                        }
                      >
                        View valid ID
                      </button>
                    ) : (
                      <span className="missing-file">Valid ID unavailable</span>
                    )}
                    {item.selfieWithIdPath ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          setDocument({ path: item.selfieWithIdPath || "", label: "Selfie holding valid ID" })
                        }
                      >
                        View selfie with ID
                      </button>
                    ) : (
                      <span className="missing-file">Selfie with ID unavailable</span>
                    )}
                    {item.medicalCertificatePath ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          setDocument({
                            path: item.medicalCertificatePath || "",
                            label: "Medical certificate",
                          })
                        }
                      >
                        View medical certificate
                      </button>
                    ) : (
                      <span className="missing-file">
                        Medical certificate unavailable
                      </span>
                    )}
                    {item.policeClearancePath ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          setDocument({
                            path: item.policeClearancePath || "",
                            label: "Police clearance",
                          })
                        }
                      >
                        View police clearance
                      </button>
                    ) : (
                      <span className="missing-file">
                        Police clearance unavailable
                      </span>
                    )}
                  </div>
                </td>
                <td>{date(item.submittedAt)}</td>
                <td>
                  <VerificationDocumentDecisions
                    item={item}
                    onReview={(documentKind, decision) => setModal({ kind: "verification-document", item, documentKind, decision })}
                  />
                </td>
              </tr>;
          })}
          </Table>
          {loading ? <TableLoading /> : null}
          {!loading && !requests.length ? (
            <EmptyState title="No pending verification requests" />
          ) : null}
          {requests.length > PAGE_SIZE ? (
            <Pager
              loading={loading}
              hasMore={requestPage.hasMore}
              next={requestPage.next}
              previous={requestPage.previous}
              canGoBack={requestPage.canGoBack}
              pageNumber={requestPage.pageNumber}
            />
          ) : null}
        </Panel>
      </section>
      {modal ? (
        <ReviewModal
          modal={modal}
          close={() => setModal(null)}
          refreshPayments={refreshReviewData}
          notify={notify}
        />
      ) : null}
      {document ? (
        <VerificationDocumentModal
          document={document}
          close={() => setDocument(null)}
        />
      ) : null}
    </div>
  );
}

function VerificationDocumentDecisions({
  item,
  onReview,
}: {
  item: VerificationRequest;
  onReview: (kind: VerificationDocumentKind, decision: "Verified" | "Rejected" | "Needs Resubmission") => void;
}) {
  const documents: Array<{ kind: VerificationDocumentKind; label: string; path?: string }> = [
    { kind: "valid-id", label: "Valid ID", path: item.validIdPath },
    { kind: "selfie-with-id", label: "Selfie with ID", path: item.selfieWithIdPath },
    { kind: "medical-certificate", label: "Medical certificate", path: item.medicalCertificatePath },
    { kind: "police-clearance", label: "Police clearance", path: item.policeClearancePath },
  ];
  return <div className="document-decisions">
    {documents.map(({ kind, label, path }) => {
      const status = item.documentReviews?.[kind]?.status || "Pending";
      return <div className="document-decision" key={kind}>
        <small><strong>{label}</strong> · {status}</small>
        <div className="row-actions">
          <button className="text-button success-text" disabled={!path || status === "Verified"} onClick={() => onReview(kind, "Verified")}>Verify</button>
          <button className="text-button" disabled={!path || status === "Verified"} onClick={() => onReview(kind, "Needs Resubmission")}>Request update</button>
          <button className="text-button danger-text" disabled={!path || status === "Verified"} onClick={() => onReview(kind, "Rejected")}>Reject</button>
        </div>
      </div>;
    })}
  </div>;
}

function HelpPage() {
  const items = [
    ["What can administrators review?", "Administrators can review verification requests and submitted GCash payment evidence, and can manage accounts only through the authorized portal actions."],
    ["How are payment decisions handled?", "A receipt or reference is evidence only. Review the submitted evidence and use Verify or Reject with an appropriate reason. The portal does not initiate or transfer payments."],
    ["Why is a record missing?", "Tables are paginated and may be filtered. Use the table controls to move through pages or refresh the page. Verify that your staff role has access to the requested section."],
    ["How should an account restriction be used?", "Use restrictions only after reviewing a report or other authorized evidence. The action is processed by a trusted backend function and creates an audit record."],
    ["What should I do if an action fails?", "Read the displayed error, confirm the record is still in the required state, then refresh before retrying. Do not claim a review succeeded until the record updates."],
  ];
  return <div className="page-stack">
    <div className="page-heading"><div><h2>Administration help</h2><p>Guidance for the current TaskLink administration workflows.</p></div></div>
    <Panel title="Frequently asked questions" description="This portal supports review and moderation workflows; it does not process or transfer funds.">
      <div className="help-list">{items.map(([question, answer]) => <details key={question} className="help-item"><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </Panel>
  </div>;
}

function FeedbackPage() {
  const [score, setScore] = useState("all");
  const [dateOrder, setDateOrder] = useState<SortDirection>("desc");
  const page = usePaged<Rating>("feedback", {}, dateOrder);
  const filtered = score === "all" ? page.items : page.items.filter((rating) => rating.score === Number(score));
  const profiles = useRecordLookup<Profile>(
    filtered.map((rating) => rating.targetUserId || ""),
    loadProfilesById,
  );
  const tasks = useRecordLookup<Task>(
    filtered.map((rating) => rating.taskId || ""),
    loadTasksById,
  );
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Reviews and feedback</h2>
          <p>Live feedback records from employers and taskers.</p>
        </div>
        <div className="toolbar">
          <select value={score} onChange={(event) => setScore(event.target.value)}>
            <option value="all">All ratings</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
          </select>
        </div>
      </div>
      <Panel
        title={`Feedback — ${page.total} total records`}
        description={`Showing ${filtered.length} of ${page.total} feedback records${score === "all" ? "" : ` rated ${score} stars`}.`}
        action={<SortButton direction={dateOrder} onToggle={() => setDateOrder((current) => current === "desc" ? "asc" : "desc")} />}
      >
        <Table headers={["Rating", "Feedback", "Target user", "Task title", "Date"]}>
          {filtered.map((rating) => (
            <tr key={rating.id}>
              <td>
                <span className="rating">
                  <Star size={15} fill="currentColor" />
                  {rating.score ?? "—"}
                </span>
              </td>
              <td>{rating.feedback || "No written feedback"}</td>
              <td>{rating.targetUserId ? profiles[rating.targetUserId]?.fullName || "User unavailable" : "User unavailable"}</td>
              <td>{rating.taskId ? tasks[rating.taskId]?.title || "Task unavailable" : "Task unavailable"}</td>
              <td>{date(rating.createdAt)}</td>
            </tr>
          ))}
        </Table>
        {!page.loading && !filtered.length ? (
          <EmptyState title="No feedback in this result" />
        ) : null}
        {page.error ? (
          <ErrorState message={page.error} retry={() => { void page.refresh(); }} />
        ) : null}
        <Pager {...page} />
      </Panel>
    </div>
  );
}

function ReportsPage({ notify }: { notify: (notice: Notice) => void }) {
  const [modal, setModal] = useState<ViolationReport | null>(null);
  const [dateOrder, setDateOrder] = useState<SortDirection>("desc");
  const page = usePaged<ViolationReport>("reports", {}, dateOrder);
  const data = page.items;
  const profiles = useRecordLookup<Profile>(
    data.map((report) => report.targetUserId || ""),
    loadProfilesById,
  );
  const sortedReports = data;
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Violation reports</h2>
          <p>Superadmin-only report data from the trusted administrator API.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => void page.refresh()}
          disabled={page.loading}
        >
          Refresh
        </button>
      </div>
      <Panel title="Reports" action={<SortButton direction={dateOrder} onToggle={() => setDateOrder((current) => current === "desc" ? "asc" : "desc")} />}>
        <Table
          headers={[
            "Category",
            "Reason",
            "Target",
            "Status",
            "Created",
            "Action",
          ]}
        >
          {sortedReports.map((report) => (
            <tr key={report.id}>
              <td>
                <Badge value={report.category || "Other"} />
              </td>
              <td>{report.reason || "—"}</td>
              <td>{report.targetUserId ? profiles[report.targetUserId]?.fullName || "Account unavailable" : "Account unavailable"}</td>
              <td>{report.status || "—"}</td>
              <td>{date(report.createdAt)}</td>
              <td>
                {report.status === "Open" ? (
                  <button
                    className="text-button danger-text"
                    onClick={() => setModal(report)}
                  >
                    Restrict account
                  </button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </Table>
        {page.loading ? <TableLoading /> : null}
        {!page.loading && !data.length ? (
          <EmptyState title="No violation reports" />
        ) : null}
        {page.error ? (
          <ErrorState message={page.error} retry={() => void page.refresh()} />
        ) : null}
      </Panel>
      {modal ? (
        <ReportActionModal
          report={modal}
          close={() => setModal(null)}
          notify={notify}
          refreshed={() => { void page.refresh(); }}
        />
      ) : null}
    </div>
  );
}
function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateOrder, setDateOrder] = useState<SortDirection>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const load = useCallback(async (nextCursor: string | null = null, recordHistory = false) => {
    setLoading(true);
    try {
      const page = await loadAuditLogPage({ cursor: nextCursor, direction: dateOrder, pageSize });
      setItems(page.items);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      if (recordHistory) setHistory((current) => [...current, nextCursor]);
      setError("");
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, [dateOrder, pageSize]);
  useEffect(() => { setHistory([]); void load(); }, [load]);
  const profiles = useRecordLookup<Profile>(
    items.flatMap((item) => [
      item.actorId || "",
      item.targetType === "user" || item.targetType === "verification"
        ? item.targetId || ""
        : "",
    ]),
    loadProfilesById,
  );
  const sortedItems = items.filter((item) => {
    const haystack = `${item.action || ""} ${item.targetType || ""} ${item.targetId || ""} ${item.reason || ""} ${item.actorId || ""}`.toLowerCase();
    const value = timestamp(item.createdAt);
    const afterFrom = !fromDate || value >= timestamp(`${fromDate}T00:00:00+08:00`);
    const beforeTo = !toDate || value <= timestamp(`${toDate}T23:59:59.999+08:00`);
    return (!search || haystack.includes(search.toLowerCase())) && (!actor || item.actorId === actor) && (!action || item.action === action) && afterFrom && beforeTo;
  });
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Audit log</h2>
          <p>Immutable staff action records from the trusted administrator API.</p>
        </div>
        <button className="button secondary" onClick={() => void load(history.at(-1) ?? null)} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      <Panel title="Recent actions" description="Read-only, cursor-paginated immutable audit records." action={<div className="table-controls"><SortButton direction={dateOrder} onToggle={() => setDateOrder((current) => current === "desc" ? "asc" : "desc")} /><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Audit page size"><option value="10">10 per page</option><option value="25">25 per page</option><option value="50">50 per page</option></select></div>}>
        <div className="table-filter-row"><SearchBox value={search} onChange={setSearch} /><input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="Actor ID" aria-label="Filter by actor" /><input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action" aria-label="Filter by action" /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="From date" /><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="To date" /></div>
        <Table headers={["Action", "Target", "Reason", "Actor", "Date"]}>
          {sortedItems.map((item) => (
            <tr key={item.id}>
              <td>{item.action || "—"}</td>
              <td>
                {item.targetType
                  ? `${item.targetType}: ${item.targetType === "user" || item.targetType === "verification" ? profiles[item.targetId || ""]?.fullName || "Account unavailable" : item.targetId || "—"}`
                  : "—"}
              </td>
              <td>{item.reason || "—"}</td>
              <td>{item.actorId ? profiles[item.actorId]?.fullName || "Administrator unavailable" : "—"}</td>
              <td>{date(item.createdAt)}</td>
            </tr>
          ))}
        </Table>
        {loading ? <TableLoading /> : null}
        {!loading && !sortedItems.length ? (
          <EmptyState title="No audit records in this result" />
        ) : null}
        {error ? (
          <ErrorState message={error} retry={() => void load(history.at(-1) ?? null)} />
        ) : null}
        <div className="pager"><span>{loading ? "Loading…" : `Page ${history.length + 1}`}</span><div><button className="icon-button" disabled={!history.length || loading} onClick={() => { const previousHistory = history.slice(0, -1); const previousCursor = previousHistory.at(-1) ?? null; setHistory(previousHistory); void load(previousCursor); }} aria-label="Previous page"><ChevronLeft size={18} /></button><button className="icon-button" disabled={!hasMore || loading} onClick={() => void load(cursor, true)} aria-label="Next page"><ChevronRight size={18} /></button></div></div>
      </Panel>
    </div>
  );
}

function ExplicitUserActionsModal({
  user,
  close,
  reauthenticate,
  notify,
  refreshed,
}: {
  user: Profile;
  close: () => void;
  reauthenticate: (password: string) => Promise<void>;
  notify: (notice: Notice) => void;
  refreshed: () => void;
}) {
  const [action, setAction] = useState<"menu" | "delete" | "reset">("menu");
  const [password, setPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (action === "reset" && resetConfirmation !== "RESET") {
      setError("Type RESET exactly to confirm the demo-account reset.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await reauthenticate(password);
      if (action === "reset") {
        await resetDemoUser(user.id, resetConfirmation);
        notify({ tone: "success", message: "Safe demo records were reset and the user account was deleted. Its mobile number can now be registered again." });
      } else {
        await deleteDemoUser(user.id);
        notify({ tone: "success", message: "User account deleted. Its mobile number can now be registered again." });
      }
      refreshed();
      close();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }
  if (action === "menu") return <Modal title="Explicit account actions" close={close}><p><strong>{user.fullName || user.id}</strong></p><p>These actions permanently remove the user and free their mobile number for a new registration. Choose the action that matches the account's record state.</p><div className="modal-actions"><button className="button secondary" onClick={close}>Cancel</button><button className="button secondary" onClick={() => { setError(""); setAction("delete"); }}>Delete fresh account</button><button className="button danger" onClick={() => { setError(""); setAction("reset"); }}>Reset demo account</button></div></Modal>;
  const resetting = action === "reset";
  return <Modal title={resetting ? "Reset demo account" : "Delete fresh account"} close={() => !busy && close()}><form onSubmit={submit}><p><strong>{user.fullName || user.id}</strong></p><p>{resetting ? "This removes safe unfinished demo tasks and applications owned by this account, then deletes its profile, identity uploads, and Firebase sign-in. It stops when it finds assigned work, messages, payments, fees, ratings, or reports." : "This removes only an account with no connected marketplace records, including its profile, identity uploads, and Firebase sign-in."}</p>{resetting ? <label>Type RESET to confirm<input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} required autoFocus /></label> : null}<label>Confirm your Superadmin password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus={!resetting} /></label>{error ? <p className="inline-error">{error}</p> : null}<ModalActions busy={busy} close={close} confirm={resetting ? "Reset and delete account" : "Delete user permanently"} danger /></form></Modal>;
}

function UserActionModal({
  modal,
  close,
  notify,
  refreshed,
}: {
  modal: { user: Profile; action: "suspend" | "active" };
  close: () => void;
  notify: (notice: Notice) => void;
  refreshed: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title =
    modal.action === "suspend"
      ? "Restrict account"
      : "Reactivate account";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (modal.action === "suspend" && reason.trim().length < 10) {
      setError("Enter a restriction reason of at least 10 characters.");
      return;
    }
    setBusy(true);
    setError("");
    const auditNote = reason.trim() || "Account reactivated by Superadmin.";
    try {
      await changeAccountStatus(
        modal.user.id,
        modal.action === "active" ? "active" : "suspended",
        auditNote,
      );
      notify({ tone: "success", message: `${title} completed.` });
      refreshed();
      close();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} close={close}>
      <form onSubmit={submit}>
        <p>
          <strong>{modal.user.fullName || modal.user.id}</strong>
        </p>
        <label>
          {modal.action === "suspend" ? "Restriction reason" : "Reactivation note"}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required={modal.action === "suspend"}
            minLength={modal.action === "suspend" ? 10 : undefined}
          />
        </label>
        {error ? <p className="inline-error">{error}</p> : null}
        <ModalActions
          busy={busy}
          close={close}
          confirm={
            modal.action === "suspend" ? "Restrict account" : "Reactivate account"
          }
          danger={modal.action === "suspend"}
        />
      </form>
    </Modal>
  );
}
function ReviewModal({
  modal,
  close,
  refreshPayments,
  notify,
}: {
  modal:
    | {
        kind: "verification";
        item: VerificationRequest;
        decision: "Verified" | "Rejected" | "Needs Resubmission";
      }
    | {
        kind: "verification-document";
        item: VerificationRequest;
        documentKind: VerificationDocumentKind;
        decision: "Verified" | "Rejected" | "Needs Resubmission";
      }
    | { kind: "payment"; item: Payment; decision: "Verified" | "Rejected" }
    | { kind: "platform-fee"; item: PlatformFee; decision: "verified" | "rejected" };
  close: () => void;
  refreshPayments: () => Promise<void>;
  notify: (notice: Notice) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsReason = modal.decision !== "Verified" && modal.decision !== "verified";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (needsReason && !reason.trim()) {
      setError("A reason is required for this decision.");
      return;
    }
    setBusy(true);
    try {
      if (modal.kind === "verification")
        await reviewVerification(modal.item.userId, modal.decision, reason);
      else if (modal.kind === "verification-document")
        await reviewVerificationDocument(modal.item.userId, modal.documentKind, modal.decision, reason);
      else if (modal.kind === "payment")
        await reviewPayment(
          modal.item.taskId || modal.item.id,
          modal.decision,
          reason,
        );
      else await reviewPlatformFee(modal.item.taskId || modal.item.id, modal.decision, reason);
      notify({ tone: "success", message: `Review marked ${modal.decision}.` });
      await refreshPayments();
      close();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${modal.decision} ${modal.kind === "verification-document" ? modal.documentKind.replace(/-/g, " ") : modal.kind === "verification" ? "verification" : modal.kind === "platform-fee" ? "TASKLINK service fee" : "payment"}`}
      close={close}
    >
      <form onSubmit={submit}>
        <p className="subtle">
          {modal.kind === "verification" || modal.kind === "verification-document"
            ? modal.item.userId
            : modal.item.taskId || modal.item.id}
        </p>
        <label>
          Review reason{needsReason ? "" : " (optional)"}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required={needsReason}
          />
        </label>
        {error ? <p className="inline-error">{error}</p> : null}
        <ModalActions
          busy={busy}
          close={close}
          confirm={modal.decision}
          danger={modal.decision === "Rejected"}
        />
      </form>
    </Modal>
  );
}
function VerificationDocumentModal({
  document,
  close,
}: {
  document: { path: string; label: string; taskId?: string; platformFee?: boolean };
  close: () => void;
}) {
  const [preview, setPreview] = useState<{ url: string; mimeType: string; fileName: string }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let previewUrl = "";
    setPreview(undefined);
    setError("");
    const loadDocument = document.platformFee && document.taskId
      ? getPlatformFeeReceiptUrl(document.taskId, document.path)
      : getVerificationDocumentUrl(document.path);
    void loadDocument
      .then((next) => {
        previewUrl = next.url;
        if (active) setPreview(next);
        else if (next.url.startsWith("blob:")) URL.revokeObjectURL(next.url);
      })
      .catch((failure) => {
        if (active) setError(errorText(failure));
      });
    return () => {
      active = false;
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [document.path, document.platformFee, document.taskId]);
  const isPdf = preview?.mimeType === "application/pdf";
  return (
    <Modal title={document.label} close={close}>
      {error ? <ErrorState message={error} /> : null}
      {!preview && !error ? <TableLoading /> : null}
      {preview ? (
        <div className="document-preview">
          {isPdf ? (
            <iframe src={preview.url} title={document.label} />
          ) : (
            <img src={preview.url} alt={document.label} />
          )}
          <a
            className="button secondary"
            href={preview.url}
            target="_blank"
            rel="noreferrer"
          >
            Open original
          </a>
        </div>
      ) : null}
    </Modal>
  );
}
function ReportActionModal({
  report,
  close,
  notify,
  refreshed,
}: {
  report: ViolationReport;
  close: () => void;
  notify: (notice: Notice) => void;
  refreshed: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!report.targetUserId) {
      setError("The report is missing its target account.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Enter a restriction reason of at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      await changeAccountStatus(
        report.targetUserId,
        "suspended",
        reason.trim(),
        report.id,
      );
      notify({
        tone: "success",
        message: "Account restricted and report actioned.",
      });
      await refreshed();
      close();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Restrict reported account" close={close}>
      <form onSubmit={submit}>
        <p className="subtle">
          This action is server-authorized and creates an audit record.
        </p>
        <label>
          Restriction reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={10}
          />
        </label>
        {error ? <p className="inline-error">{error}</p> : null}
        <ModalActions
          busy={busy}
          close={close}
          confirm="Restrict account"
          danger
        />
      </form>
    </Modal>
  );
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Close">
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function ReadOnlyDetailsModal({ title, close, rows }: { title: string; close: () => void; rows: Array<[string, string]> }) {
  return <Modal title={title} close={close}>
    <dl className="details-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="modal-actions"><button className="button secondary" onClick={close}>Close</button></div>
  </Modal>;
}
function ModalActions({
  busy,
  close,
  confirm,
  danger = false,
}: {
  busy: boolean;
  close: () => void;
  confirm: string;
  danger?: boolean;
}) {
  return (
    <div className="modal-actions">
      <button type="button" className="button secondary" onClick={close}>
        Cancel
      </button>
      <button
        className={`button ${danger ? "danger" : "primary"}`}
        disabled={busy}
      >
        {busy ? (
          <>
            <LoaderCircle className="spin" size={16} /> Saving
          </>
        ) : (
          confirm
        )}
      </button>
    </div>
  );
}
function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const contents = <>
      <span className="metric-icon">{icon}</span>
      <p>{label}</p>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
    </>;
  return onClick ? (
    <button className="metric metric-link" onClick={onClick}>{contents}</button>
  ) : <article className="metric">{contents}</article>;
}
function Table({
  headers,
  children,
  className = "",
}: {
  headers: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`table-wrap ${className}`.trim()}>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Pager({
  loading,
  hasMore,
  next,
  previous,
  canGoBack,
  pageNumber,
}: {
  loading: boolean;
  hasMore: boolean;
  next: () => void;
  previous: () => void;
  canGoBack: boolean;
  pageNumber: number;
}) {
  return (
    <div className="pager">
      <span>{loading ? "Loading…" : `Page ${pageNumber}`}</span>
      <div>
        <button
          className="icon-button"
          disabled={!canGoBack || loading}
          onClick={previous}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button"
          disabled={!hasMore || loading}
          onClick={next}
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="search">
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search current page"
        aria-label="Search current page"
      />
    </label>
  );
}
function SortButton({
  direction,
  onToggle,
  ascendingLabel = "Oldest first",
  descendingLabel = "Newest first",
}: {
  direction: SortDirection;
  onToggle: () => void;
  ascendingLabel?: string;
  descendingLabel?: string;
}) {
  return (
    <label className="sort-control">
      <span>Sort</span>
      <select value={direction} onChange={(event) => { if (event.target.value !== direction) onToggle(); }} aria-label="Sorting order">
        <option value="asc">{ascendingLabel}</option>
        <option value="desc">{descendingLabel}</option>
      </select>
    </label>
  );
}
function Badge({ value }: { value: string }) {
  return <span className="badge">{value}</span>;
}
function ProfileAvatar({ profile }: { profile: Profile }) {
  const [failed, setFailed] = useState(false);
  const initial = (profile.fullName || "U").charAt(0).toUpperCase();
  if (!profile.profilePhotoUrl || failed) {
    return <span aria-hidden="true" className="profile-avatar">{initial}</span>;
  }
  return <img alt="" className="profile-avatar" src={profile.profilePhotoUrl} onError={() => setFailed(true)} />;
}
function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty">
      <Bell size={22} />
      <p>{title}</p>
    </div>
  );
}
function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state">
      <ShieldAlert size={20} />
      <div>
        <strong>Data unavailable</strong>
        <p>{message}</p>
      </div>
      {retry ? (
        <button className="button secondary" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
function TableLoading() {
  return (
    <div className="table-loading">
      <LoaderCircle className="spin" size={20} /> Loading live data…
    </div>
  );
}
function SkeletonCards() {
  return (
    <section className="metric-grid">
      {[1, 2, 3, 4].map((key) => (
        <div className="skeleton metric" key={key} />
      ))}
    </section>
  );
}
function NoticeBanner({
  notice,
  onClose,
}: {
  notice: Exclude<Notice, null>;
  onClose: () => void;
}) {
  return (
    <div className={`notice ${notice.tone}`}>
      <span>
        {notice.tone === "success" ? (
          <CheckCircle2 size={18} />
        ) : (
          <ShieldAlert size={18} />
        )}
      </span>
      <p>{notice.message}</p>
      <button onClick={onClose} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
