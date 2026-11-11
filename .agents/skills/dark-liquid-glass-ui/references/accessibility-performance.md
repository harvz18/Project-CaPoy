# Accessibility and Performance

Target WCAG 2.2 AA where applicable. Visual fidelity never outranks readability, predictable interaction, or functional performance.

## Accessibility

- Test contrast against the actual composited background and its brightest light field.
- Keep primary/body text at stable readable opacity; muted text still needs sufficient contrast.
- Provide visible focus, semantic roles/elements, accessible names, states, and predictable tab order.
- Pair status color/glow with text, icon, shape, or pattern.
- Maintain at least 44x44-point touch targets and separate destructive from primary actions.
- Keep input labels persistent, errors adjacent, and asynchronous updates announced where applicable.
- Preserve text scaling and avoid fixed-height clipping.
- Implement correct focus/escape/dismiss/back behavior for overlays.
- Reduced motion removes nonessential translation, scaling, shimmer, and parallax while retaining state feedback.
- Reduced transparency/high contrast switches to accessible material, removes decorative lighting, and strengthens focus/borders.

## Performance Budget

- Prefer one shared blur layer to nested or repeated blur views.
- Avoid large live blur behind long scrolling content.
- Keep ambient light fields few, bounded, and static.
- Animate opacity and transform rather than blur, shadows, or layout.
- Keep virtualized repeated rows simple and avoid per-item expensive effects.
- Verify low-end Android or throttled browser behavior when effects are substantial.

## Common Failures

- **Milky UI:** white glass replaced the dark ocean identity.
- **Opaque blue blocks:** transparency, lighting, and depth were lost.
- **Neon overload:** every border/action glows, destroying hierarchy.
- **Unreadable glass:** bright background fields cross beneath text without an adequate contrast layer.
- **Floating everything:** all surfaces use elevated/highlighted material.
- **Native jank:** animated/nested blur or expensive effects inside lists.
- **Web-only assumptions:** CSS-only effects were pasted into native styles.
- **Incomplete migration:** main screens changed while nested routes, modals, or states retain legacy styling.

Fix the token or primitive causing a repeated failure instead of patching every screen independently.
