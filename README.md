# TASKLINK

TASKLINK is an Expo/React Native application that connects clients posting short-term work with local workers in Bacolod City.

## Current release target

- Android through Expo/EAS
- Firebase Authentication
- Cloud Firestore
- Firebase Storage

Android is the configured and assessed release target. Web support can be added later as a separately tested platform.

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

Run `npm run test:rules:emulator` before deploying rules to a real project. The test suite uses the local `demo-tasklink` emulator project and does not access live Firebase data. Deployment is intentionally not automatic from this repository.

## Task workflow

The canonical task lifecycle is:

```text
Finding Workers -> Applied -> Accepted -> In Progress -> Pending Approval -> Finished -> Archived
```

Applications can also be withdrawn or rejected. Open tasks can be cancelled, and assigned participants can open a dispute. Task creation/payment linking and the core workflow mutations use Firestore batches or transactions. Completion requires a submitted payment confirmation. `Expired` is reserved for future trusted scheduled backend automation and cannot be set by the mobile client.

The UI reads `taskMatches` as the application source. `tasks.applicantIds` remains as a denormalized query/rules index and is updated in the same application transaction.

## Useful commands

```bash
npm run start
npm run android
npm test
npm run test:workflow
npm run test:rules:emulator
```

## Implementation plan

See [docs/TASKLINK_IMPLEMENTATION_ROADMAP.md](docs/TASKLINK_IMPLEMENTATION_ROADMAP.md) for the full gap analysis and phase plan.
