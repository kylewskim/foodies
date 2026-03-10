# Free AI Model Options

The project is currently configured to use **Groq**. Other options are also available.

## ✅ Current Setup: Groq (Recommended)

### Benefits
- ⚡ **Very fast** (hundreds of tokens per second)
- 💰 **Completely free** (no credit card required)
- 🔧 **OpenAI-compatible** (minimal code changes)
- 🌍 **Stable** (no CORS issues)

### Setup
1. Go to https://console.groq.com/
2. Sign in with Google or GitHub
3. API Keys → Create API Key
4. Add this to the `.env` file:
   ```
   VITE_GROQ_API_KEY=gsk_paste_your_key_here
   ```

### Available Free Models
- `llama-3.3-70b-versatile` (most capable)
- `mixtral-8x7b-32768` (fast and stable)

---

## Other Free Options

### 1. Hugging Face Inference API

**Benefits**: access to many open-source models  
**Drawbacks**: rate limits apply, and it can be slower

**Setup**:
```typescript
// openaiClient.ts
baseURL: 'https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct'
```

**API key**: https://huggingface.co/settings/tokens

---

### 2. Ollama (Run Locally) - Completely Free

**Benefits**:
- 💯 **Completely free** (no internet required)
- 🔒 **Privacy-friendly** (data stays local)
- ⚡ **Fast** (runs locally)

**Drawbacks**:
- Requires installation
- A GPU is recommended

**Setup**:
```bash
# Install Ollama
brew install ollama  # macOS
# Or download it from https://ollama.ai/download

# Download a model
ollama pull llama3.2

# Start the server
ollama serve
```

```typescript
// openaiClient.ts
baseURL: 'http://localhost:11434/v1'
apiKey: 'ollama' // No real key required
```

---

### 3. Google Gemini (Free Credits)

**Benefits**: powerful models from Google  
**Drawbacks**: becomes paid after credits are exhausted

**Setup**:
1. https://aistudio.google.com/app/apikey
2. Create an API key
3. Use the `@google/generative-ai` package

---

### 4. Anthropic Claude (Free Credits)

**Benefits**: very capable model  
**Drawbacks**: becomes paid after credits are exhausted

**Setup**:
1. https://console.anthropic.com/
2. Claim the free credits
3. Create an API key

---

## Current Recommendation: Groq

**Why**:
- ✅ Easiest to set up
- ✅ Very fast
- ✅ Completely free
- ✅ Stable

It works immediately once you add the Groq API key to the `.env` file.

---

## Troubleshooting

### ERR_ADDRESS_INVALID Error
- Groq does not have the CORS issue that causes this error
- Check your network connection

### When the API Key Does Not Work
1. Confirm the key format starts with `gsk_`
2. Check the key status in the Groq console
3. Restart the server with `npm run dev`

---

**Current setup**: Groq (the top recommendation) 🚀
