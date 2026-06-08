# CHAPTER III
# METHODOLOGY

These are source notes and writing instructions only. Do not treat this file as the final thesis chapter. Use only the findings below when writing Chapter III. If a detail is not listed here or marked as not found, it should not be invented.

## Technical Background

TASKLINK is an Expo React Native mobile job matching application for Bacolod City. It connects clients who need short-term local/manual labor with workers who can browse, apply for, and complete nearby tasks. The current app uses Expo Router for file-based routing, React Context for shared application state/actions, Firebase Authentication REST calls for account access, Cloud Firestore for application data, and Firebase Storage initialization for file storage readiness.

System name confirmed as `TASKLINK` in `app.json`.

Project title from capstone documentation: `TASKLINK: A Mobile Job Matching System for Informal Workers in Bacolod City`.

Evidence:
- `app.json`
- `package.json`
- `docs/current-system.md`
- `docs/capstone-document.md`
- `src/context/AppContext.tsx`
- `src/services/firebase.ts`
- `src/services/authService.ts`

### Technologies to be Used

Use these project-confirmed technologies:

| Technology | Purpose in the System | Evidence |
|---|---|---|
| Expo `~54.0.0` | Mobile app runtime and development platform | `package.json` |
| React Native `0.81.5` | Cross-platform mobile UI framework | `package.json` |
| React `19.1.0` and React DOM `19.1.0` | UI library used by React Native/Expo | `package.json` |
| TypeScript `~5.9.2` with strict mode | Static typing and safer development | `package.json`, `tsconfig.json` |
| Expo Router `~6.0.23` | File-based navigation through the `app/` folder | `package.json`, `app/_layout.tsx` |
| React Context API | Central application state and actions | `src/context/AppContext.tsx` |
| Firebase JS SDK `^10.14.1` | Firebase app, Firestore, and Storage initialization | `package.json`, `src/services/firebase.ts` |
| Cloud Firestore | Real-time database collections for users, tasks, messages, notifications, ratings, payments, profiles, and matches | `src/services/*.ts` |
| Firebase Identity Toolkit REST API | Mobile-number-as-email registration and login | `src/services/authService.ts` |
| Firebase Storage | Storage object initialized; profile/ID upload fields exist as text placeholders, actual upload implementation not found | `src/services/firebase.ts`, `app/profile.tsx` |
| Expo Notifications `~0.32.17` | Dependency installed, but actual device push sending is not implemented; in-app Firestore notifications are implemented | `package.json`, `src/services/notificationService.ts` |
| EAS Build | Android development, preview, and production builds | `eas.json` |
| React Native Safe Area Context | Safe-area layout support | `package.json`, multiple route files |

Application configuration:
- Name: `TASKLINK`
- Slug: `tasklink`
- Version: `1.0.0`
- Orientation: portrait
- Scheme: `tasklink`
- Platforms: Android and web
- Android package: `com.tasklink.app`
- UI style: light
- EAS project ID: `7a7d5f05-f8f2-45cb-a820-31bdff543ef0`
- Owner: `shaolin18`

Evidence: `app.json`

Available scripts:
- `npm run start`: Expo start
- `npm run android`: Expo Android launch
- `npm run typecheck`: TypeScript no-emit check

Evidence: `package.json`

### Calendar of Activities

No actual development calendar, Gantt chart, iteration dates, school term activities, or project timeline files were found in the current project. The writer must create schedule content as a proposed methodology timeline and clearly avoid claiming it was found in the code.

#### Table 1: Calendar of Activities for Second Semester, School Year 2024-2025

Use as suggested placeholders only. Exact dates are not found in project files.

| Activity | Suggested Coverage | Project Evidence |
|---|---|---|
| Problem identification and initial proposal | Define local informal-worker hiring problem in Bacolod City | `docs/capstone-document.md` |
| Requirements gathering | Identify worker/client roles and major features | `docs/capstone-document.md`, `docs/current-system.md` |
| System analysis | Analyze task posting, matching, chat, payment, rating, and notification needs | `src/types.ts`, `src/context/AppContext.tsx` |
| Prototype planning | Determine Expo, React Native, Firebase, and mobile-first architecture | `package.json`, `app.json`, `src/services/firebase.ts` |
| UI/UX wireframing/prototyping | Plan splash, login, dashboards, job board, task status, chat, rating, and profile screens | `app/` route files |

#### Table 2: Calendar of Activities for First Semester, School Year 2025-2026

Use as suggested placeholders only. Exact dates are not found in project files.

| Activity | Suggested Coverage | Project Evidence |
|---|---|---|
| System development | Implement Expo Router screens and reusable UI components | `app/`, `src/components/` |
| Backend integration | Connect Firebase configuration, Firestore repositories, and auth service | `src/services/firebase.ts`, `src/services/*.ts` |
| Feature implementation | Implement registration/login, task posting, application, task status, chat, rating, payment proof, notifications, and profile editing | `src/context/AppContext.tsx`, `app/` |
| Testing and refinement | Run TypeScript checking and validate app workflows manually | `package.json`; actual test files not found |
| Documentation and deployment preparation | Maintain documentation and configure EAS Android builds | `docs/`, `eas.json` |

Missing Information Needed:
- Official school calendar dates.
- Actual project schedule start and end dates.
- Actual activity completion dates.
- Adviser/reviewer milestone dates.
- Testing dates and deployment dates.

## Resources

### Hardware Recommendation

The project files do not contain formal hardware requirements. The table below should be written as recommendations based on the actual technology stack: Expo React Native, Android/web platform support, Firebase backend, and EAS Build.

#### Table 3: Hardware Requirements

| User/Role | Recommended Hardware | Basis from Project |
|---|---|---|
| Developer | Laptop/desktop capable of running Node.js, Expo CLI, TypeScript, and Android development tools | Expo/React Native project in `package.json` |
| Worker user | Android smartphone with internet connection | Android platform in `app.json`; worker mobile flow in `app/worker-dashboard.tsx`, `app/jobs.tsx` |
| Client user | Android smartphone with internet connection | Android platform in `app.json`; client mobile flow in `app/client-dashboard.tsx`, `app/post-task.tsx` |
| Internet/network | Stable internet for Firebase Authentication REST calls and Firestore real-time data | `src/services/authService.ts`, `src/services/*.ts` |

Not found in project files:
- Minimum Android OS version.
- RAM/storage processor requirements.
- Server hardware, because Firebase cloud services are used.

### Software Recommendation

#### Table 4: Software Requirements

| Software | Purpose | Evidence |
|---|---|---|
| Node.js and npm | Package installation and script execution | `package.json`, `package-lock.json` |
| Expo CLI / Expo tooling | App development and execution | `package.json` scripts |
| EAS CLI | Build profiles for Android APK/app bundle | `eas.json` |
| TypeScript | Static type checking | `tsconfig.json` |
| Firebase project | Authentication, Firestore, Storage configuration | `src/services/firebase.ts` |
| Android device or emulator | Android testing target | `app.json`, `eas.json` |
| Web browser | Web platform is listed, but app appears primarily mobile-focused | `app.json` |
| VS Code or equivalent IDE | Development environment; inferred from user request, not found in files | Not found in project files |

Firebase environment variables required:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

Evidence: `src/services/firebase.ts`, `docs/current-system.md`

### Human Resources Recommendation

The project files do not define an official team roster. Use a recommended capstone team table based on actual system scope.

#### Table 5: Human Resources

| Role | Recommended Responsibility | Basis from Project |
|---|---|---|
| Project Manager/Researcher | Coordinates capstone schedule, requirements, documentation, and evaluation | System scope in `docs/capstone-document.md` |
| Mobile Developer | Implements Expo React Native screens, navigation, and UI logic | `app/`, `src/components/` |
| Backend/Firebase Developer | Configures Firebase Authentication, Firestore, Storage, and service modules | `src/services/` |
| UI/UX Designer | Designs mobile flows for informal workers and clients | `app/` screen files |
| QA Tester | Tests registration, task posting, application, chat, payment proof, ratings, and status workflow | `src/context/AppContext.tsx`, `app/` |
| Documentation Writer | Converts source notes into thesis chapters and diagrams | `docs/` |

Not found in project files:
- Actual team member names.
- Actual project adviser, panel, or client/stakeholder names.

## Requirements Analysis

Use the PIECES Framework below as source notes. Make sure the final Chapter 3 explains each item academically while staying grounded in the app.

#### Table 5: PIECES Framework

| PIECES Area | Current Problem/Need | TASKLINK Response Found in Project | Evidence |
|---|---|---|---|
| Performance | Manual hiring through word-of-mouth is slow and unreliable. Workers need fast access to nearby tasks; clients need quick applicant review. | Real-time Firestore subscriptions load users, tasks, messages, ratings, and notifications. Dashboards show current jobs and applications. | `docs/capstone-document.md`, `src/context/AppContext.tsx`, `src/services/taskRepository.ts` |
| Information and Data | Clients and workers need structured task, profile, rating, status, and payment information. | TypeScript entities define users, tasks, matches, messages, ratings, notifications, and payments. Screens display task category, location, wage, duration, status, applicants, capabilities, and ratings. | `src/types.ts`, `app/task/[id].tsx`, `app/task-status/[id].tsx`, `app/profile.tsx` |
| Economics | Informal workers need job opportunities; clients need local help with clear wage offers. Payment processing should remain simple. | Clients enter wage offers and choose `COD` or `GCash link`. Payment records and payment proof text are stored, but real payment gateway integration is not implemented. | `src/types.ts`, `app/post-task.tsx`, `src/services/paymentService.ts`, `src/services/taskRepository.ts` |
| Control and Security | The app needs account access, role separation, validation, and restricted task actions. | Firebase auth REST calls handle registration/login. `AppContext` checks logged-in users and roles before actions. Firestore transactions prevent duplicate applications and assignment conflicts. | `src/services/authService.ts`, `src/context/AppContext.tsx`, `src/services/taskRepository.ts` |
| Efficiency | Users need fewer steps to post, apply, track, chat, and rate. | Worker dashboards, job board quick apply, client dashboard, task status actions, bottom navigation, and reusable components support efficient workflow. | `app/worker-dashboard.tsx`, `app/jobs.tsx`, `app/client-dashboard.tsx`, `app/task-status/[id].tsx`, `src/components/` |
| Service | Users need trust, communication, updates, and completion confirmation. | The app includes in-app chat, notification records, ratings, worker verification fields, status tracking, and two-sided completion flow. | `src/services/chatService.ts`, `src/services/notificationService.ts`, `src/services/ratingService.ts`, `app/profile.tsx`, `app/task-status/[id].tsx` |

## Ethical Considerations

Source-backed ethical notes:
- The system handles personal data such as full name, mobile number, address/location, role, skills/capabilities, ratings, profile photo URL, valid ID URL, medical certificate URL, and worker coordinates. Evidence: `src/types.ts`, `app/profile.tsx`.
- The system includes role-based experiences for workers and clients. The final writing should avoid discriminatory language and should describe informal workers respectfully. Evidence: `docs/capstone-document.md`, `app/role-selection.tsx`.
- Workers can submit verification-related fields such as valid ID type, valid ID URL, medical certificate URL, profile photo URL, and experience details, but no actual admin review implementation was found. Evidence: `src/types.ts`, `app/profile.tsx`, `app/worker-profile/[id].tsx`.
- The app displays Terms of Service and Privacy Policy text in login/role-selection screens, but actual legal documents are not found in project files. Evidence: `app/login.tsx`, `app/role-selection.tsx`.
- Payment is represented through COD/GCash link and proof text, but the app does not process real payments. The final chapter should state that payment arrangements are external or manually verified in the current system. Evidence: `src/types.ts`, `app/post-task.tsx`, `app/task-status/[id].tsx`, `src/services/paymentService.ts`.
- Location/geofence logic exists and should be discussed as a privacy-sensitive feature. It uses simulated/current coordinates and radius checks, not live GPS tracking. Evidence: `src/utils/location.ts`, `app/post-task.tsx`, `app/task-status/[id].tsx`, `app/profile.tsx`.

Not found in project files:
- Formal informed-consent text.
- Data retention policy.
- Data deletion/account deletion feature.
- Firestore security rules.
- Admin moderation workflow.
- Real legal Terms of Service or Privacy Policy pages.
- Background checks or government verification process beyond profile fields.

## Requirements Documentation

List and explain every system feature found in the project. Use the following feature list as source material.

- Feature 1: Splash Screen — Displays TASKLINK branding, tagline, illustration, loading animation, and redirects to login. Evidence: `app/index.tsx`.
- Feature 2: Login by Mobile Number — Uses a mobile number input and Firebase Identity Toolkit login through a normalized mobile-number email format. Evidence: `app/login.tsx`, `src/services/authService.ts`.
- Feature 3: Prototype OTP-Style Login UI — Shows send-code and verification-code interface, but real SMS OTP verification is not implemented. Evidence: `app/login.tsx`, `docs/current-system.md`.
- Feature 4: Password Login — Lets users log in with mobile number and password. Evidence: `app/login.tsx`, `src/services/authService.ts`.
- Feature 5: Mobile Registration — Registers users with full name, mobile number, password, address/barangay, and worker capabilities. Evidence: `app/login.tsx`, `app/register.tsx`, `src/context/AppContext.tsx`.
- Feature 6: Role Selection — Allows account role selection between worker and client and routes users to the correct dashboard. Evidence: `app/role-selection.tsx`, `src/context/AppContext.tsx`.
- Feature 7: Worker Dashboard — Shows worker availability, available jobs, applications, finished jobs, job highlights, and navigation. Evidence: `app/worker-dashboard.tsx`.
- Feature 8: Client Dashboard — Shows client task statistics, ongoing jobs, completed jobs, archived tasks, active workers, total spend, and post-task entry points. Evidence: `app/client-dashboard.tsx`.
- Feature 9: Worker Job Board — Shows available jobs, nearby job map-style display, filters, active applications, job cards, distance/capability/radius indicators, and quick apply. Evidence: `app/jobs.tsx`, `src/utils/location.ts`.
- Feature 10: Post Task — Allows clients to enter category, title, location/service area, coordinates, geofence radius, required capability, wage, duration, payment method, and notes. Evidence: `app/post-task.tsx`, `src/context/AppContext.tsx`, `src/services/taskRepository.ts`.
- Feature 11: Task Creation in Firestore — Saves task documents with default `Finding Workers` status and creates linked payment records. Evidence: `src/services/taskRepository.ts`.
- Feature 12: Worker Application — Allows workers to apply to open tasks; stores `taskMatches`, updates applicant IDs, and changes task status to `Applied`. Evidence: `src/context/AppContext.tsx`, `src/services/taskRepository.ts`.
- Feature 13: Applicant Review — Allows clients to view worker applications and accept a worker from task details. Evidence: `app/task/[id].tsx`, `app/worker-profile/[id].tsx`.
- Feature 14: Worker Public Profile — Displays worker capabilities, ratings, verification fields, document completion indicators, service coverage, and accept/message actions when tied to a task. Evidence: `app/worker-profile/[id].tsx`.
- Feature 15: Task Status Tracking — Displays task status, map-style location context, details, employer/client card, location check, payment verification, and primary status actions. Evidence: `app/task-status/[id].tsx`.
- Feature 16: Task Lifecycle Management — Supports statuses `Finding Workers`, `Applied`, `Accepted`, `In Progress`, `Pending Approval`, `Finished`, and `Archived`. Evidence: `src/types.ts`, `src/services/taskRepository.ts`, `app/task-status/[id].tsx`.
- Feature 17: Worker Start and Finish Controls — Worker can start accepted tasks and mark in-progress tasks as finished, subject to location/geofence check. Evidence: `app/task-status/[id].tsx`, `src/context/AppContext.tsx`, `src/utils/location.ts`.
- Feature 18: Client Completion Approval — Client confirms worker-finished tasks and can archive finished tasks. Evidence: `app/task-status/[id].tsx`, `src/services/taskRepository.ts`.
- Feature 19: Location and Geofence Check — Calculates distance from worker/task coordinates and checks whether worker is inside task radius before start/finish actions. Evidence: `src/utils/location.ts`, `src/context/AppContext.tsx`.
- Feature 20: Worker Service Area Preferences — Worker can set location area, coordinates, availability, and preferred radius. Evidence: `app/profile.tsx`, `src/types.ts`.
- Feature 21: Capability Matching — Worker capabilities and task required capability are stored and displayed; job board shows capability match indicators. Evidence: `src/constants/capabilities.ts`, `app/jobs.tsx`, `app/post-task.tsx`.
- Feature 22: In-App Chat Inbox — Lists task conversations with search, participant names, previews, timestamps, and unread indicators. Evidence: `app/chat/index.tsx`.
- Feature 23: Task Chat — Allows participants to send messages, quick replies, and view message bubbles per task conversation. Evidence: `app/chat/[id].tsx`, `src/services/chatService.ts`.
- Feature 24: Notification Records — Stores and displays in-app notifications for nearby tasks, worker applications, accepted applications, completion approval, and payment proof submission. Evidence: `src/services/notificationService.ts`, `src/context/AppContext.tsx`, `app/notifications.tsx`.
- Feature 25: Rating and Feedback — Allows users to rate the other party after a task, stores ratings, and updates target user aggregate rating. Evidence: `app/rating/[id].tsx`, `src/services/ratingService.ts`, `src/context/AppContext.tsx`.
- Feature 26: Profile Management — Allows users to edit full name, mobile number, address, bio/business name, worker skills, worker verification fields, availability, coordinates, service radius, and logout. Evidence: `app/profile.tsx`, `src/services/userService.ts`.
- Feature 27: Worker Verification Fields — Stores worker verification status, profile photo URL, experience, years of experience, valid ID type/URL, and medical certificate URL. Evidence: `src/types.ts`, `app/profile.tsx`, `src/services/userService.ts`.
- Feature 28: Payment Method Selection — Allows `COD` or `GCash link` selection during task posting. Evidence: `src/types.ts`, `app/post-task.tsx`.
- Feature 29: Payment Proof Submission — Lets clients submit payment proof text/reference and notifies workers. Evidence: `app/task-status/[id].tsx`, `src/context/AppContext.tsx`, `src/services/taskRepository.ts`.
- Feature 30: Firestore Real-Time Subscriptions — Subscribes to users, tasks, messages, ratings, and notifications. Evidence: `src/context/AppContext.tsx`, `src/services/userService.ts`, `src/services/taskRepository.ts`, `src/services/chatService.ts`, `src/services/ratingService.ts`, `src/services/notificationService.ts`.
- Feature 31: Reusable UI Components — Includes buttons, cards, inputs, bottom nav icons, empty states, screen container, and status badge. Evidence: `src/components/`.
- Feature 32: Android Build Profiles — Includes EAS profiles for development, preview, and production Android builds. Evidence: `eas.json`.

Not found in project files:
- Admin dashboard/features.
- Real SMS OTP provider.
- Real push notification sending to device tokens.
- Real payment gateway integration.
- GPS live tracking.
- Maps SDK integration.
- Account recovery.
- Account deletion.
- Automated tests.

## Design of Software, System, Product, and/or Processes

### Project Framework

Include notes for:
- Figure 3: Project Framework of TASKLINK

Recommended figure content based only on project files:
- Inputs: client registration/login, worker registration/login, role selection, worker profile/capabilities, task details, location/radius, payment method, chat messages, ratings, payment proof.
- Process: Firebase authentication, Firestore data storage, AppContext action layer, task creation, worker application, applicant review, task status updates, notification creation, chat handling, rating aggregation, payment proof update.
- Outputs: worker dashboard, client dashboard, available jobs, task status, applicant lists, in-app notifications, chat conversations, ratings, payment status, archived task records.
- Users/actors: Worker and Client.
- Data stores: Firestore collections `users`, `workerProfiles`, `clientProfiles`, `tasks`, `taskMatches`, `payments`, `chats`, `messages`, `ratings`, `notifications`.

Evidence:
- `src/context/AppContext.tsx`
- `src/services/*.ts`
- `src/types.ts`
- `app/` route files

### On the Design of Software

Screens/pages/components and expected outputs:

| Screen/Component | Route/File | Expected Output |
|---|---|---|
| Splash | `app/index.tsx` | Branding, tagline, loading animation, redirect to login |
| Login | `app/login.tsx` | OTP-style UI, password login, inline registration, data mode display |
| Registration | `app/register.tsx` | Simple registration form with mobile verification code placeholder |
| Role Selection | `app/role-selection.tsx` | Worker/client role cards and dashboard routing |
| Worker Dashboard | `app/worker-dashboard.tsx` | Available jobs, applications, finished jobs, quick apply, navigation |
| Client Dashboard | `app/client-dashboard.tsx` | Ongoing jobs, active workers, completed/archived tasks, total spend, post task |
| Job Board | `app/jobs.tsx` | Open tasks, applied tasks, filters, distance/radius/capability indicators |
| Post Task | `app/post-task.tsx` | Task creation form, map-style location pin, radius, payment method |
| Task Details | `app/task/[id].tsx` | Task details, applicants, accept application, apply, chat/status links |
| Task Status | `app/task-status/[id].tsx` | Lifecycle actions, location check, payment proof, rating/chat links |
| Chat Inbox | `app/chat/index.tsx` | Conversation list, search, unread indicator |
| Task Chat | `app/chat/[id].tsx` | Messages, quick replies, message composer |
| Rating | `app/rating/[id].tsx` | Score selection, feedback, submitted task ratings |
| Profile | `app/profile.tsx` | Profile editing, worker verification fields, service area, logout |
| Worker Profile | `app/worker-profile/[id].tsx` | Public worker profile, verification fields, reviews, message/accept |
| Notifications | `app/notifications.tsx` | In-app notification list |
| Root Layout | `app/_layout.tsx` | AppProvider, SafeAreaProvider, StatusBar, Stack route definitions |
| Shared UI | `src/components/` | Buttons, cards, inputs, empty states, bottom nav icons, screen container, status badge |

Include notes for:
- Context Diagram

Suggested context diagram actors and flows:
- Worker -> TASKLINK: register/login, choose worker role, update profile, set capabilities/service area, browse jobs, apply, chat, start/finish tasks, rate client.
- Client -> TASKLINK: register/login, choose client role, post task, review applicants, accept worker, chat, submit payment proof, confirm completion, archive task, rate worker.
- Firebase Services -> TASKLINK: authentication, Firestore collections, storage initialization.
- TASKLINK -> Worker/Client: dashboards, notifications, task updates, chat messages, ratings, payment status.

Include notes for:
- Level 1 Data Flow Diagram

Suggested Level 1 processes:
1. User Authentication and Role Management
2. Profile and Verification Management
3. Task Posting and Job Discovery
4. Worker Application and Client Acceptance
5. Task Status and Completion Management
6. Chat and Notifications
7. Payment Proof Management
8. Rating and Feedback Management

Data stores:
- D1 Users/Profile Store: `users`, `workerProfiles`, `clientProfiles`
- D2 Task Store: `tasks`
- D3 Match Store: `taskMatches`
- D4 Payment Store: `payments`
- D5 Message Store: `chats`, `messages`
- D6 Rating Store: `ratings`
- D7 Notification Store: `notifications`

Include notes for:
- Level 2 Data Flow Diagram per major feature

Suggested Level 2 details:

Authentication and Role Management:
- Input: mobile number, password, full name, address, role.
- Process: normalize mobile number into `639...@tasklink.local`, call Firebase Identity Toolkit sign-up/sign-in, save/read Firestore user profile, update role.
- Output: current user session and route to role-specific dashboard.
- Evidence: `src/services/authService.ts`, `src/services/userService.ts`, `src/context/AppContext.tsx`, `app/login.tsx`, `app/role-selection.tsx`.

Task Posting:
- Input: title, description, category, location/address, coordinates, geofence radius, required capability, wage, duration, payment method.
- Process: validate required fields, create Firestore task, create payment record, notify workers.
- Output: task detail page and worker notifications.
- Evidence: `app/post-task.tsx`, `src/context/AppContext.tsx`, `src/services/taskRepository.ts`.

Job Application and Matching:
- Input: worker applies to task.
- Process: Firestore transaction checks task existence, duplicate application, assignment status, and open status; creates `taskMatches`; updates task applicant IDs and status.
- Output: task appears in worker applications and client receives application notification.
- Evidence: `src/services/taskRepository.ts`, `src/context/AppContext.tsx`, `app/jobs.tsx`, `app/task/[id].tsx`.

Task Progress:
- Input: accepted worker, start action, mark finished action, client confirm/archival action.
- Process: update task status and timestamps; enforce worker geofence check for start/finish; update worker availability on finish.
- Output: updated task status and dashboard/task-status display.
- Evidence: `app/task-status/[id].tsx`, `src/context/AppContext.tsx`, `src/services/taskRepository.ts`, `src/utils/location.ts`.

Chat:
- Input: message text, sender, receiver, task ID.
- Process: create/update `chats` metadata and add message document.
- Output: inbox preview and task chat messages.
- Evidence: `app/chat/index.tsx`, `app/chat/[id].tsx`, `src/services/chatService.ts`.

Notifications:
- Input: task posted, worker application, accepted application, completion approval, payment proof submission.
- Process: add Firestore notification document and subscribe to current user notifications.
- Output: notification list and status badges.
- Evidence: `src/services/notificationService.ts`, `src/context/AppContext.tsx`, `app/notifications.tsx`.

Payment Proof:
- Input: payment method and proof/reference text.
- Process: create/update payment record and task payment status; notify worker when submitted.
- Output: payment status/proof visible on task status page.
- Evidence: `src/services/paymentService.ts`, `src/services/taskRepository.ts`, `app/task-status/[id].tsx`.

Rating:
- Input: score and feedback.
- Process: save rating document and update target user's rating count, total, and average rating.
- Output: updated profile rating and task rating list.
- Evidence: `src/services/ratingService.ts`, `app/rating/[id].tsx`, `app/profile.tsx`, `app/worker-profile/[id].tsx`.

Include notes for:
- User Interaction Flowchart per target user

Worker flow:
1. Splash screen.
2. Login/register.
3. Select Worker role if needed.
4. Open Worker Dashboard.
5. Open Jobs.
6. View job details.
7. Apply/Quick Apply.
8. Wait for client acceptance.
9. Open Task Status.
10. Start Task after accepted and inside allowed task radius.
11. Mark as Finished.
12. Wait for client approval.
13. Chat as needed.
14. Rate client after task.
15. View finished jobs/profile.

Client flow:
1. Splash screen.
2. Login/register.
3. Select Client role if needed.
4. Open Client Dashboard.
5. Post Task.
6. Review applicant(s) in Task Details.
7. View worker profile.
8. Accept worker.
9. Chat as needed.
10. Monitor Task Status.
11. Submit payment proof.
12. Confirm task as finished after worker completion.
13. Rate worker.
14. Archive task.

Admin flow:
- Not found in project files.

## System Technicalities

### On Network Architecture

Include:
- Figure 16: Network Architecture of TASKLINK

Recommended architecture based on actual files:
- Mobile client: Expo React Native application installed/running on Android, with web also listed in app config.
- App layer: Expo Router screens under `app/`, `AppProvider`/`AppContext` under `src/context/AppContext.tsx`, reusable components under `src/components/`.
- Service layer: Firebase service modules under `src/services/`.
- Cloud backend: Firebase Identity Toolkit REST endpoint for authentication; Cloud Firestore for real-time data; Firebase Storage initialized for storage.
- Network: HTTPS/API calls from device to Firebase services.
- Build/deployment: EAS Build creates internal APK or production Android app bundle.

Evidence:
- `app.json`
- `eas.json`
- `package.json`
- `src/services/firebase.ts`
- `src/services/authService.ts`
- `src/services/*.ts`

Not found in project files:
- Custom backend server.
- REST API routes hosted in this repository.
- Firestore security rules file.
- Cloud Functions.
- Dedicated server, VPS, or on-premise network configuration.

### On Access Control

All user roles found in code:
- `worker`
- `client`

Admin role:
- Mentioned in documentation as unclear/future, but not implemented in source code. Evidence: `docs/capstone-document.md`; no admin route/service found.

#### Table 6: Access Profile for Back-end User

Because no admin/back-end dashboard exists, use this table carefully. Do not invent admin functions.

| Back-end/User Type | Access/Permission | Evidence |
|---|---|---|
| Firebase-configured app service layer | Reads/writes Firestore through service modules when Firebase environment variables are present | `src/services/firebase.ts`, `src/services/*.ts` |
| Authenticated worker/client through AppContext | Performs Firestore actions through context functions after login/profile load | `src/context/AppContext.tsx` |
| Admin | Not found in project files | Not found in project files |
| Manual database administrator | Not found in project files; possible Firebase console operator is not represented in app code | Not found in project files |

#### Table 7: Access Profile for Front-end User

| Front-end User | Allowed Access/Permissions | Evidence |
|---|---|---|
| Worker | Register/login, choose worker role, update worker profile, set capabilities/availability/service area, browse jobs, apply, track applied/accepted tasks, start task, mark finished, chat with client, rate client, view notifications | `app/login.tsx`, `app/role-selection.tsx`, `app/profile.tsx`, `app/worker-dashboard.tsx`, `app/jobs.tsx`, `app/task-status/[id].tsx`, `app/chat/[id].tsx`, `app/rating/[id].tsx` |
| Client | Register/login, choose client role, update profile/business bio, post tasks, review applicants, view worker profiles, accept worker, track task, submit payment proof, confirm finished, archive task, chat with worker, rate worker, view notifications | `app/client-dashboard.tsx`, `app/post-task.tsx`, `app/task/[id].tsx`, `app/worker-profile/[id].tsx`, `app/task-status/[id].tsx`, `app/chat/[id].tsx`, `app/rating/[id].tsx` |
| Guest/Unauthenticated user | Can reach splash/login screens; AppContext actions throw errors when login is required | `app/index.tsx`, `app/login.tsx`, `src/context/AppContext.tsx` |
| Admin | Not found in project files | Not found in project files |

### On Data Security and Controls

Authentication:
- Firebase configuration is loaded from `EXPO_PUBLIC_FIREBASE_*` environment variables.
- Firebase app initializes only if all required config values are present.
- Registration uses Firebase Identity Toolkit REST `signUp`.
- Login uses Firebase Identity Toolkit REST `signInWithPassword`.
- Mobile numbers are normalized into a local email-style account: `639XXXXXXXXX@tasklink.local`.
- Password fallback is `tasklink123` when no valid password of at least 6 characters is supplied.
- Friendly auth errors are mapped for duplicate accounts, invalid credentials, invalid password, and weak password.

Evidence:
- `src/services/firebase.ts`
- `src/services/authService.ts`

Authorization and role controls:
- `AppContext` checks `currentUser` before protected actions.
- `submitPaymentProof` requires `currentUser.role === "client"`.
- Worker task start/finish actions enforce location/geofence checks.
- Client task status actions support applicant review, finish confirmation, and archive.
- Chat receiver selection depends on task participants, applicant IDs, worker ID, and client ID.

Evidence:
- `src/context/AppContext.tsx`
- `app/task-status/[id].tsx`
- `app/chat/[id].tsx`

Validation:
- Registration validates full name and mobile number length.
- Task creation validates title, location, and positive wage.
- Auth service validates password length by using fallback password logic.
- Location coordinate parsing rejects non-numeric values by returning `undefined`.
- Firestore transactions validate task existence, assignment status, duplicate applications, and open application status.

Evidence:
- `src/context/AppContext.tsx`
- `src/services/taskRepository.ts`
- `src/utils/location.ts`
- `src/services/authService.ts`

Database security and consistency controls:
- Firestore transactions are used for applying to tasks, updating task status, and rating aggregation.
- Service modules call `requireDb()` and throw a readable Firebase configuration error if Firebase is not configured.
- Undefined fields are filtered before profile/payment writes in selected service functions.
- Real-time subscriptions return empty arrays when Firebase is not configured.

Evidence:
- `src/services/taskRepository.ts`
- `src/services/ratingService.ts`
- `src/services/userService.ts`
- `src/services/paymentService.ts`
- `src/services/chatService.ts`
- `src/services/notificationService.ts`

Privacy controls:
- Terms/Privacy references appear in UI, but actual policy pages are not found.
- User sensitive fields are part of the model, including phone, address, coordinates, valid ID URL, and medical certificate URL.
- No account deletion or data export controls found.

Evidence:
- `app/login.tsx`
- `app/role-selection.tsx`
- `src/types.ts`

Error handling:
- AppContext centralizes `error`, `appLoading`, and `actionLoading`.
- Screen actions use `try/catch` and rely on AppContext readable error messages.
- Firestore listener errors are routed to `handleListenerError`.
- UI displays error text on login, registration, role selection, post-task, profile, and task status screens.

Evidence:
- `src/context/AppContext.tsx`
- `app/login.tsx`
- `app/register.tsx`
- `app/role-selection.tsx`
- `app/post-task.tsx`
- `app/profile.tsx`
- `app/task-status/[id].tsx`

Not found in project files:
- Firestore security rules.
- Encryption-at-rest configuration beyond Firebase managed services.
- Custom backend authorization middleware.
- Multi-factor authentication enforcement.
- Real SMS OTP verification.
- Rate limiting or anti-spam controls.
- Account recovery/reset password flow.
- Audit logs.
- Admin moderation controls.

## Development

### Research Method

Suggested research method: Descriptive-developmental research method.

Reason based on the system:
- The project documents an existing community problem: unreliable word-of-mouth hiring for informal/manual labor in Bacolod City.
- The system develops and evaluates a mobile application prototype/implementation as the proposed solution.
- The app contains concrete workflows for users, tasks, matching, chat, payment proof, and rating.

Evidence:
- `docs/capstone-document.md`
- `docs/current-system.md`
- `app/`
- `src/context/AppContext.tsx`

Do not claim survey/interview results unless the user provides them. Not found in project files.

### System Development Method

Suggested system development method: Agile/Iterative Prototype Development, or Rapid Application Development (RAD), with three phases.

Reason based on project:
- The codebase shows an evolving prototype: earlier docs mention mock data, while current code uses Firebase.
- The project contains many UI screens and service modules that can be developed and refined iteratively.
- Expo supports rapid mobile prototyping and EAS build profiles support deployment iterations.

Evidence:
- `docs/prototype-guide.md` (older mock-data prototype description)
- `docs/current-system.md` (current Firebase-backed state)
- `app/`
- `src/services/`
- `eas.json`

Include:
- Phase 1
- Phase 2
- Phase 3
- Figure 17: System Development Method

Recommended three-phase method:

Phase 1: Planning, Requirements Analysis, and Prototype Design
- Identify target users: workers and clients.
- Define core system workflows: registration, role selection, task posting, job application, task status, chat, rating, payment proof, profile management.
- Prepare UI routes and data model.
- Evidence: `docs/capstone-document.md`, `src/types.ts`, `app/_layout.tsx`.

Phase 2: System Development and Integration
- Build Expo React Native screens and shared UI components.
- Implement AppContext actions.
- Integrate Firebase Authentication REST calls and Firestore service modules.
- Implement task lifecycle, notifications, chat, ratings, payment records, geofence checks, and profile updates.
- Evidence: `app/`, `src/components/`, `src/context/AppContext.tsx`, `src/services/`, `src/utils/location.ts`.

Phase 3: Testing, Refinement, and Deployment Preparation
- Use TypeScript checking and manual workflow testing.
- Refine dashboards, task flows, and validation/error handling.
- Prepare EAS Android builds for development, preview, and production.
- Evidence: `package.json`, `eas.json`.

Not found in project files:
- Automated unit/integration/e2e tests.
- Formal usability testing results.
- User acceptance testing forms.
- Actual deployment release notes.

## Missing Information Needed

Use this section to prevent the Chapter 3 writer from inventing unsupported details.

- Actual school calendar dates for Second Semester SY 2024-2025.
- Actual school calendar dates for First Semester SY 2025-2026.
- Actual project activity dates and completion dates.
- Final capstone panel/adviser/team member names.
- Final hardware minimum requirements approved by the school.
- Final software versions for deployment machines, Android version, and device specs.
- Firestore database security rules.
- Firebase project configuration values are intentionally not included here.
- Final privacy policy and terms of service.
- Real SMS OTP provider or verification procedure.
- Real push notification implementation.
- Real payment verification/payment gateway process.
- Admin role requirements, if any.
- Formal testing methodology, test cases, test results, and user evaluation data.
- Final diagram images for Figure 3, Context Diagram, Level 1 DFD, Level 2 DFDs, user flowcharts, Figure 16, and Figure 17.

# Prompt for ChatGPT to Write Chapter 3

Use the Markdown source notes I will paste with this prompt to write only `CHAPTER III - METHODOLOGY` for the capstone project `TASKLINK: A Mobile Job Matching System for Informal Workers in Bacolod City`.

Follow the exact capstone headings and order from the source notes. Use formal academic language. Do not change, remove, rename, or reorder the headings. Do not write Chapters I, II, IV, or V. Do not invent project details that are not supported by the source notes. If a detail is marked `Not found in project files` or listed under `Missing Information Needed`, mention it only when appropriate as a limitation or required missing input.

Write the chapter as a complete thesis methodology chapter, not as bullet notes, but preserve required tables and figure captions/placeholders:
- Table 1: Calendar of Activities for Second Semester, School Year 2024-2025
- Table 2: Calendar of Activities for First Semester, School Year 2025-2026
- Table 3: Hardware Requirements
- Table 4: Software Requirements
- Table 5: Human Resources
- Table 5: PIECES Framework
- Figure 3: Project Framework of TASKLINK
- Context Diagram
- Level 1 Data Flow Diagram
- Level 2 Data Flow Diagram per major feature
- User Interaction Flowchart per target user
- Figure 16: Network Architecture of TASKLINK
- Table 6: Access Profile for Back-end User
- Table 7: Access Profile for Front-end User
- Figure 17: System Development Method

Use the evidence paths in the source notes as the basis for technical claims, but do not overload the thesis text with code-file citations unless needed. Write clearly that TASKLINK is an Expo React Native mobile application using Firebase Authentication REST calls, Cloud Firestore, Firebase Storage initialization, Expo Router, React Context, and EAS Build. State accurately that only `worker` and `client` roles are implemented and that admin functionality, real SMS OTP verification, real push notifications, real payment gateway integration, live GPS tracking, Firestore security rules, automated tests, and formal evaluation results were not found in the project files.

The output must be Chapter 3 only.
