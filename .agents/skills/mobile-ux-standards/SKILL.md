---
name: mobile-ux-standards
description: Audit, design, and implement consistent mobile-first user experience across all application routes and components. Use for screen creation, UX reviews, navigation, forms, search, task flows, feedback, loading/empty/error states, accessibility, or application-wide UX improvements. Follow the existing visual design and typography systems; this is a behavioral UX skill, not a visual rebrand.
---

# Mobile UX Standards — Project-wide UX Skill

## Purpose and scope
Provide one repeatable, evidence-informed set of UX rules for **every existing and future screen** of a mobile-first app (including its web and tablet adaptations). Optimize task completion, clarity, predictable navigation, error recovery, trust, and accessibility. Do **not** confuse a visually attractive UI with a verified usable product.

**Activation:** Use during planning, implementing, reviewing, refactoring, or QA of any user-facing screen, navigation path, interactive component, form, flow, or error state. When invoked for an application-wide migration, inspect every reachable route and role. When invoked for a single component, keep the change appropriately scoped.

**Non-goals:** Do not change product requirements, permissions, pricing, workflows, backend/API integrations, or branding without authorization. Do not invent functionality or user research. Do not claim WCAG compliance, usability-test success, or cross-device validation unless verified.

## Source hierarchy and conflict resolution
1. Security, correctness, safety, privacy, legal obligations, accessibility, and explicit user requirements.
2. Documented project flows and user-researched needs.
3. Platform behavior and established conventions (iOS, Android, web).
4. This skill's interaction standards and quality gates.
5. Existing visual and typography skills (for example `dark-liquid-glass-ui` and `inter-mobile-typography`) for colors, materials, font family, sizing, and geometry.

If standards conflict, satisfy higher priorities while retaining visual identity where possible. For a glass design, strengthen the surface behind text before reducing legibility. Treat 10–11px visual navigation labels as a compact design choice, **not** permission to block text scaling or shrink the hit area.

## Implementation workflow — follow in order
1. **Audit:** Read app architecture, routes, layouts, navigation stacks, roles, shared components, themes, user flows, permissions, and screen states. Inventory *every* existing screen; use `checklists/route-audit-template.csv`. Include conditional/modal/deep-link screens and auth/role variations. Identify whether web, React Native, native iOS/Android, or mixed; do not assume CSS works on native.
2. **Map tasks:** For each role, list top user goals and the shortest *understandable* journey from entry to success. Identify prerequisites, exceptions, returning-user paths, help, and failure/retry. Do not impose arbitrary tap-count thresholds. Read `references/navigation-and-flows.md`.
3. **Review:** Score severity and evidence for friction, unclear labels, hidden actions, errors, missing states, inaccessible controls, or lost user progress. Use `checklists/ux-review-checklist.md` and `references/ux-evaluation.md`.
4. **Design fixes:** Prefer localized, reversible changes that use existing shared components. Plan state transitions and acceptance tests. Preserve actual data and business rules. Read topic-specific references below.
5. **Implement:** Centralize UX behavior in shared components/hooks/services where appropriate (consistent back behavior, feedback, form errors, skeletons, empty states). Don't rewrite unrelated features. Track route coverage.
6. **Validate:** Test essential journeys and all component states on at least a narrow mobile viewport plus relevant platform(s), assistive tech, text scaling, keyboard, slow/offline network, and screen reader when available. Run existing automated checks. Record **tested / not tested / blocked** honestly.
7. **Report:** Summarize screen inventory, changes by route, decisions, preserved behavior, test evidence, known risks, and next priorities. Never declare project-wide completion from a few sample screenshots.

## Non-negotiable interaction rules
- **Discoverability:** Primary task and next action are obvious. Give each view a meaningful heading. Use labels users understand; avoid jargon and ambiguous icons.
- **Visibility of state:** Any user action has perceptible feedback (pressed/loading/success/error). Distinguish pending vs completed vs failed. Never show success before a confirmed server response.
- **Navigation:** Stable destinations; back goes somewhere predictable; active tab matches route; preserve filter/scroll state when reasonable; reachable exit/cancel; deep links and system Back supported.
- **Consistency:** Same action => same label, placement, behavior, loading, and error pattern throughout the app, unless a documented contextual exception exists.
- **Error prevention/recovery:** Validate at appropriate times; keep entered data on failure; actionable error near its field; confirm high-impact irreversible actions; offer undo when feasible; prevent accidental duplicate submission.
- **Content hierarchy:** Show critical information and next action first, then detail. Progressive disclosure must never hide essential fees, constraints, permissions, statuses, or deadlines.
- **Touch and input:** Ensure comfortable touch regions; use native keyboard types, autocomplete, autofill, and appropriate input modes. Don't rely on hover, gesture-only actions, or color alone.
- **Responsiveness:** Prevent overlap/clipping with text zoom, soft keyboard, safe areas, small viewports, and changing orientation. Bottom navigation must never cover fields or actions.
- **System states:** Each data-dependent screen considers initial, loading, loaded, empty, error, offline, unauthorized, and refreshing states as relevant.
- **Trust:** Plain-language permissions and outcomes; transparent totals/fees where applicable; sensible privacy defaults; no dark patterns, forced urgency, or deceptive opt-ins.
- **Performance:** Minimize needless requests and visual blocking; perceived progress must be truthful. Avoid disabling the entire page when only one region is loading.

## Standards to apply (not interchangeable units)
- **Web accessibility:** Aim for WCAG 2.2 **AA**. WCAG 2.2 SC 2.5.8 minimum pointer-target size is **24×24 CSS px** with exceptions, *not* a universal mobile-touch recommendation. For comfortable mobile touch, consider **44×44 CSS px** as an internal product target where feasible (a design recommendation, not a WCAG 2.2 AA requirement).
- **iOS:** Apple HIG generally recommends **44×44 pt** hit regions for buttons.
- **Android:** Android guidance recommends **48×48 dp** touch targets.
- **Contrast:** For web WCAG AA, normal text **4.5:1**, large text **3:1**; check actual rendered composite background (especially transparent glass). Non-text UI components and state indicators also need appropriate perceptibility and semantic alternatives.
- **Motion:** Respect prefers-reduced-motion / platform accessibility settings. Never animate essential information in a way that prevents access.
- **Localization:** Preserve actual locale/currency/date formats and dynamic text lengths; do not assume English-only strings or single-line labels.

See `references/accessibility-and-platform.md` for tests and distinctions.

## References — load only for tasks that need them
- `references/heuristics-and-principles.md`: ten usability heuristics, human-centered practice, information priority.
- `references/navigation-and-flows.md`: IA, navigation, task journeys, search/filter/list/detail, roles, back stack, deep links.
- `references/forms-and-transactions.md`: input design, validation, step flows, pricing/booking/payment, destructive actions.
- `references/feedback-and-states.md`: loading, empty, offline, errors, optimistic updates, success, permission states.
- `references/accessibility-and-platform.md`: WCAG, screen readers, hit targets, iOS/Android/web, responsive keyboard/safe-area.
- `references/content-and-trust.md`: microcopy, clarity, dates/currency, permission prompts, privacy, localization.
- `references/ux-evaluation.md`: heuristic scoring, usability testing, evidence, metrics, rollout and verification.
- `checklists/ux-review-checklist.md`: acceptance checklist by screen and flow.
- `checklists/route-audit-template.csv`: coverage tracker.

## Shared skill integration
Keep the existing Inter typography system (400/500/600/700/800) and current colors/glass materials **unless** they obstruct comprehension, text scaling, contrast, error presentation, touch targets, or navigation. Use semantic typography tokens from `inter-mobile-typography`, and reuse existing glass components from `dark-liquid-glass-ui` if installed. UX standards specify behavior, hierarchy, and acceptance criteria; companion skills specify appearance.

## Definition of done
For the requested scope: all in-scope routes are inventoried; primary tasks succeed; states are specified and implemented; no known critical usability blocker remains unaddressed; navigation and form behavior are consistent; touch and accessibility checks are recorded; tests are reported accurately. If implementation is blocked, return a prioritized backlog, not a false completion claim.

## Source-of-truth links
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Nielsen Norman Group usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- NIST human-centered design: https://www.nist.gov/itl/iad/human-centered-technologies/human-factors-human-centered-design
- Apple HIG buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Android accessibility: https://developer.android.com/design/ui/mobile/guides/foundations/accessibility
- GOV.UK form validation: https://design-system.service.gov.uk/patterns/validation/
