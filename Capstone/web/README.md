# MULTIVENT Web Operations Console

Next.js workspace for MULTIVENT administrators and superadmins. It reuses the mobile app's Inter font, burgundy/gold color language, Material Design icon family, Supabase project, and existing role model.

## Run locally

From `Capstone/web`:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` and sign in. The authenticated profile role automatically determines which workspace areas are available.

The app automatically reads the mobile project's `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `Capstone/.env`. You can override either value in `web/.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Enable live admin data

Apply `database/20_admin_web_access.sql`, `database/21_service_moderation_workflow.sql`, and then `database/22_platform_audit_and_provider_service_crud.sql` to the same Supabase project after the existing migrations. They add:

- read policies for operational data;
- superadmin-only audit and settings visibility;
- audited RPCs for account suspension/reactivation, provider approval/rejection, and settings updates.
- an enforced service-review queue with audited approve/decline decisions.
- automatic re-review when a provider changes an approved service or package.
- safe provider service deletion that preserves records referenced by bookings.
- a detailed audit trail for meaningful create, edit, decision, and delete actions.

No service-role key belongs in this web app. All live actions use the signed-in user's session and are authorized in PostgreSQL.

## Access model

- `admin`: overview, users, provider and service approvals, bookings, payments, and reviews.
- `superadmin`: every admin privilege plus staff-account controls, audit history, and system settings.
- all other roles, inactive staff accounts, and unauthenticated users are signed out and returned to login.
