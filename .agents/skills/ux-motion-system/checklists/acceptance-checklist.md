# UX Motion Acceptance Checklist

## Project-level
- [ ] Every actual route, role, modal, sheet, form and async state is in a screen inventory.
- [ ] Motion tokens, easing and optional reduced-motion preferences are centralized.
- [ ] Existing Liquid Glass, Inter and UX design systems are still intact.
- [ ] No third-party dependency was added without compatibility review.
- [ ] `AGENTS.md` contains a persistent motion standard without overwriting unrelated instructions.

## Interaction quality
- [ ] Touch/press shows immediate feedback without delaying the action.
- [ ] Navigation directions follow native stack/back/RTL semantics.
- [ ] Bottom tab indicator follows route selection under rapid taps.
- [ ] Modals and sheets open/dismiss reliably, with correct focus and back behavior.
- [ ] Menus, filters, accordions, toggles and cards use appropriately restrained effects.
- [ ] Animations do not restart on unrelated renders, route revisits or background refresh.
- [ ] Gestures are interruptible and do not conflict with scrolling/back.

## Data correctness
- [ ] Loading is truthful; determinate progress uses actual progress.
- [ ] Skeletons match eventual content and become empty/error states correctly.
- [ ] Success only appears after a valid confirmed outcome.
- [ ] Errors and retry actions are accessible and preserve state.
- [ ] Rapid repeat taps do not duplicate submissions.
- [ ] Navigation during pending network requests does not leave ghost overlays.

## Accessibility
- [ ] Reduced-motion preference disables or substitutes nonessential spatial movement.
- [ ] Preference works after system setting changes when supported.
- [ ] No flashing/repetitive decoration causes discomfort; moving content has controls when required.
- [ ] Keyboard/screen reader, focus, selection and labels work without motion.
- [ ] Enlarged text/reflow does not clip or overlap animated UI.

## Performance & QA
- [ ] Static glass blur is not continuously re-rendered/animated.
- [ ] Long lists do not animate every cell on scroll.
- [ ] Small device, slower device, landscape and keyboard states checked where possible.
- [ ] Rapid taps, interrupted transitions, swipe-back cancellation and offline states exercised.
- [ ] Existing lint, type-check, build and tests run; failures recorded.
- [ ] Final report distinguishes implemented, verified, intentionally-static, untested and blocked.

## Five-task manual QA script
1. Navigate Home → detail → back quickly three times. Confirm direction, state and responsiveness.
2. Switch bottom tabs rapidly; active indicator and displayed route stay in sync.
3. Open and dismiss a modal/sheet with Back and gestures; verify focus and input retention.
4. Submit a valid then invalid/failed form; verify loading, message, recovery and no duplicate request.
5. Repeat 1–4 with system Reduce Motion enabled; all tasks still work and spatial effects are reduced.
