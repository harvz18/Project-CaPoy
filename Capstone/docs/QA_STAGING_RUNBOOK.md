# Staging E2E Runbook

This application has a linked live Supabase project. Do not run lifecycle, cancellation, refund, or bulk-fixture tests against it.

## One-time staging setup

1. Provision a separate Supabase project intended only for QA.
2. Apply the same committed migrations to that project.
3. Create disposable accounts for a client, two providers, a coordinator, an admin, and a superadmin. Use only clearly labelled QA identities.
4. Configure a prototype/sandbox payment adapter. Do not place live payment credentials or a Supabase service-role key in a client environment file.
5. Copy `.env.qa.example` to `.env.qa.local`, substitute only the staging project values, and keep the resulting file untracked.

## Required target gate

Before any browser or mobile E2E command, run:

```powershell
npm.cmd run qa:staging:preflight
```

The command fails unless all of the following are true:

- `MV_QA_ENV` is exactly `staging`.
- The URL is a canonical HTTPS Supabase project URL.
- Its project reference exactly matches `QA_ALLOWED_SUPABASE_PROJECT_REF`.
- Payment mode is explicitly `prototype`.
- A deliberate staging confirmation is present.
- No Supabase service-role credential is available to the client test process.

Before any E2E suite or release candidate, also run:

```powershell
npm.cmd run qa:staging:schema-guard
```

This read-only guard additionally refuses a CLI project-reference mismatch, requires migration parity, confirms the two P0 RLS contracts, and compares anonymously executable security-definer functions against the reviewed public-marketplace allowlist.

## Initial E2E matrix

Run each path with disposable fixtures and record the resulting IDs in the QA log:

1. Client event creation and a bookable service from every category.
2. Provider acceptance, rejection, replacement, and the all-accepted payment gate.
3. Prototype downpayment and full-payment initiation; duplicate callback/retry handling.
4. Cancellation before settlement, cancellation/refund after verified settlement, and the policy-date boundary.
5. Catering tasting scheduling, attendance, menu-finalization limits, and direct-menu fallback.
6. Venue availability, option pricing, messaging, notifications, reviews, and cross-role denials.
7. iOS Safari sign-in/sign-up and focus/keyboard regression smoke test.

Never use the linked live project as a substitute for this staging matrix.
