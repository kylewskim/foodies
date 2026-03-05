import { collection, addDoc, deleteDoc, doc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { FavoriteRecipe } from '../types';

/**
 * Generate a consistent ID for a recipe based on its name
 * This allows us to identify the same recipe across sessions
 */
export function generateRecipeId(recipeName: string): string {
  // Simple hash function for consistent IDs
  let hash = 0;
  for (let i = 0; i < recipeName.length; i++) {
    const char = recipeName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function stripUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as T;
}

/**
 * Add a recipe to user's favorites
 *
 * @param userId - User ID
 * @param recipe - Recipe data to save
 * @returns The saved favorite recipe with ID
 */
export async function addFavoriteRecipe(
  userId: string,
  recipe: {
    recipeName: string;
    recipeSource?: string;
    recipeDescription?: string;
    recipeImage?: string;
    ingredients: string[];
    instructions?: string[];
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servingSize?: string;
    recipeType?: string;
    calories?: number;
  }
): Promise<FavoriteRecipe> {
  try {
    const recipeId = generateRecipeId(recipe.recipeName);

    // Check if already favorited
    const existing = await getFavoriteRecipeByRecipeId(userId, recipeId);
    if (existing) {
      const updatedData = stripUndefined({
        userId,
        recipeId,
        recipeName: recipe.recipeName,
        recipeSource: recipe.recipeSource,
        recipeDescription: recipe.recipeDescription,
        recipeImage: recipe.recipeImage,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        totalTime: recipe.totalTime,
        servingSize: recipe.servingSize,
        recipeType: recipe.recipeType,
        calories: recipe.calories,
        createdAt: existing.createdAt || new Date().toISOString(),
      });
      await setDoc(doc(db, 'favoriteRecipes', existing.favoriteId), updatedData, { merge: true });
      return {
        ...existing,
        ...updatedData,
      };
    }

    const favoriteData = stripUndefined({
      userId,
      recipeId,
      recipeName: recipe.recipeName,
      recipeSource: recipe.recipeSource,
      recipeDescription: recipe.recipeDescription,
      recipeImage: recipe.recipeImage,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      servingSize: recipe.servingSize,
      recipeType: recipe.recipeType,
      calories: recipe.calories,
      createdAt: new Date().toISOString(),
    });

    const docRef = await addDoc(collection(db, 'favoriteRecipes'), favoriteData);

    return {
      ...favoriteData,
      favoriteId: docRef.id,
    };
  } catch (error) {
    console.error('Error adding favorite recipe:', error);
    throw new Error('Failed to add favorite recipe');
  }
}

/**
 * Remove a recipe from user's favorites
 *
 * @param userId - User ID
 * @param recipeId - Recipe ID to remove
 */
export async function removeFavoriteRecipe(userId: string, recipeId: string): Promise<void> {
  try {
    const favorite = await getFavoriteRecipeByRecipeId(userId, recipeId);
    if (favorite) {
      await deleteDoc(doc(db, 'favoriteRecipes', favorite.favoriteId));
    }
  } catch (error) {
    console.error('Error removing favorite recipe:', error);
    throw new Error('Failed to remove favorite recipe');
  }
}

/**
 * Get all favorite recipes for a user
 *
 * @param userId - User ID
 * @returns Array of favorite recipes
 */
export async function getFavoriteRecipesByUser(userId: string): Promise<FavoriteRecipe[]> {
  try {
    const q = query(
      collection(db, 'favoriteRecipes'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const favorites: FavoriteRecipe[] = [];

    querySnapshot.forEach((doc) => {
      favorites.push({
        favoriteId: doc.id,
        ...doc.data(),
      } as FavoriteRecipe);
    });

    return favorites;
  } catch (error) {
    console.error('Error getting favorite recipes:', error);
    throw new Error('Failed to get favorite recipes');
  }
}

/**
 * Get a specific favorite recipe by recipeId
 *
 * @param userId - User ID
 * @param recipeId - Recipe ID
 * @returns The favorite recipe or null if not found
 */
export async function getFavoriteRecipeByRecipeId(
  userId: string,
  recipeId: string
): Promise<FavoriteRecipe | null> {
  try {
    const q = query(
      collection(db, 'favoriteRecipes'),
      where('userId', '==', userId),
      where('recipeId', '==', recipeId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      favoriteId: doc.id,
      ...doc.data(),
    } as FavoriteRecipe;
  } catch (error) {
    console.error('Error getting favorite recipe:', error);
    throw new Error('Failed to get favorite recipe');
  }
}

/**
 * Check if a recipe is favorited by the user
 *
 * @param userId - User ID
 * @param recipeId - Recipe ID
 * @returns True if favorited, false otherwise
 */
export async function isRecipeFavorited(userId: string, recipeId: string): Promise<boolean> {
  try {
    const favorite = await getFavoriteRecipeByRecipeId(userId, recipeId);
    return favorite !== null;
  } catch (error) {
    console.error('Error checking if recipe is favorited:', error);
    return false;
  }
}
