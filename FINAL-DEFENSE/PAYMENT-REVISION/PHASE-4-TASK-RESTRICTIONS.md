# Phase 4 — Task Restrictions

## Delivered

Phase 4 enforces the TASKLINK service-fee policy without disrupting existing task flows.

- New task publishing is blocked only while an employer has a service fee in `pending_payment`, `submitted_for_review`, or `rejected` status.
- The posting screen explains the restriction with the required message and provides an **Open outstanding fee** action that goes directly to the relevant payment screen.
- The restriction is enforced by Firestore rules through a server-maintained employer lock count, not by the UI alone. Trusted fee workflows create, reconcile, and release that count.
- A fee created when a worker is selected adds the employer lock. A verified fee removes it. Cancelling a task also releases the lock when the fee leaves a posting-blocking state.
- Before showing the posting form, the trusted API reconciles older fee records so accounts with historical unpaid fees are also covered.
- Starting active work (`Accepted` to `In Progress`) and marking a task finished require the task's platform fee to be `verified` when a fee record exists.
- Tasks with no platform-fee record remain able to progress. This preserves historical tasks and prevents unavailable fee configuration from breaking existing work.

## Explicitly not restricted

This phase does not block login, profile access, messaging, cancellations, payment settlement, disputes, or access to existing tasks. It also does not begin Phase 5, automated reminders, or escalation work.

## Verification

- `node --check admin-api/server.js` — passed
- `node --check functions/index.js` — passed
- `npm.cmd --prefix functions test` — passed (35 tests)
- `npm.cmd run typecheck` — passed
- `npm.cmd --prefix admin-api test` — passed (4 tests)
- `npm.cmd run test:workflow` — passed (100 tests)
- `npm.cmd run build:web` — passed
- `firebase emulators:exec --only auth,firestore,storage "npm.cmd run test:rules"` — passed (53 tests)
- `git diff --check` — passed

## Main files changed for this phase

- `firestore.rules`
- `functions/index.js`
- `functions/revenue.js`
- `functions/revenue.test.js`
- `admin-api/server.js`
- `admin-api/test/server.test.js`
- `src/context/AppContext.tsx`
- `src/services/platformRevenueService.ts`
- `src/types.ts`
- `app/post-task.tsx`
- `tests/firestore.rules.test.cjs`
