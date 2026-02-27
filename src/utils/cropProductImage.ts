/**
 * Canvas-based product image cropper.
 *
 * Kroger product images often include colored text-label strips at the edges
 * (e.g. "ZERO SUGAR" bar, "Orchard Peach" pink bar, "24 Cans" blue bar).
 *
 * This utility:
 *  1. Loads the image via /api/kroger-img-proxy (CORS-safe for canvas pixel reads)
 *  2. Detects and removes both:
 *     - White/near-white border padding
 *     - Colored callout bands (text bars at edges)
 *  3. Renders the remaining product centered on a square white canvas
 *  4. Returns a dataURL — or null on any failure
 *
 * Detection algorithm: median-inlier counting (robust to text pixels)
 *   - Sample 20 evenly-spaced pixels per row/column
 *   - Compute median R, G, B (text pixels are outliers → median ignores them)
 *   - Count what fraction of samples are within distance 40 of the median
 *   - If ≥ 60% agree on one color → row/col is a uniform band → crop it
 *   - Stop scanning when < 60% agree (= product content with mixed colors)
 *
 * Results are cached in-memory so each URL is only processed once per session.
 */

const cropCache = new Map<string, string | null>();

export async function cropProductImage(
  imageUrl: string,
  outputSize = 120,
): Promise<string | null> {
  const cached = cropCache.get(imageUrl);
  if (cached !== undefined) return cached;

  const proxyUrl = `/api/kroger-img-proxy?url=${encodeURIComponent(imageUrl)}`;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const { naturalWidth: w, naturalHeight: h } = img;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { cropCache.set(imageUrl, null); resolve(null); return; }
        ctx.drawImage(img, 0, 0);

        let pixelData: ImageData;
        try {
          pixelData = ctx.getImageData(0, 0, w, h);
        } catch {
          cropCache.set(imageUrl, null);
          resolve(null);
          return;
        }

        const { cropTop, cropBottom, cropLeft, cropRight } = detectCropBounds(pixelData.data, w, h);

        const cropW = w - cropLeft - cropRight;
        const cropH = h - cropTop - cropBottom;

        if (cropW <= 10 || cropH <= 10) {
          cropCache.set(imageUrl, null);
          resolve(null);
          return;
        }

        // Render cropped product centered on square white canvas
        const out = document.createElement('canvas');
        out.width = outputSize;
        out.height = outputSize;
        const outCtx = out.getContext('2d')!;

        outCtx.fillStyle = '#ffffff';
        outCtx.fillRect(0, 0, outputSize, outputSize);

        const padding = outputSize * 0.05;
        const available = outputSize - padding * 2;
        // Never upscale — only scale down (large images look sharp when reduced)
        const scale = Math.min(1.0, available / cropW, available / cropH);
        const dw = cropW * scale;
        const dh = cropH * scale;
        const dx = (outputSize - dw) / 2;
        const dy = (outputSize - dh) / 2;

        outCtx.drawImage(img, cropLeft, cropTop, cropW, cropH, dx, dy, dw, dh);

        const dataUrl = out.toDataURL('image/jpeg', 0.92);
        cropCache.set(imageUrl, dataUrl);
        resolve(dataUrl);
      } catch {
        cropCache.set(imageUrl, null);
        resolve(null);
      }
    };

    img.onerror = () => {
      cropCache.set(imageUrl, null);
      resolve(null);
    };

    img.src = proxyUrl;
  });
}

// ─── Edge detection ──────────────────────────────────────────────────────────

function detectCropBounds(
  px: Uint8ClampedArray,
  w: number,
  h: number,
): { cropTop: number; cropBottom: number; cropLeft: number; cropRight: number } {
  const N = 20; // samples per scan line
  const DIST = 40; // color distance threshold
  const INLIER_RATIO = 0.60; // minimum fraction to be "uniform"
  const MAX_FRAC = 0.45; // never crop more than 45% per edge

  /**
   * Sample N pixels evenly along a row or column.
   * Returns true if ≥ INLIER_RATIO of the samples agree on a dominant color
   * (i.e. the row/col is a uniform band — whether white padding or colored callout).
   */
  function isUniform(axis: 'row' | 'col', idx: number): boolean {
    const samples: [number, number, number][] = [];

    if (axis === 'row') {
      const step = Math.max(1, Math.floor(w / N));
      for (let x = 0; x < w; x += step) {
        const i = (idx * w + x) * 4;
        samples.push([px[i], px[i + 1], px[i + 2]]);
      }
    } else {
      const step = Math.max(1, Math.floor(h / N));
      for (let y = 0; y < h; y += step) {
        const i = (y * w + idx) * 4;
        samples.push([px[i], px[i + 1], px[i + 2]]);
      }
    }

    if (samples.length === 0) return false;

    // Median R, G, B — robust against outlier text pixels
    const rs = samples.map(s => s[0]).sort((a, b) => a - b);
    const gs = samples.map(s => s[1]).sort((a, b) => a - b);
    const bs = samples.map(s => s[2]).sort((a, b) => a - b);
    const mid = Math.floor(samples.length / 2);
    const medR = rs[mid], medG = gs[mid], medB = bs[mid];

    const inliers = samples.filter(
      s => Math.abs(s[0] - medR) < DIST && Math.abs(s[1] - medG) < DIST && Math.abs(s[2] - medB) < DIST,
    ).length;

    return inliers / samples.length >= INLIER_RATIO;
  }

  let cropTop = 0;
  while (cropTop < h * MAX_FRAC && isUniform('row', cropTop)) cropTop++;

  let cropBottom = 0;
  while (cropBottom < h * MAX_FRAC && isUniform('row', h - 1 - cropBottom)) cropBottom++;

  let cropLeft = 0;
  while (cropLeft < w * MAX_FRAC && isUniform('col', cropLeft)) cropLeft++;

  let cropRight = 0;
  while (cropRight < w * MAX_FRAC && isUniform('col', w - 1 - cropRight)) cropRight++;

  return { cropTop, cropBottom, cropLeft, cropRight };
}
