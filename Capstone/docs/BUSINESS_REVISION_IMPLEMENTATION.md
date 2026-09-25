# MULTIVENT Business Revision Implementation

This implementation extends the existing application without replacing the client, provider, booking, review, messaging, payment, or coordinator modules.

## Phase 1 status: complete

- Reused the existing `roles`, `permissions`, and `role_permissions` tables; no duplicate RBAC tables were introduced.
- Added `user_permissions` only for optional per-account overrides.
- Added database-backed `has_permission(...)` checks using active profile status, role defaults, additional `user_roles`, and explicit user overrides.
- Added RLS to all RBAC tables and limited their visibility to permission managers.
- Added audited role-default and user-specific permission RPCs.
- Added permission-aware web navigation and protected screen rendering.
- Replaced relevant legacy role-only backend checks with permission checks, including system settings and service-package review access.
- Superadmin remains an unconditional full-access role, preventing accidental lockout.

## Implemented foundation

- Dynamic role permissions through the existing `roles`, `permissions`, and `role_permissions` tables, plus per-user overrides.
- Internal `assistant` and `customer_service` roles.
- Permission-aware web navigation, route protection, and database authorization.
- Superadmin role-permission management and internal account creation.
- Public Event Coordinator registration and client coordinator selection removed.
- Automatic coordinator matching using active status, leave/unavailability, schedule conflicts, workload limit, and least-workload fairness.
- Coordinator confirmation remains required after automatic or staff assignment.
- Pending-assignment queue with automatic retries after availability changes.
- Provider commission agreement version tracking.
- Configurable commission rate (default `0.10`) and a payment-derived financial ledger.
- Admin revenue and cash-flow screens.
- Assistant provider/service decisions, remittance entry, and optional remittance verification.
- Customer Service ticket queue, responses, status handling, and a client/provider ticket form.
- Scoped RLS and audit records for permissions, assignments, approvals, finance, and remittance.
- Admin user access is view-only by default.

## Intentionally unchanged

The budget allocation slider redesign in Requirement 25 is not implemented. The revision explicitly requires waiting for the approved UI/UX design.

## Deployment order

1. Apply `database/30_business_operations_rbac.sql` after migration `29`.
2. Deploy the account-provisioning function:

   ```powershell
   npx supabase functions deploy admin-create-user --project-ref YOUR_PROJECT_REF
   ```

3. Deploy the `web` application.
4. Build/release the Expo application.

The Edge Function uses Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` values. Never place the service-role key in the web or Expo environment files.

## Initial configuration

- `commission_rate`: `0.10`
- `coordinator_workload_limit`: `5`
- `coordinator_default_event_hours`: `4`

These values are stored in `system_settings` and can be changed by a Superadmin.

## First-run checks

- Grant `coordinators.create` to Assistant only if office policy allows Assistants to create coordinators.
- Grant `coordinators.reassign` or `remittance.verify` only to roles that should have those elevated responsibilities.
- Pending legacy providers without a recorded agreement must accept the commission terms before approval.
- Confirm that an event entering `booking`, `payment_required`, `confirmed`, or `in_progress` receives a pending coordinator invitation or enters the unassigned queue.
