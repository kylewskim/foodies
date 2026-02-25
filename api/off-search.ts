/**
 * Vercel serverless proxy for Open Food Facts search API.
 *
 * Browser → /api/off-search?q=...  →  search.openfoodfacts.org (server-to-server, no CORS)
 */
export default async function handler(req: any, res: any) {
  const params = new URLSearchParams(req.query as Record<string, string>);

  try {
    const response = await fetch(
      `https://search.openfoodfacts.org/search?${params}`,
    );
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch from Open Food Facts' });
  }
}
