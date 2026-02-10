import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import broccoliImage from '../assets/img/broccoli.png';

// Check if dev mode is available
const isDev = import.meta.env.DEV;

// Detect standalone PWA mode (iOS Add to Home Screen or Android TWA)
function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function LoginPage() {
  const { signInWithGoogleCredential, signInWithGoogleAccessToken, signInAsDev } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPWA = isStandalonePWA();

  // Consume access_token stored by main.tsx from OAuth redirect hash
  const handleStoredAccessToken = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogleAccessToken(accessToken);
      navigate('/');
    } catch (err: any) {
      console.error('PWA redirect login error:', err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  }, [signInWithGoogleAccessToken, navigate]);

  useEffect(() => {
    // Check sessionStorage for access_token saved by main.tsx on OAuth redirect
    const accessToken = sessionStorage.getItem('oauth_access_token');
    if (accessToken) {
      sessionStorage.removeItem('oauth_access_token');
      handleStoredAccessToken(accessToken);
    }
  }, [handleStoredAccessToken]);

  // PWA: Build Google OAuth URL manually and redirect.
  // Uses implicit flow (response_type=token) → Google redirects back with #access_token=xxx
  const handlePWALogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = window.location.origin;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid email profile',
      include_granted_scopes: 'true',
      prompt: 'select_account',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // Regular browser: GIS iframe-based login (works in Safari, Chrome, etc.)
  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError('No credential received from Google');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogleCredential(credentialResponse.credential);
      navigate('/');
    } catch (err: any) {
      console.error('Login error details:', err);
      const errorMsg = err.message || 'Failed to sign in with Google';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDevSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInAsDev();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in as dev');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100dvh', // dynamic viewport height for mobile browsers
      backgroundColor: '#f7f6ef',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '24px',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Main Content - Centered */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        maxWidth: '327px',
        width: '100%',
        flex: 1,
        minHeight: 0, // Important for flex shrinking
      }}>
        {/* Broccoli Image */}
        <div style={{
          width: 'min(191px, 40vw)',
          height: 'min(194px, 25vh)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <img
            src={broccoliImage}
            alt="Fresh broccoli"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>

        {/* Text Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          textAlign: 'center',
          color: '#073d35',
        }}>
          <h1 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(22px, 5vw, 28px)',
            fontWeight: '300',
            letterSpacing: '-0.042px',
            margin: 0,
            lineHeight: '1.2',
          }}>
            Your food, seen clearly before it's wasted.
          </h1>
          <p style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            fontWeight: '400',
            letterSpacing: '-0.4316px',
            lineHeight: '1.35',
            margin: 0,
          }}>
            See what's still here, with expiry alert
            <br />
            and personalized recipe.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            maxWidth: '300px',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Bottom Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        flexShrink: 0,
      }}>
        {/* Google Sign In Button */}
        {loading ? (
          <div style={{
            padding: '12px 32px',
            fontFamily: '"Poppins", sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            color: '#073d35',
          }}>
            Signing in...
          </div>
        ) : isPWA ? (
          /* PWA: Use redirect-based login to avoid GIS iframe issues */
          <button
            onClick={handlePWALogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '300px',
              padding: '12px 24px',
              backgroundColor: '#fff',
              border: '1px solid #dadce0',
              borderRadius: '24px',
              cursor: 'pointer',
              fontFamily: '"Poppins", sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              color: '#3c4043',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.958v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
              <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.48 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        ) : (
          /* Regular browser: GIS iframe-based button */
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google sign-in failed')}
            theme="outline"
            size="large"
            shape="pill"
            width={300}
          />
        )}

        {/* Terms Text */}
        <p style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '10px',
          fontWeight: '400',
          color: '#080808',
          textAlign: 'center',
          lineHeight: '16px',
          margin: 0,
          maxWidth: '229px',
        }}>
          By continuing, you agree to Freshli's{' '}
          <span style={{ color: '#073d35', textDecoration: 'underline' }}>
            Terms & Conditions
          </span>{' '}
          and{' '}
          <span style={{ color: '#073d35', textDecoration: 'underline' }}>
            Privacy Policy
          </span>
        </p>

        {/* Dev Mode Login - Only shown in development */}
        {isDev && (
          <button
            onClick={handleDevSignIn}
            disabled={loading}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#fef3c7',
              border: '2px dashed #f59e0b',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <span style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '12px',
              fontWeight: '500',
              color: '#92400e',
            }}>
              🔧 Dev Mode Login
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
