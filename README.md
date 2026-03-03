# 🥗 Foodies - Grocery Receipt & Food Tracking App

A login-free MVP web app for tracking groceries and preventing food waste by monitoring expiration dates.

## Features

- **Dual Input Methods**: Upload receipt images OR manually enter grocery items
- **Smart Processing Pipeline**: OCR → Item parsing → Food classification → Expiration estimation
- **Editable Expiration Dates**: AI suggests dates, but you can always override them
- **Firebase Storage**: Save everything to Firestore without authentication
- **Session-Based**: No login required - uses localStorage session management

## Tech Stack

- **Frontend**: React + TypeScript
- **Build Tool**: Vite
- **Database**: Firebase Firestore
- **Architecture**: Modular, client-side logic
- **Recipe Recommender**: External service (separate repo), accessed via `/api/recommend` proxy

## Project Structure

```
src/
├── components/
│   ├── ImageUpload.tsx      # Receipt image upload
│   ├── ManualInput.tsx       # Manual text entry
│   ├── ItemList.tsx          # Display items list
│   └── ItemRow.tsx           # Individual item with editable expiration
├── llm/
│   ├── normalizeInputText.ts # Parse raw text/OCR
│   ├── classifyItems.ts      # Classify food items
│   └── estimateExpirationDays.ts # Estimate expiration
├── firebase/
│   ├── firebaseConfig.ts     # Firebase initialization
│   └── saveReceipt.ts        # Firestore operations
├── utils/
│   ├── dateHelpers.ts        # Date calculations
│   └── session.ts            # Session management
├── types.ts                  # TypeScript type definitions
├── App.tsx                   # Main app component
└── main.tsx                  # Entry point
```

## Recommender Service (Separate Repo)

The deterministic RecipeRec engine lives in its own repo and is deployed separately
(Render suggested). This repo only contains the `/api/recommend` proxy and the
client-side integration (`src/services/recommendationService.ts`).

That separation keeps the frontend lightweight and allows the recommender to
scale independently.

## Data Model

### Session
- `sessionId`: string (generated and stored in localStorage)

### Receipt
- `receiptId`: string
- `sessionId`: string
- `purchaseDate`: string | null
- `createdAt`: string

### Item
- `itemId`: string
- `receiptId`: string
- `name`: string
- `quantity`: string | null
- `category`: FoodCategory
- `purchaseDate`: string
- `autoExpirationDate`: string
- `manualExpirationDate`: string | null
- `expirationSource`: 'auto' | 'manual'

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Recipe Recommender Service (separate repo)

This app proxies `/api/recommend` to a standalone service. Clone and run the
recommender locally, then point `foodies` at it with `RECOMMENDER_URL`.

```bash
# In the recommender repo
pip install -r requirements.txt
uvicorn api.server:app --host 0.0.0.0 --port 8001
```

Set the URL for the proxy:

```bash
export RECOMMENDER_URL="http://localhost:8001/recommend"
export RECOMMENDER_TIMEOUT_SECONDS="15"
```

For production, deploy the recommender (Render suggested) and set:

```bash
export RECOMMENDER_URL="https://<your-render-service>.onrender.com/recommend"
```

If you want provider results, set:

```bash
export FATSECRET_CLIENT_ID="..."
export FATSECRET_CLIENT_SECRET="..."
```

When deploying `foodies` on Vercel, add `RECOMMENDER_URL` in the
project’s Environment Variables (same value as above).

### 2.1 CI Smoke Test for /api/recommend

This repo includes a lightweight CI smoke test that calls the deployed API.
It runs on push/PR when the GitHub Actions secret `RECOMMENDER_API_BASE_URL`
is set.

Example secret value:
```
https://foodies-dusky-pi.vercel.app
```

If the secret is missing, the CI step skips the smoke test.

### 2.2 Calling the Deployed /api/recommend

Your teammate can call the deployed API through the frontend proxy as long as
the Vercel deployment has `RECOMMENDER_URL` set to the Render endpoint.

Example request:

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

If the request fails with a 5xx or “Recommender unreachable”, the Vercel
environment likely does not have `RECOMMENDER_URL` set. In that case, your
teammate should add it in Vercel:

- Vercel → Project → Settings → Environment Variables
- Name: `RECOMMENDER_URL`
- Value: `https://<your-render-service>.onrender.com/recommend`
- Redeploy after saving the env var

### 2. Configure Firebase

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Get your Firebase configuration
4. Update `src/firebase/firebaseConfig.ts` with your credentials:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage Flow

1. **Choose Input Method**: Select between image upload or manual entry
2. **Process Items**: The app will:
   - Normalize the input text
   - Classify items as food/non-food
   - Categorize items (produce, dairy, meat, etc.)
   - Estimate expiration dates
3. **Review & Edit**: View the processed items and manually adjust expiration dates if needed
4. **Save**: Click "Save All to Firestore" to persist the data

## LLM Functions

The app uses three focused LLM functions:

### 1. normalizeInputText
- **Input**: Raw OCR text or manual user text
- **Output**: Purchase date + array of items with quantities
- **Rules**: Ignores prices, totals, store info

### 2. classifyItems
- **Input**: Array of raw item names
- **Output**: Food classification and category
- **Categories**: produce, dairy, meat, seafood, bakery, pantry, frozen, snack, beverage, non-food, unknown

### 3. estimateExpirationDays
- **Input**: Normalized name + category
- **Output**: Days until expiration + confidence level
- **Assumptions**: Typical household storage, unopened items

## MVP Notes

- **OCR**: Currently using mock implementation - replace with actual OCR service (Google Cloud Vision, Tesseract.js, etc.)
- **LLM**: Using keyword-based mock implementations - replace with actual LLM API calls for production
- **Authentication**: None required for MVP - uses localStorage sessions
- **Styling**: Minimal inline styles - can be enhanced with CSS framework

## Future Extensions

This codebase is designed to easily add:
- User authentication
- Push notifications for expiring items
- Smart reminders
- Inventory analytics
- Recipe suggestions based on available ingredients
- Barcode scanning
- Shopping list generation

## Development

### Type Safety
All data flows through strict TypeScript types defined in `src/types.ts`

### Testing
Run the development server and test:
1. Manual entry flow
2. Image upload flow (mock data)
3. Expiration date editing
4. Firebase save operation

### Common Issues

**Firebase errors**: Make sure you've updated the Firebase configuration with your actual project credentials.

**Build errors**: Ensure you have Node.js installed (v18+ recommended).

## License

ISC

## Contributing

This is an MVP project. Feel free to extend and improve!

---

Built with ❤️ for reducing food waste
