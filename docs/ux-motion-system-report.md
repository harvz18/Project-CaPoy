# TaskLink UX Motion System Report

## Scope

The motion pass covers every Expo route in `app/`, both role-specific web route variants, the separate administration portal, and shared user-facing controls. The full evidence matrix is in `docs/ux-motion-route-audit.csv`.

The implementation preserves TaskLink's Liquid Glass materials, Inter typography, authentication and authorization rules, Firebase/API behavior, data models, callbacks, and route structure. Motion is presentational and never gates a request, mutation, redirect, or workflow state.

## Central system

- `src/theme.ts` owns duration, distance, scale, stagger, easing, and spring tokens.
- `src/motion.ts` converts those tokens into React Native easing and reduced-motion-safe durations.
- `MotionPreferenceProvider` reads the operating-system preference once, distributes it through context, updates when the preference changes, and starts from a conservative reduced-motion default.
- `MotionPressable` supplies immediate tokenized press feedback without delaying `onPress`. Native uses the native driver; web uses its supported driver path.
- `MotionModal` preserves the existing native fade/slide choice and turns it off under reduced motion.
- `MotionReveal` is reserved for newly available feedback such as errors, offline/sync banners, and empty states.
- `useMotionLayout` handles short disclosures such as FAQ and application sections without the deprecated New Architecture layout-animation toggle.
- `RouteTransition` provides a restrained web crossfade and small directional shift for known tab routes. Native navigation remains the platform stack transition and non-tab web routes do not imply a false direction.

## Motion language

| Purpose | Token | Treatment |
|---|---:|---|
| Direct press feedback | 120 ms | subtle scale plus existing opacity |
| Selection or compact feedback | 160 ms | restrained opacity/indicator transition |
| Short disclosure or state change | 220 ms | bounded layout or opacity/translate |
| Navigation and overlay entry | 280 ms | platform transition or restrained crossfade/slide |
| One-time startup emphasis | 340 ms | truthful one-pass progress reveal |

Distances are capped at 8, 16, and 24 pixels; press scales are `0.98` or `0.99`; stagger tokens are bounded to 150 ms total and are not used on long or frequently updating lists.

## Screen coverage

All public, client, worker, shared, admin, and superadmin routes are recorded as implemented in the route audit. This includes authentication, dashboards, task creation/editing/details/status, jobs, chat, rating, profiles, notifications, reporting, help, all dialogs and sheets, global offline/sync/error feedback, and every administration section.

The administration portal uses matching CSS custom properties for duration, easing, travel, and scale. Its page entry, overlays, notices, controls, and loading placeholders use targeted transitions. The prior traveling skeleton shimmer was replaced with a calm opacity treatment.

## Intentionally static behavior

- Long lists, chat messages, tables, reviews, metric cards, and frequently updating data do not cascade or re-enter.
- Glass blur, gradients, large shadows, typography metrics, text wrapping, and field values are not animated.
- Form validation is announced and briefly revealed, while field geometry and entered values stay stable.
- A static treatment is used when motion would not clarify feedback, hierarchy, continuity, or truthful loading.

## Reduced motion and accessibility

- Expo native and web honor the OS reduced-motion preference through the shared provider.
- The admin portal honors `prefers-reduced-motion` with targeted zero-duration tokens, static skeletons, and disabled page/modal/notice animation.
- Content and controls remain mounted and operable in their final state; reduced motion never removes information or feedback.
- Press callbacks remain immediate, disabled/busy semantics remain intact, and modal dismissal targets do not visually compress.

## Verification

- Root and admin portal TypeScript checks: passed.
- Automated tests: 117 passed (83 workflow, 5 beta preflight, and 29 Cloud Functions).
- Expo web production export: passed.
- Expo Android production export: passed.
- Admin portal Vite production build: passed.
- Expo dependency compatibility check: passed; dependencies are up to date.
- Source audit: all route press targets use the shared motion primitive; all route modals use the reduced-motion-aware modal; screen-local press scale transforms were removed.
- Skill resource audit: all 17 packaged implementation, reference, checklist, and example files are present.
- Visual regression: the public login route was inspected in a headless browser at narrow and wide layouts. Its width now derives from the measured viewport on every platform rather than a web-only CSS calculation.
- Diff integrity check: passed, with only Git's existing LF-to-CRLF notices on Windows.

## Known limitations

- Native stack and modal timing is intentionally delegated to React Navigation and React Native, so exact curves can vary by operating system.
- Automated checks can verify implementation and build integrity but cannot replace hands-on vestibular-comfort testing on representative iOS and Android devices.
- The bundled skill validator requires the optional Python `yaml` package, which is absent locally. The installed skill resources and internal links are therefore validated directly without changing the user's global Python environment.
- `expo-doctor` could not start because its temporary npx installation was missing `@expo/env`. The project-local `expo install --check`, both Expo exports, TypeScript checks, and the complete test suite passed independently.
