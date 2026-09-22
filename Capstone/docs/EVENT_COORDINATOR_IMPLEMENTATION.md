# Event Coordinator Workspace Implementation

Date completed: September 23, 2026

## Outcome

MULTIVENT now has a real role-specific workspace for accounts whose Supabase role is
`event_coordinator`. The old placeholder was replaced by
[`src/screens/23-Coordinator.tsx`](../src/screens/23-Coordinator.tsx).

The screen follows the app's burgundy, warm-neutral, Inter-based visual system and supports phone,
tablet, and web widths. It contains:

- an overview with active-event, attention-task, and completed-task totals;
- an upcoming assigned-event card with client, schedule, venue, provider, and task progress;
- an assigned-events view;
- open, due-now, and all-task filters;
- task completion and reopening;
- task creation with assigned event, notes, and due-date choices;
- pull-to-refresh, loading, failure, and genuine no-assignment states;
- coordinator-aware notifications; and
- explicit sign-out.

No sample event or task is shown as if it came from Supabase. If a coordinator has not been assigned
an event, the screen explains that clearly and offers a refresh action.

## Front-end connection

[`src/lib/coordinator.ts`](../src/lib/coordinator.ts) owns the Supabase mapping and operations:

- `fetchCoordinatorDashboard()` calls the protected dashboard RPC and validates its JSON result;
- `createCoordinatorTask()` creates a task only within an assigned active event; and
- `updateCoordinatorTaskStatus()` completes or reopens a task.

`src/App.tsx` already routed the `event_coordinator` role to `coordinatorHome`. It now loads this
workspace, refreshes it after task creation, updates task progress after status changes, routes the
notification bell to a coordinator variant of the notification screen, and clears coordinator state
on sign-out.

## Database security

Created and applied
[`database/19_event_coordinator_workspace.sql`](../database/19_event_coordinator_workspace.sql).
It adds:

- indexes for coordinator event schedules and task queues;
- RLS policies scoped to events where `events.coordinator_id = auth.uid()`;
- `get_coordinator_dashboard()`;
- `create_coordination_task(...)`; and
- `update_coordination_task_status(...)`.

The RPCs are `security definer` functions with explicit authenticated-role and assignment checks.
The dashboard may read a client's display name only for an event assigned to the caller. It does not
return client email, phone, unrelated events, or unrelated tasks.

## Creating a coordinator test account

Coordinator registration is intentionally not exposed as public self-signup. An administrator should
create the Auth account and grant the role.

1. In **Supabase Dashboard > Authentication > Users**, create or invite the coordinator.
2. Copy the new user's UUID.
3. Run the following in Supabase SQL Editor after replacing the placeholder UUID:

   ```sql
   update public.profiles
   set
     default_role = 'event_coordinator',
     account_status = 'active',
     updated_at = now()
   where id = 'COORDINATOR_USER_UUID';

   insert into public.user_roles (user_id, role_id)
   select 'COORDINATOR_USER_UUID', id
   from public.roles
   where name = 'event_coordinator'
   on conflict (user_id, role_id) do nothing;
   ```

4. Assign an existing event:

   ```sql
   update public.events
   set coordinator_id = 'COORDINATOR_USER_UUID', updated_at = now()
   where id = 'EVENT_UUID';
   ```

Only an administrator or trusted server process should perform these role and assignment updates.

## App test procedure

1. Reload the Expo app so it receives the new bundle.
2. Sign in through the existing login screen using an `event_coordinator` account.
3. Confirm the app opens the Coordinator Workspace automatically.
4. Pull down to refresh assigned events.
5. Select **New task**, choose an event, enter a task, select its deadline, and create it.
6. Open **Tasks** and select its checkbox to mark it complete. Select it again to reopen it.
7. Open the notification bell and return to the workspace.
8. Select the logout icon and confirm the app returns to role selection.

## Verification completed

- Migration 19 was applied to Supabase project `vkjmyyrxxzznbrgxzfyn`.
- All three coordinator RPCs and all three task RLS policies were verified live.
- A rollback-only database test loaded an assigned event, created a task, completed it, and removed
  every temporary change with `rollback`.
- The live database still had zero assigned events and zero coordinator tasks after the test.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build:web` passed.

The reusable rollback-only workflow check is
[`scripts/coordinator-smoke-test.sql`](../scripts/coordinator-smoke-test.sql).
