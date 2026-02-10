import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import broccoliImage from '../assets/img/broccoli.png';

// Check if dev mode is available
const isDev = import.meta.env.DEV;

export function LoginPage() {
  const { signInWithGoogleCredential, signInAsDev } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        ) : (
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
