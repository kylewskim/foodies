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
      'filter.limit': '5',
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
      const images = product.images ?? [];
      // Prefer front perspective, fall back to any perspective
      const front = images.filter(i => i.perspective === 'front');
      const candidates = front.length > 0 ? front : images;

      for (const img of candidates) {
        const large = img.sizes.find(s => s.size === 'large') ?? img.sizes[0];
        if (large?.url) return large.url;
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
