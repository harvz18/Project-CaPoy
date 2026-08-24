# MULTIVENT Mobile Application

MULTIVENT is an Expo and React Native application for planning events and managing vendors.

## Requirements

- Node.js 20.19 or newer
- npm
- Expo Go on a physical device, or an Android/iOS simulator

## Setup

```bash
npm install
npm start
```

After Expo starts, scan the QR code with Expo Go. You can also launch a platform directly:

```bash
npm run android
npm run ios
npm run web
```

## Checks

```bash
npm run typecheck
npm run lint
```

## Project structure

```text
index.ts                 Expo entry point
app.json                 Expo application configuration
src/App.tsx              Root application component
src/components/          Reusable React Native components
src/screens/             Application screens
src/theme/               Design tokens and typography
```

Expo uses Metro as its bundler, so the project does not need an HTML entry point or global CSS files.
