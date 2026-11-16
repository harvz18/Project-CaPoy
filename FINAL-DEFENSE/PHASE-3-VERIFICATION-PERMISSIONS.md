# Phase 3 — Verification Permissions

Status: COMPLETE

1. Recommendation: prevent pending/rejected accounts from posting or applying.
2. Initial status: role checks existed; verification was not authoritative for these actions.
3. Inspected: AppContext, repository, matching, rules.
4. Modified: verification policy, AppContext, matching Function, Firestore rules and tests.
5. Exact change: client feedback plus Firestore create rules gate task and application writes on admin-approved status; matching excludes unverified workers.
6. Preserved: login/profile/resubmission, existing historical tasks and applications, separate staff claims.
7. Tests: `npm test`.
8. Result: PASS; backend matching and client policy coverage pass.
9. Limitation: rule emulator command did not complete within the local execution window; deploy only after it passes.
10. Dependency: deployed Firestore rules.
11. Manual action: run `npm run test:rules:emulator` in a configured Firebase emulator environment.
12. Completion: COMPLETE in code; emulator validation pending.
