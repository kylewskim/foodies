# 무료 AI 모델 사용 옵션

현재 **Groq**로 설정되어 있습니다. 다른 옵션들도 있습니다!

## ✅ 현재 설정: Groq (추천!)

### 장점
- ⚡ **매우 빠름** (초당 수백 토큰)
- 💰 **완전 무료** (신용카드 불필요)
- 🔧 **OpenAI 호환** (코드 수정 최소)
- 🌍 **안정적** (CORS 문제 없음)

### 설정 방법
1. https://console.groq.com/ 접속
2. Google/GitHub로 로그인
3. API Keys → Create API Key
4. `.env` 파일에 추가:
   ```
   VITE_GROQ_API_KEY=gsk_여기에_키_붙여넣기
   ```

### 사용 가능한 무료 모델
- `llama-3.3-70b-versatile` (가장 강력)
- `mixtral-8x7b-32768` (빠르고 안정적)

---

## 다른 무료 옵션들

### 1. Hugging Face Inference API

**장점**: 많은 오픈소스 모델 사용 가능  
**단점**: Rate limit 있음, 느릴 수 있음

**설정**:
```typescript
// openaiClient.ts
baseURL: 'https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct'
```

**API 키**: https://huggingface.co/settings/tokens

---

### 2. Ollama (로컬 실행) - 완전 무료!

**장점**: 
- 💯 **완전 무료** (인터넷 불필요)
- 🔒 **프라이버시 보호** (데이터가 외부로 안 나감)
- ⚡ **빠름** (로컬 실행)

**단점**: 
- 설치 필요
- GPU 권장

**설정**:
```bash
# Ollama 설치
brew install ollama  # macOS
# 또는 https://ollama.ai/download

# 모델 다운로드
ollama pull llama3.2

# 실행
ollama serve
```

```typescript
// openaiClient.ts
baseURL: 'http://localhost:11434/v1'
apiKey: 'ollama' // 실제 키 불필요
```

---

### 3. Google Gemini (무료 크레딧)

**장점**: Google의 강력한 모델  
**단점**: 크레딧 소진 시 유료

**설정**:
1. https://aistudio.google.com/app/apikey
2. API 키 발급
3. `@google/generative-ai` 패키지 사용

---

### 4. Anthropic Claude (무료 크레딧)

**장점**: 매우 강력한 모델  
**단점**: 크레딧 소진 시 유료

**설정**:
1. https://console.anthropic.com/
2. 무료 크레딧 받기
3. API 키 발급

---

## 현재 추천: Groq

**이유**:
- ✅ 설정이 가장 쉬움
- ✅ 매우 빠름
- ✅ 완전 무료
- ✅ 안정적

`.env` 파일에 Groq API 키만 추가하면 바로 작동합니다!

---

## 문제 해결

### ERR_ADDRESS_INVALID 에러
- Groq는 CORS 문제가 없어서 이 에러가 발생하지 않습니다
- 네트워크 연결 확인

### API 키가 작동하지 않을 때
1. API 키 형식 확인 (`gsk_`로 시작)
2. Groq 콘솔에서 키 상태 확인
3. 서버 재시작 (`npm run dev`)

---

**현재 설정**: Groq (가장 추천!) 🚀
