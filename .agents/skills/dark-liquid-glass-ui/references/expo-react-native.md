# Expo and React Native Implementation

## TaskLink Baseline

TaskLink uses Expo Router, React Native, React Native Web, `src/theme.ts`, `src/styles.ts`, and shared primitives such as `AppButton`, `AppCard`, `AppInput`, and `ScreenContainer`. Preserve and evolve that architecture. Keep route files, service/context/domain code, Firebase integrations, validation, and navigation behavior intact unless the user explicitly requests functional work.

Inventory `app/**` route files plus shared components and platform-specific implementations. Do not infer coverage from only the visible tabs in the IDE.

## Platform Rules

- React Native styles do not support arbitrary CSS pseudo-elements or browser-only backdrop filters.
- Use platform-specific files only when implementation truly differs.
- Native can compose translucent `View` layers, borders, highlights, and shadows without adding dependencies.
- Use `BlurView` only if the project already supports it or the user approves installation; never nest blur views or place them in every repeated row.
- Keep Expo Go compatibility when required and state when a native module instead needs a development build.
- Use safe-area insets for headers, bottom navigation, sheets, dialogs, and floating controls.
- Use `Pressable` state for pressed/hover/focus behavior and expose appropriate accessibility role, label, hint, and state.
- Verify Android shadow/elevation and web box-shadow behavior rather than assuming parity.

## Integration Order

1. Extend existing semantic tokens without breaking consumed names.
2. Update the global background/screen shell.
3. Upgrade shared actions, cards, inputs, state feedback, and navigation with compatible props.
4. Apply the primitives route by route using the inventory.
5. Move repeated screen-local material values back into tokens/components.
6. Validate Android and web at representative widths before declaring coverage.

Copy-ready starting points are in `assets/templates/`; adapt them to current files rather than copying them wholesale.

## Expo Constraints and Verification

- Remote push notifications are unavailable in Expo Go on Android; local notifications remain available. Use a development build for remote push testing.
- Native modules and config plugins can change build requirements.
- Preserve existing WebView/Leaflet or other platform fallbacks.
- For native-facing changes, run relevant TypeScript/tests plus `npx expo install --check`, `npx expo-doctor`, and an Android bundle/export when feasible.
- For web-facing changes, export/build and inspect narrow and desktop widths.

Successful compilation is not proof of visual fidelity, accessibility, interaction correctness, or device performance. Report what was and was not inspected.
