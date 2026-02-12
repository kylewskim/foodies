/**
 * Rule-based ingredient lifecycle prediction.
 *
 * Runs entirely on the client — no Cloud Functions or external APIs needed.
 * Computes autoExpirationDate, labels, and status from a deterministic shelf-life table.
 */

import type { StorageLocation, FoodCategory } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoExpireStatus = 'ok' | 'urgent' | 'expired' | 'unknown';
export type CategorySource = 'user' | 'inferred' | 'unknown';

export interface LifecyclePrediction {
  ingredientCategory: string;               // Level-2 key or "unknown"
  categorySource: CategorySource;
  predictionSource: 'rule_baseline';
  autoExpirationDate?: string;              // YYYY-MM-DD — only when category known
  autoExpireLabel: string;                  // "Use by Feb 10" / "Unknown"
  autoExpireStatus: AutoExpireStatus;
  /** The mapped Level-1 FoodCategory for display */
  displayCategory: FoodCategory;
}

export interface PredictLifecycleInput {
  name: string;
  purchaseDate?: string;                    // YYYY-MM-DD
  storageLocation?: StorageLocation;        // fridge / freezer / pantry
  ingredientCategory?: string;              // If user-selected Level-2 key
}

// ─── Shelf-Life Table ─────────────────────────────────────────────────────────

interface ShelfLife { fridge: number; freezer: number; pantry: number }

const SHELF_LIFE_DEFAULTS: Record<string, ShelfLife> = {
  // Fruit
  'fruit-berries':    { fridge: 3,  freezer: 180, pantry: 1  },
  'fruit-melon':      { fridge: 5,  freezer: 90,  pantry: 3  },
  'fruit-citrus':     { fridge: 21, freezer: 0,   pantry: 7  },
  'fruit-pome':       { fridge: 30, freezer: 180, pantry: 7  },
  'fruit-stone':      { fridge: 5,  freezer: 180, pantry: 2  },
  'fruit-tropical':   { fridge: 5,  freezer: 180, pantry: 2  },
  'fruit-banana':     { fridge: 3,  freezer: 90,  pantry: 3  },
  'fruit-grapes':     { fridge: 7,  freezer: 180, pantry: 2  },
  'fruit-avocado':    { fridge: 5,  freezer: 180, pantry: 3  },

  // Vegetables
  'veg-leafy':        { fridge: 5,  freezer: 90,  pantry: 1  },
  'veg-cruciferous':  { fridge: 7,  freezer: 180, pantry: 2  },
  'veg-root':         { fridge: 21, freezer: 180, pantry: 7  },
  'veg-allium':       { fridge: 30, freezer: 90,  pantry: 30 },
  'veg-pepper':       { fridge: 10, freezer: 180, pantry: 3  },
  'veg-tomato':       { fridge: 7,  freezer: 180, pantry: 3  },
  'veg-cucumber':     { fridge: 7,  freezer: 180, pantry: 2  },
  'veg-mushroom':     { fridge: 5,  freezer: 90,  pantry: 1  },

  // Dairy
  'dairy-milk':         { fridge: 7,  freezer: 90,  pantry: 0  },
  'dairy-yogurt':       { fridge: 10, freezer: 45,  pantry: 0  },
  'dairy-cheese-soft':  { fridge: 10, freezer: 0,   pantry: 0  },
  'dairy-cheese-hard':  { fridge: 30, freezer: 180, pantry: 0  },
  'dairy-butter':       { fridge: 45, freezer: 240, pantry: 0  },

  // Meat / Seafood / Eggs
  'meat-raw-poultry':       { fridge: 2,  freezer: 270, pantry: 0  },
  'meat-raw-red':           { fridge: 3,  freezer: 365, pantry: 0  },
  'meat-raw-ground':        { fridge: 2,  freezer: 120, pantry: 0  },
  'seafood-raw-fish':       { fridge: 2,  freezer: 75,  pantry: 0  },
  'seafood-raw-shellfish':  { fridge: 3,  freezer: 180, pantry: 0  },
  'eggs-shell':             { fridge: 28, freezer: 0,   pantry: 0  },

  // Leftovers
  'leftovers-cooked': { fridge: 4,  freezer: 90,  pantry: 0  },
};

/** Fallback days when shelf-life value is 0 (not recommended for that location) */
const LOCATION_FALLBACK_DAYS: Record<StorageLocation, number> = {
  fridge: 5,
  freezer: 60,
  pantry: 14,
};

// ─── Level-2 → Level-1 Category Mapping ───────────────────────────────────────

const LEVEL2_TO_FOOD_CATEGORY: Record<string, FoodCategory> = {
  'fruit-berries': 'Produce', 'fruit-melon': 'Produce', 'fruit-citrus': 'Produce',
  'fruit-pome': 'Produce', 'fruit-stone': 'Produce', 'fruit-tropical': 'Produce',
  'fruit-banana': 'Produce', 'fruit-grapes': 'Produce', 'fruit-avocado': 'Produce',

  'veg-leafy': 'Produce', 'veg-cruciferous': 'Produce', 'veg-root': 'Produce',
  'veg-allium': 'Produce', 'veg-pepper': 'Produce', 'veg-tomato': 'Produce',
  'veg-cucumber': 'Produce', 'veg-mushroom': 'Produce',

  'dairy-milk': 'Dairy', 'dairy-yogurt': 'Dairy', 'dairy-cheese-soft': 'Dairy',
  'dairy-cheese-hard': 'Dairy', 'dairy-butter': 'Dairy',

  'meat-raw-poultry': 'Protein', 'meat-raw-red': 'Protein', 'meat-raw-ground': 'Protein',
  'seafood-raw-fish': 'Protein', 'seafood-raw-shellfish': 'Protein',
  'eggs-shell': 'Protein',

  'leftovers-cooked': 'Prepared',
};

// ─── Keyword → Level-2 Category Resolver ──────────────────────────────────────

/** Sorted most-specific-first so multi-word phrases are matched before single words. */
const CATEGORY_KEYWORDS: Array<[string[], string]> = [
  // Fruit
  [['strawberry', 'strawberries', 'blueberry', 'blueberries', 'raspberry', 'raspberries', 'blackberry', 'blackberries', 'berries', 'berry', 'cranberry', 'cranberries'], 'fruit-berries'],
  [['watermelon', 'cantaloupe', 'honeydew', 'melon'], 'fruit-melon'],
  [['orange', 'oranges', 'lemon', 'lemons', 'lime', 'limes', 'grapefruit', 'tangerine', 'clementine', 'mandarin'], 'fruit-citrus'],
  [['apple', 'apples', 'pear', 'pears'], 'fruit-pome'],
  [['peach', 'peaches', 'plum', 'plums', 'cherry', 'cherries', 'nectarine', 'nectarines', 'apricot', 'apricots'], 'fruit-stone'],
  [['mango', 'mangoes', 'mangos', 'pineapple', 'papaya', 'kiwi', 'guava', 'passion fruit', 'dragon fruit', 'lychee'], 'fruit-tropical'],
  [['banana', 'bananas'], 'fruit-banana'],
  [['grape', 'grapes'], 'fruit-grapes'],
  [['avocado', 'avocados'], 'fruit-avocado'],

  // Vegetables
  [['spinach', 'lettuce', 'kale', 'arugula', 'greens', 'chard', 'romaine', 'spring mix', 'mixed greens', 'salad mix', 'mesclun', 'collard', 'endive'], 'veg-leafy'],
  [['broccoli', 'cauliflower', 'brussels', 'brussels sprouts', 'cabbage', 'bok choy', 'kohlrabi'], 'veg-cruciferous'],
  [['carrot', 'carrots', 'beet', 'beets', 'radish', 'radishes', 'sweet potato', 'sweet potatoes', 'potato', 'potatoes', 'yam', 'turnip', 'parsnip', 'rutabaga', 'jicama'], 'veg-root'],
  [['onion', 'onions', 'garlic', 'scallion', 'scallions', 'shallot', 'shallots', 'leek', 'leeks', 'chive', 'chives', 'green onion'], 'veg-allium'],
  [['pepper', 'peppers', 'bell pepper', 'bell peppers', 'jalapeno', 'jalapeño', 'chili', 'habanero', 'serrano', 'poblano', 'anaheim'], 'veg-pepper'],
  [['tomato', 'tomatoes', 'cherry tomato', 'grape tomato', 'roma tomato', 'heirloom tomato'], 'veg-tomato'],
  [['cucumber', 'cucumbers', 'zucchini', 'zucchinis', 'squash'], 'veg-cucumber'],
  [['mushroom', 'mushrooms', 'shiitake', 'portobello', 'cremini', 'oyster mushroom', 'enoki'], 'veg-mushroom'],

  // Dairy
  [['cream cheese', 'ricotta', 'brie', 'mozzarella', 'mascarpone', 'cottage cheese', 'burrata', 'feta'], 'dairy-cheese-soft'],
  [['cheddar', 'parmesan', 'gouda', 'swiss', 'gruyere', 'provolone', 'monterey jack', 'colby', 'muenster', 'manchego', 'pecorino', 'asiago'], 'dairy-cheese-hard'],
  [['milk', 'whole milk', 'skim milk', 'oat milk', 'almond milk', 'soy milk', 'half and half', '2% milk', '1% milk', 'cream', 'heavy cream', 'whipping cream'], 'dairy-milk'],
  [['yogurt', 'yoghurt', 'greek yogurt', 'kefir'], 'dairy-yogurt'],
  [['butter', 'margarine', 'ghee'], 'dairy-butter'],

  // Meat / Protein — multi-word first
  [['ground beef', 'ground pork', 'ground turkey', 'ground chicken', 'ground meat', 'ground lamb', 'mince', 'minced meat'], 'meat-raw-ground'],
  [['chicken', 'turkey', 'duck', 'cornish hen', 'poultry', 'chicken breast', 'chicken thigh', 'chicken wing', 'chicken drumstick', 'chicken tender'], 'meat-raw-poultry'],
  [['beef', 'steak', 'pork', 'lamb', 'veal', 'bison', 'venison', 'pork chop', 'pork loin', 'pork belly', 'ribeye', 'sirloin', 'tenderloin', 'roast', 'ribs', 'bacon', 'ham', 'sausage', 'prosciutto', 'salami', 'pepperoni'], 'meat-raw-red'],

  // Seafood
  [['salmon', 'tuna', 'cod', 'tilapia', 'fish', 'trout', 'halibut', 'mahi mahi', 'sea bass', 'catfish', 'snapper', 'swordfish', 'sole', 'flounder', 'sardine', 'sardines', 'anchovy', 'anchovies', 'mackerel'], 'seafood-raw-fish'],
  [['shrimp', 'prawns', 'crab', 'lobster', 'scallop', 'scallops', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'squid', 'calamari', 'octopus', 'crawfish', 'crayfish'], 'seafood-raw-shellfish'],

  // Eggs
  [['egg', 'eggs'], 'eggs-shell'],

  // Leftovers
  [['leftover', 'leftovers', 'meal prep', 'cooked'], 'leftovers-cooked'],
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve Level-2 ingredient category from item name via keyword matching.
 */
export function resolveCategoryFromName(name: string): {
  ingredientCategory: string;
  categorySource: 'inferred' | 'unknown';
} {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    // Check multi-word phrases first (they come first in each keyword list)
    for (const kw of keywords) {
      if (kw.includes(' ')) {
        // Phrase match
        if (normalized.includes(kw)) {
          return { ingredientCategory: category, categorySource: 'inferred' };
        }
      } else {
        // Word-boundary match to avoid "ham" matching "shampoo"
        const regex = new RegExp(`\\b${kw}\\b`);
        if (regex.test(normalized)) {
          return { ingredientCategory: category, categorySource: 'inferred' };
        }
      }
    }
  }

  return { ingredientCategory: 'unknown', categorySource: 'unknown' };
}

/**
 * Predict lifecycle for a single item.
 *
 * Returns everything needed to persist: expiration date, label, status,
 * category info, and prediction source.
 */
export function predictLifecycle(input: PredictLifecycleInput): LifecyclePrediction {
  // 1. Determine category
  let ingredientCategory: string;
  let categorySource: CategorySource;

  if (input.ingredientCategory && input.ingredientCategory !== 'unknown') {
    ingredientCategory = input.ingredientCategory;
    categorySource = 'user';
  } else {
    const resolved = resolveCategoryFromName(input.name);
    ingredientCategory = resolved.ingredientCategory;
    categorySource = resolved.categorySource;
  }

  // Map Level-2 → Level-1 for display
  const displayCategory: FoodCategory = LEVEL2_TO_FOOD_CATEGORY[ingredientCategory] || 'Produce';

  // 2. If unknown → return early with no expiration date
  if (ingredientCategory === 'unknown') {
    return {
      ingredientCategory: 'unknown',
      categorySource,
      predictionSource: 'rule_baseline',
      autoExpireLabel: 'Unknown',
      autoExpireStatus: 'unknown',
      displayCategory,
    };
  }

  // 3. Compute shelf-life days
  const storageLocation = input.storageLocation || 'fridge';
  const shelfLife = SHELF_LIFE_DEFAULTS[ingredientCategory];

  let days: number;
  if (!shelfLife) {
    days = LOCATION_FALLBACK_DAYS[storageLocation];
  } else {
    days = shelfLife[storageLocation];
    if (days === 0) {
      days = LOCATION_FALLBACK_DAYS[storageLocation];
    }
  }

  // 4. Compute expiration date
  const purchaseDateStr = input.purchaseDate || todayYYYYMMDD();
  const purchaseDate = parseDateLocal(purchaseDateStr);
  const expirationDate = new Date(purchaseDate);
  expirationDate.setDate(expirationDate.getDate() + days);
  const autoExpirationDate = formatDateYYYYMMDD(expirationDate);

  // 5. Label / status
  const { label, status } = computeLabelAndStatus(expirationDate);

  return {
    ingredientCategory,
    categorySource,
    predictionSource: 'rule_baseline',
    autoExpirationDate,
    autoExpireLabel: label,
    autoExpireStatus: status,
    displayCategory,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a YYYY-MM-DD string into a Date at local midnight.
 * Falls back to today if parsing fails.
 */
function parseDateLocal(s: string): Date {
  // Handle ISO strings like "2026-02-05T00:00:00.000Z"
  const dateOnly = s.includes('T') ? s.split('T')[0] : s;
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day); // local midnight
}

function formatDateYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeLabelAndStatus(expirationDate: Date): { label: string; status: AutoExpireStatus } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expMidnight = new Date(expirationDate);
  expMidnight.setHours(0, 0, 0, 0);

  const diffMs = expMidnight.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Expired ${Math.abs(diffDays)}d ago`,
      status: 'expired',
    };
  }
  if (diffDays === 0) {
    return { label: 'Expires today', status: 'urgent' };
  }
  if (diffDays <= 2) {
    return { label: `Use by ${formatMonD(expirationDate)}`, status: 'urgent' };
  }
  return { label: `Use by ${formatMonD(expirationDate)}`, status: 'ok' };
}

function formatMonD(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
