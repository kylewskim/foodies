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
  /** Recommended storage location based on ingredient category */
  recommendedLocation: StorageLocation;
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

  // Grains / Pasta / Bread
  'grain-pasta':        { fridge: 0,   freezer: 0,   pantry: 730  },  // dry pasta
  'grain-rice':         { fridge: 0,   freezer: 0,   pantry: 730  },
  'grain-bread':        { fridge: 14,  freezer: 90,  pantry: 5   },
  'grain-cereal':       { fridge: 0,   freezer: 0,   pantry: 180  },
  'grain-flour':        { fridge: 0,   freezer: 0,   pantry: 365  },
  'grain-oats':         { fridge: 0,   freezer: 0,   pantry: 365  },

  // Snacks / Packaged
  'snack-chips':        { fridge: 0,   freezer: 0,   pantry: 60   },
  'snack-crackers':     { fridge: 0,   freezer: 0,   pantry: 90   },
  'snack-cookies':      { fridge: 0,   freezer: 90,  pantry: 30   },
  'snack-candy':        { fridge: 0,   freezer: 0,   pantry: 180  },
  'snack-nuts':         { fridge: 30,  freezer: 180, pantry: 90   },
  'snack-bar':          { fridge: 0,   freezer: 0,   pantry: 180  },
  'snack-popcorn':      { fridge: 0,   freezer: 0,   pantry: 60   },
  'snack-pastry':       { fridge: 7,   freezer: 90,  pantry: 5    },

  // Beverages
  'bev-soda':           { fridge: 0,   freezer: 0,   pantry: 270  },
  'bev-juice':          { fridge: 7,   freezer: 0,   pantry: 180  },
  'bev-water':          { fridge: 0,   freezer: 0,   pantry: 730  },
  'bev-coffee-tea':     { fridge: 0,   freezer: 0,   pantry: 365  },
  'bev-sports-energy':  { fridge: 0,   freezer: 0,   pantry: 270  },
  'bev-protein':        { fridge: 0,   freezer: 0,   pantry: 270  },

  // Condiments / Sauces
  'condiment-sauce':    { fridge: 30,  freezer: 0,   pantry: 365  },
  'condiment-oil':      { fridge: 0,   freezer: 0,   pantry: 365  },
  'condiment-vinegar':  { fridge: 0,   freezer: 0,   pantry: 730  },
  'condiment-spice':    { fridge: 0,   freezer: 0,   pantry: 730  },

  // Canned / Preserved
  'canned-goods':       { fridge: 0,   freezer: 0,   pantry: 730  },

  // Frozen (already frozen at purchase)
  'frozen-meal':        { fridge: 2,   freezer: 180, pantry: 0    },
  'frozen-veggies':     { fridge: 2,   freezer: 240, pantry: 0    },
  'frozen-dessert':     { fridge: 1,   freezer: 120, pantry: 0    },

  // Non-food / Household (tracked but no expiration)
  'non-food':           { fridge: 0,   freezer: 0,   pantry: 0    },
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

  // Grains
  'grain-pasta': 'Grains', 'grain-rice': 'Grains', 'grain-bread': 'Grains',
  'grain-cereal': 'Grains', 'grain-flour': 'Grains', 'grain-oats': 'Grains',

  // Snacks
  'snack-chips': 'Snacks', 'snack-crackers': 'Snacks', 'snack-cookies': 'Snacks',
  'snack-candy': 'Snacks', 'snack-nuts': 'Snacks', 'snack-bar': 'Snacks',
  'snack-popcorn': 'Snacks', 'snack-pastry': 'Snacks',

  // Beverages
  'bev-soda': 'Beverages', 'bev-juice': 'Beverages', 'bev-water': 'Beverages',
  'bev-coffee-tea': 'Beverages', 'bev-sports-energy': 'Beverages', 'bev-protein': 'Beverages',

  // Condiments
  'condiment-sauce': 'Condiments', 'condiment-oil': 'Condiments',
  'condiment-vinegar': 'Condiments', 'condiment-spice': 'Condiments',

  // Canned
  'canned-goods': 'Canned',

  // Frozen
  'frozen-meal': 'Frozen', 'frozen-veggies': 'Frozen', 'frozen-dessert': 'Frozen',

  // Non-food
  'non-food': 'Other',
};

// ─── Recommended Storage Location ─────────────────────────────────────────────

/**
 * Determine the best storage location for an ingredient category.
 *
 * Logic:
 * - Items that spoil quickly and MUST be cold → fridge
 * - Items that last long at room temp → pantry
 * - Unknown → fridge (safest default)
 */
const CATEGORY_TO_LOCATION: Record<string, StorageLocation> = {
  // Fruit — fridge extends life for most
  'fruit-berries': 'fridge',
  'fruit-melon': 'fridge',
  'fruit-citrus': 'pantry',     // Citrus can stay on counter ~1 week
  'fruit-pome': 'fridge',
  'fruit-stone': 'fridge',
  'fruit-tropical': 'fridge',
  'fruit-banana': 'pantry',     // Bananas brown in fridge
  'fruit-grapes': 'fridge',
  'fruit-avocado': 'pantry',    // Ripen on counter, then fridge

  // Vegetables
  'veg-leafy': 'fridge',
  'veg-cruciferous': 'fridge',
  'veg-root': 'pantry',         // Potatoes, carrots etc. keep well in pantry
  'veg-allium': 'pantry',       // Onions, garlic — pantry is best
  'veg-pepper': 'fridge',
  'veg-tomato': 'pantry',       // Tomatoes lose flavor in fridge
  'veg-cucumber': 'fridge',
  'veg-mushroom': 'fridge',

  // Dairy — always fridge
  'dairy-milk': 'fridge',
  'dairy-yogurt': 'fridge',
  'dairy-cheese-soft': 'fridge',
  'dairy-cheese-hard': 'fridge',
  'dairy-butter': 'fridge',

  // Meat / Seafood — always fridge (or freezer for long-term)
  'meat-raw-poultry': 'fridge',
  'meat-raw-red': 'fridge',
  'meat-raw-ground': 'fridge',
  'seafood-raw-fish': 'fridge',
  'seafood-raw-shellfish': 'fridge',

  // Eggs
  'eggs-shell': 'fridge',

  // Leftovers
  'leftovers-cooked': 'fridge',

  // Grains — pantry
  'grain-pasta': 'pantry',
  'grain-rice': 'pantry',
  'grain-bread': 'pantry',
  'grain-cereal': 'pantry',
  'grain-flour': 'pantry',
  'grain-oats': 'pantry',

  // Snacks — pantry
  'snack-chips': 'pantry',
  'snack-crackers': 'pantry',
  'snack-cookies': 'pantry',
  'snack-candy': 'pantry',
  'snack-nuts': 'pantry',
  'snack-bar': 'pantry',
  'snack-popcorn': 'pantry',
  'snack-pastry': 'pantry',

  // Beverages — pantry (most are shelf-stable)
  'bev-soda': 'pantry',
  'bev-juice': 'fridge',
  'bev-water': 'pantry',
  'bev-coffee-tea': 'pantry',
  'bev-sports-energy': 'pantry',
  'bev-protein': 'pantry',

  // Condiments — pantry (unopened)
  'condiment-sauce': 'pantry',
  'condiment-oil': 'pantry',
  'condiment-vinegar': 'pantry',
  'condiment-spice': 'pantry',

  // Canned — pantry
  'canned-goods': 'pantry',

  // Frozen — freezer
  'frozen-meal': 'freezer',
  'frozen-veggies': 'freezer',
  'frozen-dessert': 'freezer',

  // Non-food — pantry
  'non-food': 'pantry',
};

function resolveDefaultLocation(ingredientCategory: string): StorageLocation {
  return CATEGORY_TO_LOCATION[ingredientCategory] || 'fridge';
}

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
  [['cucumber', 'cucumbers', 'zucchini', 'zucchinis', 'squash', 'butternut', 'acorn squash', 'spaghetti squash', 'eggplant', 'corn', 'corn on the cob', 'artichoke', 'asparagus', 'green bean', 'green beans', 'snap pea', 'snap peas', 'snow pea', 'snow peas', 'edamame', 'okra'], 'veg-cucumber'],
  [['mushroom', 'mushrooms', 'shiitake', 'portobello', 'cremini', 'oyster mushroom', 'enoki'], 'veg-mushroom'],

  // Dairy
  [['cream cheese', 'ricotta', 'brie', 'mozzarella', 'mascarpone', 'cottage cheese', 'burrata', 'feta'], 'dairy-cheese-soft'],
  [['cheddar', 'parmesan', 'gouda', 'swiss', 'gruyere', 'provolone', 'monterey jack', 'colby', 'muenster', 'manchego', 'pecorino', 'asiago'], 'dairy-cheese-hard'],
  [['milk', 'whole milk', 'skim milk', 'oat milk', 'almond milk', 'soy milk', 'half and half', '2% milk', '1% milk', 'cream', 'heavy cream', 'whipping cream'], 'dairy-milk'],
  [['yogurt', 'yoghurt', 'greek yogurt', 'kefir'], 'dairy-yogurt'],
  [['butter', 'margarine', 'ghee'], 'dairy-butter'],

  // Meat / Protein — multi-word first
  [['ground beef', 'ground pork', 'ground turkey', 'ground chicken', 'ground meat', 'ground lamb', 'mince', 'minced meat'], 'meat-raw-ground'],
  [['chicken', 'turkey', 'duck', 'cornish hen', 'poultry', 'chicken breast', 'chicken thigh', 'chicken wing', 'chicken drumstick', 'chicken tender', 'chkn', 'rotisserie'], 'meat-raw-poultry'],
  [['beef', 'steak', 'pork', 'lamb', 'veal', 'bison', 'venison', 'pork chop', 'pork loin', 'pork belly', 'ribeye', 'sirloin', 'tenderloin', 'roast', 'ribs', 'bacon', 'ham', 'sausage', 'prosciutto', 'salami', 'pepperoni', 'brisket', 'flank', 'tri tip', 'tri-tip', 'short rib', 'short ribs', 'jerky', 'hot dog', 'hot dogs', 'bratwurst'], 'meat-raw-red'],

  // Seafood
  [['salmon', 'tuna', 'cod', 'tilapia', 'fish', 'trout', 'halibut', 'mahi mahi', 'sea bass', 'catfish', 'snapper', 'swordfish', 'sole', 'flounder', 'sardine', 'sardines', 'anchovy', 'anchovies', 'mackerel'], 'seafood-raw-fish'],
  [['shrimp', 'prawns', 'crab', 'lobster', 'scallop', 'scallops', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'squid', 'calamari', 'octopus', 'crawfish', 'crayfish'], 'seafood-raw-shellfish'],

  // Eggs / Plant protein
  [['egg', 'eggs', 'tofu', 'tempeh', 'seitan', 'beyond meat', 'impossible', 'plant based'], 'eggs-shell'],

  // Leftovers / Prepared / Deli
  [['leftover', 'leftovers', 'meal prep', 'cooked', 'deli', 'sandwich', 'sandwiches', 'sub', 'pizza', 'pie', 'quiche', 'casserole', 'hummus', 'guacamole', 'pico', 'salsa fresca', 'rotisserie chicken', 'fried chicken', 'sushi', 'dim sum', 'dumpling', 'dumplings', 'spring roll', 'spring rolls', 'egg roll', 'egg rolls', 'empanada', 'empanadas', 'tamale', 'tamales', 'burrito', 'burritos', 'taco', 'tacos'], 'leftovers-cooked'],

  // Grains / Pasta / Bread
  [['pasta', 'spaghetti', 'penne', 'rigatoni', 'fusilli', 'fettuccine', 'linguine', 'macaroni', 'lasagne', 'lasagna', 'orzo', 'noodle', 'noodles', 'ramen', 'udon', 'lo mein', 'angel hair', 'rotini', 'farfalle', 'ravioli', 'tortellini', 'gnocchi', 'vermicelli'], 'grain-pasta'],
  [['rice', 'basmati', 'jasmine rice', 'brown rice', 'wild rice', 'arborio', 'quinoa', 'couscous', 'farro', 'barley', 'bulgur', 'millet', 'polenta', 'grits'], 'grain-rice'],
  [['bread', 'bagel', 'bagels', 'baguette', 'ciabatta', 'sourdough', 'pita', 'naan', 'tortilla', 'tortillas', 'wrap', 'wraps', 'bun', 'buns', 'roll', 'rolls', 'croissant', 'english muffin', 'flatbread', 'muffin', 'muffins', 'donut', 'donuts', 'doughnut', 'doughnuts', 'pancake', 'waffle', 'waffles'], 'grain-bread'],
  [['cereal', 'granola', 'muesli', 'corn flakes', 'cheerios', 'oatmeal'], 'grain-cereal'],
  [['flour', 'all purpose flour', 'bread flour', 'cake flour', 'wheat flour', 'cornstarch', 'baking mix'], 'grain-flour'],
  [['oats', 'rolled oats', 'steel cut oats', 'instant oats'], 'grain-oats'],

  // Snacks / Packaged
  [['chips', 'potato chips', 'tortilla chips', 'doritos', 'lays', 'pringles', 'cheetos', 'fritos', 'tostitos'], 'snack-chips'],
  [['crackers', 'saltine', 'ritz', 'goldfish', 'wheat thins', 'triscuit', 'cheez-it'], 'snack-crackers'],
  [['cookie', 'cookies', 'oreo', 'oreos', 'biscuit', 'biscuits', 'wafer', 'wafers', 'pocky'], 'snack-cookies'],
  [['candy', 'chocolate', 'gummy', 'gummies', 'skittles', 'snickers', 'twix', 'kitkat', 'kit kat', 'reese'], 'snack-candy'],
  [['nuts', 'peanuts', 'almonds', 'cashews', 'walnuts', 'pecans', 'pistachios', 'macadamia', 'mixed nuts', 'trail mix', 'sunflower seeds'], 'snack-nuts'],
  [['protein bar', 'granola bar', 'energy bar', 'clif bar', 'kind bar', 'power bar', 'snack bar', 'bar'], 'snack-bar'],
  [['popcorn', 'microwave popcorn', 'smartfood'], 'snack-popcorn'],
  [['pop tart', 'pop-tart', 'pop tarts', 'pop-tarts', 'toaster pastry', 'toaster pastries', 'pastry', 'pastries', 'strudel', 'danish', 'turnover'], 'snack-pastry'],

  // Beverages
  [['coca cola', 'coca-cola', 'pepsi', 'sprite', 'fanta', 'mountain dew', 'dr pepper', 'root beer', 'ginger ale', 'soda', 'cola', 'tonic', 'seltzer', 'sparkling water', 'la croix', 'lacroix', 'club soda', 'diet coke', 'coke zero', 'zero sugar'], 'bev-soda'],
  [['juice', 'orange juice', 'apple juice', 'grape juice', 'cranberry juice', 'lemonade', 'smoothie', 'simply', 'tropicana', 'minute maid'], 'bev-juice'],
  [['water', 'purified water', 'spring water', 'distilled water', 'sparkling', 'fiji', 'dasani', 'aquafina', 'evian', 'smart water'], 'bev-water'],
  [['coffee', 'espresso', 'tea', 'green tea', 'black tea', 'matcha', 'chai', 'cold brew', 'k-cup', 'k cup', 'kcup', 'nespresso', 'folgers', 'starbucks'], 'bev-coffee-tea'],
  [['gatorade', 'powerade', 'body armor', 'pedialyte', 'liquid iv', 'red bull', 'monster', 'energy drink', 'prime', 'celsius'], 'bev-sports-energy'],
  [['protein shake', 'protein drink', 'boost', 'ensure', 'muscle milk', 'premier protein', 'fairlife', 'core power'], 'bev-protein'],

  // Condiments / Sauces
  [['ketchup', 'mustard', 'mayonnaise', 'mayo', 'relish', 'hot sauce', 'sriracha', 'tabasco', 'bbq sauce', 'barbecue sauce', 'steak sauce', 'worcestershire', 'soy sauce', 'teriyaki', 'hoisin', 'fish sauce', 'oyster sauce', 'salsa', 'pesto', 'marinara', 'pasta sauce', 'tomato sauce', 'alfredo', 'ranch', 'dressing', 'vinaigrette'], 'condiment-sauce'],
  [['olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'sesame oil', 'avocado oil', 'cooking spray', 'pam'], 'condiment-oil'],
  [['vinegar', 'balsamic', 'apple cider vinegar', 'white vinegar', 'red wine vinegar', 'rice vinegar'], 'condiment-vinegar'],
  [['salt', 'pepper', 'spice', 'seasoning', 'cumin', 'paprika', 'oregano', 'basil', 'thyme', 'rosemary', 'cinnamon', 'nutmeg', 'turmeric', 'chili powder', 'garlic powder', 'onion powder', 'cayenne', 'sugar', 'brown sugar', 'honey', 'maple syrup', 'syrup', 'jam', 'jelly', 'preserves', 'peanut butter', 'almond butter', 'nutella'], 'condiment-spice'],

  // Canned / Preserved
  [['canned', 'can of', 'soup', 'beans', 'chickpeas', 'lentils', 'tuna can', 'canned tuna', 'tomato paste', 'tomato puree', 'diced tomatoes', 'crushed tomatoes', 'coconut milk', 'condensed', 'evaporated', 'broth', 'stock', 'chicken broth', 'beef broth', 'vegetable broth', 'bouillon', 'corn', 'green beans', 'peas', 'mixed vegetables', 'olives', 'pickles', 'pickle', 'sauerkraut', 'kimchi', 'spam'], 'canned-goods'],

  // Frozen
  [['frozen pizza', 'frozen dinner', 'frozen meal', 'tv dinner', 'lean cuisine', 'stouffer', 'hungry man', 'hot pocket', 'hot pockets', 'frozen burrito', 'frozen entree'], 'frozen-meal'],
  [['frozen vegetable', 'frozen vegetables', 'frozen fruit', 'frozen broccoli', 'frozen corn', 'frozen peas', 'frozen berries', 'frozen spinach', 'frozen stir fry'], 'frozen-veggies'],
  [['ice cream', 'gelato', 'sorbet', 'frozen yogurt', 'popsicle', 'popsicles', 'ice pop', 'fudge bar', 'drumstick', 'magnum'], 'frozen-dessert'],

  // Non-food / Household
  [['cat food', 'dog food', 'pet food', 'kitty litter', 'cat litter', 'purina', 'pedigree', 'iams', 'meow mix',
    'detergent', 'fabric softener', 'dryer sheet', 'dryer sheets', 'bleach', 'lysol', 'clorox', 'windex',
    'paper towel', 'paper towels', 'toilet paper', 'tissue', 'tissues', 'napkin', 'napkins',
    'trash bag', 'trash bags', 'garbage bag', 'garbage bags', 'ziploc', 'zip lock', 'aluminum foil', 'plastic wrap', 'saran wrap',
    'soap', 'dish soap', 'hand soap', 'body wash', 'shampoo', 'conditioner', 'lotion', 'deodorant', 'toothpaste',
    'laundry', 'snuggle', 'tide', 'downy', 'bounce', 'gain',
    'battery', 'batteries', 'light bulb', 'light bulbs',
    // Baby / health / personal care
    'diaper', 'diapers', 'wipes', 'baby wipe', 'baby wipes',
    'medicine', 'vitamin', 'vitamins', 'supplement', 'supplements',
    'tylenol', 'advil', 'ibuprofen', 'aspirin', 'bandaid', 'band-aid',
    'sunscreen', 'sunblock', 'insect repellent',
    // Cleaning / household
    'sponge', 'brush', 'mop', 'broom', 'dustpan',
    'candle', 'air freshener', 'febreze',
    'pen', 'pencil', 'marker', 'tape', 'glue', 'scissors',
    'charcoal', 'lighter', 'lighter fluid', 'match', 'matches',
    'filter', 'water filter', 'air filter',
    'bulb', 'fuse',
    // Garden / misc
    'flower', 'flowers', 'plant', 'potting soil', 'fertilizer',
    'bag', 'bags', 'container', 'containers',
    // Pet
    'pet treat', 'pet treats', 'rawhide', 'chew toy',
    // Clothing / textile (sometimes on warehouse receipts)
    'shirt', 'pants', 'socks', 'underwear', 'towel', 'towels', 'blanket',
    ], 'non-food'],
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve Level-2 ingredient category from item name via keyword matching.
 *
 * Handles truncated OCR names (e.g. "Yogu" matching "yogurt") by also
 * checking if any keyword STARTS WITH a token or vice versa (≥3 chars).
 */
export function resolveCategoryFromName(name: string): {
  ingredientCategory: string;
  categorySource: 'inferred' | 'unknown';
} {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // Pass 1: Exact matches (full word boundary or phrase)
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (kw.includes(' ')) {
        if (normalized.includes(kw)) {
          return { ingredientCategory: category, categorySource: 'inferred' };
        }
      } else {
        const regex = new RegExp(`\\b${kw}\\b`);
        if (regex.test(normalized)) {
          return { ingredientCategory: category, categorySource: 'inferred' };
        }
      }
    }
  }

  // Pass 2: Prefix/partial matching for truncated OCR names
  // e.g. "Yogu" → matches "yogurt", "Chick" → matches "chicken"
  // Only considers tokens ≥ 3 chars to avoid false positives
  const nameTokens = normalized.split(' ').filter(t => t.length >= 3);
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (kw.includes(' ')) continue; // skip phrases in pass 2
      if (kw.length < 3) continue;
      for (const token of nameTokens) {
        // Token is a prefix of keyword: "yogu" → "yogurt"
        if (kw.startsWith(token) && token.length >= 3) {
          return { ingredientCategory: category, categorySource: 'inferred' };
        }
        // Keyword is a prefix of token: "pasta" → "pastas"
        if (token.startsWith(kw)) {
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

  // 2. Determine recommended location
  const recommendedLocation = resolveDefaultLocation(ingredientCategory);

  // 2b. If unknown → return early with no expiration date
  if (ingredientCategory === 'unknown') {
    return {
      ingredientCategory: 'unknown',
      categorySource,
      predictionSource: 'rule_baseline',
      autoExpireLabel: 'Unknown',
      autoExpireStatus: 'unknown',
      displayCategory,
      recommendedLocation: 'fridge', // safe default
    };
  }

  // 2c. Non-food items — no expiration tracking
  if (ingredientCategory === 'non-food') {
    return {
      ingredientCategory: 'non-food',
      categorySource,
      predictionSource: 'rule_baseline',
      autoExpireLabel: 'Non-food',
      autoExpireStatus: 'ok',
      displayCategory,
      recommendedLocation: 'pantry',
    };
  }

  // 3. Compute shelf-life days
  // Use the recommended location if caller didn't specify one
  const storageLocation = input.storageLocation || recommendedLocation;
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
    recommendedLocation,
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
