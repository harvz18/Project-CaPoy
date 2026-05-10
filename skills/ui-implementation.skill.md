# UI Implementation Skill

## Purpose
Create a simple functional prototype UI for the TASKLINK mobile application.

## Scope
This skill is for building basic React Native screens when no final UI design is available.

## Rules
- Prioritize functionality over visual design.
- Use simple, clean, readable layouts.
- Do not add advanced styling.
- Do not add animations.
- Do not use UI libraries unless already installed.
- Do not invent new screens or features.
- Follow `docs/capstone-document.md` as the source of truth.
- Keep the UI beginner-friendly and suitable for capstone demonstration.

## Allowed React Native Components
Use basic components such as:
- View
- Text
- TextInput
- Button
- Pressable
- ScrollView
- FlatList
- Image
- ActivityIndicator

## UI Style
- Simple spacing
- Clear labels
- Large readable text
- Basic buttons
- Minimal colors
- Mobile-friendly layout
- Android-first design

## Screen Requirements
Each screen should include:
- A clear title
- Required inputs
- Required buttons/actions
- Basic validation messages
- Loading and error states when needed

## Prototype Behavior
- Placeholder UI is allowed only when the document does not define exact design.
- Mock data is allowed only when backend setup is not yet available.
- Firebase should be used when already configured.
- Screens must be functional enough for demonstration.

## Restrictions
- No maps
- No live GPS tracking
- No real payment processing
- No background checks
- No government ID verification
- No extra workflows beyond the document

## Output Expectations
When implementing UI:
1. State which screen is being implemented.
2. List the files changed.
3. Provide complete code.
4. Keep components reusable where useful.
5. Make sure the screen can run in Expo.