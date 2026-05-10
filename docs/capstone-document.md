# Capstone Document

## Project Title

TASKLINK: A Mobile Job Matching System for Informal Workers in Bacolod City

---

## Project Overview

TASKLINK is a mobile-based job matching system designed for informal workers and small business owners in Bacolod City.

The application connects clients needing short-term manual labor with nearby workers who can immediately accept tasks using their mobile devices.

The system focuses on:
- Real-time job posting
- Same-day hiring
- Nearby worker notifications
- Informal/manual labor opportunities
- Simple worker-client communication
- Rating and feedback system

The platform replaces unreliable word-of-mouth hiring methods with a localized digital solution for short-term labor matching.

Supported labor examples:
- Carrying goods
- Unloading inventory
- Cleaning
- Delivery
- Basic maintenance

The system is limited to Bacolod City and focuses only on informal/manual labor.

---

## Target Users / Roles

### Worker
Informal workers or “tambay” looking for short-term jobs.

Capabilities:
- Register account
- Create worker profile
- Add skills
- Upload profile photo
- Receive nearby task notifications
- Accept tasks
- Start and finish tasks
- Communicate with clients
- Receive ratings

### Client
Small business owners or residents needing manual labor.

Capabilities:
- Register account
- Post tasks
- View worker profiles
- Hire workers
- Communicate with workers
- Pay workers
- Rate workers

### Admin
Needs clarification.

The document does not clearly define:
- Admin permissions
- Dashboard features
- Moderation controls
- User management tools

---

## Core Features

### Authentication & Registration
- User registration
- Role selection (Worker or Client)
- Mobile number verification

### Worker Profile
- Profile photo upload
- Skill listing
- Availability status
- Ratings

### Task Posting
Clients can:
- Create tasks
- Set task title
- Set location
- Set offered wage
- Set estimated duration

### Real-Time Matching
- Nearby workers receive notifications
- Workers can instantly accept tasks

### Hiring Workflow
- Client reviews worker rating
- Client confirms hiring

### Task Execution
- Start Task button
- Mark as Finished button
- In-app communication

### Payment
Supported methods:
- Cash on Delivery (COD)
- E-wallet links (example: GCash)

### Rating & Feedback
Both workers and clients can rate each other based on:
- Punctuality
- Work quality
- Payment reliability

### Job Board
- Localized task listings
- Nearby opportunities

---

## Required Screens

### Shared Screens
- Splash Screen
- Login Screen
- Registration Screen
- Role Selection Screen
- Notifications Screen
- Profile Screen

### Worker Screens
- Worker Dashboard
- Nearby Jobs Screen
- Job Details Screen
- Accepted Tasks Screen
- Task Status Screen
- Ratings & Reviews Screen

### Client Screens
- Client Dashboard
- Post Task Screen
- Task Management Screen
- Worker Profile Screen
- Hiring Confirmation Screen
- Payment Screen

### Chat / Communication
- In-app Chat Screen
- Call Shortcut Button

### Needs Clarification
- Admin screens
- Navigation structure
- Exact UI layouts
- Whether maps/GPS are included

---

## User Flows

### Worker Flow

1. Register as Worker
2. Verify mobile number
3. Create profile
4. Add skills
5. Receive nearby job notification
6. View task details
7. Accept task
8. Travel to location
9. Start task
10. Finish task
11. Receive payment
12. Submit rating
13. Become available again

### Client Flow

1. Register as Client
2. Verify mobile number
3. Post task
4. Enter task details
5. Publish task
6. Receive worker applications
7. View worker ratings
8. Hire worker
9. Communicate with worker
10. Confirm completion
11. Pay worker
12. Submit rating

---

## Data Requirements

### User
- id
- role
- full_name
- mobile_number
- profile_photo
- address/location
- rating
- created_at

### Worker Profile
- user_id
- skills
- availability_status
- completed_tasks

### Client Profile
- user_id
- business_name

### Task
- id
- client_id
- title
- description
- category
- location
- wage
- estimated_duration
- status
- created_at

### Task Application / Match
- task_id
- worker_id
- acceptance_status
- hired_at

### Chat Message
- sender_id
- receiver_id
- task_id
- message
- timestamp

### Payment
- task_id
- payment_method
- payment_status

### Rating
- reviewer_id
- target_user_id
- task_id
- score
- feedback

### Notifications
- user_id
- notification_type
- message
- read_status

### Needs Clarification
- Exact database schema
- Relationship rules
- Required vs optional fields
- File upload storage rules

---

## Functional Requirements

### User Management
- Users must register accounts
- Users must choose roles
- Users must verify mobile numbers

### Worker Features
- Workers must manage profiles
- Workers must receive nearby task notifications
- Workers must accept tasks
- Workers must update task progress

### Client Features
- Clients must create tasks
- Clients must manage posted tasks
- Clients must review worker ratings
- Clients must hire workers

### Communication
- System must support in-app communication

### Notifications
- System must send real-time notifications

### Ratings
- Users must rate each other after task completion

### Task Lifecycle
Task states:
- Posted
- Accepted
- In Progress
- Finished
- Archived

### Geographic Limitation
- Tasks are limited to Bacolod City only

### Excluded Features
The following are explicitly excluded:
- Criminal background checks
- Government ID verification
- GPS live tracking
- Professional/specialized trades

---

## Non-Functional Requirements

### Usability
- User-friendly mobile interface
- Simple onboarding process

### Performance
- Real-time notifications
- Immediate job matching

### Accessibility
- Designed for informal workers
- Easy-to-understand workflows

### Reliability
- Ratings system for trust building

### Scalability
- Localized for Bacolod City initially
- Expandable for other regions

### Security
- Basic account verification through mobile numbers

### Needs Clarification
- Authentication provider
- Data encryption
- Offline support
- Push notification provider
- API architecture
- Hosting infrastructure

---

## Tech Stack

### Mobile App
- React Native
- Expo
- EAS Build

### Suggested Backend
Firebase

### Database
Cloud Firestore

### Authentication
Firebase Authentication with mobile number verification

### Storage
Firebase Storage

### Notifications
Expo Push Notifications

### Navigation
Expo Router

### State Management
React Context API

### Platforms
Android only

### App Type
Mobile application only

### UI Style
Simple, clean, beginner-friendly interface suitable for informal workers and small business owners

### Build System
EAS Build

### Payment Integration
External only using:
- COD
- GCash links

### GPS / Maps
Not included

### Real-Time Features
Firestore real-time listeners and Expo notifications

---

## Development Decisions

### Backend
Firebase

### Authentication
Firebase Authentication with mobile number verification

### Database
Cloud Firestore

### Storage
Firebase Storage for profile photos

### Notifications
Expo Push Notifications

### Navigation
Expo Router

### State Management
React Context API

### Maps
Not included

### GPS / Live Tracking
Not included

### Payment Integration
External only. The app will show payment method options such as COD and GCash link, but it will not process payments directly.

### Platforms
Android only for capstone deployment

### App Type
Mobile application only

### Build System
EAS Build

### UI Style
Simple, clean, beginner-friendly interface suitable for informal workers and small business owners

---

## System Rules

### Location Rules
- Tasks are limited to Bacolod City
- Nearby matching is prioritized

### Worker Rules
- Workers can only accept available tasks
- Workers become “Available” after task completion

### Client Rules
- Clients can review worker ratings before hiring

### Task Rules
- Tasks are intended for short-term/manual labor only
- Tasks requiring certifications are excluded

### Communication Rules
- Communication occurs within the app

### Payment Rules
- Payment is handled between users
- Supported methods:
  - COD
  - E-wallet links

### Trust Rules
- Users can rate each other after task completion

### System Limitations
- No live GPS tracking
- No background checks
- No government verification
- No automatic wage adjustment

---

## Needs Clarification

### Technical
- Hosting platform
- Offline support
- Data encryption strategy

### Features
- Admin dashboard functionality
- Worker verification process
- Exact chat implementation
- Whether workers can reject/cancel tasks
- Whether clients can cancel tasks

### Payments
- Whether receipts/history are required

### User Profiles
- Exact required profile fields
- Profile editing permissions

### Notifications
- Notification triggers
- Background notification behavior

### UI/UX
- Final navigation structure
- Branding guidelines
- Theme/colors
- Tablet support

### Security
- Password rules
- Account recovery
- Spam prevention
- Fake account prevention

### Deployment
- APK distribution method
- Production deployment plan