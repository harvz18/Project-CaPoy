# All-screen motion coverage and rollout

## Audit route and interaction inventory
Enumerate all routes, nested routes, role-based screens, auth redirects, dialogs, sheets, dropdowns, popovers, tabs, filtering controls, lists, forms, loading/error/empty states, and linked detail screens. Include landing/onboarding, sign-up/sign-in, home/dashboard, search, list/detail, profile/edit profile, settings, notifications/chat, booking/order/payment, history, admin, etc. **Only list screens that exist in the actual project.**

Record in `checklists/motion-audit-template.csv`:
- Path/screen name and role/platform.
- Interaction/event, user-facing state change, proposed pattern and token.
- Existing API/gesture behavior to preserve.
- Reduced-motion alternative.
- Status (planned, implemented, tested, blocked, intentionally-none).
- Evidence and notes.

## Suggested rollout order
1. Audit and select tokens.
2. Implement shared pressable and animation preference logic.
3. Normalize navigation, tab indicators, and overlays.
4. Normalize forms, toasts, confirmations, loading and errors.
5. Add helpful list/state continuity where needed.
6. Test all routes/states in normal and reduced motion.
7. Refine high-frequency patterns based on feedback, not decoration.

## Scope control
When the user says "across all screens," coverage means all screens, but not every element needs animation. Some content should remain instant/static. Flag such decisions explicitly as `intentionally-none`. Never add home/profile-specific entrances to every page blindly.

## Regression prevention
- Add a concise motion rule in project `AGENTS.md`.
- Keep motion values in one token module.
- Encourage shared components for tap feedback, badges, sheets and status.
- Add manual and automated checks to PR/review templates.
- Do not break feature logic or animate async status without truthfulness checks.

## Reporting template
**Audited:** N screens / N route variants / N overlay types (actual numbers only).
**Implemented:** screen → components → patterns → preference behavior.
**Validated:** test/device/browser → pass/fail/not tested.
**Intentionally static:** screens/patterns and why.
**Remaining:** blockers, performance concerns, accessibility gaps, tech constraints.
