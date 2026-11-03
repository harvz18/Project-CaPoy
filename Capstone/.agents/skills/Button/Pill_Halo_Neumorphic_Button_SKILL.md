---
name: pill-halo-neumorphic-button
description: Restyle a selected MULTIVENT text CTA as a matte, burgundy-shadowed neumorphic pill while preserving its exact pill geometry, behavior, label, and layout. Do not use for circular controls, glossy buttons, or animated borders.
---

# Finalized Burgundy Pill Neumorphic CTA

Use this project-specific skill only for a selected horizontal CTA such as the onboarding `Get Started` / `Next` / `Continue` control.

## Final visual contract

- Preserve the existing pill's width, height, padding, radius, parent layout, touch target, label casing, handler, accessibility label, loading state, and disabled state. A pill stays a pill.
- The button surface must match its immediate parent exactly. On the current onboarding screen, both are `#FFFFFF`.
- Use a matte surface only. Do not use a face gradient, gloss, reflection strip, glass blur, hard outline, or visibly gray fill when the parent is white.
- Define the pill with soft opposing neumorphic shadows: a subtle white upper-left lift and a lower-right burgundy shadow stack.
- Keep the burgundy bloom attached to the real pill via its shadow stack. Use a brighter close burgundy layer and a softer, more transparent outer fade.
- Never add an absolutely positioned glow capsule, transparent/opaque underlay, circle, square wrapper, or decorative layer beneath the pill. Android can render those as a second visible shape.
- The resting CTA is static. Do not add rotating borders, looping border glows, sequential label glows, pulsing, or orbiting effects unless the user explicitly requests a new direction.

## Label treatment

- Keep the label bold (`Inter_700Bold`) and use the project burgundy `#6B1E2E`.
- Make the label appear recessed: shift it down by about 1px and use a restrained lower-right white text highlight. Do not use glossy text, a traveling highlight, or an animated letter effect.
- Keep the label legible; do not make it the same color as a white surface.
- On press, retain the label and change the pill's inset shadow to burgundy plus a soft white opposing highlight.

## MULTIVENT React Native implementation

For the onboarding CTA, use the existing `LuminousPillButton` without changing its footprint:

```tsx
<LuminousPillButton
  accessibilityLabel="Next slide"
  haloTone="burgundy"
  neumorphicSurfaceColor="#FFFFFF"
  onPress={handleNext}
  tone="neumorphic"
  style={styles.nextButton}
>
  <Text style={styles.sinkingLabel}>Next</Text>
</LuminousPillButton>
```

Use the exact parent background for `neumorphicSurfaceColor`. Scope the treatment to the selected CTA; keep onboarding `SKIP`, dots, navigation, and unrelated buttons unchanged.

## Do not do

- Do not convert the CTA into a circle or force square dimensions.
- Do not alter the existing CTA width or its placement beside `SKIP`.
- Do not add an extra halo `View` behind the pill.
- Do not use lavender/purple, black grounding shadows, a fixed burgundy border, or any border animation in the finalized version.
- Do not change routing, semantics, accessibility, or press behavior for styling.

## Acceptance checklist

- [ ] The selected CTA remains a horizontal pill in its original bounding box.
- [ ] The face blends with the immediate screen background and has no gloss.
- [ ] Burgundy shadow is strongest near the lower-right edge and fades smoothly outward.
- [ ] No second capsule or hard-edged halo appears under the button.
- [ ] Label is static, bold, burgundy, and subtly recessed.
- [ ] Pressed state uses burgundy inset depth and remains tappable.
- [ ] `SKIP`, pagination dots, screen layout, labels, and navigation are unchanged.
