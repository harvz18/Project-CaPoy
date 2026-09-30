# TaskLink Administrator Analytics Metric Dictionary

Version: 1  
Reporting timezone: `Asia/Manila` (UTC+08:00)  
Audience: users with Firebase `admin` or `superadmin` custom claims

This document defines the Phase 6 beta dashboard metrics. The dashboard must use the trusted `getAdminAnalytics` callable Function and its sanitized `analyticsSnapshots` output. It must not recreate these metrics by downloading private collections to a browser or mobile device.

## Date ranges

- `Today` covers midnight through the current Manila calendar day.
- `Last 7 days` and `Last 30 days` include today and the preceding 6 or 29 Manila calendar days.
- `Custom` accepts inclusive `YYYY-MM-DD` start and end dates, up to 366 days.
- Internally, every range is `[startAt, endAtExclusive)`. For example, 2026-10-01 begins at `2026-09-30T16:00:00.000Z` and ends at `2026-10-01T16:00:00.000Z`.

## Current snapshots

These values describe current state and do not change when the activity date filter changes.

| Metric | Definition | Trusted source |
| --- | --- | --- |
| Employers | Unique `users` documents whose role is `client`. | `users` |
| Taskers | Unique `users` documents whose role is `worker`. | `users` |
| Active accounts | Employer/tasker accounts with `active`, `pending_verification`, or a missing legacy `accountStatus`. | `users` |
| Restricted accounts | Employer/tasker accounts with `suspended` or `deleted` status. | `users` |
| Verification states | Unique verification requests in Pending Verification, Verified, Rejected, or Needs Resubmission state. | `verificationRequests` |
| Task inventory | Unique tasks grouped by their current lifecycle status. | `tasks` |

## Period activity

| Metric | Definition | Event time |
| --- | --- | --- |
| Posted | Unique tasks created in the selected period. | `task.createdAt` |
| Matched | Distinct task IDs represented by application/match records created in the selected period. | `taskMatch.createdAt` |
| Applications | Unique application/match records created in the selected period. | `taskMatch.createdAt` |
| Accepted | Unique tasks accepted in the selected period. | `task.acceptedAt` |
| Completed | Unique tasks finished in the selected period. | `task.finishedAt` |
| Cancelled | Unique tasks cancelled in the selected period. | `task.cancelledAt` |
| Disputed | Unique tasks disputed in the selected period. | `task.disputedAt` |
| Tasks by category | Posted tasks in the selected period, grouped by normalized category; a blank category is `Uncategorized`. | `task.createdAt` |

`Matched` is a distinct-task measure; `Applications` is an application-record measure. One task can therefore produce several applications but contributes only one matched task.

## Payments

Payment counts use unique payment records whose `createdAt` falls in the selected period, grouped as Pending, Submitted, Verified, or Rejected. `Unresolved reviews` counts GCash-link payment records in that period that remain Submitted.

These are workflow evidence states, not bank settlement or revenue figures. TaskLink does not claim that a Submitted or Verified evidence record proves an external transfer settled.

## Matching and geofence telemetry

Matching telemetry is available only after trusted matching notifications carry a numeric `matchPolicyVersion`. Until then, the dashboard shows unavailable values rather than fabricated zeros.

| Metric | Definition |
| --- | --- |
| Eligible taskers per posted task | Matching notifications linked to the period's posted-task cohort divided by the number of posted tasks. Each notification represents one trusted eligible-tasker selection. No posted tasks produces unavailable, not zero. |
| Notifications sent | Unique Matching task notifications created in the selected period. |
| Opened | Period notification cohort with `openedAt`. |
| Converted | Period notification cohort with `applicationConvertedAt`. |
| Open rate | Opened divided by sent, as a percentage. An empty denominator is unavailable. |
| Conversion rate | Converted divided by sent, as a percentage. An empty denominator is unavailable. |
| Average minutes to first application | For tasks posted in the period, elapsed minutes from task creation to their earliest valid application at or after creation. Tasks without an application are excluded from the average. |
| Average minutes to acceptance | For tasks accepted in the period, elapsed minutes from task creation to acceptance. Missing or invalid timestamps are excluded. |

The daily series places posted, application, acceptance, completion, and notification events on their own Manila event dates. A conversion is placed on its `applicationConvertedAt` date.

## Reliability and privacy rules

- Inputs are deduplicated by Firestore document ID before counting, so a repeated Function read or retry cannot increment a metric twice.
- A snapshot ID is deterministic for metric version and selected dates: `v<version>_<start>_<end>`. Refreshing the same range replaces that sanitized snapshot.
- The callable Function reads private source records with the Admin SDK, but returns and stores aggregates only.
- Analytics output must not contain names, email addresses, phone numbers, user IDs, task IDs, exact coordinates, identity-document links, payment-proof links, or message content.
- Firestore permits snapshot reads only to custom-claim administrators and superadministrators. Client writes are denied; only trusted server code can materialize a snapshot.
- Loading, unavailable, and stale/generated-at states are displayed explicitly. Missing telemetry is represented by `null`, not a misleading numeric zero.

## Beta scaling note

Version 1 creates an on-demand, sanitized snapshot by reading the required collections on the trusted server. This is appropriate for the current small beta and avoids exposing private data to clients. Before a larger production launch, replace full collection reads with idempotent event documents and incremental daily aggregates, while retaining this metric dictionary and its privacy constraints.

## Deployment note

The dashboard and Firestore protection can be shipped without enabling billing. The `getAdminAnalytics` callable itself requires a Firebase Functions deployment. If the Firebase project remains on the Spark plan, the online dashboard must report analytics as unavailable until the owner deliberately enables a Functions-capable plan; no billing change should be made automatically.
