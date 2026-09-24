# MULTIVENT Mobile Application

MULTIVENT is an Expo and React Native application for planning events and managing vendors.

## Requirements

- Node.js 20.19 or newer
- npm
- Expo Go on a physical device, or an Android/iOS simulator

## Setup

```bash
npm install
npm start
```

After Expo starts, scan the QR code with Expo Go. You can also launch a platform directly:

```bash
npm run android
npm run ios
npm run web
```

## Checks

```bash
npm run typecheck
npm run lint
```

## Supabase database

Run the SQL files in `database/` in numeric order. For an existing project that already has
the tables, apply `06_booking_system_security.sql` to enable the booking, messaging,
notification, payment, review, availability, and row-level-security rules used by the app.
Apply `07_service_listing_details.sql` so pricing models, pricing units, pricing notes, package
units, and all uploaded service photos remain available on the client service-detail screen.
For existing databases that used the `02_event_planning_flow_no_rls.sql` setup, also apply
`08_client_booking_rls_repair.sql`. It safely restores the authenticated client policies needed
to create events, add service selections, and create provider booking requests.
Apply `09_booking_lifecycle.sql` to keep selections and event progress synchronized with provider
decisions and to enable live booking-status updates through Supabase Realtime.
Apply `10_auth_profile_signup_repair.sql` to restore automatic Auth-to-profile creation and
backfill any client or service-provider Auth users whose application profiles are missing.
Apply `11_booking_rls_recursion_repair.sql` to replace the circular event/booking policies with
safe ownership helpers before accepting client payments.
Apply `12_provider_instruction_visibility.sql` so a booked service provider can securely read
the client's instructions for that provider's event and service.
Apply `13_real_schedule_check.sql` so schedule results use the selected providers' availability,
operating window, and active booking dates without exposing other clients' booking data. It also
changes the default payment provider label to E-Wallet for new payment records.
Apply `14_event_completion_feedback.sql` so providers can securely mark services finished on or
after the event date, the event completes after every active provider finishes, and clients receive
completion notifications.
Apply `15_sentiment_analysis_integrity.sql`, `16_service_feedback_sentiment.sql`, and
`18_ai_feedback_summary_cache.sql`; deploy the `analyze-review` and `summarize-reviews` Supabase Edge
Functions; and configure the external Python analysis service.
Clients then rate every completed service and can optionally submit a separately analyzed comment
for each service. See
[`docs/sentiment-integration.md`](docs/sentiment-integration.md) for the data flow, secrets,
deployment steps, score semantics, retry behavior, and model limitations.
Apply `17_release_completed_booking_dates.sql` so completed bookings remain in history without
blocking the provider from accepting another event on that same calendar date.
Apply `19_event_coordinator_workspace.sql` to enable the role-scoped coordinator dashboard, assigned
event summaries, and secure task creation/status updates. See
[`docs/EVENT_COORDINATOR_IMPLEMENTATION.md`](docs/EVENT_COORDINATOR_IMPLEMENTATION.md) for account
assignment and app testing steps.
Apply `20_admin_web_access.sql`, `21_service_moderation_workflow.sql`, and
`22_platform_audit_and_provider_service_crud.sql` to enable the staff web console, moderated service
publishing, expanded audit history, and provider-safe service deletion. Then apply
`23_service_revision_comparison.sql` so updated services preserve their last approved version for
the admin/superadmin before-and-after review. Apply `24_provider_service_availability.sql` to give
providers a separately confirmed Live / Not live control without changing moderation status.
Apply `25_client_coordinator_assignment.sql` so clients can browse active coordinators under Event
Organizer, assign or replace one on their event, and share that event's selected and booked services
with the coordinator workspace.
Apply `26_catering_service_types.sql` so catering providers can declare whether they offer plated,
buffet, and/or packed meals and clients can only select the configured booking options.
Apply `27_client_booking_changes.sql` so clients can cancel active event bookings or request a new
date and time after provider availability and schedule conflicts are checked.
The provider signup form also supports direct event-coordinator registration without requesting a
service category. See
[`docs/EVENT_COORDINATOR_SIGNUP.md`](docs/EVENT_COORDINATOR_SIGNUP.md) for role behavior and testing.
Provider booking requests are grouped by event while preserving individual service actions, notes,
instructions, and statuses. See
[`docs/MERCHANT_EVENT_BOOKING_GROUPING.md`](docs/MERCHANT_EVENT_BOOKING_GROUPING.md) for the mapping
rules and test procedure.

The client catalog displays the mock examples alongside every active Supabase service. Each
example is linked at runtime to an active Supabase test service so event selections create real
booking requests. Set `USE_LIVE_CLIENT_CATALOG` in `src/lib/catalog.ts` to `true` when the
marketplace should display only providers' published service content.

## Project structure

```text
index.ts                 Expo entry point
app.json                 Expo application configuration
src/App.tsx              Root application component
src/components/          Reusable React Native components
src/screens/             Application screens
src/theme/               Design tokens and typography
```

Expo uses Metro as its bundler, so the project does not need an HTML entry point or global CSS files.
