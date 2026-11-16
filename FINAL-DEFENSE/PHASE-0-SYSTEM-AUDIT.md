# Phase 0 — System Audit

Status: COMPLETE (code inspection; no behavior changes in this phase)

| Area | Initial status | Evidence / risk | Minimal plan |
|---|---|---|---|
| Address hierarchy | Partially implemented | `app/register.tsx` used a Bacolod-only barangay picker; `app/profile.tsx` had free-form fields in an invalid order. | PSGC cascading residential picker; preserve `address` and task boundary. |
| Identity review | Partially implemented | Private Firestore-chunk document storage and privileged review existed, but no selfie-with-ID requirement. | Add one private image requirement through submission, review, and rules. |
| Restricted actions | Implemented but defective | Client checks existed for roles, but verification was only a matching score bonus. | Gate posting/application in UI, matching, and rules. |
| Authentication / OTP | Partially implemented | Firebase password login, reset and email-link utilities exist; numeric OTP is UI-only and no SMS service is configured. | Retain Firebase security; do not invent SMS OTP. |
| Matching | Implemented | Deterministic trusted Function score, distance/geofence and notification trigger exist. | Keep policy weights; make verification a hard eligibility condition. |
| Tasks / notifications | Implemented | Worker task subscriptions are newest-first; `notifyEligibleWorkers` creates in-app matching notifications and push is optional. | Preserve. |
| Admin review | Implemented but incomplete | Admin portal supports review and private previews but lacked selfie preview. | Add selfie preview and approval prerequisite. |
| Analytics / commission | Partially implemented | Trusted analytics Function exists. No approved collection policy for a 5% fee. | Do not alter payments; document policy blocker. |

Inspected: `app/`, `src/`, `functions/`, `admin-portal/`, `firestore.rules`, `storage.rules`, tests. Existing untracked test-result documents were preserved. Baseline `npm test` passed (126 checks). Rollback is the current Git revision `8a6cb14` plus this reviewable worktree diff; no deploy or migration was run.

Known external dependencies: Firebase configuration, deployed rules/functions, PSGC public data endpoint, optional Expo push credentials. Manual action: deploy reviewed rule/function changes only after emulator/device validation.
