import { useNavigate } from 'react-router-dom';

export function MagicKitchenStartPage() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/magic-kitchen/result');
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <div style={{
        position: 'absolute',
        width: '455px',
        height: '453px',
        left: '-59px',
        top: '180px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(215,237,100,0.3) 0%, rgba(215,237,100,0) 70%)',
      }} />
      <div style={{
        position: 'absolute',
        width: '455px',
        height: '454px',
        left: '98px',
        top: '132px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(7,61,53,0.15) 0%, rgba(7,61,53,0) 70%)',
      }} />

      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div
          onClick={() => navigate('/recipes')}
          style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 10H5M5 10L10 15M5 10L10 5"
              stroke="#11130b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          fontFamily: '"Poppins", sans-serif',
          color: '#11130b',
        }}>
          Magic Kitchen
        </h1>
      </div>

      {/* Animated food illustration */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '186px',
        transform: 'translateX(-50%)',
        width: '327px',
        height: '305px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Broccoli image placeholder - you can replace with actual image */}
        <div style={{
          fontSize: '180px',
          animation: 'float 3s ease-in-out infinite',
        }}>
          🥦
        </div>

        {/* Decorative sparkles */}
        <div style={{
          position: 'absolute',
          top: '0',
          left: '60px',
          fontSize: '40px',
          animation: 'sparkle 2s ease-in-out infinite',
          animationDelay: '0s',
        }}>
          ✨
        </div>
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '40px',
          fontSize: '40px',
          animation: 'sparkle 2s ease-in-out infinite',
          animationDelay: '0.5s',
        }}>
          ✨
        </div>
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '40px',
          fontSize: '40px',
          animation: 'sparkle 2s ease-in-out infinite',
          animationDelay: '1s',
        }}>
          ✨
        </div>
      </div>

      {/* Text content */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '524px',
        transform: 'translateX(-50%)',
        width: '327px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <p style={{
          margin: 0,
          fontSize: '28px',
          fontFamily: '"Canela", serif',
          fontWeight: '300',
          color: '#073d35',
          letterSpacing: '-0.042px',
        }}>
          AI goes wild with idea
        </p>
        <p style={{
          margin: 0,
          fontSize: '16px',
          fontFamily: '"Poppins", sans-serif',
          color: '#073d35',
          lineHeight: '1.35',
          letterSpacing: '-0.4316px',
        }}>
          We don't guarantee it's delicious, but it'll definitely be interesting.
        </p>
      </div>

      {/* Start button */}
      <div style={{
        position: 'absolute',
        left: '20px',
        bottom: '40px',
        width: '335px',
      }}>
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: '#073d35',
            color: '#f7f6ef',
            border: 'none',
            borderRadius: '23726400px',
            fontSize: '16px',
            fontWeight: '500',
            fontFamily: '"Poppins", sans-serif',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          Start
        </button>
      </div>

      {/* Add CSS animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes sparkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.2) rotate(180deg);
          }
        }
      `}</style>
    </div>
  );
}
