# Freshli

Freshli is a mobile-first grocery tracking web app. It helps users add food items from receipt scans or manual entry, monitor expiration dates, organize inventory by storage location, and get recipe recommendations based on what is already at home.

## Live App

Production URL: [https://foodies-dusky-pi.vercel.app](https://foodies-dusky-pi.vercel.app)

The app is also installable as a Progressive Web App (PWA), so users can add it to their phone home screen and use it like a native app.

## User Guide

The PDF user manual is available at [Freshli_User_Guide.pdf](./Freshli_User_Guide.pdf).

## What The App Does

- Scan or upload a grocery receipt image
- Parse item names from OCR text
- Classify food items and estimate expiration dates
- Let users manually correct dates and item details
- Organize items by location such as fridge, freezer, and pantry
- Show recipes and recommendation results based on inventory
- Support mobile-friendly installation through Add to Home Screen

## Key User Flow

1. Open the app.
2. Sign in with Google.
3. Complete onboarding if it is your first time.
4. Add food by scanning a receipt, uploading an image, or entering items manually.
5. Review detected items and adjust expiration dates if needed.
6. Save items and manage them from the home and inventory views.
7. Explore recipe recommendations from the recipes and Magic Kitchen flows.

## Add To Home Screen

Freshli supports home screen installation on mobile devices.

### iPhone / iPad (Safari)

1. Open [https://foodies-dusky-pi.vercel.app](https://foodies-dusky-pi.vercel.app) in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Launch Freshli from the new icon on the home screen.

### Android (Chrome)

1. Open [https://foodies-dusky-pi.vercel.app](https://foodies-dusky-pi.vercel.app) in Chrome.
2. Open the browser menu.
3. Tap **Install app** or **Add to Home screen**.
4. Launch Freshli from the installed app icon.

Installing the app improves the mobile experience and enables the standalone PWA flow used by the project.

## Tech Stack

- React 19
- TypeScript
- Vite
- Firebase Auth
- Firebase Firestore
- Firebase Cloud Messaging
- OpenAI-compatible LLM calls
- Google OAuth
- `vite-plugin-pwa` / Workbox

## Project Structure

```text
freshli/
├── src/
│   ├── assets/              # Fonts, icons, images
│   ├── components/          # Reusable UI pieces
│   ├── contexts/            # React context providers, including auth
│   ├── firebase/            # Firebase config, persistence, notifications, data access
│   ├── lifecycle/           # Lifecycle prediction logic
│   ├── llm/                 # OCR parsing, classification, recipe-generation helpers
│   ├── pages/               # Route-level screens
│   ├── services/            # API-facing services such as recommendations
│   ├── utils/               # Shared utility functions
│   ├── App.tsx              # Route wiring and app shell
│   ├── main.tsx             # React bootstrap and PWA registration
│   └── sw.ts                # Service worker source for the PWA
├── scripts/                 # Utility scripts, including API smoke tests
├── functions/               # Backend helper functions used by the project
├── public/                  # Static assets served directly
├── Freshli_User_Guide.pdf   # User manual PDF
├── README.md
└── package.json
```

## Important Pages And Modules

- `src/App.tsx`: app routing, protected routes, onboarding flow, notification toast wiring
- `src/pages/LoginPage.tsx`: Google sign-in and standalone PWA login handling
- `src/pages/HomePage.tsx`: home dashboard and primary inventory overview
- `src/pages/AddItemPage.tsx`: add-food entry flow from scan, upload, or manual input
- `src/pages/RecipesPage.tsx`: recipe browsing and recommendation entry point
- `src/services/recommendationService.ts`: frontend integration with the recommendation API
- `src/firebase/saveReceipt.ts`: Firestore read/write logic for items and receipts
- `src/llm/`: OCR parsing, classification, expiration estimation, recipe helpers
- `vite.config.ts`: Vite config plus PWA manifest and dev proxy setup

## Prerequisites

- Node.js 18+
- npm
- A Firebase project
- A Google OAuth client ID for sign-in
- An optional external recommender service for `/api/recommend`

## Local Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Google sign-in

Create a `.env` file in the project root and add your Google OAuth client ID:

```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### 3. Configure Firebase

Update `src/firebase/firebaseConfig.ts` with the Firebase project you want to use if you are not using the current project configuration.

### 4. Optional: run the external recommender service

The frontend can call a separate recommendation backend through `/api/recommend`.

Run the recommender in its own repository, then point this app to it:

```bash
export RECOMMENDER_URL="http://localhost:8001/recommend"
export RECOMMENDER_TIMEOUT_SECONDS="15"
```

Optional provider credentials:

```bash
export FATSECRET_CLIENT_ID="..."
export FATSECRET_CLIENT_SECRET="..."
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## What To Expect After Running The Code

After `npm run dev`:

1. Vite starts a local development server at `http://localhost:5173`.
2. The app loads the splash or login flow first.
3. Users can sign in with Google.
4. After authentication, the app routes to onboarding for first-time users or to the home dashboard for returning users.
5. The home screen shows inventory summary cards and quick actions to add food.
6. Receipt scan, image upload, and manual entry flows lead into item processing and save flows.
7. If the recommender backend is configured, recipe recommendation features can call `/api/recommend` successfully.
8. Because PWA support is enabled in development and production, the app also registers its service worker and can behave like an installable app.

## Available Scripts

```bash
npm run dev              # Start the Vite development server
npm run build            # Type-check and build the production bundle
npm run preview          # Preview the production build locally
npm run test:recommend   # Smoke test the deployed /api/recommend endpoint
```

## Production Build

```bash
npm run build
```

This generates the production bundle in `dist/`.

To preview the built app locally:

```bash
npm run preview
```

## Recommendation Service Notes

This repository contains the frontend integration and proxy expectations for recommendations, but the deterministic recommendation engine is deployed separately.

For local development, point `RECOMMENDER_URL` to the external recommender instance.
For production on Vercel, set `RECOMMENDER_URL` in the Vercel project settings and redeploy.

Example deployed API request:

```bash
curl -X POST "https://foodies-dusky-pi.vercel.app/api/recommend" \
  -H "Content-Type: application/json" \
  -d '{
    "inventory": [
      {"name": "Eggs", "expiration_date": "2026-03-10", "category": "dairy"},
      {"name": "Spinach", "expiration_date": "2026-03-06", "category": "produce"}
    ],
    "restrictions": ["allergy_nuts"],
    "top_k": 6,
    "debug": false
  }'
```

## PWA Notes

- The app uses `vite-plugin-pwa` with an injected service worker.
- The manifest is configured for standalone display.
- The project includes dedicated standalone login handling for installed PWAs.
- Home screen installation is supported on iOS Safari and Android Chrome.

## Troubleshooting

### Google sign-in fails

- Confirm `VITE_GOOGLE_CLIENT_ID` is set correctly.
- Confirm the authorized JavaScript origins in Google Cloud include your local and deployed URLs.

### Recipe requests fail

- Confirm `RECOMMENDER_URL` is set.
- Confirm the external recommender service is running and reachable.
- On Vercel, update the environment variable and redeploy if `/api/recommend` returns a 5xx.

### Firebase access issues

- Confirm the Firebase project configuration is correct.
- Confirm Firestore and Auth are enabled for the selected Firebase project.

## Current Deployment

- App: [https://foodies-dusky-pi.vercel.app](https://foodies-dusky-pi.vercel.app)
- Platform: Vercel
- Installable: Yes, via Add to Home Screen / Install App
