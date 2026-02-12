# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite production build (output: dist/)
npm run preview      # Preview production build locally
```

Cloud Functions (requires Firebase Blaze plan for deploy):
```bash
cd functions && npm run build    # Compile functions
firebase deploy --only functions # Deploy to Firebase
```

## Architecture

**Freshli** (formerly Foodies) — a PWA for tracking grocery expiration dates, reducing food waste, and recommending recipes.

**Stack:** React 19 + TypeScript + Vite 4 + Firebase (Auth, Firestore, FCM) + vite-plugin-pwa

**Hosting:** Vercel at `foodies-dusky-pi.vercel.app` (NOT Firebase Hosting)

### Auth Flow (GIS + Firebase)

Authentication uses **Google Identity Services** (not Firebase popup/redirect) to work in iOS standalone PWA:
- Regular browsers: `<GoogleLogin>` component (iframe-based, no popup) → `signInWithCredential`
- Standalone PWA: Manual OAuth redirect (implicit flow) → capture `access_token` from URL hash → `signInWithCredential`
- `initializeAuth` is used (not `getAuth`) with explicit `indexedDBLocalPersistence` to avoid iOS ITP iframe issues
- OAuth Client ID comes from `VITE_GOOGLE_CLIENT_ID` env var — must belong to the same GCP project as Firebase (project number `397694091110`)

### Data Flow: Receipt → Items

1. Image upload → Tesseract.js OCR (client-side) or Google Vision API
2. `normalizeInputText` — hybrid: regex patterns first, OpenAI fallback
3. `classifyItems` — OpenAI with keyword fallback
4. `predictLifecycle` — rule-based shelf-life table (no API call, in `src/lifecycle/`)
5. User reviews/edits on ScanResultPage → saves to Firestore

### Recipe Recommendations

`generateRecipes` (OpenAI) → `recommendationService` → cached in Firestore `userRecipes` collection. Recipes regenerate only when new items are added, not when items are removed.

### Key Directories

- `src/contexts/AuthContext.tsx` — auth state, Google sign-in methods, onboarding check
- `src/firebase/` — Firestore ops (`saveReceipt.ts`), FCM (`notifications.ts`), config
- `src/lifecycle/` — rule-based expiration prediction (no external API)
- `src/llm/` — OpenAI integrations with local fallbacks
- `src/pages/` — 14 page components, routed via React Router v7
- `src/services/recommendationService.ts` — recipe engine wrapper
- `functions/src/index.ts` — Cloud Functions (scheduled notification sender)

### Routing

`App.tsx` defines three route wrappers:
- `<ProtectedRoute>` — requires auth + completed onboarding
- `<AuthRoute>` — redirects logged-in users away from login
- `<OnboardingRoute>` — requires auth but NOT onboarding completion

### Firestore Collections

`receipts`, `items` (per-user subcollections under `users/{uid}`), `userPreferences`, `fcmTokens`, `userRecipes`, `favoriteRecipes`

## Environment Variables

```
VITE_OPENAI_API_KEY          # OpenAI API (item classification, recipes)
VITE_PEXELS_API_KEY          # Recipe images
VITE_GOOGLE_VISION_API_KEY   # Google Vision OCR (optional, Tesseract.js is default)
VITE_FIREBASE_VAPID_KEY      # FCM web push
VITE_GOOGLE_CLIENT_ID        # Google OAuth Client ID (must match Firebase project)
```

## PWA Notes

- `vite-plugin-pwa` with `generateSW` strategy, `display: standalone`
- Apple meta tags in `index.html` for iOS home screen support
- `public/firebase-messaging-sw.js` handles background push notifications
- iOS standalone PWA has unique constraints: no popup auth, ITP blocks third-party iframes

## Language

The app UI is in English. The user (developer) communicates in Korean.
