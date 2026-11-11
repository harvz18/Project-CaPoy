# Gesture responsiveness, interruptions, and concurrency

## Gesture rules
- Direct manipulation must respond to the finger's movement without a queued animation delay. Common: sheet drag, swipe-to-dismiss if supported, draggable slider, carousel. Apply bounds/resistance; allow native scroll to retain priority.
- Handle pointer cancellation, gesture interruption, touch leaving the target, system navigation, and app backgrounding.
- Define release destinations and velocity thresholds before implementation. Thresholds must be tuned for the product, not guessed from sample code.
- Never make swipe the only way to reach an action; provide a visible button/menu alternative.
- Preserve native back-swipe behavior and avoid competing horizontal gestures in edge regions.

## Re-entrant interactions
Rapid tapping, back-and-forth navigation, changing filters mid-request, and opening/closing an overlay mid-animation must never corrupt state. Prefer one source of truth (selected route, sheet open state, pending request), cancel superseded animations, and clean up animation subscriptions/timers on unmount.

## Server and UI states
- Animation completion should **not** determine transaction success. Backend confirmation drives success/error states.
- Optimistic updates only when product rules support rollback. If server rejects, restore the previous state and show a clear explanation.
- If an operation takes longer than an animation, leave a visible pending state; don't conceal latency with fake progress.
- If a network response arrives before the entrance motion completes, state must still update correctly.

## Focus and keyboard
Opening drawers/dialogs must set focus appropriately; closing restores prior focus when meaningful. Screen readers should not announce the same result repeatedly due to remounting animated components. Soft keyboard appearance should not trigger a second page entrance animation; keep active field visible.

## RTL and locale
Respect right-to-left reading direction in horizontal navigation/stack motion and gestures where supported. Avoid animated text transforms that obscure glyph rendering. Dynamic strings should not shift unrelated controls excessively.

## Motion ownership
Use a single mechanism per transition: router for screen changes; shared primitives for press feedback; system refresh for pull to refresh. Don't layer bespoke animation over a native navigator's animation of the same screen.
