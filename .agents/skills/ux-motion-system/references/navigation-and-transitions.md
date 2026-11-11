# Navigation, routes, overlays and spatial transitions

## Navigation behavior comes before animation
Discover the app's actual router and use its navigation primitives. Keep stack history, push/pop, authentication redirects, back swipe, system Back, deep links, tab state restoration, focus, and scroll restoration. Do not simulate a route change by fading unrelated page DOM and hiding a broken stack.

## Tab navigation
- A tab switch changes peer destinations, not navigation depth. Keep transition compact: 100–200ms active indicator color and position, optional very subtle content crossfade only when it does not flash repeatedly.
- Active pill moves toward selected tab if available in existing design. Do not use 3D rotation, overshoot, or bouncy icons on every tap. The route state is the source of truth for selected styling.
- Tapping the active tab should have documented behavior (e.g. scroll to top if existing pattern); do not make it restart a page entrance animation.
- Preserve bottom safe areas, keyboard interactions, and screen-reader selected state.

## Stack navigation
- Forward push: platform-native forward movement. Back: reverse or platform-prescribed animation. A quick fade may be appropriate for a context swap, not for every stack screen.
- Protect state during transition and mid-swipe cancel. Android system Back and iOS swipe-back must remain authoritative.
- Respect locale direction (LTR/RTL) and the navigation library's support; never hardcode 'right' as universally forward.
- Avoid duplicating app-level animation over native-stack transitions.
- Authentication replacement/logout often should not reveal protected prior screens during animation; match security and history semantics first.

## Modal and dialog
- Open: backdrop fade with short content fade/rise/scale. Close: reverse briskly. Backdrop interaction, Escape/system Back, focus trapping, accessible dialog labeling, and focus restoration matter more than flourish.
- Disable interaction with background layers while dialog is active. Do not make the modal's dismiss depend on the animation finishing before it records intended state.
- Keep lightbox and image viewer transitions minimal; no surprising zoom with reduced motion.

## Bottom sheet
- Follow the touch gesture at 1:1 while dragging; release with platform-native settling; account for scrollable content inside and swipe-to-dismiss conflicts.
- Keep the same logical sheet state if keyboard appears. Bottom inset and touch targets cannot be compromised.
- Use shared sheet implementation. If gesture handler is unavailable or incompatible, prefer a reliable accessible modal over a half-working custom sheet.

## Shared-element transitions
Use only if the router/library explicitly supports them robustly for relevant platform/version; verify stable IDs, image loading, text reflow, back navigation, list virtualization, and reduced motion. Feature-detect for web, provide an instant/crossfade fallback. Shared elements are an accent, not required across every card.

## Web View Transitions API
If using `document.startViewTransition`, feature-detect it and honor reduced motion. Account for browser and framework support. Never assume a default DOM update is synchronous in a framework, and never mutate React-owned DOM directly. If transition integration adds complexity or breaks controls, use ordinary CSS transitions or the router's built-in transitions.

## Navigation validation cases
- Tab switch twice quickly; selected indicator stays aligned with route.
- Open detail, back, immediately open another detail.
- Begin swipe-back then cancel; card/form state remains intact.
- Open a sheet, start dragging, receive an async update, close.
- Deep link into a protected route; no unauthorized content is revealed.
- Navigate while an API request is pending; no ghost overlay.
- Reduced-motion enabled: routes still work without spatial effects.
