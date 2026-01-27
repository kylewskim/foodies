import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Broccoli image - using a placeholder or you can add actual image
const broccoliImage = 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=400&fit=crop';

export function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px',
      paddingBottom: '140px', // Space for bottom section (button + terms + indicator)
    }}>
      {/* Main Content - Centered */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        maxWidth: '327px',
        width: '100%',
      }}>
        {/* Broccoli Image */}
        <div style={{
          width: '191px',
          height: '194px',
          overflow: 'hidden',
        }}>
          <img
            src={broccoliImage}
            alt="Fresh broccoli"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>

        {/* Text Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'center',
          color: '#073d35',
        }}>
          <h1 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: '28px',
            fontWeight: '300',
            letterSpacing: '-0.042px',
            margin: 0,
            lineHeight: 'normal',
          }}>
            Your food, seen clearly before it's wasted.
          </h1>
          <p style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '16px',
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
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          padding: '12px 16px',
          borderRadius: '8px',
          marginTop: '24px',
          fontSize: '14px',
          maxWidth: '300px',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Bottom Section */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        paddingBottom: '34px',
        paddingTop: '24px',
        backgroundColor: '#f7f6ef',
      }}>
        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 32px',
            backgroundColor: '#d3e2d0',
            border: 'none',
            borderRadius: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <span style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              color: '#073d35',
            }}>
              Signing in...
            </span>
          ) : (
            <>
              {/* Google Icon */}
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '21.818px',
                backgroundColor: '#fefafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <span style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: '#073d35',
                letterSpacing: '-0.3125px',
                lineHeight: '24px',
              }}>
                Log in with Google
              </span>
            </>
          )}
        </button>

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
          By continuing, you agree to Still's{' '}
          <span style={{ color: '#073d35', textDecoration: 'underline' }}>
            Terms & Conditions
          </span>{' '}
          and{' '}
          <span style={{ color: '#073d35', textDecoration: 'underline' }}>
            Privacy Policy
          </span>
        </p>

        {/* Home Indicator */}
        <div style={{
          width: '134px',
          height: '5px',
          backgroundColor: 'black',
          borderRadius: '100px',
          marginTop: '-16px',
        }} />
      </div>
    </div>
  );
}
