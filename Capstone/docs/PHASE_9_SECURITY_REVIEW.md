# Phase 9 Security Review

Scope: MULTIVENT application authorization, Supabase RLS boundaries, privileged database functions, financial records, coordinator assignment, support workflows, and audit logging through migration `38_audit_security_hardening.sql`.

## Implemented controls

- Authorization remains database-enforced through active-account checks, dynamic role permissions, per-user overrides, RLS, and guarded security-definer RPCs.
- Superadmin retains unconditional application permission access, while configurable role defaults and overrides remain data-driven.
- Internal account creation requires an authenticated caller, the appropriate create permission, role-specific restrictions, and an audit record before success is returned.
- Direct application writes are revoked for role grants, permission overrides, system settings, the financial ledger, cash remittances, and audit history.
- Audit history is append-only for application roles. Automatic audit snapshots redact contact information and unnecessary private/free-form payloads.
- Provider and service decisions, account status changes, permission changes, support lifecycle actions, coordinator assignment changes, commission configuration, payment-ledger changes, and remittance changes have an audit path.
- Revenue, cash-flow, analytics, and audit reporting use permission-guarded server functions rather than trusting hidden frontend controls.
- Provider payout requests are owner-readable and owner-creatable, but submitted rows cannot be modified or deleted by the provider.
- Coordinator event access remains assignment-scoped, with conflict, availability, workload, and active-account validation at the database layer.
- Support staff access remains limited to tickets and their linked records; private internal notes are excluded from owner visibility.

## Operational responsibilities

- Keep the Supabase service-role key only in Supabase-managed secrets. Never place it in browser, Expo, source-control, or public build environments.
- Restrict Supabase Dashboard project-owner access and require strong multifactor authentication for privileged operators.
- Review permission, finance, coordinator, and internal-user audit activity regularly.
- Define an audit retention period before using the maintenance escape hatch. Maintenance must run with service-role authority and a transaction-local `app.audit_maintenance_authorized` flag.
- Monitor and rotate exposed credentials immediately. Database RLS cannot protect a leaked service-role key.
- Configure database backups, point-in-time recovery, log retention, uptime monitoring, and incident alerts in the hosting/Supabase environment; these are deployment controls rather than repository code.
- Test RLS with separate Client, Service Provider, Coordinator, Assistant, Customer Service, Admin, and Superadmin accounts after every authorization migration.

## Known boundaries

- Database audit inserts performed in the same transaction as a failing operation are rolled back with that operation. Application/API gateway logs are still needed for failed authentication and rejected-request monitoring.
- Existing audit rows created before migration `38` are not rewritten or redacted by the migration.
- Project owners and holders of the Supabase service-role key remain database administrators and can bypass ordinary RLS by design.
- Phase 10 budget-allocation UI changes remain intentionally unimplemented until the approved design is provided.
