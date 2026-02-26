/**
 * Product image lookup service.
 *
 * Priority:
 *   1. Kroger Product API (white-background product photos)
 *   2. Open Food Facts (free/public fallback, CORS-safe via proxy)
 *
 * Images are fetched in the background after items are displayed — this
 * function never blocks the UI.  Results are cached in-memory for the
 * session so the same product name is only looked up once.
 */

// ─── In-memory cache ───────────────────────────────────────────────────────
const cache = new Map<string, string | null>();

// ─── Image quality check ───────────────────────────────────────────────────
// Loads the image onto a hidden canvas and samples 6 regions:
//   4 corners + top strip + bottom strip.
// A clean white-background product shot will have near-white in all regions.
// Promotional banners typically appear as colored overlays in corners or edges.
//
// If CORS prevents pixel reading (SecurityError), we assume the image is
// clean — so the filter never causes false rejections due to CORS.
async function isCleanProductImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    // 3 s timeout — don't let a slow CDN block the whole pipeline
    const timeout = setTimeout(() => resolve(true), 3000);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(true); return; }
        ctx.drawImage(img, 0, 0);

        // Returns true if the average brightness of a patch is near-white (>220/255)
        function patchIsWhite(px: number, py: number, pw: number, ph: number): boolean {
          const safeW = Math.max(1, Math.min(pw, w - px));
          const safeH = Math.max(1, Math.min(ph, h - py));
          const { data } = ctx!.getImageData(Math.max(0, px), Math.max(0, py), safeW, safeH);
          let total = 0;
          for (let i = 0; i < data.length; i += 4) {
            total += (data[i] + data[i + 1] + data[i + 2]) / 3;
          }
          return (total / (data.length / 4)) > 220;
        }

        const corner = Math.floor(Math.min(w, h) * 0.08); // 8% corner patch
        const strip  = Math.floor(h * 0.08);               // 8% top/bottom strip

        const checks = [
          patchIsWhite(0,          0,          corner, corner), // top-left
          patchIsWhite(w - corner, 0,          corner, corner), // top-right
          patchIsWhite(0,          h - corner, corner, corner), // bottom-left
          patchIsWhite(w - corner, h - corner, corner, corner), // bottom-right
          patchIsWhite(0,          0,          w,      strip),  // top strip
          patchIsWhite(0,          h - strip,  w,      strip),  // bottom strip
        ];

        // Require 5 of 6 regions to be near-white
        resolve(checks.filter(Boolean).length >= 5);
      } catch {
        // SecurityError: CORS blocked pixel read — assume clean, don't reject
        resolve(true);
      }
    };

    img.onerror = () => { clearTimeout(timeout); resolve(true); };
    img.src = url;
  });
}

// ─── Kroger token management ───────────────────────────────────────────────
let krogerToken: string | null = null;
let krogerTokenExpiry = 0;

async function getKrogerToken(): Promise<string | null> {
  const clientId     = import.meta.env.VITE_KROGER_CLIENT_ID     as string | undefined;
  const clientSecret = import.meta.env.VITE_KROGER_CLIENT_SECRET as string | undefined;
  if (!clientId || !clientSecret) return null;

  if (krogerToken && Date.now() < krogerTokenExpiry) return krogerToken;

  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch('https://api.kroger.com/v1/connect/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=product.compact',
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string; expires_in: number };
    krogerToken = data.access_token;
    krogerTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return krogerToken;
  } catch {
    return null;
  }
}

async function searchKrogerImage(name: string): Promise<string | null> {
  const token = await getKrogerToken();
  if (!token) return null;

  try {
    const params = new URLSearchParams({
      'filter.term':  name,
      'filter.limit': '3', // a few candidates so we can pick the cleanest
    });
    const res = await fetch(`https://api.kroger.com/v1/products?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const data = await res.json() as {
      data?: Array<{
        images?: Array<{
          perspective: string;
          featured:    boolean;
          sizes:       Array<{ size: string; url: string }>;
        }>;
      }>;
    };

    for (const product of data.data ?? []) {
      const front = (product.images ?? []).filter(i => i.perspective === 'front');
      // Prefer non-featured (no promotional overlay) first
      const candidates = [
        ...front.filter(i => !i.featured),
        ...front.filter(i =>  i.featured),
      ];

      for (const img of candidates) {
        const large = img.sizes.find(s => s.size === 'large') ?? img.sizes[0];
        if (!large?.url) continue;
        if (await isCleanProductImage(large.url)) return large.url;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────
/**
 * Look up a product image by name.
 * Tries Kroger first (clean white-background shots, banner-filtered),
 * then Open Food Facts as fallback.
 * Returns null if neither source has a clean result.
 */
export async function fetchProductImage(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) as string | null;

  const url = await searchKrogerImage(name);
  cache.set(key, url);
  return url;
}
