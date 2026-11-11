# Component motion contracts

For each component define: *trigger → immediate indication → transitional state → outcome → cancel/recovery*. Reuse centrally instead of one-off effects.

## Pressable buttons, floating actions, icon buttons
- On pointer/touch down: instantly reflect pressed state (visual scale near 0.98, gentle darkening, or inset highlight); on release/cancel return quickly (90–140ms). Haptics, if already supported, must be restrained and optional.
- On click/tap: execute handler promptly; do not wait for animation to complete. Suppress duplicate requests while one is in progress according to existing business logic.
- Loading is explicit, and button label still communicates intent. Disabled looks and behaves disabled; no decorative pulse.
- Keyboard activation has equally clear focus and pressed feedback; `:active` alone is not sufficient for accessible focus.

## Cards and lists
- Static informational cards: no automatic lift or bounce.
- Clickable card: subtle hover elevation only where hover exists; pressed/selection feedback on touch. Avoid moving card enough to cause accidental touches.
- Insertion/removal: 160–260ms fade plus short translate when it helps explain a changed list, only once on mutation. Stable IDs; never retrigger on sorting/rerender.
- Virtualized/long lists: skip per-row entrance animations for routine scrolling; preserve list scroll position.

## Search and filters
- Focus highlight moves quickly, no typing lag. Clear button appears without moving field contents.
- Chips/segmented selection use short fill/indicator shift. Results may crossfade only once at data resolution; preserve scroll/selection reasonably.
- Debounce is for request efficiency, not aesthetic animation; don't insert arbitrary latency.

## Forms
- Field focus: 100–160ms border/focus color, not animated full-screen glow.
- Validation message: prompt, readable appearance. Prefer simple opacity change + layout that doesn't occlude the next field. Avoid shaking the entire form or red flashing.
- Password visibility toggles immediately; strength meter only changes after actual calculation; no faux strength progress.
- Wizard: show actual step and reversibility; horizontal progress indication should accurately mirror completed steps. Back retains user data.

## Accordions, tabs, menus
- Short expand/collapse; ensure content is measurable and accessible while moving. If height animation is too heavy, show content instantly or with short opacity transition.
- Menus/popovers: use brief scale/fade at logical anchor; preserve keyboard focus and closing behavior.
- Active tab indicator animation should never desynchronize from route selection.

## Checkboxes, toggles, sliders
- Toggle thumb can shift 120–190ms; state is committed immediately or shows pending if server-managed.
- Slider updates during drag without lag; release can settle if needed. On rejection, restore authoritative value and clearly explain why.
- Checkboxes and radio selection should remain visible without animation.

## Feedback
- Toast: one-time short enter/exit; do not cover primary action. Important feedback needs enough reading time or persistent dismissible alternative. Announce changes to assistive tech appropriately.
- Success: small check/label swap **after actual confirmation**, optional subtle reveal, not confetti by default.
- Error: display informative text and recovery action; avoid shake-only or red-only signals.
- Notification badge: number/status updates once; do not continuously pulse unless a truly time-critical case warrants it and has an accessible equivalent.

## Glassmorphism-specific
- Animate shared wrappers with opacity/transform. Treat frosted edges, blur, refraction, glow and background aurora as mostly static materials.
- Only subtly brighten active button edges; avoid sweeping rainbow gradients or continuous shimmer around every glass card.
