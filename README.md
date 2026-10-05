# TASKLINK

TASKLINK is an Expo/React Native application that connects clients posting short-term work with local workers in Bacolod City.

## Current release target

The active no-cost demo target is the web build published through Expo static export and Firebase Hosting. It uses:

- Firebase Authentication
- Cloud Firestore
- Leaflet with OpenStreetMap tiles
- In-app task, chat, and workflow notifications

The web demo intentionally does not require Google Maps, Cloud Functions, Cloud Storage, EAS, or a Firebase billing upgrade.

## Local setup

Requirements:

- A supported Node.js LTS release
- npm
- Android Studio or an Android device for mobile testing
- A Firebase project with Email/Password Authentication enabled

Install the locked dependencies:

```bash
npm ci
```

Copy `.env.example` to `.env` and provide the Firebase web-client values from Firebase project settings. Do not place service-account credentials in the Expo environment file.

Run validation and start the app:

```bash
npm test
npm run test:rules:emulator
npm run start
```

## Authentication

The current secure baseline uses Firebase Email/Password Authentication. A normalized Philippine mobile number is mapped internally to an address such as:

```text
639171234567@tasklink.local
```

The Firebase Auth SDK owns the session used by Firestore and Storage. Mobile sessions are persisted with AsyncStorage and restored on app launch.

SMS OTP is not implemented yet. The old fixed prototype code and shared fallback password have been removed. Do not describe the current password flow as phone verification.

Employer and tasker accounts use the same login form. Registration selects the account type first and creates the matching `client` or `worker` profile directly; login reads that stored role and opens the correct dashboard. An existing idle account can change modes from Profile > Account Mode.

## Firebase security

Versioned Firebase configuration is included in:

- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

The rules are deny-by-default and separate private `users` documents from authenticated-readable `publicProfiles`. Task and chat reads are scoped to open tasks or actual participants.

Run `npm run test:rules:emulator` before deploying rules to a real project. The test suite uses the local `demo-tasklink` emulator project and does not access live Firebase data. Deployment is manual rather than automatic from this repository.

## Online deployment status

As of October 5, 2026:

- The no-cost web demo is published at [tasklink-fb027.web.app](https://tasklink-fb027.web.app) from the verified `tasklink` branch source.
- The reviewed Firestore rules and indexes are released to `tasklink-fb027`.
- Posting, applying, hiring, rejecting, withdrawing, chatting, starting, payment confirmation, completion approval, cancellation, ratings, and account-mode switching run directly against authenticated Firestore transactions.
- A tasker can apply to multiple open tasks but can hold only one confirmed assignment at a time. Finishing or cancelling it releases the tasker for another assignment.
- The demo uses COD with confirmation by both participants. Uploads, document verification, remote push, nearby-worker fan-out, automated moderation, and analytics generation are visibly paused.
- Cloud Functions and Cloud Storage are not deployed, and no billing plan was enabled or changed.

## Phase 7 beta hardening

The current client removes prototype names, ratings, counts, availability claims, and location fallbacks from operational screens. Job search, category filters, and sorting operate on live task data. Critical listener failures expose Retry Sync and Dismiss actions, while risky mutations keep their own result/loading states. A local error boundary prevents a render failure from becoming an unexplained blank screen.

Set `EXPO_PUBLIC_SUPPORT_EMAIL` in local, EAS, and Render environments to a project-owned mailbox if email support is wanted. When it is unset, the Help screen directs controlled-demo testers to their project coordinator without displaying a missing-requirement warning. No third-party remote crash processor or automated retention worker is represented as active.

The controlled-beta limitations, location/payment statements, manual deletion process, retention targets, and tester matrix are documented in [docs/TASKLINK_BETA_OPERATIONS.md](docs/TASKLINK_BETA_OPERATIONS.md). Physical-device offline, large-font, screen-reader, and four-role acceptance evidence is still required before claiming the Phase 7 or overall beta gate is complete.

## Phase 8 beta acceptance

The repository now uses an explicit Firebase `beta` alias and intentionally has no default/production alias. Run `npm run beta:preflight` for a value-redacted configuration check, `npm run beta:preflight:strict` before APK distribution, and `npm run test:beta:local` for the complete automated local gate.

Android standalone builds resolve `GOOGLE_MAPS_API_KEY` through `app.config.js`; the key must be configured in the EAS `preview` environment and restricted to the Android package/signing certificate. The reproducible setup, four-account fixture register, cloud deployment boundary, physical-device scenarios, evidence fields, and rollback procedure are in [docs/TASKLINK_BETA_ACCEPTANCE.md](docs/TASKLINK_BETA_ACCEPTANCE.md).

## Task workflow

The canonical task lifecycle is:

```text
Finding Workers -> Applied -> Accepted -> In Progress -> Pending Approval -> Finished -> Archived
```

Applications can also be withdrawn or rejected. Open tasks can be cancelled, and assigned participants can open a dispute. Task creation/payment linking and the core workflow mutations use Firestore batches or transactions. Completion requires verified payment evidence or dual COD confirmation. `Expired` is reserved for future trusted scheduled backend automation and cannot be set by the mobile client.

The UI reads `taskMatches` as the application source. `tasks.applicantIds` remains as a denormalized query/rules index and is updated in the same application transaction.

## Location, maps, and matching

TASKLINK requests foreground location only after the user taps a location action. Workers may save a private map pin for job discovery, but starting and finishing an assigned task requires a fresh device location with acceptable accuracy inside the task radius. Exact worker coordinates remain in the private `users` and `workerProfiles` documents and are not copied to `publicProfiles`.

Job recommendations and applicant cards use a deterministic score based on required capability, distance, availability, verification, experience, rating, and completed work. Missing location or capability data fails closed instead of using a hidden Bacolod coordinate.

Native Android maps work in Expo Go during development. Production Android builds need `GOOGLE_MAPS_API_KEY` in the local/EAS environment. Restrict that key to `com.tasklink.app` and the production signing certificate. Web uses Leaflet with visibly attributed OpenStreetMap tiles for navigation, click/tap selection, draggable pins, and geofence previews. The public OpenStreetMap tile service is for controlled beta traffic here, not assumed to be unlimited production hosting.

Nearby-worker notification fan-out is implemented in `functions/` as an optional trusted Firestore trigger, but it is not used by the no-cost web demo. Workers discover and filter open tasks from the live job feed, which never exposes another user's private coordinates.

## Chat and notifications

Task conversations use deterministic `taskId_workerId` IDs, so a client can communicate with separate applicants without overwriting another applicant's chat. Message listeners are participant-scoped, load the newest 100 records, and can page backward. Opening a conversation writes receiver-only read receipts.

The no-cost web demo supports unread state, deep links, and in-app notifications for applications, hiring, task status, COD confirmation, completion, ratings, cancellation, and chat. Remote Android push remains optional source code and is visibly paused in this release because its trusted sender requires Cloud Functions.

Remote push does not work in Expo Go on current Android SDK releases. Use an EAS development/preview build and configure the Android FCM credentials for the EAS project. The app never asks for notification permission until the user enables push in the Notifications screen.

Phase 4 adds a compound message index. After testing against a non-production Firebase project, deploy the rules and index together:

```bash
npx firebase-tools@15.32.0 deploy --only firestore:rules,firestore:indexes --project tasklink-fb027
```

Push and server-created message notifications additionally require the Blaze plan and a separate Functions deployment:

```bash
npx firebase-tools@15.32.0 deploy --only functions --project tasklink-fb027
```

No deployment is performed automatically by this repository.

## Verification, payment evidence, and administrator

Phase 5 replaces the profile upload placeholders with real image/PDF uploads. Profile photos are readable by signed-in users, while worker IDs, medical certificates, and payment proof stay behind owner/participant/custom-claim administrator Storage rules. Files are limited to 10 MB and unsupported content types are rejected by both the app and Storage rules.

Worker verification submissions atomically update the private worker profile, public verification label, and `verificationRequests/{uid}` queue. Workers can submit or resubmit documents, but cannot approve themselves. Administrators may review worker verification and GCash evidence. Only a custom-claim superadministrator may restrict/reactivate employer or tasker accounts or correct an approved locked name. Trusted changes append immutable `auditLogs` records.

Approved identity names are locked at both the private `users` document and mirrored `publicProfiles` boundary. The profile screen also disables the field, but Firestore rules remain the authoritative protection. Legacy workers already marked `Verified` receive the same lock even if they predate the shared identity fields. Names and private addresses are whitespace-normalized and length-validated; addresses remain private and editable under the current beta policy.

Payment behavior is verification only; TASKLINK does not process, hold, or escrow money:

- GCash requires an uploaded image/PDF receipt and administrator review.
- COD requires the client to record payment and the assigned worker to confirm receipt.
- A client cannot finish a task until its payment status is `Verified`.

The administrator route is not publicly registrable. Create a dedicated Firebase Authentication user whose email matches the app's mobile mapping (for example `639171234567@tasklink.local`), then run the provisioning script from a trusted machine with Firebase Admin application-default credentials:

```bash
npm --prefix functions run set-admin -- 09171234567
```

Provision the separate superadministrator authority only for a tightly controlled account:

```bash
npm --prefix functions run set-superadmin -- 09171234567
```

The superadministrator UI receives only a sanitized moderation view rather than full private profile documents. Restrictions require a reason plus an evidence reference or violation-report ID. Users can submit an immutable safety/conduct report from an assigned task, and ordinary administrators cannot read that report queue or perform superadministrator mutations.

Never put a service-account key in `.env` or in the Expo bundle. After provisioning, sign out and sign back in so Firebase refreshes the custom claim.

To deploy only the Phase 5 callable backend while push remains deferred:

```bash
npx firebase-tools@15.32.0 deploy --only firestore:rules,firestore:indexes,storage --project tasklink-fb027
npx firebase-tools@15.32.0 deploy --only "functions:reviewWorkerVerification,functions:reviewPaymentEvidence,functions:setUserAccountStatus,functions:correctLockedFullName,functions:submitViolationReport,functions:getSuperadminOverview,functions:confirmCashPaymentReceived" --project tasklink-fb027
```

Run the emulator tests first and deploy to a non-production Firebase project before production. Functions deployment requires the Blaze plan. The Firestore rules/indexes have been deployed to `tasklink-fb027`; the Functions commands remain documentation only and have not been run.

## Useful commands

```bash
npm run start
npm run android
npm test
npm run test:workflow
npm run test:functions
npm run test:rules:emulator
```

## Implementation plan

See [docs/TASKLINK_IMPLEMENTATION_ROADMAP.md](docs/TASKLINK_IMPLEMENTATION_ROADMAP.md) for the full gap analysis and phase plan.
