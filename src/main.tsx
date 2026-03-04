import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Capture OAuth redirect access_token BEFORE React renders.
// Google redirects to origin#access_token=xxx, but React Router
// will strip the hash when redirecting to /login. Store it early.
const hash = window.location.hash;
if (hash && hash.includes('access_token=')) {
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  if (accessToken) {
    sessionStorage.setItem('oauth_access_token', accessToken);
    window.history.replaceState(null, '', window.location.pathname);
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const BUILD_ID = __APP_BUILD_ID__;
console.log(`🧭 Freshli bundle marker: ${BUILD_ID}`);

async function cleanupLegacyServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
      // Keep current Vite PWA SW and remove legacy/foreign registrations.
      if (scriptUrl.includes('/sw.js')) continue;
      await reg.unregister();
      console.log('🧹 Unregistered legacy service worker:', scriptUrl || '(unknown)');
    }
  } catch (err) {
    console.warn('Failed to clean up legacy service workers:', err);
  }
}

void cleanupLegacyServiceWorkers();

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update();
    window.setInterval(() => {
      registration?.update();
    }, 60_000);
  },
  onNeedRefresh() {
    console.log('♻️ New app version detected. Reloading to apply update.');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('📦 App is ready for offline use.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
