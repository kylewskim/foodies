import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext'
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
