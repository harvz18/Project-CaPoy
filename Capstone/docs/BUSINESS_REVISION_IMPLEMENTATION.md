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

## Phase 2 status: implementation complete

- Added Assistant and Customer Service as internal roles with database-backed default permissions.
- Kept Event Coordinator registration out of the public Client/Service Provider signup flow.
- Added a pre-profile Auth safeguard that normalizes public attempts to claim an internal role.
- Kept coordinator event access assignment-scoped; Event Coordinators do not inherit the global staff `events.view` permission.
- Preserved the existing coordinator workspace, invitations, instructions, booked-service visibility, messaging, and task flows.
- Added mobile recognition for Assistant and Customer Service accounts so internal staff are directed to the web operations console instead of public role selection.
- Restricted Admin account creation to Superadmins and made internal-account creation fail closed if its audit entry cannot be recorded.

Phase 2 still requires deployment verification against the live Supabase project. Apply migrations `30` and `31`, deploy the account-provisioning Edge Function, and perform the role smoke tests below.

## Phase 3 status: implementation complete

- Added a consolidated permission-management RPC that returns only configurable internal roles and staff accounts.
- Limited role-default editing to Admin, Assistant, and Customer Service; public roles and assignment-scoped Event Coordinators cannot receive global staff access through this interface.
- Added per-user permission overrides with three states: inherit the role default, explicitly allow, or explicitly deny.
- Added optional permission overrides to the internal-account creation form and Edge Function.
- Kept Admin creation exclusive to Superadmins while allowing Coordinator creation through `coordinators.create`.
- Added input limits, clearer function errors, and rollback cleanup when role, override, or audit creation fails.
- Removed Auth-phone coupling so formatted office contact numbers are stored without causing Auth user creation failures.

Phase 3 requires migration `32`, a redeploy of `admin-create-user`, and a new Render deployment before live verification.

## Phase 4 status: implementation complete

- Added durable coordinator assignment-attempt history so a coordinator who declines an event is not immediately selected again by automatic assignment.
- Hardened least-workload assignment using active future assignments, configured workload limits, active-account checks, leave records, and event overlap checks.
- Added a configurable preparation/travel buffer (`coordinator_assignment_buffer_minutes`), defaulting to zero so existing schedules are unchanged.
- Revalidated availability, conflicts, and workload when a coordinator accepts an invitation.
- Automatically releases and rematches future events when new leave or unavailability creates a conflict.
- Prevented overlapping availability records and invalid availability records for non-coordinator accounts.
- Added immediate automatic retry after a declined invitation and retained the manual pending-assignment queue.
- Improved the web workforce calendar with full schedule ranges, removable availability records, manual assignment, and an explicit automatic-retry action.
- Added migration-time assignment for already-active legacy events that have no coordinator.

Phase 4 requires migration `33` and a new Render deployment. No Edge Function redeploy is required for Phase 4.

## Phase 5 status: implementation complete

- Added a dedicated provider-application inspection view with applicant, business, contact, agreement, account-standing, prior-decision, and rejection details.
- Added provider review timestamps and reviewer attribution without inventing metadata for historical decisions.
- Hardened provider decisions with explicit approve/reject transitions, mandatory rejection reasons, current commission-agreement checks, notifications, and audit records.
- Kept service moderation compatible with the established review workflow while preventing approval for a provider that is not currently verified and enabled.
- Added service-category filtering alongside the existing status and search filters.
- Limited new remittance entry to completed events and their accepted Event Coordinator.
- Validated optional bookings against the selected event, prevented over-remittance, and accumulated follow-up partial handoffs into the existing open record.
- Added remittance reviewer, review time, and dispute-reason fields; only fully remitted records can be verified, and disputes require a reason.
- Added coordinator notifications for remittance entry, verification, and disputes while retaining the existing database audit triggers.
- Expanded the remittance screen with completed-event selection, optional booking selection, server-associated coordinator details, status filters, staff/date details, and guarded verification actions.

Phase 5 requires migration `34` and a new Render deployment. No Edge Function or Expo redeploy is required for Phase 5.

## Phase 6 status: implementation complete

- Hardened public ticket creation so users cannot set staff-controlled status, priority, assignment, or resolution fields.
- Added scoped event and booking references for Clients, Service Providers, and accepted Event Coordinators without exposing unrelated records.
- Added a mobile related-record selector while retaining general platform tickets with no event or booking reference.
- Restricted direct ticket updates and moved lifecycle changes into audited Customer Service RPCs.
- Added a dedicated `support.assign` permission, active support-agent listing, assignment/reassignment, and unassignment.
- Added queue search plus status, priority, and assignment filters.
- Added detailed ticket context for the user, event, booking, payment, assignment, timestamps, and account standing.
- Added guarded status transitions: tickets must be resolved before closing, and closed tickets require elevated resolution access to reopen.
- Added public replies and private internal notes; internal notes are hidden from ticket owners and do not generate misleading user notifications.
- User replies now notify the assigned agent, or the active support team when unassigned, and reopen resolved tickets to active work.
- Added first-response, last-message, and closed timestamps plus content-free audit records for creation, lifecycle changes, public replies, and internal notes.
- Kept Customer Service access limited to ticket-linked user, event, booking, and payment information.

Phase 6 requires migration `35`, a new Render deployment, and a new Expo build/release. No Edge Function redeploy is required for Phase 6.

## Phase 7 status: implementation complete

- Replaced the dashboard's repeated browser-side table scans with one permission-guarded, read-only analytics RPC.
- Preserved the original dashboard response fields for compatibility while adding structured user, provider, service, booking, event, finance, and action-center metrics.
- Added 12-month booking, event, gross-value, and commission trends with explicit zero-value months.
- Added current-month comparisons against the prior month for bookings, provider registrations, and commission revenue.
- Added verified-provider performance using review counts, average rating, booking volume, completed bookings, booked value, and completion rate.
- Added service-category demand and event-type performance summaries without changing operational records.
- Replaced fabricated uptime and service-health claims with ratios computed from actual event, booking, provider, and ledger data.
- Added a responsive Admin dashboard with refresh/error states, business-health ratios, recent bookings, and permission-scoped action queues.
- Retained a limited operational overview for staff without `dashboard.analytics.view`; unauthorized data requests are skipped rather than attempted.

Phase 7 requires migration `36` and a new Render deployment. It does not require an Edge Function or Expo redeploy.

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
- Read-only Admin business analytics, provider statistics, monthly trends, and operational aggregates.
- Assistant provider/service decisions, remittance entry, and optional remittance verification.
- Customer Service ticket queue, responses, status handling, and a client/provider ticket form.
- Scoped RLS and audit records for permissions, assignments, approvals, finance, and remittance.
- Admin user access is view-only by default.

## Intentionally unchanged

The budget allocation slider redesign in Requirement 25 is not implemented. The revision explicitly requires waiting for the approved UI/UX design.

## Deployment order

1. Apply `database/30_business_operations_rbac.sql` after migration `29`.
2. Apply `database/31_internal_roles_hardening.sql` after migration `30`.
3. Apply `database/32_superadmin_permission_management.sql` after migration `31`.
4. Apply `database/33_coordinator_scheduling.sql` after migration `32`.
5. Apply `database/34_assistant_operations.sql` after migration `33`.
6. Apply `database/35_customer_service_ticket_management.sql` after migration `34`.
7. Apply `database/36_admin_business_analytics.sql` after migration `35`.
8. Deploy the account-provisioning function:

   ```powershell
   npx supabase functions deploy admin-create-user --project-ref YOUR_PROJECT_REF
   ```

9. Deploy the `web` application.
10. Build/release the Expo application.

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

## Phase 2 smoke tests

- Confirm public signup offers only Client and Service Provider registration.
- Attempt a public Auth signup with `default_role=event_coordinator`; confirm the resulting profile is a Client.
- Create one Assistant, one Customer Service user, and one Event Coordinator through the internal account form.
- Confirm Assistant sees only granted operations pages and cannot create an Admin unless the caller is a Superadmin.
- Confirm Customer Service sees the support workspace and only ticket-related user/event/booking/payment information.
- Confirm an Event Coordinator sees only accepted assigned events, pending invitations, and records belonging to those events.
- Confirm suspended and disabled internal accounts cannot enter either staff workspace.

## Phase 3 smoke tests

- Toggle one Assistant role permission and confirm navigation and direct-page access both update after the user signs in again.
- Set an individual permission to Deny, confirm it overrides an allowed role default, then return it to Inherit.
- Set an individual permission to Allow and confirm it overrides a blocked role default.
- Create an Assistant or Customer Service account with at least one custom override and verify the override appears after creation.
- Confirm an authorized Assistant with only `coordinators.create` can create an Event Coordinator but cannot create other internal roles.
- Confirm a non-Superadmin cannot create an Admin account even if granted `users.create`.
- Confirm Client, Service Provider, Event Coordinator, and Superadmin do not appear as editable role defaults.

## Phase 4 smoke tests

- Move an event into `booking`, `payment_required`, or `confirmed` and confirm the least-loaded conflict-free coordinator receives a pending invitation.
- Confirm a coordinator with overlapping leave, another event, or a full workload is not automatically or manually assigned.
- Decline an invitation and confirm the same coordinator is not selected again for that event while another eligible coordinator is available.
- Add leave that overlaps a future pending or accepted event and confirm the event is safely rematched or placed in the pending-assignment queue.
- Confirm an event with no eligible coordinator remains valid and appears in the Coordinator Queue with a client-safe pending status.
- Use **Retry automatic** after changing availability and confirm the queue refreshes without duplicate staff notifications.
- Attempt to create an overlapping availability record and confirm it is rejected.
- Accept an invitation after introducing a schedule conflict and confirm acceptance is blocked while MULTIVENT rematches the event.

## Phase 5 smoke tests

- Open a pending provider application as an Assistant and confirm all submitted contact, business, agreement, and account information is visible before a decision.
- Reject a provider without a reason and confirm the action is blocked; then provide a reason and confirm it is stored, audited, and sent to the provider.
- Attempt to approve a provider without the current commission agreement and confirm approval is blocked.
- Attempt to approve a service belonging to a disabled or unverified provider and confirm approval is blocked.
- Filter the service queue by status and category, inspect the full listing, then approve or decline it with the expected provider notification.
- Confirm the remittance event selector shows only completed events with an accepted coordinator.
- Select an optional booking and confirm it must belong to the event; record a partial handoff, then record the balance and confirm the same remittance reaches `remitted` without exceeding the expected amount.
- Confirm a partial remittance cannot be verified, a dispute requires a reason, and the coordinator receives the resulting notification.
- Confirm only an account with `remittance.verify` can verify or dispute a remittance and that each change appears in the audit log.

## Phase 6 smoke tests

- Create a general platform ticket from the Expo app and confirm its server-controlled status, priority, assignment, and timestamps begin safely.
- Create tickets linked to an owned event and booking; then attempt to submit unrelated UUIDs and confirm the database rejects them.
- Confirm a Client, Service Provider, and accepted Event Coordinator only see support references in which they participate.
- Sign in as Customer Service and filter the queue by active status, priority, assignment, and search text.
- Assign an unassigned ticket to an active support agent and confirm an account without `support.assign` cannot reassign it.
- Send an internal note and confirm it is visible to support staff, invisible to the ticket owner, and does not create a user reply notification.
- Send a public response and confirm the owner receives a notification and the ticket moves to `waiting_for_user`.
- Reply as the owner and confirm the assigned agent is notified and a resolved ticket reopens to `in_progress`.
- Attempt to close an unresolved ticket and confirm it is rejected; resolve it first, then close it successfully.
- Confirm Customer Service cannot browse profiles, events, bookings, or payments unrelated to a visible support ticket.

## Phase 7 smoke tests

- Sign in as an Admin and confirm the overview loads from `get_business_dashboard` without direct access errors.
- Compare total users, verified/pending providers, total bookings, and upcoming/completed/cancelled events with Supabase table counts.
- Confirm gross transaction value, commission revenue, and provider net value include only paid or verified `booking_payment` ledger rows.
- Create a booking and confirm the current-month booking count and recent-booking list update after refresh without altering the booking.
- Confirm all 12 months appear in chronological order, including months with zero activity.
- Confirm provider rankings use verified providers only and do not multiply booking counts when a provider has multiple reviews.
- Confirm category and event-type rankings reflect existing services, bookings, and events.
- Sign in as a staff account without `dashboard.analytics.view` and confirm analytics are hidden while its permitted action queues remain usable.
- Revoke `dashboard.analytics.view`, call `get_business_dashboard` directly as that account, and confirm the database returns an authorization error.
