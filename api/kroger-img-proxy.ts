/**
 * Vercel serverless image proxy for Kroger product images.
 *
 * Browser → /api/kroger-img-proxy?url=https://media.kroger.com/...
 *         → fetches image server-to-server
 *         → returns bytes with Access-Control-Allow-Origin: *
 *
 * This lets the browser load Kroger images via canvas without CORS taint,
 * enabling pixel-level cropping of edge label bars.
 */

const ALLOWED_HOSTNAMES = [
  'media.kroger.com',
  'www.kroger.com',
  'kroger.com',
  'images.kroger.com',
];

export default async function handler(req: any, res: any) {
  const url = req.query?.url as string | undefined;

  if (!url) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  // Security: only proxy known Kroger image CDN hostnames
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'Invalid url' });
    return;
  }

  const isAllowed = ALLOWED_HOSTNAMES.some(
    h => parsed.hostname === h || parsed.hostname.endsWith('.' + h),
  );
  if (!isAllowed) {
    res.status(403).json({ error: 'URL not allowed' });
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: 'Upstream fetch failed' });
      return;
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.send(Buffer.from(buffer));
  } catch {
    res.status(502).json({ error: 'Failed to proxy image' });
  }
}
