# MULTIVENT Manuscript ERD Completeness and Accuracy Report

Generated: 2026-10-08

## Summary

- Public database tables: **51**
- Public-to-public foreign keys: **115**
- External Auth foreign key: **1** (`profiles.id -> auth.users.id`)
- Total actual foreign-key constraints retained by the Complete Technical ERD: **116**
- Manuscript figures: **29**
- Public tables represented in at least one manuscript figure: **51 of 51**
- Manuscript pages intentionally show selective attributes; they do not contain every database column.
- No database table, column, constraint, policy, function, or application file was changed by this documentation export.

## Repeated reference entities

`profiles` (20 figures), `events` (16 figures), `services` (9 figures), `provider_profiles` (8 figures), `bookings` (5 figures), `event_service_selections` (4 figures), `coordinator_packages` (3 figures), `payments` (3 figures), `service_categories` (3 figures), `event_coordinator_package_selections` (2 figures), `event_schedule_check_results` (2 figures)

## Figure inventory and omissions

### Figure 01: User and Access Management

- Entities (7): `auth.users`, `profiles`, `user_roles`, `user_permissions`, `roles`, `role_permissions`, `permissions`
- Relationships displayed: **9**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `role_permissions.permission_id -> permissions.id` — connector label suppressed; mapping retained here
  - `role_permissions.role_id -> roles.id`
  - `user_permissions.assigned_by -> profiles.id`
  - `user_permissions.permission_id -> permissions.id`
  - `user_permissions.user_id -> profiles.id`
  - `user_roles.assigned_by -> profiles.id`
  - `user_roles.role_id -> roles.id`
  - `user_roles.user_id -> profiles.id`
  - `profiles.id -> auth.users.id`

- Non-key attributes omitted from this focused view:

  - `auth.users`: None
  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `user_roles`: `created_at`
  - `user_permissions`: `created_at`, `updated_at`
  - `roles`: `created_at`
  - `role_permissions`: `created_at`
  - `permissions`: `created_at`

- Relationships omitted from this focused figure:

  - None

### Figure 02: Provider Profiles and Onboarding

- Entities (4): `profiles`, `provider_profiles`, `provider_service_listing_drafts`, `provider_notification_preferences`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `provider_notification_preferences.provider_id -> provider_profiles.id`
  - `provider_notification_preferences.user_id -> profiles.id`
  - `provider_profiles.reviewed_by -> profiles.id`
  - `provider_profiles.user_id -> profiles.id`
  - `provider_service_listing_drafts.provider_id -> provider_profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `provider_profiles`: `description`, `contact_email`, `contact_phone`, `created_at`, `updated_at`, `terms_accepted`, `terms_version`, `terms_accepted_at`, `rejection_reason`, `reviewed_at`
  - `provider_service_listing_drafts`: `payload`, `updated_at`, `created_at`
  - `provider_notification_preferences`: `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 03: Service Catalog Management

- Entities (4): `profiles`, `provider_profiles`, `service_categories`, `services`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `provider_profiles.reviewed_by -> profiles.id`
  - `provider_profiles.user_id -> profiles.id`
  - `services.category_id -> service_categories.id` — connector label suppressed; mapping retained here
  - `services.moderated_by -> profiles.id`
  - `services.provider_id -> provider_profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `provider_profiles`: `description`, `contact_email`, `contact_phone`, `created_at`, `updated_at`, `terms_accepted`, `terms_version`, `terms_accepted_at`, `rejection_reason`, `reviewed_at`
  - `service_categories`: `created_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 04: Provider Availability and Operating Hours

- Entities (4): `provider_profiles`, `services`, `provider_availability`, `provider_operating_hours`
- Relationships displayed: **4**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `provider_availability.provider_id -> provider_profiles.id`
  - `provider_availability.service_id -> services.id`
  - `provider_operating_hours.provider_id -> provider_profiles.id`
  - `services.provider_id -> provider_profiles.id`

- Non-key attributes omitted from this focused view:

  - `provider_profiles`: `description`, `contact_email`, `contact_phone`, `created_at`, `updated_at`, `terms_accepted`, `terms_version`, `terms_accepted_at`, `rejection_reason`, `reviewed_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`
  - `provider_availability`: `notes`, `created_at`
  - `provider_operating_hours`: `timezone`, `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `provider_profiles.reviewed_by -> profiles.id`
  - `provider_profiles.user_id -> profiles.id`
  - `services.category_id -> service_categories.id`
  - `services.moderated_by -> profiles.id`

### Figure 05: Service Packages

- Entities (4): `profiles`, `service_packages`, `services`, `service_package_items`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `service_package_items.package_id -> service_packages.id`
  - `service_package_items.service_id -> services.id`
  - `service_packages.deleted_by -> profiles.id`
  - `service_packages.service_id -> services.id`
  - `services.moderated_by -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `service_packages`: `is_active`, `created_at`, `updated_at`, `pricing_unit`, `pricing_mode`, `subtotal`, `discount_type`, `discount_value`, `discount_amount`, `is_deleted`, `deleted_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`
  - `service_package_items`: `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `services.category_id -> service_categories.id`
  - `services.provider_id -> provider_profiles.id`
  - `profiles.id -> auth.users.id`

### Figure 06: Event Planning and Requirements

- Entities (4): `profiles`, `events`, `event_requirements`, `service_categories`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `event_requirements.category_id -> service_categories.id`
  - `event_requirements.event_id -> events.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id` — connector label suppressed; mapping retained here

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `event_requirements`: `status`, `created_at`, `updated_at`
  - `service_categories`: `created_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 07: Budget Allocation and Coordination Tasks

- Entities (4): `profiles`, `events`, `event_budget_items`, `coordination_tasks`
- Relationships displayed: **6**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `coordination_tasks.assigned_to -> profiles.id`
  - `coordination_tasks.event_id -> events.id`
  - `event_budget_items.event_id -> events.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `events.pending_coordinator_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `event_budget_items`: `created_at`, `updated_at`, `priority_rank`, `is_priority`, `category_key`, `allocated_amount`, `allocation_version`, `is_selection_locked`
  - `coordination_tasks`: `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `event_budget_items.category_id -> service_categories.id`
  - `event_budget_items.locked_selection_id -> event_service_selections.id`
  - `profiles.id -> auth.users.id`

### Figure 08: Event Service Selection

- Entities (4): `events`, `event_service_selections`, `services`, `service_categories`
- Relationships displayed: **4**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `event_service_selections.category_id -> service_categories.id`
  - `event_service_selections.event_id -> events.id`
  - `event_service_selections.service_id -> services.id`
  - `services.category_id -> service_categories.id`

- Non-key attributes omitted from this focused view:

  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `event_service_selections`: `category_name`, `notes`, `created_at`, `updated_at`, `attendee_count`, `budget_per_head`, `meal_type`, `outside_food`, `dietary_notes`, `favorite`, `requested_start_at`, `requested_end_at`, `availability_status`, `selected_provider_snapshot`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `category_key`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`
  - `service_categories`: `created_at`

- Relationships omitted from this focused figure:

  - `event_service_selections.client_id -> profiles.id`
  - `event_service_selections.package_id -> service_packages.id`
  - `event_service_selections.provider_id -> provider_profiles.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id`
  - `services.moderated_by -> profiles.id`
  - `services.provider_id -> provider_profiles.id`

### Figure 09: Service Booking

- Entities (4): `profiles`, `events`, `bookings`, `services`
- Relationships displayed: **7**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `bookings.client_id -> profiles.id`
  - `bookings.event_id -> events.id`
  - `bookings.service_id -> services.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `events.pending_coordinator_id -> profiles.id`
  - `services.moderated_by -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `bookings`: `requested_time`, `client_notes`, `provider_notes`, `created_at`, `updated_at`, `provider_amount`, `commission_rate`, `commission_amount`, `commission_model`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `financial_terms_version`, `initial_payment_rate`, `provider_initial_rate`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`

- Relationships omitted from this focused figure:

  - `bookings.package_id -> service_packages.id`
  - `bookings.provider_id -> provider_profiles.id`
  - `services.category_id -> service_categories.id`
  - `services.provider_id -> provider_profiles.id`
  - `profiles.id -> auth.users.id`

### Figure 10: Coordinator Profiles and Availability

- Entities (4): `profiles`, `coordinator_service_profiles`, `coordinator_availability`, `events`
- Relationships displayed: **6**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `coordinator_availability.coordinator_id -> profiles.id`
  - `coordinator_availability.created_by -> profiles.id`
  - `coordinator_service_profiles.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `events.pending_coordinator_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `coordinator_service_profiles`: `is_accepting_bookings`, `created_at`, `updated_at`
  - `coordinator_availability`: `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 11: Coordinator Assignment

- Entities (3): `profiles`, `events`, `coordinator_assignment_attempts`
- Relationships displayed: **6**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `coordinator_assignment_attempts.assigned_by -> profiles.id` — connector label suppressed; mapping retained here
  - `coordinator_assignment_attempts.coordinator_id -> profiles.id`
  - `coordinator_assignment_attempts.event_id -> events.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `coordinator_assignment_attempts`: `requested_at`, `responded_at`, `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 12: Coordinator Event Instructions

- Entities (3): `profiles`, `events`, `event_coordinator_instructions`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `event_coordinator_instructions.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `event_coordinator_instructions.event_id -> events.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `events.pending_coordinator_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `event_coordinator_instructions`: `body`, `tags`, `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 13: Coordinator Packages

- Entities (4): `profiles`, `coordinator_packages`, `coordinator_package_items`, `services`
- Relationships displayed: **4**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `coordinator_package_items.package_id -> coordinator_packages.id`
  - `coordinator_package_items.service_id -> services.id`
  - `coordinator_packages.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `services.moderated_by -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `coordinator_packages`: `created_at`, `updated_at`
  - `coordinator_package_items`: `created_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`

- Relationships omitted from this focused figure:

  - `services.category_id -> service_categories.id`
  - `services.provider_id -> provider_profiles.id`
  - `profiles.id -> auth.users.id`

### Figure 14: Coordinator Package Selection

- Entities (4): `profiles`, `events`, `coordinator_packages`, `event_coordinator_package_selections`
- Relationships displayed: **7**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `coordinator_packages.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `event_coordinator_package_selections.coordinator_id -> profiles.id`
  - `event_coordinator_package_selections.event_id -> events.id`
  - `event_coordinator_package_selections.package_id -> coordinator_packages.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id` — connector label suppressed; mapping retained here

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `coordinator_packages`: `created_at`, `updated_at`
  - `event_coordinator_package_selections`: `package_snapshot`, `updated_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 15: Coordinator Package Service Selections

- Entities (4): `coordinator_packages`, `event_coordinator_package_selections`, `event_coordinator_package_services`, `event_service_selections`
- Relationships displayed: **3**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `event_coordinator_package_selections.package_id -> coordinator_packages.id`
  - `event_coordinator_package_services.event_selection_id -> event_service_selections.id` — connector label suppressed; mapping retained here
  - `event_coordinator_package_services.package_selection_id -> event_coordinator_package_selections.id` — connector label suppressed; mapping retained here

- Non-key attributes omitted from this focused view:

  - `coordinator_packages`: `created_at`, `updated_at`
  - `event_coordinator_package_selections`: `package_snapshot`, `updated_at`
  - `event_coordinator_package_services`: `created_at`
  - `event_service_selections`: `category_name`, `notes`, `created_at`, `updated_at`, `attendee_count`, `budget_per_head`, `meal_type`, `outside_food`, `dietary_notes`, `favorite`, `requested_start_at`, `requested_end_at`, `availability_status`, `selected_provider_snapshot`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `category_key`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`

- Relationships omitted from this focused figure:

  - `coordinator_packages.coordinator_id -> profiles.id`
  - `event_coordinator_package_selections.coordinator_id -> profiles.id`
  - `event_coordinator_package_selections.event_id -> events.id`
  - `event_service_selections.category_id -> service_categories.id`
  - `event_service_selections.client_id -> profiles.id`
  - `event_service_selections.event_id -> events.id`
  - `event_service_selections.package_id -> service_packages.id`
  - `event_service_selections.provider_id -> provider_profiles.id`
  - `event_service_selections.service_id -> services.id`

### Figure 16: Client Payments

- Entities (4): `profiles`, `events`, `bookings`, `payments`
- Relationships displayed: **9**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `bookings.client_id -> profiles.id`
  - `bookings.event_id -> events.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `events.pending_coordinator_id -> profiles.id`
  - `payments.booking_id -> bookings.id`
  - `payments.coordinator_id -> profiles.id`
  - `payments.event_id -> events.id`
  - `payments.payer_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `bookings`: `requested_time`, `client_notes`, `provider_notes`, `created_at`, `updated_at`, `provider_amount`, `commission_rate`, `commission_amount`, `commission_model`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `financial_terms_version`, `initial_payment_rate`, `provider_initial_rate`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`
  - `payments`: `provider`, `provider_reference`, `paid_at`, `verified_at`, `created_at`, `updated_at`, `checkout_url`, `metadata`, `service_subtotal`, `client_total`, `platform_fee_rate`, `platform_fee_amount`, `initial_payment_rate`, `provider_initial_rate`, `provider_initial_allocation`, `held_unallocated_amount`

- Relationships omitted from this focused figure:

  - `bookings.package_id -> service_packages.id`
  - `bookings.provider_id -> provider_profiles.id`
  - `bookings.service_id -> services.id`
  - `profiles.id -> auth.users.id`

### Figure 17: Payment Transactions and Provider Earnings

- Entities (4): `payments`, `bookings`, `financial_transactions`, `provider_profiles`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `bookings.provider_id -> provider_profiles.id`
  - `financial_transactions.booking_id -> bookings.id`
  - `financial_transactions.payment_id -> payments.id`
  - `financial_transactions.provider_id -> provider_profiles.id`
  - `payments.booking_id -> bookings.id`

- Non-key attributes omitted from this focused view:

  - `payments`: `provider`, `provider_reference`, `paid_at`, `verified_at`, `created_at`, `updated_at`, `checkout_url`, `metadata`, `service_subtotal`, `client_total`, `platform_fee_rate`, `platform_fee_amount`, `initial_payment_rate`, `provider_initial_rate`, `provider_initial_allocation`, `held_unallocated_amount`
  - `bookings`: `requested_time`, `client_notes`, `provider_notes`, `created_at`, `updated_at`, `provider_amount`, `commission_rate`, `commission_amount`, `commission_model`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `financial_terms_version`, `initial_payment_rate`, `provider_initial_rate`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`
  - `financial_transactions`: `payment_method`, `commission_rate`, `commission_amount`, `amount_received`, `amount_released`, `transaction_at`, `metadata`, `created_at`, `updated_at`, `held_provider_amount`, `held_unallocated_amount`, `provider_funds_status`, `provider_credited_at`
  - `provider_profiles`: `description`, `contact_email`, `contact_phone`, `created_at`, `updated_at`, `terms_accepted`, `terms_version`, `terms_accepted_at`, `rejection_reason`, `reviewed_at`

- Relationships omitted from this focused figure:

  - `bookings.client_id -> profiles.id`
  - `bookings.event_id -> events.id`
  - `bookings.package_id -> service_packages.id`
  - `bookings.service_id -> services.id`
  - `financial_transactions.coordinator_id -> profiles.id`
  - `financial_transactions.event_id -> events.id`
  - `payments.coordinator_id -> profiles.id`
  - `payments.event_id -> events.id`
  - `payments.payer_id -> profiles.id`
  - `provider_profiles.reviewed_by -> profiles.id`
  - `provider_profiles.user_id -> profiles.id`

### Figure 18: Cash Remittance and Payment Verification

- Entities (4): `events`, `bookings`, `payments`, `cash_remittances`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `bookings.event_id -> events.id`
  - `cash_remittances.booking_id -> bookings.id`
  - `cash_remittances.event_id -> events.id`
  - `payments.booking_id -> bookings.id`
  - `payments.event_id -> events.id`

- Non-key attributes omitted from this focused view:

  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `bookings`: `requested_time`, `client_notes`, `provider_notes`, `created_at`, `updated_at`, `provider_amount`, `commission_rate`, `commission_amount`, `commission_model`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `financial_terms_version`, `initial_payment_rate`, `provider_initial_rate`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`
  - `payments`: `provider`, `provider_reference`, `paid_at`, `verified_at`, `created_at`, `updated_at`, `checkout_url`, `metadata`, `service_subtotal`, `client_total`, `platform_fee_rate`, `platform_fee_amount`, `initial_payment_rate`, `provider_initial_rate`, `provider_initial_allocation`, `held_unallocated_amount`
  - `cash_remittances`: `received_at`, `reference_number`, `notes`, `created_at`, `updated_at`, `verified_at`, `dispute_reason`

- Relationships omitted from this focused figure:

  - `bookings.client_id -> profiles.id`
  - `bookings.package_id -> service_packages.id`
  - `bookings.provider_id -> provider_profiles.id`
  - `bookings.service_id -> services.id`
  - `cash_remittances.coordinator_id -> profiles.id`
  - `cash_remittances.received_by -> profiles.id`
  - `cash_remittances.verified_by -> profiles.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id`
  - `payments.coordinator_id -> profiles.id`
  - `payments.payer_id -> profiles.id`

### Figure 19: Provider Payout Accounts and Requests

- Entities (4): `profiles`, `provider_profiles`, `provider_payout_accounts`, `provider_payout_requests`
- Relationships displayed: **4**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `provider_payout_accounts.provider_id -> provider_profiles.id`
  - `provider_payout_requests.provider_id -> provider_profiles.id`
  - `provider_profiles.reviewed_by -> profiles.id`
  - `provider_profiles.user_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `provider_profiles`: `description`, `contact_email`, `contact_phone`, `created_at`, `updated_at`, `terms_accepted`, `terms_version`, `terms_accepted_at`, `rejection_reason`, `reviewed_at`
  - `provider_payout_accounts`: `account_name`, `account_number`, `confirmed_at`, `created_at`, `updated_at`
  - `provider_payout_requests`: `currency`, `requested_at`, `processed_at`, `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 20: Provider Payment Receipts

- Entities (4): `events`, `bookings`, `provider_profiles`, `provider_payment_receipts`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `bookings.event_id -> events.id`
  - `bookings.provider_id -> provider_profiles.id`
  - `provider_payment_receipts.booking_id -> bookings.id`
  - `provider_payment_receipts.event_id -> events.id`
  - `provider_payment_receipts.provider_id -> provider_profiles.id`

- Non-key attributes omitted from this focused view:

  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `bookings`: `requested_time`, `client_notes`, `provider_notes`, `created_at`, `updated_at`, `provider_amount`, `commission_rate`, `commission_amount`, `commission_model`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `financial_terms_version`, `initial_payment_rate`, `provider_initial_rate`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`
  - `provider_profiles`: `description`, `contact_email`, `contact_phone`, `created_at`, `updated_at`, `terms_accepted`, `terms_version`, `terms_accepted_at`, `rejection_reason`, `reviewed_at`
  - `provider_payment_receipts`: `notes`, `received_at`, `created_at`

- Relationships omitted from this focused figure:

  - `bookings.client_id -> profiles.id`
  - `bookings.package_id -> service_packages.id`
  - `bookings.service_id -> services.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id`
  - `provider_payment_receipts.recorded_by -> profiles.id`
  - `provider_profiles.reviewed_by -> profiles.id`
  - `provider_profiles.user_id -> profiles.id`

### Figure 21: Service Reviews and Sentiment Summaries

- Entities (4): `provider_profiles`, `services`, `reviews`, `service_review_summaries`
- Relationships displayed: **4**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `reviews.provider_id -> provider_profiles.id`
  - `reviews.service_id -> services.id`
  - `service_review_summaries.service_id -> services.id`
  - `services.provider_id -> provider_profiles.id`

- Non-key attributes omitted from this focused view:

  - `provider_profiles`: `description`, `contact_email`, `contact_phone`, `created_at`, `updated_at`, `terms_accepted`, `terms_version`, `terms_accepted_at`, `rejection_reason`, `reviewed_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`
  - `reviews`: `tags`, `created_at`, `updated_at`, `topic_assignments`, `analysis_metadata`, `analyzed_at`
  - `service_review_summaries`: `source_latest_analyzed_at`, `generated_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `provider_profiles.reviewed_by -> profiles.id`
  - `provider_profiles.user_id -> profiles.id`
  - `reviews.booking_id -> bookings.id`
  - `reviews.reviewer_id -> profiles.id`
  - `services.category_id -> service_categories.id`
  - `services.moderated_by -> profiles.id`

### Figure 22: Event Feedback

- Entities (3): `profiles`, `events`, `event_feedback`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `event_feedback.client_id -> profiles.id`
  - `event_feedback.event_id -> events.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `events.pending_coordinator_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `event_feedback`: `topic_assignments`, `analysis_metadata`, `analyzed_at`, `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 23: Coordinator Reviews

- Entities (3): `profiles`, `events`, `coordinator_reviews`
- Relationships displayed: **6**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `coordinator_reviews.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `coordinator_reviews.event_id -> events.id`
  - `coordinator_reviews.reviewer_id -> profiles.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `coordinator_reviews`: `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

### Figure 24: Event Messaging

- Entities (5): `profiles`, `conversation_participants`, `messages`, `events`, `conversations`
- Relationships displayed: **8**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `conversation_participants.conversation_id -> conversations.id`
  - `conversation_participants.user_id -> profiles.id`
  - `conversations.event_id -> events.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id`
  - `messages.conversation_id -> conversations.id`
  - `messages.sender_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `conversation_participants`: `created_at`
  - `messages`: `created_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `conversations`: `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `conversations.booking_id -> bookings.id`
  - `profiles.id -> auth.users.id`

### Figure 25: Notifications and Support

- Entities (4): `profiles`, `notifications`, `support_tickets`, `support_messages`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `notifications.user_id -> profiles.id`
  - `support_messages.sender_id -> profiles.id`
  - `support_messages.ticket_id -> support_tickets.id`
  - `support_tickets.assigned_to -> profiles.id`
  - `support_tickets.user_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `notifications`: `resource_type`, `resource_id`, `created_at`
  - `support_tickets`: `description`, `resolved_at`, `created_at`, `updated_at`, `first_responded_at`, `last_message_at`, `closed_at`
  - `support_messages`: `created_at`

- Relationships omitted from this focused figure:

  - `support_tickets.booking_id -> bookings.id`
  - `support_tickets.event_id -> events.id`
  - `profiles.id -> auth.users.id`

### Figure 26: Event Schedule Checks

- Entities (4): `profiles`, `events`, `event_schedule_checks`, `event_schedule_check_results`
- Relationships displayed: **6**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `event_schedule_check_results.schedule_check_id -> event_schedule_checks.id` — connector label suppressed; mapping retained here
  - `event_schedule_checks.client_id -> profiles.id`
  - `event_schedule_checks.event_id -> events.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id` — connector label suppressed; mapping retained here
  - `events.pending_coordinator_id -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `event_schedule_checks`: `checked_at`, `created_at`, `updated_at`
  - `event_schedule_check_results`: `conflict_reason`, `resolution`, `resolved_at`, `created_at`, `updated_at`

- Relationships omitted from this focused figure:

  - `event_schedule_check_results.provider_id -> provider_profiles.id`
  - `event_schedule_check_results.selection_id -> event_service_selections.id`
  - `event_schedule_check_results.service_id -> services.id`
  - `profiles.id -> auth.users.id`

### Figure 27: Schedule Check Resources

- Entities (4): `event_schedule_check_results`, `event_service_selections`, `provider_profiles`, `services`
- Relationships displayed: **6**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `event_schedule_check_results.provider_id -> provider_profiles.id`
  - `event_schedule_check_results.selection_id -> event_service_selections.id`
  - `event_schedule_check_results.service_id -> services.id`
  - `event_service_selections.provider_id -> provider_profiles.id`
  - `event_service_selections.service_id -> services.id`
  - `services.provider_id -> provider_profiles.id`

- Non-key attributes omitted from this focused view:

  - `event_schedule_check_results`: `conflict_reason`, `resolution`, `resolved_at`, `created_at`, `updated_at`
  - `event_service_selections`: `category_name`, `notes`, `created_at`, `updated_at`, `attendee_count`, `budget_per_head`, `meal_type`, `outside_food`, `dietary_notes`, `favorite`, `requested_start_at`, `requested_end_at`, `availability_status`, `selected_provider_snapshot`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `category_key`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`
  - `provider_profiles`: `description`, `contact_email`, `contact_phone`, `created_at`, `updated_at`, `terms_accepted`, `terms_version`, `terms_accepted_at`, `rejection_reason`, `reviewed_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`

- Relationships omitted from this focused figure:

  - `event_schedule_check_results.schedule_check_id -> event_schedule_checks.id`
  - `event_service_selections.category_id -> service_categories.id`
  - `event_service_selections.client_id -> profiles.id`
  - `event_service_selections.event_id -> events.id`
  - `event_service_selections.package_id -> service_packages.id`
  - `provider_profiles.reviewed_by -> profiles.id`
  - `provider_profiles.user_id -> profiles.id`
  - `services.category_id -> service_categories.id`
  - `services.moderated_by -> profiles.id`

### Figure 28: Event Provider Instructions

- Entities (4): `events`, `event_service_selections`, `event_provider_instructions`, `services`
- Relationships displayed: **5**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `event_provider_instructions.event_id -> events.id`
  - `event_provider_instructions.selection_id -> event_service_selections.id` — connector label suppressed; mapping retained here
  - `event_provider_instructions.service_id -> services.id`
  - `event_service_selections.event_id -> events.id`
  - `event_service_selections.service_id -> services.id`

- Non-key attributes omitted from this focused view:

  - `events`: `venue`, `location`, `guest_count`, `status`, `notes`, `created_at`, `updated_at`, `event_time`, `timezone`, `preferred_start_at`, `preferred_end_at`, `venue_status`, `coordinator_assignment_status`, `coordinator_assignment_requested_at`, `coordinator_assignment_responded_at`, `coordinator_assignment_attempted_at`, `coordinator_assignment_source`, `coordinator_assignment_note`, `coordinator_preference`, `coordinator_fee_amount`, `coordinator_fee_currency`, `coordinator_pricing_snapshot`
  - `event_service_selections`: `category_name`, `notes`, `created_at`, `updated_at`, `attendee_count`, `budget_per_head`, `meal_type`, `outside_food`, `dietary_notes`, `favorite`, `requested_start_at`, `requested_end_at`, `availability_status`, `selected_provider_snapshot`, `catering_option_id`, `catering_option_name`, `catering_option_snapshot`, `category_key`, `venue_option_id`, `venue_option_name`, `venue_option_snapshot`, `venue_booked_hours`, `venue_setup_start_at`, `venue_start_at`, `venue_end_at`
  - `event_provider_instructions`: `category_name`, `body`, `tags`, `is_required`, `created_at`, `updated_at`
  - `services`: `description`, `location`, `cover_image_url`, `created_at`, `updated_at`, `gallery_urls`, `pricing_unit`, `pricing_details`, `moderation_note`, `moderated_at`, `submission_kind`, `last_approved_snapshot`, `is_available`, `catering_service_types`, `category_details`

- Relationships omitted from this focused figure:

  - `event_provider_instructions.provider_id -> provider_profiles.id`
  - `event_service_selections.category_id -> service_categories.id`
  - `event_service_selections.client_id -> profiles.id`
  - `event_service_selections.package_id -> service_packages.id`
  - `event_service_selections.provider_id -> provider_profiles.id`
  - `events.client_id -> profiles.id`
  - `events.coordinator_id -> profiles.id`
  - `events.pending_coordinator_id -> profiles.id`
  - `services.category_id -> service_categories.id`
  - `services.moderated_by -> profiles.id`
  - `services.provider_id -> provider_profiles.id`

### Figure 29: Administration and Audit

- Entities (4): `profiles`, `provider_profile_merge_archive`, `audit_logs`, `system_settings`
- Relationships displayed: **2**
- Displayed foreign-key mappings (a label is intentionally suppressed when no collision-free label box exists):

  - `audit_logs.actor_id -> profiles.id`
  - `system_settings.updated_by -> profiles.id`

- Non-key attributes omitted from this focused view:

  - `profiles`: `phone`, `avatar_url`, `created_at`, `updated_at`
  - `provider_profile_merge_archive`: `profile_data`, `archived_at`
  - `audit_logs`: `previous_state`, `new_state`, `result`, `metadata`, `created_at`
  - `system_settings`: `updated_at`

- Relationships omitted from this focused figure:

  - `profiles.id -> auth.users.id`

## Complete Technical ERD confirmation

`Multivent_Complete_ERD.drawio` and `Multivent_Complete_ERD.xml` retain all 51 public tables, all 569 public-table columns, and all 116 actual foreign-key relationships. The selective omissions listed above apply only to the manuscript-focused figures.
