# Phase 4: Service Creation UI Revision

Phase 4 replaces category-specific multi-select chip groups with a compact modal selector. The service data model and stored `category_details` JSON remain unchanged.

## Implemented behavior

- Multi-select fields show a concise summary in the main service form.
- Selecting or editing a field opens an accessible modal with one switch per option.
- `Cancel` closes the modal without changing the saved form value.
- `Apply` commits the draft selection to the existing string-array field.
- Previously stored values that are no longer part of the current preset list remain visible and selectable.
- Custom tag values remain supported and removable.
- Single-select fields continue to use their existing inline radio-style choices.
- The legacy catering-style fallback in the pricing step uses the same modal selector.

## Affected service fields

The shared selector covers multi-select fields for attire, floral services, catering, venue-space combinations, coordinator profiles, sound and lighting, photography, and host/emcee listings. Preset-backed tag fields such as sizes, cuisines, inclusions, languages, and equipment also use the compact selector while retaining custom-value entry.

## Compatibility

No migration is required. Existing service records continue using the same arrays and keys in `services.category_details`; Phase 4 only changes how providers edit those values.

## Verification

Run from `Capstone`:

```bash
npm run typecheck
npm run lint
npm run build:web
```
