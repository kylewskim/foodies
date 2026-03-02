import type { EstimateExpirationDaysOutput, FoodCategory } from '../types';
import { openai, isOpenAIConfigured, disableOpenAI, FREE_MODEL } from './openaiClient';

/**
 * Estimate expiration days for a food item
 * 
 * Uses OpenAI GPT-4 for intelligent estimation.
 * Falls back to category-based rules if API is not configured.
 * 
 * Assumptions:
 * - Typical household storage (refrigerated as appropriate)
 * - Unopened items
 * 
 * @param normalizedName - The normalized item name
 * @param category - The food category
 * @returns Expiration days and confidence level
 */
export async function estimateExpirationDays(
  normalizedName: string,
  category: FoodCategory
): Promise<EstimateExpirationDaysOutput> {
  // Use AI if OpenAI API is configured
  if (isOpenAIConfigured()) {
    return estimateWithAI(normalizedName, category);
  }

  // Fall back to rule-based estimation if API is not configured
  return estimateWithRules(normalizedName, category);
}

/**
 * Estimate expiration days using AI
 */
async function estimateWithAI(
  normalizedName: string,
  category: FoodCategory
): Promise<EstimateExpirationDaysOutput> {
  const systemPrompt = `You are a food expiration expert. Estimate how many days until a food item expires.

ASSUMPTIONS:
- Item is stored properly at home (refrigerated if needed)
- Item is unopened/fresh from store
- Average quality product

CONFIDENCE LEVELS:
- high: Very predictable items (milk, bread, fresh meat)
- medium: Somewhat variable (produce, cheese)
- low: Highly variable or uncertain

RULES:
- Return only the number of days (integer)
- Be conservative (better to estimate shorter than longer)
- Consider typical home storage conditions

OUTPUT FORMAT (JSON only):
{
  "expiration_days": number,
  "confidence": "high" | "medium" | "low"
}

EXAMPLES:
- Fresh milk → { "expiration_days": 7, "confidence": "high" }
- Bananas → { "expiration_days": 5, "confidence": "medium" }
- Fresh salmon → { "expiration_days": 2, "confidence": "high" }
- Canned beans → { "expiration_days": 730, "confidence": "medium" }`;

  try {
    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, no other text.' },
        { role: 'user', content: `Item: "${normalizedName}"\nCategory: ${category}\n\nEstimate expiration days.` }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from API');
    }

    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate result
    const expirationDays = typeof parsed.expiration_days === 'number'
      ? Math.max(1, Math.round(parsed.expiration_days)) 
      : 7;
    
    const validConfidences = ['high', 'medium', 'low'] as const;
    const confidence = validConfidences.includes(parsed.confidence) 
      ? parsed.confidence 
      : 'medium';
    
    return { expiration_days: expirationDays, confidence };
  } catch (error: unknown) {
    // Disable API on 429 (rate limit exceeded)
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    return estimateWithRules(normalizedName, category);
  }
}

/**
 * Rule-based expiration estimation (fallback)
 */
export function estimateWithRules(
  normalizedName: string,
  category: FoodCategory
): EstimateExpirationDaysOutput {
  const nameLower = normalizedName.toLowerCase();
  
  // Default values by category
  const categoryDefaults: Record<FoodCategory, { days: number; confidence: 'high' | 'medium' | 'low' }> = {
    Produce: { days: 7, confidence: 'medium' },
    Protein: { days: 3, confidence: 'high' },
    Grains: { days: 5, confidence: 'medium' },
    Dairy: { days: 14, confidence: 'high' },
    Snacks: { days: 60, confidence: 'medium' },
    Condiments: { days: 365, confidence: 'medium' },
    Beverages: { days: 30, confidence: 'medium' },
    Prepared: { days: 3, confidence: 'medium' },
    Canned: { days: 730, confidence: 'high' },
    Frozen: { days: 180, confidence: 'medium' },
    Other: { days: 365, confidence: 'low' },
  };
  
  let result = { ...categoryDefaults[category] };
  
  // Produce overrides
  if (category === 'Produce') {
    // Perishable
    if (/berry|strawberry|raspberry|lettuce|spinach|salad/.test(nameLower)) {
      result = { days: 3, confidence: 'high' };
    }
    // Medium shelf life
    else if (/tomato|cucumber|pepper|avocado/.test(nameLower)) {
      result = { days: 5, confidence: 'high' };
    }
    // Long shelf life
    else if (/potato|onion|carrot|apple/.test(nameLower)) {
      result = { days: 14, confidence: 'high' };
    }
    // Banana
    else if (/banana/.test(nameLower)) {
      result = { days: 5, confidence: 'high' };
    }
  }

  // Dairy overrides
  if (category === 'Dairy') {
    if (/milk/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    } else if (/yogurt/.test(nameLower)) {
      result = { days: 14, confidence: 'high' };
    } else if (/cheese/.test(nameLower)) {
      result = { days: 21, confidence: 'high' };
    } else if (/butter/.test(nameLower)) {
      result = { days: 30, confidence: 'high' };
    }
  }

  // Protein overrides
  if (category === 'Protein') {
    if (/ground/.test(nameLower)) {
      result = { days: 2, confidence: 'high' };
    } else if (/chicken/.test(nameLower)) {
      result = { days: 2, confidence: 'high' };
    } else if (/bacon/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    } else if (/sausage/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    }
  }

  // Grains overrides
  if (category === 'Grains') {
    if (/bread/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    } else if (/bagel/.test(nameLower)) {
      result = { days: 5, confidence: 'high' };
    } else if (/cake/.test(nameLower)) {
      result = { days: 3, confidence: 'medium' };
    }
  }

  // Beverages overrides
  if (category === 'Beverages') {
    if (/juice/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    } else if (/water/.test(nameLower)) {
      result = { days: 365, confidence: 'high' };
    }
  }
  
  return {
    expiration_days: result.days,
    confidence: result.confidence,
  };
}
