import type { EstimateExpirationDaysOutput, FoodCategory } from '../types';
import { openai, isOpenAIConfigured, disableOpenAI, FREE_MODEL } from './openaiClient';
import { estimateWithRules } from './estimateExpirationDays';

interface BatchExpirationInput {
  normalized_name: string;
  category: FoodCategory;
}

/**
 * Batch estimate expiration days for multiple food items in a single API call.
 *
 * Instead of calling the API N times (once per item), this sends all items
 * in one prompt and gets all estimates back at once.
 *
 * Falls back to rule-based estimation if API is unavailable or fails.
 */
export async function estimateExpirationDaysBatch(
  items: BatchExpirationInput[]
): Promise<EstimateExpirationDaysOutput[]> {
  if (items.length === 0) return [];

  if (!isOpenAIConfigured()) {
    return items.map(item => estimateWithRules(item.normalized_name, item.category));
  }

  return estimateBatchWithAI(items);
}

async function estimateBatchWithAI(
  items: BatchExpirationInput[]
): Promise<EstimateExpirationDaysOutput[]> {
  const systemPrompt = `You are a food expiration expert. Estimate how many days until each food item expires.

ASSUMPTIONS:
- Item is stored properly at home (refrigerated if needed)
- Item is unopened/fresh from store
- Average quality product

CONFIDENCE LEVELS:
- high: Very predictable items (milk, bread, fresh meat)
- medium: Somewhat variable (produce, cheese)
- low: Highly variable or uncertain

RULES:
- Return only the number of days (integer) for each item
- Be conservative (better to estimate shorter than longer)
- Consider typical home storage conditions
- Preserve the exact order of input items

OUTPUT FORMAT (JSON array, one entry per item):
[
  { "expiration_days": number, "confidence": "high" | "medium" | "low" },
  ...
]

EXAMPLES:
- Fresh milk (Dairy) → { "expiration_days": 7, "confidence": "high" }
- Bananas (Produce) → { "expiration_days": 5, "confidence": "medium" }
- Fresh salmon (Protein) → { "expiration_days": 2, "confidence": "high" }
- Canned beans (Prepared) → { "expiration_days": 730, "confidence": "medium" }`;

  const userMessage = `Estimate expiration days for these items:\n${items.map((item, i) => `${i + 1}. ${item.normalized_name} (${item.category})`).join('\n')}`;

  try {
    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON array, no other text.' },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from API');
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON array in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed) || parsed.length !== items.length) {
      console.warn('Batch expiration result count mismatch. Falling back to rules.');
      return items.map(item => estimateWithRules(item.normalized_name, item.category));
    }

    const validConfidences = ['high', 'medium', 'low'] as const;

    return parsed.map((result: { expiration_days?: number; confidence?: string }, index: number) => {
      const expirationDays = typeof result.expiration_days === 'number'
        ? Math.max(1, Math.round(result.expiration_days))
        : estimateWithRules(items[index].normalized_name, items[index].category).expiration_days;

      const confidence = validConfidences.includes(result.confidence as typeof validConfidences[number])
        ? (result.confidence as 'high' | 'medium' | 'low')
        : 'medium';

      return { expiration_days: expirationDays, confidence };
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    return items.map(item => estimateWithRules(item.normalized_name, item.category));
  }
}
