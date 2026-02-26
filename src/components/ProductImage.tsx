/**
 * ProductImage — displays a Kroger product image, cropped and centered.
 *
 * On mount:
 *  - Loads the image via /api/kroger-img-proxy (CORS-safe)
 *  - Detects and removes colored edge-band strips (text callouts)
 *  - Trims white-border padding
 *  - Renders the product centered on a white square canvas
 *
 * Falls back to the category emoji if the image is unavailable or cropping fails.
 */

import { useEffect, useState } from 'react';
import { cropProductImage } from '../utils/cropProductImage';

export const CATEGORY_EMOJI: Record<string, string> = {
  Produce: '🥬', Protein: '🍖', Dairy: '🥛', Grains: '🌾',
  Beverages: '🥤', Snacks: '🍪', Condiments: '🧂', Canned: '🥫',
  Frozen: '🧊', Other: '📦', Prepared: '🍱',
};

interface ProductImageProps {
  imageUrl?: string | null;
  name: string;
  category?: string;
  /** Side length of the square container (px). Default 60. */
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
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;
    setCroppedSrc(null);
    setFailed(false);

    cropProductImage(imageUrl, size * 2).then((result) => {
      if (result) {
        setCroppedSrc(result);
      } else {
        // cropProductImage returned null — fall back to raw URL
        setCroppedSrc(imageUrl);
      }
    });
  }, [imageUrl, size]);

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

  // Show emoji while loading or if no image
  if (!imageUrl || failed || (!croppedSrc && !imageUrl)) {
    return (
      <div style={containerStyle}>
        {CATEGORY_EMOJI[category ?? ''] ?? '🍽️'}
      </div>
    );
  }

  // Loading state — show emoji placeholder while canvas processes
  if (!croppedSrc) {
    return (
      <div style={containerStyle}>
        {CATEGORY_EMOJI[category ?? ''] ?? '🍽️'}
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, backgroundColor: '#ffffff' }}>
      <img
        src={croppedSrc}
        alt={name}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}
