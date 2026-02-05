interface RecipeCardSkeletonProps {
  count?: number;
}

export function RecipeCardSkeleton({ count = 3 }: RecipeCardSkeletonProps) {
  const pulseKeyframes = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;

  const skeletonStyle = {
    backgroundColor: '#e0e0e0',
    borderRadius: '8px',
    animation: 'pulse 1.5s ease-in-out infinite',
  };

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '9px',
            }}
          >
            {/* Image Skeleton */}
            <div
              style={{
                ...skeletonStyle,
                width: '100%',
                height: '152px',
                borderRadius: '16px',
              }}
            />

            {/* Info Skeleton */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Title */}
              <div
                style={{
                  ...skeletonStyle,
                  width: '60%',
                  height: '18px',
                }}
              />
              {/* Author */}
              <div
                style={{
                  ...skeletonStyle,
                  width: '30%',
                  height: '14px',
                }}
              />
              {/* Description line 1 */}
              <div
                style={{
                  ...skeletonStyle,
                  width: '100%',
                  height: '14px',
                }}
              />
              {/* Description line 2 */}
              <div
                style={{
                  ...skeletonStyle,
                  width: '85%',
                  height: '14px',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
