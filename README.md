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
