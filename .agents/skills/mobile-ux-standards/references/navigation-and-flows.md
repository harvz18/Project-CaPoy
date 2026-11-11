# Navigation and task flows

## Route and role audit

For each route, record the audience, entry points, primary task, completion destination, cancel/exit path, loading/empty/error/offline/unauthorized states, and any modal or deep-link variant. Include client, tasker, admin, superadmin, public, and unassigned-account behavior where relevant.

## Navigation rules

- A visible heading identifies the current place or task.
- Bottom-navigation destinations remain stable and the active state matches the current route, including nested routes.
- System Back and visible Back use project-safe history behavior and have a role-correct fallback when history is absent.
- Modal workflows expose a clear close or cancel action and restore the underlying context.
- Deep links validate required identifiers, show a recoverable missing/not-authorized state, and never strand the user.
- Avoid sending users through an unrelated dashboard merely to reach the next required step.
- Preserve query, filter, draft, and scroll context when returning to a list when practical.

## Journey review

Map the shortest understandable journey, not an arbitrary minimum tap count. Check prerequisites, returning-user shortcuts, failure/retry, help, and success confirmation. A journey is complete only when the user sees the confirmed outcome and an obvious next action.
