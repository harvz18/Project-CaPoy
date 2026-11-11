---
name: inter-mobile-typography
description: Apply a consistent, compact, mobile-first Inter typography system to delivery, marketplace, booking, task, and super-app UIs. Use when designing, generating, implementing, reviewing, or refactoring text styles across screens, components, and application states.
---

# Inter Mobile Typography — Project-Wide Skill

## Mission

Establish and enforce one **mobile-first typography system** across **every screen, route, component, overlay, and interaction state** of the current project. The user-provided delivery/super-app typography reference is the **baseline**. **Inter** is the primary font family, and **400, 500, 600, 700, 800** are the **only authorized font weights** unless the user explicitly changes this constraint.

This skill governs **typography**, not the app's color palette, glassmorphism, component geometry, or branding. Integrate with existing UI/design skills without overwriting their unrelated tokens. Do not copy Grab or foodpanda brand assets, product content, or layouts.

## Activation

Use this skill when:
- Creating or modifying application screens, components, navigation, forms, dialogs, cards, lists, and dashboards.
- Defining or adjusting font family, font size, font weight, line height, letter spacing, or text truncation.
- Auditing inconsistent typography or migrating hardcoded text styles to a tokenized design system.
- Building a new mobile-first app, including its tablet/desktop layouts.

If a user asks only for a prompt or specification, provide the specification without modifying project files. If coding is requested, implement the changes, not just a plan.

## Non-negotiable rules

1. Use **Inter** globally; load only the required weights: `400` Regular, `500` Medium, `600` SemiBold, `700` Bold, `800` ExtraBold.
2. Use **semantic text roles** from the table below. Never select font sizes arbitrarily or scatter raw font-size values throughout components.
3. Preserve the reference's **compact hierarchy**: section headings `18–22`, card titles and fields `16`, menu items/prices `14`, metadata `12`, bottom-navigation labels `10–11` (all sizes are **CSS px** on web; map to appropriate native scaled units on mobile).
4. For accessibility, treat `10–12` as **compact supplemental text**, not long-form content or critical instructions. Allow larger text and wrap/reflow when users increase font size; do not freeze small labels to match a screenshot.
5. Prefer `400` for prose, `500` for navigational/menu text, `600` for titles and actions, `700` for section headings and important figures, `800` for rare emphasis/hero numbers. Do not use synthetic `300` or `900`.
6. Preserve existing functionality and actual user-facing data. Do not rewrite logic, API calls, routing, localization, or copy solely to apply type styles.
7. Use design-system tokens; new screens automatically inherit them. Do not solve consistency by manually tuning each screen independently.
8. Do not render text as images. Support selection, accessibility, and localization.

## Canonical type scale

| Semantic role / token | Size | Line height | Weight | Usage |
| --- | ---: | ---: | ---: | --- |
| `screenTitle` | 22px | 28px | 700 | Main screen/page title |
| `sectionTitle` | 20px | 26px | 700 | Major page sections |
| `sectionTitleSmall` | 18px | 24px | 700 | Compact section headings |
| `cardTitle` | 16px | 24px | 600 | Card titles, item detail headings |
| `cardTitleStrong` | 16px | 24px | 700 | Selected/high-priority card title |
| `inputText` | 16px | 24px | 400 | Text-field input and placeholder (not a bold title) |
| `body` | 14px | 20px | 400 | Default short mobile body copy |
| `bodyMedium` | 14px | 20px | 500 | Menu items, list labels |
| `price` | 14px | 20px | 600 | Item/menu prices, totals in lists |
| `button` | 14px | 20px | 600 | Primary/secondary button labels |
| `fieldLabel` | 12px | 16px | 500 | Form labels when not used as placeholders |
| `metadata` | 12px | 17px | 400 | ETA, delivery fee, supporting info |
| `caption` | 12px | 16px | 400 | Secondary captions; not critical paragraphs |
| `badge` | 12px | 16px | 600 | Status badges and chips |
| `bottomNav` | 11px | 14px | 500 | Mobile bottom-nav label; 10px allowed if required and legible |
| `overline` | 10px | 14px | 700 | Short, optional non-critical labels only |
| `heroNumber` | 22px | 28px | 800 | Rare high-emphasis dashboard figures |

The user-supplied screenshot's **typical** ranges are not universal design laws. Prioritize content, localization, contrast, text enlargement, and platform accessibility when they conflict with a fixed screenshot size.

### Default component mapping

- **Headers:** page title `screenTitle`; section heading `sectionTitle` or `sectionTitleSmall`.
- **Cards:** heading `cardTitle`; secondary info `metadata` or `body`; action label `button`.
- **Listings:** item name `bodyMedium`; price `price`; short description `metadata`; explanatory paragraph `body`.
- **Search and forms:** input value/placeholder `inputText`; form label `fieldLabel`; error/help text `metadata` or `body` if needed for legibility.
- **Buttons:** `button`, including icon+label, pills, and CTA buttons; keep a consistent weight.
- **Bottom navigation:** `bottomNav`, do not enlarge or shrink labels per tab. Ensure accessible labels for icon-only controls.
- **Tabs / chips / menus:** `bodyMedium` or `badge` based on density.
- **Dashboard:** headings use normal hierarchy; numbers are `cardTitleStrong`, `screenTitle`, or sparing `heroNumber`, not invented display sizes.
- **Dialogs:** heading `cardTitleStrong` or `sectionTitleSmall`; description `body`; actions `button`.
- **Toast / alerts:** heading `bodyMedium`, message `metadata` for short notices or `body` for lengthy/important information.

## Typography behavior

- Line heights are explicit tokens; do not rely on browser/platform defaults.
- Keep letter spacing generally normal. Only make small, documented optical adjustments where necessary; avoid wide tracking for dense mobile UI.
- Right-align comparable numerical values and use tabular numerals (`font-variant-numeric: tabular-nums` on supported web surfaces).
- Use locale-aware currency, number, and date formatting; do not manually insert fixed currency strings into the styling layer.
- Avoid forced uppercase; respect proper nouns, diacritics, long names, and multilingual translations.
- Prefer wrapping important text over truncation. Truncate only where a component explicitly requires a single line and a full value remains accessible.
- Keep interactive labels legible and visible under zoom, OS text-scaling, and device font settings.
- For desktop/tablet, retain semantic hierarchy; enlarge only deliberately where layout calls for it. Do not scale every mobile token uniformly.

## Implementation workflow

1. **Audit:** identify framework, entry points, styling solution, font files or font provider, platform, all screen routes, and existing text components.
2. **Font registration:** load Inter weights `400/500/600/700/800` once, with correct weight mapping. Ensure font loading does not produce hidden text indefinitely. Do not ship font binaries unless licensing and source are appropriate.
3. **Tokens:** define a single centralized type scale and semantic text-role API; see `references/tokens-and-mapping.md`.
4. **Reusable components:** implement/adjust `AppText`, `Heading`, `Label`, or equivalent existing wrappers to accept a semantic variant. Keep color and layout tokens separate.
5. **Migration:** replace scattered font declarations across all screens and components with shared roles. Preserve functionality, copy, and existing layout behavior unless typography forces responsible reflow.
6. **Review:** check long titles, prices, forms, list density, accessibility text enlargement, wrapping, and cross-platform consistency.
7. **Report:** list screens/components updated, font loading method, deviations, checks performed, and untested items. Do not say everything was tested unless it was.

## Web-specific guidance

Use CSS variables and an `@font-face` definition with weight declarations (or a correctly configured hosted/self-hosted font). A *variable font* may use a 400–800 range, while static files need separate face declarations. Use `font-synthesis: none` where supported to avoid unexpected faux bold. Apply `font-family: Inter, ...fallbacks` to app root and form controls. Use semantic CSS classes/data variants. See `examples/web-tokens.css`.

## React Native / Expo guidance

Import/register Inter's actual available weight-specific font files (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`, `Inter_800ExtraBold` when using a compatible Inter font package) and reference their correct registered family names. On native, **font sizes are platform-scaled units, not guaranteed physical CSS pixels**; map the scale intentionally and test on devices. Build a shared `Text` wrapper; allow font scaling, text wrapping, and layout adaptation. Do not copy web-only `@font-face`, CSS variables, or `backdrop-filter` into React Native. See `examples/react-native-typography.ts`.

## Accessibility checklist

- [ ] Inter fonts render with correct weight mapping (not synthesized or unexpectedly falling back).
- [ ] No text-critical content depends on tiny `10–12px` sizes.
- [ ] Text stays readable against the actual application surface.
- [ ] Text remains usable at larger user font settings / zoom.
- [ ] Buttons, tabs, nav items, and forms do not clip or overlap when labels grow.
- [ ] Inputs and labels remain distinct; placeholders are not the sole accessible labels.
- [ ] Currency/price alignment and long localized text remain readable.
- [ ] All routes and overlays use the same semantic scale.

## Required output quality

For requests to build/refactor UI, deliver actual working implementation with the existing architecture, not isolated mockups. Do not change business logic. State which screens were covered, and explicitly disclose anything not inspected or validated.
