# Event Coordinator Signup

## What changed

The service-provider signup screen now supports two account paths:

- **Service Provider** — keeps the existing business fields, requires a service category, and continues to the merchant approval flow.
- **Event Coordinator** — removes the service-category field, creates an `event_coordinator` account, and opens the coordinator workspace after email verification.

The role switch appears at the top of the existing merchant signup form. Labels, helper text, validation messages, terms text, and the submit button update for the selected role.

The switch uses a coordinated transition: the selected-tab indicator slides between roles, changing copy and fields briefly fade and move, and the form layout smoothly resizes when the service-category field is removed or restored. Role buttons are temporarily disabled during the transition to prevent overlapping animations or inconsistent form state.

## Account data

Both paths continue to use Supabase Auth. The selected account type is sent as the Auth metadata field `default_role`.

For a service provider:

- `default_role` is `service_provider`.
- `service_category` is required.
- A `provider_profiles` record is created.
- The account retains the existing pending-approval behavior.

For an event coordinator:

- `default_role` is `event_coordinator`.
- No service category or provider profile is created.
- The profile is active after signup/email verification.
- Login and completed signup route to `23-Coordinator.tsx` through the existing `coordinatorHome` route.

## Existing database requirement

Apply `database/10_auth_profile_signup_repair.sql` before testing signup. Its Auth trigger recognizes `event_coordinator`, creates the matching `profiles` and `user_roles` records, and only creates `provider_profiles` for service providers.

Apply `database/19_event_coordinator_workspace.sql` to enable the coordinator dashboard functions and policies.

No new SQL migration was required for this UI change because both role and workspace support already exist in those migrations.

## Test procedure

1. Open the role-selection screen and choose the service-provider path.
2. On the signup screen, leave **Service Provider** selected.
3. Confirm the service-category field is visible and required.
4. Switch to **Event Coordinator**.
5. Confirm the category field disappears and the coordinator labels are displayed.
6. Create the coordinator account and complete email verification if required.
7. Confirm the app opens the coordinator workspace rather than merchant pending approval.
8. Sign out and sign in again with the coordinator account.
9. Confirm the account is routed back to the coordinator workspace.
10. Repeat signup with **Service Provider** and confirm its original category and pending-approval flow still work.

## Validation completed

- TypeScript typecheck
- ESLint
- Git whitespace validation
- Expo web production export
