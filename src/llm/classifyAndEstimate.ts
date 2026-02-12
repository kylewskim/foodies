import type { FoodCategory } from '../types';
import { openai, isOpenAIConfigured, disableOpenAI, FREE_MODEL } from './openaiClient';
import { classifyWithKeywords, capitalizeWords } from './classifyItems';
import { estimateWithRules } from './estimateExpirationDays';

export interface ClassifyAndEstimateOutput {
  is_food: boolean;
  normalized_name: string;
  category: FoodCategory;
  expiration_days: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Classify items and estimate expiration days in a single API call.
 *
 * Combines the work of classifyItems + estimateExpirationDaysBatch into
 * one prompt, reducing total OpenAI calls from 2 to 1.
 *
 * Falls back to keyword classification + rule-based estimation if API fails.
 */
export async function classifyAndEstimate(
  rawNames: string[]
): Promise<ClassifyAndEstimateOutput[]> {
  if (rawNames.length === 0) return [];

  if (!isOpenAIConfigured()) {
    return fallbackClassifyAndEstimate(rawNames);
  }

  return classifyAndEstimateWithAI(rawNames);
}

async function classifyAndEstimateWithAI(
  rawNames: string[]
): Promise<ClassifyAndEstimateOutput[]> {
  const systemPrompt = `You are a grocery item classifier and food expiration expert.

For each item, provide:
1. Whether it is a food item
2. A normalized name (capitalize properly, fix obvious typos)
3. Its food category
4. Estimated days until expiration
5. Confidence level for the expiration estimate

CATEGORIES (use exactly these values):
- Produce: Fresh fruits and vegetables
- Protein: Meat, poultry, seafood, eggs, tofu, beans, lentils
- Grains: Bread, rice, pasta, cereal, oats, quinoa, flour
- Dairy: Milk, cheese, yogurt, butter, cream, ice cream
- Snacks: Chips, cookies, candy, crackers, nuts, granola bars
- Condiments: Sauces, dressings, spices, oils, vinegar, ketchup, mustard
- Beverages: Water, juice, soda, coffee, tea, alcohol, energy drinks
- Prepared: Ready-to-eat meals, deli items, pre-cooked foods, takeout

EXPIRATION ASSUMPTIONS:
- Item is stored properly at home (refrigerated if needed)
- Item is unopened/fresh from store
- Average quality product
- Be conservative (better to estimate shorter than longer)

CONFIDENCE LEVELS:
- high: Very predictable items (milk, bread, fresh meat)
- medium: Somewhat variable (produce, cheese)
- low: Highly variable or uncertain

RULES:
- Preserve the exact order of input items
- is_food should be false only for clearly non-food items
- Return integer days for expiration

OUTPUT FORMAT (JSON array, one entry per item):
[
  {
    "is_food": true,
    "normalized_name": "Fresh Milk",
    "category": "Dairy",
    "expiration_days": 7,
    "confidence": "high"
  },
  ...
]`;

  try {
    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON array, no other text.' },
        { role: 'user', content: `Classify and estimate expiration for these items:\n${rawNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}` }
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

    if (!Array.isArray(parsed) || parsed.length !== rawNames.length) {
      console.warn('ClassifyAndEstimate result count mismatch. Falling back to rules.');
      return fallbackClassifyAndEstimate(rawNames);
    }

    const validCategories: FoodCategory[] = [
      'Produce', 'Protein', 'Grains', 'Dairy',
      'Snacks', 'Condiments', 'Beverages', 'Prepared',
      'Canned', 'Frozen', 'Other'
    ];
    const validConfidences = ['high', 'medium', 'low'] as const;

    return parsed.map((result: {
      is_food?: boolean;
      normalized_name?: string;
      category?: string;
      expiration_days?: number;
      confidence?: string;
    }, index: number) => {
      const category = validCategories.includes(result.category as FoodCategory)
        ? (result.category as FoodCategory)
        : 'Produce';

      const expirationDays = typeof result.expiration_days === 'number'
        ? Math.max(1, Math.round(result.expiration_days))
        : estimateWithRules(result.normalized_name || rawNames[index], category).expiration_days;

      const confidence = validConfidences.includes(result.confidence as typeof validConfidences[number])
        ? (result.confidence as 'high' | 'medium' | 'low')
        : 'medium';

      return {
        is_food: result.is_food ?? true,
        normalized_name: result.normalized_name || capitalizeWords(rawNames[index]),
        category,
        expiration_days: expirationDays,
        confidence,
      };
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    return fallbackClassifyAndEstimate(rawNames);
  }
}

function fallbackClassifyAndEstimate(rawNames: string[]): ClassifyAndEstimateOutput[] {
  const classified = classifyWithKeywords(rawNames);
  return classified.map(c => {
    const expiration = estimateWithRules(c.normalized_name, c.category);
    return {
      ...c,
      expiration_days: expiration.expiration_days,
      confidence: expiration.confidence,
    };
  });
}
