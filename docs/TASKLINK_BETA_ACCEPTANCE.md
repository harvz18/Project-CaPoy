# TaskLink Phase 8 Beta Acceptance Record

Status: In progress — automated gates ready; distribution and physical-device evidence blocked

Source branch: tasklink

Firebase alias: beta -> tasklink-fb027

Production Firebase alias: intentionally not configured

Evidence timezone: Asia/Manila

This record is the release gate for the controlled TaskLink beta. A source build, emulator pass, or successful deployment is evidence for only that layer. Do not describe the system as 80–90% beta-ready until every required row has dated evidence and no critical/high defect remains open.

## Current environment decision

tasklink-fb027 is selected as the controlled beta project because it is the only TaskLink Firebase project available to the authenticated Firebase account. It must not contain production users or production evidence. If that assumption is false, stop and create a separate Firebase project before any further deployment. Firestore database location selection for a new project is permanent and must be chosen by the owner.

The repository contains only a beta Firebase alias. It deliberately has no default or production alias, reducing the chance that an unqualified deployment targets the wrong project. Deployment commands must still include --project beta and the operator must read the resolved project ID before confirming.

## Secret-safe setup

1. Copy variable names from .env.preview.example; never commit populated values.
2. Run npm run beta:preflight. It reports only configured/missing state and target consistency, never values.
3. Run npm run beta:preflight:strict before distributing an APK. Strict mode also requires the public support mailbox and Android map key.
4. Configure the same EXPO_PUBLIC_FIREBASE values in Render and in the EAS preview environment.
5. Set EXPO_PUBLIC_SUPPORT_EMAIL to a project-owned mailbox.
6. Set GOOGLE_MAPS_API_KEY as an EAS sensitive variable in the preview environment. Do not use secret visibility because dynamic app configuration must resolve it. app.config.js injects it into the Android Google Maps configuration at build time. Restrict the key to the Maps SDK for Android, package com.tasklink.app, and the preview signing certificate.
7. Never store tester passwords, service-account JSON, ID images, payment proofs, push credentials, or populated environment files in Git or beta-evidence.

Current preflight gaps observed October 1, 2026:

- EXPO_PUBLIC_SUPPORT_EMAIL is not configured locally.
- GOOGLE_MAPS_API_KEY is not configured locally.
- EAS CLI is authenticated as harvz1827, but configured project 7a7d5f05-f8f2-45cb-a820-31bdff543ef0 belongs to shaolin18; build access is denied.
- Trusted Firebase Functions cannot be deployed under the current no-charge/Spark constraint.
- Storage setup and rules deployment remain unavailable under the current no-charge constraint documented in the project.

## Automated release gates

Run the complete local gate from the project root:

    npm run test:beta:local

That command runs the secret-safe preflight, TypeScript, application/domain tests, beta-preflight tests, Functions tests, Firestore/Storage emulator tests, Expo Doctor, and fresh web/Android exports. dist and dist-android are ignored build output.

| Field | Value |
| --- | --- |
| Date/time (Asia/Manila) | October 1, 2026 08:46 |
| Commit | Phase 8 changes based on 89ca576; final source is the Phase 8 commit in Git history |
| Operator | Automated local gate in the project workspace |
| Node/npm | Node 24.14.1 / npm 11.11.0 |
| TypeScript | Pass |
| Application/domain tests | Pass, 34/34 |
| Beta-preflight tests | Pass, 5/5 |
| Functions tests | Pass, 25/25 |
| Firestore/Storage emulator tests | Pass, 33/33 |
| Expo Doctor | Pass, 18/18 |
| Web export | Pass |
| Android export | Pass |

## Reviewed cloud deployment

Only after the emulator gate passes:

    npx firebase-tools@15.32.0 deploy --only firestore:rules,firestore:indexes --project beta

Before running it, confirm the CLI resolves beta to tasklink-fb027. This command does not deploy Functions or Storage. Do not add those targets merely to make the checklist appear complete.

Deployment evidence, October 1, 2026 12:24 Asia/Manila: the command resolved the `beta` alias to `tasklink-fb027`, compiled and released the reviewed rules, skipped an identical current rules upload, confirmed all three declared message indexes were already `READY`, and completed successfully. The live database reported free tier enabled. Functions and Storage were excluded.

Functions-dependent capabilities remain blocked until the owner deliberately approves a Functions-capable Firebase plan:

- geofenced task-created notification fan-out;
- remote push delivery and token cleanup;
- verification/payment review mutations;
- superadministrator restriction/name-correction callables;
- trusted administrator analytics generation.

## EAS preview build gate

Do not change app.json ownership or replace its EAS project ID to bypass an authorization error. Either sign EAS CLI into shaolin18 or grant the intended builder access to that project. Then configure the EAS preview environment and verify the resolved config without printing secrets:

    npx eas-cli account:view
    npm run beta:preflight:strict
    npx eas-cli config --platform android --profile preview --non-interactive
    npx eas-cli build --platform android --profile preview

Record the build ID, commit, APK URL with access controls, build profile, completion time, and SHA-256 hash. Do not commit the APK.

## Four-account fixture register

Use four dedicated beta Authentication accounts. Store mobile numbers and passwords in the project owner's password manager, not this document.

| Fixture | Required authority | UID recorded privately | Provisioned | Signed out/in after claim | Result |
| --- | --- | --- | --- | --- | --- |
| Employer | client profile, no staff claim | Private | Pending | N/A | Pending |
| Tasker | worker profile, no staff claim | Private | Pending | N/A | Pending |
| Admin | admin: true custom claim | Private | Pending | Pending | Pending |
| Superadmin | superadmin: true custom claim | Private | Pending | Pending | Pending |

Provision staff claims only from a trusted machine with Firebase Admin application-default credentials:

    npm --prefix functions run set-admin -- <admin-mobile>
    npm --prefix functions run set-superadmin -- <superadmin-mobile>

Never use an ordinary profile role field as proof of staff authority.

## Acceptance matrix

For every row record commit/build, tester role, device/browser and version, Android API, network condition, expected result, actual result, timestamp, redacted evidence reference, and defect ID. Store raw evidence outside Git.

| ID | Scenario | Required environment | Expected result | Status |
| --- | --- | --- | --- | --- |
| A01 | Employer registration/login/session restore/logout | Web + Android | Private profile is owner-only; session restores and logout clears it | Pending |
| A02 | Tasker registration/profile/location/capabilities | Android | Private coordinates save; public profile omits them | Pending |
| A03 | Employer posts a geofenced task | Android | Explicit address/pin/radius persist; no hidden city fallback | Pending |
| A04 | Eligible tasker discovery/search/sort/apply | Android | Matching reasons and ordering are deterministic | Pending |
| A05 | Client rejects one applicant and accepts another | Two accounts | Only selected applicant becomes assigned/busy | Pending |
| A06 | Accepted task chat and read state | Two devices | Only participants can read/send; pagination and receipts work | Pending |
| A07 | Inside-radius start and finish | Physical Android | Fresh accurate device location permits each transition | Pending |
| A08 | GCash evidence review and completion | Client + Admin | Evidence remains private; trusted review required | Blocked: Functions/Storage |
| A09 | COD confirmation and completion | Client + Tasker | Both trusted states are required | Blocked: Functions |
| A10 | Rating and archive | Two accounts | One immutable rating per reviewer/task; data-backed aggregates | Pending |
| A11 | Admin verification/payment review | Admin | Custom claim required; ordinary accounts denied | Blocked: Functions/provisioning |
| A12 | Superadmin restriction/reactivation/name correction | Superadmin | Reason/evidence/audit required; restricted account denied | Blocked: Functions/provisioning |
| A13 | Admin analytics date filters | Admin | Sanitized real values or explicit unavailable state | Blocked: Functions |
| N01 | Eligible nearby task notification | Physical Android | Exactly one in-app event and, when opted in, one push | Blocked: Functions/FCM/build |
| N02 | Out-of-range tasker | Physical Android | No match notification | Blocked: Functions/build |
| N03 | Stale/inaccurate/manual check-in location | Physical Android | Start/finish fail closed with useful guidance | Pending build |
| N04 | Busy/mismatched/restricted tasker | Four accounts | No matching notification | Blocked: Functions/provisioning |
| N05 | Push in foreground/background/terminated app | Two Android devices | Correct deep link; no duplicates | Blocked: Functions/FCM/build |
| F01 | Offline before task mutation | Android + Web | Offline banner displays; no false success | Pending |
| F02 | Disconnect during mutation then reconnect | Android + Web | Inspect current state before retry; no duplicate transition | Pending |
| F03 | Listener failure/retry | Android + Web | Error banner can dismiss or resubscribe safely | Pending |
| S01 | Ordinary user attempts staff/private reads | Emulator + cloud | Denied | Emulator passed; cloud pending |
| S02 | Approved name direct-write attempt | Emulator + cloud | Field disabled and rules deny forged update | Emulator passed; cloud pending |
| X01 | Small screen, keyboard, large font, TalkBack order | Physical Android | Critical controls stay reachable and labeled | Pending build |
| X02 | Render web smoke test | Browser | Current commit loads, authenticates, and shows web fallback | Pending Render confirmation |

## Defect severity and release rule

- Critical: account takeover, cross-user private data access, unauthorized staff action, evidence exposure, destructive corruption, or production-target deployment. Stop testing immediately.
- High: core happy path cannot complete, restriction/geofence fails open, duplicate financial/workflow transition, or reliable crash with no recovery. Do not accept the beta.
- Medium/Low: record reproduction steps and owner; acceptance requires an explicit written disposition.

The gate passes only when all non-deferred rows pass, every blocked row required by the 80–90% claim is unblocked and tested, and no critical/high defect remains open.

## Rollback

1. Stop Render/EAS distribution and notify testers of the affected commit/build.
2. Preserve only redacted diagnostics; do not copy private production-like data into tickets.
3. Re-deploy the last reviewed rules/indexes from a clean Git worktree using the explicit beta alias.
4. Rebuild from the last accepted commit; do not relabel a failed artifact.
5. Repeat every affected automated and physical-device matrix row before redistribution.
