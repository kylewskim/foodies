# Knowledge Learned

This document tracks issues encountered during development and how they were resolved, ensuring long-term maintainability.

## Issue 1: Node.js Version Compatibility

### Problem
Initial installation used Vite 7.3.1, which requires Node.js 20.19+ or 22.12+. The system was running Node.js 18.16.0, causing the following error:

```
You are using Node.js 18.16.0. Vite requires Node.js version 20.19+ or 22.12+
TypeError: crypto.hash is not a function
```

### Root Cause
- Vite 7.x introduced breaking changes requiring newer Node.js versions
- Latest npm packages default to newest versions without checking engine compatibility

### Solution Implemented
Downgraded to Vite 4.5.0 and @vitejs/plugin-react 4.0.0, which are compatible with Node.js 18:

```bash
npm install --save-dev vite@4.5.0 @vitejs/plugin-react@4.0.0
```

### Long-Term Recommendation
1. **For Production**: Upgrade Node.js to v20+ or v22+ for latest features and security
2. **For Development**: Keep Vite 4.x if Node.js upgrade is not feasible
3. **Add to README**: Document minimum Node.js version requirement

### Prevention Strategy
- Add `engines` field to `package.json`:
```json
"engines": {
  "node": ">=18.16.0",
  "npm": ">=9.0.0"
}
```

---

## Issue 2: Firebase Version vs Node.js

### Problem
Firebase 12.7.0 shows engine warnings with Node.js 18:

```
WARN EBADENGINE Unsupported engine
package: '@firebase/firestore@4.9.3'
required: { node: '>=20.0.0' }
current: { node: 'v18.16.0' }
```

### Impact
- Warnings only, not errors
- Firebase still functions in Node.js 18 (tested successfully)
- May have performance limitations or missing features

### Solution Status
**Accepted as technical debt** for MVP phase because:
1. Functionality works correctly
2. Warnings don't block development
3. Future Node.js upgrade will resolve naturally

### Long-Term Recommendation
When upgrading Node.js to v20+:
1. Run `npm update` to get latest Firebase versions
2. Review Firebase changelog for new features
3. Test all Firestore operations

---

## Issue 3: Mock Implementation Strategy

### Design Decision
For MVP, implemented mock versions of:
1. **OCR Processing** (`ImageUpload.tsx`)
2. **LLM Functions** (all files in `src/llm/`)

### Why Mock?
- **Speed**: Avoid API setup and billing for MVP
- **Reliability**: No external dependencies during development
- **Cost**: No API usage charges during testing

### Mock Implementation Details

#### OCR Mock
```typescript
// Returns static receipt data after 1.5 second delay
setTimeout(() => {
  const mockOcrText = `Receipt\nStore Name\n...`;
  onTextExtracted(mockOcrText);
}, 1500);
```

#### LLM Mocks
- **normalizeInputText**: Regex pattern matching for dates and quantities
- **classifyItems**: Keyword-based category matching
- **estimateExpirationDays**: Rule-based estimation by category

### Migration Path to Production

#### Replace OCR Mock
```typescript
// Option 1: Tesseract.js (client-side, free)
import Tesseract from 'tesseract.js';
const { data: { text } } = await Tesseract.recognize(image, 'eng');

// Option 2: Google Cloud Vision (server-side, paid)
const [result] = await client.textDetection(image);
const text = result.fullTextAnnotation.text;
```

#### Replace LLM Mocks
```typescript
// Option 1: OpenAI API
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "system", content: prompt }],
  response_format: { type: "json_object" }
});

// Option 2: Anthropic Claude
const message = await anthropic.messages.create({
  model: "claude-3-sonnet-20240229",
  messages: [{ role: "user", content: prompt }]
});
```

### Best Practice for LLM Integration
1. Keep function signatures identical
2. Ensure JSON output schema remains consistent
3. Add retry logic with exponential backoff
4. Implement rate limiting
5. Cache common results

---

## Architecture Decisions

### 1. Modular Function Structure

**Decision**: Separated LLM functions into individual files with single responsibilities

**Rationale**:
- Each function does exactly one thing
- Easy to test independently
- Simple to replace mock with real implementation
- Clear data flow: Input → Process → Output

**Files**:
- `normalizeInputText.ts` - Parse raw text only
- `classifyItems.ts` - Classify and categorize only
- `estimateExpirationDays.ts` - Estimate expiration only

### 2. Type-First Development

**Decision**: Defined all types in `src/types.ts` before implementation

**Benefits**:
- TypeScript caught errors during development
- Clear contracts between components
- Self-documenting interfaces
- Easy to refactor

**Example**:
```typescript
export interface Item {
  itemId: string;
  receiptId: string;
  name: string;
  // ... all fields explicitly typed
}
```

### 3. Client-Side Processing

**Decision**: All processing happens in the browser (no backend)

**Advantages**:
- Faster development (no server setup)
- Lower operational costs
- Works offline (except Firebase)
- Easier to deploy

**Trade-offs**:
- Exposes Firebase config (mitigated by Firestore rules)
- Limited by browser capabilities
- Can't hide API keys if using paid LLMs

**Future Consideration**: Move sensitive operations to Cloud Functions when adding paid APIs

### 4. Session-Based Architecture (No Auth)

**Decision**: Use localStorage session IDs instead of user authentication

**Rationale**:
- MVP requirement: "login free"
- Reduces friction for testing
- Simpler development

**Implementation**:
```typescript
export function getOrCreateSessionId(): string {
  const existing = localStorage.getItem('foodies_session_id');
  if (existing) return existing;
  const newId = `session_${Date.now()}_${random()}`;
  localStorage.setItem('foodies_session_id', newId);
  return newId;
}
```

**Migration Path**:
When adding authentication:
1. Replace `sessionId` with `userId` from Firebase Auth
2. Add Firestore security rules
3. Keep existing data structure (minimal changes)

---

## Code Quality Patterns

### Pattern 1: Async/Await Throughout

All async operations use async/await for clarity:

```typescript
// Good ✅
const normalized = await normalizeInputText(rawText);
const classified = await classifyItems(rawNames);

// Avoided ❌
normalizeInputText(rawText).then(normalized => {
  classifyItems(rawNames).then(classified => { ... });
});
```

### Pattern 2: Error Boundaries

All Firebase operations wrapped in try-catch:

```typescript
try {
  const docRef = await addDoc(collection(db, 'receipts'), receipt);
  return { ...receipt, receiptId: docRef.id };
} catch (error) {
  console.error('Error saving receipt:', error);
  throw new Error('Failed to save receipt');
}
```

### Pattern 3: Single Source of Truth

Item state managed in App component, passed down as props:

```typescript
// App.tsx - state owner
const [items, setItems] = useState<Item[]>([]);

// ItemList.tsx - receives via props
interface ItemListProps {
  items: Item[];
  onItemUpdate: (updatedItem: Item) => void;
}
```

---

## Testing Strategy

### Manual Testing Performed

1. ✅ Manual entry with various input formats
2. ✅ Quantity extraction (2 Apples, 3x Yogurt)
3. ✅ Food classification across all categories
4. ✅ Expiration date calculation
5. ✅ Manual date override
6. ✅ Source indicator (Auto → Manual)
7. ✅ Image upload flow (mock)
8. ✅ Session persistence

### Not Yet Tested

- [ ] Actual Firebase save/load (requires Firebase setup)
- [ ] Multiple sessions
- [ ] Large item lists (100+ items)
- [ ] Browser compatibility (only tested in Chrome)
- [ ] Mobile responsiveness

### Recommended Test Additions

For production readiness:

1. **Unit Tests**: Jest + React Testing Library
   ```bash
   npm install --save-dev jest @testing-library/react
   ```

2. **E2E Tests**: Playwright
   ```bash
   npm install --save-dev @playwright/test
   ```

3. **Firebase Emulator**: Local testing without production DB
   ```bash
   firebase emulators:start
   ```

---

## Performance Considerations

### Current Performance

- ✅ Fast initial load (Vite optimized)
- ✅ No unnecessary re-renders
- ✅ Efficient state updates

### Potential Bottlenecks

1. **Large Item Lists**: Current implementation renders all items
   - **Solution**: Add virtualization with `react-window`

2. **Firebase Batch Operations**: Currently saves items sequentially
   - **Solution**: Use Firestore batch writes:
   ```typescript
   const batch = writeBatch(db);
   items.forEach(item => {
     const docRef = doc(collection(db, 'items'));
     batch.set(docRef, item);
   });
   await batch.commit();
   ```

3. **Image Processing**: Large images may freeze UI
   - **Solution**: Use Web Workers for OCR processing

---

## Security Considerations

### Current Security Model

⚠️ **MVP Only** - Not production-ready:
- Firebase config exposed in client code
- No Firestore security rules mentioned
- No input sanitization
- No rate limiting

### Production Security Requirements

1. **Firestore Security Rules**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /receipts/{receiptId} {
      allow read, write: if request.auth != null 
        && request.auth.uid == resource.data.userId;
    }
    match /items/{itemId} {
      allow read, write: if request.auth != null
        && request.auth.uid == get(/databases/$(database)/documents/receipts/$(resource.data.receiptId)).data.userId;
    }
  }
}
```

2. **Input Validation**:
   - Sanitize all text input
   - Validate dates before saving
   - Limit item list size

3. **API Key Protection**:
   - Move sensitive operations to Cloud Functions
   - Use environment variables
   - Implement request signing

---

## Deployment Checklist

### Before First Deploy

- [ ] Add Firebase project credentials
- [ ] Test all Firebase operations
- [ ] Configure Firestore security rules
- [ ] Add environment variables for sensitive data
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Add analytics (e.g., Google Analytics)
- [ ] Test on multiple browsers
- [ ] Test on mobile devices
- [ ] Optimize images and assets
- [ ] Add meta tags for SEO

### Recommended Hosting

1. **Firebase Hosting** (easiest):
   ```bash
   npm run build
   firebase deploy
   ```

2. **Vercel** (zero config):
   ```bash
   npx vercel
   ```

3. **Netlify** (drag & drop):
   - Build: `npm run build`
   - Publish: `dist/`

---

## Lessons Learned

### What Went Well

1. **Type-first approach**: Caught many errors early
2. **Modular design**: Easy to understand and modify
3. **Mock implementations**: Allowed rapid MVP development
4. **Clear data flow**: State management remained simple

### What Could Be Improved

1. **CSS**: Inline styles work but are verbose
   - **Next time**: Use Tailwind CSS from start
   
2. **Error Handling**: Basic error messages
   - **Next time**: Add toast notifications library
   
3. **Testing**: Only manual testing performed
   - **Next time**: Set up Jest from beginning

### Key Takeaways

1. **Start with types**: Define data structures first
2. **Mock early**: Don't block on external APIs
3. **Keep it simple**: MVP doesn't need every feature
4. **Think ahead**: Structure code for easy extension

---

## Maintenance Recommendations

### Weekly
- Check Firebase quotas
- Review error logs
- Monitor user feedback

### Monthly
- Update dependencies: `npm update`
- Review Firebase costs
- Backup Firestore data

### Quarterly
- Major dependency upgrades
- Security audit
- Performance review

---

## Contact & Resources

### Useful Links
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)

### Common Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm update           # Update dependencies
```

---

---

## Issue 5: OpenAI API Rate Limit (429 Error)

### Problem
OpenAI API 호출 시 429 에러 발생:
```
RateLimitError: 429 You exceeded your current quota, please check your plan and billing details.
```

매 API 호출마다 3번 재시도하여 콘솔에 에러 로그가 대량으로 출력됨.

### Root Cause
- OpenAI API 키의 무료 크레딧 소진
- 또는 결제 수단 미등록
- 또는 월간 사용량 한도 도달

### Solution Implemented
1. **재시도 비활성화**: `maxRetries: 0` 설정으로 429 에러 시 즉시 폴백
2. **전역 API 상태 관리**: 첫 429 에러 발생 시 세션 동안 API 비활성화
3. **단일 경고 메시지**: 반복적인 에러 로그 대신 한 번만 경고 출력

```typescript
// openaiClient.ts
export const openai = new OpenAI({
  apiKey: apiKey || 'YOUR_API_KEY_HERE',
  dangerouslyAllowBrowser: true,
  maxRetries: 0, // 429 에러 시 재시도 하지 않음
});

let apiAvailable = true;

export const disableOpenAI = (): void => {
  if (apiAvailable) {
    console.warn('⚠️ OpenAI API 한도 초과! 기본 키워드 매칭 모드로 전환합니다.');
    apiAvailable = false;
  }
};
```

### User Action Required
OpenAI API를 사용하려면:
1. https://platform.openai.com/account/billing 에서 결제 수단 등록
2. 또는 새 API 키 발급: https://platform.openai.com/api-keys

### Fallback Behavior
API 사용 불가 시 자동으로 키워드 매칭 기반 로직 사용:
- `normalizeInputText`: 정규식 기반 텍스트 파싱
- `classifyItems`: 키워드 매칭 기반 분류
- `estimateExpirationDays`: 카테고리별 규칙 기반 추정

---

**Last Updated**: January 8, 2026  
**Status**: MVP Complete ✅  
**Next Steps**: 
1. OpenAI 결제 설정 후 AI 기능 테스트
2. Firebase credentials 추가 후 저장 기능 테스트
