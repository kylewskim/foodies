import type { NormalizeInputTextOutput } from '../types';
import { openai, isOpenAIConfigured, disableOpenAI, FREE_MODEL } from './openaiClient';

/**
 * Normalize raw OCR text or manual user input
 * 
 * This function extracts purchase date and item list from raw text.
 * Uses OpenAI GPT-4 for intelligent parsing.
 * Falls back to simple pattern matching if API is not configured.
 * 
 * @param rawText - Raw text from OCR or manual input
 * @returns Normalized output with purchase_date and items array
 */
export async function normalizeInputText(rawText: string): Promise<NormalizeInputTextOutput> {
  // OpenAI API가 설정되어 있으면 AI 사용
  if (isOpenAIConfigured()) {
    return normalizeWithAI(rawText);
  }
  
  // 설정되지 않으면 기존 패턴 매칭 사용
  console.log('⚠️ OpenAI API 키가 없어서 기본 패턴 매칭을 사용합니다.');
  return normalizeWithPatternMatching(rawText);
}

/**
 * AI를 사용한 텍스트 정규화
 */
async function normalizeWithAI(rawText: string): Promise<NormalizeInputTextOutput> {
  const systemPrompt = `You are a grocery receipt parser. Extract items and purchase date from the given text.

RULES:
- Extract only food/grocery items
- Ignore prices, totals, store names, slogans, tax
- Extract quantity if mentioned (e.g., "2 Apples" → quantity: "2")
- Find purchase date if present (any format)
- Return valid JSON only

OUTPUT FORMAT:
{
  "purchase_date": "ISO 8601 date string or null",
  "items": [
    { "raw_name": "item name as written", "quantity": "number as string or null" }
  ]
}

EXAMPLES:
Input: "2 Apples $3.99"
Output: { "purchase_date": null, "items": [{ "raw_name": "Apples", "quantity": "2" }] }

Input: "Date: 01/15/2024\nMilk\nBread"
Output: { "purchase_date": "2024-01-15T00:00:00.000Z", "items": [{ "raw_name": "Milk", "quantity": null }, { "raw_name": "Bread", "quantity": null }] }`;

  try {
    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, no other text.' },
        { role: 'user', content: rawText }
      ],
      temperature: 0.1, // 일관된 결과를 위해 낮은 temperature
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from API');
    }

    // JSON 추출 (모델이 추가 텍스트를 반환할 수 있음)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in response');
    }
    const parsed = JSON.parse(jsonMatch[0]) as NormalizeInputTextOutput;
    
    // 결과 검증
    if (!Array.isArray(parsed.items)) {
      parsed.items = [];
    }
    
    return parsed;
  } catch (error: unknown) {
    // 429 에러 (한도 초과) 시 API 비활성화
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    // API 실패 시 패턴 매칭으로 폴백
    return normalizeWithPatternMatching(rawText);
  }
}

/**
 * 패턴 매칭을 사용한 텍스트 정규화 (폴백)
 */
function normalizeWithPatternMatching(rawText: string): NormalizeInputTextOutput {
  const lines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  let purchaseDate: string | null = null;
  const items: Array<{ raw_name: string; quantity: string | null }> = [];
  
  // 날짜 패턴 매칭
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
  
  // 무시할 패턴
  const ignorePatterns = [
    /total/i,
    /subtotal/i,
    /tax/i,
    /^\$[\d.]+$/,
    /^\d+\.\d{2}$/,
    /thank you/i,
    /visit us/i,
    /store/i,
    /receipt/i,
    /change/i,
    /cash/i,
    /card/i,
    /visa/i,
    /mastercard/i,
  ];
  
  for (const line of lines) {
    // 날짜 추출
    const dateMatch = line.match(datePattern);
    if (dateMatch && !purchaseDate) {
      try {
        const parsedDate = new Date(dateMatch[0]);
        if (!isNaN(parsedDate.getTime())) {
          purchaseDate = parsedDate.toISOString();
        }
      } catch {
        // 무효한 날짜는 무시
      }
      continue;
    }
    
    // 무시할 라인 건너뛰기
    const shouldIgnore = ignorePatterns.some(pattern => pattern.test(line));
    if (shouldIgnore) continue;
    
    // 가격 제거 (예: "Milk $3.99" → "Milk")
    const lineWithoutPrice = line.replace(/\$[\d.]+/g, '').trim();
    if (!lineWithoutPrice) continue;
    
    // 수량 추출
    const quantityMatch = lineWithoutPrice.match(/^(\d+)\s*x?\s*(.+)$/i);
    if (quantityMatch) {
      items.push({
        raw_name: quantityMatch[2].trim(),
        quantity: quantityMatch[1],
      });
    } else {
      items.push({
        raw_name: lineWithoutPrice,
        quantity: null,
      });
    }
  }
  
  return { purchase_date: purchaseDate, items };
}
