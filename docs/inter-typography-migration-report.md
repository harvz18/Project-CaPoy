# TaskLink Inter Typography Migration

## Installed project skill

- Installed the supplied skill at `.agents/skills/inter-mobile-typography/`.
- Preserved its `SKILL.md`, `references/tokens-and-mapping.md`, `examples/react-native-typography.ts`, and `examples/web-tokens.css`.
- Added the project-root `AGENTS.md` without changing the existing dark-liquid-glass skill. Future TaskLink UI work is instructed to use both complementary skills.
- The bundled `quick_validate.py` validator could not run because the available Python environment does not include `PyYAML`. The folder name, YAML frontmatter, required files, references, and examples were checked manually.

## Font registration

- Added `@expo-google-fonts/inter` to the main Expo project and standalone admin portal.
- The Expo root layout loads exactly `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`, and `Inter_800ExtraBold` through `expo-font` at runtime. This method works in Expo Go, Android, iOS, and web.
- Startup waits on a non-text loading state while fonts load and continues with platform fallback if font loading reports an error, avoiding an indefinite blank screen.
- The admin portal defines five local `@font-face` entries from the installed package. Its production build emitted all five font assets; it does not depend on a font CDN.

## Centralized typography API

`src/typography.ts` defines the approved Inter families and these semantic roles:

- `screenTitle`
- `sectionTitle`
- `sectionTitleSmall`
- `cardTitle`
- `cardTitleStrong`
- `inputText`
- `body`
- `bodyMedium`
- `price`
- `button`
- `fieldLabel`
- `metadata`
- `caption`
- `badge`
- `bottomNav`
- `overline`
- `heroNumber`

`AppText` and `AppTextInput` apply accessible defaults and allow existing semantic styles to override them. Text scaling remains enabled. `src/theme.ts` re-exports the token system for compatibility.

## Screen coverage

| Surface | Sources | Status |
| --- | --- | --- |
| Root shell, loading, global banners/dialogs | `app/_layout.tsx` | Updated |
| Splash, login, registration, role selection | `app/index.tsx`, `login.tsx`, `register.tsx`, `role-selection.tsx` | Updated |
| Client and worker dashboards | `app/client-dashboard.tsx`, `worker-dashboard.tsx` | Updated |
| Jobs and task flows | `app/jobs.tsx`, `task/[id].tsx`, `task-status/[id].tsx`, `post-task.tsx`, `edit-task/[id].tsx` | Updated |
| Chat inbox and conversation | `app/chat/index.tsx`, `chat/[id].tsx` | Updated |
| Profile, public worker profile, rating | `app/profile.tsx`, `worker-profile/[id].tsx`, `rating/[id].tsx` | Updated |
| Notifications, help, report user | `app/notifications.tsx`, `help.tsx`, `report-user.tsx` | Updated |
| Native and web staff routes | `app/admin.tsx`, `admin.web.tsx`, `superadmin.tsx`, `superadmin.web.tsx` | Updated |
| Standalone staff portal | `admin-portal/src/main.tsx`, `admin-portal/src/styles.css` | Updated |

## Shared component coverage

- Migrated buttons, inputs, badges, empty/error states, date-time sheets, maps, shortcuts, bottom navigation, and staff dashboard components.
- Replaced direct React Native `Text` and `TextInput` usage in TaskLink UI with the shared Inter-aware wrappers.
- Preserved colors, glass materials, lighting, radii, borders, shadows, navigation, APIs, authentication, Firebase behavior, and business logic.

## Consistency audit

- React Native font size, line height, family, and weight declarations now live only in `src/typography.ts`.
- No unsupported `100`, `200`, `300`, or `900` UI font weights remain.
- Forced uppercase transformations were removed so displayed casing follows the actual copy.
- Admin typography uses centralized CSS variables. Raw numeric weight declarations remain only in the five authorized `@font-face` registrations.
- Existing icon libraries and non-text image sizing were not changed.

## Verification

- Main TypeScript check: passed.
- Admin portal TypeScript check: passed.
- Workflow regression tests: 83 passed.
- Beta-preflight tests: 5 passed.
- Cloud Functions tests: 29 passed.
- Expo web export: passed; all five Inter font assets emitted.
- Expo Android export: passed; all five Inter font assets included in the bundle.
- Admin portal Vite production build: passed; all five Inter font assets emitted.
- Expo Doctor: 20/20 checks passed.
- Responsive login smoke tests: passed at true `360×800` and `430×932` CSS viewports. Fonts reported loaded, rendered TaskLink text resolved to Inter, and inspected content wrapped without overlap or clipping.

## Remaining checks and known warnings

- Authenticated client, worker, admin, and superadmin screens were compiled, statically audited, and regression-tested, but were not visually traversed with live accounts in this pass.
- A real-device pass with Android system font scaling increased is still recommended for keyboard, map, and long-data edge cases; the shared wrappers leave scaling enabled and do not cap the multiplier.
- Expo web export continues to show the existing non-fatal Leaflet CSS image warnings. Metro also discarded an incompatible cache entry and completed a full crawl successfully.
- No lint script is configured in either package.
- npm reports existing dependency advisories in the main and admin dependency trees; automated audit fixes were not applied because they are outside this typography-only scope and may introduce breaking changes.
