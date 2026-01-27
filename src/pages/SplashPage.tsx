import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function SplashPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Wait for auth to finish loading, then wait 3 seconds
    if (!loading) {
      const timer = setTimeout(() => {
        if (user) {
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [loading, user, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#073d35',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      {/* Logo Text */}
      <h1 style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: '56px',
        fontWeight: '500',
        color: '#e3fd5c',
        letterSpacing: '0.2px',
        margin: 0,
        textAlign: 'center',
      }}>
        Freshli
      </h1>

      {/* Home Indicator */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '134px',
        height: '5px',
        backgroundColor: 'white',
        borderRadius: '100px',
      }} />
    </div>
  );
}
