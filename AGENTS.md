# TaskLink Agent Instructions

## Project scope

- Work in the TaskLink project represented by this repository. Do not modify sibling projects such as Capstone unless the user explicitly changes scope.
- Preserve routes, backend integrations, authentication, data models, business logic, and user-facing behavior during presentation-only work.

## Project-local UI skills

- For colors, glass surfaces, lighting, geometry, navigation treatment, and visual consistency, follow `.agents/skills/dark-liquid-glass-ui/SKILL.md`.
- For any typography implementation or UI modification that affects text, follow `.agents/skills/inter-mobile-typography/SKILL.md` and its relevant references/examples.
- For any user-facing screen, navigation, form, feedback state, accessibility behavior, or interaction change, follow `.agents/skills/mobile-ux-standards/SKILL.md` and its relevant references/checklists.
- For any user-facing interaction, route transition, overlay, loading state, or animated state change, follow `.agents/skills/ux-motion-system/SKILL.md` and its relevant references/checklists.
- The typography and glass skills are complementary. Typography work must not overwrite the established dark-liquid-glass palette, materials, borders, shadows, or component design.
- Use the shared `AppText` and `AppTextInput` components plus semantic roles from `src/typography.ts`; do not import raw `Text` or `TextInput` for TaskLink UI without a documented platform requirement.

## Required typography policy

All future screens, pages, components, and UI modifications MUST follow the project's `inter-mobile-typography` skill. Inter is the default font family. Use only font weights 400, 500, 600, 700, and 800. Apply centralized semantic typography tokens and maintain consistent sizing throughout the application. Do not introduce arbitrary font sizes, weights, or alternate font families without an explicit design requirement.

## Required UX policy

All future user-facing screens and interaction changes MUST follow the project's `mobile-ux-standards` skill. Preserve predictable navigation, explicit feedback, recoverable errors, retained form data, accessible controls, responsive keyboard/safe-area behavior, and relevant loading/empty/offline/unauthorized states. Do not change business rules or claim unverified usability/accessibility compliance.

## Required motion policy

All future screens and components MUST follow the project's `ux-motion-system` skill. Reuse centralized motion tokens and shared motion primitives; keep native navigation behavior authoritative; use purposeful opacity/transform feedback; honor operating-system and browser reduced-motion preferences; keep glass blur, typography metrics, and long-list rows stable; and never delay or determine business outcomes with animation. A static treatment is correct when movement would not clarify feedback, hierarchy, continuity, or truthful loading state.
