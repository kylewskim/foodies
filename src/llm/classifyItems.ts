import type { ClassifyItemOutput, FoodCategory } from '../types';
import { openai, isOpenAIConfigured, disableOpenAI, FREE_MODEL } from './openaiClient';

/**
 * Classify items as food or non-food and categorize them
 * 
 * Uses OpenAI GPT-4 for intelligent classification.
 * Falls back to keyword-based classification if API is not configured.
 * 
 * @param rawNames - Array of raw item names
 * @returns Array of classification results, preserving input order
 */
export async function classifyItems(rawNames: string[]): Promise<ClassifyItemOutput[]> {
  if (rawNames.length === 0) {
    return [];
  }

  // OpenAI API가 설정되어 있으면 AI 사용
  if (isOpenAIConfigured()) {
    return classifyWithAI(rawNames);
  }
  
  // 설정되지 않으면 기존 키워드 매칭 사용
  console.log('⚠️ OpenAI API 키가 없어서 기본 키워드 매칭을 사용합니다.');
  return classifyWithKeywords(rawNames);
}

/**
 * AI를 사용한 아이템 분류
 */
async function classifyWithAI(rawNames: string[]): Promise<ClassifyItemOutput[]> {
  const systemPrompt = `You are a grocery item classifier. Classify each item into a food category.

CATEGORIES (use exactly these values):
- Produce: Fresh fruits and vegetables
- Protein: Meat, poultry, seafood, eggs, tofu, beans, lentils
- Grains: Bread, rice, pasta, cereal, oats, quinoa, flour
- Dairy: Milk, cheese, yogurt, butter, cream, ice cream
- Snacks: Chips, cookies, candy, crackers, nuts, granola bars
- Condiments: Sauces, dressings, spices, oils, vinegar, ketchup, mustard
- Beverages: Water, juice, soda, coffee, tea, alcohol, energy drinks
- Prepared: Ready-to-eat meals, deli items, pre-cooked foods, takeout

RULES:
- Preserve the exact order of input items
- Normalize names (capitalize properly, fix typos if obvious)
- is_food should be false only for non-food and unknown categories

OUTPUT FORMAT (JSON array):
[
  {
    "is_food": true/false,
    "normalized_name": "Properly Capitalized Name",
    "category": "category_name"
  }
]`;

  try {
    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON array, no other text.' },
        { role: 'user', content: `Classify these items:\n${rawNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}` }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from API');
    }

    // JSON 추출 (배열 또는 객체)
    const jsonMatch = content.match(/[\[\{][\s\S]*[\]\}]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    
    // 결과가 배열인지 확인 (응답이 { items: [...] } 형태일 수 있음)
    let results: ClassifyItemOutput[] = Array.isArray(parsed) ? parsed : (parsed.items || parsed.classifications || []);
    
    // 결과 수가 입력과 일치하는지 확인
    if (results.length !== rawNames.length) {
      console.warn('AI 결과 수가 입력과 일치하지 않습니다. 키워드 매칭으로 폴백합니다.');
      return classifyWithKeywords(rawNames);
    }
    
    // 카테고리 유효성 검증
    const validCategories: FoodCategory[] = [
      'Produce', 'Protein', 'Grains', 'Dairy', 
      'Snacks', 'Condiments', 'Beverages', 'Prepared'
    ];
    
    return results.map((result, index) => ({
      is_food: result.is_food ?? true,
      normalized_name: result.normalized_name || capitalizeWords(rawNames[index]),
      category: validCategories.includes(result.category as FoodCategory) 
        ? result.category as FoodCategory 
        : 'Produce', // Default to Produce
    }));
  } catch (error: unknown) {
    // 429 에러 (한도 초과) 시 API 비활성화
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    return classifyWithKeywords(rawNames);
  }
}

/**
 * 키워드 매칭을 사용한 아이템 분류 (폴백)
 */
function classifyWithKeywords(rawNames: string[]): ClassifyItemOutput[] {
  return rawNames.map(rawName => {
    const nameLower = rawName.toLowerCase();
    
    // Produce
    const produceKeywords = ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'potato', 'onion', 'carrot', 'spinach', 'broccoli', 'cucumber', 'pepper', 'avocado', 'strawberry', 'grape', 'watermelon', 'pear', 'peach', 'plum', 'berry', 'fruit', 'vegetable', 'salad', 'lemon', 'lime', 'mango', 'pineapple', 'celery', 'garlic', 'ginger', '사과', '바나나', '오렌지', '상추', '토마토', '감자', '양파', '당근', '시금치', '브로콜리', '오이', '고추', '아보카도', '딸기', '포도', '수박', '배', '복숭아', '자두', '과일', '야채', '샐러드'];
    if (produceKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Produce' as FoodCategory };
    }
    
    // Protein (meat, seafood, eggs, beans, tofu)
    const proteinKeywords = ['chicken', 'beef', 'pork', 'turkey', 'steak', 'ground', 'sausage', 'bacon', 'ham', 'lamb', 'meat', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'cod', 'tilapia', 'seafood', 'egg', 'tofu', 'bean', 'lentil', '닭', '소고기', '돼지', '칠면조', '스테이크', '소시지', '베이컨', '햄', '양고기', '고기', '삼겹살', '갈비', '생선', '연어', '참치', '새우', '게', '랍스터', '해산물', '오징어', '조개', '계란', '두부', '콩'];
    if (proteinKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Protein' as FoodCategory };
    }
    
    // Grains
    const grainsKeywords = ['bread', 'bagel', 'muffin', 'croissant', 'donut', 'cake', 'pastry', 'bun', 'roll', 'pasta', 'rice', 'cereal', 'oatmeal', 'quinoa', 'flour', 'wheat', 'barley', '빵', '베이글', '머핀', '크루아상', '도넛', '케이크', '식빵', '파스타', '쌀', '시리얼', '오트밀', '라면', '국수', '밀가루'];
    if (grainsKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Grains' as FoodCategory };
    }
    
    // Dairy
    const dairyKeywords = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'cottage', 'cheddar', 'mozzarella', 'parmesan', 'ice cream', '우유', '치즈', '요거트', '버터', '크림', '아이스크림'];
    if (dairyKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Dairy' as FoodCategory };
    }
    
    // Snacks
    const snackKeywords = ['chips', 'crackers', 'cookies', 'candy', 'chocolate', 'popcorn', 'pretzels', 'nuts', 'granola', '과자', '쿠키', '사탕', '초콜릿', '팝콘', '견과류'];
    if (snackKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Snacks' as FoodCategory };
    }
    
    // Condiments
    const condimentKeywords = ['sauce', 'dressing', 'ketchup', 'mustard', 'mayonnaise', 'oil', 'vinegar', 'salt', 'pepper', 'spice', 'seasoning', 'soy', 'worcestershire', '소스', '드레싱', '케첩', '머스타드', '마요네즈', '기름', '식초', '소금', '후추', '양념'];
    if (condimentKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Condiments' as FoodCategory };
    }
    
    // Beverages
    const beverageKeywords = ['water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine', 'drink', 'beverage', 'energy', '물', '주스', '콜라', '커피', '차', '맥주', '와인', '음료'];
    if (beverageKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Beverages' as FoodCategory };
    }
    
    // Prepared (ready-to-eat, deli, takeout)
    const preparedKeywords = ['deli', 'sandwich', 'salad', 'soup', 'ready', 'prepared', 'takeout', 'meal', '델리', '샌드위치', '수프', '도시락'];
    if (preparedKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Prepared' as FoodCategory };
    }
    
    // Default to Produce if it seems like food
    return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Produce' as FoodCategory };
  });
}

/**
 * 단어 첫 글자 대문자화
 */
function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
