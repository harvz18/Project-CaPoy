---
name: ux-motion-system
description: Design, audit, implement, and enforce purposeful mobile-first UX animation and transition standards across an entire app. Use for page and tab transitions, navigation gestures, press feedback, cards, modals, sheets, list updates, loading, skeletons, notifications, forms, state changes, and motion accessibility. Integrates with the project's existing Liquid Glass, Inter Typography, and Mobile UX Standards skills without changing business logic.
---

# UX Motion System — Project-wide Animation & Interaction Skill

## Purpose
Make the entire application feel **modern, responsive, cohesive, and physically understandable** by using animation to communicate cause, effect, hierarchy, continuity, loading, and progress. More movement is **not** better UX. Every animation must have a purpose, remain interruptible when applicable, and preserve immediate feedback.

**Activation:** Use when creating, modifying, auditing, or reviewing user-facing interaction, transitions, navigation, dynamic layout, data updates, async states, or shared components. For an explicit all-screen migration, audit every reachable route, role, overlay, and interaction state. For an isolated feature, work only in its scope.

**Non-goals:** Do not add decorative motion to every element; do not redesign visual branding; do not replace the navigation architecture or make unrelated business-logic changes; do not add libraries before inspecting the existing stack. Do not claim 60fps, accessibility conformance, or full-screen coverage unless verified.

## Relationship to companion skills
- `dark-liquid-glass-ui` (if present): owns translucent materials, colors, borders, highlights, and elevation. Animate **opacity/transform of a glass layer**, not blur radii/complex filter effects on every frame.
- `inter-mobile-typography`: owns Inter weights `400/500/600/700/800`, semantic sizes, and text reflow. Do not animate font-size/weight or break text scaling merely for motion.
- `mobile-ux-standards`: owns interaction correctness, navigation predictability, truthful states, error recovery, and accessibility. Motion reinforces those requirements and never overrides them.
- Explicit user needs, security, performance, accessibility, and platform conventions take precedence over decorative goals.

## REQUIRED workflow
1. **Inventory:** Inspect framework and installed packages, router, nav stacks, gestures, animation APIs, accessibility preferences, existing theme, shared components, all screens/roles/states. Read `references/screen-coverage.md` and use `checklists/motion-audit-template.csv`.
2. **Map semantics:** For each action, specify *event → state change → feedback → completion/recovery*. Distinguish tab switch, drill-down, back, modal, inline change, loading, data refresh, and error.
3. **Establish tokens:** Create centralized timing, easing, spring, distance, scale, and stagger tokens based on `references/motion-foundations.md`. Keep a reduced-motion path for every applicable pattern.
4. **Implement shared primitives:** Prioritize navigation, press feedback, overlays, forms, list updates, async states; reuse existing UI components. Read `references/components-and-feedback.md` and `references/navigation-and-transitions.md`.
5. **Add feature-level transitions:** Add only where transition clarifies a user action or maintains context. Never animate all screen contents on every render. Support interruption, cancellation, back, and re-entry. Read `references/gestures-and-interruptions.md`.
6. **Validate:** Test normal and reduced motion; slow CPU/device; small screen; long text; keyboard; screen reader; rapid back/tap; network failure; background/resume. Read `references/accessibility-and-performance.md` and `checklists/acceptance-checklist.md`.
7. **Report:** Identify changed screens/components; new tokens; animations that were deliberately omitted; screenshots/videos or device checks actually performed; outstanding issues. Do **not** say "applied to all screens" without route-by-route evidence.

## Canonical motion tokens (recommended project defaults, not universal standards)

| Token | Default | Examples |
|---|---:|---|
| `instant` | 0ms | Reduced-motion spatial movement, immediate state |
| `feedback` | 90–140ms | Press in/out, icon state, hover highlight |
| `quick` | 140–190ms | Chip selection, toggle, indicator |
| `standard` | 180–260ms | Inline expand, small popover, card content |
| `navigation` | 220–320ms | Push/pop, tabs (usually shorter), primary route change |
| `overlay` | 220–340ms | Modal, sheet entrance/exit |
| `emphasis` | 280–380ms | One-time meaningful state reveal |
| `stagger` | 25–45ms per item, max ~150ms total | Small grouped introductions only |

Keep frequent interactions faster than infrequent transitions. These are **design targets**, not claims that the OS or native navigation always obeys them. Prefer OS-native navigation transitions when available. Avoid >400ms for routine UI transitions unless a platform pattern or tested usability need justifies it.

**Easing:** `standard` cubic-bezier(0.2,0,0,1); `enter` cubic-bezier(0,0,0.2,1); `exit` cubic-bezier(0.4,0,1,1). Tune to context; spring motion for direct manipulation, critically damped/non-bouncy for panels, destructive actions, and data-heavy views. Spring settings are engine-specific: do not copy numbers across frameworks as if physically equivalent.

**Movement:** press scale about `0.98`; short reveal translate `6–12px`; overlays usually `12–24px` or their actual edge; full-screen transitions follow platform navigator. Favor **opacity + transform**. Do not animate backdrop-filter blur, box-shadow, font metrics, or large layout regions continuously.

## Signature motion patterns to standardize

| Surface | Trigger & motion | Must preserve |
|---|---|---|
| **Pressable button** | Immediate press acknowledgment: subtle scale/shade, reverses on release/cancel | No delayed onPress; disabled/loading states |
| **Bottom navigation** | Active pill/indicator glides subtly; icon/text changes without dramatic bounce | Route accuracy; hit targets; no covering content |
| **Top tabs / segment** | Indicator translates to new selection; content updates promptly | Keyboard/focus; reduced-motion fallback |
| **Stack push / back** | Platform-consistent directional spatial relationship; back reverses | Native back/swipe gestures, history, RTL |
| **Modal/dialog** | Fade + short rise/scale; backdrop dims together | Focus trap/restoration; ESC/Back; no lost data |
| **Bottom sheet** | Enters from bottom, drag tracks finger, release settles or dismisses | Scroll conflict, safe area, cancel, accessibility |
| **Card → detail** | Optional subtle continuity or shared-element only when robustly supported | State, back behavior, long content, fallbacks |
| **Accordion/filter** | Short expansion with stable content location | No clipped form controls/focus; immediate state |
| **List mutations** | Animate inserted/removed item once; stable IDs | No content jumps, screen-reader announcement |
| **Form validation** | Subtle border/message reveal, no aggressive shaking | Clear error text, retained input, focus management |
| **Loading** | Prompt state indication; skeleton geometry matches content | Honest server state; no fictitious progress |
| **Success/error** | Small, restrained check/status transition; important actions show textual outcome | Never claim success before confirmation |
| **Toast** | Short enter/exit; persists long enough or stays until dismissed for important messages | Accessible announcement and dismiss controls |
| **Pull to refresh** | Native/platform indicator follows gesture; success updates data | No fake refresh; cancellation and errors |
| **Scroll** | Normal native scroll; optional restrained sticky headers | No mandatory parallax, auto-scrolling, or scroll hijacking |

### Do **not**
- Animate every card on every visit or rerender; auto-play repeated bouncing/glowing/looping UI; stagger dozens of items; use large parallax or full-screen zoom by default.
- Delay navigation, submission, or error messages until an animation ends when it is unnecessary.
- Start animation without an actual trigger, including on background data refresh where it distracts from current work.
- Make button presses cause multiple requests; block cancellation; override OS back gestures; remove focus outlines; hide error text behind animations.
- Use a skeleton for a known empty state, or a progress bar implying a percentage not backed by progress data.
- Animate opacity to zero on critical content with no fallback for low-power/reduced-motion modes.

## Accessibility — hard requirements
- Respect OS/browser reduced-motion preferences. On web use `@media (prefers-reduced-motion: reduce)`; on React Native query `AccessibilityInfo.isReduceMotionEnabled()` and subscribe to changes or use an installed library's equivalent. Replacing spatial movement with instant changes or brief non-spatial fades is acceptable if tested.
- Moving/auto-updating content must meet applicable WCAG controls for pause/stop/hide, including the specific requirements of WCAG 2.2 SC 2.2.2. Avoid flashing and repetitive sweeping light effects.
- Motion must not be the only way status, order, selection, or error is communicated; supply text, focus state, and accessibility announcements as appropriate.
- When an overlay appears, manage focus and background interaction; when dismissed, restore focus where appropriate. Ensure enlarged Inter text and screen-reader content do not jump or clip.
- Do not disable necessary native accessibility animations solely for visual consistency.

## Performance — hard requirements
- Prefer compositor-friendly properties (typically opacity/transform on web), native-driver or UI-thread animations for supported RN properties, and stable layout IDs.
- Keep layered glass blur static during motion; animate a wrapper's transform/opacity instead of recomputing blur every frame.
- Virtualize long lists; avoid entrance animations on 100+ rows; bound simultaneous animations and stagger.
- Avoid forced layout reads/writes per frame, oversized repaints, continuous gradients, repeated layout measurement, and unnecessary rerenders.
- Test low-end Android/device throttling and navigation under network load when available; optimize or remove motion if it compromises input response.

## Framework implementation — choose only the path actually used
- **Web (React/TypeScript/CSS):** shared CSS custom properties, transitions, keyframes sparingly. Optional View Transitions API with feature detection and fallback; browser support and framework integration vary. Read `references/framework-implementation.md`; see `examples/web/`.
- **React Native / Expo:** retain native-stack/Expo Router defaults where possible; use RN `Animated` for simple press feedback; adopt Reanimated/Gesture Handler only when already installed, compatible, or strictly needed. Never paste CSS filters into RN. Read `references/framework-implementation.md`; see `examples/react-native/`.
- **Other frameworks:** adapt the same semantics through native facilities; do not import these examples blindly.

## Reference files
- `references/motion-foundations.md`: principles, timing/easing, motion hierarchy, spatial vocabulary.
- `references/navigation-and-transitions.md`: routes, tabs, back, sheets, dialogs, shared-element.
- `references/components-and-feedback.md`: buttons, cards, controls, forms, menus, feedback.
- `references/gestures-and-interruptions.md`: drags, swipes, cancellation, concurrency, RTL.
- `references/loading-and-data.md`: skeletons, progressive states, errors, optimistic updates.
- `references/accessibility-and-performance.md`: reduced motion, WCAG, rendering safeguards, QA.
- `references/framework-implementation.md`: web, React Native, Expo Router and library decisions.
- `references/screen-coverage.md`: app-wide coverage, state inventory and rollout.
- `checklists/acceptance-checklist.md`: completion gates and manual validation script.
- `checklists/motion-audit-template.csv`: route/interaction inventory template.

## Definition of done
For every requested route or component: an interaction contract exists; motion tokens are reused; feedback occurs immediately; navigation and async states remain correct; reduced motion works; the sequence can be interrupted appropriately; performance is acceptable on tested targets; QA evidence and unresolved limitations are reported. A route without any animation may be **correct** if motion would provide no UX benefit.

## Authoritative references
- W3C animation from interactions (WCAG AAA): https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions
- W3C pause/stop/hide (WCAG A): https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide
- MDN reduced motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- MDN View Transitions API: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- React Native accessibility: https://reactnative.dev/docs/accessibilityinfo
- React Native animations: https://reactnative.dev/docs/animations
- Expo Router stack: https://docs.expo.dev/router/advanced/stack/
- Material motion duration context (historic, not mandatory tokens): https://m1.material.io/motion/duration-easing.html
