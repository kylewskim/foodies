# Google Cloud Vision API Setup Guide

Google Vision API provides **more accurate and faster OCR**.

## 🎯 Benefits

- ✅ **More accurate recognition** (especially for Korean)
- ✅ **Fast processing** (1-2 seconds)
- ✅ **Free credits** (1,000 requests per month)
- ✅ **Support for multiple languages**

## 📋 Setup Steps

### Step 1: Create a Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Sign in with your Google account
3. Select the project picker at the top, then click **New Project**
4. Enter a project name (for example, "Freshli OCR")
5. Click **Create**

### Step 2: Enable the Vision API

1. In the left menu, go to **APIs & Services** → **Library**
2. Search for "Vision API"
3. Select **Cloud Vision API**
4. Click **Enable**

### Step 3: Create an API Key

1. In the left menu, go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **API key**
3. Copy the generated API key

### Step 4: Restrict the API Key (Security)

1. Click the generated API key
2. Under **Application restrictions**:
   - Select **HTTP referrers (web sites)**
   - Add the following under **Website restrictions**:
     - `http://localhost:5173/*`
     - `https://yourdomain.com/*` (for production)
3. Under **API restrictions**:
   - Select **Restrict key**
   - Check only **Cloud Vision API**
4. Click **Save**

### Step 5: Add It to the `.env` File

Add this to the `.env` file in the project root:

```
VITE_GOOGLE_VISION_API_KEY=AIzaSy_paste_your_copied_key_here
```

### Step 6: Restart the Server

```bash
npm run dev
```

## 💰 Free Credits

- **1,000 requests per month** for free
- After that: $1.50 per 1,000 requests
- This is enough for most users.

## 🔄 How It Works

1. **Google Vision API key available** → Use Google Vision (more accurate)
2. **No API key available** → Use Tesseract.js as a fallback

## ⚠️ Notes

- The API key is exposed in the browser
- In production, make sure to configure **API key restrictions**
- Or, preferably, handle OCR on the server side

## 🧪 Test

1. Upload a receipt image
2. Confirm that "Google Vision API" appears in the progress status
3. Verify that text extraction is fast and accurate

---

**After setup**: enjoy more accurate OCR. 🚀
