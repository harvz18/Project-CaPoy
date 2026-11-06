# MULTIVENT Feature Verification Report

**Purpose:** Technical verification notes for the accompanying User Manual.  
**Repository reviewed:** Capstone mobile application, web dashboard, Supabase migrations/functions, project configuration, and relevant supporting documentation.  
**Review date:** 6 November 2026  
**Scope note:** This report identifies implemented source-backed functionality. It is not a production acceptance test or a claim that every feature has been exercised against every deployed environment.

## 1. Platform and access model

| Role | Primary interface | Verified access boundary |
|---|---|---|
| Super Admin | Next.js web dashboard | Governance routes: Users, Financial overview, Staff & permissions, Audit log, and System settings. Role bypasses individual permission checks but route set remains intentionally limited. |
| Admin | Next.js web dashboard | Operational routes: overview, Clients, Providers, Categories, Bookings, Financial overview, Reports, Revenue, Cash flow, Reviews, and embedded insights; controls are permission-scoped. |
| Client | Expo React Native application / deployed web build | Client home, planning, marketplace, events, payment sheet, inbox, reviews, profile, and support. |
| Coordinator | Expo React Native application / deployed web build | Role-scoped invitation/event workspace, tasks, church arrangements, remittance/detail views, profile/service profile, and messages for authorized events. |
| Service Provider | Expo React Native application / deployed web build | Pending approval, provider home, listing/availability, grouped booking requests, performance, earnings/payouts, notifications, and provider profile functions. |

## 2. Role-based feature inventory

| Role | Verified feature | Screen/page | Source evidence | Status |
|---|---|---|---|---|
| Super Admin | User account review/status controls | Web dashboard Users | web/components/dashboard-shell.tsx; web/components/screens/operations-screen.tsx | Implemented |
| Super Admin | Staff creation and permission management | Staff & permissions | web/components/dashboard-shell.tsx; supabase/functions/admin-create-user/index.ts; permission migrations | Implemented, permission-scoped |
| Super Admin | Financial review and authorized external refund/payout recording | Financial overview | web/components/screens/financial-reporting-screen.tsx; supabase/migrations/20261025000400_v14_admin_financial_operations.sql | Implemented, permission-gated |
| Super Admin | Audit-log review | Audit log | web/components/screens/audit-log-screen.tsx | Implemented |
| Super Admin | Controlled settings | System settings | web/components/screens/operations-screen.tsx; dashboard navigation | Implemented, permission-gated |
| Admin | Operational dashboard/analytics | Dashboard | web/components/screens/overview-screen.tsx; web/components/dashboard-shell.tsx | Implemented |
| Admin | Provider review/moderation | Providers | web/components/screens/providers-screen.tsx; web/components/screens/operations-screen.tsx | Implemented, permission-gated |
| Admin | Service/listing review | Service applications | web/components/screens/services-screen.tsx; provider service migrations | Implemented, permission-gated |
| Admin | Category performance | Categories | web/components/screens/category-performance-screen.tsx | Implemented |
| Admin | Event/booking directory | Bookings | web/components/screens/operations-management-screens.tsx | Implemented |
| Admin | Reports with category filter/search/export | Reports | web/components/screens/financial-reporting-screen.tsx; supabase/migrations/20261106000100_admin_report_category_filter.sql | Implemented |
| Admin | Revenue, cash flow, review monitoring | Revenue/Cash flow/Ratings & reviews | web/components/screens/business-operations-screen.tsx; web/components/screens/reviews-management-screen.tsx | Implemented, permission-gated |
| Client | Email/password sign-up and verification | Role selection / Client sign-up / Verification | src/screens/02-RoleSelection.tsx; src/screens/02.1-ClientSignup.tsx; src/screens/02.3-Verification.tsx; src/lib/auth.ts | Implemented |
| Client | Sign-in, Google sign-in, password reset | Sign-in / Forgot Password / New Password | src/screens/01.1-Login.tsx; src/screens/01.1.1-ForgotPassword.tsx; src/screens/01.1.2-NewPassword.tsx; src/lib/auth.ts | Implemented |
| Client | Event creation, date/time, secured venue map pin | Create Event | src/screens/04-EventCreation.tsx; src/components/MapTilerVenueMap.tsx; src/components/MapTilerVenueMap.native.tsx | Implemented; map requires deployed key/configuration |
| Client | Budget allocation | Budget | src/screens/05-BudgetAllocation.tsx; src/lib/planning-budget.ts | Implemented |
| Client | Coordinator selection | Coordinator Details | src/screens/06.1-CoordinatorDetails.tsx; src/lib/coordinator.ts | Implemented |
| Client | Catalogue, sort/filter/favourites/reviewed services | Choose Services | src/screens/06-CategoryBrowse.tsx; src/lib/catalog.ts; src/lib/favorites.ts; src/lib/reviewed-services.ts | Implemented |
| Client | Service configuration/snapshot | Service Details | src/screens/08-ServiceDetails.tsx; src/components/CategorySpecificServiceDetails.tsx; src/lib/service-category-details.ts | Implemented, category-dependent |
| Client | Save plan/review/submit requests | Review Services / Payment | src/screens/07-SelectedSummary.tsx; src/screens/12-Payment.tsx; src/lib/planning.ts | Implemented |
| Client | Booking details, provider replacement, event messaging | Event Details | src/screens/11.1-BookingDetails.tsx; src/lib/planning.ts; src/lib/messaging.ts | Implemented |
| Client | PayMongo checkout and status reconciliation | Payment sheet | src/screens/12-Payment.tsx; src/lib/planning.ts; PayMongo V16 edge functions/migrations | Implemented; processor environment-dependent |
| Client | Cancellation/rescheduling and feedback | Event Details / Event Feedback | src/lib/merchant.ts; src/screens/15.1-EventFeedback.tsx; booking lifecycle migrations | Implemented where state permits |
| Coordinator | Invitation/event workspace | Coordinator | src/screens/23-Coordinator.tsx; src/lib/coordinator.ts; database/19_event_coordinator_workspace.sql | Implemented |
| Coordinator | Event tasks/statuses | Coordinator Event Details | src/screens/23-Coordinator.tsx; src/lib/coordinator.ts | Implemented |
| Coordinator | Church arrangements | Coordinator Event Details | src/screens/23-Coordinator.tsx; church/coordinator migrations | Implemented for applicable events |
| Coordinator | Remittance/profile/packages | Coordinator Remittance/Service Profile/Packages | src/screens/23.1-CoordinatorRemittanceDetails.tsx; src/screens/23.2-CoordinatorServiceProfile.tsx; src/screens/23.3-CoordinatorPackages.tsx | Implemented, role-scoped |
| Service Provider | Provider registration and pending approval | Provider sign-up / Pending Approval | src/screens/02.2-MerchantSignup.tsx; src/screens/02.2.1-PendingApproval.tsx; src/lib/auth.ts | Implemented |
| Service Provider | Business/home/profile/operating hours | Provider Home/Profile/Operating Hours | src/screens/16-MerchantHome.tsx; src/screens/22-MerchantProfile.tsx; src/screens/22.1-OperatingHours.tsx | Implemented |
| Service Provider | Service listing, price, packages, review | Provider Services/listing steps | src/screens/17-ProviderServices.tsx; src/screens/17-Step1ServiceListing.tsx; src/screens/17.1-Step2Pricing.tsx; src/screens/17.1.1-Step2AddPackage.tsx; src/screens/17.2-Step3ReviewListings.tsx | Implemented |
| Service Provider | Availability and booking decisions | Availability / Booking Requests | src/screens/18-AvailabilityCalendar.tsx; src/screens/19-BookingRequest.tsx; src/screens/19.1-BookingRequest.tsx; src/lib/merchant.ts | Implemented |
| Service Provider | Catering food tasting/menu finalization | Booking Request Detail | src/lib/merchant.ts; V15 migrations and tests | Implemented for qualifying catering bookings |
| Service Provider | Florist configuration | Provider listing editors | src/components/Florist*.tsx; src/lib/florist.ts | Implemented for florist category |
| Service Provider | Photo/video packages/deliverables | Provider listing/event workflow | src/components/PhotoVideo*.tsx; src/lib/photo-video*.ts | Implemented for photography/videography category |
| Service Provider | Reviews, earnings, payout requests, transactions, notifications | Provider Reviews/Payouts/Notifications | src/screens/21-ReviewPerformance.tsx; src/screens/22.2-PayoutEarnings.tsx; src/screens/22.3-TransactionDetails.tsx; src/screens/22.5-Notification.tsx | Implemented, financial state-dependent |

## 3. Verified navigation and permission distinctions

### Super Admin vs Admin

- canAccessWorkspaceRoute explicitly permits Super Admin routes only for users, financial, permissions, audit, and settings.
- The Admin route set covers operational dashboard content, providers, categories, bookings, financial overview, reports, revenue, cash flow, reviews, and insights.
- Super Admin governance navigation includes Staff & permissions, Audit log, and System settings. These are not ordinary Admin routes.
- Admin controls are additionally guarded by individual permissions; the dashboard shell provides a legacy Admin fallback permission set only for compatibility with pre-permission-migration records.

### Client booking and payment

- Client request submission is separate from payment.
- All required provider decisions, and a coordinator decision when a coordinator is required, are checked before payment eligibility.
- PayMongo checkout creation/reconciliation is server-owned. Webhook processing remains the authoritative verification path, with return/poll reconciliation used to update the client experience.
- The client sees marketplace totals and required payment amounts, not an exposed internal platform markup calculation.

### Coordinator and Provider boundaries

- Coordinator data is retrieved through role-scoped dashboard functions. The Coordinator is associated with client-selected events rather than granted unrestricted client/provider access.
- Provider listings, availability, booking decisions, service options, and photos are provider-owned.
- Publication/discoverability depends on active/approved/live conditions; the client catalogue does not treat a draft or unavailable listing as bookable.

## 4. Source-backed conditions and excluded claims

| Item | Finding |
|---|---|
| Public Super Admin registration | Excluded. No public Super Admin registration workflow was identified. |
| Public Admin registration | Excluded. Staff creation is an authorized administrative function. |
| Public Coordinator registration | Excluded. Current public provider sign-up requires a service category and creates a Service Provider profile. Coordinator access is provisioned/assigned. |
| Internal stored-value wallet | Excluded. Financial implementation keeps refunds/payouts as external disbursement obligations rather than an in-app cash wallet. A client refund-destination demonstration view does not constitute stored value. |
| Automatic provider payout | Excluded. Provider amounts remain protected/held and the payout process uses recorded, authorized external steps. |
| Guaranteed map place name | Excluded. Venue lookup can return an exact registered place or a street/address fallback. Map availability requires valid provider configuration and network access. |
| Client-visible sentiment verdict controlling bookings | Excluded. Reviews are processed through a bounded sentiment-analysis workflow; source code does not make a sentiment label a client booking decision. |
| Universal food tasting | Excluded. It is a catering-only, provider-configured, booking-state-dependent feature. |
| Generic Photo/Video configurator | Excluded. Current V18 implementation uses provider-defined preset packages, inclusions, and add-ons rather than the removed generic configuration workflow. |
| Live payment processing in every deployment | Requires environment verification. The code supports PayMongo test/live configuration, signed webhook verification, and server reconciliation; actual live processing depends on deployed secrets, payment methods, and business onboarding. |

## 5. Screenshot inventory

No authenticated runtime screenshots were captured during this documentation pass. The review did not launch live user sessions or create/modify database records.

| Manual figure | Required capture | Status |
|---|---|---|
| A.1 | Role selection | Placeholder only |
| A.2 | Super Admin governance workspace | Placeholder only |
| A.3 | Staff & permissions | Placeholder only |
| A.4 | Admin dashboard | Placeholder only |
| A.5 | Admin bookings/reports | Placeholder only |
| A.6 | Client home | Placeholder only |
| A.7 | Create Event with venue map | Placeholder only |
| A.8 | Coordinator Details | Placeholder only |
| A.9 | Explore Services | Placeholder only |
| A.10 | Review Selected Services | Placeholder only |
| A.11 | Client payment sheet | Placeholder only |
| A.12 | Coordinator home | Placeholder only |
| A.13 | Provider sign-up/pending approval | Placeholder only |
| A.14 | Provider service listing | Placeholder only |
| A.15 | Provider booking request details | Placeholder only |
| A.16 | Provider performance/earnings | Placeholder only |

## 6. Manual verification still required before final submission

1. Capture every listed screenshot using non-sensitive test data from the deployed build.
2. Confirm the currently deployed web dashboard exposes the expected route set for both a Super Admin and an Admin account.
3. Confirm the MapTiler/hosted map key is present in the environment used for capture.
4. Confirm PayMongo environment mode and enabled payment methods before documenting a live payment demonstration.
5. Confirm policy wording, exact cancellation/refund eligibility, and payment-disbursement procedure with the approved current business policy before presenting it as a legal/operational commitment.
6. Replace placeholders without exposing passwords, one-time codes, client names, payment references, account numbers, tokens, or private addresses.
