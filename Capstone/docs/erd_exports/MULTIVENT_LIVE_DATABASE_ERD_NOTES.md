# MULTIVENT Live Database ERD Export

- Supabase project reference: `vkjmyyrxxzznbrgxzfyn`
- Schema: `public`
- Captured: 2026-10-08
- Tables: 51
- Columns: 569
- Foreign keys: 115

## Files

- `MULTIVENT_LIVE_DATABASE_ERD.drawio`
- `MULTIVENT_LIVE_DATABASE_ERD_MANUSCRIPT.pdf`
- `MULTIVENT_LIVE_DATABASE_ERD_MANUSCRIPT.docx`
- `MULTIVENT_LIVE_DATABASE_ERD_OVERVIEW.png`
- `MULTIVENT_LIVE_DATABASE_ERD_01_IDENTITY_ACCESS.png`
- `MULTIVENT_LIVE_DATABASE_ERD_02_MARKETPLACE_AVAILABILITY.png`
- `MULTIVENT_LIVE_DATABASE_ERD_03_EVENT_PLANNING_COORDINATION.png`
- `MULTIVENT_LIVE_DATABASE_ERD_04_BOOKING_FINANCE.png`
- `MULTIVENT_LIVE_DATABASE_ERD_05_COMMUNICATION_QUALITY_OPERATIONS.png`
- `MULTIVENT_LIVE_DATABASE_ERD_OVERVIEW.svg`
- `MULTIVENT_LIVE_DATABASE_ERD_01_IDENTITY_ACCESS.svg`
- `MULTIVENT_LIVE_DATABASE_ERD_02_MARKETPLACE_AVAILABILITY.svg`
- `MULTIVENT_LIVE_DATABASE_ERD_03_EVENT_PLANNING_COORDINATION.svg`
- `MULTIVENT_LIVE_DATABASE_ERD_04_BOOKING_FINANCE.svg`
- `MULTIVENT_LIVE_DATABASE_ERD_05_COMMUNICATION_QUALITY_OPERATIONS.svg`
- `MULTIVENT_LIVE_DATABASE_ERD_NOTES.md`

## Diagram conventions

- PK: primary key
- FK: foreign key
- UQ: unique column
- ?: nullable column
- 1: exactly one parent
- 0..1: optional parent or optional unique child
- 0..*: zero or many child rows
- All connectors use orthogonal, 90-degree routing.

## Domain inventory

### Identity and Access

8 tables and 10 internal foreign-key relationships.

- `profiles`: 9 columns; 0 FK columns
- `roles`: 4 columns; 0 FK columns
- `permissions`: 4 columns; 0 FK columns
- `role_permissions`: 3 columns; 2 FK columns
- `user_roles`: 4 columns; 3 FK columns
- `user_permissions`: 6 columns; 3 FK columns
- `provider_profiles`: 16 columns; 2 FK columns
- `provider_profile_merge_archive`: 5 columns; 0 FK columns

### Marketplace and Availability

10 tables and 5 internal foreign-key relationships.

- `service_categories`: 6 columns; 0 FK columns
- `services`: 23 columns; 3 FK columns
- `service_packages`: 18 columns; 2 FK columns
- `service_package_items`: 8 columns; 2 FK columns
- `provider_availability`: 9 columns; 2 FK columns
- `provider_operating_hours`: 9 columns; 1 FK columns
- `provider_notification_preferences`: 6 columns; 2 FK columns
- `provider_service_listing_drafts`: 5 columns; 1 FK columns
- `coordinator_service_profiles`: 8 columns; 1 FK columns
- `coordinator_availability`: 9 columns; 2 FK columns

### Event Planning and Coordination

14 tables and 17 internal foreign-key relationships.

- `events`: 30 columns; 3 FK columns
- `event_requirements`: 10 columns; 2 FK columns
- `event_budget_items`: 16 columns; 3 FK columns
- `event_service_selections`: 35 columns; 6 FK columns
- `event_provider_instructions`: 14 columns; 4 FK columns
- `event_coordinator_instructions`: 9 columns; 2 FK columns
- `event_schedule_checks`: 10 columns; 2 FK columns
- `event_schedule_check_results`: 14 columns; 4 FK columns
- `coordination_tasks`: 9 columns; 2 FK columns
- `coordinator_assignment_attempts`: 11 columns; 3 FK columns
- `coordinator_packages`: 8 columns; 1 FK columns
- `coordinator_package_items`: 5 columns; 2 FK columns
- `event_coordinator_package_selections`: 9 columns; 3 FK columns
- `event_coordinator_package_services`: 4 columns; 2 FK columns

### Booking and Finance

7 tables and 5 internal foreign-key relationships.

- `bookings`: 31 columns; 5 FK columns
- `payments`: 25 columns; 4 FK columns
- `financial_transactions`: 23 columns; 5 FK columns
- `cash_remittances`: 16 columns; 5 FK columns
- `provider_payment_receipts`: 11 columns; 4 FK columns
- `provider_payout_accounts`: 10 columns; 1 FK columns
- `provider_payout_requests`: 10 columns; 1 FK columns

### Communication, Feedback, and Operations

12 tables and 3 internal foreign-key relationships.

- `conversations`: 6 columns; 2 FK columns
- `conversation_participants`: 3 columns; 2 FK columns
- `messages`: 6 columns; 2 FK columns
- `notifications`: 8 columns; 1 FK columns
- `reviews`: 16 columns; 4 FK columns
- `coordinator_reviews`: 8 columns; 3 FK columns
- `event_feedback`: 12 columns; 2 FK columns
- `service_review_summaries`: 8 columns; 1 FK columns
- `support_tickets`: 17 columns; 4 FK columns
- `support_messages`: 6 columns; 2 FK columns
- `audit_logs`: 11 columns; 1 FK columns
- `system_settings`: 6 columns; 1 FK columns

## Important live-schema note

`service_categories` had RLS disabled when this export was captured. The ERD records the deployed state and does not change database security.
