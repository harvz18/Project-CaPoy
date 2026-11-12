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
  BarChart3,
  Bell,
  CheckCircle2,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Flag,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth";
import { firebaseConfigured } from "./firebase";
import {
  changeAccountStatus,
  correctName,
  getBasicDashboardCounts,
  getFeedbackCount,
  getSuperadminOverview,
  getVerificationDocumentUrl,
  loadPage,
  loadProfilesById,
  loadSubmittedPayments,
  loadTasksById,
  reviewPayment,
  reviewVerification,
  subscribePendingVerifications,
} from "./services";
import {
  AuditLog,
  BasicDashboardCounts,
  Payment,
  Profile,
  Rating,
  Task,
  TaskMatch,
  VerificationRequest,
  ViolationReport,
} from "./types";
import { where } from "firebase/firestore";
import "./styles.css";
import "./v5.css";

const PAGE_SIZE = 20;
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
  ["users", "Users", Users],
  ["tasks", "Tasks", ListChecks],
  ["applications", "Applications", FileText],
  ["verifications", "Verifications", ClipboardCheck],
  ["feedback", "Feedback", Star],
  ["analytics", "Analytics", BarChart3],
  ["help", "Help", CircleHelp],
] as const;
const superNavigation = [
  ...adminNavigation.filter(([id]) => id !== "analytics"),
  ["reports", "Reports", Flag],
  ["audit", "Audit log", ShieldCheck],
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
  if (section === "dashboard") return <Dashboard scope={scope} />;
  if (section === "users") return <UsersPage scope={scope} notify={notify} />;
  if (section === "tasks") return <TasksPage />;
  if (section === "applications") return <ApplicationsPage />;
  if (section === "verifications") return <VerificationPage notify={notify} />;
  if (section === "feedback") return <FeedbackPage />;
  if (section === "analytics") return <AnalyticsPage />;
  if (section === "help") return <HelpPage />;
  if (scope === "superadmin" && section === "reports")
    return <ReportsPage notify={notify} />;
  if (scope === "superadmin" && section === "audit") return <AuditPage />;
  return <Navigate to={`/${scope}/dashboard`} replace />;
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

function usePaged<T>(name: string, field: string, filter?: { field: string; value: string | number }) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(
    async (nextCursor: any = null, addHistory = false) => {
      setLoading(true);
      setError("");
      try {
        const page = await loadPage<T>(name, field, PAGE_SIZE, nextCursor, filter ? [where(filter.field, "==", filter.value)] : []);
        setItems(page.items);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
        if (addHistory) setHistory((current) => [...current, nextCursor]);
      } catch (failure) {
        setError(errorText(failure));
      } finally {
        setLoading(false);
      }
    },
    [field, filter?.field, filter?.value, name],
  );
  useEffect(() => {
    setHistory([]);
    void load();
  }, [load]);
  return {
    items,
    loading,
    error,
    hasMore,
    next: () => load(cursor, true),
    previous: () => {
      const back = history.slice(0, -1);
      setHistory(back);
      return load(back.at(-1) ?? null);
    },
    canGoBack: history.length > 0,
    refresh: () => load(history.at(-1) ?? null),
    pageNumber: history.length + 1,
  };
}

function useModerationStatuses(enabled: boolean) {
  const [statuses, setStatuses] = useState<Record<string, Profile>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);
  const refresh = useCallback(async () => {
    if (!enabled) {
      setStatuses({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const overview = await getSuperadminOverview();
      setStatuses(Object.fromEntries(overview.users.map((user) => [user.id, user])));
      setError("");
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, [enabled]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { statuses, error, loading, refresh };
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
  const page = usePaged<Profile>("publicProfiles", "fullName");
  const moderation = useModerationStatuses(scope === "superadmin");
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(() => searchParams.get("role") === "client" || searchParams.get("role") === "worker" ? searchParams.get("role") as string : "all");
  const [modal, setModal] = useState<{
    user: Profile;
    action: "suspend" | "active" | "name";
  } | null>(null);
  const users = scope === "superadmin"
    ? page.items.map((user) => ({ ...user, ...moderation.statuses[user.id] }))
    : page.items;
  const filtered = users.filter(
    (user) =>
      (role === "all" || user.role === role) &&
      `${user.fullName} ${user.businessName ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  useEffect(() => {
    const requestedRole = searchParams.get("role");
    setRole(requestedRole === "client" || requestedRole === "worker" ? requestedRole : "all");
  }, [searchParams]);
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
        </div>
      </div>
      <Panel
        title="Accounts"
        description={scope === "superadmin" ? "Restriction status is loaded from the trusted moderation record." : "Search and filter the current result page"}
      >
        <Table
          headers={[
            "Name",
            "Role",
            "Identity",
            "Rating",
            ...(scope === "superadmin" ? ["Actions"] : []),
          ]}
        >
          {filtered.map((user) => (
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
                {user.verificationStatus ||
                  user.identityStatus ||
                  "Not submitted"}
              </td>
              <td>
                {user.rating ?? 0}
                {user.ratingCount ? ` (${user.ratingCount})` : ""}
              </td>
              {scope === "superadmin" ? (
                <td>
                  <div className="row-actions">
                    <button
                      className="text-button danger-text"
                      disabled={moderation.loading || Boolean(moderation.error) || user.accountStatus === "suspended"}
                      onClick={() => setModal({ user, action: "suspend" })}
                    >
                      Restrict
                    </button>
                    <button
                      className="text-button"
                      disabled={moderation.loading || Boolean(moderation.error) || user.accountStatus !== "suspended"}
                      onClick={() => setModal({ user, action: "active" })}
                    >
                      Reactivate
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setModal({ user, action: "name" })}
                    >
                      Correct name
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </Table>
        {!page.loading && !filtered.length ? (
          <EmptyState title="No accounts in this result" />
        ) : null}
        {page.error || moderation.error ? (
          <ErrorState message={page.error || moderation.error} retry={() => { void page.refresh(); void moderation.refresh(); }} />
        ) : null}
        <Pager {...page} />
      </Panel>
      {modal ? (
        <UserActionModal
          modal={modal}
          close={() => setModal(null)}
          notify={notify}
          refreshed={() => { void page.refresh(); void moderation.refresh(); }}
        />
      ) : null}
    </div>
  );
}

function TasksPage() {
  const page = usePaged<Task>("tasks", "createdAt");
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "all");
  const employers = useRecordLookup<Profile>(
    page.items.map((task) => task.clientId || ""),
    loadProfilesById,
  );
  const filtered = page.items.filter(
    (task) =>
      (status === "all" || task.status === status) &&
      `${task.title} ${task.category} ${task.location} ${employers[task.clientId || ""]?.fullName || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  useEffect(() => {
    setStatus(searchParams.get("status") ?? "all");
  }, [searchParams]);
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Task oversight</h2>
          <p>Live task postings and workflow status.</p>
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
      <Panel title="Task postings">
        <Table
          headers={[
            "Task / employer",
            "Category",
            "Location",
            "Budget",
            "Applicants",
            "Status",
            "Created",
          ]}
        >
          {filtered.map((task) => (
            <tr key={task.id}>
              <td>
                <strong>{taskTitle(task)}</strong>
                <small>
                  {employers[task.clientId || ""]?.fullName ||
                    task.clientId ||
                    "Employer unavailable"}
                </small>
              </td>
              <td>{task.category || "—"}</td>
              <td>{task.location || "—"}</td>
              <td>{task.agreedAmount || task.wage || "—"}</td>
              <td>{task.applicantIds?.length ?? 0}</td>
              <td>
                <Badge value={task.status || "Unknown"} />
              </td>
              <td>{date(task.createdAt)}</td>
            </tr>
          ))}
        </Table>
        {!page.loading && !filtered.length ? (
          <EmptyState title="No tasks in this result" />
        ) : null}
        {page.error ? (
          <ErrorState message={page.error} retry={page.refresh} />
        ) : null}
        <Pager {...page} />
      </Panel>
    </div>
  );
}

function ApplicationsPage() {
  const page = usePaged<TaskMatch>("taskMatches", "createdAt");
  const [search, setSearch] = useState("");
  const tasks = useRecordLookup<Task>(
    page.items.map((match) => match.taskId || ""),
    loadTasksById,
  );
  const profiles = useRecordLookup<Profile>(
    page.items.flatMap((match) => [match.workerId || "", match.clientId || ""]),
    loadProfilesById,
  );
  const filtered = page.items.filter((match) =>
    `${match.taskId} ${tasks[match.taskId || ""]?.title || ""} ${match.workerId} ${profiles[match.workerId || ""]?.fullName || ""} ${match.clientId} ${profiles[match.clientId || ""]?.fullName || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Applications monitoring</h2>
          <p>
            Applications are read-only in this portal. Only the employer who posted the task can accept or decline worker applications. Administrators may monitor application records but cannot make hiring decisions on behalf of employers.
          </p>
        </div>
        <SearchBox value={search} onChange={setSearch} />
      </div>
      <Panel title="Task applications">
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
                <small>{match.taskId || "—"}</small>
              </td>
              <td>
                {profiles[match.workerId || ""]?.fullName ||
                  match.workerId ||
                  "—"}
              </td>
              <td>
                {profiles[match.clientId || ""]?.fullName ||
                  match.clientId ||
                  "—"}
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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    | {
        kind: "verification";
        item: VerificationRequest;
        decision: "Verified" | "Rejected" | "Needs Resubmission";
      }
    | { kind: "payment"; item: Payment; decision: "Verified" | "Rejected" }
    | null
  >(null);
  const [document, setDocument] = useState<{
    path: string;
    label: string;
  } | null>(null);
  const refreshPayments = useCallback(async () => {
    try {
      setPayments(await loadSubmittedPayments());
    } catch (failure) {
      setError(errorText(failure));
    }
  }, []);
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    try {
      unsubscribe = subscribePendingVerifications(
        (items) => {
          setRequests(items);
          setLoading(false);
        },
        (failure) => {
          setError(errorText(failure));
          setLoading(false);
        },
      );
      void refreshPayments().finally(() => setLoading(false));
    } catch (failure) {
      setError(errorText(failure));
      setLoading(false);
    }
    return unsubscribe;
  }, [refreshPayments]);
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Verification requests</h2>
          <p>
            Open the valid ID, medical certificate, and police clearance before
            deciding. Decisions update the user profile through a trusted
            Function.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => void refreshPayments()}
        >
          Refresh payments
        </button>
      </div>
      {error ? (
        <ErrorState message={error} retry={() => void refreshPayments()} />
      ) : null}
      <section className="dashboard-grid">
        <Panel
          title={`Identity review (${requests.length})`}
          description="Pending Tasker and Employer requests"
        >
          <Table
            headers={[
              "Account",
              "Uploaded requirements",
              "Submitted",
              "Decision",
            ]}
          >
          {requests.map((item) => {
            const requirementsComplete = Boolean(
              item.validIdPath &&
                item.medicalCertificatePath &&
                item.policeClearancePath,
            );
            return <tr key={item.id}>
                <td>{item.userId}</td>
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
                  <div className="row-actions">
                    <button
                      className="text-button success-text"
                      disabled={!requirementsComplete}
                      title={
                        requirementsComplete
                          ? undefined
                          : "All three documents are required before approval."
                      }
                      onClick={() =>
                        setModal({
                          kind: "verification",
                          item,
                          decision: "Verified",
                        })
                      }
                    >
                      Verify user
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        setModal({
                          kind: "verification",
                          item,
                          decision: "Needs Resubmission",
                        })
                      }
                    >
                      Request update
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() =>
                        setModal({
                          kind: "verification",
                          item,
                          decision: "Rejected",
                        })
                      }
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>;
          })}
          </Table>
          {loading ? <TableLoading /> : null}
          {!loading && !requests.length ? (
            <EmptyState title="No pending verification requests" />
          ) : null}
        </Panel>
        <Panel
          title={`Payment review (${payments.length})`}
          description="Submitted GCash evidence only"
        >
          <Table headers={["Task", "Amount", "Submitted", "Decision"]}>
            {payments.map((item) => (
              <tr key={item.id}>
                <td>{item.taskId || item.id}</td>
                <td>{item.agreedAmount || "—"}</td>
                <td>{date(item.updatedAt || item.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="text-button success-text"
                      onClick={() =>
                        setModal({
                          kind: "payment",
                          item,
                          decision: "Verified",
                        })
                      }
                    >
                      Verify
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() =>
                        setModal({
                          kind: "payment",
                          item,
                          decision: "Rejected",
                        })
                      }
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          {loading ? <TableLoading /> : null}
          {!loading && !payments.length ? (
            <EmptyState title="No submitted payment evidence" />
          ) : null}
        </Panel>
      </section>
      {modal ? (
        <ReviewModal
          modal={modal}
          close={() => setModal(null)}
          refreshPayments={refreshPayments}
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
  const selectedScore = score === "all" ? undefined : Number(score);
  const page = usePaged<Rating>("ratings", "createdAt", selectedScore === undefined ? undefined : { field: "score", value: selectedScore });
  const [total, setTotal] = useState<number>();
  const [countError, setCountError] = useState("");
  useEffect(() => {
    let active = true;
    setTotal(undefined);
    void getFeedbackCount(selectedScore)
      .then((count) => { if (active) { setTotal(count); setCountError(""); } })
      .catch((failure) => { if (active) setCountError(errorText(failure)); });
    return () => { active = false; };
  }, [selectedScore]);
  const filtered = page.items;
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
        <select
          value={score}
          onChange={(event) => setScore(event.target.value)}
        >
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} stars
            </option>
          ))}
        </select>
      </div>
      <Panel
        title={total === undefined ? "Feedback" : `Feedback — ${total} total records`}
        description={total === undefined ? "Counting live feedback records…" : `Showing ${filtered.length} of ${total} feedback records${score === "all" ? "" : ` rated ${score} stars`}.`}
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
        {page.error || countError ? (
          <ErrorState message={page.error || countError} retry={() => { void page.refresh(); void getFeedbackCount(selectedScore).then(setTotal).catch((failure) => setCountError(errorText(failure))); }} />
        ) : null}
        <Pager {...page} />
      </Panel>
    </div>
  );
}

function AnalyticsPage() {
  return <Dashboard scope="admin" />;
}

function ReportsPage({ notify }: { notify: (notice: Notice) => void }) {
  const [data, setData] = useState<ViolationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ViolationReport | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await getSuperadminOverview();
      setData(overview.reports);
      setError("");
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
          <h2>Violation reports</h2>
          <p>Superadmin-only report data from the trusted overview Function.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      <Panel title="Reports">
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
          {data.map((report) => (
            <tr key={report.id}>
              <td>
                <Badge value={report.category || "Other"} />
              </td>
              <td>{report.reason || "—"}</td>
              <td>{report.targetUserId || "—"}</td>
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
        {loading ? <TableLoading /> : null}
        {!loading && !data.length ? (
          <EmptyState title="No violation reports" />
        ) : null}
        {error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : null}
      </Panel>
      {modal ? (
        <ReportActionModal
          report={modal}
          close={() => setModal(null)}
          notify={notify}
          refreshed={load}
        />
      ) : null}
    </div>
  );
}
function AuditPage() {
  const page = usePaged<AuditLog>("auditLogs", "createdAt");
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h2>Audit log</h2>
          <p>Immutable staff action records.</p>
        </div>
      </div>
      <Panel title="Recent actions">
        <Table headers={["Action", "Target", "Reason", "Actor", "Date"]}>
          {page.items.map((item) => (
            <tr key={item.id}>
              <td>{item.action || "—"}</td>
              <td>
                {item.targetType
                  ? `${item.targetType}: ${item.targetId || "—"}`
                  : "—"}
              </td>
              <td>{item.reason || "—"}</td>
              <td>{item.actorId || "—"}</td>
              <td>{date(item.createdAt)}</td>
            </tr>
          ))}
        </Table>
        {!page.loading && !page.items.length ? (
          <EmptyState title="No audit records in this result" />
        ) : null}
        {page.error ? (
          <ErrorState message={page.error} retry={page.refresh} />
        ) : null}
        <Pager {...page} />
      </Panel>
    </div>
  );
}

function UserActionModal({
  modal,
  close,
  notify,
  refreshed,
}: {
  modal: { user: Profile; action: "suspend" | "active" | "name" };
  close: () => void;
  notify: (notice: Notice) => void;
  refreshed: () => void;
}) {
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [name, setName] = useState(modal.user.fullName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title =
    modal.action === "suspend"
      ? "Restrict account"
      : modal.action === "active"
        ? "Reactivate account"
        : "Correct locked name";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (modal.action === "name" && !name.trim()) {
      setError("Enter the corrected full name.");
      return;
    }
    if (modal.action === "suspend" && !evidenceReference.trim()) {
      setError("Provide an evidence reference before restricting an account.");
      return;
    }
    setBusy(true);
    setError("");
    const auditNote = reason.trim() || "No additional note provided.";
    try {
      if (modal.action === "name")
        await correctName(modal.user.id, name, auditNote);
      else
        await changeAccountStatus(
          modal.user.id,
          modal.action === "active" ? "active" : "suspended",
          auditNote,
          "",
          evidenceReference.trim(),
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
        {modal.action === "name" ? (
          <label>
            Correct full name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
        ) : null}
        <label>
          Optional audit note
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {modal.action === "suspend" ? (
          <label>
            Evidence reference
            <input
              value={evidenceReference}
              onChange={(event) => setEvidenceReference(event.target.value)}
              placeholder="Report ID or authorized evidence reference"
              required
            />
          </label>
        ) : null}
        {error ? <p className="inline-error">{error}</p> : null}
        <ModalActions
          busy={busy}
          close={close}
          confirm={
            modal.action === "suspend"
              ? "Restrict account"
              : modal.action === "active"
                ? "Reactivate account"
                : "Save correction"
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
    | { kind: "payment"; item: Payment; decision: "Verified" | "Rejected" };
  close: () => void;
  refreshPayments: () => Promise<void>;
  notify: (notice: Notice) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsReason = modal.decision !== "Verified";
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
      else
        await reviewPayment(
          modal.item.taskId || modal.item.id,
          modal.decision,
          reason,
        );
      notify({ tone: "success", message: `Review marked ${modal.decision}.` });
      if (modal.kind === "payment") await refreshPayments();
      close();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${modal.decision} ${modal.kind === "verification" ? "verification" : "payment"}`}
      close={close}
    >
      <form onSubmit={submit}>
        <p className="subtle">
          {modal.kind === "verification"
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
  document: { path: string; label: string };
  close: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void getVerificationDocumentUrl(document.path)
      .then((next) => {
        if (active) setUrl(next);
      })
      .catch((failure) => {
        if (active) setError(errorText(failure));
      });
    return () => {
      active = false;
    };
  }, [document.path]);
  const isPdf = document.path.toLowerCase().endsWith(".pdf");
  return (
    <Modal title={document.label} close={close}>
      {error ? <ErrorState message={error} /> : null}
      {!url && !error ? <TableLoading /> : null}
      {url ? (
        <div className="document-preview">
          {isPdf ? (
            <iframe src={url} title={document.label} />
          ) : (
            <img src={url} alt={document.label} />
          )}
          <a
            className="button secondary"
            href={url}
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
    setBusy(true);
    try {
      await changeAccountStatus(
        report.targetUserId,
        "suspended",
        reason.trim() || "Account restricted after violation report review.",
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
          Optional audit note
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
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
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
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
  value: number;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const contents = <>
      <span className="metric-icon">{icon}</span>
      <p>{label}</p>
      <strong>{value.toLocaleString()}</strong>
    </>;
  return onClick ? (
    <button className="metric metric-link" onClick={onClick}>{contents}</button>
  ) : <article className="metric">{contents}</article>;
}
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-wrap">
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
