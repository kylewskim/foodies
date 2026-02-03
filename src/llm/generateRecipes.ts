import { openai, FREE_MODEL, isOpenAIConfigured } from './openaiClient';
import type { Item } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';

export interface AIRecipe {
  name: string;
  description: string;
  ingredients: string[];
  matchedIngredients: string[];
  prepTime: string;
  calories: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  instructions: string[];
}

export async function generateRecipes(items: Item[]): Promise<AIRecipe[]> {
  // Check if OpenAI/Groq is configured
  if (!isOpenAIConfigured()) {
    console.warn('Groq API not configured, using fallback recipes');
    return getFallbackRecipes(items);
  }

  try {
    // Sort items by expiration date (earliest first)
    const sortedItems = [...items].sort((a, b) => {
      const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
      const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
      return expA.getTime() - expB.getTime();
    });

    // Create ingredient list with expiration info
    const ingredientList = sortedItems.map(item => {
      const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
      const daysUntil = getDaysUntilExpiration(expirationDate);
      return `- ${item.name} (expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}, category: ${item.category})`;
    }).join('\n');

    const prompt = `Given these ingredients currently in the user's fridge/pantry:

${ingredientList}

Generate 6 delicious and practical recipe recommendations that:
1. PRIORITIZE ingredients that expire soonest to reduce food waste
2. Use as many of the available ingredients as possible
3. Are practical and achievable for home cooking
4. Consider that users may have common pantry staples (salt, pepper, oil, butter, flour, sugar)

For each recipe, return:
- name: Recipe name (creative and appetizing)
- description: Brief 2-3 sentence description that sounds delicious and inviting
- ingredients: Complete list of ALL ingredients needed with quantities (e.g., "2 cups rice", "150g chicken breast")
- matchedIngredients: List of ingredients from the user's inventory (use exact names from the list above)
- prepTime: Total time in format "X min" (e.g., "30 min", "45 min")
- calories: Estimated calories per serving (number only, e.g., 450)
- difficulty: One of "Easy", "Medium", or "Hard"
- instructions: Array of 3-6 detailed step-by-step cooking instructions

Return ONLY a valid JSON array with 6 recipes. No additional text, markdown, or explanations.
Format: [{name: string, description: string, ingredients: string[], matchedIngredients: string[], prepTime: string, calories: number, difficulty: string, instructions: string[]}, ...]`;

    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a professional chef and meal planning assistant. You provide practical, delicious recipe recommendations based on available ingredients. Always return valid JSON only, no markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    const recipes: AIRecipe[] = JSON.parse(content);

    // Validate and limit to 8 recipes
    if (!Array.isArray(recipes)) {
      throw new Error('Invalid response format');
    }

    return recipes.slice(0, 8);
  } catch (error) {
    console.error('Error generating recipes with AI:', error);
    return getFallbackRecipes(items);
  }
}

// Fallback recipes when AI is not available
function getFallbackRecipes(items: Item[]): AIRecipe[] {
  const itemNames = items.map(item => item.name.toLowerCase());

  const allRecipes: AIRecipe[] = [
    {
      name: 'Fresh Green Salad',
      description: 'A crisp and healthy salad with fresh vegetables. Perfect for a light meal or side dish.',
      ingredients: ['2 cups lettuce', '1 tomato', '1 cucumber', '1 avocado', '2 tbsp olive oil', '1 tbsp lemon juice'],
      matchedIngredients: [],
      prepTime: '15 min',
      calories: 220,
      difficulty: 'Easy',
      instructions: [
        'Wash and chop all vegetables into bite-sized pieces',
        'Combine lettuce, tomato, cucumber in a large bowl',
        'Slice avocado and add to the bowl',
        'Drizzle with olive oil and lemon juice, toss gently and serve'
      ],
    },
    {
      name: 'Berry Smoothie Bowl',
      description: 'A refreshing smoothie bowl topped with fresh fruits. Nutritious and Instagram-worthy breakfast.',
      ingredients: ['1 banana', '1 cup strawberries', '1/2 cup yogurt', '1/2 cup milk', '1 tbsp honey', '1/4 cup granola'],
      matchedIngredients: [],
      prepTime: '10 min',
      calories: 320,
      difficulty: 'Easy',
      instructions: [
        'Add banana, strawberries, yogurt, and milk to blender',
        'Blend until smooth and creamy',
        'Pour into a bowl',
        'Top with granola and extra berries, drizzle with honey'
      ],
    },
    {
      name: 'Pasta with Tomato Sauce',
      description: 'Classic Italian pasta with homemade tomato sauce. Simple yet delicious comfort food.',
      ingredients: ['200g pasta', '2 cups tomato sauce', '3 cloves garlic', '1 onion', '2 tbsp olive oil', 'fresh basil'],
      matchedIngredients: [],
      prepTime: '25 min',
      calories: 450,
      difficulty: 'Easy',
      instructions: [
        'Cook pasta according to package instructions',
        'Sauté chopped garlic and onion in olive oil',
        'Add tomato sauce and simmer for 10 minutes',
        'Drain pasta and toss with sauce, garnish with basil'
      ],
    },
    {
      name: 'Chicken Stir Fry',
      description: 'Quick and flavorful chicken stir fry with vegetables. A perfect weeknight dinner.',
      ingredients: ['300g chicken breast', '2 cups broccoli', '1 carrot', '3 tbsp soy sauce', '1 cup rice', '1 inch ginger'],
      matchedIngredients: [],
      prepTime: '20 min',
      calories: 520,
      difficulty: 'Medium',
      instructions: [
        'Cook rice according to package directions',
        'Cut chicken into bite-sized pieces and stir-fry until golden',
        'Add vegetables and grated ginger, cook for 5 minutes',
        'Add soy sauce, toss well and serve over rice'
      ],
    },
    {
      name: 'Classic Club Sandwich',
      description: 'A hearty sandwich with multiple layers of goodness. Perfect for lunch on the go.',
      ingredients: ['3 slices bread', '2 slices cheese', '2 leaves lettuce', '1 tomato', '2 tbsp mayonnaise', '3 slices ham'],
      matchedIngredients: [],
      prepTime: '10 min',
      calories: 380,
      difficulty: 'Easy',
      instructions: [
        'Toast bread slices until golden',
        'Spread mayonnaise on each slice',
        'Layer ham, cheese, lettuce, and sliced tomato',
        'Stack all three slices, cut diagonally and serve'
      ],
    },
    {
      name: 'Vegetable Soup',
      description: 'Warm and comforting soup with seasonal vegetables. Hearty and nutritious.',
      ingredients: ['2 carrots', '2 celery stalks', '1 onion', '2 potatoes', '4 cups vegetable broth', 'mixed herbs'],
      matchedIngredients: [],
      prepTime: '35 min',
      calories: 180,
      difficulty: 'Easy',
      instructions: [
        'Dice all vegetables into uniform pieces',
        'Sauté onion, carrot, and celery in a large pot',
        'Add potatoes, broth, and herbs, bring to boil',
        'Simmer for 20 minutes until vegetables are tender, season and serve'
      ],
    },
  ];

  // Match ingredients with inventory
  return allRecipes.map(recipe => {
    const matched = recipe.ingredients.filter(ingredient =>
      itemNames.some(itemName =>
        itemName.includes(ingredient.toLowerCase()) ||
        ingredient.toLowerCase().includes(itemName)
      )
    );

    return {
      ...recipe,
      matchedIngredients: matched,
    };
  })
  .filter(recipe => recipe.matchedIngredients.length > 0)
  .sort((a, b) => b.matchedIngredients.length - a.matchedIngredients.length)
  .slice(0, 6);
}
