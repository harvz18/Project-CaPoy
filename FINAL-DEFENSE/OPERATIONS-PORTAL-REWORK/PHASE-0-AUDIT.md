# Phase 0 — Operations Portal Rework Audit

## Scope and safety result

This phase performed a read-only audit. No portal behavior, Firebase data, rules, mobile-app code, payment workflow, or deployment configuration was changed.

The visual reference was inspected at `F:\Projects\Tasklink\TaskLink Operations Dashboard.png`. It establishes a dark-teal sidebar, pale operational workspace, compact white metric cards, mint active states, two-column analytics panels, a status donut, horizontal category bars, review queues, and a recent-activity table.

## Repository and portal architecture

- Repository branch: `tasklink`.
- Operations portal: `admin-portal/`.
- Portal framework: React 19 + TypeScript + Vite + React Router.
- Firebase client: Firebase Web SDK. The portal uses Firebase Authentication, Firestore, Functions, and Storage-compatible document access.
- Icon system: `lucide-react`.
- Current style system: `admin-portal/src/styles.css` plus `v5.css`; it already uses a fixed teal sidebar, responsive drawer behavior, light workspace, cards, tables, skeletons, error states, and mobile breakpoints.
- No supported chart library is currently installed. The Vite configuration has an optional `recharts` split point but the dependency is not present; Phase 3 must choose an existing-safe implementation or explicitly add a lightweight chart dependency only if necessary.

## Existing routes and portal pages

Current routes are guarded through `RequireStaff` and `RequireSuperadmin`:

- `/admin/:section?`
- `/superadmin/:section?`

Current shared pages include Dashboard, Users, Tasks, Applications, Verifications, Feedback, and Help. Existing Superadmin-only navigation additionally exposes Revenue, Reports, and Audit Log.

The current portal already has reusable primitives for panels, metric cards, tables, paging, search, sort controls, modals, document previews, loading skeletons, empty states, error states, notices, and responsive navigation.

## Authentication and current role behavior

- Portal authentication derives authority from Firebase Auth ID-token custom claims.
- `admin` and `superadmin` are both accepted by the existing staff guard; a separate superadmin guard protects the current `/superadmin/*` route family.
- Firebase callable Functions and the Render Admin API also perform trusted authorization checks.
- **Gap for this rework:** the current Admin navigation includes governance pages, and several existing backend review routes accept either admin or superadmin. This does not meet the new requirement that Admin be analytics/read-only. Phase 2 must narrow authorization in the UI, routes, callable Functions, Admin API, and Firestore-facing access pattern while preserving existing Superadmin workflows.
- The existing mobile `app/admin.tsx` also contains governance controls. It is not part of the web portal redesign, but Phase 2 must audit its role usage before tightening shared backend permissions so the intended Superadmin path remains available.

## Firestore collections and relationships observed

Existing rules, portal services, Functions, and Admin API use these established collections:

| Collection | Current purpose |
| --- | --- |
| `users`, `publicProfiles`, `workerProfiles`, `clientProfiles` | Account, role, public profile, availability, and identity progress data |
| `tasks`, `tasks/{taskId}/history` | Task lifecycle, assignments, location, status, and cancellation history |
| `taskMatches` | Worker applications, bids, and acceptance state |
| `payments`, `paymentProofFiles` | Worker-wage payment workflow and private proof metadata/chunks |
| `platformFees`, `platformRevenue` | Separate TASKLINK fee obligations and authorized configuration |
| `verificationRequests`, `verificationFiles` | Identity-review status and private credential storage |
| `ratings`, `violationReports` | Feedback and reports/disputes |
| `notifications` | In-app workflow notifications |
| `auditLogs` | Sensitive-action audit history |
| `analyticsSnapshots` | Sanitized administrator analytics snapshots |

No collection rename or migration is required for the portal rework.

## Existing analytics and financial behavior

- `functions/analytics.js` is the shared trusted aggregation utility, using Asia/Manila date boundaries and 1-day, 3-day, 1-week, 1-month, and compatible custom ranges.
- `getAdminAnalytics` reads authorized Firestore records from users, verification requests, tasks, payments, platform fees, task matches, and matching notifications, then materializes a sanitized analytics snapshot.
- Current analytics covers account/verification snapshots, task activity, task status counts, matching funnel metrics, payment counts, and platform-fee revenue by day/month/category.
- Revenue accounting correctly uses verified platform-fee events and keeps worker wages out of platform revenue. Pending, submitted, rejected, and outstanding fee states are represented separately.
- The current Superadmin Revenue page already consumes trusted period analytics; it is a reusable foundation for the later dedicated Admin Revenue Analytics page.

## Payment and task-lifecycle compatibility

- Task acceptance is a trusted backend transaction and can create one platform-fee obligation for the accepted wage.
- `platformFees/{taskId}` is server-owned: direct Firestore client writes are denied.
- Task progression requires a verified platform fee when an obligation exists.
- Cash confirmation uses trusted backend routes and a four-digit in-app PIN with encrypted/HMAC-protected storage, expiry, attempt limits, and invalidation.
- GCash remains a direct employer-to-tasker workflow with private recipient details and participant confirmation.
- These workflows are consumed by the Expo/mobile app and must remain unchanged by the portal-only UI rework.

## Existing security posture relevant to this rework

- Firestore rules protect private verification and payment proof records, platform-fee writes, task/payment participant access, and workflow-state transitions.
- Admin API routes require verified Firebase bearer tokens and trusted role checks.
- Sensitive governance actions create audit-log entries through the existing backend paths.
- The portal does not store Firebase Admin SDK credentials.

## Reference-to-current comparison

| Reference requirement | Current state | Phase plan |
| --- | --- | --- |
| Dark teal sidebar, light workspace, rounded cards/tables | Present, but spacing, branding, header composition, and card density differ | Phase 1 visual-system refinement |
| Separate Admin analytics vs Superadmin governance navigation | Not yet separated; Admin currently includes governance pages | Phase 2 role/navigation/backend tightening |
| KPI dashboard, charts, queue, activity table | Basic KPI dashboard exists; reference-grade live dashboard is incomplete | Phase 3 |
| Governance review/workflow pages | Existing Users, Tasks, Applications, Verifications, Feedback, Audit, Revenue foundations exist | Phase 4 reorganization and visual rework |
| Analytics/revenue/decision support/reports | Trusted analytics/revenue basis exists; dedicated analyst pages are incomplete | Phases 5 and 6 |
| Security/performance/visual QA | Existing tests cover rules, backend, and workflows | Phases 7 and 8 |

## Files identified for likely reuse in later phases

- `admin-portal/src/main.tsx`
- `admin-portal/src/services.ts`
- `admin-portal/src/types.ts`
- `admin-portal/src/auth.tsx`
- `admin-portal/src/adminApi.ts`
- `admin-portal/src/firebase.ts`
- `admin-portal/src/styles.css`
- `functions/analytics.js`
- `functions/index.js`
- `admin-api/server.js`
- `firestore.rules`
- `src/services/platformRevenueService.ts`
- `src/services/taskRepository.ts`

## Baseline status

- Current checked-out implementation is the previously validated revenue/payment revision commit `0db79b5`.
- The working tree contains two pre-existing untracked user documents: `TL Full Test Results.md` and `Tasklink Flow Test.md`. They will remain untouched.
- No deployment was performed.

## Phase 1 proposal

Rework only the shared web-portal shell and design system: reference-aligned sidebar branding, header, cards, panels, tables, badges, filters, loading/error/empty states, and responsive behavior. Preserve all existing route paths, queries, actions, and backend behavior.

## Approval checkpoint

Phase 0 is complete. Await approval before Phase 1.
