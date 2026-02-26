/**
 * Product image lookup service.
 *
 * Browser → /api/kroger-image (Vercel serverless) → api.kroger.com
 *
 * Images are fetched in the background after items are displayed — this
 * function never blocks the UI. Results are cached in-memory for the
 * session so the same product name is only looked up once.
 */

// ─── In-memory cache ───────────────────────────────────────────────────────
const cache = new Map<string, string | null>();

// ─── Public API ────────────────────────────────────────────────────────────
/**
 * Look up a product image by name via the Vercel serverless proxy.
 * Returns null if no image is found.
 */
export async function fetchProductImage(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) as string | null;

  try {
    const res = await fetch(`/api/kroger-image?q=${encodeURIComponent(name)}`);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json() as { url: string | null };
    cache.set(key, data.url ?? null);
    return data.url ?? null;
  } catch {
    cache.set(key, null);
    return null;
  }
}
