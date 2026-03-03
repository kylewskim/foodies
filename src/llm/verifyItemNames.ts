import { openai, FREE_MODEL, isOpenAIConfigured } from './openaiClient';

interface VerifyInput {
  raw_name: string;
  item_code: string | null;
}

export interface VerifyOutput {
  raw_name: string;
  verified_name: string;
  confidence: 'high' | 'low';
}

/**
 * Verify and correct item names extracted from a receipt using GPT's product knowledge.
 *
 * For stores like Costco where item codes are printed on receipts, the code acts as a
 * strong signal to identify the exact product (e.g., code "47019" → "Organic Avocados 5-pack").
 * For stores without codes (Trader Joe's, Whole Foods), store context alone helps disambiguate
 * similarly-named products.
 *
 * All items are batched into a single API call to minimize latency.
 * Falls back to original names silently if OpenAI is unavailable or the response is invalid.
 */
export async function verifyItemNames(
  items: VerifyInput[],
  store_name: string | null,
): Promise<VerifyOutput[]> {
  const fallback = items.map((item) => ({
    raw_name: item.raw_name,
    verified_name: item.raw_name,
    confidence: 'low' as const,
  }));

  if (!isOpenAIConfigured() || items.length === 0) return fallback;

  // Skip verification if no item codes and no store context — not worth the extra call
  const hasItemCodes = items.some((item) => item.item_code);
  if (!hasItemCodes && !store_name) return fallback;

  try {
    const storeContext = store_name ? `Store: ${store_name}` : 'Store: unknown';
    const itemList = JSON.stringify(
      items.map((item) => ({ raw_name: item.raw_name, item_code: item.item_code ?? null })),
    );

    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 512,
      messages: [
        {
          role: 'system',
          content: `You are a grocery product verifier. Given items extracted from a receipt, verify or correct the product name.

Rules:
- Use item_code as a strong signal when present (e.g. Costco item numbers uniquely identify products)
- Use the store name to resolve ambiguity (e.g. "AVOCADO" at Costco is typically a multi-pack of fresh avocados, not avocado oil)
- If the name is already correct, return it unchanged
- Keep names clean and readable (no size/unit suffixes)
- Set confidence "high" when you are certain (item code match or unambiguous name), "low" when guessing

Return JSON: {"results":[{"raw_name":"original name","verified_name":"corrected name","confidence":"high"|"low"}]}`,
        },
        {
          role: 'user',
          content: `${storeContext}\nItems: ${itemList}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as { results: VerifyOutput[] };
    if (!Array.isArray(parsed.results) || parsed.results.length !== items.length) {
      console.warn('[verifyItemNames] Unexpected response shape, using fallback');
      return fallback;
    }

    console.log(`✅ [verifyItemNames] Verified ${items.length} items (store: ${store_name ?? 'unknown'})`);
    parsed.results.forEach((r) => {
      if (r.verified_name !== r.raw_name) {
        console.log(`  ✏️  "${r.raw_name}" → "${r.verified_name}" (${r.confidence})`);
      }
    });

    return parsed.results;
  } catch (error) {
    console.warn('[verifyItemNames] Failed, using original names:', error);
    return fallback;
  }
}
