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
const TARGET_RECOMMENDATION_COUNT = 50;
const API_TOP_K = 50;
const MAX_TIME_ENRICH_COUNT = 20;
const MAX_CANONICAL_INGREDIENTS = 26;
const MAX_RAW_INGREDIENTS = 18;
const TIMEOUT_RETRY_INGREDIENT_CAP = 14;
const TIMEOUT_RETRY_TOP_K = 24;

// ─── Types matching RecipeRec engine output ──────────────────────────────────

export interface RecommendationResponse {
  mode: 'empty_fridge' | 'low_stock' | 'abundant';
  source?: string;
  source_note?: string;
  inventory_summary: {
    unique_items_count: number;
    expiring_soon_count: number;
    expiring_soon_items: string[];
  };
  recommendations: APIRecipe[];
  shopping_list?: ShoppingListItem[];
  debug?: Record<string, unknown>;
}

export interface RecipeDetailResponse {
  mode: 'detail';
  source?: string;
  recipe: APIRecipe;
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
  preparation_time_min?: string | number | null;
  total_time?: string | number | null;
  time_minutes?: string | number | null;
  timeMinutes?: string | number | null;
  cooking_time_min?: string | number | null;
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
  category?: string | null;
  recipe_category?: string | null;
  recipe_type?: string | string[] | null;
  categories?: string[] | null;
  recipe_types?: string[] | null;
  meal_type?: string | null;
  meal_types?: string[] | null;
  dish_type?: string | null;
  dish_types?: string[] | null;
  serving_size?: string | null;
  servingSize?: string | null;
}

type UiRecipeCategory = 'Breakfast' | 'Lunch/Dinner' | 'Snack' | 'Dessert' | 'Beverage' | 'Others';

export interface ShoppingListItem {
  item: string;
  count: number;
  unlock_value: number;
}

interface RecommendCallTrace {
  label: string;
  strategy: 'raw' | 'canonical';
  top_k: number;
  request_ingredients: string[];
  request_ingredient_count: number;
  duration_ms: number;
  response_count: number;
  response_titles: string[];
  source?: string;
  source_note?: string;
  upstream_debug?: Record<string, unknown>;
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
  'chicken feet',
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
  'chicken feet': 'chicken',
  feet: 'chicken',
  'beef tartar': 'beef',
  tartar: 'beef',
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
  'brand',
  'value',
  'grocery',
  'grocer',
  'natural',
  'balanced',
  'protein',
  'dry',
  'cat',
  'food',
  'toaster',
  'pastries',
  'biscuit',
  'biscuits',
  'sticks',
  'stick',
  'optic',
  'white',
  'pro',
  'zero',
  'sugar',
  'high',
  'less',
  'series',
  'now',
  'ft',
  'oz',
  'can',
  'pack',
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
  'series',
  'stick',
  'high',
  'food',
  'cat',
  'dry',
  'natural',
  'balanced',
  'grocery',
  'grocer',
  'app',
  'ft',
  'now',
]);

const RESTRICTION_ALLERGEN_TOKENS: Record<string, string[]> = {
  Nuts: ['nut', 'nuts', 'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'peanut'],
  Shellfish: ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop'],
  Eggs: ['egg', 'eggs', 'yolk', 'albumin'],
  Soy: ['soy', 'soybean', 'tofu', 'edamame', 'miso', 'tempeh'],
  Dairy: ['dairy', 'milk', 'butter', 'cheese', 'cream', 'yogurt', 'ghee', 'whey'],
  Wheat: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'semolina', 'bulgur'],
};

const RAW_TO_UI_CATEGORY: Array<{ pattern: RegExp; category: UiRecipeCategory }> = [
  { pattern: /\bbreakfast\b/i, category: 'Breakfast' },
  { pattern: /\b(snack|quick[\s-]?bite|quick[\s-]?bites?)\b/i, category: 'Snack' },
  { pattern: /\bdessert\b/i, category: 'Dessert' },
  { pattern: /\b(beverage|drink|smoothie|juice)\b/i, category: 'Beverage' },
  { pattern: /\b(appetizer|soup|main(\s*dish)?|side(\s*dish)?|baked|salad|dressing|sauce|condiment|lunch|dinner)\b/i, category: 'Lunch/Dinner' },
  { pattern: /\bother\b/i, category: 'Others' },
];

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

function pickPrimaryIngredientName(tokens: string[]): string {
  const meaningful = tokens.filter((token) => !QUALIFIER_TOKENS.has(token));
  if (meaningful.length === 0) return '';

  // Prefer multi-word ingredient phrases when available.
  const phrase = meaningful.find((token) => token.includes(' '));
  if (phrase) return phrase;

  // For noisy names, select the strongest token, not just the last token.
  const reversed = [...meaningful].reverse();
  const strong = reversed.find((token) => token.length >= 3 && !WEAK_TAIL_TOKENS.has(token));
  const selected = strong ?? meaningful.find((token) => token.length >= 3) ?? '';
  if (!selected) return '';
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

function parseMinutesFromUnknown(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  if (/^PT\d+H(\d+M)?$/i.test(text) || /^PT\d+M$/i.test(text)) {
    const h = text.match(/(\d+)H/i);
    const m = text.match(/(\d+)M/i);
    const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
    return total > 0 ? total : undefined;
  }
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hour)/i);
  const minMatch = text.match(/(\d+(?:\.\d+)?)\s*(m|min|minute)/i);
  if (hourMatch || minMatch) {
    const hours = hourMatch ? Number(hourMatch[1]) : 0;
    const mins = minMatch ? Number(minMatch[1]) : 0;
    const total = Math.round(hours * 60 + mins);
    return total > 0 ? total : undefined;
  }
  const numMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return undefined;
  return Math.round(Number(numMatch[1]));
}

function toMinutesLabel(minutes?: number): string | undefined {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return undefined;
  return `${Math.round(minutes)} min`;
}

function normalizePrepTime(recipe: APIRecipe): string | undefined {
  const rec = asRecord(recipe);
  const raw = firstString(rec, ['prep_time', 'prepTime', 'preparation_time_min'])
    ?? firstNumber(rec, ['prep_time', 'prepTime', 'preparation_time_min']);
  return toMinutesLabel(parseMinutesFromUnknown(raw));
}

function normalizeCookTime(recipe: APIRecipe): string | undefined {
  const rec = asRecord(recipe);
  const raw = firstString(rec, ['cook_time', 'cookTime', 'cooking_time_min', 'time_minutes', 'timeMinutes'])
    ?? firstNumber(rec, ['cook_time', 'cookTime', 'cooking_time_min', 'time_minutes', 'timeMinutes']);
  return toMinutesLabel(parseMinutesFromUnknown(raw));
}

function normalizeTotalTime(recipe: APIRecipe): string | undefined {
  const rec = asRecord(recipe);
  const raw = firstString(rec, ['total_time', 'totalTime', 'ready_in'])
    ?? firstNumber(rec, ['total_time', 'totalTime', 'ready_in']);
  return toMinutesLabel(parseMinutesFromUnknown(raw));
}

function normalizeServingSize(recipe: APIRecipe): string | undefined {
  const rec = asRecord(recipe);
  return firstString(rec, ['serving_size', 'servingSize', 'serving', 'servings']) ?? undefined;
}

function normalizeRecipeType(recipe: APIRecipe): string | undefined {
  const rec = asRecord(recipe);
  const single = firstString(rec, ['recipe_type', 'meal_type', 'category', 'recipe_category']);
  if (single) return single;
  for (const key of ['recipe_types', 'meal_types', 'categories']) {
    const value = rec[key];
    if (Array.isArray(value)) {
      const first = value.find((v) => typeof v === 'string' && v.trim());
      if (typeof first === 'string') return first.trim();
    }
  }
  return undefined;
}

function normalizeRecipeTypes(recipe: APIRecipe): string[] {
  const rec = asRecord(recipe);
  const out: string[] = [];

  const pushValue = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      for (const part of value.split(',')) {
        const token = part.trim();
        if (token) out.push(token);
      }
    }
  };

  pushValue(rec.recipe_type);
  pushValue(rec.meal_type);
  pushValue(rec.category);
  pushValue(rec.recipe_category);

  for (const key of ['recipe_types', 'meal_types', 'categories']) {
    const value = rec[key];
    if (Array.isArray(value)) {
      for (const v of value) pushValue(v);
    }
  }

  return [...new Set(out)].filter((v) => v.toLowerCase() !== 'main' && v.toLowerCase() !== 'quick_bites');
}

function getRecipeSortMinutes(recipe: Pick<StoredRecipe, 'cookTime' | 'prepTime' | 'totalTime'>): number {
  const prep = parseMinutesFromUnknown(recipe.prepTime);
  const cook = parseMinutesFromUnknown(recipe.cookTime);
  if (prep != null && cook != null) return prep + cook;
  if (prep != null) return prep;
  if (cook != null) return cook;
  return parseMinutesFromUnknown(recipe.totalTime) ?? Number.MAX_SAFE_INTEGER;
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
  if (!Array.isArray(raw)) return [];

  const parsed = raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const obj = asRecord(item);
      const text = firstString(obj, ['text', 'ingredient_description', 'description']);
      if (text) return text;
      const name = firstString(obj, ['name', 'ingredient', 'ingredient_name', 'item']) ?? '';
      const amount = firstString(obj, ['amount', 'quantity', 'measurement']) ?? '';
      if (!name) return '';
      return amount ? `${name} (${amount})` : name;
    })
    .filter(Boolean);

  return parsed;
}

function extractExplicitRecipeIngredients(recipe: APIRecipe): string[] {
  const rec = asRecord(recipe);
  const raw = rec.ingredients;
  if (!Array.isArray(raw)) return [];

  const parsed = raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const obj = asRecord(item);
      const name = firstString(obj, ['name', 'ingredient', 'ingredient_name', 'item']) ?? '';
      return name.trim();
    })
    .filter(Boolean);

  return parsed;
}

function extractRawRecipeCategory(recipe: APIRecipe): string | undefined {
  const rec = asRecord(recipe);
  const candidates: string[] = [];

  const singleFields = [
    'category',
    'recipe_category',
    'recipe_type',
    'meal_type',
    'dish_type',
    'category_name',
  ];

  for (const key of singleFields) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
  }

  const arrayFields = ['categories', 'recipe_types', 'meal_types', 'dish_types'];
  for (const key of arrayFields) {
    const value = rec[key];
    if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
      }
    }
  }

  if (candidates.length > 0) return candidates[0];
  if (typeof recipe.bucket === 'string' && recipe.bucket.trim()) return recipe.bucket.trim();
  return undefined;
}

function mapToUiCategory(rawCategory?: string, bucket?: string): UiRecipeCategory {
  const raw = (rawCategory || '').trim();
  for (const candidate of RAW_TO_UI_CATEGORY) {
    if (candidate.pattern.test(raw)) return candidate.category;
  }

  if (bucket === 'quick_bites') return 'Snack';
  if (bucket === 'main') return 'Lunch/Dinner';
  return 'Others';
}

function itemsToPayload(items: Item[], strategy: 'raw' | 'canonical'): Array<{
  name: string;
  expiration_date: string;
  category: string;
}> {
  const byExpiry = [...items].sort((a, b) => {
    const aDate = new Date(normalizeDate(a.manualExpirationDate || a.autoExpirationDate)).getTime();
    const bDate = new Date(normalizeDate(b.manualExpirationDate || b.autoExpirationDate)).getTime();
    return aDate - bDate;
  });

  const out: Array<{ name: string; expiration_date: string; category: string }> = [];
  const seen = new Set<string>();

  for (const item of byExpiry) {
    const canonicalTokens = parseIngredientTokens(item.name);
    const normalizedName = pickPrimaryIngredientName(canonicalTokens);
    const name = strategy === 'canonical' ? normalizedName : item.name;
    const cleanedName = canonicalizeText(name);

    if (!cleanedName || cleanedName.length < 3) continue;
    if (seen.has(cleanedName)) continue;
    seen.add(cleanedName);

    out.push({
      name: strategy === 'canonical' ? normalizedName : item.name,
      expiration_date: normalizeDate(item.manualExpirationDate || item.autoExpirationDate),
      category: item.category.toLowerCase(),
    });

    const cap = strategy === 'canonical' ? MAX_CANONICAL_INGREDIENTS : MAX_RAW_INGREDIENTS;
    if (out.length >= cap) break;
  }

  return out;
}

function summarizePayload(
  items: Item[],
  restrictions: string[],
  strategy: 'raw' | 'canonical',
  topK: number,
) {
  const inventory = itemsToPayload(items, strategy);
  const uniqueNames = [...new Set(inventory.map((it) => it.name))];
  return {
    strategy,
    top_k: topK,
    restrictions,
    inventory_count: inventory.length,
    unique_ingredient_count: uniqueNames.length,
    ingredients: uniqueNames,
  };
}

function summarizeUpstreamDebug(debug: unknown): Record<string, unknown> | undefined {
  if (!debug || typeof debug !== 'object') return undefined;
  const d = debug as Record<string, unknown>;
  return {
    provider_candidate_count: d.provider_candidate_count,
    scored_count: d.scored_count,
    exclusion_counts: d.exclusion_counts,
    candidate_thresholds: d.candidate_thresholds,
    inventory_set_size: Array.isArray(d.inventory_set) ? d.inventory_set.length : undefined,
  };
}

function buildStrictBlockedTokens(prefs?: UserPreferences | null): Set<string> {
  const blocked = new Set<string>();
  if (!prefs) return blocked;

  for (const exclusion of prefs.ingredientExclusions || []) {
    const canonical = pickPrimaryIngredientName(parseIngredientTokens(exclusion)) || canonicalizeText(exclusion);
    if (canonical) blocked.add(canonical);
  }

  for (const allergy of prefs.allergies || []) {
    const tokens = RESTRICTION_ALLERGEN_TOKENS[allergy] || [];
    for (const token of tokens) blocked.add(token);
  }

  return blocked;
}

function recipeContainsBlockedIngredient(recipe: APIRecipe, blockedTokens: Set<string>): boolean {
  if (blockedTokens.size === 0) return false;
  // Only enforce strict client-side ingredient exclusion when the upstream
  // payload includes explicit ingredient lists. Otherwise we'd over-filter
  // by inferred matched/missing tokens and drop almost everything.
  const ingredients = extractExplicitRecipeIngredients(recipe);
  if (ingredients.length === 0) return false;
  for (const ingredient of ingredients) {
    const canonical = pickPrimaryIngredientName(parseIngredientTokens(ingredient)) || canonicalizeText(ingredient);
    if (!canonical) continue;
    for (const blocked of blockedTokens) {
      if (canonical === blocked || canonical.includes(blocked) || blocked.includes(canonical)) {
        return true;
      }
    }
  }
  return false;
}

function blockedIngredientMatches(recipe: APIRecipe, blockedTokens: Set<string>): string[] {
  if (blockedTokens.size === 0) return [];
  const ingredients = extractExplicitRecipeIngredients(recipe);
  if (ingredients.length === 0) return [];
  const matched = new Set<string>();
  for (const ingredient of ingredients) {
    const canonical = pickPrimaryIngredientName(parseIngredientTokens(ingredient)) || canonicalizeText(ingredient);
    if (!canonical) continue;
    for (const blocked of blockedTokens) {
      if (canonical === blocked || canonical.includes(blocked) || blocked.includes(canonical)) {
        matched.add(blocked);
      }
    }
  }
  return [...matched];
}

function recipeKey(recipe: APIRecipe): string {
  return (recipe.recipe_id || '').trim().toLowerCase() || (recipe.title || '').trim().toLowerCase();
}

function summarizeMerge(candidates: APIRecipe[], merged: APIRecipe[]) {
  const seen = new Set<string>();
  const duplicateTitles: string[] = [];

  for (const recipe of candidates) {
    const key = recipeKey(recipe);
    if (!key) continue;
    if (seen.has(key)) duplicateTitles.push(recipe.title);
    seen.add(key);
  }

  return {
    candidate_count: candidates.length,
    unique_candidate_count: seen.size,
    duplicate_count: duplicateTitles.length,
    duplicate_titles: [...new Set(duplicateTitles)].slice(0, 20),
    selected_count: merged.length,
    selected: merged.slice(0, 20).map((recipe) => ({
      id: recipe.recipe_id,
      title: recipe.title,
      matched_count: recipe.matched?.length ?? 0,
      coverage: recipe.coverage,
      score: recipe.score,
    })),
  };
}

function dedupeRecipesByIdentity(recipes: APIRecipe[]): APIRecipe[] {
  const seen = new Set<string>();
  const out: APIRecipe[] = [];

  for (const recipe of recipes) {
    const id = (recipe.recipe_id || '').trim().toLowerCase();
    const title = (recipe.title || '').trim().toLowerCase();
    const key = id || title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(recipe);
  }

  return out.sort((a, b) => {
    const matchedDiff = (b.matched?.length || 0) - (a.matched?.length || 0);
    if (matchedDiff !== 0) return matchedDiff;
    const coverageDiff = (b.coverage || 0) - (a.coverage || 0);
    if (coverageDiff !== 0) return coverageDiff;
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const aMinutes = parseMinutesFromUnknown(
      firstNumber(asRecord(a), ['cook_time', 'cookTime', 'prep_time', 'prepTime', 'total_time', 'totalTime', 'time_minutes', 'timeMinutes', 'ready_in'])
      ?? firstString(asRecord(a), ['cook_time', 'cookTime', 'prep_time', 'prepTime', 'total_time', 'totalTime', 'time_minutes', 'timeMinutes', 'ready_in'])
    ) ?? Number.MAX_SAFE_INTEGER;
    const bMinutes = parseMinutesFromUnknown(
      firstNumber(asRecord(b), ['cook_time', 'cookTime', 'prep_time', 'prepTime', 'total_time', 'totalTime', 'time_minutes', 'timeMinutes', 'ready_in'])
      ?? firstString(asRecord(b), ['cook_time', 'cookTime', 'prep_time', 'prepTime', 'total_time', 'totalTime', 'time_minutes', 'timeMinutes', 'ready_in'])
    ) ?? Number.MAX_SAFE_INTEGER;
    return aMinutes - bMinutes;
  });
}

// ─── API Call ────────────────────────────────────────────────────────────────

async function callRecommendAPI(
  items: Item[],
  restrictions: string[],
  topK: number = 8,
  strategy: 'raw' | 'canonical' = 'raw',
  traceLabel?: string,
  onTrace?: (trace: RecommendCallTrace) => void,
): Promise<RecommendationResponse> {
  const startedAt = performance.now();
  let payload = {
    inventory: itemsToPayload(items, strategy),
    restrictions,
    top_k: topK,
    debug: true,
    provider_enabled: true,
  };

  const configuredEndpoint = (import.meta.env.VITE_RECOMMEND_API_URL || '').trim();
  const primaryEndpoint = configuredEndpoint || '/api/recommend';

  let response = await fetch(primaryEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let firstErrorText = '';
    try {
      firstErrorText = await response.clone().text();
    } catch {
      firstErrorText = '';
    }
    const timeoutLike = response.status >= 500 && /timed out|timeout|read operation/i.test(firstErrorText);
    if (timeoutLike && payload.inventory.length > TIMEOUT_RETRY_INGREDIENT_CAP) {
      const retryPayload = {
        ...payload,
        inventory: payload.inventory.slice(0, TIMEOUT_RETRY_INGREDIENT_CAP),
        top_k: Math.min(payload.top_k, TIMEOUT_RETRY_TOP_K),
      };

      console.warn('⏱️ Recipe API timeout detected; retrying with reduced payload', {
        original_inventory_count: payload.inventory.length,
        retry_inventory_count: retryPayload.inventory.length,
        original_top_k: payload.top_k,
        retry_top_k: retryPayload.top_k,
      });

      payload = retryPayload;
      response = await fetch(primaryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      let finalErrorText = '';
      try {
        finalErrorText = await response.clone().text();
      } catch {
        finalErrorText = firstErrorText || 'Failed to read error body';
      }
      console.error('❌ RecipeRec API error response:', response.status, finalErrorText);
      throw new Error(`API error: ${response.status} — ${finalErrorText}`);
    }
  }

  const data = await response.json();
  if (!Array.isArray(data?.recommendations)) {
    console.error('❌ RecipeRec response schema mismatch: recommendations is not an array', data);
  }

  onTrace?.({
    label: traceLabel || `${strategy}-top${topK}`,
    strategy,
    top_k: topK,
    request_ingredients: [...new Set(payload.inventory.map((it) => it.name))],
    request_ingredient_count: payload.inventory.length,
    duration_ms: Math.round(performance.now() - startedAt),
    response_count: Array.isArray(data?.recommendations) ? data.recommendations.length : 0,
    response_titles: Array.isArray(data?.recommendations)
      ? data.recommendations.map((r: APIRecipe) => r.title)
      : [],
    source: data?.source,
    source_note: data?.source_note,
    upstream_debug: summarizeUpstreamDebug(data?.debug),
  });

  if (data?.source === 'local_fallback') {
    throw new Error('Blocked local_fallback response: provider data is required.');
  }

  return data;
}

export async function getRecipeDetailById(recipeId: string): Promise<StoredRecipe | null> {
  const trimmed = (recipeId || '').trim();
  if (!trimmed) return null;
  const isPrefixed = trimmed.toLowerCase().startsWith('fatsecret:');
  const isNumeric = /^\d+$/.test(trimmed);
  if (!isPrefixed && !isNumeric) return null;

  const configuredEndpoint = (import.meta.env.VITE_RECOMMEND_API_URL || '').trim();
  const primaryEndpoint = configuredEndpoint || '/api/recommend';

  const response = await fetch(primaryEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipe_id: isPrefixed ? trimmed : `fatsecret:${trimmed}`,
      debug: true,
      provider_enabled: true,
    }),
  });

  if (!response.ok) {
    let errText = '';
    try {
      errText = await response.clone().text();
    } catch {
      errText = '';
    }
    throw new Error(`Recipe detail API error: ${response.status} — ${errText}`);
  }

  const data = await response.json() as RecipeDetailResponse;
  if (!data?.recipe || typeof data.recipe !== 'object') return null;
  const mapped = apiRecipeToStoredRecipe(data.recipe);
  console.log('📥 Recipe detail summary:', {
    requested_recipe_id: recipeId,
    resolved_id: mapped.id,
    title: mapped.name,
    prepTime: mapped.prepTime,
    cookTime: mapped.cookTime,
    servingSize: mapped.servingSize,
    calories: mapped.calories,
    ingredientCount: mapped.ingredients.length,
    instructionsCount: mapped.instructions.length,
    recipeType: mapped.recipeType,
  });
  return mapped;
}

// ─── API Response → StoredRecipe ─────────────────────────────────────────────

function apiRecipeToStoredRecipe(rec: APIRecipe): StoredRecipe {
  const record = asRecord(rec);
  const reasons = Array.isArray(rec.reasons) ? rec.reasons : [];
  const matched = Array.isArray(rec.matched) ? rec.matched : [];
  const missing = Array.isArray(rec.missing) ? rec.missing : [];
  const reasonSummary = reasons.filter(Boolean).join(' · ');
  const coveragePct = Number.isFinite(rec.coverage) ? Math.round(rec.coverage * 100) : 0;
  const description = firstString(record, ['description', 'summary', 'short_description', 'intro'])
    ?? (reasonSummary || `${coveragePct}% match`);
  const source = firstString(record, ['source', 'source_name', 'provider', 'provider_name', 'publisher']);
  const url = firstString(record, ['url', 'recipe_url', 'source_url', 'original_url', 'link']);
  const image = firstString(record, ['image', 'image_url', 'photo_url', 'thumbnail', 'thumb']);
  const instructions = normalizeInstructions(rec);
  const calories = normalizeCalories(rec);
  const difficultyRaw = firstString(record, ['difficulty', 'level', 'skill_level']);
  const rawCategory = extractRawRecipeCategory(rec);
  const prepTime = normalizePrepTime(rec);
  const cookTime = normalizeCookTime(rec);
  const totalTime = normalizeTotalTime(rec);
  const servingSize = normalizeServingSize(rec);
  const recipeType = normalizeRecipeType(rec);
  const recipeTypes = normalizeRecipeTypes(rec);
  const uiCategory = mapToUiCategory(rawCategory, rec.bucket);

  const mappedRecipe: StoredRecipe = {
    id: rec.recipe_id,
    name: rec.title || 'Untitled Recipe',
    category: rawCategory,
    rawCategory,
    uiCategory,
    image: image || undefined,
    description,
    ingredients: normalizeIngredients(rec),
    matchedIngredients: matched,
    missingIngredients: missing,
    prepTime,
    cookTime,
    totalTime,
    servingSize,
    recipeType,
    recipeTypes,
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
  return mappedRecipe;
}

// ─── Item-specific recipe fetch ──────────────────────────────────────────────

/**
 * Fetch recipes that use a specific ingredient, without Firebase caching.
 * Used by ItemDetailPage "Cook Now" section.
 */
export async function getRecipesForItem(item: Item): Promise<StoredRecipe[]> {
  try {
    const canonicalTokens = parseIngredientTokens(item.name);
    const normalizedName = pickPrimaryIngredientName(canonicalTokens);
    const payload = {
      inventory: [{
        name: normalizedName,
        expiration_date: normalizeDate(item.manualExpirationDate || item.autoExpirationDate),
        category: item.category.toLowerCase(),
      }],
      restrictions: [],
      top_k: 10,
      debug: false,
      provider_enabled: true,
    };

    const configuredEndpoint = (import.meta.env.VITE_RECOMMEND_API_URL || '').trim();
    const primaryEndpoint = configuredEndpoint || '/api/recommend';

    let response = await fetch(primaryEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return [];

    const data = await response.json() as RecommendationResponse;
    if (data?.source === 'local_fallback') {
      console.warn('🚫 Ignoring local_fallback item recipe response by policy.');
      return [];
    }
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

function hasAnyTimeInApiRecipe(recipe: APIRecipe): boolean {
  const record = asRecord(recipe);
  const value = firstString(record, [
    'prep_time', 'prepTime', 'preparation_time_min',
    'cook_time', 'cookTime', 'cooking_time_min',
    'total_time', 'totalTime', 'time_minutes', 'timeMinutes',
  ]) ?? firstNumber(record, [
    'prep_time', 'prepTime', 'preparation_time_min',
    'cook_time', 'cookTime', 'cooking_time_min',
    'total_time', 'totalTime', 'time_minutes', 'timeMinutes',
  ]);
  return parseMinutesFromUnknown(value) != null;
}

async function enrichMissingTimes(recipes: APIRecipe[]): Promise<{ enriched: APIRecipe[]; enrichedCount: number; triedCount: number }> {
  const enriched = [...recipes];
  const targets = recipes
    .map((recipe, index) => ({ recipe, index }))
    .filter(({ recipe }) => !hasAnyTimeInApiRecipe(recipe))
    .slice(0, MAX_TIME_ENRICH_COUNT);

  if (targets.length === 0) {
    return { enriched, enrichedCount: 0, triedCount: 0 };
  }

  const settled = await Promise.allSettled(
    targets.map(async ({ recipe, index }) => {
      const detail = await getRecipeDetailById(recipe.recipe_id);
      if (!detail) return { index, patched: false as const };
      return {
        index,
        patched: true as const,
        prep_time: detail.prepTime,
        cook_time: detail.cookTime,
        total_time: detail.totalTime,
      };
    }),
  );

  let enrichedCount = 0;
  for (const result of settled) {
    if (result.status !== 'fulfilled' || !result.value.patched) continue;
    const { index, prep_time, cook_time, total_time } = result.value;
    const target = enriched[index];
    enriched[index] = {
      ...target,
      prep_time: prep_time ?? target.prep_time,
      cook_time: cook_time ?? target.cook_time,
      total_time: total_time ?? target.total_time,
    };
    if (prep_time || cook_time || total_time) enrichedCount += 1;
  }

  return { enriched, enrichedCount, triedCount: targets.length };
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
  const startedAt = performance.now();
  let prefs: UserPreferences | null = null;
  let restrictions: string[] = [];
  try {
    prefs = await getUserPreferences(userId);
    if (prefs) {
      restrictions = preferencesToRestrictions(prefs);
    }
  } catch (err) {
    console.warn('Could not load user preferences for restrictions:', err);
  }

  const blockedIngredientTokens = buildStrictBlockedTokens(prefs);
  const canonicalSummary = summarizePayload(items, restrictions, 'canonical', API_TOP_K);
  console.log('📤 Recipe request summary:', canonicalSummary);
  if (blockedIngredientTokens.size > 0) {
    console.log('🚫 Active blocked ingredient tokens:', [...blockedIngredientTokens]);
  }

  const passTraces: RecommendCallTrace[] = [];
  let canonicalResponse: RecommendationResponse;
  try {
    canonicalResponse = await callRecommendAPI(
      items,
      restrictions,
      API_TOP_K,
      'canonical',
      'primary-canonical',
      (trace) => passTraces.push(trace),
    );
  } catch (err) {
    console.warn('Primary canonical request failed; attempting raw recovery call', err);
    canonicalResponse = await callRecommendAPI(
      items,
      restrictions,
      TIMEOUT_RETRY_TOP_K,
      'raw',
      'primary-raw-recovery',
      (trace) => passTraces.push(trace),
    );
  }
  let candidates = [...(canonicalResponse.recommendations || [])];
  let responseMeta = canonicalResponse;
  let usedFallbackRaw = false;

  if (candidates.length < TARGET_RECOMMENDATION_COUNT) {
    try {
      const rawProviderResponse = await callRecommendAPI(
        items,
        restrictions,
        API_TOP_K,
        'raw',
        'fallback-raw',
        (trace) => passTraces.push(trace),
      );
      candidates = [...candidates, ...(rawProviderResponse.recommendations || [])];
      usedFallbackRaw = true;
    } catch (err) {
      console.warn('Raw-name provider retry failed; keeping canonical-only results:', err);
    }
  }

  const dedupedCandidates = dedupeRecipesByIdentity(candidates);
  const excludedByRestrictions: Array<{ title: string; blocked_matches: string[] }> = [];
  const filteredByRestrictions = dedupedCandidates.filter((recipe) => {
    const matches = blockedIngredientMatches(recipe, blockedIngredientTokens);
    if (matches.length > 0) {
      excludedByRestrictions.push({
        title: recipe.title || recipe.recipe_id || 'untitled',
        blocked_matches: matches,
      });
      return false;
    }
    return !recipeContainsBlockedIngredient(recipe, blockedIngredientTokens);
  });
  const excludedByRestrictionCount = excludedByRestrictions.length;
  const selectedApiRecipes = filteredByRestrictions.slice(0, TARGET_RECOMMENDATION_COUNT);
  const timeEnrichment = await enrichMissingTimes(selectedApiRecipes);

  responseMeta = {
    ...responseMeta,
    recommendations: timeEnrichment.enriched,
  };

  const recipes = timeEnrichment.enriched.map(apiRecipeToStoredRecipe);
  recipes.sort((a, b) => {
    const matchedDiff = (b.matchedIngredients?.length || 0) - (a.matchedIngredients?.length || 0);
    if (matchedDiff !== 0) return matchedDiff;
    const coverageDiff = (b.coverage || 0) - (a.coverage || 0);
    if (coverageDiff !== 0) return coverageDiff;
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return getRecipeSortMinutes(a) - getRecipeSortMinutes(b);
  });

  console.log('🧪 Recipe pipeline trace:', {
    request: canonicalSummary,
    passes: passTraces.map((trace) => ({
      label: trace.label,
      strategy: trace.strategy,
      top_k: trace.top_k,
      request_ingredient_count: trace.request_ingredient_count,
      response_count: trace.response_count,
      duration_ms: trace.duration_ms,
      source: trace.source,
    })),
    deduped_count: dedupedCandidates.length,
    excluded_by_restriction_count: excludedByRestrictionCount,
    exclusion_examples: excludedByRestrictions.slice(0, 10),
    selected_count: recipes.length,
    time_enrichment: {
      tried: timeEnrichment.triedCount,
      enriched: timeEnrichment.enrichedCount,
      max_cap: MAX_TIME_ENRICH_COUNT,
    },
    blocked_ingredient_tokens: [...blockedIngredientTokens],
    merge: summarizeMerge(candidates, timeEnrichment.enriched),
  });

  console.log('📥 Recipe response summary:', {
    source: responseMeta.source ?? 'unknown',
    mode: responseMeta.mode,
    recommendation_count: recipes.length,
    used_fallback_raw: usedFallbackRaw,
    total_duration_ms: Math.round(performance.now() - startedAt),
    recipe_titles: recipes.map((r) => r.name),
  });
  console.groupCollapsed('📦 Recipe raw payload');
  console.log('raw_response', responseMeta);
  console.log('raw_recommendations', responseMeta.recommendations);
  responseMeta.recommendations.forEach((rec, index) => {
    console.log(`raw_recipe[${index}]`, rec);
  });
  console.groupEnd();

  return {
    mode: responseMeta.mode,
    inventorySummary: {
      uniqueItemsCount: responseMeta.inventory_summary.unique_items_count,
      expiringSoonCount: responseMeta.inventory_summary.expiring_soon_count,
      expiringSoonItems: responseMeta.inventory_summary.expiring_soon_items,
    },
    recipes,
    shoppingList: responseMeta.shopping_list || [],
    fromCache: false,
  }
}
