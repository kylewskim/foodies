import type { StoreLookupItem } from '../types';

/**
 * Client-side wrapper for POST /api/store-lookup.
 *
 * Looks up each item against the appropriate store's product database.
 * Returns all-null results on any error so the caller can fall back gracefully.
 */
export async function lookupStoreProduct(
  items: Array<{ raw_name: string; item_code: string | null }>,
  store_name: string | null,
): Promise<StoreLookupItem[]> {
  const fallback: StoreLookupItem[] = items.map(item => ({
    raw_name: item.raw_name,
    product_name: null,
    is_food: null,
    category: null,
    image_url: null,
    source: 'fallback' as const,
  }));

  if (items.length === 0) return fallback;

  // Only run if there's something useful to look up
  const hasItemCodes = items.some(i => i.item_code);
  if (!hasItemCodes && !store_name) return fallback;

  try {
    const res = await fetch('/api/store-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_name, items }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return fallback;

    const results = await res.json() as StoreLookupItem[];
    if (!Array.isArray(results) || results.length !== items.length) return fallback;

    console.log(`✅ [storeLookup] ${results.length} items (store: ${store_name ?? 'unknown'})`);
    results.forEach(r => {
      if (r.source !== 'fallback') {
        console.log(`  🔍 "${r.raw_name}" → "${r.product_name ?? '(no match)'}" | food: ${r.is_food} | cat: ${r.category} [${r.source}]`);
      }
    });

    return results;
  } catch {
    return fallback;
  }
}
