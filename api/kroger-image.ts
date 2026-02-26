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
        images?: Array<{
          perspective: string;
          sizes: Array<{ size: string; url: string }>;
        }>;
      }>;
    };

    let imageUrl: string | null = null;
    for (const product of data.data ?? []) {
      const images = product.images ?? [];
      const front = images.filter(i => i.perspective === 'front');
      const candidates = front.length > 0 ? front : images;
      for (const img of candidates) {
        const large = img.sizes?.find(s => s.size === 'large') ?? img.sizes?.[0];
        if (large?.url) { imageUrl = large.url; break; }
      }
      if (imageUrl) break;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ url: imageUrl });
  } catch {
    res.status(502).json({ url: null, error: 'Failed to fetch from Kroger' });
  }
}
