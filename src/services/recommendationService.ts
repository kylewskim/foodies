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
 *   - Converting API response to StoredRecipe format
 */

import type { Item, StoredRecipe, UserPreferences } from '../types';
import { getUserPreferences } from '../firebase/saveReceipt';

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
  cook_time?: string | number | null;
  cookTime?: string | number | null;
  prep_time?: string | number | null;
  prepTime?: string | number | null;
  total_time?: string | number | null;
  time_minutes?: string | number | null;
  timeMinutes?: string | number | null;
  calories?: string | number | null;
  kcal?: string | number | null;
  description?: string | null;
  summary?: string | null;
  instructions?: unknown;
  steps?: unknown;
  ingredients?: unknown;
  source?: string | null;
  source_name?: string | null;
  provider?: string | null;
  recipe_url?: string | null;
  source_url?: string | null;
  image?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  thumbnail?: string | null;
  difficulty?: string | null;
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

const PHRASE_INGREDIENTS = [
  'olive oil',
  'sesame oil',
  'soy sauce',
  'fish sauce',
  'oyster sauce',
  'spring onion',
  'green onion',
  'sweet potato',
  'bell pepper',
  'coconut milk',
  'whole milk',
  'skim milk',
  'almond milk',
  'chicken breast',
  'chicken thigh',
  'pork belly',
  'beef brisket',
  'curry powder',
  'chili powder',
  'black pepper',
  'sea salt',
];

const ALIASES: Record<string, string> = {
  'extra virgin olive oil': 'olive oil',
  'vegetable oil': 'oil',
  'canola oil': 'oil',
  'greek yogurt': 'yogurt',
  yogurt: 'yogurt',
  mozzarella: 'mozzarella',
  wate: 'water',
  purified: 'water',
  'purified wate': 'water',
  'purified water': 'water',
  salmons: 'salmon',
  porkbelly: 'pork belly',
  'coca-cola': 'coca cola',
  'coca cola': 'coca cola',
  'pop-tarts': 'pop tarts',
  'pop-tarts toaster pastries': 'pop tarts',
  eggs: 'egg',
  tomatoes: 'tomato',
  onions: 'onion',
  potatoes: 'potato',
  yolk: 'egg',
  'egg yolk': 'egg',
};

const DROP_TOKENS = new Set([
  'fresh',
  'large',
  'small',
  'organic',
  'pack',
  'bottle',
  'jar',
  'bag',
  'lb',
  'lbs',
  'oz',
  'g',
  'kg',
  'ml',
  'l',
  'pcs',
  'piece',
  'pieces',
  'each',
  'count',
  'ct',
  'bunch',
  'now',
  'ft',
  'app',
  'series',
]);

const QUALIFIER_TOKENS = new Set([
  'korean',
  'japanese',
  'chinese',
  'thai',
  'vietnamese',
  'italian',
  'mexican',
  'indian',
  'american',
  'style',
  'premium',
  'choice',
  'select',
  'local',
  'imported',
  'frozen',
  'dried',
  'sliced',
  'chopped',
  'minced',
  'peeled',
  'washed',
  'seedless',
  'ripe',
  'sweet',
  'baby',
  'plain',
  'original',
  'unsweetened',
  'salted',
  'unsalted',
]);

const WEAK_TAIL_TOKENS = new Set([
  'item',
  'items',
  'grocery',
  'grocer',
  'natural',
  'balanced',
  'protein',
  'whole',
  'less',
  'sugar',
  'zero',
]);

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

function canonicalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseIngredientTokens(name: string): string[] {
  let text = canonicalizeText(name);
  const found: string[] = [];

  for (const phrase of [...PHRASE_INGREDIENTS].sort((a, b) => b.length - a.length)) {
    if (text.includes(phrase)) {
      found.push(phrase);
      text = text.split(phrase).join(' ');
    }
  }

  const tokens = text
    .split(' ')
    .filter((t) => t && !DROP_TOKENS.has(t));

  const normalized = [...found, ...tokens].map((item) => ALIASES[item] ?? item);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const token of normalized) {
    if (!seen.has(token)) {
      seen.add(token);
      deduped.push(token);
    }
  }
  return deduped;
}

function pickPrimaryIngredientName(tokens: string[], fallbackName: string): string {
  const meaningful = tokens.filter((token) => !QUALIFIER_TOKENS.has(token));
  if (meaningful.length === 0) return fallbackName;

  // Prefer multi-word ingredient phrases when available.
  const phrase = meaningful.find((token) => token.includes(' '));
  if (phrase) return phrase;

  // For noisy names, select the strongest token, not just the last token.
  const reversed = [...meaningful].reverse();
  const strong = reversed.find((token) => token.length >= 3 && !WEAK_TAIL_TOKENS.has(token));
  const selected = strong ?? meaningful[meaningful.length - 1];
  if (ALIASES[selected]) return ALIASES[selected];
  if (selected.endsWith('s') && selected.length > 4) return selected.slice(0, -1);
  return selected;
}

function normalizeDate(dateLike?: string | null): string {
  if (!dateLike) return new Date().toISOString().split('T')[0];
  const dt = new Date(dateLike);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
  const ymd = dateLike.match(/^(\d{4}-\d{2}-\d{2})/);
  return ymd ? ymd[1] : new Date().toISOString().split('T')[0];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const m = value.match(/(\d+(?:\.\d+)?)/);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

function deriveSourceFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host || undefined;
  } catch {
    return undefined;
  }
}

function normalizePrepTime(recipe: APIRecipe): string | undefined {
  const rec = asRecord(recipe);
  const raw = firstString(rec, ['cook_time', 'cookTime', 'prep_time', 'prepTime', 'total_time', 'totalTime', 'time_minutes', 'timeMinutes', 'ready_in'])
    ?? firstNumber(rec, ['cook_time', 'cookTime', 'prep_time', 'prepTime', 'total_time', 'totalTime', 'time_minutes', 'timeMinutes', 'ready_in']);

  if (typeof raw === 'number' && raw > 0) return `${Math.round(raw)} min`;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (/^PT\d+H(\d+M)?$/i.test(text) || /^PT\d+M$/i.test(text)) {
      const h = text.match(/(\d+)H/i);
      const m = text.match(/(\d+)M/i);
      const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
      if (total > 0) return `${total} min`;
    }
    if (/\bmin\b|\bhour\b|\bhr\b/i.test(text)) return text;
    const n = text.match(/(\d+)/);
    if (n) return `${n[1]} min`;
  }

  return undefined;
}

function normalizeCalories(recipe: APIRecipe): number | undefined {
  const rec = asRecord(recipe);
  const nutrition = asRecord(rec.nutrition);
  const value = firstNumber(rec, ['calories', 'kcal', 'calorie', 'energy_kcal'])
    ?? firstNumber(nutrition, ['calories', 'kcal', 'calorie', 'energy_kcal']);
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

function normalizeInstructions(recipe: APIRecipe): string[] {
  const rec = asRecord(recipe);
  const raw = rec.instructions ?? rec.steps ?? rec.directions ?? rec.method;
  if (!raw) return [];

  if (Array.isArray(raw)) {
    const parsed = raw
      .map((step) => {
        if (typeof step === 'string') return step.trim();
        const obj = asRecord(step);
        return firstString(obj, ['step', 'instruction', 'text', 'description', 'content']) ?? '';
      })
      .filter(Boolean);
    return parsed;
  }

  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];
    const splitByLine = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (splitByLine.length > 1) return splitByLine;
    return text
      .split(/\s*\d+\.\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeIngredients(recipe: APIRecipe): string[] {
  const rec = asRecord(recipe);
  const raw = rec.ingredients;
  if (!Array.isArray(raw)) return [...recipe.matched, ...recipe.missing];

  const parsed = raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const obj = asRecord(item);
      const name = firstString(obj, ['name', 'ingredient', 'ingredient_name', 'item']) ?? '';
      const amount = firstString(obj, ['amount', 'quantity', 'measurement']) ?? '';
      if (!name) return '';
      return amount ? `${name} (${amount})` : name;
    })
    .filter(Boolean);

  return parsed.length > 0 ? parsed : [...recipe.matched, ...recipe.missing];
}

function itemsToPayload(items: Item[], strategy: 'raw' | 'canonical'): Array<{
  name: string;
  expiration_date: string;
  category: string;
}> {
  return items.map((item) => {
    const canonicalTokens = parseIngredientTokens(item.name);
    const fallbackName = canonicalizeText(item.name) || item.name.toLowerCase();
    const normalizedName = pickPrimaryIngredientName(canonicalTokens, fallbackName);
    return {
      name: strategy === 'canonical' ? normalizedName : item.name,
      expiration_date: normalizeDate(item.manualExpirationDate || item.autoExpirationDate),
      category: item.category.toLowerCase(),
    };
  });
}

// ─── API Call ────────────────────────────────────────────────────────────────

async function callRecommendAPI(
  items: Item[],
  restrictions: string[],
  topK: number = 8,
  strategy: 'raw' | 'canonical' = 'raw',
): Promise<RecommendationResponse> {
  const payload = {
    inventory: itemsToPayload(items, strategy),
    restrictions,
    top_k: topK,
    debug: true,
  };

  console.log(`📤 RecipeRec API request (${strategy}):`, JSON.stringify(payload, null, 2));

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
  console.log('📥 RecipeRec API raw response:', data);
  if (Array.isArray(data?.recommendations)) {
    console.log('📥 RecipeRec API raw recommendations:', data.recommendations);
    console.log('📥 RecipeRec first recommendation keys:', Object.keys(data.recommendations[0] || {}));
  } else {
    console.error('❌ RecipeRec response schema mismatch: recommendations is not an array', data);
  }
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
  const record = asRecord(rec);
  const reasonSummary = rec.reasons.filter(Boolean).join(' · ');
  const coveragePct = Number.isFinite(rec.coverage) ? Math.round(rec.coverage * 100) : 0;
  const description = firstString(record, ['description', 'summary', 'short_description', 'intro'])
    ?? (reasonSummary || `${coveragePct}% match`);
  const source = firstString(record, ['source', 'source_name', 'provider', 'provider_name', 'publisher']);
  const url = firstString(record, ['url', 'recipe_url', 'source_url', 'original_url', 'link']);
  const image = firstString(record, ['image', 'image_url', 'photo_url', 'thumbnail', 'thumb']);
  const instructions = normalizeInstructions(rec);
  const calories = normalizeCalories(rec);
  const difficultyRaw = firstString(record, ['difficulty', 'level', 'skill_level']);

  return {
    id: rec.recipe_id,
    name: rec.title || 'Untitled Recipe',
    image: image || undefined,
    description,
    ingredients: normalizeIngredients(rec),
    matchedIngredients: rec.matched,
    missingIngredients: rec.missing,
    prepTime: normalizePrepTime(rec),
    calories,
    difficulty: (difficultyRaw === 'Easy' || difficultyRaw === 'Medium' || difficultyRaw === 'Hard')
      ? difficultyRaw
      : undefined,
    instructions,
    url: url || undefined,
    source: source ?? deriveSourceFromUrl(url || undefined),
    coverage: rec.coverage || undefined,
    score: rec.score || undefined,
  };
}

// ─── Item-specific recipe fetch ──────────────────────────────────────────────

/**
 * Fetch recipes that use a specific ingredient, without Firebase caching.
 * Used by ItemDetailPage "Cook Now" section.
 */
export async function getRecipesForItem(item: Item): Promise<StoredRecipe[]> {
  try {
    const canonicalTokens = parseIngredientTokens(item.name);
    const fallbackName = canonicalizeText(item.name) || item.name.toLowerCase();
    const normalizedName = pickPrimaryIngredientName(canonicalTokens, fallbackName);
    const payload = {
      inventory: [{
        name: normalizedName,
        expiration_date: normalizeDate(item.manualExpirationDate || item.autoExpirationDate),
        category: item.category.toLowerCase(),
      }],
      restrictions: [],
      top_k: 10,
      debug: false,
    };

    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return [];

    const data = await response.json() as RecommendationResponse;
    return (data.recommendations || []).map(apiRecipeToStoredRecipe);
  } catch {
    return [];
  }
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
 * Always fetches fresh from RecipeRec engine — no Firebase cache.
 */
export async function getRecommendations(
  userId: string,
  items: Item[],
  _forceRegenerate: boolean = false,
): Promise<RecommendationResult> {
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

  // Always call the recommendation API with normalized ingredient names first.
  console.log('🔄 Fetching recommendations from RecipeRec engine...');
  const canonicalResponse = await callRecommendAPI(items, restrictions, 8, 'canonical');
  let response = canonicalResponse;

  // Safety fallback: if normalized pass is still too low, try original raw names once.
  if ((canonicalResponse.recommendations?.length ?? 0) <= 2 && items.length >= 6) {
    try {
      console.log('🔁 Low recommendation count from normalized names. Retrying once with raw inventory names...');
      const rawResponse = await callRecommendAPI(items, restrictions, 16, 'raw');
      if ((rawResponse.recommendations?.length ?? 0) > (canonicalResponse.recommendations?.length ?? 0)) {
        response = rawResponse;
      }
    } catch (err) {
      console.warn('Raw-name retry failed; using normalized recommendation response:', err);
    }
  }

  const recipes = response.recommendations.map(apiRecipeToStoredRecipe);

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
