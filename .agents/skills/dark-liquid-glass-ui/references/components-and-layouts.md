# Components and Layouts

Extend existing primitives before adding parallel families. Every relevant interactive component needs default, hover where applicable, pressed, focus, disabled, loading, selected, invalid, and success states.

## Actions

Support the variants the product actually uses: primary teal gradient, secondary frost, ghost, outline, icon, floating, destructive, success, segmented/toggle, text action, small pill, confirmation, cancel, and filter. Primary actions use white labels, a subtle upper reflection, gentle shadow, and restrained teal glow. Routine actions remain quieter.

## Cards and Data

Compose cards from reusable header, body, metadata, media, status, actions, and footer regions. Apply to dashboard summaries, statistics, tasks/jobs/services, users/providers, transactions, payments, notifications, messages, activity, reviews, analytics, schedules, settings, details, and state feedback as present.

Keep task/status/price/distance/safety information highly scannable. Feature cards may use highlighted material; ordinary list cards use subtle/standard material; dense tables and critical summaries use accessible material.

## Forms

Dark transparent inputs use stable near-white text, persistent labels, pale borders, and a distinct cyan focus treatment. Cover text/email/password/phone/number/search, textarea, select/multi-select, checkbox/radio/toggle, date/time, uploads, OTP, filters, tags, read-only, validation, and multi-step forms only where they exist. Errors include explanatory text or icons, not color alone.

## Navigation

Mobile bottom navigation is an elevated floating glass capsule above the safe area. Use actual destinations, equal distribution, adequate scroll clearance, and a gradient active pill. Inactive items remain readable and the current route must be clear without glow alone.

Headers, back/search/notification/profile controls, tabs, segments, menus, drawers, pagination, and steppers use the same material language. Use suitable sidebar or top navigation on desktop instead of stretching mobile bottom navigation.

## Feedback and Overlays

Toasts, alerts, banners, loaders, skeletons, badges, empty/error/offline/success states, popovers, sheets, dialogs, and modals use elevation matching their interruption level. Overlays need dimming, focus/back/dismiss management, responsive sizing, and scroll-safe actions. Critical confirmations use accessible material.

## Page Patterns

- **Authentication:** one focused dark glass form, calm background, unambiguous recovery/verification/role-selection states.
- **Dashboard/Home:** minimal header, highlighted summary, responsive statistics, grouped live content, quick actions, floating navigation.
- **Profile:** profile summary, avatar/status, statistics, editable information groups, account actions, floating navigation.
- **Listings/Search:** title, search/filters, glass listing cards, clear actions, deliberate empty/loading/error states.
- **Detail:** primary information panel, grouped metadata, status, secondary content, discoverable actions.
- **Settings:** multiple frosted section groups rather than one giant card.
- **Chat:** readable message surfaces, stable composer, keyboard-safe layout, state feedback.
- **Admin/Data:** bounded desktop layout, accessible tables/filters, responsive list alternatives, restrained effects.

## Responsive Composition

- Mobile: one dominant column, comfortable padding, two-column stats only when readable, full-width primary actions, safe areas, keyboard avoidance, and bottom clearance.
- Tablet: wider bounded containers, adaptive grids, and preserved reading order.
- Desktop: sidebars/top navigation where useful, multi-column grids, controlled maximum widths, hover plus keyboard behavior, and responsive overlays.

Recompose layouts at content-driven breakpoints; do not uniformly scale mobile UI.
