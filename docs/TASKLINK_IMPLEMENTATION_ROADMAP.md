# TASKLINK Implementation Roadmap

## Purpose

This document compares the requirements in `Nexspace-Innovation-IT27-HO6.pdf` with the code currently in `Project-CaPoy` and defines a safe order for turning the prototype into a working system.

This document began as a documentation-only audit. The implementation-status sections near the end now record the completed Phase 1 authentication/security foundation and Phase 2 canonical workflow work, including local verification results. No live Firebase deployment or production-data mutation was performed.

## Executive Summary

TASKLINK already has a broad Expo/React Native interface and a partial Firebase service layer. The main worker/client flow is represented in the UI: register, post a task, apply, accept a worker, start work, request completion, confirm completion, chat, record payment details, rate, and archive.

It is not yet production-ready or fully functional end to end. The highest-risk gaps are:

1. Firebase Authentication and Firestore do not share an authenticated session.
2. Firestore/Storage security rules, indexes, and deployable Firebase configuration are absent from the repository.
3. Authentication, OTP, geolocation, maps, uploads, push notifications, payment verification, smart matching, and administrator functions are incomplete or simulated.
4. Task transitions and permissions are mostly enforced by screen behavior, not by a trusted backend or strict data rules.
5. There are no automated tests, CI checks, seed/emulator workflow, or repeatable setup guide.
6. A tracked `secret.txt` entered Git history. Its contents were not read during this audit, but any credentials it contains must be treated as exposed and rotated.

The recommended approach is to stabilize authentication/security first, then enforce the task workflow, then add real location/matching, followed by messaging/notifications, verification/payment/admin, and finally release testing.

## Requirements Extracted From The Manuscript

The manuscript describes these required capabilities:

- Android mobile application focused on Bacolod City.
- Worker, employer/client, and administrator roles.
- Account registration, authentication, and account/profile verification.
- Worker profile with skills, capabilities, experience, availability, location/service radius, valid identification, and medical certificate.
- Employer task posting and applicant evaluation.
- Rule-based smart job matching using job requirements, worker skills/capabilities, experience, availability, and distance.
- Geofencing/location-based discovery and a task locator/map.
- Real-time applications, task status updates, notifications, and direct chat.
- Payment verification for e-wallet or cash transactions.
- Two-way ratings and feedback after task completion.
- Monitoring and management of users, tasks, transactions, and system data by an administrator.

## Manuscript Decisions That Must Be Resolved

The PDF is internally inconsistent in a few areas. These should be decided once and reflected in both the code and paper:

| Topic | Conflict | Recommended decision |
| --- | --- | --- |
| Product name | Cover/early pages use `TASLINK`; the project and most sections use `TASKLINK`. | Standardize on `TASKLINK`. |
| Backend | The software table names Supabase; the methodology, architecture, and code use Firebase. | Use Firebase only and correct the table. |
| Platforms | Scope says mobile/Android; architecture mentions Android and iOS; `app.json` declares Android and web. | Make Android the assessed release target. Keep other platforms only if they are actively tested. |
| Administrator | Scope/architecture require an administrator, but methodology notes it is unclear and the code has no admin role. | Define a minimal, auditable admin module before implementation. |
| Payment | Some sections imply secure transaction processing; current scope/code only records a method and proof text. | Define payment **verification** versus actual payment processing. Do not claim escrow or secured payment unless it is truly implemented. |
| Geofencing | The paper describes real location/map behavior; the code uses preset coordinates and a simulated map. | Implement device location and a real map, with permission and fallback behavior. |

## What Already Exists

### Application shell and UI

- Expo 54, React Native 0.81, React 19, TypeScript, and Expo Router.
- Worker and client dashboards.
- Login, registration, role selection, profiles, task posting, job board, task details/status, chat, ratings, and notifications screens.
- Shared components, types, theme files, and a central React context.
- Android EAS build profiles.

### Data/service code

- Firebase initialization for Firestore and Storage.
- Firebase Identity Toolkit REST calls for email/password-style authentication using normalized phone numbers.
- Firestore repositories for users, worker/client profiles, tasks, task matches, payments, messages, chats, ratings, and notifications.
- Real-time listeners for several collections.
- Transaction-based task application and status updates.
- Haversine distance calculation and radius helpers.
- Rating aggregate updates.

### Represented workflow

`Finding Workers -> Applied -> Accepted -> In Progress -> Pending Approval -> Finished -> Archived`

This is a useful prototype baseline, but the workflow is not yet safely enforced.

## Initial Gap Matrix

The table below preserves the state found during the original audit. See **Phase 1 Implementation Status** for the work completed afterward.

| Area | Current state | What is missing | Priority |
| --- | --- | --- | --- |
| Local setup | Lockfile exists, but dependencies are not installed in this checkout. Typecheck cannot start because `tsc` is unavailable. | Repeatable `npm ci`, environment template, setup steps, supported Node version, and verification commands. | P0 |
| Secrets | `secret.txt` is tracked and exists in Git history. `.env` is ignored but is not present. | Rotate exposed credentials, remove secrets from tracking/history as appropriate, and document EAS/local environment handling. | P0 |
| Firebase auth session | REST login returns tokens, but the Firebase JS SDK used by Firestore is never signed in. Tokens are not persisted or refreshed. Logout only clears React state. | One authoritative Firebase Auth session used by Firestore/Storage; restore session on launch; real sign-out; token refresh; auth-state routing. | P0 |
| Firebase deployment | No `firebase.json`, Firestore rules, Storage rules, indexes, emulator config, or backend functions were found. | Versioned security rules/indexes and a deploy/test process. | P0 |
| Data access/privacy | The app subscribes to all users, tasks, messages, and ratings before authentication. | User-scoped queries, participant-only chat reads, least-privilege profile data, pagination, and authenticated rules. | P0 |
| Route/role protection | Any route can be opened; most authorization is implicit in which buttons are shown. Users can change roles through profile updates. | Central auth/role guards and server/rule validation for every mutation. | P0 |
| Task state machine | Repository accepts caller-provided statuses with limited validation. Actor ownership and allowed transitions are not enforced. | Explicit transition policy, ownership checks, idempotency, timestamps, rejection/cancellation/dispute paths, and transactional invariants. | P0 |
| Registration/login | OTP is fixed at `123456`; missing/short passwords silently become `tasklink123`; register UI defaults to worker. Mobile number can later be edited without updating auth identity. | Real OTP or an explicitly documented password flow, validation, recovery, verified phone state, and immutable/verified identity changes. | P0/P1 |
| Session UX | Splash always sends users to login; `appLoading` ends before the first snapshots resolve. | Auth restoration, protected initial routing, real loading/error/offline states. | P1 |
| Smart matching | Job board mostly sorts by an in-radius boolean. Capability is displayed but not used as a scored recommendation. Experience, availability, verification, and employer-side ranking are absent. | Deterministic scoring rules, reason codes, thresholds, worker recommendations, applicant ranking, and tests. | P1 |
| Geolocation/geofencing | Preset Bacolod coordinates, illustrated maps, and a deliberate default-location bypass simulate success. No device location package is installed. | Runtime permission, current-location acquisition, real map/pin selection, geocoding, accuracy/timestamp checks, and secure check-in evidence. | P1 |
| Notifications | Firestore in-app records exist. New tasks notify every worker, regardless of skills/distance. Expo Notifications is installed but unused. Read state is not implemented. | Matching-targeted notifications, device tokens, push delivery backend, channels, read/unread updates, retry/deduplication, and preferences. | P1 |
| Applicant handling | `taskMatches` is written but never read. Other applicants are not rejected when one worker is accepted. Acceptance notification uses stale pre-update task data and can miss the selected worker. | Query matches, accept/reject/withdraw flows, notify the chosen/rejected applicants, and close applications atomically. | P1 |
| Worker availability/stats | Worker is returned to Available on completion but is not reliably made Busy on acceptance/start. Completed task totals are not incremented in the canonical user profile. | Transactional availability and completed-job counters. | P1 |
| Chat | Firestore messages work conceptually, but the app listens to every message. One chat document per task can overwrite participant metadata while multiple applicants exist. | Participant-scoped threads, one conversation per task/worker pair where needed, unread counts, read receipts, pagination, attachments policy, and rules. | P1 |
| File uploads/verification | Storage is initialized, but no upload service exists. Profile document controls store placeholder strings rather than uploaded files. | Image/document picker, validation/compression, Storage upload, metadata, secure access, review status, rejection reasons, and cleanup. | P2 |
| Payment verification | A client can submit arbitrary proof text. No image upload, worker acknowledgement, administrator verification, or provider integration exists. A separate payment service is unused. | Agreed verification workflow, proof file/reference data, verifier role, audit log, COD acknowledgement, rejection/dispute state, and rules. | P2 |
| Ratings | Duplicate ratings are possible; completion/participant checks are absent in the service. The UI sometimes exposes rating before completion. Aggregate and rating creation are separate operations. | Unique rating per task/reviewer, participant/completion enforcement, atomic aggregate update, moderation/reporting, and mirrored aggregates if required. | P2 |
| Administrator | No admin type, route, dashboard, claims, moderation, verification queue, transaction review, or audit log. | Minimal admin specification and implementation protected by custom claims. | P2 |
| UI truthfulness | Several screens show hard-coded names, ratings, job counts, distances, areas, market health, verification, “Payment Secured,” “Accident Insurance,” and “24/7 Support.” Some filters do nothing. | Replace demo data with real values or clearly label/remove it. Do not display unsupported safety/service claims. | P1 |
| Text/assets | Source includes visible mojibake such as `â€¹`, `â€¢`, and `âœ“`. Splash image is a remote third-party URL. | UTF-8 cleanup, local app assets, icons, accessibility review, and offline-safe loading. | P1/P2 |
| Error/offline behavior | Many screen handlers swallow errors and rely on one global context message. No offline/retry design is present. | Field/action errors, retry states, connectivity handling, optimistic mutation strategy, and telemetry. | P2 |
| Testing/release | No unit, integration, rules, emulator, end-to-end, lint, or CI setup. No build was validated during this read-only pass. | Automated tests, Firebase emulator tests, Android device matrix, EAS build verification, crash reporting, privacy/terms, and release checklist. | P0-P3 |
| Documentation | README is effectively empty. `prototype-guide.md` still describes removed local mock data. | One accurate setup/architecture guide and manuscript alignment. | P1 |

## Recommended Architecture

### Client

- Expo Router screens with route groups for public, worker, client, and admin areas.
- An authentication provider dedicated to Firebase session state.
- Feature services/hooks rather than one application-wide context subscribing to all data.
- Shared validation schemas and a centralized task transition policy for UI feedback.

### Trusted backend

- Firebase Authentication as the identity source.
- Firestore with collection-specific security rules and indexes.
- Firebase Storage with owner/reviewer access rules.
- Cloud Functions or another trusted API for operations that cannot safely be client-authoritative: push fan-out, admin actions, aggregate maintenance, sensitive workflow transitions, and optional matching materialization.
- Firebase Emulator Suite for repeatable integration and rules testing.

### Core collections

Keep the existing concepts, but define authoritative schemas and ownership:

- `users/{uid}`: limited public profile plus role and account state.
- `workerProfiles/{uid}` and `clientProfiles/{uid}`: role-specific profile data.
- `tasks/{taskId}`: task data and canonical workflow state.
- `taskMatches/{taskId_workerId}`: one application/match per worker/task.
- `conversations/{conversationId}` and nested or linked messages.
- `payments/{taskId}`: verification record, not a claim of escrow.
- `ratings/{taskId_reviewerId}`: deterministic ID prevents duplicates.
- `notifications/{notificationId}`: user-scoped in-app delivery status.
- `verificationRequests/{uid}`: protected document review state.
- `auditLogs/{logId}`: append-only privileged actions.

## Safe Phase-By-Phase Plan

### Phase 0 — Baseline, secrets, and reproducible setup

Goal: establish whether the current checkout builds without changing product behavior.

Tasks:

1. Create a working branch/checkpoint and preserve the current clean baseline.
2. Identify the categories of values in `secret.txt` without publishing them; rotate any real credentials.
3. Stop tracking secret material and add a sanitized `.env.example` containing names only.
4. Install exactly from `package-lock.json` with `npm ci`.
5. Run TypeScript, Expo Doctor, and an Android/web development start smoke test.
6. Record all compile/runtime errors before feature work.
7. Add `typecheck`, `lint`, `test`, and verification scripts as the toolchain is introduced.

Exit criteria:

- Fresh-clone setup is documented and reproducible.
- No secrets are tracked.
- Baseline app starts and its current failures are documented.

### Phase 1 — Authentication and security foundation

Goal: every read/write is associated with a real authenticated Firebase user.

Tasks:

1. Replace REST-only token handling with an authoritative Firebase Auth integration shared by Firestore/Storage.
2. Persist and restore authentication state; implement real sign-out.
3. Choose and implement the supported Android phone OTP approach, or explicitly scope Phase 1 to password auth while OTP is completed before release.
4. Remove the fallback shared password and prototype OTP.
5. Add protected route groups and strict worker/client/admin role checks.
6. Add Firestore and Storage rules with emulator tests.
7. Replace global listeners with user/role/participant-scoped queries.
8. Define account states: active, pending verification, suspended, deleted.

Exit criteria:

- Closed rules work; open public rules are unnecessary.
- Relaunch restores a valid session.
- A user cannot access another user's private data or perform another role's actions.

### Phase 2 — Canonical task workflow

Goal: make the core client-to-worker transaction correct and testable.

Tasks:

1. Define allowed transitions by actor, ownership, current state, and payment/verification prerequisites.
2. Add missing states/actions as approved: withdrawn, rejected, cancelled, disputed, and expired.
3. Make application, acceptance, rejection of remaining applicants, availability changes, payment-worker linking, timestamps, and notifications atomic/idempotent.
4. Read `taskMatches` as the application source instead of duplicating fragile arrays where possible.
5. Fix selected-worker notification and completed-task counters.
6. Add unit and emulator integration tests for every transition and invalid transition.

Exit criteria:

- Two test accounts can complete the full task lifecycle.
- Invalid actors/transitions fail at the data boundary, not only in the UI.

### Phase 3 — Real location and rule-based matching

Goal: deliver the manuscript's defining smart matching/geofencing behavior.

Tasks:

1. Add foreground location permission and a clearly explained denial/manual fallback.
2. Replace decorative maps with a real supported map and task pin selection.
3. Store location timestamps and accuracy; avoid silent default-coordinate bypasses.
4. Implement a deterministic matching score, for example:
   - required capability/skill match;
   - distance within task and worker radius;
   - availability;
   - verification eligibility;
   - relevant experience;
   - rating/completed tasks as a bounded secondary signal.
5. Return human-readable match reasons, not only a score.
6. Rank worker job recommendations and employer applicants with the same tested policy.
7. Notify only eligible/matching workers.

Exit criteria:

- Known fixture profiles/tasks produce predictable rankings.
- Real device location controls discovery/check-in with documented privacy behavior.

### Phase 4 — Chat and notifications

Goal: provide private, reliable coordination and real push events.

Tasks:

1. Scope conversations to authorized participants and support separate applicant conversations before hiring.
2. Add pagination, unread counts, read state, timestamps, and message validation.
3. Register Expo push tokens and create Android notification channels.
4. Send pushes from a trusted backend on matching/application/acceptance/status/payment/message events.
5. Add deduplication, retry, preferences, and foreground/background handling.
6. Implement notification read state and deep links.

Exit criteria:

- Only participants can read a conversation.
- Push and in-app notifications reach the correct account exactly once under normal conditions.

### Phase 5 — Verification, payment evidence, and administrator

Goal: complete the trust and monitoring features actually promised by the manuscript.

Tasks:

1. Implement camera/gallery/document selection and secure Storage upload.
2. Add worker verification requests with document metadata, review status, reason, and resubmission.
3. Define the minimum administrator module: verification queue, user suspension, task/report review, payment evidence review, and audit log.
4. Protect administrator access using Firebase custom claims and trusted backend mutations.
5. Implement the approved payment workflow:
   - e-wallet reference/proof upload and review; or
   - COD confirmation by both participants;
   - rejected/disputed outcomes.
6. Remove any unsupported “secured,” insurance, or support claims from the UI.

Exit criteria:

- Documents are private and accessible only to their owner and authorized reviewers.
- Every admin/payment decision has an immutable actor/time/reason audit record.

### Phase 6 — Product truth, accessibility, and resilience

Goal: eliminate prototype-only behavior and misleading UI.

Tasks:

1. Replace hard-coded names, ratings, counts, distances, areas, verification labels, and system-health values.
2. Make filters/search/sorting functional.
3. Fix source encoding and replace text glyph icons with a consistent icon set.
4. Bundle splash/brand assets locally.
5. Add loading skeletons, empty states, retry/error states, offline behavior, and mutation feedback.
6. Validate keyboard, screen reader, contrast, touch targets, and small-screen behavior.

Exit criteria:

- Every displayed fact is data-backed or clearly labeled as sample/demo content.
- Critical flows remain understandable under slow/offline/error conditions.

### Phase 7 — Test, deploy, and release

Goal: produce an assessable Android build with evidence that the whole workflow works.

Tasks:

1. Unit tests for matching, distance, validation, and state transitions.
2. Firebase emulator tests for rules and multi-document workflows.
3. End-to-end tests for worker/client/admin happy paths and high-risk failures.
4. Android testing across supported API levels and at least one physical device.
5. EAS preview build, smoke-test checklist, crash/analytics configuration, and rollback plan.
6. Privacy policy, terms, consent/retention rules for identity/location documents, account deletion, and support contact.
7. Update the README, architecture, data dictionary, test evidence, and manuscript to match the actual system.

Exit criteria:

- A fresh environment can build the same preview artifact.
- The release checklist and end-to-end evidence cover every stated objective.

## Reusable Patterns From MultiVent

No MultiVent source is present in this workspace, so code should not be copied blindly. The following engineering methods are suitable for TASKLINK if they match how MultiVent was stabilized previously:

- Establish a clean baseline and make one phase independently verifiable before adding the next.
- Keep external services behind small adapters so Firebase, location, upload, and notification behavior can be tested or replaced.
- Centralize workflow/status transitions instead of duplicating them across screens.
- Use deterministic document IDs and idempotent transactions for user actions that can be retried.
- Separate UI state from persisted server state and from authenticated session state.
- Use environment validation and sanitized templates rather than scattered secret access.
- Add seed/emulator data and a two-account end-to-end smoke path early.
- Treat displayed operational claims as features that require actual backing data and policy.

Patterns should be reused; MultiVent-specific domain models, names, or event assumptions should not be imported unless their behavior is verified against TASKLINK requirements.

## Proposed First Implementation Batch

The safest first code batch after approval is deliberately narrow:

1. Reproduce the project with `npm ci` and record baseline type/runtime diagnostics.
2. Add an accurate README and `.env.example` without values.
3. Remove/rotate tracked secret material using an agreed Git-history strategy.
4. Introduce Firebase Auth session handling and protected initial routing.
5. Add deny-by-default Firestore/Storage rules plus emulator tests.
6. Add a small seeded worker/client workflow test before modifying the visual design.

This batch should not yet add maps, payment providers, or administrator UI. Those depend on the identity and authorization foundation.

## Definition Of “Whole Project Works”

TASKLINK can be considered functionally complete when all of the following are demonstrated on an Android preview build:

1. A worker and client can register/login with verified identities and remain signed in after restart.
2. A client can create a correctly located task.
3. Only eligible nearby workers receive and see a ranked recommendation with understandable reasons.
4. A worker can apply; a client can review and accept exactly one worker; other applications close correctly.
5. Only the assigned participants can chat and change allowed statuses.
6. Real location/geofence checks support the agreed start/completion policy.
7. Payment evidence/confirmation follows the documented COD/e-wallet verification workflow.
8. Both parties can rate once after completion.
9. An authorized administrator can review required verification/payment/report items with an audit trail.
10. Security-rule, integration, and end-to-end tests pass, and a clean EAS preview build is reproducible.

## Current Validation Boundaries

- Dependencies are installed on the pinned Expo 54/Firebase 10 baseline. TypeScript, Expo Doctor, Android export, and local Firebase rules validation are recorded below.
- No Firebase console, live rules/index deployment, EAS secrets, or production backend was accessed.
- The contents of `secret.txt` were intentionally not printed or inspected.
- MultiVent source code was not available in the current workspace; only generally applicable engineering patterns are listed.

## Phase 1 Implementation Status — Complete for the Password-Auth Baseline

Implemented in the first security-foundation batch:

- Replaced REST-only login with the Firebase Auth SDK used by Firestore and Storage.
- Added persisted React Native authentication state and launch-time session restoration.
- Added real Firebase sign-out and cleanup when profile creation fails.
- Removed the fixed `123456` OTP UI and shared fallback password.
- Added protected public/worker/client routing.
- Added private `users` documents and sanitized `publicProfiles` for directory/applicant UI.
- Removed address, mobile number, verification-document URLs, and coordinates from public profiles.
- Scoped task listeners by role/participation and message listeners by sender/receiver.
- Added application-layer role, ownership, participant, and transition checks.
- Added deterministic one-rating-per-task/reviewer IDs and completion checks.
- Added versioned deny-by-default Firestore and Storage rules plus Firebase emulator configuration.
- Defined `active`, `pending_verification`, `suspended`, and `deleted` account states; users cannot change their own state, and blocked accounts lose application access.
- Added 14 Firebase Emulator tests covering authentication boundaries, private/public profiles, anti-tampering checks, atomic registration, task creation/application, closed-task reads, chat, ratings, verification documents, uploads, and payment-proof access.
- Added a sanitized `.env.example` and accurate setup/security notes in the README.
- Removed `secret.txt` from Git tracking while leaving the local ignored file intact. Existing Git history is not rewritten automatically.

Still intentionally deferred:

- Real SMS OTP. The current secure baseline is password authentication mapped from the normalized mobile number.
- Administrator custom claims and administrator routes, which depend on the Phase 5 admin specification. No unimplemented admin role is exposed by the Phase 1 client.
- Trusted backend functions for notification fan-out, rating aggregates, worker availability counters, and other cross-user mutations.
- Deployment of rules or changes to any live Firebase project.

Phase 1 verification performed locally:

- `npm run typecheck` — passed.
- `npm run test:rules:emulator` — 14/14 Firestore and Storage rules tests passed against the isolated `demo-tasklink` emulator project.
- Expo Doctor — passed 18/18 checks on the pinned Expo 54 dependency set.
- Android static export — completed successfully.

The Firebase Storage rules runtime emits a Java 24 shutdown warning after the successful test result. This is an emulator shutdown issue; the test command exits successfully. Java 21 LTS is recommended for quieter emulator operation.

## Phase 2 Implementation Status — Complete for the Client/Emulator Baseline

Implemented in the canonical workflow batch:

- Added one shared task-transition policy covering actor role, task ownership, assigned-worker identity, current state, selected applicant, availability, and payment prerequisites.
- Enforced the canonical lifecycle: `Finding Workers -> Applied -> Accepted -> In Progress -> Pending Approval -> Finished -> Archived`.
- Added worker withdrawal and client rejection actions, plus task cancellation and participant dispute actions. `Expired` is represented and displayed but remains system-only.
- Made task/payment creation atomic.
- Made application, withdrawal, rejection, acceptance, cancellation, payment confirmation, and completion repository operations transactional.
- Acceptance now selects one canonical worker, rejects remaining active matches, links the payment record, marks the selected worker Busy in private/role/public profiles, sets `activeTaskId`, and writes deterministic participant notifications.
- Completion now requires Submitted or Verified payment, restores worker availability, clears `activeTaskId`, increments the completed-task counter exactly once across the mirrored worker profiles, and notifies the worker.
- Added timestamps and deterministic IDs for workflow records and notifications so a completed transition cannot create duplicate logical events.
- Added role-scoped `taskMatches` listeners. The UI uses active match records as the application source. `tasks.applicantIds` remains only as a denormalized Firestore query/rules index until a trusted backend or separate private task projection removes that requirement.
- Added applicant rejection, application withdrawal, open-task cancellation, dispute, payment-gated completion, post-completion rating, and terminal-state UI behavior.
- Extended Firestore rules so invalid actors, skipped/reversed transitions, incomplete acceptance batches, forged availability/counter updates, and client-set expiration are denied at the data boundary.
- Added seven direct workflow-policy unit tests and expanded the isolated Firestore/Storage emulator suite to 25 tests, including a complete two-account lifecycle from task creation through archive.

Intentionally deferred beyond this baseline:

- Automatic expiration requires trusted scheduled backend code. Clients cannot set `Expired` themselves.
- New-task notification fan-out is still client-originated and broad. Matching-targeted fan-out belongs to Phase 3, while reliable push delivery/deduplication belongs to Phase 4.
- Dispute resolution, administrator payment verification, and immutable audit decisions belong to Phase 5.
- The local emulator verifies the two-account lifecycle and security boundary. A physical Android two-device/manual acceptance pass is still required before release.
- No rules, indexes, or application changes were deployed to a live Firebase project.

Phase 2 verification performed locally:

- `npm test` — TypeScript passed and 7/7 workflow-policy tests passed.
- `npm run test:rules:emulator` — 25/25 Firestore and Storage emulator tests passed against `demo-tasklink`.
- Expo Doctor — passed 18/18 checks.
- Android static export — completed successfully; the temporary export directory was removed afterward.

