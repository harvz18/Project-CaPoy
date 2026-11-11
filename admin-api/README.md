# TaskLink Admin API

This small Express service is the no-Firebase-Functions backend for the TaskLink
admin portal. It uses the Firebase Admin SDK only on the server and validates a
Firebase ID token plus the `admin` or `superadmin` custom claim for every
protected route.

## Deploy on Render

1. Create a **Web Service** from this repository and use `admin-api/render.yaml`
   or select `admin-api` as the root directory.
2. Add `FIREBASE_SERVICE_ACCOUNT_JSON` as a Render secret. Its value is the
   complete, single-line JSON from a Firebase Admin service-account key for the
   `tasklink-fb027` project. Do not place this key in this repository or in the
   portal's Vite variables.
3. Set `ADMIN_PORTAL_ORIGINS` to the exact portal origin, for example
   `https://tasklink-control.onrender.com`. Multiple origins can be separated by
   commas.
4. Copy the deployed service URL to the portal's
   `VITE_ADMIN_API_BASE_URL` environment variable and redeploy the portal.
5. Provision the initial staff account with the existing trusted script from a
   machine that has the same Firebase Admin credentials, then sign out and back
   in to refresh the account's ID token.

The service exposes `/health`, `/api/admin/analytics`,
`/api/admin/superadmin/overview`, and protected review/moderation routes. A
Render free web service can sleep when idle; its first request can therefore be
slow. It is appropriate for the capstone/demo deployment, not a production SLA.
