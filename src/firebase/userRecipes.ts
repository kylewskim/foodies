import type { UserRecipes, StoredRecipe, Item } from '../types';

/**
 * Generate a fingerprint (hash) from item names for quick comparison
 */
function generateItemFingerprint(items: Item[]): string {
  const sortedNames = items
    .map(item => item.name.toLowerCase())
    .sort()
    .join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < sortedNames.length; i++) {
    const char = sortedNames.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Save user recipes to Firestore
 *
 * @param userId - User ID
 * @param recipes - Array of recipes to save
 * @param items - Current items used to generate recipes
 */
export async function saveUserRecipes(
  _userId: string,
  _recipes: StoredRecipe[],
  _items: Item[]
): Promise<void> {
  // Firebase recipe cache is disabled. Keep API for backward compatibility.
  return;
}

/**
 * Get user recipes from Firestore
 *
 * @param userId - User ID
 * @returns User recipes or null if not found
 */
export async function getUserRecipes(_userId: string): Promise<UserRecipes | null> {
  // Firebase recipe cache is disabled.
  return null;
}

/**
 * Check if recipes should be regenerated based on item changes
 *
 * @param currentItems - Current user items
 * @param cachedRecipes - Cached recipes from Firebase
 * @returns Object with status and change details
 */
export function shouldRegenerateRecipes(
  currentItems: Item[],
  cachedRecipes: UserRecipes
): {
  shouldRegenerate: boolean;
  reason: string;
  changeRate: number;
  addedCount: number;
  removedCount: number;
} {
  // Check age (regenerate if older than 2 hours)
  const cacheAge = Date.now() - new Date(cachedRecipes.generatedAt).getTime();
  const twoHours = 2 * 60 * 60 * 1000;

  if (cacheAge > twoHours) {
    return {
      shouldRegenerate: true,
      reason: 'Recipes older than 24 hours',
      changeRate: 0,
      addedCount: 0,
      removedCount: 0,
    };
  }

  // Check fingerprint (quick comparison)
  const currentFingerprint = generateItemFingerprint(currentItems);
  if (currentFingerprint === cachedRecipes.itemFingerprint) {
    return {
      shouldRegenerate: false,
      reason: 'Items identical',
      changeRate: 0,
      addedCount: 0,
      removedCount: 0,
    };
  }

  // Detailed comparison
  const currentItemIds = currentItems.map(item => item.itemId);
  const cachedSet = new Set(cachedRecipes.itemIds);
  const currentSet = new Set(currentItemIds);

  const added = currentItemIds.filter(id => !cachedSet.has(id));
  const removed = cachedRecipes.itemIds.filter(id => !currentSet.has(id));
  const totalChange = added.length + removed.length;
  const totalItems = Math.max(currentItemIds.length, cachedRecipes.itemIds.length);
  const changeRate = totalItems > 0 ? totalChange / totalItems : 1;

  console.log('📊 Item comparison:', {
    current: currentItemIds.length,
    cached: cachedRecipes.itemIds.length,
    added: added.length,
    removed: removed.length,
    changeRate: (changeRate * 100).toFixed(1) + '%',
  });

  // Regenerate if more than 20% change
  if (changeRate > 0.2) {
    return {
      shouldRegenerate: true,
      reason: `Major change (${(changeRate * 100).toFixed(0)}% items changed)`,
      changeRate,
      addedCount: added.length,
      removedCount: removed.length,
    };
  }

  return {
    shouldRegenerate: false,
    reason: 'Minor change, using cached recipes',
    changeRate,
    addedCount: added.length,
    removedCount: removed.length,
  };
}

/**
 * Delete user recipes from Firestore
 *
 * @param userId - User ID
 */
export async function clearUserRecipes(userId: string): Promise<void> {
  void userId;
  // Firebase recipe cache is disabled.
  return;
}

/**
 * Mark recipes as needing refresh (called when items change)
 * Uses localStorage for simple flag storage
 */
export function markRecipesNeedRefresh(): void {
  localStorage.setItem('recipesNeedRefresh', 'true');
  localStorage.setItem('recipesRefreshTimestamp', Date.now().toString());
}

/**
 * Check if recipes need refresh
 */
export function checkRecipesNeedRefresh(): boolean {
  return localStorage.getItem('recipesNeedRefresh') === 'true';
}

/**
 * Clear the recipes refresh flag
 */
export function clearRecipesRefreshFlag(): void {
  localStorage.removeItem('recipesNeedRefresh');
  localStorage.removeItem('recipesRefreshTimestamp');
}
