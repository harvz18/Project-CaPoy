# APPENDIX A
# USER MANUAL

## MULTIVENT: A Mobile-Based Event Planning Application with Integrated Decision Support and Sentiment Analysis

**Pilot scope:** Wedding event planning in Bacolod City, Philippines  
**Document status:** Source-code verified manual. Screenshot placeholders identify views that should be captured from the current deployed build before manuscript submission.

## A.1 Introduction

MULTIVENT supports the planning, selection, booking, coordination, and monitoring of wedding-event services. Clients build an event plan, select service providers and, when required, an event coordinator. Providers maintain their service listings and respond to booking requests. Coordinators manage only the events to which they are assigned. Administrative roles use the web dashboard to govern the marketplace, review operations, and monitor platform records.

This manual describes the features implemented in the current source code. Controls may be hidden when an account does not have the required role, record state, or permission.

## A.2 System Requirements

| Item | Verified requirement |
|---|---|
| Client, Coordinator, and Service Provider access | MULTIVENT Expo application on a supported Android or iOS device, or its web build where deployed. |
| Staff access | MULTIVENT web dashboard in a modern web browser. The repository does not declare minimum browser-version requirements. |
| Orientation | The mobile application is configured for portrait orientation. |
| Internet | An active internet connection is required for sign-in, catalogue loading, messages, notifications, bookings, uploads, and payment status updates. |
| Account | A valid MULTIVENT account is required. Client and Service Provider accounts use email and password; Google sign-in is also implemented for the client-facing sign-in flow. |
| Service Provider registration | A business name, contact details, service category, email, and password are required. New provider accounts are pending approval before the provider workspace is available. |
| Staff and Coordinator access | These accounts are provisioned or assigned by authorized staff; no public self-registration flow is implemented for them. |

## A.3 Getting Started

### A.3.1 Open MULTIVENT and select an entry path

**Description:** Opens the role-selection screen for a new or signed-out user.

**Procedure:**

1. Open the MULTIVENT application or the deployed web application.
2. On the welcome screen, choose **Plan Your Event** for a Client account or **Offer Your Services** for a Service Provider account.
3. Select **CONTINUE** to open the corresponding registration form.
4. If an account already exists, select **Sign In**.

**Screenshot:**  
[SCREENSHOT REQUIRED: ROLE SELECTION SCREEN]  
*Figure A.1. MULTIVENT role-selection screen*

**Expected Result:** The application opens the appropriate registration sheet or the sign-in sheet.

### A.3.2 Sign in

**Description:** Signs an existing account into the workspace associated with its assigned role.

**Procedure:**

1. Select **Sign In**.
2. Enter the registered email address and password.
3. Select the sign-in action shown in the form.
4. Alternatively, select the available Google sign-in option and finish the provider authentication flow.

**Expected Result:** Active accounts are routed to their role workspace. Suspended or disabled accounts are signed out and shown the applicable support message.

### A.3.3 Register and verify an account

**Description:** Creates a Client or Service Provider account and completes email verification when the authentication service requires it.

**Procedure:**

1. From the role-selection screen, select the Client or Service Provider path.
2. Complete all required fields shown by the selected sign-up form.
3. Read and accept the applicable terms displayed in the form.
4. Submit the form.
5. If prompted, open the verification screen, enter the code sent to the registered email address, and submit it.
6. Use **Resend** only if a new code is required.

**Expected Result:** A verified Client can continue to the Client workspace. A verified Service Provider is routed to the pending-approval state until the provider application is reviewed.

### A.3.4 Recover a password

**Procedure:**

1. Open **Sign In** and select **Forgot Password**.
2. Enter the account email address and request a recovery code.
3. Open the password-reset screen from the application flow.
4. Enter the received code and a new password.
5. Submit the new password, then sign in again.

**Expected Result:** The password is updated and the application signs the user out so the new credentials can be used.

### A.3.5 Sign out

**Procedure:**

1. Open the account/profile menu in the current workspace.
2. Select **Sign out**.
3. Confirm if the interface requests confirmation.

**Expected Result:** The active session is cleared and the application returns to the public entry flow.

---

## A.4 Super Admin User Manual

### A.4.1 Access the Super Admin governance workspace

**Description:** Super Admins use the web dashboard’s governance workspace. This role is intentionally distinct from the operational Admin workspace.

**Procedure:**

1. Open the MULTIVENT web dashboard and sign in with a Super Admin account.
2. Use the left navigation to open **Users**, **Financial overview**, **Staff & permissions**, **Audit log**, or **System settings**.
3. Use the top search, notification, profile, and **Sign out** controls as needed.

**Screenshot:**  
[SCREENSHOT REQUIRED: SUPER ADMIN GOVERNANCE DASHBOARD]  
*Figure A.2. Super Admin governance workspace*

**Expected Result:** Only Super Admin routes and permission-authorized controls are available. The interface does not expose the ordinary Admin operational navigation by default.

### A.4.2 Review user accounts

**Description:** Displays user account records and role/status information for governance review.

**Procedure:**

1. Select **Users**.
2. Search or filter the user list.
3. Select the row action for an eligible account when an account-status decision is required.
4. Provide the required decision information and confirm the action.

**Expected Result:** The permitted account-status action is recorded. A Super Admin cannot manage their own status through this control, and protected Super Admin accounts are not presented as ordinary targets.

### A.4.3 Create staff accounts and manage permissions

**Description:** The **Staff & permissions** page provides permission-governed staff management. It is the source-backed path for creating internal staff accounts and assigning permissions.

**Procedure:**

1. Select **Staff & permissions**.
2. Review existing staff accounts and their assigned permissions.
3. Use the available create/manage controls to add or update a staff account.
4. Select only the permissions required for the staff member’s responsibilities.
5. Save the changes.

**Screenshot:**  
[SCREENSHOT REQUIRED: STAFF AND PERMISSIONS PAGE]  
*Figure A.3. Staff and permissions management*

**Expected Result:** The selected permissions govern the staff member’s accessible dashboard actions. Permission changes remain subject to the dashboard’s role checks.

### A.4.4 Review financial operations

**Description:** Shows platform-recorded payments, provider allocations, payout requests, refund operations, and reconciliation information. It does not create an internal stored-value wallet.

**Procedure:**

1. Select **Financial overview**.
2. Choose a date range, if needed.
3. Review payment, provider-fund, payout, refund, and reconciliation sections.
4. Where a permitted action is shown, record only an authoritative external settlement or disbursement reference.

**Expected Result:** Financial state changes are permission-gated and audited. The system distinguishes platform-recorded initial payments from later direct provider balances.

### A.4.5 Review audit history and controlled settings

**Procedure:**

1. Select **Audit log** to search and review recorded privileged actions.
2. Select **System settings** to view or update only the controlled settings that are shown to the account.
3. Use **Refresh** when current data must be retrieved manually.

**Expected Result:** Audit history remains read-only for review. Settings controls appear only when the Super Admin has the required permission.

---

## A.5 Admin User Manual

### A.5.1 Access the Admin dashboard

**Description:** Admins use the web dashboard to manage marketplace operations. The available navigation is narrower than Super Admin governance controls and is additionally permission-scoped.

**Procedure:**

1. Open the MULTIVENT web dashboard and sign in with an Admin account.
2. Select **Dashboard** to view the operational overview.
3. Use the sidebar to open **Providers**, **Categories**, **Ratings & reviews**, **Bookings**, **Revenue**, or **Reports**.
4. Use the dashboard search or section filters to locate a record.

**Screenshot:**  
[SCREENSHOT REQUIRED: ADMIN DASHBOARD]  
*Figure A.4. Admin operational dashboard*

**Expected Result:** The dashboard loads only routes that the Admin role and assigned permissions can access.

### A.5.2 Review Service Provider applications

**Description:** Allows an authorized Admin to inspect a provider application and approve or decline it.

**Procedure:**

1. Select **Providers**.
2. Search or filter for the provider.
3. Open **Review** for the provider application.
4. Review the business profile and submitted information.
5. Select the available approval or decline action and provide a reason when requested.

**Expected Result:** The provider verification status is updated according to the authorized decision. New providers remain unavailable to clients until the appropriate approval and listing conditions are met.

### A.5.3 Review service applications and marketplace categories

**Procedure:**

1. Open **Service applications** when it is available to the signed-in Admin, or use the provider review workflow to inspect a listing.
2. Review the listing details, price configuration, and published status.
3. Approve, decline, or request the available permitted action.
4. Open **Categories** to view category-level listing and performance information.

**Expected Result:** Only approved, live provider services can be made available to the client marketplace. Category screens provide marketplace analysis; they do not alter a client’s booking.

### A.5.4 Monitor bookings, revenue, reports, and feedback

**Procedure:**

1. Select **Bookings** to search events and service bookings, open details, and review lifecycle status.
2. Select **Revenue** to view platform revenue and booking trends for a selected date range.
3. Select **Reports**, choose a report type and date range, and optionally filter by service category or search the result rows.
4. Select **Ratings & reviews** to review feedback records and the available sentiment-analysis status or retry control.

**Screenshot:**  
[SCREENSHOT REQUIRED: ADMIN BOOKINGS OR REPORTS SCREEN]  
*Figure A.5. Admin operational reporting*

**Expected Result:** Tables show ten records per page with page navigation. Report export uses the filtered result set. Review analysis actions appear only to authorized users.

### A.5.5 Use financial and account controls

**Procedure:**

1. Open **Financial overview** only if it is available to the account.
2. Review payment, reconciliation, payout, and refund records.
3. Use **Refresh** to reload information manually.
4. Open the profile menu in the dashboard header and select **Sign out** when finished.

**Expected Result:** Financial actions remain controlled by the relevant permission; Admins do not receive Super Admin staff-permission, audit-log, or system-settings routes.

---

## A.6 Client User Manual

### A.6.1 Use the Client home screen and navigation

**Description:** The Client home screen provides access to planning, current plans/bookings, marketplace discovery, messages, notifications, and account functions.

**Procedure:**

1. Sign in as a Client.
2. Use **Plan Wedding** or the event-planning action to begin a new plan.
3. Use the floating bottom navigation to move between the available home, explore, inbox, and account areas.
4. Select a featured business or service card to open its detail overlay.

**Screenshot:**  
[SCREENSHOT REQUIRED: CLIENT HOME SCREEN]  
*Figure A.6. Client home and planning entry*

**Expected Result:** The home screen loads available marketplace content and saved/current client activity. The displayed business card opens the corresponding business details when that business remains available.

### A.6.2 Create event details

**Description:** Captures the details used to evaluate service availability and prepare a wedding plan.

**Procedure:**

1. Select **Plan Wedding**.
2. Enter the **Event Name**.
3. Select up to two optional wedding themes, if desired.
4. Answer **Would you like an event coordinator?**
5. Answer **Is this a church wedding?** when that follow-up is shown.
6. Enter or select the date and time.
7. Set the guest count.
8. Select the venue status. For a secured venue, use the venue map to search or pin the venue location, then select **DONE**.
9. Continue to the budget step.

**Screenshot:**  
[SCREENSHOT REQUIRED: CREATE EVENT SCREEN WITH SECURED VENUE MAP]  
*Figure A.7. Client event details and venue selection*

**Expected Result:** The event draft is saved with its date, time, guest count, coordinator preference, and venue information. A pinned venue uses the location returned for the selected map position when available.

### A.6.3 Set and allocate a budget

**Description:** Lets the Client set an optional event budget and distribute it across planning categories.

**Procedure:**

1. In **Set & Allocate Your Event Budget**, enter a total budget or continue without a budget.
2. Review the **Allocated Budget** and **Remaining Budget** amounts.
3. Select category allocations and adjust their values using the controls shown.
4. Select **DONE** to save the category allocations.
5. Continue to service selection.

**Expected Result:** The system stores the budget plan and uses category allocations to rank suitable services. A no-budget plan does not impose an artificial zero-peso limit.

### A.6.4 Select an event coordinator when requested

**Description:** When the Client chose to use a coordinator, the planning flow requires a coordinator selection before the plan can proceed.

**Procedure:**

1. Open the coordinator category from the planning flow.
2. Review the coordinator profile, stated fee, skills/specialties, and available feedback summary.
3. Select the preferred coordinator.
4. Confirm the selection and return to the planning categories.

**Screenshot:**  
[SCREENSHOT REQUIRED: COORDINATOR DETAILS AND SELECTION]  
*Figure A.8. Client coordinator selection*

**Expected Result:** The coordinator fee is reflected in planning allocations and the coordinator becomes part of the request workflow. The Client can remove or change the selection before submitting booking requests, subject to the current plan state.

### A.6.5 Explore and select services

**Description:** The **Choose Services** screen lets Clients compare live services by category. Recommendations use booking history, ratings, configured availability, category budget fit, and other bounded marketplace signals; unavailable and over-budget options can still be visible for comparison.

**Procedure:**

1. Open a service category from **Choose Services**.
2. Use category tags, filters, sorting, search, favourites, and the **Explore** / **Reviewed** tabs as needed.
3. Select a service card to view business/service details, packages, options, inclusions, price information, ratings, and feedback.
4. Choose required options and select **Add to Selection**.
5. Read the **Service Added. Proceed with the next category.** confirmation.
6. Repeat for each required category, then open **Event Plan** or **Review Selected Services**.

**Screenshot:**  
[SCREENSHOT REQUIRED: CLIENT EXPLORE SERVICES SCREEN]  
*Figure A.9. Client service discovery and selection*

**Expected Result:** One active selection is maintained for each category. The selected service’s configured options and quoted value are retained in the event plan.

### A.6.6 Select venue, catering, florist, and photo/video configurations

**Description:** Some categories have provider-configured booking details.

**Procedure:**

1. For a venue, choose the provider’s published venue package or configured hall/room option. Select one configured venue option; combined rooms must be offered by the provider as a configured option.
2. For catering, choose a preset menu or configured custom menu. Review the course and dish information shown before confirming.
3. If food tasting is offered and selected, choose preliminary dishes only within the limits configured by the caterer and select an available tasting schedule.
4. For florist services, select published arrangements, permitted customization, package, and fulfillment options.
5. For Photography or Videography, select the provider’s published package, coverage, deliverables, and optional priced inclusions.
6. Confirm the service selection.

**Expected Result:** The provider-defined choices are quoted and saved with the service selection. Food tasting is available only for catering that offers it and progresses only after the required booking/acceptance conditions are met.

### A.6.7 Review, save, or submit a plan

**Procedure:**

1. Open **Event Plan** or **Review Services**.
2. Review selected services, coordinator selection, category amounts, estimated total, and any venue-plus-catering inclusion.
3. Use the remove or change-service control when a selection must be replaced.
4. Select **Continue** to submit the plan, or select **Save Plan** when that option is presented.
5. Confirm **Save Plan** if the save confirmation dialog appears.

**Screenshot:**  
[SCREENSHOT REQUIRED: CLIENT REVIEW SELECTED SERVICES SCREEN]  
*Figure A.10. Client event-plan review*

**Expected Result:** A saved plan is retained for later review. Submitted service selections create booking requests rather than an immediate payment obligation.

### A.6.8 Track booking requests and change a declined provider

**Description:** Booking details show the event’s request/acceptance progress and individual service status.

**Procedure:**

1. Open the relevant event from the Client booking or plan list.
2. Review the progress tracker and each service request.
3. If a provider declines, select **Find alternate service**.
4. Compare an alternative, select **Change** or open its details and select **Confirm Change**.
5. Confirm the comparison and select **Send Request**.

**Expected Result:** The declined booking is replaced on the same event with one pending request to the chosen provider. The new provider receives the normal provider booking request notification.

### A.6.9 Complete payment after confirmations

**Description:** **Confirm Payment** is enabled only after every required provider and selected coordinator has accepted the booking request.

**Procedure:**

1. Open **Event Details**.
2. Wait for the tracker to show all required requests accepted.
3. Select **Confirm Payment**.
4. In the payment sheet, expand **Total event cost** to review the receipt and booked services.
5. Select **Required downpayment** or **Pay in full**.
6. Select the shown payment method, accept the cancellation policy and terms, and select **Confirm Downpayment** or **Pay Full** with the displayed amount.
7. Complete the external secure PayMongo checkout.
8. Return to MULTIVENT and allow the payment status to update.

**Screenshot:**  
[SCREENSHOT REQUIRED: CLIENT PAYMENT SHEET]  
*Figure A.11. Client payment option and receipt*

**Expected Result:** MULTIVENT records the payment attempt and verifies the successful external processor result through the secure server flow. A failed external payment can be retried without creating duplicate booking requests. The user-facing total already reflects the marketplace price; the interface does not expose the platform markup as a separate payment line.

### A.6.10 Manage event details, messages, feedback, and account

**Procedure:**

1. In **Event Details**, review service requests, provider balances, location, and event-specific messages.
2. Use **Message Coordinator** or the Inbox to communicate with eligible booking participants.
3. Use cancellation or rescheduling controls only when they are available for the event state; review the cancellation policy before confirming.
4. After a completed event, open the feedback/review flow and submit the rating and optional comment for eligible completed services.
5. Use the Account/Profile area to edit personal details, manage the available refund-destination demonstration data when present, view saved plans, or sign out.

**Expected Result:** Messages remain scoped to active or historical authorized booking relationships. Reviews become part of provider performance and may be processed by the platform’s sentiment-analysis workflow; the Client is not presented with an unverified model decision as a booking result.

---

## A.7 Coordinator User Manual

### A.7.1 Access the Coordinator workspace

**Description:** Coordinators have a dedicated workspace for client-selected events. They do not automatically receive all client or provider records.

**Procedure:**

1. Sign in with a Coordinator account that has been provisioned by authorized staff.
2. Open the Coordinator home/workspace.
3. Select an invitation or assigned event to review its details.

**Screenshot:**  
[SCREENSHOT REQUIRED: COORDINATOR HOME SCREEN]  
*Figure A.12. Coordinator event workspace*

**Expected Result:** The workspace lists only coordinator-authorized invitations and events.

### A.7.2 Respond to an event invitation and inspect an event

**Procedure:**

1. Open the invitation or event card.
2. Review the client event details, schedule, selected services, provider booking status, and visible financial summary.
3. Select the available accept or decline response for a pending invitation.
4. Open the event details after accepting.

**Expected Result:** The response updates the event’s coordinator status. Client payment eligibility considers the coordinator response when a coordinator is required.

### A.7.3 Manage coordination tasks and event preparation

**Procedure:**

1. Open an assigned event.
2. Review event information, service schedule, and task list.
3. Add a task using the workspace control.
4. Update task status as work progresses.
5. Use the coordinator’s authorized event messages to communicate with the client or participating providers.

**Expected Result:** Tasks and status changes are saved for the authorized event only. The Coordinator does not change provider booking decisions or client payment records.

### A.7.4 Record church-wedding arrangements when applicable

**Procedure:**

1. Open an assigned church-wedding event.
2. Add the available church arrangement details, including location/pin and ceremony details when requested by the screen.
3. Submit the proposal for client response.
4. Review the client’s approve/decline response and confirm the arrangement when the interface makes confirmation available.

**Expected Result:** Church details are retained on the event and shown to the Client for review. This workflow is optional and appears only for applicable events.

### A.7.5 Review remittance details, service profile, and notifications

**Procedure:**

1. Open the profile/Coordinator navigation area.
2. Select the available remittance, service-profile, package, or notification function.
3. Review only records shown for the Coordinator account.
4. Sign out from the account controls when finished.

**Expected Result:** The Coordinator sees its own authorized operational records. Remittance controls do not bypass the staff-controlled financial process.

---

## A.8 Service Provider User Manual

### A.8.1 Register as a Service Provider and wait for approval

**Description:** Providers create a business account through the Service Provider sign-up path. This public form is not a Coordinator registration form.

**Procedure:**

1. Choose **Offer Your Services** on the role-selection screen.
2. Enter the business name, contact name, service category, email, phone number, and password.
3. Accept the terms shown in the form and submit the application.
4. Complete email verification if prompted.
5. Wait for the **Pending Approval** result.

**Screenshot:**  
[SCREENSHOT REQUIRED: SERVICE PROVIDER SIGN-UP OR PENDING APPROVAL SCREEN]  
*Figure A.13. Service Provider registration and approval state*

**Expected Result:** The provider profile is created with pending verification. The provider should wait for marketplace approval before attempting to publish bookable services.

### A.8.2 Use the Provider home and manage the business profile

**Procedure:**

1. Sign in after the provider account is approved.
2. Open the Provider home to view services, booking activity, earnings, and notifications.
3. Open **Profile** to update business/profile information and applicable images.
4. Open **Operating Hours** to record the business operating schedule.
5. Save each changed form using the action shown.

**Expected Result:** Changes apply to the provider’s own profile and availability configuration. Listing visibility remains subject to listing and moderation state.

### A.8.3 Create or update a service listing

**Description:** Uses the Provider listing flow to create a provider-owned service with pricing and optional packages.

**Procedure:**

1. Open **Services** and select the action to add or edit a service.
2. Complete the service-information step, including category-specific information and photos where available.
3. Continue to pricing and configure the supported price/unit options.
4. Add packages or inclusions where supported by the category.
5. Review the listing and submit it for the available publication/review action.
6. Use the listing availability control to set a confirmed listing **Live** or **Not live** state when available.

**Screenshot:**  
[SCREENSHOT REQUIRED: PROVIDER SERVICE LISTING FLOW]  
*Figure A.14. Provider service listing and pricing*

**Expected Result:** The service remains provider-owned and uses the submitted price/options. Only a valid, approved, live listing is discoverable for client booking.

### A.8.4 Maintain availability and respond to booking requests

**Procedure:**

1. Open **Availability** and record unavailable periods or calendar availability as supported.
2. Open **Booking Requests**.
3. Select an event-grouped request, then open the individual booking details.
4. Review the requested event date/time, selected service options, client instructions, and booking amount.
5. Select the available accept or decline action. Provide a reason when declining if the form requests it.

**Screenshot:**  
[SCREENSHOT REQUIRED: PROVIDER BOOKING REQUEST DETAILS]  
*Figure A.15. Provider booking-request response*

**Expected Result:** The client receives the provider decision. Acceptance contributes to payment eligibility; decline allows the Client to locate an alternate service without duplicating the event.

### A.8.5 Manage catering and food tasting when the service offers it

**Description:** Food-tasting controls appear only for applicable catering bookings.

**Procedure:**

1. Open an accepted catering booking with food tasting.
2. Review the tasting schedule and proposed dish choices.
3. Use the available actions to respond to a schedule proposal, record attendance, or reschedule within the allowed workflow.
4. After the applicable tasting state is reached, use the menu-finalization control to retain the provider-approved number of dishes from the Client’s preliminary choices.
5. Submit the final menu.

**Expected Result:** The tasting schedule and final menu remain booking-specific. The final menu does not alter the historical preliminary selection outside the authorized workflow.

### A.8.6 Manage category-specific offerings

**Procedure:**

1. For Venue services, configure published package/hall/room options and their provider-defined rules.
2. For Florist services, use the arrangement, customization, package, and fulfillment editors available in the service flow.
3. For Photography or Videography, publish preset packages, coverage, deliverables, post-production commitments, and permitted add-ons; the current flow does not expose the removed generic configurator.
4. Save and review the listing before making it live.

**Expected Result:** Client selections use only provider-configured options and the resulting booking snapshot preserves the agreed configuration.

### A.8.7 Review performance, earnings, transactions, and notifications

**Procedure:**

1. Select **Reviews/Performance** to view eligible customer feedback and performance information.
2. Select **Payouts/Earnings** to review held/available amounts and submit a payout request only when the screen marks funds eligible.
3. Open a transaction for its transaction details.
4. Open **Notifications** to review or mark provider notices.
5. Use **Change Password** or profile controls as needed, then sign out.

**Screenshot:**  
[SCREENSHOT REQUIRED: PROVIDER EARNINGS OR PERFORMANCE SCREEN]  
*Figure A.16. Provider performance and earnings*

**Expected Result:** Provider payout availability follows the protected receivable, acceptance, event-window, and staff-controlled payout workflow. The displayed remaining client balance is not automatically treated as a platform payment.

---

## A.9 Troubleshooting

| Problem | Possible Cause | Recommended Solution |
|---|---|---|
| Unable to sign in | Incorrect credentials, email verification not completed, suspended/disabled account, or no connection. | Check the email and password, complete verification, use **Forgot Password** if necessary, and confirm connectivity. Contact MULTIVENT support for a suspension/disabled notice. |
| Registration does not continue | Required form fields, role/category selection, or terms acceptance are incomplete. | Review the highlighted fields, choose the required role or service category, accept the displayed terms, then submit again. |
| Provider remains on Pending Approval | The provider application has not yet been reviewed. | Wait for authorized marketplace review. Do not create duplicate provider accounts. |
| No services are shown | The selected category may have no active/live services, the data connection may be delayed, or filters are restrictive. | Use **Retry**, clear filters, confirm internet access, and try the category again. |
| Cannot continue after selecting a coordinator | A coordinator is required because the event was configured to use one. | Select an available coordinator, then return to the planning flow. |
| Cannot confirm payment | One or more providers or the required coordinator have not accepted yet. | Open Event Details, review the request statuses, and wait for the remaining authorized responses. |
| Payment remains pending after checkout | The processor return/webhook verification has not completed, or the payment failed. | Wait briefly on Event Details for the automatic status check. If the attempt failed, use **Retry payment** when shown. Do not create a duplicate event. |
| A provider declined a request | The provider cannot accept the requested booking. | In Event Details, select **Find alternate service**, compare an alternative, confirm the change, and send the replacement request. |
| Food-tasting finalization is unavailable | The booking is not an accepted food-tasting catering booking or its required schedule state has not been reached. | Review the accepted booking and food-tasting status. The provider should use the available attendance/schedule/finalization actions only when they appear. |
| Map or venue pin is unavailable | The device is offline, map configuration is unavailable, or location lookup returns only an address. | Check connectivity, reopen the map, place the pin again, and use the returned address when no registered place name is available. |
| An Admin feature is missing | The account lacks the role or permission, or the route is exclusive to Super Admin. | Contact a Super Admin to review the staff account’s permissions. Do not attempt to use another account’s credentials. |

## Documentation Note

All figure placeholders in this manual must be replaced with current, privacy-safe screenshots captured from the deployed MULTIVENT build before final manuscript submission. Do not include real client credentials, personal payment data, access tokens, or private booking information in manuscript screenshots.
