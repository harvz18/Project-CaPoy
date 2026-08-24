# MULTIVENT Mobile Application

A React + TypeScript mobile event planning and vendor management platform built with Vite.

## Project Structure

```
src/
├── components/        # Reusable UI components (Button, TextInput, etc.)
├── screens/          # Full-page screen components (Home, Events, etc.)
├── theme/
│   ├── tokens.ts     # Design tokens (colors, typography, spacing, radius)
│   └── global.ts     # Global styles and CSS variables
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
├── App.tsx           # Main app layout with bottom navigation
└── main.tsx          # Entry point
```

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Visit `http://localhost:5173` in your browser.

### Build for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## Design System

### Color Tokens
- **Primary**: Burgundy (#8B3A3A) — main brand color
- **Accent**: Soft Gold (#D4A574) — emphasis elements
- **Backgrounds**: White and neutral greys
- **Text**: Primary, Secondary, and Muted variations

### Typography Scale
- Display: 32px
- Screen Title: 24px
- Section: 20px
- Subheading: 18px
- Body: 16px
- Secondary: 14px
- Caption: 12px

### Spacing
4, 8, 12, 16, 20, 24, 32, 40, 48 (in pixels)

### Border Radius
- Small: 8px
- Medium: 12px
- Large: 16px
- XL: 20px
- Pill: 999px

## Navigation

Bottom navigation with five main sections:
1. **Home** — Current events, quick actions, recent events
2. **Explore** — Vendor and service discovery
3. **Events** — Event list, details, budget, and selected services
4. **Bookings** — Pending, confirmed, completed bookings
5. **Profile** — User settings, preferences, and account

## Building Screens Step-by-Step

Each screen follows this pattern:
1. Create a new TSX file in `src/screens/`
2. Import design tokens from `@theme/tokens`
3. Use base components from `@components/`
4. Export from `src/screens/index.ts`
5. Add route/navigation in `App.tsx`

## Next Steps

1. Install dependencies: `npm install`
2. Run dev server: `npm run dev`
3. Build screens one by one starting with **Explore Screen** (vendor discovery)
