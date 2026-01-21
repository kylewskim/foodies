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
  // OpenAI API가 설정되어 있으면 AI 사용
  if (isOpenAIConfigured()) {
    return estimateWithAI(normalizedName, category);
  }
  
  // 설정되지 않으면 기존 규칙 기반 사용
  return estimateWithRules(normalizedName, category);
}

/**
 * AI를 사용한 유통기한 추정
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

    // JSON 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    
    // 결과 검증
    const expirationDays = typeof parsed.expiration_days === 'number' 
      ? Math.max(1, Math.round(parsed.expiration_days)) 
      : 7;
    
    const validConfidences = ['high', 'medium', 'low'] as const;
    const confidence = validConfidences.includes(parsed.confidence) 
      ? parsed.confidence 
      : 'medium';
    
    return { expiration_days: expirationDays, confidence };
  } catch (error: unknown) {
    // 429 에러 (한도 초과) 시 API 비활성화
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    return estimateWithRules(normalizedName, category);
  }
}

/**
 * 규칙 기반 유통기한 추정 (폴백)
 */
function estimateWithRules(
  normalizedName: string,
  category: FoodCategory
): EstimateExpirationDaysOutput {
  const nameLower = normalizedName.toLowerCase();
  
  // 카테고리별 기본값
  const categoryDefaults: Record<FoodCategory, { days: number; confidence: 'high' | 'medium' | 'low' }> = {
    Produce: { days: 7, confidence: 'medium' },
    Protein: { days: 3, confidence: 'high' },
    Grains: { days: 5, confidence: 'medium' },
    Dairy: { days: 14, confidence: 'high' },
    Snacks: { days: 60, confidence: 'medium' },
    Condiments: { days: 365, confidence: 'medium' },
    Beverages: { days: 30, confidence: 'medium' },
    Prepared: { days: 3, confidence: 'medium' },
  };
  
  let result = { ...categoryDefaults[category] };
  
  // 농산물 세부 조정
  if (category === 'Produce') {
    // 빨리 상하는 것들
    if (/berry|strawberry|raspberry|lettuce|spinach|salad|딸기|상추|시금치|샐러드/.test(nameLower)) {
      result = { days: 3, confidence: 'high' };
    }
    // 중간
    else if (/tomato|cucumber|pepper|avocado|토마토|오이|고추|아보카도/.test(nameLower)) {
      result = { days: 5, confidence: 'high' };
    }
    // 오래 가는 것들
    else if (/potato|onion|carrot|apple|감자|양파|당근|사과/.test(nameLower)) {
      result = { days: 14, confidence: 'high' };
    }
    // 바나나
    else if (/banana|바나나/.test(nameLower)) {
      result = { days: 5, confidence: 'high' };
    }
  }
  
  // 유제품 세부 조정
  if (category === 'Dairy') {
    if (/milk|우유/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    } else if (/yogurt|요거트|요구르트/.test(nameLower)) {
      result = { days: 14, confidence: 'high' };
    } else if (/cheese|치즈/.test(nameLower)) {
      result = { days: 21, confidence: 'high' };
    } else if (/butter|버터/.test(nameLower)) {
      result = { days: 30, confidence: 'high' };
    }
  }
  
  // 단백질 세부 조정
  if (category === 'Protein') {
    if (/ground|다진|간/.test(nameLower)) {
      result = { days: 2, confidence: 'high' };
    } else if (/chicken|닭/.test(nameLower)) {
      result = { days: 2, confidence: 'high' };
    } else if (/bacon|베이컨/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    } else if (/sausage|소시지/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    }
  }
  
  // 빵류/곡물 세부 조정
  if (category === 'Grains') {
    if (/bread|식빵|빵/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    } else if (/bagel|베이글/.test(nameLower)) {
      result = { days: 5, confidence: 'high' };
    } else if (/cake|케이크/.test(nameLower)) {
      result = { days: 3, confidence: 'medium' };
    }
  }
  
  // 음료 세부 조정
  if (category === 'Beverages') {
    if (/juice|주스/.test(nameLower)) {
      result = { days: 7, confidence: 'high' };
    } else if (/water|물/.test(nameLower)) {
      result = { days: 365, confidence: 'high' };
    }
  }
  
  return {
    expiration_days: result.days,
    confidence: result.confidence,
  };
}
