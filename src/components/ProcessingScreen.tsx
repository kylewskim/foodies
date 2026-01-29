import broccoliImage from '../assets/img/broccoli.png';

interface ProcessingScreenProps {
  message?: string;
}

export function ProcessingScreen({ message = 'Processing Receipt...' }: ProcessingScreenProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#f7f6ef',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      zIndex: 1000,
    }}>
      {/* Animated Broccoli */}
      <div style={{
        width: '191px',
        height: '194px',
        animation: 'bounce 1.5s ease-in-out infinite, wiggle 2s ease-in-out infinite',
      }}>
        <img 
          src={broccoliImage} 
          alt="Processing"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Processing Text */}
      <p style={{
        fontFamily: '"Canela", Georgia, serif',
        fontSize: '28px',
        fontWeight: '300',
        color: '#073d35',
        textAlign: 'center',
        letterSpacing: '-0.042px',
        margin: 0,
      }}>
        {message}
      </p>

      {/* Loading dots */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#073d35',
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Keyframe animations */}
      <style>
        {`
          @keyframes bounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-15px);
            }
          }

          @keyframes wiggle {
            0%, 100% {
              transform: rotate(-3deg);
            }
            50% {
              transform: rotate(3deg);
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 0.3;
              transform: scale(0.8);
            }
            50% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
    </div>
  );
}
