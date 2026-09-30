# TASKLINK System Continuation

## Purpose

This document defines the next implementation work needed to make TASKLINK approximately 80–90% functional for supervised beta testing. It is a continuation plan only. Creating this file does not deploy Firebase resources, change production data, or implement the items below.

The current internal role names remain:

- **Employer** = `client`
- **Tasker** = `worker`
- **Administrator** = `admin`
- **Superadministrator** = proposed `superadmin`

The highest-priority beta feature is reliable location-based matching and notification.

## Current Baseline

The project already has implementations for authentication, the task lifecycle, matching, task maps, foreground location capture, chat, in-app notifications, optional push tokens, verification review, payment evidence, account suspension, and an administrator screen. Automated checks for Phases 1–5 passed locally during the previous implementation work.

On September 30, 2026, the tested Firestore rules and indexes were deployed to `tasklink-fb027`, and the web source commit was pushed to GitHub’s `tasklink` branch. All three message indexes reached `READY`. Cloud Functions, Storage rules, push setup, administrator provisioning, Render build completion, and physical-device flows remain unverified or undeployed. A feature must not be described as beta-ready merely because its local code or emulator test passes.

| Requested behavior | Current state | Continuation work |
| --- | --- | --- |
| Lock full name after approval | Implemented for the current worker-approval path, including legacy verified workers. Client code is pushed and Firestore enforcement is live; its trusted approval Function is not deployed. | Add employer approval/correction authority in Phase 2 and deploy the trusted backend only after billing approval. |
| Address | Private, editable, normalized, and length-validated locally. Its approval/locking policy is still not finalized. | Confirm whether approval should also lock address; it remains editable under the current default. |
| Superadmin restrictions | Implemented locally with a distinct custom claim, protected route/callables, violation intake, evidence-backed restrictions, locked-name corrections, and audit records. | Provision a trusted beta account and deploy Functions only after billing approval, then complete manual cloud testing. |
| Smart matching | Implemented locally using availability, required skill/capability, distance, verification, experience, rating, and completed tasks. | Harden location freshness, define weights/eligibility, expose reasons, and verify with device/cloud tests. |
| Admin analytics | Only small live counts are shown for reviews, payments, disputes, and users. | Add real, data-backed operational analytics and date filters. |
| Nearby-task geofencing notification | A task-created Cloud Function already evaluates eligible workers and creates deterministic nearby-task notifications. | Deploy to a test project, add freshness/telemetry protections, test push delivery, and prove boundary cases on devices. |
| Real-time map | A real native map, task pin, radius circle, and device user marker exist. Location is captured on demand, not continuously watched. | Add a controlled foreground live-location session and explicitly define who may see it. |

## Policy Decisions to Confirm Before Implementation

The safest default interpretation is recorded below so implementation can proceed later without redesign. These items should be confirmed with the project adviser or owner.

1. **Full-name lock:** once an employer or tasker has an approved identity, the user cannot edit `fullName`. A correction requires a superadmin action, a reason, and an audit record.
2. **Address:** the word “Address” was listed separately but its intended rule was not stated. Recommended default: keep the exact home address private and editable, but require revalidation if it is part of identity approval. A worker’s discovery location must remain separate from their written address.
3. **“Paticys”:** this is assumed to mean **Ratings**, which is a normal smart-matching factor and is already a bounded secondary factor in the current code. Do not change the matching policy based on this word until the interpretation is confirmed.
4. **Account restriction authority:** admins may review verification and payments; only a superadmin may suspend/reactivate employers or taskers, manage administrator access, or correct locked identity fields.
5. **Approval scope:** current identity verification applies only to taskers. If employers must also be approved before their name locks, introduce a shared identity-approval state instead of reusing the worker-only `verificationStatus` incorrectly.

## Target Permission Model

| Action | Employer | Tasker | Admin | Superadmin |
| --- | --- | --- | --- | --- |
| Edit own unlocked profile | Yes | Yes | Own admin profile only | Own superadmin profile only |
| Edit approved full name | No | No | No | Yes, with reason and audit log |
| Review tasker verification | No | No | Yes | Yes |
| Review payment evidence | No | No | Yes | Yes |
| View aggregate analytics | No | No | Yes | Yes |
| Suspend/reactivate employer or tasker | No | No | No | Yes, with reason and audit log |
| Create or remove admin authority | No | No | No | Trusted provisioning only |

Custom claims, not editable Firestore profile fields, must grant `admin` and `superadmin` authority. A user must never be able to promote themselves by changing a role value.

## Phase-by-Phase Implementation Plan

The continuation phases below are numbered independently from the original TASKLINK roadmap. The original Phases 1–5 remain the baseline. No continuation phase is complete until its exit criteria and verification checks pass.

| Phase | Focus | Starting status | Priority |
| --- | --- | --- | --- |
| 0 | Requirements and policy lock | Not started | Required before schema changes |
| 1 | Approved identity fields and address | Client pushed and Firestore deployed; backend/manual verification pending | High |
| 2 | Superadmin and account restrictions | Implemented locally; pending trusted provisioning/cloud verification | High |
| 3 | Geofenced discovery and nearby notifications | Implemented locally; not beta-proven | **Highest** |
| 4 | Smart-match consistency and explainability | Implemented locally; needs hardening | High |
| 5 | Foreground real-time map | Static/live user marker only | High |
| 6 | Administrator analytics | Basic counters only | Medium |
| 7 | Product and beta hardening | Not started | High |
| 8 | Beta deployment and acceptance testing | Not started | Release gate |

## Continuation Phase 0 — Requirements and Policy Lock

**Goal:** remove policy ambiguity before changing schemas, roles, or security rules.

**Starting status:** the requested behaviors are recorded, but four decisions still need confirmation.

### Tasks

1. Confirm whether employers, taskers, or both receive formal identity approval.
2. Confirm whether only `fullName` locks after approval or whether the written address locks too.
3. Confirm that “Paticys” means **Ratings**. Until confirmed, do not introduce a new matching field.
4. Confirm that only a superadmin may restrict/reactivate accounts, while admins retain verification and payment review.
5. Define what counts as a violation and what evidence/reason is required before restriction.
6. Freeze the beta terminology: Employer (`client`), Tasker (`worker`), Admin, and Superadmin.

### Deliverables

- Approved role/permission matrix.
- Approved identity and address policy.
- Approved smart-match factors and weights.
- Written restriction and appeal policy for beta testers.

### Exit criteria

- All four decisions are written without contradictory interpretations.
- The approved decisions can be translated directly into types, rules, functions, and UI behavior.

## Continuation Phase 1 — Approved Identity Fields and Address

**Goal:** prevent approved users from altering identity fields while keeping private address/location data correctly separated.

**Starting status:** `fullName` and `address` are editable. Worker verification exists, but a shared approval lock for both roles does not.

### Tasks

1. Add a shared identity-lock model if both employers and taskers require approval:
   - `identityStatus`;
   - `identityApprovedAt`;
   - `identityApprovedBy`;
   - `identityLockedAt`.
2. Preserve the current worker verification workflow and fields for compatibility.
3. Disable the Full Name field after the relevant approval becomes final.
4. Show why the field is locked and how the user may request a correction.
5. Enforce the lock in Firestore rules, not only in the profile screen.
6. Keep the exact address private and out of `publicProfiles`.
7. Normalize and validate the address without treating it as a GPS coordinate.
8. Keep these concepts separate:
   - written home/business address;
   - tasker discovery location;
   - employer task location;
   - active check-in location.
9. If the approved policy locks address, require a reviewed correction/resubmission workflow rather than a direct edit.
10. Add backward-compatible handling for existing profiles that do not yet contain the new identity fields.

### Verification

- Unit-test identity-lock decisions.
- Emulator-test approved and unapproved profile updates.
- Attempt direct Firestore writes that bypass the screen.
- Confirm public profiles never receive the private address or coordinates.

### Exit criteria

- An approved employer/tasker cannot alter locked identity fields through either the app or a direct Firestore request.
- An unapproved user can edit only the fields allowed by the final policy.
- Existing profiles continue to load safely during migration.

### Implementation status — Firestore deployed; trusted backend/manual verification pending

- Added shared `identityStatus`, approval actor/time, and lock-time fields to private user profiles.
- New taskers begin at `Pending Approval`; new employers begin at `Unverified`.
- Worker verification submission sets the shared identity state to `Pending Approval`.
- Existing administrator approval now changes a verified worker to `Approved` and writes the lock metadata.
- The profile screen disables Full Name after approval and explains how to request a correction.
- Firestore rules reject locked-name changes and require any allowed pre-approval name change to update the private and public copies atomically.
- Legacy workers with `verificationStatus == Verified` are treated as locked even without the new fields.
- Full names and addresses are trimmed, whitespace-normalized, length-validated, and rejected when they contain control characters.
- Addresses and identity approval metadata remain private and are not copied to `publicProfiles`.
- Under the current default policy, an approved user may still update their private written address. Changing this to an address lock requires the Phase 0 policy decision.
- Employer approval is not exposed yet. If a trusted Phase 2 action sets an employer to `Approved`, the Phase 1 rules and UI already enforce the name lock.

Phase 1 local verification:

- TypeScript passed.
- 17/17 application workflow, matching, location, and identity unit tests passed.
- 8/8 Functions tests passed.
- 31/31 Firestore and Storage emulator tests passed.
- Firestore rules and indexes were deployed to `tasklink-fb027`; all three message indexes are `READY`.
- Commit `080718e` was pushed to GitHub’s `tasklink` branch for the connected Render deployment workflow.
- Render build completion could not be verified from this workspace because no Render API/CLI credential or GitHub deployment status is available.
- Cloud Functions and Storage rules were not deployed because the no-charge constraint does not permit enabling or using billing-dependent services without explicit billing approval.

## Continuation Phase 2 — Superadmin and Account Restrictions

**Goal:** add a trusted authority that can restrict employers or taskers without allowing ordinary admins or users to escalate privilege.

**Starting status:** a protected `admin` role and audited suspension callable exist. There is no distinct superadmin claim, route, or permission boundary.

### Tasks

1. Add a `superadmin: true` custom claim provisioned only from a trusted environment.
2. Keep admin/superadmin authority out of user-editable profile data.
3. Add superadmin-only callable operations for:
   - suspension and reactivation;
   - locked-name correction;
   - restriction reason and evidence reference;
   - optional administrator account management.
4. Remove ordinary-admin suspension authority if Phase 0 confirms it is superadmin-only.
5. Record actor, target, previous value, new value, reason, and timestamp in append-only audit logs.
6. Add a violation/report intake record so restrictions can reference actual evidence.
7. Prevent a superadmin from accidentally restricting their own account.
8. Block restricted users at the Firestore/Storage boundary and on session/profile refresh.
9. Show restricted users a neutral reason/status and a support or appeal path.
10. Add a superadmin screen or protected section that does not expose unnecessary private documents.

### Verification

- Test worker and employer restriction/reactivation.
- Test admin denial for superadmin-only actions.
- Test self-promotion, forged role, and forged custom-claim scenarios.
- Test audit-log immutability and required reasons.
- Test an already-signed-in user immediately after their account becomes suspended.

### Exit criteria

- A superadmin can restrict either public role with a required reason and audit trail.
- A normal admin cannot restrict users, correct locked identity fields, or grant authority.
- A restricted user loses protected access without deleting historical records.

### Implementation status — Implemented locally, pending trusted provisioning/cloud verification

- Added `superadmin: true` custom-claim recognition while keeping Firestore profile roles unable to grant authority.
- Added a trusted `set-superadmin` provisioning script; it is not executed automatically and no beta account has been promoted.
- Ordinary administrators retain worker-verification and payment-review access but no longer see account-control actions.
- Account restriction/reactivation, locked-name correction, and sanitized moderation-overview callables require the superadmin claim.
- Restricting an account requires a reason plus an evidence reference or linked violation-report ID; self-moderation and admin/public targets are rejected.
- Restrictions and name corrections record actor, target, previous/new values, reason, evidence reference, and timestamp in append-only audit logs.
- Added immutable violation reports and a participant-facing report screen linked from assigned task status.
- Added a separate claim-protected superadmin screen for reports, account status, locked-name correction, and recent audits.
- Removed direct staff reads of private user/worker/client profile collections; normal admin uses public profiles and superadmin receives a sanitized callable response.
- Existing live user-profile listeners immediately sign out suspended/deleted accounts and show a restriction status, reason when available, and appeal direction.
- Firestore and Storage rules accept both staff claims for existing review duties, while only superadmins may read violation reports.

Phase 2 local verification:

- TypeScript passed.
- 19/19 application workflow, matching, identity, location, and authority tests passed.
- 13/13 Functions policy/helper tests passed.
- 32/32 Firestore and Storage emulator tests passed with the final least-privilege rules.
- Android and web exports passed with the superadmin and report routes.
- Cloud Functions were not deployed because doing so requires the Blaze plan; no billing setting was changed.
- No superadmin claim was assigned because selecting the real privileged account requires an explicit owner decision.

## Continuation Phase 3 — Geofenced Discovery and Nearby Notifications

**Goal:** reliably notify only eligible taskers when an employer posts a task inside their chosen discovery range.

**Priority:** this is the most important continuation phase.

**Starting status:** local code already calculates distance and a match score, creates deterministic nearby-task notifications from a task-created Cloud Function, and can deliver opted-in push notifications. It still needs freshness rules, cloud deployment, telemetry, and physical-device proof.

### Keep the two radii separate

- `preferredRadiusKm`: the tasker’s discovery range. It decides whether a newly posted job is close enough to recommend and notify.
- `geofenceRadius`: the employer-defined worksite boundary in meters. It protects task start/finish check-in and must not be used as the discovery range.

### Required event flow

```text
Employer creates valid task
        ↓
Trusted task-created function validates task location
        ↓
Load eligible taskers using private profile data
        ↓
Check account + availability + skill + fresh location + preferred radius
        ↓
Calculate distance and deterministic match score/reasons
        ↓
Create one tasker/task match-notification record
        ↓
In-app notification appears; push is sent only when opted in
        ↓
Record delivery/open/apply events for beta analytics
```

### Tasks

1. Define an explicit maximum age for a discovery location.
2. Refresh a tasker’s discovery location on a clear user action and appropriate app entry points.
3. Do not notify from an invalid, missing, inaccurate, or stale location.
4. Do not substitute a hidden default Bacolod coordinate.
5. Require all notification eligibility gates:
   - tasker role and active account;
   - `Available` state and no conflicting active task;
   - required skill/capability match;
   - valid task and tasker coordinates;
   - fresh tasker location;
   - distance within `preferredRadiusKm`;
   - accepted verification state;
   - open, unexpired task;
   - no existing deterministic notification for the same task/tasker.
6. Keep deterministic IDs such as `taskId_nearby_workerId` so retries cannot duplicate notifications.
7. Honor matching and push preferences separately.
8. Keep an in-app notification available when push permission is denied.
9. Record push submission, provider response, open, and application conversion without retaining unnecessary location history.
10. Freeze the task location after applications begin; use cancel/repost if it must materially change.
11. Deploy Functions, rules, indexes, and notification credentials only to a non-production beta project first.

### Verification

- Tasker exactly on, just inside, and just outside their discovery radius.
- Missing, invalid, inaccurate, and stale tasker location.
- Busy, suspended, deleted, or skill-mismatched tasker.
- Pending/rejected verification according to the final policy.
- Duplicate/retried task-created event.
- Push disabled but in-app matching enabled.
- Multiple taskers with different radii and skills.
- Worksite check-in exactly on, inside, and outside `geofenceRadius`.
- Employer attempts to fake the assigned tasker’s start/finish location.
- Foreground, background, and terminated-app push behavior on physical devices.

### Exit criteria

- An eligible nearby tasker receives exactly one in-app notification and one opted-in push under normal delivery conditions.
- Every failed eligibility gate prevents the notification and has a test.
- Start/finish check-in continues to use the smaller worksite geofence and fresh device coordinates.
- The beta project produces evidence for distance boundaries and delivery behavior.

## Continuation Phase 4 — Smart-Match Consistency and Explainability

**Goal:** use one predictable policy for worker job recommendations, employer applicant ranking, and nearby-notification eligibility.

**Starting status:** the current policy already considers availability, skill/capability, location, verification, experience, rating, and completed work. More beta fixtures and policy decisions are required.

### Tasks

1. Treat availability, matching capability, valid/fresh location, permitted verification state, active account, and discovery radius as eligibility gates.
2. Apply a bounded ranking score after mandatory gates pass:
   - skill/capability alignment as the strongest ranking signal;
   - location/distance as a strong signal;
   - verification as an eligibility or confidence signal;
   - ratings as a secondary signal;
   - experience and completed work as small secondary signals.
3. Do not exclude or heavily punish a new tasker merely for having no rating.
4. Confirm whether “Paticys” means Ratings before changing fields or weights.
5. Store `matchPolicyVersion`, score, distance, and readable match reasons.
6. Use the same policy implementation in trusted Functions and client display logic.
7. Define tie-breaking order and stable sorting.
8. Display why a task or applicant matched without exposing private coordinates.

### Verification

- Add fixtures for equal skills/different distances.
- Add fixtures for equal distance/different availability or verification.
- Add unrated new-tasker fixtures.
- Compare trusted-backend and client-side results for the same inputs.
- Test deterministic ordering and policy-version persistence.

### Exit criteria

- Known fixtures always produce the same eligibility, score, reasons, and ordering.
- Employer and tasker screens agree with backend notification selection.
- Matching explanations contain no exact private tasker coordinates.

## Continuation Phase 5 — Foreground Real-Time Map

**Goal:** show a safely updating device marker and task geofence during an active task without permanent background tracking.

**Starting status:** the native map, task pin, geofence circle, map selection, and user-location marker exist. The application captures location on demand but does not run a controlled position watcher.

### Tasks

1. Keep the existing `react-native-maps` component for the immediate beta to reduce regression risk.
2. Add a foreground location-watch service with balanced accuracy.
3. Start watching only on the relevant active-task/map screen.
4. Display the task pin, worksite radius, current device marker, last-updated time, and accuracy.
5. Update only after a meaningful time/distance threshold to control battery use.
6. Stop the watcher when the screen closes, task ends, permission is removed, GPS is disabled, or the app backgrounds.
7. Show permission-denied, GPS-disabled, inaccurate, stale, and retry states.
8. Keep the fresh high-accuracy one-shot reading for start/finish actions; a moving marker is not sufficient proof.
9. Do not add cross-user live sharing by default.
10. If employer-visible tasker movement is later approved, use a separate participant-only `activeTaskLocations/{taskId}` design with explicit consent, throttled writes, visible sharing status, and automatic expiry/deletion.

### Map provider decision

For the immediate beta, retain the existing provider. A production Android key and the provider’s current billing/setup requirements may apply.

If avoiding billed Google Maps setup is mandatory, complete a separate MapLibre-compatible proof of concept before replacement. MapLibre is open source, but map tiles and geocoding still require a compliant provider or self-hosting. Do not treat the public OpenStreetMap tile endpoint as unlimited production infrastructure or promise that a provider will remain free.

### Verification

- Walk/drive a controlled route on a physical Android device and observe marker updates.
- Confirm accuracy and last-update states.
- Confirm the watcher stops and does not continue unnecessary writes.
- Test permission removal, GPS off, app backgrounding, and screen unmount.
- Re-run inside/outside start/finish checks independently from the live marker.

### Exit criteria

- The map follows foreground movement reliably enough for beta checking.
- Watch lifecycle and battery/network limits are enforced.
- Exact tasker coordinates remain private unless a separate approved sharing feature is active.

## Continuation Phase 6 — Administrator Analytics

**Goal:** replace basic counters with real operational metrics that help administrators evaluate the beta.

**Starting status:** the administrator screen shows four live counts for reviews, payment checks, disputes, and users. It does not provide trends, funnels, date filters, or geofencing conversion data.

### Tasks

1. Define the metric dictionary before implementing charts or cards.
2. Add aggregate totals for:
   - employers, taskers, active accounts, and restricted accounts;
   - verification pending, approved, rejected, and resubmission;
   - tasks by lifecycle status and category;
   - posted, matched, applied, accepted, completed, cancelled, and disputed tasks;
   - payment evidence states and unresolved reviews.
3. Add matching/geofence measures:
   - eligible taskers per posted task;
   - matching notifications sent and opened;
   - notification-to-application conversion;
   - average time to first match and acceptance.
4. Add daily, weekly, and custom date-range filters.
5. Build trusted aggregate/event documents instead of downloading all private records to calculate every metric on the device.
6. Protect analytics reads using admin/superadmin claims.
7. Avoid exact coordinates, identity documents, private messages, or unnecessary user identifiers in analytics.
8. Label zero, loading, stale, and unavailable metric states honestly.

### Verification

- Seed known events and compare dashboard totals with expected values.
- Test date boundaries and timezone handling using Asia/Manila reporting dates.
- Test duplicate Function retries so counters do not increment twice.
- Verify ordinary users cannot read analytics documents.

### Exit criteria

- Dashboard values are data-backed and reproducible from documented definitions.
- Admin and superadmin can view metrics; employers and taskers cannot.
- Geofencing delivery and conversion can be evaluated without exposing precise location history.

## Continuation Phase 7 — Product and Beta Hardening

**Goal:** remove remaining prototype behavior and make critical flows understandable during errors, slow connections, and small-device use.

**Starting status:** the original roadmap’s product-truth/accessibility phase remains incomplete.

### Tasks

1. Remove remaining hard-coded names, ratings, counts, areas, and fallback claims.
2. Make filters, search, and sorting functional.
3. Fix source encoding and replace text glyph icons with a consistent icon system.
4. Add loading, empty, retry, offline, and mutation-result states.
5. Validate keyboard behavior, screen-reader labels, contrast, touch targets, and small screens.
6. Add data-retention/deletion rules for verification, payment, location, notification, audit, and analytics records.
7. Add crash/error monitoring and a beta support contact.
8. Document known limitations, permissions, location behavior, and tester responsibilities.

### Verification

- Run slow-network and offline checks for each critical screen.
- Run accessibility checks on registration, task creation, application, task status, chat, profile, admin, and superadmin screens.
- Confirm every displayed operational fact is data-backed or explicitly labeled as sample data.

### Exit criteria

- Critical flows remain understandable and recoverable under expected beta failures.
- No unsupported safety, payment, insurance, or real-time-tracking claim remains.

## Continuation Phase 8 — Beta Deployment and Acceptance Testing

**Goal:** demonstrate the agreed 80–90% functional beta in an isolated environment with reproducible evidence.

**Starting status:** local unit/emulator/export checks have passed for the earlier phases, but the complete continuation has not been deployed or physically tested.

### Tasks

1. Create or select a non-production Firebase beta project.
2. Configure sanitized beta environment values and restricted map credentials.
3. Deploy reviewed Firestore rules, indexes, Storage rules, and only the required Functions.
4. Provision separate employer, tasker, admin, and superadmin beta accounts.
5. Build an EAS development/preview Android artifact.
6. Run the complete four-account happy path.
7. Run authorization, stale-location, outside-radius, duplicate-notification, restriction, and offline failure paths.
8. Run foreground/background/terminated push checks on physical devices.
9. Record screenshots, logs, test dates, device/API versions, results, and known limitations.
10. Fix beta-blocking failures and repeat affected regression suites.
11. Keep production deployment outside this phase until beta evidence is accepted.

### Required verification commands and evidence

- TypeScript and unit tests.
- Functions tests.
- Firestore and Storage emulator tests.
- Expo Doctor.
- Android and web export/build checks.
- Physical Android location/map/push test matrix.
- Four-account permission and end-to-end workflow evidence.

### Exit criteria

- The beta-readiness gate below is demonstrated rather than estimated.
- A fresh environment can reproduce the preview build and test setup.
- No critical or high-severity authorization, workflow, location, or data-exposure defect remains open.

Each continuation phase must keep all earlier tests passing and add tests for its new authorization and state transitions. Schema changes must remain backward-compatible with existing beta data until a reviewed migration is available.

## 80–90% Beta Readiness Gate

TASKLINK can be described as approximately 80–90% functional for checking only when all of these are demonstrated—not estimated:

- Employer, tasker, admin, and superadmin permissions work on separate accounts.
- Approved identity fields cannot be forged or changed by ordinary clients.
- A superadmin can restrict either role and the restriction is audited and enforced.
- A nearby available tasker with matching skills receives one correct in-app notification and, when opted in, one push notification.
- An out-of-range, stale-location, busy, mismatched, or restricted tasker is not notified.
- The physical-device map shows live foreground location and geofence boundaries accurately enough for the agreed test cases.
- Smart-match results provide deterministic scores and understandable reasons.
- Admin analytics show real test-project values, not hard-coded numbers.
- The complete task, chat, verification, payment, rating, and restriction flows pass emulator and physical-device testing.
- Firestore/Storage rules, Functions, indexes, map configuration, and notification credentials are deployed only to the beta environment and verified there.
- Known limitations are written down for testers.

## Deliberately Deferred Unless Separately Approved

- Permanent background location tracking.
- Public or unrestricted display of tasker coordinates.
- Turn-by-turn navigation.
- Automated punishments without a reviewed report and superadmin decision.
- Claims of escrow, guaranteed payment, insurance, or emergency support.
- A production launch before beta evidence and privacy/retention rules are complete.

