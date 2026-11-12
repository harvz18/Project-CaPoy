# TaskLink Admin Portal

This is the standalone browser administration portal for TaskLink. It is separate from the Expo mobile application and uses the same Firebase project, Firebase Authentication, Firestore database, callable Functions, and trusted administrator API.

## Run locally

1. Open a terminal in this directory:

   ```powershell
   cd D:\Tasklink\Project-CaPoy\admin-portal
   ```

2. The local `.env` must contain the Firebase web-app configuration and `VITE_ADMIN_API_BASE_URL`. Use `.env.example` as the template. `VITE_FIREBASE_*` names are preferred; the existing `EXPO_PUBLIC_FIREBASE_*` names are also supported for local compatibility.

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

The portal uses the existing Firebase data model. The trusted administrator API retrieves protected verification, payment, profile-name, report, and audit data with a Firebase Admin service account after validating the signed-in staff member's Firebase ID token. Callable Functions continue to perform verification and payment reviews, user restrictions, and name corrections.

No database fields, Firestore rules, mobile routes, or production records are changed by this portal.

## Deployment note

Set `VITE_ADMIN_API_BASE_URL` on the portal host to the deployed `tasklink-admin-api` URL. Set `FIREBASE_SERVICE_ACCOUNT_JSON` and `ADMIN_PORTAL_ORIGINS` only on the API service host; never expose the service-account value to the browser. The callable Functions and Firestore rules must already be deployed for protected review actions to work.
