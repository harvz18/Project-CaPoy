# Web Implementation

Use semantic CSS variables or the existing theme provider. Define a readable opaque dark treatment first, then enhance supported browsers with translucent gradients and backdrop blur.

## Surface Pattern

A web glass surface normally combines:

1. dark blue-teal fallback fill;
2. optional translucent gradient;
3. `backdrop-filter` and `-webkit-backdrop-filter` behind `@supports`;
4. thin reflective border and upper highlight;
5. restrained dark-blue ambient/contact shadow;
6. isolated stacking with noninteractive pseudo-elements.

Never make text contrast depend on backdrop-filter support. Use `pointer-events: none` for decorative layers.

## Responsive and Input Behavior

- Use bounded containers and content-driven breakpoints.
- Preserve visible `:focus-visible` rings and semantic elements.
- Treat hover as enhancement; retain pressed, touch, and keyboard feedback.
- Dialogs need labels, focus trapping, Escape/dismiss behavior, and focus restoration.
- Menus, tabs, grids, and command interfaces need correct keyboard behavior.
- Convert narrow popovers to sheets/drawers when appropriate and prevent horizontal clipping.
- Admin/data views need responsive table alternatives rather than unreadably compressed columns.

## Performance and Fallbacks

- Avoid full-viewport animated blur and independently blurred list rows.
- Keep ambient fields static or transform-only.
- Consolidate blur on shared containers.
- Disable blur and strengthen boundaries for forced colors, reduced transparency, print, and constrained devices.
- Inspect paint/scroll behavior at mobile and desktop widths.

Use [../assets/templates/dark-liquid-glass.css](../assets/templates/dark-liquid-glass.css) as a starting point.
