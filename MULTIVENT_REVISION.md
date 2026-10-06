# MULTIVENT — Revised System Requirements

## Capstone Revision / Adviser Consultation

This document describes the revised requirements for the **MULTIVENT** system following consultation with the capstone adviser.

These requirements should be treated as updates to the existing MULTIVENT architecture and features.

Do **not** remove existing features or roles unless this document explicitly changes them.

---

# 1. Revised MULTIVENT Business Model

MULTIVENT is no longer considered only a mobile/web-based event booking platform.

MULTIVENT will now operate as a **business with a physical office** alongside its digital platforms.

The physical office will support:

- Administrative operations
- Service provider management
- Event coordinator management
- Customer support
- Cash payment/remittance handling
- Future HR-related operations
- Future business expansion and system enhancements

Because MULTIVENT now operates as an actual organization, additional internal staff roles must be supported by the system.

---

# 2. Revised User Roles

The system should support the following roles:

- Superadmin
- Admin
- Assistant
- Customer Service
- Event Coordinator
- Service Provider
- Client

Existing roles/features that are not specifically modified in this document should retain their current behavior.

---

# 3. Role-Based Access Control

## 3.1 Superadmin

The **Superadmin** is the highest technical/system-level administrator.

The Superadmin should control what system features each role can access.

### Role Permission Management

Create a permission-management interface where the Superadmin can configure feature access for each role.

Example:

```text
Role: Assistant

[✓] Provider Applications
[✓] Service Applications
[✓] Cash Remittance
[✓] View Users
[ ] Business Analytics
[ ] Revenue
[ ] System Configuration
```

Permissions should preferably be stored dynamically rather than being completely hardcoded into the frontend.

Possible structure:

```text
roles
permissions
role_permissions
users
user_permissions (optional)
```

The system should be able to determine whether a user can access a feature based on their assigned role and permissions.

Frontend navigation and protected pages should respect these permissions.

Backend/API/database authorization must also enforce the permissions. Hiding a page or button in the frontend alone is not sufficient security.

---

## 3.2 Manual User Creation

The Superadmin should be able to manually create internal MULTIVENT user accounts.

When creating a user, the Superadmin should be able to assign:

- Name
- Email
- Contact information if required
- Role
- Account status
- Feature permissions/access

The Superadmin may optionally override or customize the default permissions of a particular user if the architecture supports user-specific permissions.

---

## 3.3 Event Coordinator Account Creation

Event Coordinators are now **employees/personnel under MULTIVENT**.

They are no longer treated as independent users who can freely register themselves as coordinators.

Coordinator accounts can only be created by authorized MULTIVENT personnel.

Initial rule:

- Superadmin can create Event Coordinator accounts.
- Assistant may also be allowed to create Event Coordinator accounts if granted the corresponding permission by the Superadmin.

There should be **no public Event Coordinator registration**.

---

# 4. Admin

The **Admin** represents the business owner/management side of MULTIVENT.

The Admin primarily monitors the overall performance of the business.

The Admin should NOT directly manage or modify users.

The Admin has **view-only access** to user information unless another permission is explicitly granted in the future.

---

# 5. Admin Dashboard

The Admin Dashboard should become a business intelligence/management dashboard.

It should provide an overview of how MULTIVENT is performing.

## Dashboard Metrics

Possible dashboard metrics include:

- Total users
- Total clients
- Total service providers
- Total bookings
- Completed events
- Upcoming events
- Cancelled bookings/events
- Total transaction value
- MULTIVENT revenue
- Commission revenue
- Cash flow
- Top-rated service providers
- Most-booked service categories
- Booking trends

Use data visualizations where appropriate.

Examples:

- Revenue over time — Line chart
- Monthly bookings — Bar chart
- Revenue by month — Bar/Line chart
- Booking status distribution — Pie/Donut chart
- Service category popularity — Bar chart
- Provider performance — Table/Ranking visualization

Do not overcrowd the dashboard. The dashboard should show summarized information, while detailed information can be accessed through dedicated pages.

---

# 6. Admin User Viewing

The Admin should be able to view registered users.

However:

> Admin access to users is VIEW ONLY.

The Admin should not:

- Create users
- Delete users
- Modify user roles
- Modify permissions
- Approve/reject users

The user viewing interface should have filtering and tab-based navigation.

Example:

```text
All Users
Clients
Service Providers
Event Coordinators
Internal Staff
```

For Service Providers, provide category-based filters.

Example:

```text
All Providers
Catering
Venue
Photography
Videography
Entertainment
Decoration
etc.
```

Additional filters may include:

- Active
- Inactive
- Pending
- Approved
- Rejected
- Category
- Rating

Only show filters that are relevant to the selected user type.

---

# 7. Revenue

Revenue management should now be part of the Admin side.

Add a dedicated navigation item:

```text
Revenue
```

The Admin should be able to view MULTIVENT's revenue.

The initial revenue model is **commission-based**.

---

# 8. Commission-Based Revenue Model

MULTIVENT will initially receive a:

> **10% commission**

from Service Provider transactions/bookings.

The percentage should preferably be configurable in the system rather than permanently hardcoded as `10%`, because the commission percentage may change in the future.

Example configuration:

```text
commission_rate = 0.10
```

Example:

```text
Service Price: ₱10,000

MULTIVENT Commission (10%): ₱1,000

Provider Net Amount: ₱9,000
```

The system should maintain transaction records that clearly distinguish:

```text
Gross Amount
Commission Amount
Provider Net Amount
Payment Method
Payment Status
Transaction Date
Booking/Event Reference
Service Provider
```

---

# 9. Provider Commission Agreement

Service Providers must be informed that MULTIVENT charges a commission.

The commission policy should be included in the Service Provider Terms and Conditions.

Before becoming an approved MULTIVENT Service Provider, the provider must agree to these terms.

The system should record acceptance when appropriate.

Possible information to store:

```text
terms_accepted
terms_version
terms_accepted_at
```

This allows MULTIVENT to determine which version of the provider agreement was accepted.

---

# 10. Cash Flow

Add a new **Cash Flow** feature for the Admin.

Cash Flow is different from Revenue.

Revenue represents income earned by MULTIVENT, such as commission.

Cash Flow should provide visibility into money entering and leaving MULTIVENT's transaction process.

Possible classifications:

```text
Cash Inflow
Cash Outflow
Commission Revenue
Provider Payable
Provider Remittance
Refund
Adjustment
```

The Admin should be able to view:

- Date
- Transaction reference
- Event/booking
- Provider
- Payment method
- Gross amount
- Commission
- Amount payable to provider
- Amount received
- Amount released/remitted
- Status

Provide date filters such as:

```text
Today
This Week
This Month
Custom Date Range
```

---

# 11. Assistant — New Internal Role

Add a new role:

> **Assistant**

The Assistant represents MULTIVENT office staff.

The Assistant handles operational and approval-related tasks.

Initial responsibilities include:

- Review Service Provider applications
- Approve/reject Service Provider applications
- Review services submitted by providers
- Approve/reject provider services
- Handle confirmations
- Handle cash payments/remittances
- Assist with operational management
- View relevant users/providers
- Use filters to efficiently manage applications and records

More Assistant responsibilities may be added later.

The permission system must therefore be flexible enough to support additional Assistant capabilities without requiring major architectural changes.

---

# 12. Assistant Application Management

The Assistant should have dedicated management screens for provider-related approvals.

Possible tabs:

```text
Pending
Approved
Rejected
Needs Review
```

Possible filters:

```text
Provider Category
Application Date
Status
Service Category
```

The Assistant should be able to open an application and inspect its submitted information before approving or rejecting it.

If rejected, the system should support storing a rejection reason.

---

# 13. Cash Payment / Remittance Handling

The Assistant will handle physical/cash-related payment confirmation involving Event Coordinators.

After an event is completed, an Event Coordinator may remit collected/required cash to the MULTIVENT office depending on the transaction.

The Assistant should be able to record the remittance.

Possible information:

```text
Event
Booking
Coordinator
Amount Expected
Amount Received
Date Received
Received By
Payment/Remittance Status
Reference Number
Notes
```

Suggested statuses:

```text
Pending
Partially Remitted
Remitted
Verified
Disputed
```

All financial actions should maintain an audit trail.

---

# 14. Customer Service — New Internal Role

Add a new role:

> **Customer Service**

Customer Service represents MULTIVENT office/online support staff.

Their responsibility is to handle complaints and concerns specifically related to the MULTIVENT system/platform.

Examples:

- Booking problems
- Account problems
- Payment status issues
- System errors
- Incorrect system information
- Platform-related transaction concerns

Customer Service should NOT be primarily responsible for disputes involving the actual quality or execution of a provider's service/event unless the issue directly concerns MULTIVENT's system/process.

---

# 15. Customer Support / Complaint System

Implement or extend a ticket/complaint system.

Possible ticket information:

```text
Ticket ID
User
Booking/Event Reference
Category
Subject
Description
Status
Priority
Assigned Staff
Created At
Updated At
Resolved At
```

Possible statuses:

```text
Open
In Progress
Waiting for User
Resolved
Closed
```

Possible categories:

```text
Account
Booking
Payment
System
Technical
Other Platform Concern
```

Customer Service personnel should only access information required to resolve the concern.

---

# 16. Event Coordinator — Revised Role

Event Coordinators are now hired and managed directly by MULTIVENT.

They are internal operational personnel rather than independent event coordinators.

Their accounts should be created internally.

Event Coordinators retain their existing event-related functionality.

They should be able to:

- View assigned events
- View booked services
- View event instructions
- View client instructions
- View service provider information relevant to the event
- Contact/message assigned Service Providers
- Contact/message the Client when necessary
- View event schedule
- Update relevant coordination/event statuses

---

# 17. Automatic Event Coordinator Assignment

Event Coordinators should be automatically assigned by the system when a Client creates/confirms an event booking requiring coordination.

The Client does NOT manually select a coordinator.

The system should determine coordinator availability.

At minimum, the assignment process should check:

1. Coordinator account is active.
2. Coordinator is available on the event date/time.
3. Coordinator does not have a conflicting event schedule.
4. Coordinator has not been marked unavailable/leave.
5. Coordinator has not reached any future workload limit configured by MULTIVENT.

Among available coordinators, use a fair assignment strategy.

Recommended initial strategy:

> **Least workload + availability**

Example:

```text
Available Coordinators:

Coordinator A = 4 upcoming events
Coordinator B = 2 upcoming events
Coordinator C = 5 upcoming events

Assign Coordinator B
```

If multiple coordinators have the same workload, use the coordinator who has gone the longest without receiving a new assignment.

This prevents one coordinator from receiving significantly more assignments than others.

---

# 18. Schedule Conflict Checker

The system must automatically prevent scheduling conflicts.

Before assigning a coordinator, check existing coordinator assignments.

Conceptually:

```text
new_event_start < existing_event_end
AND
new_event_end > existing_event_start
```

If this condition is true, the schedules overlap and the coordinator must not be assigned.

Consider adding configurable preparation/travel buffer time in future versions.

Example:

```text
Event A:
1:00 PM – 5:00 PM

Event B:
5:00 PM – 8:00 PM
```

Even though the events technically do not overlap, MULTIVENT may eventually require a buffer between assignments.

Design the scheduling logic so this can be added later.

---

# 19. Proposed Handling When No Coordinator Is Available

This requirement was not finalized during the consultation.

Recommended implementation:

If no Event Coordinator is available for the selected event schedule, **do not silently assign an unavailable coordinator**.

Instead:

1. Keep the booking/event valid.
2. Set coordinator assignment status to:

```text
Pending Coordinator Assignment
```

3. Notify the Assistant/Superadmin.
4. Add the event to an **Unassigned Events** queue.
5. Allow authorized staff to manually assign a coordinator later.
6. Automatically retry assignment if coordinator availability changes.

The Client should see something similar to:

```text
Coordinator:
Assignment Pending

MULTIVENT is currently assigning an available event coordinator to your event.
```

The client should NOT see internal staffing problems such as:

```text
No employees available.
```

Once a coordinator becomes available and is assigned, notify:

- Client
- Event Coordinator
- Relevant MULTIVENT staff

This approach prevents booking failure simply because coordinator assignment cannot immediately be completed.

### Future Enhancement

MULTIVENT may later implement:

- Coordinator capacity forecasting
- Additional coordinator hiring recommendations
- Waitlist prioritization
- Emergency/manual coordinator reassignment
- Coordinator leave management

For now, use the **Pending Coordinator Assignment + manual/automatic reassignment queue** approach unless the project team decides otherwise.

---

# 20. Client Visibility of Coordinator

Once an Event Coordinator is assigned, the Client should be able to view their assigned coordinator.

Possible information:

```text
Coordinator Name
Profile Photo
Contact/Message Button
Assignment Status
```

The Client should be able to directly message/contact their coordinator through the supported MULTIVENT communication system.

The coordinator should only receive access to information related to events assigned to them.

---

# 21. Coordinator Availability Management

Because coordinators are MULTIVENT personnel, maintain coordinator availability information.

Possible structure:

```text
Coordinator
Date
Availability Status
Reason
Start Time
End Time
```

Possible statuses:

```text
Available
Assigned
Unavailable
On Leave
```

Coordinator assignment should use both:

- Existing event assignments
- Availability records

---

# 22. Audit Logging

Because MULTIVENT now includes multiple internal employees with different administrative permissions, important administrative actions should be logged.

Examples:

```text
Superadmin created user
Superadmin changed role
Superadmin changed permission
Assistant approved provider
Assistant rejected provider
Assistant approved service
Assistant recorded cash remittance
Coordinator assignment changed
Customer Service resolved ticket
Commission configuration changed
```

Possible audit log structure:

```text
actor_user_id
action
target_type
target_id
old_value
new_value
timestamp
```

This is especially important for:

- Permissions
- Provider approvals
- Financial transactions
- Coordinator assignments

---

# 23. Recommended Permission Architecture

Avoid writing frontend logic such as:

```javascript
if (user.role === "assistant") {
   // show feature
}
```

for every feature.

Prefer reusable permission checks such as:

```javascript
can("providers.review")
can("services.approve")
can("remittance.create")
can("analytics.view")
can("revenue.view")
can("users.view")
can("users.create")
can("coordinators.create")
```

Possible permissions:

```text
dashboard.analytics.view

users.view
users.create
users.update
users.permissions.manage

providers.view
providers.review
providers.approve
providers.reject

services.view
services.review
services.approve
services.reject

coordinators.view
coordinators.create
coordinators.assign
coordinators.reassign

events.view
events.manage

revenue.view
cashflow.view

remittance.view
remittance.create
remittance.verify

support.view
support.respond
support.resolve

system.settings
system.audit_logs
```

Superadmin should be able to assign these permissions to roles through checkboxes.

---

# 24. Recommended Role Defaults

Default permissions can initially follow this structure.

## Superadmin

Full technical/system access.

Includes:

- Role management
- Permission management
- User creation
- Coordinator creation
- System configuration
- Audit logs
- Administrative override

## Admin

Business monitoring.

Includes:

- Business analytics
- Revenue
- Cash flow
- User viewing
- Provider viewing
- Event/business performance

User management should remain view-only.

## Assistant

Operational management.

Includes:

- Provider application management
- Service approval
- Confirmations
- Coordinator management if authorized
- Cash/remittance handling
- Operational records

## Customer Service

Platform support.

Includes:

- Support tickets
- Complaint management
- Relevant booking/user information
- Ticket responses
- Resolution management

## Event Coordinator

Assigned event operations.

Includes:

- Assigned events
- Event instructions
- Booked services
- Provider communication
- Client communication
- Event coordination

## Service Provider

Retain existing provider functionality unless modified elsewhere.

## Client

Retain existing client functionality unless modified elsewhere.

---

# 25. UI/UX Budget Revision — DO NOT IMPLEMENT YET

The following requirement was discussed but should **NOT be implemented yet**.

Wait for the UI/UX frontend design before modifying this section.

### Planned Change

While the Client is selecting services, the overall event budget should remain adjustable.

Each service category should also have its own budget allocation slider.

Example:

```text
Overall Event Budget
₱100,000
[----------------●------]

Catering
Allocated Budget: ₱30,000
[---------●-------------]

Venue
Allocated Budget: ₱40,000
[-------------●---------]

Photography
Allocated Budget: ₱15,000
[------●----------------]
```

The category allocation should interact with the Client's overall event budget.

### IMPORTANT

Do not modify the current UI/UX implementation for this feature yet.

Wait until the new frontend/UI design is provided.

---

# 26. Existing Features

Unless directly affected by the revisions above, existing MULTIVENT features should remain functional.

This includes existing functionality for:

- Clients
- Service Providers
- Event bookings
- Service selection
- Instructions
- Reviews and ratings
- Payments
- Recommendations
- Analytics
- Sentiment analysis
- Existing authentication
- Existing database functionality

Do not unnecessarily rewrite working modules.

Prefer extending the existing architecture.

---

# 27. Database Migration Requirement

Before modifying the database, inspect the existing Supabase/PostgreSQL schema.

Do NOT blindly create duplicate tables.

Determine which existing tables can be extended and which genuinely require new tables.

Potential additions may include:

```text
roles
permissions
role_permissions
user_permissions

coordinator_availability
coordinator_assignments

support_tickets
support_messages

commission_settings
financial_transactions
cash_remittances

audit_logs
```

These names are suggestions only.

Adapt them to the existing MULTIVENT database naming conventions and architecture.

---

# 28. Supabase / RLS Requirements

MULTIVENT uses Supabase.

Any new tables containing sensitive or role-specific information should have appropriate Row Level Security policies.

Do not rely solely on frontend authorization.

Examples:

- Admin can read analytics/revenue data but cannot modify users.
- Assistant can access operational approval records.
- Customer Service can access support-related information.
- Coordinator can access only events assigned to them.
- Service Provider can access only their relevant provider/service records.
- Client can access only their relevant bookings/events.
- Superadmin receives system-level administrative access where appropriate.

Review existing RLS policies before making changes.

---

# 29. Implementation Strategy

Do not attempt to rewrite the entire application at once.

Implement these revisions incrementally.

Recommended order:

```text
Phase 1
Role/Permission Architecture

Phase 2
New Internal Roles
- Assistant
- Customer Service
- Revised Event Coordinator

Phase 3
Superadmin Permission Management
- Role permissions
- Manual account creation

Phase 4
Coordinator Scheduling
- Availability
- Conflict checking
- Automatic assignment
- Pending assignment queue

Phase 5
Assistant Operational Features
- Provider applications
- Service approvals
- Remittance

Phase 6
Customer Service
- Ticket/complaint management

Phase 7
Admin Dashboard
- Analytics
- Provider statistics
- Business metrics

Phase 8
Revenue / Commission / Cash Flow

Phase 9
Audit Logging and Security Review

Phase 10
UI/UX Budget Allocation Revision
- WAIT FOR UPDATED UI/UX DESIGN BEFORE IMPLEMENTING
```

---

# 30. Important Instructions Before Coding

Before implementing anything:

1. Inspect the existing MULTIVENT codebase.
2. Inspect the current database schema.
3. Identify existing roles and authentication logic.
4. Identify existing admin/superadmin functionality.
5. Identify existing Event Coordinator implementation.
6. Identify existing payment and transaction tables.
7. Identify existing provider approval logic.
8. Identify existing Supabase RLS policies.
9. Determine what can be reused.
10. Produce an implementation plan before making large architectural changes.

Do not remove existing working functionality unless necessary.

Do not rename existing tables, APIs, routes, or components unnecessarily.

Prefer backward-compatible migrations.

---

# 31. Main Architectural Goal

The revised MULTIVENT should evolve from:

> A multi-event booking application

into:

> A centralized event booking and management platform operated by MULTIVENT as a business organization, with internal administrative staff, employed event coordinators, provider management, customer support, business analytics, commission-based revenue tracking, and office-based operational processes.

The architecture should therefore be designed with future expansion in mind, especially:

- Additional employee roles
- Additional permissions
- HR-related functionality
- Additional financial features
- Coordinator workforce management
- More advanced analytics
- Additional business branches/offices
- Future operational modules

Avoid hardcoding the application around only the roles and features that exist today.