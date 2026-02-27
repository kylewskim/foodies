/**
 * Vercel serverless proxy for Kroger Product API image lookup.
 *
 * Browser → /api/kroger-image?q=broccoli  →  api.kroger.com (server-to-server, no CORS)
 *
 * Returns: { url: "https://..." } or { url: null }
 */

// Module-level token cache — reused across warm Vercel invocations
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getKrogerToken(): Promise<string | null> {
  const clientId     = process.env.VITE_KROGER_CLIENT_ID;
  const clientSecret = process.env.VITE_KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
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
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export default async function handler(req: any, res: any) {
  const q = req.query?.q as string | undefined;
  if (!q) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }

  try {
    const token = await getKrogerToken();
    if (!token) {
      res.status(503).json({ url: null, error: 'Kroger API not configured' });
      return;
    }

    const params = new URLSearchParams({
      'filter.term':  q,
      'filter.limit': '5',
    });
    const response = await fetch(`https://api.kroger.com/v1/products?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json({ url: null });
      return;
    }

    const data = await response.json() as {
      data?: Array<{
        description?: string;
        images?: Array<{
          perspective: string;
          sizes: Array<{ size: string; url: string }>;
        }>;
      }>;
    };

    // Prefer single-unit products over multi-packs (stable sort keeps Kroger relevance within each tier)
    const BULK_RE = /\b(\d+\s*(?:ct|pk|pack|count|case|pieces?|units?)|variety\s*pack|\d+-pack)\b/i;
    const sorted = [...(data.data ?? [])].sort((a, b) => {
      const aIsBulk = BULK_RE.test(a.description ?? '') ? 0 : 1;
      const bIsBulk = BULK_RE.test(b.description ?? '') ? 0 : 1;
      return bIsBulk - aIsBulk;
    });

    // Preferred sizes: smaller sizes are plain product shots without editorial callout bars
    const SIZE_PREF = ['thumbnail', 'small', 'medium', 'large'];

    let imageUrl: string | null = null;
    for (const product of sorted) {
      const images = product.images ?? [];
      const front = images.filter(i => i.perspective === 'front');
      const candidates = front.length > 0 ? front : images;
      for (const img of candidates) {
        // Pick the smallest preferred size that exists, fall back to first available
        const preferred = SIZE_PREF.reduce<{ size: string; url: string } | undefined>(
          (best, sizeName) => best ?? img.sizes?.find(s => s.size === sizeName),
          undefined,
        ) ?? img.sizes?.[0];
        if (preferred?.url) { imageUrl = preferred.url; break; }
      }
      if (imageUrl) break;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ url: imageUrl });
  } catch {
    res.status(502).json({ url: null, error: 'Failed to fetch from Kroger' });
  }
}
