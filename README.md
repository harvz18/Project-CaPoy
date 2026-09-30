# TASKLINK

TASKLINK is an Expo/React Native application that connects clients posting short-term work with local workers in Bacolod City.

## Current release target

- Android through Expo/EAS
- Web beta through Expo static export and a connected Render Static Site
- Firebase Authentication
- Cloud Firestore
- Firebase Storage

Android remains the primary assessed release target. Web exports are supported for beta checking, with a coordinate fallback instead of the native map component.

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

## Firebase security

Versioned Firebase configuration is included in:

- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

The rules are deny-by-default and separate private `users` documents from authenticated-readable `publicProfiles`. Task and chat reads are scoped to open tasks or actual participants.

Run `npm run test:rules:emulator` before deploying rules to a real project. The test suite uses the local `demo-tasklink` emulator project and does not access live Firebase data. Deployment is manual rather than automatic from this repository.

## Online deployment status

As of October 1, 2026:

- The verified Phase 7 source is published through GitHub’s `tasklink` branch. A Render site linked to that branch with auto-deploy enabled should rebuild from the pushed commit; confirm the completed build in Render because this workspace has no Render API credential.
- The reviewed Phase 6 Firestore rules and indexes are deployed to `tasklink-fb027`. The participant, sender, receiver, and administrator analytics protections were exercised in the emulator before deployment.
- Cloud Functions are not deployed. This means trusted matching fan-out, remote push, moderation mutations, and analytics generation remain unavailable online. Firebase requires the Blaze pay-as-you-go plan for Functions, and deployment artifacts can produce small storage charges.
- Cloud Storage for Firebase also requires Blaze as of February 3, 2026. Upload/review features cannot be represented as fully online under a strict no-charge constraint.
- No billing plan was enabled or changed by these deployment steps.

## Phase 7 beta hardening

The current client removes prototype names, ratings, counts, availability claims, and location fallbacks from operational screens. Job search, category filters, and sorting operate on live task data. Critical listener failures expose Retry Sync and Dismiss actions, while risky mutations keep their own result/loading states. A local error boundary prevents a render failure from becoming an unexplained blank screen.

Set `EXPO_PUBLIC_SUPPORT_EMAIL` in local, EAS, and Render environments to a project-owned mailbox. When it is unset, the Help screen explicitly reports that beta support is not configured. No third-party remote crash processor or automated retention worker is represented as active.

The controlled-beta limitations, location/payment statements, manual deletion process, retention targets, and tester matrix are documented in [docs/TASKLINK_BETA_OPERATIONS.md](docs/TASKLINK_BETA_OPERATIONS.md). Physical-device offline, large-font, screen-reader, and four-role acceptance evidence is still required before claiming the Phase 7 or overall beta gate is complete.

## Task workflow

The canonical task lifecycle is:

```text
Finding Workers -> Applied -> Accepted -> In Progress -> Pending Approval -> Finished -> Archived
```

Applications can also be withdrawn or rejected. Open tasks can be cancelled, and assigned participants can open a dispute. Task creation/payment linking and the core workflow mutations use Firestore batches or transactions. Completion requires verified payment evidence or dual COD confirmation. `Expired` is reserved for future trusted scheduled backend automation and cannot be set by the mobile client.

The UI reads `taskMatches` as the application source. `tasks.applicantIds` remains as a denormalized query/rules index and is updated in the same application transaction.

## Location, maps, and matching

TASKLINK requests foreground location only after the user taps a location action. Workers may save a manual location for job discovery, but starting and finishing an assigned task requires a fresh device location with acceptable accuracy inside the task radius. Exact worker coordinates remain in the private `users` and `workerProfiles` documents and are not copied to `publicProfiles`.

Job recommendations and applicant cards use a deterministic score based on required capability, distance, availability, verification, experience, rating, and completed work. Missing location or capability data fails closed instead of using a hidden Bacolod coordinate.

Native Android maps work in Expo Go during development. Production Android builds need `GOOGLE_MAPS_API_KEY` in the local/EAS environment. Restrict that key to `com.tasklink.app` and the production signing certificate. Web uses a coordinate summary and manual/device-location fallback rather than the native map component.

Eligible-worker in-app notification fan-out is implemented in `functions/` as a trusted Firestore trigger. It reads private worker coordinates on the server and never exposes them to clients. Deploying Cloud Functions requires a Firebase project on the Blaze plan; nothing is deployed automatically by this repository.

## Chat and notifications

Task conversations use deterministic `taskId_workerId` IDs, so a client can communicate with separate applicants without overwriting another applicant's chat. Message listeners are participant-scoped, load the newest 100 records, and can page backward. Opening a conversation writes receiver-only read receipts.

The Notifications screen supports unread state, deep links, category preferences, and an explicit Android push opt-in. Expo push tokens are stored per user/device. Trusted Cloud Functions create message notifications and send push payloads with a delivery ledger, retryable request failures, and automatic disabling of tokens rejected as unregistered.

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
