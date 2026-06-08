# Current System Overview

## Project

`TASKLINK` is an Expo React Native mobile app for connecting clients who need short-term local help with workers looking for nearby tasks in Bacolod City.

The app currently supports Android and web through Expo.

## Tech Stack

- `Expo` `~54.0.0`
- `React Native` `0.81.5`
- `React` `19.1.0`
- `Expo Router` for file-based navigation
- `TypeScript` with strict mode enabled
- `Firebase` for authentication, Firestore data, and storage configuration
- `Expo Notifications` dependency is installed
- `EAS Build` configuration is present for development, preview, and production builds

## App Configuration

The app is configured in `app.json` as:

- Name: `TASKLINK`
- Slug: `tasklink`
- Version: `1.0.0`
- Orientation: portrait
- Scheme: `tasklink`
- UI style: light
- Platforms: Android and web
- Android package: `com.tasklink.app`
- Expo owner: `shaolin18`
- EAS project id: `7a7d5f05-f8f2-45cb-a820-31bdff543ef0`

## Current Architecture

The app uses `src/context/AppContext.tsx` as the main application state and action layer.

`AppContext` exposes:

- Current user session
- Users
- Tasks
- Chat messages
- Ratings
- Notifications
- Loading and error state
- Login and registration actions
- Role selection
- Profile updates
- Task creation
- Task application
- Task status updates
- Chat sending
- Rating submission

The context subscribes to Firestore data through service modules in `src/services/`.

## Firebase Status

Firebase is used when all required `EXPO_PUBLIC_FIREBASE_*` environment variables are configured.

Required variables are:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

If Firebase is not configured, the listeners return empty arrays and actions that require Firestore throw a configuration error.

This means the current code is not a local mock-data prototype anymore, even though older documentation still mentions mock data.

## Authentication

Authentication is handled through Firebase Identity Toolkit REST calls.

Mobile numbers are normalized into local email-style accounts:

```text
639XXXXXXXXX@tasklink.local
```

The auth service supports:

- Registration by mobile number
- Login by mobile number
- Password fallback: `tasklink123` when no valid password is provided
- Friendly auth error messages for duplicate accounts, invalid credentials, and weak passwords

OTP UI exists in the login screen, but the current implementation does not perform real SMS OTP verification.

## User Roles

The system supports two active roles:

- `worker`
- `client`

Workers can browse jobs, apply to tasks, track application status, chat, complete work, and rate clients.

Clients can post tasks, review applicants, accept workers, track task progress, confirm completion, archive tasks, chat, and rate workers.

Admin is documented as a future/unclear role, but there is no current admin implementation in the code.

## Data Model

Shared TypeScript types live in `src/types.ts`.

Main entities:

- `UserProfile`
- `Task`
- `TaskMatch`
- `ChatMessage`
- `Rating`
- `Payment`
- `AppNotification`

Task statuses:

- `Finding Workers`
- `Applied`
- `Accepted`
- `In Progress`
- `Pending Approval`
- `Finished`
- `Archived`

Payment methods:

- `COD`
- `GCash link`

## Firestore Collections Used

The current service layer uses these collections:

- `users`
- `workerProfiles`
- `clientProfiles`
- `tasks`
- `taskMatches`
- `payments`
- `chats`
- `messages`
- `ratings`
- `notifications`

## Task Lifecycle

The current task flow is:

1. Client creates a task.
2. Task is saved with status `Finding Workers`.
3. A payment record is created with payment status `Selected`.
4. Workers can apply while the task is open.
5. Applying sets the task status to `Applied` and creates a `taskMatches` record.
6. Client accepts a worker.
7. Task status becomes `Accepted`.
8. Worker starts the task.
9. Task status becomes `In Progress`.
10. Worker marks the task finished.
11. Task status becomes `Pending Approval`.
12. Client confirms completion.
13. Task status becomes `Finished`.
14. Client may archive the task.
15. Task status becomes `Archived`.

## Notifications

Notifications are stored in Firestore.

Current notification triggers include:

- New task posted for workers
- Worker application sent to client
- Application accepted for worker
- Completion approval requested from client

Push notification dependencies exist, but the current code stores in-app notifications rather than sending real device push notifications.

## Chat

Chat uses Firestore:

- `chats` stores task conversation metadata
- `messages` stores individual messages

The chat inbox groups conversations by task and opens individual task chats at `app/chat/[id].tsx`.

Chat becomes available when a task has enough participant data to determine sender and receiver.

## Rating

Ratings are stored in Firestore.

When a rating is submitted:

- A new `ratings` document is created.
- The target user's aggregate rating is recalculated.
- `ratingCount`, `ratingTotal`, and `rating` are updated on the target user.

## Current Screens

Routes are defined through Expo Router in the `app/` folder.

Current screens:

- `app/index.tsx`: Splash screen
- `app/login.tsx`: Login, OTP-style UI, password login, and inline registration
- `app/register.tsx`: Separate registration screen
- `app/role-selection.tsx`: Worker/client role selection
- `app/worker-dashboard.tsx`: Worker home, applications, finished jobs, job highlights
- `app/client-dashboard.tsx`: Client home, task stats, ongoing jobs, completed jobs, archived jobs, active workers
- `app/jobs.tsx`: Worker job board
- `app/post-task.tsx`: Client task creation
- `app/task/[id].tsx`: Task details and applicant review
- `app/task-status/[id].tsx`: Task progress and status actions
- `app/chat/index.tsx`: Chat inbox
- `app/chat/[id].tsx`: Task chat
- `app/rating/[id].tsx`: Rating form
- `app/profile.tsx`: Profile view/edit/logout
- `app/worker-profile/[id].tsx`: Public worker profile
- `app/notifications.tsx`: In-app notifications

## UI System

Reusable UI components are in `src/components/`:

- `AppButton`
- `AppCard`
- `AppInput`
- `BottomNavIcon`
- `EmptyState`
- `ScreenContainer`
- `StatusBadge`

Shared styling is split between:

- `src/theme.ts`
- `src/styles.ts`
- Screen-level `StyleSheet` definitions

The newer screens use a green/teal TASKLINK visual style, while some shared theme values still use a blue primary color.

## Build And Scripts

Available package scripts:

```bash
npm run start
npm run android
npm run typecheck
```

EAS profiles:

- `development`: internal APK with development client
- `preview`: internal APK
- `production`: Android app bundle

## Current Repository Notes

There are uncommitted changes in:

- `app.json`
- `app/chat/index.tsx`

There are also untracked history files under `.history/`.

Sensitive/config files exist:

- `.env`
- `secret.txt`

These should not be committed unless they are intentionally sanitized.

## Known Gaps

- Real SMS OTP verification is not implemented.
- Real push notifications are not implemented.
- Firebase must be configured for the app to have usable data.
- There is no local mock data file in the current file tree.
- Admin features are not implemented.
- Payment selection exists, but real payment processing is not implemented.
- GPS/maps/live tracking are not implemented.
- Some docs still describe an older mock-data prototype state.
- Some UI text shows encoding artifacts in places where menu, chevron, and bullet symbols appear.
