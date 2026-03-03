# Foodies Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI API (AI 기능 활성화)

**AI 기능을 사용하려면 OpenAI API 키가 필요합니다.**

1. [OpenAI Platform](https://platform.openai.com/api-keys)에서 API 키 발급
2. 프로젝트 루트에 `.env` 파일 생성:

```bash
VITE_OPENAI_API_KEY=sk-your-api-key-here
```

> ⚠️ **API 키가 없으면?** 
> - 앱은 정상 작동하지만 기본 키워드 매칭을 사용합니다
> - AI 기능 없이도 기본적인 분류와 유통기한 추정이 가능합니다

### 3. Configure Firebase

**Important:** Before running the app, you must configure Firebase.

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use an existing one)
3. Enable **Firestore Database**:
   - Go to Build → Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" for development
   - Select a location
4. Get your Firebase config:
   - Go to Project Settings (⚙️ icon)
   - Scroll down to "Your apps"
   - Click the Web icon (`</>`) to add a web app
   - Register your app (name it "Foodies")
   - Copy the `firebaseConfig` object

5. Update `src/firebase/firebaseConfig.ts`:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### 3.1 CI Smoke Test for /api/recommend (Optional)

This repo includes a GitHub Actions smoke test that calls the deployed
`/api/recommend` endpoint. To enable it, add a repository secret named
`RECOMMENDER_API_BASE_URL` with your deployed base URL (no `/api/recommend`
suffix), for example:

```
https://foodies-dusky-pi.vercel.app
```

If the secret is not set, the CI step skips the smoke test.

### 3.2 Calling the Deployed /api/recommend

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
environment likely does not have `RECOMMENDER_URL` set. In that case, add it in
Vercel and redeploy:

- Vercel → Project → Settings → Environment Variables
- Name: `RECOMMENDER_URL`
- Value: `https://<your-render-service>.onrender.com/recommend`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production

```bash
npm run build
```

Serve the `dist/` folder using any static hosting service.

## Testing the Application

### Manual Entry Flow

1. Click "✍️ Manual Entry"
2. Enter items (one per line):
   ```
   2 Apples
   Milk
   Chicken Breast
   Whole Wheat Bread
   Fresh Spinach
   Greek Yogurt
   ```
3. Click "Process Items"
4. Review the processed items with auto-estimated expiration dates
5. Click "Edit" to manually override any expiration date
6. Click "Save All to Firestore"

### Image Upload Flow (MVP - Mock Implementation)

1. Click "📷 Upload Receipt Image"
2. Select any image file
3. Mock OCR will return sample data after 1.5 seconds
4. Items will be processed automatically
5. Follow steps 4-6 from Manual Entry Flow

## Firestore Data Structure

### Collections

#### `receipts`
- `receiptId` (auto-generated document ID)
- `sessionId` (string)
- `purchaseDate` (string | null) - ISO date
- `createdAt` (string) - ISO date

#### `items`
- `itemId` (auto-generated document ID)
- `receiptId` (string)
- `name` (string)
- `quantity` (string | null)
- `category` (string) - one of: produce, dairy, meat, seafood, bakery, pantry, frozen, snack, beverage, non-food, unknown
- `purchaseDate` (string) - ISO date
- `autoExpirationDate` (string) - ISO date
- `manualExpirationDate` (string | null) - ISO date
- `expirationSource` (string) - 'auto' or 'manual'

## Key Features Implemented

### ✅ Dual Input Methods
- Image upload with mock OCR
- Manual text entry

### ✅ Smart Processing Pipeline
1. **normalizeInputText**: Extracts items and purchase date
2. **classifyItems**: Categorizes items (produce, dairy, meat, etc.)
3. **estimateExpirationDays**: Estimates shelf life based on category

### ✅ Editable Expiration Dates
- Auto-estimated dates shown as recommendations
- Click "Edit" to manually override
- Manual dates take precedence
- Source indicator (Auto/Manual)

### ✅ Session Management
- No login required
- Session ID stored in localStorage
- Persists across page reloads

### ✅ Firebase Integration
- Save receipts and items to Firestore
- Ready for querying and analytics

## Technology Stack

- **React 19.2.3** with TypeScript
- **Vite 4.5.0** (compatible with Node.js 18)
- **Firebase 12.7.0** for Firestore database
- **No CSS framework** - clean inline styles

## Project Structure

```
foodies/
├── src/
│   ├── components/         # React components
│   │   ├── ImageUpload.tsx
│   │   ├── ManualInput.tsx
│   │   ├── ItemList.tsx
│   │   └── ItemRow.tsx
│   ├── llm/               # LLM functions (mock implementations)
│   │   ├── normalizeInputText.ts
│   │   ├── classifyItems.ts
│   │   └── estimateExpirationDays.ts
│   ├── firebase/          # Firebase configuration and operations
│   │   ├── firebaseConfig.ts
│   │   └── saveReceipt.ts
│   ├── utils/             # Utility functions
│   │   ├── session.ts
│   │   └── dateHelpers.ts
│   ├── types.ts           # TypeScript type definitions
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── public/                # Static assets
├── index.html             # HTML entry point
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite configuration
```

## Future Enhancements

### Ready to Add:
- **Real OCR**: Replace mock with Tesseract.js or Google Cloud Vision
- **Real LLM**: Replace keyword matching with OpenAI/Anthropic API
- **Authentication**: Add Firebase Auth for multi-user support
- **Notifications**: Push notifications for expiring items
- **Analytics**: Dashboard showing waste reduction metrics
- **Shopping List**: Generate lists from inventory
- **Barcode Scanner**: Quick item entry via barcode
- **Recipe Suggestions**: Based on available ingredients

## Common Issues

### Node.js Version
- **Issue**: Vite requires specific Node.js version
- **Solution**: Using Vite 4.5.0 (compatible with Node.js 18+)

### Firebase Errors
- **Issue**: Firebase operations fail
- **Solution**: Ensure `firebaseConfig.ts` has valid credentials

### Build Errors
- **Issue**: TypeScript compilation errors
- **Solution**: Run `npm install` to ensure all dependencies are installed

## Development Tips

### Adding New Food Categories
Edit `src/types.ts` to add new categories to `FoodCategory` type, then update `src/llm/classifyItems.ts` and `src/llm/estimateExpirationDays.ts`.

### Customizing Expiration Estimates
Modify `src/llm/estimateExpirationDays.ts` to adjust category defaults and item-specific rules.

### Styling
Current implementation uses inline styles. To add a CSS framework:
```bash
npm install tailwindcss
```
Then configure according to Tailwind docs.

## Testing Checklist

- [ ] Manual entry processes items correctly
- [ ] Quantities are extracted (e.g., "2 Apples")
- [ ] Items are classified into correct categories
- [ ] Expiration dates are calculated based on purchase date
- [ ] Manual expiration editing works
- [ ] Source changes from "Auto" to "Manual" after edit
- [ ] Image upload triggers mock OCR
- [ ] Save to Firestore succeeds (check Firebase Console)
- [ ] Session ID persists in localStorage
- [ ] Start Over resets the state

## Support

For issues or questions, check:
1. Firebase Console for data
2. Browser Console for JavaScript errors
3. Network tab for Firebase API calls

---

Built with ❤️ to reduce food waste
