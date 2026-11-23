# Phase 2 — Role-Based Portal Separation

## Completed

- Admin navigation is analytics and reporting only.
- Superadmin navigation contains governance, verification, finance, audit, and configuration tools.
- Direct navigation to an unavailable Admin governance page redirects safely to the Admin dashboard.
- Governance callable actions and Admin API review/moderation routes now require Superadmin authority.
- Firestore privileged-read helper now resolves to Superadmin only. Admin analytics continue through the trusted `getAdminAnalytics` callable.

## Files changed

- `admin-portal/src/main.tsx`
- `functions/index.js`
- `admin-api/server.js`
- `firestore.rules`

## Security

No client-side hiding is relied on: route visibility, callable authorization, Admin API authorization, and Firestore rules are aligned.
