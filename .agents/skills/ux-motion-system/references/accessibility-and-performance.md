# Accessibility, safety, and rendering quality

## Reduced motion is a first-class mode
Web: use `@media (prefers-reduced-motion: reduce)` and optionally a media-query hook with robust fallback. Avoid disabling useful focus, progress, and state feedback. Prefer instantaneous state changes or brief opacity/color changes in place of large translation/scale/parallax.

React Native: `AccessibilityInfo.isReduceMotionEnabled()` and `AccessibilityInfo.addEventListener('reduceMotionChanged', ...)`, or a compatible motion library's user preference API. Reanimated 4 has `reduceMotion` modifiers; check installed major version. Apply reduced-motion preferences to router transitions when API permits without breaking native navigation. Test settings changed while the app is running.

## WCAG nuances
- WCAG 2.2 SC 2.2.2 (Level A) has specific pause/stop/hide requirements for certain automatically moving content lasting >5 seconds and auto-updating content. Don't misquote it as a ban on all animation.
- SC 2.3.3 (animation from interactions) is a Level AAA criterion, not WCAG AA; support disabling non-essential triggered motion regardless as a strong product practice.
- Avoid flashes above safety thresholds; text remains available without moving. Keep visual status paired with non-motion indicator.

## Other accessibility
- Don't animate keyboard focus to an offscreen element or let a modal open without focus management. For RN, use accessibility roles/states and announcements.
- Increased text sizes can alter card height or sheet content; animations must adapt without clipping.
- Touch target sizes and colors remain governed by `mobile-ux-standards`; motion does not enlarge the actual hit region.
- Animate progress/status only when it helps; express progress in text/screen-reader-friendly terms when useful.

## Performance
**Web:** animate `transform` and `opacity` where sensible; use CSS transitions for simple motion. Avoid repeated layout reads per frame, costly backdrop blur changes, drop shadows, large paint areas, and endless JS-driven transforms. Don't indiscriminately apply `will-change` to everything (memory cost). Test under CPU throttle and real scroll.

**React Native:** choose native navigation transitions; prefer `useNativeDriver: true` for supported `Animated` opacity/transform; Reanimated worklets/layout transitions only when installed/compatible. Avoid excessive JS-driven frame updates and rerenders during gestures. Don't assume every property supports native driver.

**Glass surfaces:** keep effect static and animate a wrapper. Performance is more important than decorative refraction.

**List performance:** virtualize large content; stagger only small first-time groups, with hard bounds. Disable offscreen animations when virtualization reuses cells.

## Test matrix
- Baseline mobile device and a slower Android target where available.
- Normal motion and reduced motion toggled before and during app usage.
- Rapid taps, repeated opening/closing, system back, interruption mid-transition.
- Keyboard open/close, viewport rotation/small screen, text scaling/zoom.
- Slow network, empty response, failed request, retry, route change while loading.
- Screen-reader/keyboard workflows and modal focus.
- 60Hz/120Hz only if test devices actually available; report measured issues rather than making unsupported fps claims.

## Failure priorities
1. Broken navigation, blocked submission, incorrect status, flashing/seizure risk, inaccessible content: blocker.
2. Gesture conflicts, dropped input, severe jank, trapped focus, content clipping: high.
3. Inconsistent durations, repeated decoration, unexpected layout jumps: medium.
4. Minor easing polish, subtle mismatch: low.
