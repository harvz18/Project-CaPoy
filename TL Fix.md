# TASKLINK — PHASED FIX PLAN

This is a plan only. It is based strictly on findings in [TL Full Test Results.md](TL%20Full%20Test%20Results.md). No fixes, migrations, deployments, or payment changes were made.

## 1. Fix Strategy

Address environment and authorization evidence before UI polish. First make the isolated QA harness reproducible, then validate server-dependent administration workflows in a non-production Firebase project. Preserve the currently passing type, domain, Functions-source, and build tests throughout.

## 2. Phase 0 — Safety and Baseline

1. Create a dedicated fix branch and preserve the current working-tree baseline.
2. Do not overwrite the existing uncommitted source changes or untracked `metro.config.js`.
3. Capture a fresh passing baseline: root/admin typechecks, `npm test`, admin build, web export, and strict preflight.
4. Pin/document a supported Node runtime for Functions (package declares Node 20; this QA host used Node 24) and Java LTS for emulator use.
5. Keep testing isolated from the configured Firebase beta project; never use production user data.

**Implementation status (5 November 2026):** Added `.nvmrc` with Node 20 and updated the local setup documentation to match the declared Functions runtime. A pinned Firebase Emulator CLI install was attempted but did not complete, so no dependency or lockfile change was retained. Owner-required dependencies are listed in [TL requirements.md](TL%20requirements.md).

## 3. Phase 1 — Critical Security and Data Integrity

No confirmed P0 findings were identified. Do not make security-rule changes until the current 46 Rules tests run successfully against the local emulator and a regression baseline is captured.

## 4. Phase 2 — Authentication and Backend Reliability

### TLQA-001 — Callable Functions-dependent administration workflows are not deployed

- **Status (5 November 2026):** An explicitly approved beta deployment of five non-payment Functions was attempted, but Firebase rejected it before upload because enabling Cloud Build and Artifact Registry requires the Blaze pay-as-you-go plan. A live Functions-list check confirmed zero deployed Functions. No plan upgrade, payment method, payment Function, GCash capability, or transaction flow was created.
- **Root cause:** The beta project is on the Firebase Spark plan; server-authorized callable workflows require Functions infrastructure that cannot be enabled without Blaze or a separately provisioned institution sandbox.
- **Files likely affected:** Deployment configuration and environment only initially; `functions/index.js`, `admin-portal/src/services.ts`, and `src/services/adminService.ts` are validation targets, not pre-approved edit targets.
- **Proposed fix:** For a no-payment final defense, either (a) use an institution-provided non-production Functions-capable sandbox with no student billing, deploying only verification/moderation Functions, or (b) demonstrate the client-side flows and explicitly exclude server-authorized admin actions.
- **Dependencies:** Institution/project-owner-provided no-billing sandbox or an agreed defense-scope exclusion; isolated staff accounts and authorized deploy credentials if a sandbox is available.
- **Regression risks:** Callable authorization and audit logging. Payment-related state transitions are expressly out of scope.
- **Validation:** Function deployment smoke test; staff/non-staff callable tests for only verification/moderation; Rules emulator regression suite; no production data access and no payment flow.

## 5. Phase 3 — Task Lifecycle and Business Logic

No executable task-lifecycle failure was found. Preserve the passing workflow, scheduling, matching, location, payment-proof, chat, and rating tests. Once the emulator is available, run all 46 Rules tests before considering any lifecycle refactor.

## 6. Phase 4 — Mobile Functionality

### TLQA-002 — Native map-provider migration needs device validation

- **Implementation status (5 November 2026):** Replaced the Google-backed `react-native-maps` renderer with MapLibre, removed the Google Maps build-time configuration, and retained Leaflet for web. Native maps use MapTiler when `EXPO_PUBLIC_MAPTILER_API_KEY` is present and an attributed OSM fallback for controlled defense traffic when it is absent.
- **Dependencies:** A MapTiler public key for the preferred vector style, plus Android/iOS development or preview build access. MapLibre cannot run inside Expo Go.
- **Regression risks:** Native startup, map rendering, location privacy, task pin selection/dragging, route lines, and geofence behavior.
- **Validation:** Device tests for denied/granted permission, no coordinates, selected pin persistence/dragging, marker distinction, pinch zoom, inside/outside geofence, OSM fallback behavior, and MapTiler-style behavior after the key is supplied.

## 7. Phase 5 — Admin/Superadmin Portal

Do not change portal code solely from this QA run. After TLQA-001 is resolved, execute role-based portal tests with an ordinary user, admin, and superadmin. Cover rejected unauthenticated routes, session restoration, tables/search/pagination, documents, review decisions, audit logging, and responsive browser layouts.

## 8. Phase 6 — Maps, Notifications, and Integrations

- Maps: resolve TLQA-002 first, then perform physical-device testing.
- Push: deploy/test only in a non-production setup with disposable tokens; do not send production notifications.
- Payments: excluded from the final-defense scope. Do not add GCash, payment gateways, cash confirmation, payment evidence review, billing, or transaction functionality.

## 9. Phase 7 — UI/UX and Performance

### TLQA-003 — Public support mailbox is not configured

- Configure a project-owned support mailbox in approved environment configuration before broader beta distribution.
- Validate that Help exposes the correct contact without exposing personal mailboxes.

### TLQA-004 — Linting is not available as a repeatable repository check

- Add a pinned lint configuration and scripts only in a separately approved implementation task.
- Start in report-only mode, remediate intentional/project-specific rules deliberately, then add it to CI.

Also collect measured Firestore reads/listener counts and browser/mobile performance before proposing query or rendering changes; no performance defect was proven in this QA run.

## 10. Phase 8 — Full Regression Validation

The following must pass after any future fixes:

```text
npm run typecheck
npm --prefix admin-portal run typecheck
npm test
npm run test:rules:emulator
npm run beta:preflight:strict
npm run build:web
npm --prefix admin-portal run build
```

Then perform documented physical Android and browser acceptance runs with isolated accounts, including client/tasker/admin/superadmin roles, location/map cases, task lifecycle, verification, payment evidence, notifications, and accessibility/viewport checks.

### Latest flow-test update (5 November 2026)

The requested live beta registration/login flow passed for one new worker and one new employer. Each account created the expected Auth identity plus private, public, and role-specific Firestore profile documents, and could sign in again after sign-out. No new registration or role-profile remediation item was added. See [Tasklink Flow Test.md](Tasklink%20Flow%20Test.md) for the full test record and local QA credentials.

## 11. Fix Priority Table

| Priority | Bug ID | Issue | Proposed Phase | Risk | Validation |
|---|---|---|---|---|---|
| P1 | TLQA-001 | Callable Functions deployment is blocked by the Spark plan; no-payment defense must use an institution sandbox or exclude server-authorized administration workflows | 2 | High | Non-payment callable and role tests in an approved sandbox |
| P2 | TLQA-002 | MapLibre mobile migration requires a MapTiler key and physical-device validation | 4/6 | Medium | Preview build plus physical-device map/geofence tests |
| P3 | TLQA-003 | No configured public support mailbox | 7 | Low | Help-screen contact smoke test |
| P3 | TLQA-004 | No repeatable lint gate | 7 | Low | Pinned lint command in CI/local baseline |
| Blocker | B-01/B-02 | Rules emulator unavailable in QA environment | 0/8 | High validation risk | 46 isolated Rules tests execute and pass |

## 12. Implementation Dependencies

1. Emulator availability is a prerequisite for credible Rules regression validation.
2. TLQA-001 requires an institution/project-owner-provided no-billing Functions-capable sandbox, or formal exclusion of server-authorized administration actions from the defense.
3. TLQA-002 requires an Expo development/preview build for MapLibre and a MapTiler key for preferred-style validation.
4. No production code fix should be accepted without preserving the 86 currently passing automated tests.

## 13. Recommended Fix Order

1. Reproduce the Firebase Emulator Suite locally and run Rules tests.
2. Obtain an institution-provided no-billing Functions sandbox, or confirm the server-authorized administration workflows are excluded from the defense.
3. Configure `EXPO_PUBLIC_MAPTILER_API_KEY` in the approved environment; rebuild and test a preview APK on a physical device.
4. Configure the project support mailbox.
5. Add a lint gate and then schedule browser/mobile E2E and accessibility coverage.

## 14. Final Acceptance Criteria

- All existing 86 automated tests remain green.
- The 46 Firestore/Storage Rules tests run on an isolated emulator and pass.
- Callable administration workflows are either deployed and verified only in an authorized no-billing non-production sandbox, or explicitly excluded from the defense scope.
- Android map, location, and geofence behavior pass physical-device tests with the configured key.
- Staff/ordinary-user portal authorization and UI workflows pass browser acceptance tests.
- Support contact is configured for the intended beta scope.
- No P0/P1 defect is open, no production data is used for QA, and all evidence is redacted and retained outside the repository.
