# Application-Wide Migration and QA

## Inventory Format

Before implementation, create a table or structured list containing:

- route/screen/overlay identifier and source path;
- user role or entry condition;
- shared shell/navigation used;
- key forms/lists/cards/modals and reachable states;
- protected services/logic involved;
- migration status: not reviewed, foundation-covered, screen-updated, visually reviewed, verified, or unresolved.

Include route-generating files, dynamic/nested routes, authentication gates, administrator surfaces, platform-specific components, and responsive variants. Do not count a screen complete merely because a global background reaches it.

## Migration Phases

1. **Audit:** inventory routes, shared components, legacy styles, dependencies, and protected functional boundaries.
2. **Foundation:** implement semantic colors, background engine, materials, type, spacing, radii, shadows, focus, and motion.
3. **Primitives:** upgrade shared buttons, cards, inputs, badges, state feedback, navigation, and overlays.
4. **All screens:** migrate every inventory item, including nested pages and reachable non-happy states.
5. **Responsive review:** inspect mobile, tablet, desktop, safe areas, keyboard, overflow, and long text.
6. **Functional validation:** exercise navigation, forms, buttons, overlays, authentication-dependent paths, and data loading without changing their behavior.
7. **Visual refinement:** compare against references and search for remaining legacy values or inconsistent material usage.

Do not mark a phase complete until its work and evidence exist.

## Legacy-Style Audit

Search source files for:

- old light/pastel background and card colors;
- screen-local palette/material objects duplicating tokens;
- raw white/black surfaces and borders;
- default browser/native controls;
- old primary/accent colors and gradients;
- incompatible radii, shadows, or navigation styling;
- hardcoded heights that clip scaled text;
- pages bypassing the shared shell;
- modal/loading/empty/error states not represented in the initial inventory.

Inspect findings in context; do not mechanically replace semantic status colors or content assets.

## Verification Evidence

Run repository-appropriate typecheck, lint, tests, builds/bundles, and focused interactions. Visually inspect representative phone, tablet, and desktop dimensions when supported. Check route transitions, active navigation, form focus/error states, overlays, scrolling, safe areas, keyboard overlap, long text, loading/empty/error/offline states, and reduced effects.

## Final Report

Report:

1. the complete inventory with updated and unresolved status;
2. shared components changed;
3. tokens/materials introduced;
4. preserved functions, routes, APIs, and data boundaries;
5. viewports/platforms actually inspected;
6. checks passed, failed, and not run;
7. unresolved visual, functional, accessibility, platform, or reference-image limitations.

Do not say “all screens” unless every inventory entry was reviewed.
