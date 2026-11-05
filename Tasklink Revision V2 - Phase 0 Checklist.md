# TaskLink Revision V2 — Phase 0 Inspection Checklist

**Status:** Complete — 5 November 2026
**Scope:** Read-only inspection and implementation plan. No Firebase data, rules, backend deployment, payment record, or application behavior was changed.

## Safety baseline

- The worktree already contains unrelated, uncommitted UI, MapLibre, documentation, and QA changes. They must be preserved and not reverted.
- The existing Firebase beta project must not be used for destructive tests.
- The existing task, worker-assignment, payment, and notification records must remain schema-compatible.
- The earlier project direction excludes payment/billing functionality from the final-defense scope. Therefore, Revision V2 Phase 7 cannot be implemented unless the owner explicitly reverses that direction. Existing payment records and flows will not be modified during other phases.

## Current implementation findings

| Area | Current state | Revision V2 implication |
|---|---|---|
| Employer task post | `app/post-task.tsx` creates tasks through `AppContext` and `taskRepository` using Firestore writes. Categories are a small local list; required capability is a single chip selection. | Phases 1–4 can improve the form while retaining its existing task fields and transaction-backed creation path. |
| Task editing | No employer edit-task route or repository update operation was found. | Phase 5 needs a separate authorization and material-change design; it is not a simple UI-only addition. |
| Categories/capabilities | Categories are currently `Delivery assistance`, `Basic repair`, and `Cleaning`; capabilities are centralized in `src/constants/capabilities.ts`. | Reuse the centralized capabilities dataset. Do not create a competing dataset. Categories need a compatibility plan before adding options. |
| Duration/schedule | Duration supports hour/day/week/month and is validated server-side as an integer 1–365. The duration-unit picker is currently a slide-up selection modal. Schedule start/end are required and exact-time based. | Phase 2 can safely add client-side sanitization, plus/minus controls, and a dropdown. Phase 3 `Anytime` requires a new explicit scheduling representation and workflow/rules review. |
| Location/map | The employer form collects location text, map/device coordinates, source, accuracy, and geofence radius. Web uses Leaflet; native uses MapLibre with the configured MapTiler style. | Rename only the visible form copy in Phase 1. Exact-address/reverse-geocoding work is Phase 4 and must remain no-cost; no automatic overwrite of manual addresses. |
| Payment/status | Payment documents are created alongside tasks. Current COD confirmation still requires uploaded evidence from both parties before verification. | Phase 7 conflicts with the final-defense no-payment direction and touches security-sensitive transactions; defer pending explicit owner approval. |
| Worker assignment/notifications | Acceptance and cancellation use Firestore transactions and create recipient-scoped in-app notifications. | Phase 5 task-update notification must extend the existing notification infrastructure and avoid duplicate records. |
| Profile addresses | Registration/profile use a single `address` field, validated by `profileIdentity`. | Phase 4 needs additive, optional structured-address fields or a carefully compatible representation; no destructive address migration. |
| Cancellation | A transaction-backed cancellation path exists for the employer; it releases an assigned worker and notifies applicants. | Phase 6 must first define worker authorization, cancellation reasons/history, and an arrival-safe condition without fabricating GPS results. |
| Authentication/OTP | Authentication is password-based Firebase Auth with normalized phone-derived email. Registration explicitly states SMS verification is not enabled. | Phase 9 requires Firebase-console/platform configuration and authorized test numbers. No paid SMS service will be enabled automatically. |
| Navigation | Protected routes and notification deep links exist. Most back actions call `router.back()` directly; Notifications alone has a `canGoBack()` fallback. | Phase 1 needs a shared, role-aware safe-back helper and direct/deep-link fallback audit. |
| Disputes | The task-status screen exposes an Open Dispute modal; repository and availability logic support the `Disputed` status. | Phase 8 may remove user entry points only. Historical data, status handling, and staff/audit paths must remain intact. |
| Theme/icons | The shared theme uses the blue-green primary `#005C55`. Several screens still render textual `x`, `v`, `›`, `+`, `i`, and letter icons. `@expo/vector-icons` is available through Expo but not declared as a direct dependency. | Phase 1 can replace only the audited textual controls with vector icons and align error/confirmation controls to shared theme tokens. |

## Phased implementation checklist

### Phase 1 — Simple UI/UX corrections

- [x] Aligned the shared theme and root action-error confirmation control with the existing blue-green theme.
- [x] Replaced audited textual controls with Expo's existing Feather vector icons; no new dependency was required.
- [x] Added a reusable role-aware safe-back helper and updated all prior direct `router.back()` actions without changing protected-route rules.
- [x] Changed employer-form copy from `Location & Service Area` to `Landmark`, including placeholder/helper/validation copy only; retained `location`, `locationAddress`, coordinates, and geofence fields.
- [x] Verified with TypeScript, two targeted navigation tests, full `npm test`, and web export.

**Phase 1 result (5 November 2026):** Complete. The full automated suite passed 88 tests: 55 workflow/domain/navigation, 5 beta-preflight, and 28 Functions-source tests. `npm run build:web` completed successfully. No Firebase operation, schema change, payment-record change, or deployment was performed. Android hardware-back behavior remains untested because no device/emulator is attached.

### Phase 2 — Form input and dropdown improvements

- [x] Added shared whole-number, duration, money, and phone-entry sanitizers. Budget and bid fields now accept a single decimal separator with up to two cent digits; direct task/bid validation rejects malformed monetary values.
- [x] Added manually editable minus/value/plus duration controls, bounded to the existing 1–365 range without changing the selected duration unit or duration calculation.
- [x] Replaced only the duration-unit slide-up modal with an inline, accessible dropdown for Hours, Days, Weeks, and Months. It expands below its input and closes after selection without overlaying the form.

**Phase 2 result (5 November 2026):** Complete. TypeScript, the full automated suite (91 tests: 58 workflow/domain/input, 5 beta-preflight, and 28 Functions-source tests), and `npm run build:web` passed. This phase made no Firebase operation, schema migration, rules change, payment-flow change, or deployment. Native device interaction remains to be visually checked in a development/preview build before release.

### Phase 3 — Employer task form enhancements

- [x] Centralized an expanded category list without duplicating existing capability names. New categories are stored in the existing `category` field, job discovery derives its filters from real task records, and missing legacy categories are ignored safely.
- [x] Replaced the one-capability chips with a checkbox modal backed by `workerCapabilities`. It keeps draft selections on reopen, discards drafts on Cancel, requires one selection, limits selection to three, and uses a themed validation message for a fourth choice.
- [x] Added additive `requiredCapabilities`, `scheduleMode`, and `scheduleDate` fields. New posts retain the legacy single `requiredCapability` field for compatibility. Matching now requires every selected capability and records policy version 6.
- [x] Added `Anytime` scheduling with a required calendar date and no persisted fabricated start/end time. Fixed-time schedules remain unchanged; task, job-board, and status views show `Anytime on <date>`.

**Phase 3 result (5 November 2026):** Complete. Flexible tasks deliberately do not produce an exact-time conflict because they have no agreed clock time. The existing acceptance transaction still marks the accepted worker Busy globally until the task reaches a release status, and the posting form tells participants to agree the exact start before work begins. Task expiry and notification behavior remain unchanged. TypeScript, the full automated suite (95 tests: 61 workflow/domain/input, 5 beta-preflight, and 29 Functions-source tests), and `npm run build:web` passed. No Firebase data operation, schema migration, Rules deployment, Functions deployment, payment change, or push was performed.

### Phase 4 — Address and map improvements

- [x] Added optional house/building, street, barangay, city/municipality, province, and postal-code inputs to profiles and the employer task form. They compose into the existing private `address` or task `locationAddress` string, so no schema migration or public-profile address exposure is introduced. House/building and postal code remain optional.
- [x] Added a user-triggered OpenStreetMap Nominatim reverse lookup for a selected task pin. It is throttled and memory-cached per device, has no autocomplete or background requests, shows provider/privacy notice, and presents a reviewable suggestion that never overwrites manual address data until the employer chooses it.
- [x] Confirmed the existing Leaflet/MapLibre map components already re-center on the selected coordinates, redraw the selected draggable marker, and retain the same form state when the full-map modal closes. The exact address is saved together with the existing task coordinates through the unchanged task creation path.

**Phase 4 result (5 November 2026):** Complete for the capstone’s low-volume, user-triggered lookup flow. The [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) limits public usage to one request per second per application, requires application identification/attribution, forbids autocomplete, and asks apps to cache results; larger or multi-user production use needs a compliant proxy or different provider. TypeScript, the full automated suite (97 tests: 63 workflow/domain/input, 5 beta-preflight, and 29 Functions-source tests), and `npm run build:web` passed. No Firebase data operation, schema migration, Rules deployment, Functions deployment, payment change, or push was performed. A real Android development/preview build still needs a visual network test of the reverse lookup and map interaction before release.

### Phase 5 — Task editing and worker notifications

- [x] Added an employer-only Edit Task route for `Finding Workers` and `Applied` tasks. It supports the existing title, description, category, required-capability, landmark/address, Leaflet/MapLibre pin, radius, duration, schedule, budget/pricing, and special-offer fields while keeping payment method, ownership, status, applications, and assignment immutable.
- [x] Direct edits use the existing Firestore transaction model and create one recipient-scoped `Task updated` notification per active applicant, with a task-detail route and a concise changed-field summary.
- [x] For an `Accepted` task, edits never overwrite the agreed live task. They become a versioned `changeRequest` holding both prior and proposed terms. The assigned tasker can accept or decline from Task Status; acceptance atomically applies the exact proposed terms, while decline preserves the prior agreement.
- [x] A pending change request blocks the assigned tasker from starting or progressing the task in both client workflow checks and Firestore Rules. Both decisions notify the employer, and notification IDs include request version/recipient to avoid duplicate records.
- [x] Added additive Firestore Rules for direct open-task edits, accepted-task proposals, and worker decisions. They prohibit payment/assignment/status changes through the edit path and verify that an accepted proposal applies its stored terms exactly.

**Phase 5 result (5 November 2026):** Complete in the source tree. TypeScript passed; the workflow suite passed 66 tests, including task-term comparison/request and pending-review transition coverage; and `npm run build:web` completed successfully. No Firebase data operation, Rules deployment, Functions deployment, payment change, push, or production action was performed. The Firestore Rules Emulator is still unavailable, so its live authorization cases require emulator or isolated-project validation before the Rules source is deployed. Until those Rules are deployed alongside this code, the new live edit writes will remain denied by the currently deployed Rules rather than changing production data unexpectedly.

### Phase 6 — Cancellation for both parties

- [x] Audited the existing cancellation transaction, worker check-in/start transition, availability release, match updates, notifications, payment records, and Firestore Rules.
- [x] Added a required 5–500 character cancellation reason and an accessible confirmation modal. Employers can cancel open tasks; either assigned participant can cancel only while the task is `Accepted` and before TaskLink records `startedAt`.
- [x] Added additive cancellation metadata (`cancelledBy`, role, reason, stage, timestamp, and preserved payment status) plus a required immutable `tasks/{taskId}/history/cancellation` event in the same transaction. The task-status view displays the resulting cancellation record.
- [x] Updated task-match closure, worker availability release, recipient-scoped notifications, and Firestore Rules together. Cancellation writes cannot touch payment records, and no refund or transfer is attempted.
- [x] Kept post-check-in worker cancellation unavailable. The system does not claim that missing GPS proves a worker is outside the task area; its safe boundary is the existing recorded check-in/start transition, with the existing dispute route shown as the fallback after start.

**Phase 6 result (5 November 2026):** Complete in the source tree. TypeScript passed; `npm test` passed 103 automated tests (69 workflow/domain/input, 5 beta-preflight, and 29 Functions-source tests); and `npm run build:web` completed successfully. Firestore Rules test coverage was updated for employer and assigned-worker cancellation transactions, but the Firebase CLI/Emulator is not installed in this workspace, so those Rules tests could not be run. No Firebase data operation, Rules deployment, Functions deployment, payment mutation, refund, transfer, push, or production action was performed. As in Phase 5, live cancellation writes remain safely denied until the reviewed Rules source is deployed later.

### Phase 7 — Cash confirmation and receipt

- [ ] **Blocked by current final-defense no-payment direction.** Requires explicit written scope change before any payment workflow, receipt, or print/export work.

### Phase 8 — Remove dispute UI

- [x] Removed the Task Status `Open Dispute` button, its confirmation modal, and user-help instructions that described opening a dispute. The cancellation flow remains the user-facing alternative before recorded task start; after start, the UI directs users to the project coordinator.
- [x] Preserved `Disputed` task status handling, historical records, Firestore Rules, worker-release recovery for pre-existing disputed tasks, notifications, analytics, and the administrator disputed-task queue. Existing disputed tasks still render safely as a non-actionable status.
- [x] Added a regression test that checks the user task-status and Help sources contain no dispute action/modal or dispute-opening instruction while retaining cancellation controls.

**Phase 8 result (5 November 2026):** Complete. `npm test` passed 105 automated tests (71 workflow/domain/UI-source, 5 beta-preflight, and 29 Functions-source tests), and `npm run build:web` completed successfully. No Firebase data operation, schema change, Rules/Functions deployment, payment change, push, or production action was performed. Historical dispute handling was deliberately retained for authorized administrators.

### Phase 9 — Phone OTP investigation

- [x] Audited the Firebase web Auth SDK integration, password/mobile-number identity mapping, registration/login UI, Android package/config, existing `phoneVerified` field, and absence of OTP/reCAPTCHA/native phone-auth implementation.
- [x] Verified current Firebase guidance: fictional console-configured phone numbers can test a code flow without sending SMS, but real verification SMS is currently Blaze-only. The Firebase JavaScript SDK also requires a compatible third-party application verifier on React Native; the existing app does not have one.
- [x] Preserved password authentication and did not enable the Phone provider, SMS regions, billing, real SMS, a fake-successful OTP path, or `phoneVerified`. Added only tested numeric six-digit OTP input and 60-second resend-cooldown helpers, explicitly documented as non-authentication scaffolding.
- [x] Added an owner-assistance section to `TL requirements.md` covering Firebase Console Phone-provider/test-number setup, the native verifier decision, development-build validation, and the explicit Blaze/institutional-project authorization required before real SMS.

**Phase 9 result (5 November 2026):** Safe investigation and preparation complete; live OTP implementation is blocked pending owner-controlled Firebase configuration and a compatible native verifier decision. TypeScript and local test/build verification are recorded after the final checks for this phase. No Firebase Console setting, SMS provider, billing plan, test phone number, user identity, `phoneVerified` flag, deployment, or production resource was changed.

## Dependencies and blockers

1. Physical Android MapLibre validation needs a development/preview build; Expo Go cannot load MapLibre native code.
2. The Firebase Emulator Suite remains unavailable for executing the 46 Rules tests.
3. Callable Functions cannot be deployed to the current Spark Firebase project without a billing-capable/institution-provided sandbox; no billing will be enabled.
4. Real phone OTP and reverse geocoding require provider/platform review and may be blocked by free-tier limits or credentials.
5. Payment-related phases remain out of scope until the owner explicitly changes the final-defense no-payment direction.

## Phase 0 evidence reviewed

- `Tasklink Revision V2.md`
- `TL Full Test Results.md`
- `TL Fix.md`
- `app/post-task.tsx`, `app/task-status/[id].tsx`, `app/profile.tsx`, `app/register.tsx`, `app/_layout.tsx`, and route-level navigation
- `src/constants/capabilities.ts`, `src/types.ts`, `src/context/AppContext.tsx`, `src/services/taskRepository.ts`, map components, and existing workflow/preflight tests
