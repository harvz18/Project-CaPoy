# TaskLink Dark Liquid Glass Migration

Primary visual references: the two mobile screenshots supplied in the implementation request. They are available in the conversation but are not stored as repository assets.

## Protected functional boundaries

The migration is presentation-only. Preserve `src/context/**`, `src/services/**`, `src/domain/**`, `src/utils/**`, `src/types.ts`, `functions/**`, Firebase configuration/rules, route names, authentication/authorization, validation, data models, and existing user interactions.

## Screen inventory

| Surface | Source | Entry/role and important states | Status |
| --- | --- | --- | --- |
| Root shell | `app/_layout.tsx` | All roles; loading, offline, sync error, global action-error dialog | Updated; static review complete |
| Splash | `app/index.tsx` | Public startup | Updated; static review complete |
| Login | `app/login.tsx` | Public; validation, auth error, loading | Updated; web visual smoke test complete |
| Registration | `app/register.tsx` | Public; validation, loading, error | Updated; static review complete |
| Role selection | `app/role-selection.tsx` | Authenticated unassigned user; selected/loading/error | Updated; static review complete |
| Client dashboard | `app/client-dashboard.tsx` | Client; summaries, task lists, empty states | Updated; static review complete |
| Worker dashboard | `app/worker-dashboard.tsx` | Worker; applications, history, jobs, empty states, full-screen map modal | Updated; static review complete |
| Jobs | `app/jobs.tsx` | Worker; nearby/list/filter/map results and empty states | Updated; static review complete |
| Task details | `app/task/[id].tsx` | Client/worker; missing task, applications, errors, actions | Updated; static review complete |
| Task status | `app/task-status/[id].tsx` | Client/worker; progress, tracking, payments, warnings, GCash and cancellation dialogs | Updated; static review complete |
| Post task | `app/post-task.tsx` | Client form; date picker, validation, loading | Updated; static review complete |
| Edit task | `app/edit-task/[id].tsx` | Client form; missing task, validation, loading | Updated; static review complete |
| Chat inbox | `app/chat/index.tsx` | Authenticated; conversations and empty state | Updated; static review complete |
| Conversation | `app/chat/[id].tsx` | Authenticated; loading older, messages, composer, errors | Updated; static review complete |
| Profile | `app/profile.tsx` | Authenticated; summary, editable form, verification/upload states | Updated; static review complete |
| Worker public profile | `app/worker-profile/[id].tsx` | Authenticated; missing worker, stats, reviews, report action | Updated; static review complete |
| Rating | `app/rating/[id].tsx` | Completed-task participant; form, validation, loading | Updated; static review complete |
| Notifications | `app/notifications.tsx` | Authenticated; unread/read and empty state | Updated; static review complete |
| Help | `app/help.tsx` | Public/authenticated information and support actions | Updated; static review complete |
| Report user | `app/report-user.tsx` | Authenticated form; validation/error/loading | Updated; static review complete |
| Native admin | `app/admin.tsx` | Admin; metrics, reports, users, empty/error/action states | Updated; static review complete |
| Web admin | `app/admin.web.tsx` + `src/components/StaffWebDashboard.tsx` | Admin desktop tabs, tables/forms, error/empty/loading actions | Updated; static review complete |
| Native superadmin | `app/superadmin.tsx` | Superadmin; reports, accounts, audit, empty/error/action states | Updated; static review complete |
| Web superadmin | `app/superadmin.web.tsx` + `src/components/StaffWebDashboard.tsx` | Superadmin desktop tabs, moderation forms, error/empty/loading actions | Updated; static review complete |
| Separate admin portal | `admin-portal/src/main.tsx`, `auth.tsx`, `styles.css` | Staff web login, dashboard, tables, filters, forms, empty/error states | Updated; production build complete |

## Shared UI inventory

| Family | Sources | Status |
| --- | --- | --- |
| Theme, common styles, screen shell, background | `src/theme.ts`, `src/styles.ts`, `ScreenContainer.tsx`, `LiquidGlassBackdrop.tsx` | Updated and reviewed |
| Buttons, cards, inputs, badges, empty states | `AppButton.tsx`, `AppCard.tsx`, `AppInput.tsx`, `StatusBadge.tsx`, `EmptyState.tsx` | Updated and reviewed |
| Mobile navigation and icons | `AnimatedBottomNav.tsx`, `BottomNavIcon.tsx` | Updated and reviewed |
| Global shortcuts | `HelpShortcut.tsx`, `NotificationShortcut.tsx` | Updated and reviewed |
| Overlays and feedback | `DateTimePickerSheet.tsx`, `AppErrorBoundary.tsx`, root dialogs/banners | Updated and reviewed |
| Maps | `LocationMap.tsx`, `LocationMap.native.tsx`, `LocationMap.web.tsx` | Updated and reviewed |
| Motion | `RouteTransition.tsx` | Reviewed; existing behavior preserved |

## Verification record

- Central dark navy, cyan/teal lighting, glass material, border, radius, shadow, typography, motion, and semantic-state tokens are implemented in `src/theme.ts` and shared components.
- All routed screens and both staff web surfaces were migrated. A legacy-style scan found no remaining white page/card backgrounds, charcoal-on-light text tokens, or the previous pastel surface colors in `app/**` and `src/components/**`.
- The client dashboard, worker dashboard, profile, glass inputs/cards, and active bottom navigation received reference-specific refinements based on the supplied screenshots.
- Protected functional paths (`src/context/**`, `src/services/**`, `src/domain/**`, `src/utils/**`, `functions/**`, Firebase rules) have no presentation-migration diffs.
- `npm run typecheck`: passed.
- Workflow tests under Node 22: 83 passed.
- Beta-preflight tests: 5 passed.
- Cloud Functions tests: 29 passed.
- Main Expo web export: passed (1,019 modules). Existing Leaflet local-image CSS warnings remain non-fatal.
- Expo Android export: passed (1,446 modules, Hermes bundle generated).
- Standalone `admin-portal` Vite production build: passed (1,612 modules).
- Fresh headless web smoke test confirmed the corrected opaque navy canvas and translucent cyan glass surfaces on the public login route.

## Remaining runtime checks

- Authenticated screens were reviewed statically and compiled/tested, but were not stepped through with real client, worker, admin, and superadmin accounts during this pass.
- A final hands-on visual check in Expo Go on the target Android device is still recommended because device fonts, safe areas, keyboard behavior, maps, and GPU blur/compositing can differ from web rendering.
- Remote push notifications remain unavailable in Expo Go on Android for current Expo SDKs; that existing platform limitation requires a development build and is unrelated to the UI migration.
