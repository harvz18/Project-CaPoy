# Framework-specific implementation decisions

## Step 1: inspect before selecting a library
Record the framework, package manager/lockfile, router/navigation version, existing animation/gesture libraries, Android/iOS minimums, web target browsers, styling system, and current reduced-motion support. An existing solution is preferable to introducing an unrelated one.

## Web / React / TypeScript
- Centralize `--motion-*` CSS custom properties and semantic classes. See `examples/web/motion-tokens.css` and `examples/web/MotionButton.*`.
- Use CSS transitions for press, selection, hover, simple popover; CSS keyframes for rare entrances; avoid JS animation loops for a basic fade.
- Reusable components must not leak hover-only functionality to touch devices. Browser `:focus-visible` must remain clear.
- Route transitions: prefer existing router's own supported transitions; View Transitions API may help but must be feature-detected and correctly integrated with React state flush/timing. Test browser compatibility. Provide a non-animated fallback.
- For `prefers-reduced-motion: reduce`, disable nonessential transforms and repositioning; retain instant visual feedback and focus styles.

## React Native / Expo
- For navigation, keep the installed Expo Router / React Navigation native stack. Its transition behavior depends on platform and version. Prefer platform defaults. See official docs rather than assuming duration overrides work on Android or web.
- Use built-in `Animated` and `Pressable` for simple tactile states when adequate. Our example uses only RN APIs, no third-party dependency.
- For complex gesture-driven sheets/shared-element transitions, inspect existing `react-native-reanimated` and `react-native-gesture-handler`. Verify versions against installed Expo SDK and runtime. Reanimated 4 APIs may differ from Reanimated 3; do not blindly install latest or paste incompatible code.
- Respect `AccessibilityInfo` preference and clear event subscriptions on unmount; preserve `Pressable` accessibilityLabel/role/state.
- Haptics, if an existing supported package is available, should be conditional, subtle and not required to understand success. Don't vibrate on every tap.
- Keep `useNativeDriver: true` only for supported opacity/transform properties and use stable refs, clean interruption, consistent animation drivers.

## React Native Web / hybrid
Web and native transitions may diverge; avoid copying `backdrop-filter` CSS into native style objects, or assuming native `Animated` and web native-stack support identical transition APIs. Validate each target separately.

## When a library is warranted
Add one only when a clear requirement (such as smooth interactive pan gestures, coordinated layout transitions, or supported shared elements) cannot be met reliably with the current stack. Before adding: check compatibility, bundle overhead, accessibility, cleanup, testing strategy, and whether a simpler native component is better.

## Architecture
Recommend `theme/motion.*` or equivalent tokens, `components/MotionPressable`, `components/MotionModal`/existing modal wrapper, and documented navigation behavior. Don't wrap entire screen trees in needless providers. Avoid parallel animation libraries controlling the same property.

## Sources
- RN Animated https://reactnative.dev/docs/animated
- RN AccessibilityInfo https://reactnative.dev/docs/accessibilityinfo
- Expo Router Stack https://docs.expo.dev/router/advanced/stack/
- Reanimated entering/exiting https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/
- MDN View Transitions https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
