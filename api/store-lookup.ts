/**
 * Vercel serverless proxy for per-store product lookup.
 *
 * Browser → POST /api/store-lookup  →  store-specific API/scrape (server-to-server)
 *
 * Input:  { store_name: string | null, items: Array<{ raw_name, item_code }> }
 * Output: Array<StoreLookupItem>
 *
 * Tier 1 (official): Kroger API, Open Food Facts
 * Tier 2 (best-effort): Costco HTML, Trader Joe's GraphQL, Safeway API
 * Tier 3 (fallback): returns nulls — client falls back to GPT/keyword matching
 */

interface InputItem {
  raw_name: string;
  item_code: string | null;
}

interface StoreLookupItem {
  raw_name: string;
  product_name: string | null;
  is_food: boolean | null;
  category: string | null;
  source: 'kroger' | 'off' | 'costco' | 'traderjoes' | 'safeway' | 'fallback';
}

// ─── Kroger OAuth (reuse pattern from kroger-image.ts) ───────────────────────

let krogerToken: string | null = null;
let krogerTokenExpiry = 0;

async function getKrogerToken(): Promise<string | null> {
  const clientId = process.env.VITE_KROGER_CLIENT_ID;
  const clientSecret = process.env.VITE_KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (krogerToken && Date.now() < krogerTokenExpiry) return krogerToken;

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
  krogerToken = data.access_token;
  krogerTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return krogerToken;
}

// ─── Food/non-food category classification ────────────────────────────────────

const FOOD_DEPT_KEYWORDS = [
  'produce', 'fruit', 'vegetable', 'meat', 'seafood', 'fish', 'poultry',
  'dairy', 'milk', 'cheese', 'egg', 'bakery', 'bread', 'deli', 'frozen',
  'beverage', 'drink', 'snack', 'candy', 'condiment', 'sauce', 'pantry',
  'cereal', 'grain', 'pasta', 'rice', 'soup', 'canned', 'coffee', 'tea',
];

const NON_FOOD_DEPT_KEYWORDS = [
  'household', 'cleaning', 'paper', 'laundry', 'personal care', 'health',
  'beauty', 'vitamin', 'medicine', 'pharmacy', 'pet', 'baby',
  'electronics', 'clothing', 'apparel', 'auto', 'garden', 'hardware',
  'office', 'seasonal', 'toy', 'sporting', 'furniture',
];

function classifyCategory(category: string | null): boolean | null {
  if (!category) return null;
  const lower = category.toLowerCase();
  if (FOOD_DEPT_KEYWORDS.some(k => lower.includes(k))) return true;
  if (NON_FOOD_DEPT_KEYWORDS.some(k => lower.includes(k))) return false;
  return null;
}

// ─── Per-store handlers ───────────────────────────────────────────────────────

async function lookupKroger(item: InputItem): Promise<StoreLookupItem> {
  const nullResult: StoreLookupItem = {
    raw_name: item.raw_name, product_name: null, is_food: null, category: null, source: 'fallback',
  };
  try {
    const token = await getKrogerToken();
    if (!token) return nullResult;

    const params = new URLSearchParams({ 'filter.term': item.raw_name, 'filter.limit': '3' });
    const res = await fetch(`https://api.kroger.com/v1/products?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return nullResult;

    const data = await res.json() as {
      data?: Array<{
        description?: string;
        aisleLocations?: Array<{ description?: string }>;
        categories?: Array<{ name?: string }>;
      }>;
    };

    const first = data.data?.[0];
    if (!first?.description) return nullResult;

    // Try aisleLocations or categories for department info
    const dept =
      first.aisleLocations?.[0]?.description ??
      first.categories?.[0]?.name ??
      null;

    return {
      raw_name: item.raw_name,
      product_name: first.description,
      is_food: classifyCategory(dept),
      category: dept,
      source: 'kroger',
    };
  } catch {
    return nullResult;
  }
}

async function lookupOFF(item: InputItem): Promise<StoreLookupItem> {
  const nullResult: StoreLookupItem = {
    raw_name: item.raw_name, product_name: null, is_food: null, category: null, source: 'fallback',
  };
  try {
    const params = new URLSearchParams({
      search_terms: item.raw_name,
      action: 'process',
      json: '1',
      page_size: '3',
      fields: 'product_name,categories_tags,pnns_groups_1',
    });
    const res = await fetch(`https://search.openfoodfacts.org/search?${params}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return nullResult;

    const data = await res.json() as {
      hits?: Array<{
        product_name?: string;
        pnns_groups_1?: string;
        categories_tags?: string[];
      }>;
    };

    const first = data.hits?.[0];
    if (!first) return nullResult;

    const pnns = first.pnns_groups_1 ?? null;
    const tags = first.categories_tags ?? [];
    const isNonFood = tags.includes('en:non-food') || pnns === 'Non food products';
    const isFoodTag = pnns && pnns !== 'Non food products' && pnns !== 'unknown';

    return {
      raw_name: item.raw_name,
      product_name: first.product_name ?? null,
      is_food: isNonFood ? false : (isFoodTag ? true : null),
      category: pnns ?? null,
      source: 'off',
    };
  } catch {
    return nullResult;
  }
}

async function lookupCostco(item: InputItem): Promise<StoreLookupItem> {
  const nullResult: StoreLookupItem = {
    raw_name: item.raw_name, product_name: null, is_food: null, category: null, source: 'fallback',
  };
  try {
    const keyword = item.item_code ?? item.raw_name;
    const url = `https://www.costco.com/CatalogSearch?keyword=${encodeURIComponent(keyword)}&langId=-1&Number=5&storeId=10301`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.costco.com/',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return nullResult;
    const html = await res.text();

    // Try JSON-LD structured data first (most reliable)
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]) as { '@type'?: string; name?: string; category?: string };
        if (ld['@type'] === 'Product' && ld.name) {
          return {
            raw_name: item.raw_name,
            product_name: ld.name,
            is_food: classifyCategory(ld.category ?? null),
            category: ld.category ?? null,
            source: 'costco',
          };
        }
      } catch { /* ignore JSON parse errors */ }
    }

    // Fallback: extract first product title from HTML (best-effort)
    const titleMatch = html.match(/class="[^"]*description[^"]*"[^>]*>([^<]{5,80})<\/(?:a|span|h[1-6]|div)>/i);
    if (titleMatch) {
      const productName = titleMatch[1].trim();
      return {
        raw_name: item.raw_name,
        product_name: productName,
        is_food: null,
        category: null,
        source: 'costco',
      };
    }

    return nullResult;
  } catch {
    return nullResult;
  }
}

async function lookupTraderJoes(item: InputItem): Promise<StoreLookupItem> {
  const nullResult: StoreLookupItem = {
    raw_name: item.raw_name, product_name: null, is_food: null, category: null, source: 'fallback',
  };
  try {
    const res = await fetch('https://www.traderjoes.com/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.traderjoes.com',
        'Referer': 'https://www.traderjoes.com/home/search',
      },
      body: JSON.stringify({
        query: `query SearchProducts($term: String!, $pageSize: Int!) {
          products(where: { published: { eq: "1" } }, term: $term, first: $pageSize) {
            nodes {
              sku
              product_title
              category_hierarchy
            }
          }
        }`,
        variables: { term: item.raw_name, pageSize: 3 },
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return nullResult;
    const data = await res.json() as {
      data?: {
        products?: {
          nodes?: Array<{
            product_title?: string;
            category_hierarchy?: Array<{ title?: string }>;
          }>;
        };
      };
    };

    const first = data.data?.products?.nodes?.[0];
    if (!first?.product_title) return nullResult;

    const category = first.category_hierarchy?.[0]?.title ?? null;
    return {
      raw_name: item.raw_name,
      product_name: first.product_title,
      is_food: classifyCategory(category),
      category,
      source: 'traderjoes',
    };
  } catch {
    return nullResult;
  }
}

async function lookupSafeway(item: InputItem): Promise<StoreLookupItem> {
  const nullResult: StoreLookupItem = {
    raw_name: item.raw_name, product_name: null, is_food: null, category: null, source: 'fallback',
  };
  try {
    const params = new URLSearchParams({
      'request-id': Date.now().toString(),
      url: 'https://www.safeway.com',
      pageurl: 'https://www.safeway.com',
      'unified-search': 'true',
      q: item.raw_name,
      start: '0',
      rows: '3',
    });
    const res = await fetch(`https://www.safeway.com/abs/pub/xapi/v1/products/search?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Referer: 'https://www.safeway.com/',
        'ocp-apim-subscription-key': 'e914eec9432c4a2e996f3f702af9c1ea', // public key from their site
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return nullResult;
    const data = await res.json() as {
      response?: {
        docs?: Array<{
          name?: string;
          departmentName?: string;
        }>;
      };
    };

    const first = data.response?.docs?.[0];
    if (!first?.name) return nullResult;

    return {
      raw_name: item.raw_name,
      product_name: first.name,
      is_food: classifyCategory(first.departmentName ?? null),
      category: first.departmentName ?? null,
      source: 'safeway',
    };
  } catch {
    return nullResult;
  }
}

// ─── Store routing ────────────────────────────────────────────────────────────

const KROGER_STORES = ['kroger', "ralph's", 'ralphs', 'fred meyer', "fry's", 'frys', 'harris teeter', 'mariano', 'king soopers', 'smith\'s', 'smiths', 'city market', 'dillons'];

function routeToHandler(storeName: string | null, item: InputItem): Promise<StoreLookupItem> {
  const lower = (storeName ?? '').toLowerCase();

  if (lower === 'costco') return lookupCostco(item);
  if (lower.includes("trader joe's") || lower.includes('trader joes')) return lookupTraderJoes(item);
  if (KROGER_STORES.some(s => lower.includes(s))) return lookupKroger(item);
  if (lower.includes('safeway') || lower.includes('albertsons')) return lookupSafeway(item);

  // Whole Foods, generic, unknown → Open Food Facts
  return lookupOFF(item);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { store_name, items } = req.body as { store_name: string | null; items: InputItem[] };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items array required' });
    return;
  }

  try {
    // Look up all items in parallel (one request per item)
    const results = await Promise.all(
      items.map(item => routeToHandler(store_name, item)),
    );

    res.json(results);
  } catch {
    // Return all-fallback results so the client can still proceed
    const fallback: StoreLookupItem[] = items.map(item => ({
      raw_name: item.raw_name,
      product_name: null,
      is_food: null,
      category: null,
      source: 'fallback',
    }));
    res.json(fallback);
  }
}
