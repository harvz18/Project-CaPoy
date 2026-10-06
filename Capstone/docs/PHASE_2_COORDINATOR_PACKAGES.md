# Phase 2 — Coordinator Packages

## Status

Implemented for MULTIVENT Revision 2. Apply Phase 1 migration 53 first.

## Package model

Coordinator packages are curated references to real provider-owned services. They do not copy services, transfer ownership, create coordinator-owned provider listings, or allow a coordinator to accept a provider's booking request.

Each package stores:

- coordinator owner;
- package name and description;
- event type;
- ordered service references; and
- `draft`, `active`, or `inactive` status.

If a referenced service becomes inactive, unavailable, deleted, or loses a valid price, an active package is automatically deactivated. Historical event selections retain their package snapshot.

## Coordinator workflow

The coordinator workspace includes package management where coordinators can:

- create packages from active MULTIVENT services;
- view package contents;
- edit package metadata and service choices;
- publish drafts;
- deactivate or reactivate packages; and
- remove an unavailable service while editing a package.

## Client workflow

The coordinator profile displays active packages matching the client's current event type. Each package shows its current services, providers, calculated service subtotal, and combined coordinator-plus-service estimate.

Clients can choose either:

- **Book coordinator only**, or
- **Choose coordinator package**.

Choosing a package atomically sends the coordinator request when needed and adds the referenced services to the event's normal service selections. Those services continue through the existing provider booking workflow, so every provider retains independent accept/reject authority.

Changing to another package safely removes only unbooked selections originally created by the previous package. Manually selected services are retained. A package with active provider requests cannot be silently removed or replaced.

## Pricing behavior

Package prices are calculated when the client views or chooses the package using the current provider service prices and the same configured commission rate as normal catalog selection. Per-person services use the event guest count. No arbitrary fixed package total is stored.

The coordinator fee remains the single Phase 1 event-level fee snapshot and is not duplicated among the package's provider services.

## Database migration

Apply [`database/54_coordinator_packages.sql`](../database/54_coordinator_packages.sql) after migration 53.

The migration creates:

- `coordinator_packages`;
- `coordinator_package_items`;
- `event_coordinator_package_selections`;
- `event_coordinator_package_services`;
- coordinator package management RPCs;
- client package catalog and selection RPCs; and
- service-validity deactivation safeguards.

## Verification

```bash
npm run typecheck
npm run lint
npm run build:web
```

Manual checks after applying migration 54:

1. Create a draft package from two active services.
2. Publish, edit, deactivate, and reactivate it.
3. Confirm only packages matching the client event type appear.
4. Confirm current provider prices and guest-based per-person totals are used.
5. Choose a package and verify its real services appear in Selected Services.
6. Verify the coordinator fee appears only once.
7. Continue through payment and verify providers receive their own independent booking requests.
8. Make a referenced service unavailable and confirm the package deactivates.
9. Confirm a package with active provider requests cannot be silently replaced.
