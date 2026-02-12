// Core data models

export interface Session {
  sessionId: string;
}

export interface Receipt {
  receiptId: string;
  userId: string;  // User who owns this receipt
  sessionId: string;
  purchaseDate: string | null;
  createdAt: string;
}

// New category system matching design requirements
export type FoodCategory =
  | 'Produce'
  | 'Protein'
  | 'Grains'
  | 'Dairy'
  | 'Snacks'
  | 'Condiments'
  | 'Beverages'
  | 'Prepared';

// Storage location
export type StorageLocation = 'fridge' | 'freezer' | 'pantry';

export type ExpirationSource = 'auto' | 'manual';

// Item status for tracking used/trashed items
export type ItemStatus = 'active' | 'used' | 'trashed';

export interface Item {
  itemId: string;
  userId: string;  // User who owns this item
  receiptId: string;
  name: string;
  quantity: string | null;
  category: FoodCategory;
  location: StorageLocation;
  purchaseDate: string;
  autoExpirationDate: string;
  manualExpirationDate: string | null;
  expirationSource: ExpirationSource;
  price?: number | null;  // Price in cents (optional)
  status?: ItemStatus;  // 'active' | 'used' | 'trashed' (default: 'active')

  // Lifecycle prediction fields (client-side rule-based)
  ingredientCategory?: string;                   // Level-2 key (e.g. "dairy-milk") or "unknown"
  categorySource?: 'user' | 'inferred' | 'unknown';
  predictionSource?: 'rule_baseline';
  autoExpireLabel?: string;                      // "Use by Feb 10" / "Unknown"
  autoExpireStatus?: 'ok' | 'urgent' | 'expired' | 'unknown';
}

// LLM function input/output types

export interface NormalizeInputTextOutput {
  purchase_date: string | null;
  items: Array<{
    raw_name: string;
    quantity: string | null;
  }>;
}

export interface ClassifyItemOutput {
  is_food: boolean;
  normalized_name: string;
  category: FoodCategory;
}

export interface EstimateExpirationDaysOutput {
  expiration_days: number;
  confidence: 'high' | 'medium' | 'low';
}

// Processing types

export interface ProcessedItem {
  raw_name: string;
  quantity: string | null;
  normalized_name: string;
  category: FoodCategory;
  is_food: boolean;
  expiration_days: number;
  confidence: 'high' | 'medium' | 'low';
}

// User preferences (onboarding)

export interface UserPreferences {
  userId: string;  // User who owns these preferences
  onboardingCompleted: boolean;
  helpWith: string | null; // 'using_what_i_have' | 'meal_ideas' | 'limiting_waste' | 'meal_variety'
  dietaryPreferences: string[];
  allergies: string[];
  ingredientExclusions: string[];
  notifyExpireIn: string | null; // '1_day' | '3_days' | '1_week'
  notifyTimeOfDay: string | null; // 'morning' | 'afternoon' | 'evening'
  pushEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Recipe and favorites

export interface FavoriteRecipe {
  favoriteId: string;  // Document ID in Firestore
  userId: string;  // User who favorited this recipe
  recipeId: string;  // Unique identifier for the recipe (hash of name)
  recipeName: string;
  recipeDescription?: string;
  recipeImage?: string;
  ingredients: string[];
  instructions?: string[];
  prepTime?: string;
  createdAt: string;
}

export interface StoredRecipe {
  id: string;
  name: string;
  description: string;
  image?: string;
  ingredients: string[];
  matchedIngredients: string[];
  missingIngredients: string[];
  prepTime: string;
  calories: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  instructions: string[];
  url?: string;           // Original recipe URL (e.g. Jamie Oliver page)
  coverage?: number;      // Ingredient match ratio from recommendation engine
  score?: number;         // Overall recommendation score
}

export interface UserRecipes {
  userId: string;
  recipes: StoredRecipe[];
  generatedAt: string;  // ISO timestamp
  itemFingerprint: string;  // Hash of item names for quick comparison
  itemIds: string[];  // Item IDs used to generate recipes
}
