import type { FoodCategory } from '../types';
import { openai, isOpenAIConfigured, disableOpenAI, FREE_MODEL } from './openaiClient';

/**
 * Enrichment result for a single item.
 */
export interface EnrichmentResult {
  /** Original index in the items array */
  index: number;
  /** AI-completed full product name */
  fullName: string;
  /** Level-1 food category */
  category: FoodCategory;
}

/**
 * Items that need enrichment — either unknown category or truncated name.
 */
export interface EnrichmentInput {
  index: number;
  name: string;
}

const VALID_CATEGORIES: FoodCategory[] = [
  'Produce', 'Protein', 'Grains', 'Dairy', 'Snacks',
  'Condiments', 'Beverages', 'Prepared', 'Canned', 'Frozen', 'Other',
];

/**
 * Detect if a product name looks truncated (common on thermal receipts
 * which typically print 28-32 chars per line).
 *
 * Heuristics:
 *  - Name ≥20 chars AND last token is 1-2 chars (e.g., "Balanced N")
 *  - Name ≥25 chars AND last token is 3-4 chars (e.g., "Greek Yogu", "Purified Wate")
 */
export function looksLikeTruncated(name: string): boolean {
  if (name.length < 20) return false;
  const tokens = name.trim().split(/[\s,]+/);
  const lastToken = tokens[tokens.length - 1] || '';
  if (lastToken.length === 0) return false;

  // Very short trailing fragment — definitely truncated
  if (lastToken.length <= 2) return true;

  // Medium fragment on a long name — probably truncated
  if (name.length >= 25 && lastToken.length <= 4) return true;

  return false;
}

/**
 * AI micro-call to enrich items that couldn't be categorized by rules
 * or have truncated names from receipt OCR.
 *
 * Strategy:
 *  - Only called for items that NEED it (not all items)
 *  - Single batch API call for all items at once
 *  - Focused prompt → faster response (~500-800ms for 3-8 items)
 *  - Graceful fallback if AI unavailable
 *
 * @param items - Items needing enrichment (with original index)
 * @returns Enrichment results (full name + category)
 */
export async function enrichUnknownItems(
  items: EnrichmentInput[]
): Promise<EnrichmentResult[]> {
  if (items.length === 0) return [];
  if (!isOpenAIConfigured()) return [];

  const prompt = `You are a grocery product name expert. Below are product names from a receipt that may be TRUNCATED (cut off due to receipt character limits).

For each item, provide:
1. "fullName": The complete, corrected product name (expand any truncation)
2. "category": One of: ${VALID_CATEGORIES.join(', ')}

Rules:
- Expand truncated names to their full product name (e.g., "Chobani Less Sugar Greek Yogu" → "Chobani Less Sugar Greek Yogurt")
- Non-food items (pet food, cleaning supplies, etc.) → "Other"
- Return valid JSON array only

Items:
${items.map((item, i) => `${i + 1}. "${item.name}"`).join('\n')}

Return JSON array:
[{"fullName": "...", "category": "..."}]`;

  try {
    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: 'Return ONLY a valid JSON array. No other text.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      fullName?: string;
      category?: string;
    }>;

    if (!Array.isArray(parsed)) return [];

    // Map results back to original indices with validation
    return parsed.map((result, i) => {
      if (i >= items.length) return null;

      const category = VALID_CATEGORIES.includes(result.category as FoodCategory)
        ? (result.category as FoodCategory)
        : 'Other';

      return {
        index: items[i].index,
        fullName: result.fullName?.trim() || items[i].name,
        category,
      };
    }).filter((r): r is EnrichmentResult => r !== null);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    console.warn('⚠️ AI enrichment failed, keeping original names:', error);
    return [];
  }
}
