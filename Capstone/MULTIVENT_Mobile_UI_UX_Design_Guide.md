# MULTIVENT Mobile Application — UI/UX Design Guide

> A practical Figma and UI/UX guide derived from the MULTIVENT project document. It preserves the document's stated roles, modules, workflows, and existing visual direction while organizing them into a mobile-app design system and screen plan.

## 1. Design Objective

MULTIVENT is a mobile-based event planning platform that centralizes:

- Event planning
- Merchant/service discovery
- Service comparison
- Booking
- Budget management
- Payment
- Messaging
- Notifications
- Reviews and ratings
- Recommendations
- Service-quality insights

The UI should make event planning feel **organized, guided, premium, and manageable** rather than presenting unrelated features.

The core UX journey is:

```text
Plan → Discover → Compare → Select → Book → Pay → Coordinate → Review
```

---

## 2. Primary Users

### Client

The client:

- Creates and manages events
- Defines event requirements
- Sets budget and schedule
- Browses merchants/services
- Reviews service information
- Requests bookings
- Monitors booking status
- Makes payments
- Communicates with merchants
- Submits reviews
- Uses recommendation and decision-support features

The client UI should be consumer-friendly and planning-oriented.

### Merchant

The merchant/service provider:

- Manages profile
- Creates services
- Publishes packages
- Sets prices
- Manages availability
- Receives booking requests
- Approves/rejects requests
- Communicates with clients
- Monitors reviews and service performance

The merchant UI should prioritize operational efficiency.

### Administrator

The administrator:

- Manages users
- Manages merchants
- Monitors services
- Monitors bookings
- Monitors payments
- Monitors reviews
- Views analytics
- Oversees platform activity

The administrator UI should prioritize monitoring, information density, and control.

The project document explicitly separates these three roles and their system access. fileciteturn2file0L97-L101

---

# 3. Application Information Architecture

## Client

```text
Home
├── Current Event
├── Create Event
├── Budget Planner
├── Find Merchants
├── My Bookings
└── Recent Events

Explore
├── Categories
├── Search
├── Filters
├── Merchant Results
└── Service Results

My Events
├── Event List
├── Event Details
├── Budget
├── Requirements
└── Selected Services

Bookings
├── Pending
├── Confirmed
├── Completed
├── Cancelled
└── Booking Details

Messages
├── Conversations
└── Chat

Profile
├── Personal Information
├── Preferences
├── Notifications
├── Security
├── Policies
└── Logout
```

The architecture follows the document's major functional modules: user management, event planning, booking management, recommendations, communication, sentiment analysis, and analytics/reporting. fileciteturn2file2L183-L195

---

# 4. Client Bottom Navigation

Recommended:

```text
┌────────┬─────────┬────────┬──────────┬─────────┐
│  Home  │ Explore │ Events │ Bookings │ Profile │
└────────┴─────────┴────────┴──────────┴─────────┘
```

Rules:

- Keep primary navigation stable.
- Use consistent icons.
- Highlight the active section.
- Keep the primary navigation to about five destinations.
- Do not hide critical actions inside a hamburger menu.
- Messaging and notifications can be accessed from headers or contextual screens.

The existing UI description specifically calls for bottom navigation to keep movement between major screens simple and consistent. fileciteturn2file1L133-L169

---

# 5. Visual Direction

The current project document describes the User Home Screen as:

- Elegant
- Premium
- Sophisticated
- Dark background
- Wine-toned highlights
- Soft neutral text
- Gold accents
- Large Create Event card
- Shortcut cards
- Recent Events
- Bottom navigation

This should be the starting visual direction for the rebuild. fileciteturn2file1L133-L169

### Design relationship

```text
Dark foundation
      ↓
Wine / burgundy emphasis
      ↓
Gold for important actions
      ↓
Soft neutral text
      ↓
Light/neutral surfaces where readability requires them
```

Do not use gold for every button. Reserve it primarily for important actions and visual emphasis.

---

# 6. Design Foundations

## Color Tokens

The source document specifies the visual direction but does not provide exact color codes. Define exact values in Figma.

Create these tokens:

```text
Background
Background Secondary
Surface
Surface Elevated
Primary
Primary Dark
Accent
Text Primary
Text Secondary
Text Muted
Border
Success
Warning
Error
Info
```

## Typography

Recommended starting scale:

```text
Display       32 px
Screen Title  24 px
Section       20 px
Subheading    18 px
Body          16 px
Secondary     14 px
Caption       12 px
```

Use typography for hierarchy instead of excessive font weights.

## Spacing

```text
4
8
12
16
20
24
32
40
48
```

## Radius

```text
Small       8 px
Medium     12 px
Large       16 px
Extra Large 20–24 px
Pill        999 px
```

Suggested:

```text
Buttons      12
Inputs       12
Cards        16
Bottom sheets 20–24
Tags         Pill
```

---

# 7. Component Library

Build the component system in Figma before designing every screen.

## Base Components

```text
Button
Text Input
Dropdown
Date Picker
Time Picker
Checkbox
Radio
Switch
Search Bar
Chip
Badge
Avatar
Icon Button
Divider
```

## Composite Components

```text
Service Card
Merchant Card
Booking Card
Event Card
Budget Card
Review Card
Notification Card
Message Bubble
Package Card
Statistic Card
```

## Navigation

```text
Bottom Navigation
Top Header
Back Header
Tab Bar
```

---

# 8. Figma Component Naming

Use consistent names:

```text
Button / Primary / Default
Button / Primary / Pressed
Button / Primary / Disabled
Button / Primary / Loading

Input / Default
Input / Focused
Input / Filled
Input / Error
Input / Disabled

Card / Service
Card / Merchant
Card / Booking
Card / Event

Status / Pending
Status / Confirmed
Status / Cancelled
```

Every reusable component should have documented states.

---

# 9. Button Hierarchy

## Primary

For the main action:

```text
Create Event
Continue
Book Now
Confirm Booking
Pay Now
Submit Review
```

## Secondary

For supporting actions:

```text
View Details
Edit
Message Merchant
Compare
```

## Tertiary

For low-priority actions:

```text
See All
Skip
Cancel
Learn More
```

## Destructive

For:

```text
Cancel Booking
Delete Event
Delete Service
Remove Item
```

Destructive actions should use confirmation when appropriate.

---

# 10. Input Design

Every input should communicate:

```text
Label
Input
Helper text / validation
```

Example:

```text
Event Name
[ Sarah & John Wedding ]

Event Date
[ Select date ]

Guest Count
[ 150 ]
```

Do not rely only on placeholder text.

---

# 11. Home Screen

The source document specifically describes:

- MULTIVENT branding
- Welcome message
- Large Create Event card
- Budget Planner
- Find Merchants
- My Bookings
- Event Ledger
- Recent Events
- Bottom navigation

Recommended structure:

```text
┌─────────────────────────────┐
│ Logo                 Bell   │
│                             │
│ Welcome, [Name]             │
│ Plan your perfect event     │
│                             │
│ ┌─────────────────────────┐ │
│ │      CREATE EVENT       │ │
│ │ Start planning          │ │
│ │ your next event         │ │
│ │                     +   │ │
│ └─────────────────────────┘ │
│                             │
│ Quick Actions               │
│                             │
│ ┌─────────┐ ┌─────────────┐ │
│ │ Budget  │ │ Find        │ │
│ │ Planner │ │ Merchants   │ │
│ └─────────┘ └─────────────┘ │
│                             │
│ ┌─────────┐ ┌─────────────┐ │
│ │ Bookings│ │ Event       │ │
│ │         │ │ Ledger      │ │
│ └─────────┘ └─────────────┘ │
│                             │
│ Recent Events               │
│ ┌─────────────────────────┐ │
│ │ Wedding                 │ │
│ │ June 20, 2027           │ │
│ │ 4 bookings              │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ Home Explore Events Bookings│
│ Profile                     │
└─────────────────────────────┘
```

### Home UX rule

The Home screen should answer:

> **What should I do next?**

Prioritize:

1. Current/upcoming event
2. Create Event when no event exists
3. Pending actions
4. Bookings requiring attention
5. Budget status
6. Recommended services
7. Recent activity

---

# 12. New User Home State

Use a useful empty state:

```text
Welcome to MULTIVENT

Start planning your event by creating
your first event.

[ Create Event ]
```

Do not fill the dashboard with empty placeholder cards.

---

# 13. Event Creation

The source document describes the Event Creation screen as a focused form containing:

- Event name
- Event type
- Preferred date
- Venue
- Guest count

It also describes:

- Large headings
- Glass-like panels
- Clear input areas
- Calendar selection
- Venue selection
- Wine gradients
- Gold action elements
- Continue action leading to the budget stage

fileciteturn2file1L167-L169

## Recommended flow

```text
Event Details
      ↓
Date & Venue
      ↓
Guest Count
      ↓
Budget
      ↓
Requirements
      ↓
Review
      ↓
Create Event
```

Use a progress indicator:

```text
●────●────○────○────○
1    2    3    4    5
```

Always show the current step and remaining steps.

---

# 14. Event Details

Recommended fields:

```text
Event Name
Event Type
Event Date
Venue
Guest Count
```

For the current research scope, wedding planning is the pilot context.

The Event Planning Module is intended to manage event type, schedule, budget, location, and service requirements. fileciteturn2file2L186-L190

---

# 15. Budget Planner

Budget is an important part of the event-planning experience.

Example:

```text
TOTAL BUDGET
₱250,000

Allocated
₱170,000

Remaining
₱80,000
```

Category breakdown:

```text
Venue             ₱70,000
Catering          ₱60,000
Photography       ₱20,000
Decoration        ₱20,000
──────────────────────────
Remaining         ₱80,000
```

Use a simple visual indicator:

```text
████████████████░░░░
Allocated 68%
```

Do not overcomplicate simple financial information with unnecessary charts.

---

# 16. Explore Screen

Core elements:

```text
Search
Categories
Filters
Sort
Results
```

Recommended:

```text
┌─────────────────────────────┐
│ Explore                     │
│                             │
│ [ Search services...      ] │
│                             │
│ Categories                  │
│ [Venue] [Food] [Photo] ...  │
│                             │
│ [ Filter ]      [ Sort ]    │
│                             │
│ Recommended for You         │
│ ┌─────────────────────────┐ │
│ │ Service / Merchant      │ │
│ │ Image                   │ │
│ │ Rating • Price          │ │
│ │ [ View Details ]        │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

# 17. Categories

The service marketplace includes event providers such as:

- Venues
- Caterers
- Photographers
- Videographers
- Makeup artists
- Florists
- Sound and lighting providers
- Gown suppliers
- Event coordinators

Use consistent category imagery/icons.

---

# 18. Search

Search should support user goals such as:

```text
Wedding venue
Photographer
Catering
Affordable venue
```

Required states:

```text
Initial
Typing
Results
No Results
Error
```

The user should not need to know the exact merchant name to find a service.

---

# 19. Filters

Use a bottom sheet or modal.

Possible filters:

```text
Category
Price / Budget
Rating
Location
Availability
Event requirements
```

Actions:

```text
Clear All
Apply Filters
```

Show active-filter count where useful:

```text
[ Filter 3 ]
```

---

# 20. Service / Merchant Card

Recommended information hierarchy:

```text
Image
Service Name
Merchant Name
Rating
Price
Short Description
Relevant Status
Primary Action
```

Example:

```text
┌─────────────────────────────┐
│                             │
│       SERVICE IMAGE         │
│                             │
├─────────────────────────────┤
│ Garden Wedding Venue        │
│ Rose Events                 │
│ ★ 4.8   From ₱50,000        │
│ Up to 200 guests            │
│                             │
│ [ View Details ]            │
└─────────────────────────────┘
```

The card should support fast comparison without becoming overcrowded.

---

# 21. Service Details

Recommended order:

```text
Image Gallery
     ↓
Service Name
     ↓
Merchant
     ↓
Rating / Reviews
     ↓
Price
     ↓
Description
     ↓
Packages
     ↓
Availability
     ↓
Reviews
     ↓
Recommendation / Insight
     ↓
Book Now
```

The user should be able to understand the service before committing to a booking.

---

# 22. Merchant Profile

Recommended:

```text
Business Header
Business Description
Rating
Reviews
Services
Packages
Availability
Contact / Message
```

The profile should communicate trust and business legitimacy without hiding the information needed for booking.

---

# 23. Recommendation UI

The system's recommendation module considers factors including:

- Event requirements
- Budget
- Service category
- Ratings
- Reviews
- User preferences

fileciteturn2file9L598-L604

Do not show only:

```text
Recommended
```

Prefer:

```text
Recommended for your event

✓ Within your budget
✓ Available on your date
✓ Highly rated
```

Recommendations should appear where the user is making a decision.

---

# 24. AI / RAG UI

The project describes RAG/OpenAI-supported recommendations, event-planning suggestions, merchant evaluations, and feedback summaries. fileciteturn2file7L513-L518

Suggested presentation:

```text
AI SERVICE INSIGHT

Customers frequently mention:

• Professional staff
• Good service quality
• Fast communication

Based on available customer reviews

[ View Review Evidence ]
```

AI-generated information should be visually distinguishable from verified database information.

Use labels such as:

```text
AI Insight
Based on customer reviews
Generated from available service information
```

---

# 25. Booking Flow

Recommended:

```text
Service Details
      ↓
Select Date
      ↓
Select Package
      ↓
Review Requirements
      ↓
Booking Summary
      ↓
Submit Request
      ↓
Merchant Review
      ↓
Approved / Rejected
      ↓
Payment
      ↓
Confirmed
```

Booking is one of the core workflows of MULTIVENT.

The Booking Management Module handles creation, status updates, approvals, cancellations, and transaction records. fileciteturn2file2L187-L190

---

# 26. Booking Summary

Before submission:

```text
SERVICE
Merchant

EVENT
Wedding

DATE
June 20, 2027

PACKAGE
Premium Package

PRICE
₱75,000

NOTES
...

[ Submit Booking Request ]
```

The user should be able to verify the information before submitting.

---

# 27. Booking Status

Use consistent status chips:

```text
Pending
Approved
Payment Required
Paid
Confirmed
Completed
Cancelled
Rejected
```

Do not rely on color alone.

Example:

```text
[ Pending ]
[ Confirmed ]
[ Cancelled ]
```

---

# 28. Booking Details

Show:

```text
Booking Status
Service
Merchant
Event
Date
Time
Package
Price
Payment
Notes
Messages
Actions
```

The current status should be visually prominent at the top.

---

# 29. Cancellation

Use a confirmation dialog:

```text
Cancel Booking?

Are you sure you want to cancel this booking?

Cancellation policies may apply.

[ Keep Booking ]
[ Cancel Booking ]
```

Make the applicable policy accessible before confirmation.

---

# 30. Payment

The project specifies PayMongo for online payment processing and transaction verification. fileciteturn2file3L230-L233

Payment UI should clearly show:

```text
Booking
Amount Due
Payment Method
Payment Status
```

After successful processing:

```text
Payment Successful

Your transaction is being verified.

[ View Booking ]
```

Do not design the UI so a client-side success screen alone implies permanent payment confirmation.

---

# 31. Messaging

Communication supports coordination between clients and service providers through messaging, notifications, and booking updates. fileciteturn2file1L116-L123

Conversation list:

```text
Merchant Name
Last Message
Time
Unread Count
Related Booking/Event
```

Chat:

```text
Merchant Header

Message History

[ Type a message... ] [Send]
```

Where useful, include booking context:

```text
Booking #1024
Wedding Photography
June 20, 2027
[ View Booking ]
```

---

# 32. Notifications

Prioritize actionable notifications:

```text
Booking approved
Payment required
Payment confirmed
Merchant replied
Booking cancelled
Upcoming booking
Review reminder
```

Each notification should lead directly to the relevant screen.

---

# 33. Reviews

Recommended flow:

```text
Completed Booking
      ↓
Review Prompt
      ↓
Rating
      ↓
Descriptors
      ↓
Comment
      ↓
Submit
```

The system evaluates customer reviews and feedback for service-quality analysis. fileciteturn2file2L191-L194

Example UI:

```text
How was your experience?

★★★★★

What did you like?

[ Professional ]
[ Good Quality ]
[ Affordable ]
[ Friendly ]

Additional comments

┌─────────────────────────────┐
│ Tell us about your          │
│ experience...               │
└─────────────────────────────┘

[ Submit Review ]
```

---

# 34. Review Insights

Possible aggregate presentation:

```text
Customer Insights

Positive     82%
Neutral      12%
Negative      6%

Frequently Mentioned

Professional
Quality
Communication
Price
```

Clearly distinguish aggregate review data from AI-generated summaries.

---

# 35. My Events

The event should be the user's central planning workspace.

Example:

```text
My Events

┌─────────────────────────────┐
│ Sarah & John Wedding        │
│ June 20, 2027               │
│                             │
│ Planning Progress           │
│ ████████████░░ 75%          │
│                             │
│ 6 services selected         │
│ 4 bookings confirmed        │
│                             │
│ [ View Event ]              │
└─────────────────────────────┘
```

---

# 36. Event Details

Recommended order:

```text
Event Header
     ↓
Event Information
     ↓
Planning Progress
     ↓
Budget
     ↓
Required Services
     ↓
Selected Services
     ↓
Bookings
     ↓
Notes
```

The Event Planning Module manages event type, schedule, budget, location, and service requirements. fileciteturn2file2L186-L190

---

# 37. Event Ledger

The existing UI description identifies an Event Ledger shortcut.

Use it as a consolidated event financial/transaction view, such as:

```text
Total Budget
Estimated Cost
Paid
Pending
Remaining
```

If the application's exact Event Ledger business definition changes, update the Figma specification before implementation.

---

# 38. Profile

Client profile:

```text
Profile Header
Personal Information
Preferences
Notifications
Security
Help
Terms & Policies
Logout
```

Keep account management separate from event planning.

---

# 39. Merchant Dashboard

Merchant UI should focus on operational tasks:

```text
Today's Overview

Pending Requests
Confirmed Bookings
Upcoming Events
Unread Messages

Quick Actions

Add Service
Manage Availability
View Bookings

Recent Activity
```

Do not make the merchant dashboard identical to the client's consumer-oriented Home screen.

---

# 40. Merchant Service Management

Service management should support:

```text
Service Name
Category
Description
Price
Packages
Images
Availability
Status
```

Flow:

```text
Services
   ↓
[ + Add Service ]
   ↓
Service Information
   ↓
Pricing
   ↓
Images
   ↓
Availability
   ↓
Preview
   ↓
Publish
```

---

# 41. Merchant Booking Management

Use tabs/status groups:

```text
Pending
Approved
Upcoming
Completed
Cancelled
```

Each booking should show:

```text
Client
Event
Service
Date
Amount
Status
```

Primary actions:

```text
Approve
Reject
Message
View Details
```

---

# 42. Administrator UI

Administrator screens should prioritize:

```text
System Overview
Users
Merchants
Services
Bookings
Payments
Reviews
Reports
```

The administrator is responsible for platform oversight and monitoring. fileciteturn2file6L485-L490

---

# 43. Admin Dashboard

Possible metrics:

```text
Total Users
Total Merchants
Active Services
Bookings
Transactions
Average Rating
Recent Activity
```

Use charts only when they improve understanding.

---

# 44. Admin Lists

For mobile:

- Use cards for small data sets.
- Use filters and search.
- Use status chips.
- Use detail screens.
- Avoid overcrowded tables.
- Use horizontally scrollable tables only when genuinely necessary.

---

# 45. Loading States

Every data-driven screen needs a loading state.

Use:

```text
Service Skeleton
Merchant Skeleton
Booking Skeleton
Message Skeleton
Dashboard Skeleton
```

Do not show an empty state while data is still loading.

---

# 46. Empty States

Example:

```text
No Bookings Yet

Your confirmed and pending bookings
will appear here.

[ Explore Services ]
```

An empty state should explain:

1. What is empty
2. Why it may be empty
3. What the user can do next

---

# 47. Error States

Example:

```text
Unable to Load Services

Something prevented the services
from loading.

[ Try Again ]
```

Do not expose raw technical errors to normal users.

---

# 48. Success Feedback

Examples:

```text
Booking request submitted
Service saved
Profile updated
Review submitted
Message sent
Event created
```

Use lightweight toast/snackbar feedback for small actions and full confirmation screens for significant transactions.

---

# 49. Navigation Rules

### Rule 1
Back returns to the previous logical screen.

### Rule 2
Returning from Service Details should preserve the user's Explore context.

### Rule 3
Completing Event Creation should open the created event.

### Rule 4
Opening a notification should take the user to its relevant content.

### Rule 5
Do not unnecessarily reset navigation state.

---

# 50. Touch and Accessibility

Do not rely only on:

- Color
- Icons
- Position

Use:

- Text labels
- Clear contrast
- Consistent icons
- Readable typography
- Adequate spacing

For statuses:

```text
❌ Red only = Cancelled

✓ [Cancelled] + semantic color + clear text
```

Important actions must be physically easy to tap.

---

# 51. Image Guidelines

Merchant/service images are important for discovery.

Keep consistent aspect ratios for:

```text
Service Cards
Merchant Cards
Gallery Images
Profile Images
Package Images
```

Do not allow random image proportions to make the marketplace visually inconsistent.

---

# 52. Glass-Like Panels

The Event Creation screen specifically describes glass-like panels.

If retained:

Use them selectively for:

- Event creation
- Premium cards
- Hero sections
- Important overlays

Do not apply glass effects to everything.

The premium appearance must not reduce readability.

---

# 53. Motion

Use animation to communicate state:

```text
Screen transitions
Card press
Button loading
Modal appearance
Booking status change
Success confirmation
```

Avoid long decorative animations that slow down planning tasks.

---

# 54. Recommendations + UX

Recommendations should appear inside the planning workflow.

Preferred:

```text
Event
 ↓
Need Photography?
 ↓
Recommended Photographers
 ↓
Compare
 ↓
Book
```

Avoid making recommendations a disconnected AI-only page.

The document identifies merchant recommendations based on event requirements, budget constraints, categories, ratings, and other criteria. fileciteturn2file2L187-L192

---

# 55. Budget + Recommendation UX

Example:

```text
Wedding Budget: ₱250,000

Photography Allocation: ₱25,000

Recommended:

1. Studio A — ₱22,000
2. Studio B — ₱24,000
3. Studio C — ₱28,000
```

Clearly distinguish:

```text
Within Budget
Near Budget
Above Budget
```

---

# 56. Reviews + Recommendation UX

Instead of only:

```text
★★★★★ 4.8
```

eventually provide useful aggregate information:

```text
4.8 ★

Customers often mention:
• Professional staff
• Quality output
• Fast communication
```

If AI-generated, label the content clearly as an insight.

---

# 57. Primary Client Journey

Use this as the main prototype:

```text
OPEN APP
   ↓
LOGIN
   ↓
HOME
   ↓
CREATE EVENT
   ↓
EVENT DETAILS
   ↓
BUDGET
   ↓
SERVICE REQUIREMENTS
   ↓
RECOMMENDATIONS
   ↓
EXPLORE
   ↓
SERVICE DETAILS
   ↓
COMPARE
   ↓
BOOK
   ↓
MERCHANT RESPONSE
   ↓
PAYMENT
   ↓
CONFIRMATION
   ↓
MESSAGING
   ↓
EVENT
   ↓
REVIEW
```

This should be the primary UX flow used to test whether the application feels coherent.

---

# 58. Screen Inventory

## Authentication

- [ ] Splash
- [ ] Welcome
- [ ] Login
- [ ] Register
- [ ] Forgot Password
- [ ] Verification
- [ ] Profile Setup

## Client

- [ ] Home
- [ ] Explore
- [ ] Categories
- [ ] Search Results
- [ ] Filter
- [ ] Service Details
- [ ] Merchant Profile
- [ ] Recommendations
- [ ] Create Event
- [ ] Event Details
- [ ] Budget Planner
- [ ] Event Ledger
- [ ] My Events
- [ ] Booking List
- [ ] Booking Details
- [ ] Payment
- [ ] Messages
- [ ] Chat
- [ ] Notifications
- [ ] Review
- [ ] Profile
- [ ] Settings
- [ ] Policies

## Merchant

- [ ] Dashboard
- [ ] Profile
- [ ] Services
- [ ] Add Service
- [ ] Edit Service
- [ ] Packages
- [ ] Availability
- [ ] Booking Requests
- [ ] Booking Details
- [ ] Messages
- [ ] Reviews
- [ ] Performance

## Administrator

- [ ] Dashboard
- [ ] Users
- [ ] User Details
- [ ] Merchants
- [ ] Merchant Details
- [ ] Services
- [ ] Bookings
- [ ] Payments
- [ ] Reviews
- [ ] Reports
- [ ] System Activity

---

# 59. Figma File Structure

Recommended:

```text
00 — Cover
01 — Design Foundations
02 — Components
03 — Authentication
04 — Client
05 — Merchant
06 — Administrator
07 — Booking Flows
08 — Payment Flows
09 — Messaging
10 — Reviews
11 — Recommendations / AI
12 — Prototype Flows
13 — Design QA
```

---

# 60. Figma Prototype Priority

Do not prototype every screen first.

Start with:

```text
Login
 ↓
Home
 ↓
Create Event
 ↓
Budget
 ↓
Explore
 ↓
Service Details
 ↓
Booking
 ↓
Payment
 ↓
Confirmation
```

Then add:

```text
Merchant Booking Response
Messaging
Review
Recommendation
```

---

# 61. UI/UX QA Checklist

## Layout

- [ ] Correct margins
- [ ] Consistent spacing
- [ ] Correct alignment
- [ ] No clipped content
- [ ] Clear scroll behavior

## Typography

- [ ] Correct hierarchy
- [ ] Readable body text
- [ ] Consistent weights

## Components

- [ ] Correct variants
- [ ] Correct states
- [ ] Consistent radius
- [ ] Consistent buttons

## Interaction

- [ ] Primary action is obvious
- [ ] Back behavior is logical
- [ ] Errors are visible
- [ ] Loading is represented
- [ ] Success is represented

## Content

- [ ] Labels are understandable
- [ ] Prices are clear
- [ ] Status is clear
- [ ] No unnecessary text

---

# 62. Usability Testing

The project document states that usability testing evaluates effectiveness, efficiency, user-friendliness, navigation issues, interface problems, and user feedback. It also identifies PSSUQ as an instrument for evaluating system usefulness, information quality, and interface quality. fileciteturn2file1L120-L130

Design realistic tasks.

## Client Tasks

```text
1. Create a wedding event.
2. Set the event budget.
3. Find a suitable venue.
4. View a merchant's service.
5. Submit a booking request.
6. Check booking status.
7. Message a merchant.
8. Submit a review.
```

## Merchant Tasks

```text
1. Add a service.
2. Set pricing.
3. Update availability.
4. Review a booking.
5. Approve a booking.
6. Message the client.
```

---

# 63. Design-to-Code Handoff

Every finalized Figma component should document:

```text
Component Name
Variants
States
Spacing
Typography
Color Tokens
Interaction
Responsive Behavior
```

Example:

```text
ServiceCard

States:
- Default
- Pressed
- Unavailable

Content:
- Image
- Service Name
- Merchant
- Rating
- Price
- Action

Interaction:
Tap → Service Details
```

This will make React Native implementation more consistent.

---

# 64. UI/UX Development Order

```text
PHASE 1
Design Foundations
        ↓
PHASE 2
Authentication
        ↓
PHASE 3
Client Home + Navigation
        ↓
PHASE 4
Event Creation
        ↓
PHASE 5
Explore + Services
        ↓
PHASE 6
Merchant Profile
        ↓
PHASE 7
Booking
        ↓
PHASE 8
Budget + Event Management
        ↓
PHASE 9
Payment
        ↓
PHASE 10
Messaging + Notifications
        ↓
PHASE 11
Reviews
        ↓
PHASE 12
Recommendations / AI
        ↓
PHASE 13
Merchant UI
        ↓
PHASE 14
Administrator UI
        ↓
PHASE 15
Prototype QA + Usability Testing
```

---

# 65. What NOT to Do

Avoid:

- Designing screens independently
- Overloading Home
- Using too many colors
- Hiding price, date, status, or primary actions
- Making every card clickable
- Designing only the happy path
- Designing AI before the core workflows
- Excessive gradients, glow, blur, or animation
- Decorative UI that reduces readability

The project explicitly emphasizes usability testing and refinement of navigation and interface issues, so these aspects should be treated as development requirements rather than optional polish. fileciteturn2file1L120-L127

---

# 66. Final Design Direction

MULTIVENT should feel:

```text
Premium
   +
Organized
   +
Trustworthy
   +
Simple
   +
Mobile-first
```

It should not feel like:

```text
Luxury visuals
   +
Complex dashboard
   +
Too many features
   +
Confusing navigation
```

The application should communicate that MULTIVENT is a **centralized event-planning workspace**, not merely a marketplace.

---

# 67. Central UX Concept

The event should be the organizing concept of the entire client experience:

```text
EVENT
  │
  ├── Budget
  │
  ├── Requirements
  │
  ├── Services
  │
  ├── Recommendations
  │
  ├── Bookings
  │
  ├── Payments
  │
  ├── Messages
  │
  └── Reviews
```

The client should be able to move between these areas without losing the context of the event being planned.

---

# 68. Final Screen-Design Test

Before approving any screen, ask:

```text
What user problem does this screen solve?
        ↓
What information does the user need?
        ↓
What action should the user take?
        ↓
What happens after the action?
        ↓
What if there is no data?
        ↓
What if the action fails?
        ↓
How does the user return?
```

If these questions cannot be answered, the screen is not ready for implementation.

---

# 69. Source Alignment

This guide is based on the project document rather than replacing its stated requirements.

The document identifies the three primary roles as Client, Merchant, and Administrator and emphasizes role-based interaction and controlled access. fileciteturn2file0L97-L101

It identifies User Management, Event Planning, Booking Management, Recommendation, Communication, Sentiment Analysis, and Analytics/Reporting as major application modules. fileciteturn2file2L183-L195

The existing User Home Screen description establishes the dark, wine-toned, gold-accented premium visual direction and the Create Event, Budget Planner, Find Merchants, My Bookings, Event Ledger, Recent Events, and bottom-navigation structure. fileciteturn2file1L133-L169

The Event Creation description establishes event name, event type, date, venue, and guest count as the main inputs and describes the guided progression toward the budget stage. fileciteturn2file1L167-L169

The system architecture identifies React Native and Expo as the presentation layer for the mobile interface. fileciteturn2file8L557-L568

---

# 70. Final Rule

Every new UI screen should support the user's larger event-planning journey.

```text
EVENT
  ↓
PLAN
  ↓
DISCOVER
  ↓
COMPARE
  ↓
BOOK
  ↓
PAY
  ↓
COORDINATE
  ↓
COMPLETE
  ↓
REVIEW
```

The UI should make that journey obvious, consistent, and easy to complete.
