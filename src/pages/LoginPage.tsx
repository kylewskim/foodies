import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fff',
      padding: '20px',
    }}>
      {/* Logo/Brand */}
      <div style={{
        marginBottom: '48px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '16px',
        }}>
          🥗
        </div>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#000',
          margin: '0 0 8px 0',
        }}>
          Foodies
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#666',
          margin: 0,
        }}>
          Reduce food waste, save money
        </p>
      </div>

      {/* Features List */}
      <div style={{
        marginBottom: '48px',
        maxWidth: '280px',
      }}>
        {[
          { icon: '📷', text: 'Scan receipts to track groceries' },
          { icon: '⏰', text: 'Get expiration reminders' },
          { icon: '🍳', text: 'Discover recipes with your ingredients' },
        ].map((feature, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '24px' }}>{feature.icon}</span>
            <span style={{ fontSize: '14px', color: '#333' }}>{feature.text}</span>
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px',
          maxWidth: '300px',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Google Sign In Button */}
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          width: '100%',
          maxWidth: '300px',
          padding: '14px 24px',
          backgroundColor: '#fff',
          border: '1px solid #ddd',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '500',
          color: '#333',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }}
      >
        {loading ? (
          <span>Signing in...</span>
        ) : (
          <>
            {/* Google Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24">
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
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* Footer */}
      <p style={{
        marginTop: '32px',
        fontSize: '12px',
        color: '#999',
        textAlign: 'center',
      }}>
        By continuing, you agree to our Terms of Service
      </p>
    </div>
  );
}
