/**
 * Canvas-based product image cropper.
 *
 * Kroger product images often include colored text-label strips at the edges
 * (e.g. "ZERO SUGAR" bar, "Orchard Peach" bar, "24 Cans" callout).
 *
 * This utility:
 *  1. Loads the image via the /api/kroger-img-proxy (adds CORS headers so
 *     canvas pixel reads are allowed)
 *  2. Trims white/near-white border padding from all 4 sides
 *  3. Detects and removes colored, uniform-background edge bands
 *  4. Renders the remaining product content centered on a square white canvas
 *  5. Returns a dataURL — or null on any failure
 *
 * Results are cached in-memory so each unique URL is only processed once.
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

        // Draw full image to canvas to read pixels
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
          // Canvas tainted — return null so caller falls back to raw URL
          cropCache.set(imageUrl, null);
          resolve(null);
          return;
        }

        const { cropTop, cropBottom, cropLeft, cropRight } = detectCropBounds(pixelData, w, h);

        const cropW = w - cropLeft - cropRight;
        const cropH = h - cropTop - cropBottom;

        if (cropW <= 10 || cropH <= 10) {
          cropCache.set(imageUrl, null);
          resolve(null);
          return;
        }

        // Render cropped product centered on square white canvas with padding
        const out = document.createElement('canvas');
        out.width = outputSize;
        out.height = outputSize;
        const outCtx = out.getContext('2d')!;

        outCtx.fillStyle = '#ffffff';
        outCtx.fillRect(0, 0, outputSize, outputSize);

        const padding = outputSize * 0.05; // 5% padding on each side
        const available = outputSize - padding * 2;
        const scale = Math.min(available / cropW, available / cropH);
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

/**
 * Returns how many pixels to crop from each edge.
 *
 * Two passes:
 *  1. Trim white/near-white border (bg padding added by Kroger)
 *  2. Trim any remaining colored uniform-background strip (text callout bands)
 */
function detectCropBounds(
  data: ImageData,
  w: number,
  h: number,
): { cropTop: number; cropBottom: number; cropLeft: number; cropRight: number } {
  const px = data.data;

  const getPixel = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return { r: px[i], g: px[i + 1], b: px[i + 2], a: px[i + 3] };
  };

  // Sample N evenly-spaced pixels along a row/column and return their avg color
  const rowAvg = (y: number): { r: number; g: number; b: number } => {
    let r = 0, g = 0, b = 0;
    const step = Math.max(1, Math.floor(w / 32));
    let count = 0;
    for (let x = 0; x < w; x += step) {
      const p = getPixel(x, y); r += p.r; g += p.g; b += p.b; count++;
    }
    return { r: r / count, g: g / count, b: b / count };
  };

  const colAvg = (x: number): { r: number; g: number; b: number } => {
    let r = 0, g = 0, b = 0;
    const step = Math.max(1, Math.floor(h / 32));
    let count = 0;
    for (let y = 0; y < h; y += step) {
      const p = getPixel(x, y); r += p.r; g += p.g; b += p.b; count++;
    }
    return { r: r / count, g: g / count, b: b / count };
  };

  // Variance along a row — low variance = uniform color band
  const rowVariance = (y: number): number => {
    const avg = rowAvg(y);
    let variance = 0;
    const step = Math.max(1, Math.floor(w / 32));
    let count = 0;
    for (let x = 0; x < w; x += step) {
      const p = getPixel(x, y);
      variance += (p.r - avg.r) ** 2 + (p.g - avg.g) ** 2 + (p.b - avg.b) ** 2;
      count++;
    }
    return variance / count;
  };

  const colVariance = (x: number): number => {
    const avg = colAvg(x);
    let variance = 0;
    const step = Math.max(1, Math.floor(h / 32));
    let count = 0;
    for (let y = 0; y < h; y += step) {
      const p = getPixel(x, y);
      variance += (p.r - avg.r) ** 2 + (p.g - avg.g) ** 2 + (p.b - avg.b) ** 2;
      count++;
    }
    return variance / count;
  };

  const isNearWhite = (avg: { r: number; g: number; b: number }) =>
    avg.r > 230 && avg.g > 230 && avg.b > 230;

  // A row/col is a "strip to remove" if it's:
  //  - low variance (uniform color) AND
  //  - either near-white background padding OR a colored callout band
  const isRemovableRow = (y: number) => rowVariance(y) < 400;
  const isRemovableCol = (x: number) => colVariance(x) < 400;

  const maxCropFraction = 0.45; // never crop more than 45% of the image

  let cropTop = 0;
  while (cropTop < h * maxCropFraction && isRemovableRow(cropTop)) cropTop++;

  let cropBottom = 0;
  while (cropBottom < h * maxCropFraction && isRemovableRow(h - 1 - cropBottom)) cropBottom++;

  let cropLeft = 0;
  while (cropLeft < w * maxCropFraction && isRemovableCol(cropLeft)) cropLeft++;

  let cropRight = 0;
  while (cropRight < w * maxCropFraction && isRemovableCol(w - 1 - cropRight)) cropRight++;

  // Safety: never crop non-white edges from the left/top unless >25% of dimension
  // (avoids over-cropping products with dark labels that fill most of the frame)
  const topAvg = rowAvg(0);
  const leftAvg = colAvg(0);
  if (!isNearWhite(topAvg) && cropTop < h * 0.25) cropTop = 0;
  if (!isNearWhite(leftAvg) && cropLeft < w * 0.25) cropLeft = 0;

  return { cropTop, cropBottom, cropLeft, cropRight };
}
