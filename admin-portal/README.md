# TaskLink Admin Portal

This is the standalone browser administration portal for TaskLink. It is separate from the Expo mobile application and uses the same Firebase project, Firebase Authentication, Firestore database, and callable Functions.

## Run locally

1. Open a terminal in this directory:

   ```powershell
   cd D:\Tasklink\Project-CaPoy\admin-portal
   ```

2. The local `.env` must contain the Firebase web-app configuration. Use `.env.example` as the template. `VITE_FIREBASE_*` names are preferred; the existing `EXPO_PUBLIC_FIREBASE_*` names are also supported for local compatibility.

3. Install and run:

   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```

4. Open the local URL printed by Vite, normally `http://localhost:5173`.

## Build and verify

```powershell
npm.cmd run typecheck
npm.cmd run build
```

The production files are written to `dist/`. For a static-host deployment, configure an SPA fallback so browser requests such as `/admin/dashboard` and `/superadmin/dashboard` return `index.html`.

## Access control

- Only Firebase users with an `admin: true` or `superadmin: true` custom claim can enter.
- The Superadmin-only routes are guarded in the browser and sensitive operations are also enforced by existing callable Functions.
- Employer and Tasker accounts are redirected out of the portal.
- This app does not include Firebase Admin SDK credentials or service-account keys.

## Data access

The portal uses the existing Firebase data model. It reads staff-authorized operational collections such as `publicProfiles`, `tasks`, `taskMatches`, `verificationRequests`, `payments`, `ratings`, and `auditLogs`. It uses callable Functions for analytics, verification and payment reviews, user restrictions, name corrections, and Superadmin violation-report data.

No database fields, Firestore rules, mobile routes, or production records are changed by this portal.

## Deployment note

Do not expose service-account credentials in the host configuration. Use only the public Firebase web configuration environment variables. The callable Functions and Firestore rules must already be deployed for the protected portal actions to work.
