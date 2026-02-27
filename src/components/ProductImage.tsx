export const CATEGORY_EMOJI: Record<string, string> = {
  Produce: '🥬', Protein: '🍖', Dairy: '🥛', Grains: '🌾',
  Beverages: '🥤', Snacks: '🍪', Condiments: '🧂', Canned: '🥫',
  Frozen: '🧊', Other: '📦', Prepared: '🍱',
};

interface ProductImageProps {
  imageUrl?: string | null;
  name: string;
  category?: string;
  size?: number;
  borderRadius?: number | string;
}

export function ProductImage({
  imageUrl,
  name,
  category,
  size = 60,
  borderRadius = 8,
}: ProductImageProps) {
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(size * 0.47),
    overflow: 'hidden',
    flexShrink: 0,
    borderRadius,
  };

  if (!imageUrl) {
    return (
      <div style={containerStyle}>
        {CATEGORY_EMOJI[category ?? ''] ?? '🍽️'}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <img
        src={imageUrl}
        alt={name}
        onError={(e) => {
          (e.currentTarget.parentElement as HTMLElement).innerHTML =
            CATEGORY_EMOJI[category ?? ''] ?? '🍽️';
        }}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}
