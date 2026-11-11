# Tokens and Materials

Centralize the system in the repository's existing theme mechanism. Components consume semantic roles; screens do not invent glass colors, opacity, blur, shadows, or gradients.

## Core Palette

| Role | Starting value |
| --- | --- |
| Background primary | `#042D40` |
| Background secondary | `#063A4E` |
| Background deep | `#032334` |
| Background navy | `#062A46` |
| Glass subtle | `rgba(86, 159, 178, 0.12)` |
| Glass standard | `rgba(91, 169, 188, 0.18)` |
| Glass strong | `rgba(99, 180, 194, 0.25)` |
| Glass border | `rgba(207, 249, 255, 0.32)` |
| Bright border | `rgba(181, 255, 249, 0.48)` |
| Cyan | `#14D9E2` |
| Teal | `#00C9B3` |
| Emerald | `#00DFAC` |
| Blue | `#29ACD5` |
| Text primary | `#F5FCFF` |
| Text secondary | `#BBD5DE` |
| Text muted | `#92B2C0` |

Add semantic danger, warning, success, information, disabled, scrim, focus, and skeleton roles with contrast appropriate to the dark canvas. Do not communicate status by color alone.

## Primary Gradient

Use approximately `125deg, #26E5B2 0%, #03CBB6 48%, #00A8B8 100%` for active navigation, primary confirmation, selected controls, and highlighted progress. Do not apply it to every card.

## Background Engine

Build one reusable full-screen background with:

1. a deep navy base;
2. one broad cyan illumination field;
3. one quieter teal field;
4. optional diagonal/curved diffusion;
5. a solid dark fallback.

Keep fields static or transform-only and noninteractive. Vary their position sparingly by screen family while retaining the same atmosphere.

## Material Presets

- **Subtle:** 10-14% aqua fill, faint reflective boundary, little/no blur.
- **Standard:** 16-22% blue-teal fill, medium frost where supported, one-pixel border, soft shadow.
- **Elevated:** 24-32% fill, stronger border/shadow, reliable contrast, scrim when overlaying content.
- **Highlighted:** standard/elevated base plus localized cyan edge light and directional glow.
- **Accessible:** roughly 88-96% deep navy fill, strong boundary, minimal/no blur.

A web starting surface may use a `145deg` gradient from `rgba(151,224,232,.22)` to `rgba(38,123,151,.12)`, 18px blur, 145% saturation, a pale 30% border, an inset upper highlight, and a restrained dark-blue shadow. Treat these as tokens, not mandatory per-component literals.

## Geometry

- Small controls: 10-12px.
- Inputs: 12-16px.
- Standard cards: 16-20px.
- Large cards: 20-24px.
- Modals: 22-28px.
- Floating navigation: 24-32px.
- Pills: fully rounded; circles only for icons/avatars.

## Typography

Use one font already supported by the product, preferably Poppins, Inter, Plus Jakarta Sans, or Manrope. Define display, page heading, section heading, card heading, body, label, button, caption, status, and numeric styles. Keep primary copy near-white and secondary copy pale blue-gray; never reduce opacity until text becomes unreadable.

## Motion

- Immediate feedback: 80-120ms.
- Hover/press: 120-180ms.
- Component transition: 180-260ms.
- Overlay/page transition: 240-360ms.
- Press scale: approximately 0.98-0.995.

Prefer opacity and transform. Avoid continuous glow, shimmer, animated blur, or decorative layout animation. Honor reduced motion.
