import { openai, isOpenAIConfigured, FREE_MODEL } from './openaiClient';
import type { Item } from '../types';

export interface CreativeRecipe {
  name: string;
  description: string;
  ingredients: string[];
  matchedIngredients: string[];
  instructions: string[];
  prepTime: string;
  imageUrl?: string;
  imagePrompt: string;
}

/**
 * Generate a single creative, unusual recipe using user's ingredients
 * This is for the "Magic Kitchen" feature - creates unique combinations
 */
export async function generateCreativeRecipe(items: Item[]): Promise<CreativeRecipe> {
  if (!isOpenAIConfigured()) {
    console.warn('OpenAI API not configured, using fallback creative recipe');
    return getFallbackCreativeRecipe(items);
  }

  try {
    // Sort items by expiration date (prioritize soon-to-expire)
    const sortedItems = [...items].sort((a, b) => {
      const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
      const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
      return expA.getTime() - expB.getTime();
    });

    const itemList = sortedItems
      .slice(0, 15)
      .map((item, idx) => `${idx + 1}. ${item.name} (category: ${item.category})`)
      .join('\n');

    const prompt = `You are a wildly creative chef who loves to experiment with UNUSUAL and UNEXPECTED ingredient combinations.

Here are the ingredients available in the user's kitchen:
${itemList}

Create ONE highly creative, unusual recipe that:
1. Uses UNEXPECTED combinations that you would NOT find in a typical cookbook
2. Combines ingredients in ways that are surprising but could actually work
3. Prioritizes ingredients that expire soonest (items at the top of the list)
4. Is EXPERIMENTAL and ADVENTUROUS - think fusion cuisine, molecular gastronomy, or cultural mashups
5. Should be interesting to make and eat (even if unconventional)

Examples of creative combinations:
- Sweet + Savory (e.g., fruit with meat)
- Different cuisines mixed (e.g., Korean + Italian)
- Unexpected textures (e.g., crispy + creamy)
- Temperature contrasts (e.g., hot + cold elements)

Return a JSON object with:
- name: Creative and intriguing recipe name (should sound fun and unusual)
- description: 2-3 sentence description that explains the unusual combination and why it might work. Make it sound appealing despite being unconventional.
- ingredients: Complete list of ingredients with quantities
- matchedIngredients: List of ingredients from user's inventory (use exact names)
- instructions: 4-6 detailed cooking steps
- prepTime: Time in format "X min"
- imagePrompt: A detailed visual description for DALL-E image generation (describe the finished dish, plating, colors, textures, lighting - make it look appetizing)

Return ONLY valid JSON, no markdown or extra text.`;

    const response = await openai.chat.completions.create({
      model: FREE_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an avant-garde chef who specializes in creative, unconventional recipes. You push boundaries while maintaining flavor balance. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.9, // Higher temperature for more creativity
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    // Clean response and parse JSON
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const recipe: CreativeRecipe = JSON.parse(cleanContent);

    // Generate image using DALL-E
    console.log('🎨 Generating image with DALL-E...');
    try {
      const imageResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: `Professional food photography of ${recipe.imagePrompt}. High quality, appetizing, well-lit, restaurant-style plating, 8k resolution.`,
        size: '1024x1024',
        quality: 'standard',
        n: 1,
      });

      if (imageResponse.data && imageResponse.data[0]?.url) {
        recipe.imageUrl = imageResponse.data[0].url;
        console.log('✅ Image generated successfully');
      }
    } catch (imageError) {
      console.warn('Failed to generate image with DALL-E:', imageError);
      // Image will be undefined, we'll handle this in the UI
    }

    return recipe;
  } catch (error) {
    console.error('Error generating creative recipe:', error);
    return getFallbackCreativeRecipe(items);
  }
}

// Fallback creative recipe when AI is not available
function getFallbackCreativeRecipe(items: Item[]): CreativeRecipe {
  return {
    name: 'Pineapple Yogurt Chili Beef',
    description: 'Beef stir-fried with onion, chili, ginger, and garlic, then tossed with pineapple and finished with a cold spoon of yogurt. Sweet, spicy, tangy, creamy - confusing on paper, chaotic in theory, and somehow… not illegal.',
    ingredients: [
      '300g beef strips',
      '1 cup pineapple chunks',
      '2 red chilies',
      '1 onion',
      '3 cloves garlic',
      '1 inch ginger',
      '1/2 cup plain yogurt',
      '2 tbsp soy sauce',
      '1 tbsp honey',
    ],
    matchedIngredients: items.slice(0, 3).map(item => item.name),
    instructions: [
      'Marinate beef strips with soy sauce, minced garlic, and ginger for 15 minutes',
      'Heat oil in a wok over high heat, stir-fry beef until browned (2-3 min)',
      'Add sliced onion and chilies, cook for 2 minutes',
      'Toss in pineapple chunks and drizzle with honey, cook for 1 minute',
      'Remove from heat and let cool slightly (1 minute)',
      'Plate the dish and top with a generous dollop of cold yogurt',
    ],
    prepTime: '25 min',
    imagePrompt: 'A vibrant stir-fry dish with caramelized beef strips, golden pineapple chunks, red chilies, and purple onions, topped with a white dollop of yogurt in the center. The dish is served on a dark slate plate with dramatic lighting.',
  };
}
