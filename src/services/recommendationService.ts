/**
 * recommendationService.ts
 *
 * Frontend service for the RecipeRec v2 deterministic recipe engine.
 * (https://github.com/TanLaura/RecipeRec)
 *
 * Handles:
 *   - Calling the /api/recommend endpoint
 *   - Mapping inventory items to the API payload format
 *   - Mapping user preferences to restriction keys
 *   - Caching recommendations in Firestore
 *   - Converting API response to StoredRecipe format
 */

import type { Item, StoredRecipe, UserPreferences } from '../types';
import { getUserPreferences } from '../firebase/saveReceipt';
import {
  getUserRecipes,
  saveUserRecipes,
  shouldRegenerateRecipes,
  checkRecipesNeedRefresh,
  clearRecipesRefreshFlag,
} from '../firebase/userRecipes';

// ─── Types matching RecipeRec engine output ──────────────────────────────────

export interface RecommendationResponse {
  mode: 'empty_fridge' | 'low_stock' | 'abundant';
  inventory_summary: {
    unique_items_count: number;
    expiring_soon_count: number;
    expiring_soon_items: string[];
  };
  recommendations: APIRecipe[];
  shopping_list?: ShoppingListItem[];
  debug?: Record<string, unknown>;
}

export interface APIRecipe {
  recipe_id: string;
  title: string;
  url: string | null;
  bucket: 'quick_bites' | 'main';
  score: number;
  coverage: number;
  matched: string[];
  missing: string[];
  reasons: string[];
  violations: string[];
}

export interface ShoppingListItem {
  item: string;
  count: number;
  unlock_value: number;
}

// ─── Preference → Restriction Mapping ────────────────────────────────────────
// Maps onboarding choices to RecipeRec restriction IDs in restrictions.json

const DIETARY_TO_RESTRICTION: Record<string, string> = {
  'Vegetarian': 'diet_vegetarian',
  'Vegan': 'diet_vegan',
  'Gluten-free': 'diet_gluten_free',
  'Dairy-free': 'diet_dairy_free',
};

const ALLERGY_TO_RESTRICTION: Record<string, string> = {
  'Nuts': 'allergy_nuts',
  'Shellfish': 'allergy_shellfish',
};

/**
 * Convert user preferences into restriction keys for the engine.
 */
export function preferencesToRestrictions(prefs: UserPreferences): string[] {
  const restrictions: string[] = [];

  for (const pref of prefs.dietaryPreferences || []) {
    const key = DIETARY_TO_RESTRICTION[pref];
    if (key) restrictions.push(key);
  }

  for (const allergy of prefs.allergies || []) {
    const key = ALLERGY_TO_RESTRICTION[allergy];
    if (key) restrictions.push(key);
  }

  return restrictions;
}

// ─── Inventory → API Payload ─────────────────────────────────────────────────

function itemsToPayload(items: Item[]): Array<{
  name: string;
  expiration_date: string;
  category: string;
}> {
  return items.map(item => ({
    name: item.name,
    expiration_date: item.manualExpirationDate || item.autoExpirationDate,
    category: item.category,
  }));
}

// ─── API Call ────────────────────────────────────────────────────────────────

async function callRecommendAPI(
  items: Item[],
  restrictions: string[],
  topK: number = 8,
): Promise<RecommendationResponse> {
  const payload = {
    inventory: itemsToPayload(items),
    restrictions,
    top_k: topK,
    debug: true,
  };

  console.log('📤 RecipeRec API request:', JSON.stringify(payload, null, 2));

  const response = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ RecipeRec API error response:', response.status, text);
    throw new Error(`API error: ${response.status} — ${text}`);
  }

  const data = await response.json();
  console.log('📥 RecipeRec API response:', {
    mode: data.mode,
    recommendationCount: data.recommendations?.length ?? 0,
    inventorySummary: data.inventory_summary,
    debug: data.debug,
  });
  return data;
}

// ─── API Response → StoredRecipe ─────────────────────────────────────────────

function apiRecipeToStoredRecipe(rec: APIRecipe): StoredRecipe {
  return {
    id: rec.recipe_id,
    name: rec.title || 'Untitled Recipe',
    description: rec.reasons.join(' · ') || `${Math.round(rec.coverage * 100)}% match`,
    ingredients: [...rec.matched, ...rec.missing],
    matchedIngredients: rec.matched,
    missingIngredients: rec.missing,
    prepTime: rec.bucket === 'quick_bites' ? '15 min' : '30 min',
    calories: 0,   // not available from engine
    difficulty: rec.bucket === 'quick_bites' ? 'Easy' : 'Medium',
    instructions: [],  // Actual steps not available; original recipe URL shown via "View Original Recipe" button
    url: rec.url || undefined,
    coverage: rec.coverage || undefined,
    score: rec.score || undefined,
  };
}

// ─── Main Service Function ───────────────────────────────────────────────────

export interface RecommendationResult {
  mode: 'empty_fridge' | 'low_stock' | 'abundant';
  inventorySummary: {
    uniqueItemsCount: number;
    expiringSoonCount: number;
    expiringSoonItems: string[];
  };
  recipes: StoredRecipe[];
  shoppingList: ShoppingListItem[];
  fromCache: boolean;
}

/**
 * Get recipe recommendations for a user.
 *
 * Uses Firestore cache when possible; calls /api/recommend when stale.
 */
export async function getRecommendations(
  userId: string,
  items: Item[],
  forceRegenerate: boolean = false,
): Promise<RecommendationResult> {
  const needsBackgroundRefresh = checkRecipesNeedRefresh();

  // Check Firestore cache first (unless force regenerate)
  if (!forceRegenerate) {
    const cachedRecipes = await getUserRecipes(userId);

    if (cachedRecipes && !needsBackgroundRefresh) {
      // Invalidate old AI-generated recipes that lack a url field
      // (RecipeRec engine always provides url from Jamie Oliver dataset)
      const isLegacyAICache = cachedRecipes.recipes.length > 0 &&
        cachedRecipes.recipes.every(r => !r.url);

      if (isLegacyAICache) {
        console.log('🔄 Cached recipes are from old AI system (no url). Regenerating...');
      } else {
        const check = shouldRegenerateRecipes(items, cachedRecipes);
        if (!check.shouldRegenerate) {
          console.log(`✅ Using cached recommendations: ${check.reason}`);
          // Recover extra metadata if stored
          const extra = cachedRecipes as any;
          return {
            mode: extra.mode || 'abundant',
            inventorySummary: extra.inventorySummary || {
              uniqueItemsCount: items.length,
              expiringSoonCount: 0,
              expiringSoonItems: [],
            },
            recipes: cachedRecipes.recipes,
            shoppingList: extra.shoppingList || [],
            fromCache: true,
          };
        }
      }
    }
  }

  // Fetch user preferences for restrictions
  let restrictions: string[] = [];
  try {
    const prefs = await getUserPreferences(userId);
    if (prefs) {
      restrictions = preferencesToRestrictions(prefs);
    }
  } catch (err) {
    console.warn('Could not load user preferences for restrictions:', err);
  }

  // Call the recommendation API
  console.log('🔄 Fetching fresh recommendations from RecipeRec engine...');
  const response = await callRecommendAPI(items, restrictions);

  // Convert to StoredRecipe format
  const recipes = response.recommendations.map(apiRecipeToStoredRecipe);

  // Save to Firestore cache
  try {
    await saveUserRecipes(userId, recipes, items);
  } catch (err) {
    console.warn('Failed to cache recommendations:', err);
  }

  clearRecipesRefreshFlag();

  return {
    mode: response.mode,
    inventorySummary: {
      uniqueItemsCount: response.inventory_summary.unique_items_count,
      expiringSoonCount: response.inventory_summary.expiring_soon_count,
      expiringSoonItems: response.inventory_summary.expiring_soon_items,
    },
    recipes,
    shoppingList: response.shopping_list || [],
    fromCache: false,
  };
}
