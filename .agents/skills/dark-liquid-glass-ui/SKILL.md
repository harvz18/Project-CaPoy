---
name: dark-liquid-glass-ui
description: Audit and redesign an existing web or mobile application with a unified dark navy, cyan-teal liquid-glass system across every route, shared component, overlay, and reachable UI state. Use for full-product glassmorphism migrations or consistency reviews; do not invoke for unrelated business-logic or backend-only work.
metadata:
  short-description: Apply dark liquid glass across entire apps
---

# Dark Liquid Glass UI

Create one application-wide visual identity based on the supplied TaskLink-style references: deep ocean-navy backgrounds, restrained cyan/teal atmospheric light, blue-tinted frosted surfaces, reflective borders, readable pale typography, rounded geometry, and glowing active navigation. The screenshots define the visual direction for the whole product, not only dashboard and profile screens.

## Mandatory Workflow

1. **Inventory before editing.** Detect the framework, platforms, route system, theme, shared primitives, UI dependencies, safe-area behavior, and responsive strategy. Enumerate every route, screen, nested page, modal, drawer, overlay, shared component, and reachable loading/empty/error/offline/permission/success/disabled/pending state. Record an implementation status for each item.
2. **Protect functional boundaries.** Identify business logic, API/auth/database integrations, data models, validation, navigation behavior, and state management. Treat them as protected. Make presentation changes through tokens, styles, compatible props, and reusable wrappers; do not rewrite behavior merely to simplify styling.
3. **Build the foundation.** Centralize semantic colors, background lighting, five material levels, radii, spacing, typography, shadows, elevation, focus, and motion in the project's existing theme system. Remove conflicting light/pastel defaults rather than layering a second disconnected theme.
4. **Upgrade shared primitives first.** Evolve existing buttons, cards, inputs, badges, headers, navigation, feedback, and overlay components with backward-compatible APIs. Add a primitive only when repeated composition warrants it.
5. **Migrate every inventory item.** Cover authentication, main flows, nested details, forms, lists, chat, settings, administration, financial/safety surfaces, modals, and non-happy states that actually exist. Preserve route destinations, real data, and user interactions.
6. **Audit the rendered result.** Inspect representative mobile, tablet, and desktop widths. Search for remaining legacy colors, opaque light cards, default controls, inconsistent radii, hardcoded per-screen glass values, clipped content, unsafe bottom spacing, and weak contrast. Fix confirmed inconsistencies.
7. **Verify and report.** Run checks proportional to the repository: typecheck/lint/tests, relevant platform bundles, and focused interaction checks. Report the complete inventory with updated/unresolved status, shared components and tokens changed, functionality preserved, viewports tested, checks passed, checks not run, and limitations. Never claim complete coverage without reviewing every inventory item.

## Visual Contract

- Base atmosphere: `#042D40`, `#063A4E`, `#032334`, and `#062A46` with a small number of soft cyan/teal light fields.
- Accents: cyan `#14D9E2`, teal `#00C9B3`, emerald `#00DFAC`, and blue `#29ACD5` used semantically and sparingly.
- Text: near-white primary, pale blue-gray secondary, and still-readable muted text.
- Glass: blue-teal translucent fills, thin white-cyan reflective borders, restrained dark-blue shadows, and a brighter upper-edge highlight.
- Primary selection/action: emerald-to-teal gradient near `#26E5B2 -> #03CBB6 -> #00A8B8`.
- Signature navigation: floating elevated glass with a luminous gradient pill for the active route and unambiguous inactive items.
- Accessible material: use a more opaque dark surface for dense forms, tables, long text, payments, safety, destructive actions, and validation-heavy content.

Do not introduce white/beige glass, pink-purple dominant gradients, rainbow neon, fully opaque blue cards everywhere, generic flat Material styling, or screenshot artifacts. Do not hardcode the screenshots' sample names, numbers, tasks, or destinations.

## Material Hierarchy

| Level | Use | Treatment |
| --- | --- | --- |
| 1 Subtle | Quiet grouping and list regions | Low-opacity dark aqua fill, faint edge, little/no blur |
| 2 Standard | Cards, inputs, ordinary controls | Balanced blue-teal translucency and readable contrast |
| 3 Elevated | Navigation, menus, sheets, dialogs | Stronger separation, rim light, shadow, optional scrim |
| 4 Highlighted | One hero, featured summary, selected focal item | Local cyan edge light and restrained directional glow |
| 5 Accessible | Dense/critical information | Near-opaque dark fill, strong boundary, minimal effects |

Treat blur as scarce. Do not nest blur surfaces or apply expensive blur to every row in a long list. Use translucent native fallbacks when real background blur is unavailable.

## Reference Routing

- Read [references/visual-reference-analysis.md](references/visual-reference-analysis.md) before defining the visual direction or comparing screenshots.
- Read [references/tokens-and-materials.md](references/tokens-and-materials.md) when creating colors, backgrounds, materials, typography, radii, shadows, or motion.
- Read [references/components-and-layouts.md](references/components-and-layouts.md) when styling shared components, navigation, forms, page types, or responsive layouts.
- Read [references/expo-react-native.md](references/expo-react-native.md) for TaskLink, Expo, React Native, Expo Go, or development-build work.
- Read [references/web-implementation.md](references/web-implementation.md) for CSS, React DOM, admin portals, desktop navigation, or browser fallbacks.
- Read [references/accessibility-performance.md](references/accessibility-performance.md) before dense content, overlays, animations, repeated lists, or critical forms.
- Read [references/migration-and-qa.md](references/migration-and-qa.md) for full-application inventories, migration sequencing, visual audits, verification, and final reporting.
- Use [checklists/screen-consistency.md](checklists/screen-consistency.md) during the final per-screen review.

## Reusable Assets

Adapt, do not blindly copy, these starters to the target architecture:

- [assets/templates/darkLiquidGlassTokens.ts](assets/templates/darkLiquidGlassTokens.ts)
- [assets/templates/GlassSurface.tsx](assets/templates/GlassSurface.tsx)
- [assets/templates/dark-liquid-glass.css](assets/templates/dark-liquid-glass.css)

The screenshots themselves are not stored in this skill package. When they are unavailable to the coding agent, use the documented visual analysis and token system instead of inventing another aesthetic.
