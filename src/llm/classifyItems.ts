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

  // Use AI if OpenAI API is configured
  if (isOpenAIConfigured()) {
    return classifyWithAI(rawNames);
  }

  // Fall back to keyword matching if API is not configured
  console.log('⚠️ OpenAI API key not found. Using keyword matching fallback.');
  return classifyWithKeywords(rawNames);
}

/**
 * Classify items using AI
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

    // Extract JSON (array or object)
    const jsonMatch = content.match(/[\[\{][\s\S]*[\]\}]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // Ensure result is an array (response may be wrapped as { items: [...] })
    let results: ClassifyItemOutput[] = Array.isArray(parsed) ? parsed : (parsed.items || parsed.classifications || []);

    // Verify result count matches input count
    if (results.length !== rawNames.length) {
      console.warn('AI result count does not match input count. Falling back to keyword matching.');
      return classifyWithKeywords(rawNames);
    }
    
    // Validate categories
    const validCategories: FoodCategory[] = [
      'Produce', 'Protein', 'Grains', 'Dairy', 
      'Snacks', 'Condiments', 'Beverages', 'Prepared',
      'Canned', 'Frozen', 'Other'
    ];
    
    return results.map((result, index) => ({
      is_food: result.is_food ?? true,
      normalized_name: result.normalized_name || capitalizeWords(rawNames[index]),
      category: validCategories.includes(result.category as FoodCategory) 
        ? result.category as FoodCategory 
        : 'Produce', // Default to Produce
    }));
  } catch (error: unknown) {
    // Disable API on 429 (rate limit exceeded)
    if (error instanceof Error && error.message.includes('429')) {
      disableOpenAI();
    }
    return classifyWithKeywords(rawNames);
  }
}

/**
 * Keyword-based item classification (fallback)
 */
export function classifyWithKeywords(rawNames: string[]): ClassifyItemOutput[] {
  return rawNames.map(rawName => {
    const nameLower = rawName.toLowerCase();
    
    // Produce
    const produceKeywords = ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'potato', 'onion', 'carrot', 'spinach', 'broccoli', 'cucumber', 'pepper', 'avocado', 'strawberry', 'grape', 'watermelon', 'pear', 'peach', 'plum', 'berry', 'fruit', 'vegetable', 'salad', 'lemon', 'lime', 'mango', 'pineapple', 'celery', 'garlic', 'ginger'];
    if (produceKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Produce' as FoodCategory };
    }
    
    // Protein (meat, seafood, eggs, beans, tofu)
    const proteinKeywords = ['chicken', 'beef', 'pork', 'turkey', 'steak', 'ground', 'sausage', 'bacon', 'ham', 'lamb', 'meat', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'cod', 'tilapia', 'seafood', 'egg', 'tofu', 'bean', 'lentil'];
    if (proteinKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Protein' as FoodCategory };
    }
    
    // Grains
    const grainsKeywords = ['bread', 'bagel', 'muffin', 'croissant', 'donut', 'cake', 'pastry', 'bun', 'roll', 'pasta', 'rice', 'cereal', 'oatmeal', 'quinoa', 'flour', 'wheat', 'barley'];
    if (grainsKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Grains' as FoodCategory };
    }
    
    // Dairy
    const dairyKeywords = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'cottage', 'cheddar', 'mozzarella', 'parmesan', 'ice cream'];
    if (dairyKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Dairy' as FoodCategory };
    }
    
    // Snacks
    const snackKeywords = ['chips', 'crackers', 'cookies', 'candy', 'chocolate', 'popcorn', 'pretzels', 'nuts', 'granola'];
    if (snackKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Snacks' as FoodCategory };
    }
    
    // Condiments
    const condimentKeywords = ['sauce', 'dressing', 'ketchup', 'mustard', 'mayonnaise', 'oil', 'vinegar', 'salt', 'pepper', 'spice', 'seasoning', 'soy', 'worcestershire'];
    if (condimentKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Condiments' as FoodCategory };
    }
    
    // Beverages
    const beverageKeywords = ['water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine', 'drink', 'beverage', 'energy'];
    if (beverageKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Beverages' as FoodCategory };
    }
    
    // Prepared (ready-to-eat, deli, takeout)
    const preparedKeywords = ['deli', 'sandwich', 'salad', 'soup', 'ready', 'prepared', 'takeout', 'meal'];
    if (preparedKeywords.some(kw => nameLower.includes(kw))) {
      return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Prepared' as FoodCategory };
    }
    
    // Default to Produce if it seems like food
    return { is_food: true, normalized_name: capitalizeWords(rawName), category: 'Produce' as FoodCategory };
  });
}

/**
 * Capitalize the first letter of each word
 */
export function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
