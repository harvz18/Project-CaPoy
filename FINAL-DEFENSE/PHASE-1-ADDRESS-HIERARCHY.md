# Phase 1 — Address Hierarchy

Status: COMPLETE

1. Recommendation: Region → Province → City/Municipality → Barangay → detailed address.
2. Initial status: partial; registration was Bacolod-barangay only and profile order was not hierarchical.
3. Inspected: registration, profile, reverse geocoding, Bacolod service, rules.
4. Modified: `PhilippineAddressPicker`, PSGC service, profile/register/types/rules.
5. Exact change: PSGC-code-backed dependent selectors clear incompatible descendants; structured fields coexist with legacy `address`.
6. Preserved: Bacolod-only task posting, maps, pins, reverse geocoding, legacy addresses.
7. Tests: `npm test`.
8. Result: PASS (structured-address unit coverage and TypeScript).
9. Limitation: selector needs the public PSGC endpoint; legacy text is deliberately not guessed/migrated.
10. Dependency: public PSA-sourced PSGC API.
11. Manual action: verify picker on target devices/network.
12. Completion: COMPLETE.
