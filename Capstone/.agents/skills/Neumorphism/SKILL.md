---
name: soft-gray-neumorphism
description: Design and implement soft, light-gray neumorphic interfaces matching a reference with pearly monochrome surfaces, raised cards and buttons, inset grooves, pill search, circular controls, a mint toggle, and a slider. Use for UI screens, components, design systems, and styling refactors that ask for this specific neumorphism aesthetic.
---

# Soft Gray Neumorphism — UI Design Skill

## Purpose

Create a cohesive **soft neumorphic** UI inspired by the supplied reference image: pale cool-gray canvas; nearly identical canvas and component colors; tactile components sculpted by **paired light upper-left and dark lower-right shadows**; rounded rectangles, pills, and circles; understated gray typography; and a restrained mint-green active state.

**Design intent:** refined, airy, minimal, calm, soft-plastic / frosted-clay appearance. The UI should look *molded out of the background*, not like conventional white cards floating above a dark drop shadow.

Use this skill for web applications, mobile interfaces, component libraries, dashboards, forms, and landing page UI. Preserve product semantics and functionality while applying the visual language.

## 1. Visual reference inventory

The reference is a compact, light-gray component board showing:

| Element | Reference treatment |
| --- | --- |
| Canvas | Very light, cool gray with a barely perceptible tonal gradient |
| Information card | Large raised rounded rectangle, soft gray heading and multiline text |
| Search field | Long raised pill with delicate search icon and placeholder |
| Two text buttons | Small raised rounded rectangles, neutral labels |
| Play control | Raised squarish tile containing a soft gray triangular play icon |
| List/status tile | Small raised square with three inset or embossed horizontal strokes |
| Content/list panel | Large raised square-ish tile with four horizontal skeleton lines |
| Round button | Small raised circular ring with darker inset center |
| Toggle | Raised capsule track and mint-green active segment with a round thumb |
| Slider | Wide raised panel with an inset horizontal track and raised circular knob |

The image is **not** dark mode, glassmorphism, skeuomorphic leather/metal, brutalism, or flat Material UI. Its defining feature is subtle, consistent relief.

## 2. Palette and design tokens

Use a close tonal family, with selective contrast for actual readability. Values below are practical implementation targets inferred from the image rather than claimed exact source design tokens.

```css
:root {
  /* Base */
  --neo-bg: #e9edf0;
  --neo-surface: #e9edf0;
  --neo-bg-top: #f0f3f5;
  --neo-bg-bottom: #e5e9ec;

  /* Type and icons */
  --neo-text: #57636c;          /* accessible body / essential labels */
  --neo-text-muted: #87929a;    /* secondary and placeholder text */
  --neo-icon: #9ca8af;

  /* Highlights and occlusion */
  --neo-light-shadow: #ffffff;
  --neo-dark-shadow: #bac3ca;
  --neo-edge: rgba(255, 255, 255, 0.62);

  /* Accent from the reference toggle */
  --neo-accent: #7dcea2;
  --neo-accent-strong: #4ea875;

  /* Elevation */
  --neo-raised:
    8px 8px 17px rgba(160, 171, 180, 0.54),
    -8px -8px 17px rgba(255, 255, 255, 0.96);
  --neo-raised-small:
    5px 5px 11px rgba(161, 172, 180, 0.52),
    -5px -5px 11px rgba(255, 255, 255, 0.96);
  --neo-raised-large:
    11px 11px 23px rgba(158, 169, 178, 0.53),
    -11px -11px 23px rgba(255, 255, 255, 0.96);
  --neo-inset:
    inset 5px 5px 9px rgba(165, 174, 182, 0.62),
    inset -5px -5px 9px rgba(255, 255, 255, 0.95);
  --neo-inset-small:
    inset 3px 3px 6px rgba(166, 175, 183, 0.57),
    inset -3px -3px 6px rgba(255, 255, 255, 0.97);

  --neo-radius-card: 18px;
  --neo-radius-control: 14px;
  --neo-radius-pill: 999px;
  --neo-radius-round: 50%;
  --neo-gap: 20px;
  --neo-transition: 180ms ease;
}
```

### Critical palette rules

- Background and card fills should be **the same color**, or differ only very slightly.
- Use opposing shadows to define elevation; do **not** rely on a border or dark outline.
- Highlights come from the **upper-left** and depth falls toward the **lower-right**.
- Keep black, pure-white surfaces, saturated colors, hard borders, and heavy gradients out of the default design.
- Green appears selectively in the active switch; do not flood the whole design with green.
- For functional text, deliberately increase contrast compared with the faint text in the image; accessibility takes priority over exact low-contrast imitation.

## 3. Relief system: raised vs. inset

There are two fundamental surface states.

**Raised (convex):** outer paired shadows. Use for cards, buttons, tiles, toggles, slider knobs, search capsules, and icon buttons.

**Inset (concave):** paired inner shadows. Use for active/pressed buttons, text-entry wells when appropriate, slider tracks, switch sockets, and small recessed details.

```css
.neo-raised {
  background: var(--neo-surface);
  border: 1px solid var(--neo-edge);
  box-shadow: var(--neo-raised);
}
.neo-raised--small { box-shadow: var(--neo-raised-small); }
.neo-raised--large { box-shadow: var(--neo-raised-large); }
.neo-inset {
  background: var(--neo-surface);
  box-shadow: var(--neo-inset);
}
```

Never use a single conventional black drop shadow to approximate this style. Shadow consistency across components matters more than local decoration.

## 4. Geometry and spacing

- Medium cards: border radius **16–20px**; padding **20–26px**.
- Small square controls: **68–86px** wide; radius **14–18px**.
- Text buttons: height **42–50px**; radius **12–16px**; padding **14–24px** horizontally.
- Search capsule: height **46–54px**; full pill radius.
- Toggle: track about **88–102 × 46–54px**; knob about **38–44px** in diameter.
- Round buttons: about **40–48px** in diameter.
- Slider knob: **26–34px** in diameter; track height **6–9px**.
- On desktop, use consistent **16–24px** gutters and a breathable **20–32px** layout gap.
- Avoid sharp corners, thick strokes, asymmetric corner radii, and overly dense content.

## 5. Typography and icons

- Use a neutral modern sans-serif such as **Inter**, **Plus Jakarta Sans**, or the product's existing sans-serif.
- Headings: medium or semibold, with calm visual weight.
- Body: regular weight, comfortable line height (1.45–1.6).
- Icons: thin/regular stroke, rounded ends, pale neutral gray; optional tiny engraved highlight.
- Avoid high-contrast, bold black headings unless required by brand semantics or accessibility.
- Icon strokes must remain visible at functional sizes, even if the reference is extremely faint.

## 6. Component specifications

### Card

An embossed panel with softly rounded corners, slight upper-left highlight, muted title, and relaxed line height. No colored header strip or heavy border. Keep sufficient spacing between title and description.

### Search

The screenshot uses a **raised search pill**, not a conventional outlined field. Place a subtle search icon on the left, placeholder toward the center-left, and use a slightly inset treatment on focus if desired. The actual `<input>` must be keyboard accessible.

### Buttons

Use a raised surface at rest. On hover, increase lift minimally; on active/pressed, transition toward inset relief. Do not add aggressive scale or neon glows.

### Tiles and skeleton bars

Use understated gray line segments with tiny embossed or recessed relief. Vary bar lengths naturally; avoid strong black divider lines.

### Circular control

Use an elevated circular parent and a small inset circular center to emulate the reference's tactile ring.

### Toggle

Render the outer track as a light-gray raised capsule, with a green active region and a raised ivory knob. Expose checked state via native checkbox or `role="switch"`, support pointer, keyboard, and touch, and label the control accessibly.

### Slider

Place the horizontal track inside a raised rectangular panel. Recess the track with inset shadows; make the circular knob raised with opposing soft shadows. Use the native range input or accessible slider semantics and preserve an obvious focus treatment.

## 7. Reference CSS implementation

The following CSS is a reusable baseline. Adapt selectors to an existing framework instead of creating parallel competing style systems.

```css
.neo-app {
  min-height: 100vh;
  background: linear-gradient(145deg, var(--neo-bg-top), var(--neo-bg-bottom));
  color: var(--neo-text);
  font-family: Inter, "Plus Jakarta Sans", system-ui, sans-serif;
}

.neo-card {
  background: var(--neo-surface);
  border: 1px solid var(--neo-edge);
  border-radius: var(--neo-radius-card);
  box-shadow: var(--neo-raised-large);
  padding: 24px;
}

.neo-button {
  appearance: none;
  border: 1px solid var(--neo-edge);
  border-radius: var(--neo-radius-control);
  background: var(--neo-surface);
  color: var(--neo-text);
  padding: 12px 22px;
  min-height: 44px;
  font: inherit;
  font-weight: 600;
  box-shadow: var(--neo-raised-small);
  cursor: pointer;
  transition: box-shadow var(--neo-transition), transform var(--neo-transition);
}
.neo-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--neo-raised);
}
.neo-button:active,
.neo-button[aria-pressed="true"] {
  transform: translateY(0);
  box-shadow: var(--neo-inset-small);
}

.neo-search {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 50px;
  padding: 0 20px;
  border-radius: var(--neo-radius-pill);
  background: var(--neo-surface);
  box-shadow: var(--neo-raised);
  border: 1px solid var(--neo-edge);
}
.neo-search input {
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--neo-text);
  width: 100%;
  min-width: 0;
  font: inherit;
}
.neo-search input::placeholder { color: var(--neo-text-muted); }
.neo-search:focus-within { outline: 2px solid var(--neo-accent-strong); outline-offset: 3px; }

.neo-icon-button {
  display: inline-grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 16px;
  border: 1px solid var(--neo-edge);
  background: var(--neo-surface);
  color: var(--neo-icon);
  box-shadow: var(--neo-raised);
  cursor: pointer;
}
.neo-icon-button--round { width: 44px; height: 44px; border-radius: 50%; }

.neo-inset-track {
  height: 8px;
  border-radius: 99px;
  background: var(--neo-surface);
  box-shadow: var(--neo-inset-small);
}
.neo-knob {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--neo-edge);
  background: var(--neo-surface);
  box-shadow: var(--neo-raised-small);
}

.neo-switch {
  position: relative;
  width: 92px;
  height: 50px;
  border: 1px solid var(--neo-edge);
  border-radius: 999px;
  background: var(--neo-surface);
  box-shadow: var(--neo-raised-small);
  cursor: pointer;
}
.neo-switch::before {
  content: "";
  position: absolute;
  top: 8px;
  right: 8px;
  width: 38px;
  height: 34px;
  border-radius: 999px;
  background: var(--neo-accent);
  box-shadow: var(--neo-inset-small);
}
.neo-switch::after {
  content: "";
  position: absolute;
  top: 7px;
  right: 5px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f3f6f7;
  box-shadow: var(--neo-raised-small);
  transition: transform var(--neo-transition);
}
.neo-switch[aria-checked="false"]::before { right: auto; left: 8px; background: #d5dce0; }
.neo-switch[aria-checked="false"]::after { transform: translateX(-42px); }

.neo-button:focus-visible,
.neo-icon-button:focus-visible,
.neo-switch:focus-visible,
.neo-range:focus-visible {
  outline: 2px solid var(--neo-accent-strong);
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .neo-button, .neo-switch::after { transition: none; }
  .neo-button:hover { transform: none; }
}
```

**Implementation note for the toggle:** CSS only describes appearance; the parent must be a real interactive control that updates its state on click and keyboard activation. Prefer a native checkbox customized visually; expose its label and checked state to assistive technology. The CSS above depicts a `role="switch"` implementation when native checkbox markup is not used.

## 8. Behavior / interaction system

| State | Surface behavior |
| --- | --- |
| Rest | Paired outer shadows, low-contrast highlight |
| Hover | At most 1–2px lift or small shadow increase |
| Pressed | Inset relief, no heavy black outline |
| Focus-visible | Clear accessible 2px ring, not only shadows |
| Disabled | Reduced emphasis, but sufficient label legibility; no hover response |
| Selected | Optional inset depression or restrained mint highlight |
| Loading | Subtle moving content or skeleton; honor reduced-motion setting |

All clickable/tappable controls must have accessible names. Use minimum touch targets of approximately 44 × 44 CSS px where practical. Native semantics, keyboard operation, and visible focus indicators are mandatory.

## 9. Responsive layout guidance

- **Desktop:** Arrange mixed-size cards and controls in a structured modular grid with 16–24px gaps, similar to the reference board.
- **Tablet:** Two columns where space permits; preserve large enough interactive targets.
- **Mobile:** One main column, with paired small controls only when they remain readable. Search fills available width.
- Prevent raised shadows from being clipped by overflow containers; reserve padding around cards and panel edges.
- Do not stretch controls until they lose their tactile proportions.

## 10. Implementation workflow for a coding assistant

1. Inspect existing framework, components, color variables, and accessibility patterns. Reuse them when compatible.
2. Establish global tokens for the base gray, paired shadows, radii, typography, and mint accent.
3. Build shared `NeoCard`, `NeoButton`, `NeoSearch`, `NeoIconButton`, `NeoSwitch`, `NeoRange`, and `NeoSkeleton` primitives, or equivalent native components.
4. Apply the raised/inset rules systematically rather than hand-tuning shadows inconsistently on every screen.
5. Preserve all behavior: form validation, routing, state, API calls, loading behavior, and device responsiveness.
6. Test hover, pressed, disabled, selected, keyboard focus, and mobile touch states.
7. Inspect resulting screenshots at desktop and mobile sizes. Correct shadow direction, component relief, spacing, and text contrast.
8. Do not introduce unrelated decorations or convert the design to flat cards or glass panels.

When implementing in React, Tailwind, Vue, Flutter, or React Native, translate these principles into framework-native styles and controls; preserve the same visual hierarchy.

## 11. Acceptance checklist

- [ ] Pale neutral gray background closely matches component fill.
- [ ] Convex components use two balanced shadows from opposite directions.
- [ ] Recessed elements use inward shadows rather than dark borders.
- [ ] Search is pill-shaped; cards and buttons use soft rounded corners.
- [ ] Slider has an inset track and a raised knob.
- [ ] Switch active state is restrained mint green.
- [ ] Components have consistent shadow strength and radii.
- [ ] Main labels, inputs, and focus states remain accessible.
- [ ] Interactive elements actually work; visual states reflect real state.
- [ ] Layout scales cleanly to smaller screens without clipped shadows.
- [ ] No gratuitous glass blur, saturated gradients, heavy outlines, or harsh drop shadows.

## 12. Anti-patterns to avoid

- Pure-white cards on a clearly darker canvas: looks like ordinary card UI instead of neumorphism.
- One-sided, dark drop shadows: breaks the extruded-surface illusion.
- Too many deeply inset sections: makes everything look disabled or hard to parse.
- Tiny low-contrast placeholder-colored text for essential information.
- Decorative switches/sliders that do not expose real control state.
- Applying the mint accent to every card, label, and button.
- Thick visible borders, sharp corners, neon glows, and translucent glass panels.
- Removing keyboard navigation or hiding focus indicators to maintain aesthetic purity.

**Priority rule:** Match the reference's **shape + shadow direction + restrained gray palette + tactile relief** first. Enhance accessibility and functional usability without losing the reference aesthetic.
