# Motion foundations: purpose, tokens, and hierarchy

## Why motion exists
Use motion to answer one of five questions: (1) Did my action register? (2) Where did this content come from? (3) Where did it go? (4) What changed? (5) Am I waiting for a real operation? If none applies, prefer no animation.

## Hierarchy
1. **Critical feedback** — press state, input focus, submission, navigation start. Must feel immediate.
2. **Spatial continuity** — tab indicator, stack transition, sheet, expanding details. Should clarify relation between states.
3. **State continuity** — check/uncheck, selected filters, updating list items, validation messages.
4. **Optional delight** — rare completion accent. Must never be essential and must be disabled with reduced motion.

## Motion token guidance
- `instant=0ms` for states requiring no animation.
- `feedback=120ms` for press response; press state begins immediately, not after 120ms.
- `quick=160ms` for chips and indicators.
- `standard=220ms` for content changes and small overlays.
- `navigation=280ms` as a design target where the platform permits customization.
- `overlay=280ms` for dialogs/sheets; exit may be shorter (~180ms).
- `emphasis=340ms` maximum for unusual, purposeful reveal.
- `stagger=30ms`, bounded to at most ~150ms total.
These are product defaults, not legally mandated durations or guaranteed native timings. Let platforms manage navigation if overriding would degrade gestures/consistency.

## Easing choices
- Enter: quick departure and gentle landing, e.g. `cubic-bezier(0,0,0.2,1)`.
- Exit: brisk departure, e.g. `cubic-bezier(0.4,0,1,1)`.
- Move/resize: balanced acceleration/deceleration, e.g. `cubic-bezier(0.2,0,0,1)`.
- Follow-finger gestures: position tracks input directly; release springs to the closest legal end state. Prefer damping over bounce for productivity apps.

## Spatial vocabulary
- **Forward**: a detail screen enters from the logical forward edge, per navigator/platform and RTL locale; back reverses.
- **Sibling**: a tab or segment updates in place with a short indicator move and optional subtle content fade, not a full stack push.
- **Overlay**: dialog gently rises or fades; bottom sheet rises from its bottom origin.
- **Inline**: expanding a filter/accordion changes adjacent layout predictably; avoid unbounded large movement.
- **Data**: loaded content appears once; new/removed items have stable identifiers and restrained transitions.

## Glass material rule
Keep glass blur and luminous backgrounds stable while the wrapper moves. Animate opacity/transform of a layer; avoid animating `backdrop-filter`, large multiple shadows, animated gradient stops, and full-screen reflections.

## Inter typography rule
Keep typography semantic and stable. Never animate font sizes/weights, create text-jitter from scale transforms, cut off enlarged text, or use entrance animation to conceal long copy.

## QA questions
Does the motion clarify a relationship or state? Is the result visible immediately? Can the user reverse/cancel? Does it still make sense with all animation removed? Does it work with large text and reduced-motion preference? Can the pattern be reused across the app?
