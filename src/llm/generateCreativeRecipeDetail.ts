import { openai, isOpenAIConfigured, FREE_MODEL } from './openaiClient';
import type { CreativeRecipe } from './generateCreativeRecipe';

export interface CreativeRecipeDetail {
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  totalTime: string;
  servingSize: string;
  calories?: number;
  recipeTypes: string[];
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

function minutesToLabel(value: unknown, fallback: number): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
  return `${n} min`;
}

function toTotalLabel(prep: string, cook: string): string {
  const prepNum = Number((prep.match(/(\d+)/) || [])[1] || 0);
  const cookNum = Number((cook.match(/(\d+)/) || [])[1] || 0);
  const total = prepNum + cookNum;
  return total > 0 ? `${total} min` : prep;
}

export async function generateCreativeRecipeDetail(recipe: CreativeRecipe): Promise<CreativeRecipeDetail> {
  const fallbackPrep = recipe.prepTime || '20 min';
  const fallbackCook = '15 min';
  const fallbackTotal = toTotalLabel(fallbackPrep, fallbackCook);

  if (!isOpenAIConfigured()) {
    return {
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: fallbackPrep,
      cookTime: fallbackCook,
      totalTime: fallbackTotal,
      servingSize: 'Serves 2',
      calories: undefined,
      recipeTypes: ['Main Dish'],
      difficulty: 'Medium',
    };
  }

  const prompt = `You are an expert recipe editor.
Given this AI-generated recipe summary, produce complete detail fields for a recipe detail page.

Recipe name: ${recipe.name}
Description: ${recipe.description}
Ingredients:
${recipe.ingredients.map((item) => `- ${item}`).join('\n')}

Matched ingredients from user inventory:
${recipe.matchedIngredients.map((item) => `- ${item}`).join('\n')}

Draft instructions:
${recipe.instructions.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

Return ONLY valid JSON with this exact schema:
{
  "description": "string",
  "ingredients": ["ingredient with quantity/unit", "..."],
  "instructions": ["step 1", "step 2", "..."],
  "prepTimeMinutes": number,
  "cookTimeMinutes": number,
  "servingSize": "string",
  "calories": number,
  "recipeTypes": ["Breakfast|Lunch|Dinner|Snack|Dessert|Beverage|Appetizer|Main Dish|Side Dish|Soup|Salad|Sauce and Condiment|Baked|Other"],
  "difficulty": "Easy|Medium|Hard"
}

Rules:
- ingredients must include realistic quantities/units.
- instructions must be actionable, 4-8 steps.
- prepTimeMinutes and cookTimeMinutes should be realistic and > 0.
- calories should be estimated per serving.
- keep it consistent with the provided recipe concept.
- do not include markdown or extra commentary.`;

  try {
    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You generate structured recipe details. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No detail payload returned');
    }

    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      description?: string;
      ingredients?: string[];
      instructions?: string[];
      prepTimeMinutes?: number;
      cookTimeMinutes?: number;
      servingSize?: string;
      calories?: number;
      recipeTypes?: string[];
      difficulty?: 'Easy' | 'Medium' | 'Hard';
    };

    const prepTime = minutesToLabel(parsed.prepTimeMinutes, Number((fallbackPrep.match(/(\d+)/) || [])[1] || 20));
    const cookTime = minutesToLabel(parsed.cookTimeMinutes, 15);
    const totalTime = toTotalLabel(prepTime, cookTime);

    return {
      description: parsed.description?.trim() || recipe.description,
      ingredients: Array.isArray(parsed.ingredients) && parsed.ingredients.length > 0 ? parsed.ingredients : recipe.ingredients,
      instructions: Array.isArray(parsed.instructions) && parsed.instructions.length > 0 ? parsed.instructions : recipe.instructions,
      prepTime,
      cookTime,
      totalTime,
      servingSize: parsed.servingSize?.trim() || 'Serves 2',
      calories: typeof parsed.calories === 'number' ? parsed.calories : undefined,
      recipeTypes: Array.isArray(parsed.recipeTypes) && parsed.recipeTypes.length > 0 ? parsed.recipeTypes : ['Main Dish'],
      difficulty: parsed.difficulty || 'Medium',
    };
  } catch (error) {
    console.error('Failed to generate creative recipe detail, using summary fallback:', error);
    return {
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: fallbackPrep,
      cookTime: fallbackCook,
      totalTime: fallbackTotal,
      servingSize: 'Serves 2',
      calories: undefined,
      recipeTypes: ['Main Dish'],
      difficulty: 'Medium',
    };
  }
}

