# TaskLink Beta Operations, Privacy, and Retention

Status: Phase 7 beta policy  
Effective reporting timezone: Asia/Manila  
Production legal review: not completed

This document is the operating agreement for the current controlled beta. It distinguishes implemented behavior from manual procedures and future production work.

## Supported beta behavior

- Android is the primary device target. The Render web build supports the core Firebase workflow but uses a coordinate summary/manual fallback where native maps are unavailable.
- Authentication uses a password mapped from the normalized Philippine mobile number. SMS OTP is not implemented.
- TaskLink coordinates tasks, applications, chat, payment evidence, ratings, moderation, and foreground geofence checks.
- TaskLink does not provide emergency response, insurance, escrow, guaranteed payment, guaranteed employment, or continuous participant-visible tracking.
- Remote push, trusted moderation callables, matching fan-out, and administrator analytics require deployed Firebase Functions. If Functions remain undeployed, the corresponding UI must show unavailable or pending states.

## Permissions and location

- Foreground location is requested only after the user selects a device-location action.
- Workers may use a manual saved point for discovery.
- Start and finish actions require a fresh device reading with acceptable accuracy inside the task radius; the saved/manual discovery point cannot authorize those transitions.
- Foreground marker updates stop when the task screen closes, the app backgrounds, the task leaves an active state, or permission/location services fail.
- Exact worker coordinates remain in private profile documents. The Phase 5 moving marker stays in component memory and is not continuously uploaded or shared with employers.
- Notification permission is requested only after explicit push opt-in. In-app notifications remain the baseline.

## Payment and identity statements

- GCash and COD records are evidence/review states only. TaskLink does not transfer, hold, settle, or escrow funds.
- Verification status means an authorized administrator reviewed the submitted TaskLink documents. It is not an insurance, licensing, safety, or background-check guarantee.
- Approved names are locked. Corrections require the audited superadministrator flow.

## Beta retention schedule

The client cannot delete protected operational records. Firestore and Storage rules deny client deletion except for the user's own push token. Until a trusted cleanup service is approved and deployed, an authorized project operator must perform scheduled deletion manually and record the action.

| Data | Beta retention target | Notes |
| --- | --- | --- |
| Current worker location | Latest saved reading only; remove within 30 days of an approved account-deletion request | Profile updates overwrite the prior coordinates. No route history is created. |
| Verification request metadata and files | While pending, then 180 days after the final decision or superseding submission | Private; retain only what is required for beta review and dispute handling. |
| Payment evidence and private proof files | Through task closure, then 180 days after archive/resolution | Evidence status is not a financial settlement record. |
| Chat messages | Through the beta and up to 180 days after task archive/resolution | Participant-only access; do not use chat for passwords or identity-document delivery. |
| In-app notifications and delivery telemetry | 90 days | Matching analytics keeps aggregates, not exact worker coordinates. |
| Violation reports | 365 days after resolution | Superadministrator-only queue. Preserve linked audit references. |
| Immutable audit logs | 365 days, or longer if an unresolved moderation dispute references them | Client writes/deletes remain denied. |
| Sanitized analytics snapshots | 400 days | Contains aggregate counts only; no raw IDs, names, coordinates, proof links, or messages. |
| Public profile/rating/task records | Account/task lifetime plus the applicable dispute window | Account restriction is not equivalent to completed erasure. |

### Manual retention procedure

1. Work in a documented maintenance window and export only the minimum records required for rollback.
2. Identify records by documented decision/archive timestamps; never infer expiry from a user's name or free text.
3. Resolve active disputes and legal holds before deletion.
4. Delete private Storage objects before or with their referencing Firestore record so orphaned evidence is not retained.
5. Record the collection, date range, count, operator, reason, and completion time in an operator-controlled retention log. Do not put deleted private values into the log.
6. Re-run authorization smoke tests after cleanup.

Automatic scheduled cleanup is intentionally not represented as active. It requires trusted backend deployment, dry-run reporting, owner approval, and a rollback plan.

## Account deletion and correction requests

- The current beta does not offer one-tap account deletion. A tester submits a request through the configured beta support mailbox or the project coordinator.
- The operator must verify account ownership, check active tasks/disputes, remove Authentication and private profile data, apply the retention schedule to operational evidence, and confirm completion without returning private data over email.
- A restricted account remains preserved for moderation review until the request and any dispute are resolved.
- Do not ask testers to share passwords, Firebase keys, ID images, or payment proofs through ordinary support email.

## Failure, offline, and retry behavior

- Initial authentication restoration displays a blocking loading state.
- Listener/action failures display an alert with Dismiss and Retry Sync. Retry Sync reopens user-scoped real-time subscriptions; it does not blindly repeat a payment, application, acceptance, or completion mutation.
- Mutation buttons show an in-progress state where duplicate taps are risky. After an uncertain connection failure, refresh and inspect current task/payment status before retrying.
- A render error is contained by the local application error boundary and can be retried. The beta currently logs technical details locally; no third-party remote crash processor is configured.

## Beta support configuration

Set `EXPO_PUBLIC_SUPPORT_EMAIL` to a project-owned public beta mailbox before distribution. If it is absent, the app explicitly says support is not configured and directs the tester to the coordinator who supplied the build. Do not expose a developer's personal account by default.

## Required tester evidence

For each critical flow, record the date/time, app commit/build, account role, device and Android API/browser, network condition, expected result, actual result, and a redacted screenshot or log.

Test at minimum:

- registration, login, logout, session restore, and restricted-account rejection;
- task create/apply/withdraw/reject/accept/start/finish/approve/archive/dispute;
- GCash and COD evidence paths;
- two-party and multi-applicant chat authorization/read state;
- notification permission denied/allowed and in-app fallback;
- stale/inaccurate/outside-radius/inside-radius location paths;
- admin versus superadmin boundaries;
- slow network, disconnected network, reconnect, duplicate tap, and app restart during each critical mutation;
- small Android screen, large font scaling, keyboard visibility, screen-reader labels, and 44–48 px touch targets.

## Production blockers

Before public release, obtain reviewed privacy/terms text, configure a public support mailbox, approve and deploy retention automation, select a remote crash/error processor with consent and redaction, complete physical-device accessibility testing, and retain evidence of the full four-role acceptance run.
