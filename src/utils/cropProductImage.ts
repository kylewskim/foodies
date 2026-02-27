/**
 * Canvas-based product image cropper.
 *
 * Kroger product images often include colored text-label strips at the edges
 * (e.g. "Zero Sugar" bar, "Orchard Peach" pink bar, "24 Cans" blue bar).
 *
 * Algorithm: Edge-Color-Anchored Scanning
 *
 *   For each of the 4 edges:
 *   1. Sample the outermost row/column (24 evenly-spaced pixels).
 *   2. Compute the median RGB — this is the "edge color".
 *   3. If the edge is not uniform (inlier ratio < 72%) → mixed product content
 *      touching the edge → skip this edge entirely (no crop).
 *   4. Otherwise scan inward, row by row, cropping while:
 *        • the row's dominant color agrees with the edge color (distance ≤ 45)
 *        • the row is still uniform (inlier ratio ≥ 72%)
 *   5. Stop the moment either condition breaks — that's where product content
 *      begins.
 *
 * Why this works:
 *   • Banana on white background: edge = white → trims white padding →
 *     stops the instant yellow banana rows appear (color change). ✓
 *   • Pepsi "24 Cans" blue bar: edge = blue → trims blue rows →
 *     stops when colorful product area begins. ✓
 *   • Coca-Cola bottles touching the edge: edge = mixed → no crop at all. ✓
 *   • Sargento right-side composite: edge = white → trims white cheese section
 *     → stops at dark green bag. ✓
 *
 * Results are cached in-memory so each URL is processed only once per session.
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
          // Canvas tainted (CORS) — return null so caller uses raw URL
          cropCache.set(imageUrl, null);
          resolve(null);
          return;
        }

        const { cropTop, cropBottom, cropLeft, cropRight } =
          detectCropBounds(pixelData.data, w, h);

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

// ─── Edge-color-anchored crop detection ──────────────────────────────────────

function detectCropBounds(
  px: Uint8ClampedArray,
  w: number,
  h: number,
): { cropTop: number; cropBottom: number; cropLeft: number; cropRight: number } {
  /** Inlier distance: pixels within this RGB distance of the median count as "matching" */
  const PIXEL_DIST = 40;
  /** A row/col is considered "uniform" if this fraction of samples agree on one color */
  const INLIER_THRESH = 0.72;
  /** Stop scanning inward if the row's dominant color drifts this far from the edge color */
  const COLOR_DRIFT = 45;
  /** Never crop more than this fraction of the image per edge */
  const MAX_FRAC = 0.40;
  /** How many pixels to sample per row/column */
  const N_SAMPLES = 24;

  function sampleLine(
    axis: 'row' | 'col',
    idx: number,
  ): Array<[number, number, number]> {
    const samples: Array<[number, number, number]> = [];
    if (axis === 'row') {
      const step = Math.max(1, Math.floor(w / N_SAMPLES));
      for (let x = 0; x < w; x += step) {
        const i = (idx * w + x) * 4;
        samples.push([px[i], px[i + 1], px[i + 2]]);
      }
    } else {
      const step = Math.max(1, Math.floor(h / N_SAMPLES));
      for (let y = 0; y < h; y += step) {
        const i = (y * w + idx) * 4;
        samples.push([px[i], px[i + 1], px[i + 2]]);
      }
    }
    return samples;
  }

  function medianRGB(
    samples: Array<[number, number, number]>,
  ): [number, number, number] {
    const rs = samples.map(s => s[0]).sort((a, b) => a - b);
    const gs = samples.map(s => s[1]).sort((a, b) => a - b);
    const bs = samples.map(s => s[2]).sort((a, b) => a - b);
    const mid = Math.floor(samples.length / 2);
    return [rs[mid], gs[mid], bs[mid]];
  }

  function inlierRatio(
    samples: Array<[number, number, number]>,
    med: [number, number, number],
  ): number {
    const inliers = samples.filter(
      s =>
        Math.abs(s[0] - med[0]) < PIXEL_DIST &&
        Math.abs(s[1] - med[1]) < PIXEL_DIST &&
        Math.abs(s[2] - med[2]) < PIXEL_DIST,
    ).length;
    return inliers / samples.length;
  }

  function colorDist(
    a: [number, number, number],
    b: [number, number, number],
  ): number {
    return Math.sqrt(
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
    );
  }

  function scanEdge(axis: 'row' | 'col', fromEnd: boolean): number {
    const dim = axis === 'row' ? h : w;

    // Step 1: Sample the outermost line to establish the edge color
    const edgeIdx = fromEnd ? dim - 1 : 0;
    const edgeSamples = sampleLine(axis, edgeIdx);
    const edgeMedian = medianRGB(edgeSamples);

    // If the edge itself is not uniform → product content is already at the edge → no crop
    if (inlierRatio(edgeSamples, edgeMedian) < INLIER_THRESH) return 0;

    // Step 2: Scan inward while rows/cols match the established edge color
    let count = 0;
    const limit = Math.floor(dim * MAX_FRAC);

    while (count < limit) {
      const idx = fromEnd ? dim - 1 - count : count;
      const samples = sampleLine(axis, idx);
      const med = medianRGB(samples);

      // Stop if this line became mixed (product content)
      if (inlierRatio(samples, med) < INLIER_THRESH) break;

      // Stop if the dominant color drifted significantly from the edge color
      // (e.g. white padding ended, actual product started)
      if (colorDist(med, edgeMedian) > COLOR_DRIFT) break;

      count++;
    }

    return count;
  }

  return {
    cropTop:    scanEdge('row', false),
    cropBottom: scanEdge('row', true),
    cropLeft:   scanEdge('col', false),
    cropRight:  scanEdge('col', true),
  };
}
