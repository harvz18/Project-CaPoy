# Forms and transactions

- Use persistent labels for required or identity-sensitive values; placeholders are examples, not labels.
- Select keyboard type, autocomplete, capitalization, and secure-entry behavior appropriate to the field.
- Validate format locally when safe, but keep server validation authoritative. Validate on submit and, where helpful, after a field has been touched.
- Put an actionable error beside the affected field or section. A summary may supplement but not replace field context.
- Preserve entered values after recoverable failures. Move focus or scroll to the first invalid field when feasible.
- Disable duplicate submission only while the same action is pending; retain a visible loading label or indicator.
- Keep totals, fees, payment method, deadlines, and irreversible consequences visible before confirmation.
- Confirm destructive or difficult-to-reverse actions with specific object/action language. Do not use vague “Are you sure?” copy alone.
- After success, show the confirmed result and route to a meaningful next state. Do not claim success before the server confirms it.
