# MULTIVENT Feature Inventory

This document consolidates the features currently implemented in the MULTIVENT mobile application, staff web operations console, Supabase database migrations, Edge Functions, and machine-learning integration.

## 1. Accounts and Access

- Mobile onboarding
- Client registration
- Service-provider registration
- Email verification using a six-digit code
- Email and password login
- Google sign-in
- Forgot-password and password-reset flow
- Change-password feature
- Role-based routing after login
- Editable account information
- Profile-photo upload
- Account approval, rejection, suspension, and reactivation states
- Provider application correction and resubmission
- Secure sign-out

### Supported Roles

- Client
- Service Provider
- Event Coordinator
- Assistant
- Customer Service
- Admin
- Superadmin

Internal staff and Event Coordinators are created or managed through the staff operations console rather than public self-registration.

## 2. Client Event Planning

- Create and save an event
- Wedding, pre-wedding, and post-wedding event types
- Event name, theme, date, time, guest count, venue, and location details
- Resume an unfinished event draft
- Planning progress and next-step tracking
- Start a new event while another draft exists
- Budget allocation by service category
- Priority-based budget distribution
- Remaining-budget tracking
- Budget-versus-selected-services comparison
- Event ledger and expense overview
- Automatic synchronization of a marketplace venue with event venue details

## 3. Service Marketplace

- Browse all available event services
- Browse services by category
- Search and filter services
- Service categories including:
  - Attire
  - Florists
  - Catering
  - Venues and Estates
  - Sound and Lights
  - Photography
  - Host/Emcee
- Detailed provider and service profiles
- Service cover photos and galleries
- Base prices and pricing units
- Pricing notes and inclusions
- Provider-created packages
- Packages composed from multiple provider-owned services
- Percentage or fixed-value package discounts
- Provider-price, platform-commission, and client-facing-total calculation
- Category-specific listing information
- Catering options for plated, buffet, and packed meals
- Venue capacities, spaces, facilities, availability, and operating details
- Real customer ratings and rating distributions
- AI-generated positive and negative feedback summaries
- Expandable verified customer comments
- Marketplace visibility limited to approved, available, and non-deleted services

## 4. Service Selection and Booking

- Select individual services or packages
- Selected-services summary
- Remove or replace selected services
- Save selections against an event
- Provide service-specific instructions
- Catering dietary, menu, and serving instructions
- Venue setup and access instructions
- Photography shot-list and style instructions
- General provider notes
- Dedicated Event Coordinator instructions
- Real provider availability checking
- Operating-hours checking
- Existing-booking conflict detection
- Conflict and no-conflict result screens
- Alternative-provider selection when conflicts occur
- Booking request generation for each selected service
- Real-time booking-status updates
- Booking confirmation
- Booking details and lifecycle tracking
- Client cancellation with a reason
- Client-requested date and time changes
- Rescheduling validation against provider availability and conflicts
- Provider and coordinator release after cancellation

## 5. Payments and Financial Handling

- Deposit and full-payment options
- Thirty-percent deposit calculated from the provider's amount
- E-wallet payment records
- Payment references and transaction details
- MULTIVENT commission displayed separately from the provider price
- Commission added above the provider-entered price
- Booking-time price and commission snapshots
- Payment-derived financial ledger
- Provider-balance tracking
- Direct-to-provider balance acknowledgements
- Automatic calculation of the remaining provider balance
- Automatic calculation of outstanding MULTIVENT commission
- Historical protection for bookings made under the older deduction model
- Client event ledger

> **Current limitation:** The payment workflow and records are implemented, but the current code uses a generated demo payment reference rather than a confirmed external payment-gateway integration.

## 6. Client Booking Management

- Upcoming and historical bookings
- Event-level booking progress
- Per-service booking status
- Provider and package details
- Payment information
- Provider messaging from a booking
- Booking, payment, message, review, and assignment notifications
- Active-event booking cancellation
- Date-and-time change requests
- Feedback submission after event completion

## 7. Messaging and Notifications

- Conversation list
- Conversation search
- Client-to-provider messaging
- Coordinator-related messaging
- Booking-aware chat context
- Message delivery states:
  - Sending
  - Sent
  - Delivered
  - Read
  - Failed
- Booking notifications
- Payment and payout notifications
- Review notifications
- Coordinator-assignment notifications
- Remittance notifications
- Notification-based navigation to related records

## 8. Reviews, Feedback, and AI Sentiment Analysis

- Required 1-to-5-star rating for every completed service
- Optional written feedback for each service
- Separate Event Coordinator rating and feedback
- One atomic feedback submission per completed event
- Real provider-rating averages
- Five-to-one-star distribution
- Verified-review display
- Provider review-performance dashboard
- Positive feedback grouped under **What clients loved**
- Negative feedback grouped under **What could improve**
- Latent Dirichlet Allocation topic inference
- Multilingual semantic embeddings
- FAISS retrieval of related labeled examples
- OpenAI-based structured positive-or-negative classification
- Filipino, Hiligaynon, English, and code-switched feedback support
- Stored sentiment score, confidence, language, topic, reason, and retrieval provenance
- Cached AI feedback summaries
- Incremental summary updates when new feedback arrives
- Retry workflow for pending, failed, or stale sentiment jobs
- Staff supervision of failed analyses
- Separation of star ratings from text-sentiment decisions

## 9. Service-Provider Workspace

- Provider dashboard
- Booking, service, and earnings summaries
- Provider application and approval lifecycle
- Commission-agreement acceptance and version tracking
- Service-listing creation
- Listing drafts
- Service image uploads
- Pricing models, units, and notes
- Category-specific service information
- Standalone and composed packages
- Service and package editing
- Listing review before submission
- Submission for staff moderation
- Revised-listing comparison with the last approved version
- Live or Not Live control for approved services
- Recoverable service and package removal
- Preservation of deleted listings referenced by historical bookings
- Separate active-services, packages, and removed-listings collections
- Availability calendar
- Provider operating hours
- Unavailable-date blocking
- Event-grouped booking requests
- Individual accept or decline actions for each service
- Decline reasons
- Provider confirmation notes
- Relevant client instructions
- Service completion on or after the event date
- Automatic event completion after all active providers finish
- Provider messages and notifications
- Review and performance monitoring
- Live earnings dashboard
- Earnings trends and transaction history
- Payout-account management
- Balance-validated payout requests
- Transaction-detail view
- Provider profile and security settings
- Customer-support access

## 10. Event Coordinator Workspace

- Automatic coordinator assignment based on:
  - Active account status
  - Availability records
  - Leave and unavailable dates
  - Schedule overlap
  - Preparation or travel buffer
  - Workload limits
  - Least-workload fairness
  - Previous declined assignment attempts
- Coordinator invitation and confirmation
- Assignment acceptance or rejection
- Automatic retry after a declined invitation
- Automatic rematching after new leave or schedule conflicts
- Manual pending-assignment queue when no coordinator is available
- Coordinator dashboard
- Active-event, attention-task, and completed-task totals
- Upcoming assigned-event summary
- Client, schedule, venue, and provider information
- Assigned-services visibility
- Client instructions
- Provider contact information
- Event-task creation
- Task notes and due dates
- Open, due-now, and all-task filters
- Task completion and reopening
- Pull-to-refresh and proper empty and error states
- Coordinator-aware notifications
- Event-level remittance notifications
- Per-service remittance breakdown
- Client-submitted coordinator reviews

## 11. Customer Support

### Client and Provider Features

- Create account, booking, payment, system, technical, or general support tickets
- Optionally link a ticket to an event or booking
- View submitted tickets and their statuses
- View the support conversation
- Reply to open tickets

### Customer Service Features

- Search the ticket queue
- Filter by status, priority, and assignment
- Assign, reassign, or unassign tickets
- View limited ticket-related user, event, booking, and payment context
- Change ticket priority
- Move tickets through open, in-progress, waiting, resolved, and closed states
- Send public replies
- Add private internal notes
- Notify users and assigned staff
- Automatically reopen resolved tickets when the user replies
- Track first-response, latest-message, resolution, and closure times

## 12. Staff Web Operations Console

- Secure staff login
- Responsive desktop and mobile administration interface
- Permission-aware navigation
- Protected pages and backend authorization
- Operational overview
- User directory
- Provider-application management
- Service-listing moderation
- Events and bookings monitoring
- Payments monitoring
- Reviews and sentiment-analysis monitoring
- Coordinator workforce management
- Customer-support queue
- Revenue reporting
- Cash-flow reporting
- Remittance management
- Staff and permissions management
- Audit-log viewer
- System settings

## 13. Provider and Service Moderation

- Full provider-application inspection
- Business, applicant, contact, agreement, and account-standing information
- Provider application approval or rejection
- Mandatory provider-rejection reasons
- Reviewer and review-time tracking
- Provider decision notifications
- Provider-application search and filtering
- Submitted service details and photos
- Service search
- Category and moderation-status filters
- Service-listing approval or rejection
- Mandatory correction reason when declining a service
- Before-and-after comparison for revised services
- Prevention of service approval when the provider is not verified or enabled
- Audited moderation decisions

## 14. Business Analytics

- Total users, providers, services, events, and bookings
- Booking-status distribution
- Event-status distribution
- Gross booking value
- Commission revenue
- Provider net amounts
- Current-month versus previous-month comparisons
- Twelve-month booking trends
- Twelve-month event trends
- Twelve-month gross-value trends
- Twelve-month commission trends
- Service-category demand
- Event-type performance
- Verified-provider performance
- Review count and average rating
- Booking and completion rates
- Recent booking activity
- Permission-scoped operational queues
- Ratios calculated from real database records rather than fabricated uptime values

## 15. Revenue, Cash Flow, and Remittances

- Configurable commission rate
- Historical commission-rate preservation
- Gross-value, commission, and provider-net reporting
- Payment-channel summaries
- Provider-contribution summaries
- Date-range filters
- Transaction classifications and statuses
- Received, released, and net-movement totals
- Completed-event selection for remittance
- One-service or all-services remittance recording
- Partial remittance handling
- Server-calculated expected remittance
- Over-remittance prevention
- Coordinator attribution
- Recorder and reviewer attribution
- Remittance verification or dispute
- Required dispute reasons
- Coordinator notifications after recording, verification, or dispute
- Automatic revenue recognition only after valid verification

## 16. Roles and Permission Management

- Database-driven role-based access control
- Default permissions by role
- Additional user roles
- Per-user permission overrides
- Inherit, explicitly allow, or explicitly deny access
- Human-readable permission bundles
- Superadmin full-access protection
- Assistant and Customer Service account creation
- Event Coordinator account creation
- Superadmin-only Admin creation
- Optional permission overrides during account creation
- User account-standing management
- Feature-level permissions for:
  - Analytics
  - Users
  - Providers
  - Services
  - Coordinators
  - Events
  - Payments
  - Revenue
  - Cash flow
  - Remittances
  - Support
  - System settings
  - Audit history

## 17. Security and Audit Controls

- Supabase Row-Level Security
- Ownership-scoped client data
- Provider access restricted to owned listings and bookings
- Coordinator access restricted to assigned events
- Customer Service access limited to ticket-related information
- Protected security-definer RPCs
- Server-side permission validation
- Secure Edge Function secrets
- No model URL or service-role key stored on the mobile device
- Append-only audit history for application roles
- Auditing of:
  - Account-status changes
  - Permission changes
  - Provider and service decisions
  - Coordinator assignments
  - Support lifecycle actions
  - Commission settings
  - Payment-ledger changes
  - Remittances
- Redaction of contact details, message bodies, payment references, and private notes from automatic audit snapshots
- Revoked direct browser writes to permissions, settings, financial records, remittances, and audit logs

## Not Implemented or Intentionally Deferred

- Guest-list management is still a placeholder.
- The proposed redesigned budget-allocation slider is intentionally deferred pending an approved UI/UX design.
- Internal staff do not have full mobile workspaces; their mobile routes direct them to the web operations console.
- Production availability depends on applying the corresponding database migrations, deploying the Edge Functions, and keeping the external sentiment service online.
- The machine-learning evaluation still needs a representative, manually labeled MULTIVENT feedback dataset before sentiment should influence rankings, penalties, or automated business decisions.

## Implementation References

- [`README.md`](../README.md)
- [`BUSINESS_REVISION_IMPLEMENTATION.md`](BUSINESS_REVISION_IMPLEMENTATION.md)
- [`EVENT_COORDINATOR_IMPLEMENTATION.md`](EVENT_COORDINATOR_IMPLEMENTATION.md)
- [`SERVICE_FEEDBACK_SENTIMENT_IMPLEMENTATION.md`](SERVICE_FEEDBACK_SENTIMENT_IMPLEMENTATION.md)
- [`ML_METHODOLOGY_IMPLEMENTATION.md`](ML_METHODOLOGY_IMPLEMENTATION.md)
- [`PHASE_9_SECURITY_REVIEW.md`](PHASE_9_SECURITY_REVIEW.md)
- [`src/App.tsx`](../src/App.tsx)
- [`database/`](../database/)
