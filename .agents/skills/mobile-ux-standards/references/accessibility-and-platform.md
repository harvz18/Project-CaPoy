# Accessibility and platform checks

- Provide accessible names and roles for icon-only controls, images that convey meaning, inputs, status indicators, and custom buttons.
- Keep mobile interactive regions near 44×44 pt on iOS and 48×48 dp on Android where feasible. For web WCAG 2.2 AA, pointer targets should meet 24×24 CSS px or an allowed spacing/exception; larger mobile targets are preferred.
- Preserve text scaling and wrapping. Test long names, translated-length labels, zoom, and keyboard-visible layouts without clipping or covered actions.
- Use safe-area-aware containers and keyboard-aware scrolling for form screens and sticky actions.
- Support keyboard focus and activation on web; focus order follows the visual/task order and focus is visible.
- Respect reduced-motion settings and never make essential information depend on animation.
- Check actual composite contrast on translucent glass. Pair color state with text, icon, or shape.
- Announce important asynchronous errors/status changes when platform APIs permit. Do not repeatedly interrupt assistive technology.
- Test narrow and wide mobile layouts plus relevant native/web behavior; record unavailable device or screen-reader testing honestly.
