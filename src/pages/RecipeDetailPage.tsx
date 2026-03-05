import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRecipeDetailById } from '../services/recommendationService';
import {
  addFavoriteRecipe,
  removeFavoriteRecipe,
  isRecipeFavorited,
  generateRecipeId,
} from '../firebase/favoriteRecipes';

interface RecipeDetailState {
  id?: string;
  name: string;
  source?: string;
  description?: string;
  image?: string;
  ingredients: string[];
  matchedIngredients?: string[];
  missingIngredients?: string[];
  instructions?: string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servingSize?: string;
  recipeType?: string;
  recipeTypes?: string[];
  calories?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  rawCategory?: string;
  uiCategory?: 'Breakfast' | 'Lunch/Dinner' | 'Snack' | 'Dessert' | 'Beverage' | 'Others';
  url?: string | null;
}

const INGREDIENT_EMOJI: Record<string, string> = {
  chicken: '🍗', beef: '🥩', pork: '🥓', fish: '🐟', salmon: '🐟',
  egg: '🥚', eggs: '🥚', milk: '🥛', cheese: '🧀', butter: '🧈',
  yogurt: '🥛', broccoli: '🥦', carrot: '🥕', onion: '🧅', garlic: '🧄',
  tomato: '🍅', potato: '🥔', rice: '🍚', bread: '🍞', pasta: '🍝',
  apple: '🍎', banana: '🍌', lemon: '🍋', orange: '🍊', spinach: '🥬',
  lettuce: '🥬', pepper: '🫑', mushroom: '🍄', corn: '🌽', avocado: '🥑',
};

function getIngredientEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(INGREDIENT_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '🥘';
}

function parseIngredient(ingredient: string): { name: string; quantity: string } {
  // "Name (quantity)" format
  const parenMatch = ingredient.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) return { name: parenMatch[1].trim(), quantity: parenMatch[2].trim() };

  // "Name - quantity" format
  const dashMatch = ingredient.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) return { name: dashMatch[1].trim(), quantity: dashMatch[2].trim() };

  // "Number/fraction unit Name" at start
  const qtyFirstMatch = ingredient.match(
    /^(\d+(?:[./]\d+)?\s*(?:cups?|tbsp|tsp|tbsps?|oz|g|kg|lb|ml|l|pcs?|cloves?|slices?|pieces?|dash|pinch|pinches|servings?)(?:\s+of)?)\s+(.+)$/i
  );
  if (qtyFirstMatch) return { name: qtyFirstMatch[2].trim(), quantity: qtyFirstMatch[1].trim() };

  const genericQty = ingredient.match(/^(\d+(?:[./]\d+)?\s+\w+(?:\s+\w+)?)\s+(.+)$/i);
  if (genericQty) return { name: genericQty[2].trim(), quantity: genericQty[1].trim() };

  return { name: ingredient, quantity: '' };
}

function sourceLabel(source?: string, url?: string | null): string {
  if (source && source.trim()) {
    const normalized = source.trim();
    if (normalized.toLowerCase() === 'fatsecret') return 'FatSecret';
    return normalized;
  }
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'Freshli';
    }
  }
  return 'Freshli';
}

function isFatsecretRecipeId(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^fatsecret:\d+$/i.test(trimmed) || /^\d+$/.test(trimmed);
}

function extractFatsecretRecipeIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const fromParam = parsed.searchParams.get('recipe_id') || parsed.searchParams.get('id');
    if (fromParam && /^\d+$/.test(fromParam)) return `fatsecret:${fromParam}`;
    const parts = parsed.pathname.split('/').filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (/^\d+$/.test(p)) return `fatsecret:${p}`;
    }
  } catch {
    // no-op
  }
  return null;
}

function parseMinutes(value?: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const text = value.trim();
  if (!text) return Number.MAX_SAFE_INTEGER;
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(Number(m[1])) : Number.MAX_SAFE_INTEGER;
}

function displayRecipeMinutes(recipe: RecipeDetailState): number {
  const prep = parseMinutes(recipe.prepTime);
  const cook = parseMinutes(recipe.cookTime);
  if (prep !== Number.MAX_SAFE_INTEGER && cook !== Number.MAX_SAFE_INTEGER) return prep + cook;
  if (prep !== Number.MAX_SAFE_INTEGER) return prep;
  if (cook !== Number.MAX_SAFE_INTEGER) return cook;
  return parseMinutes(recipe.totalTime);
}

function recipeTypeChips(recipe: RecipeDetailState): string[] {
  const byArray = recipe.recipeTypes ?? [];
  const byString = recipe.recipeType ? recipe.recipeType.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return [...new Set([...byArray, ...byString])]
    .filter((t) => t && t.toLowerCase() !== 'main' && t.toLowerCase() !== 'quick_bites');
}

export function RecipeDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { recipeId: routeRecipeId } = useParams();
  const { user } = useAuth();
  const initialRecipe = location.state as RecipeDetailState | undefined;
  const [apiRecipe, setApiRecipe] = useState<RecipeDetailState | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const displayRecipe = apiRecipe ?? initialRecipe;

  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const favoriteRecipeId = displayRecipe ? generateRecipeId(displayRecipe.name) : '';

  useEffect(() => {
    if (user && favoriteRecipeId) loadFavoriteStatus();
  }, [user, favoriteRecipeId]);

  useEffect(() => {
    const routeId = (routeRecipeId || '').trim();
    const stateId = (initialRecipe?.id || '').trim();
    const urlDerivedId = extractFatsecretRecipeIdFromUrl(initialRecipe?.url);
    const targetId = isFatsecretRecipeId(routeId)
      ? routeId
      : (isFatsecretRecipeId(stateId) ? stateId : (urlDerivedId || ''));
    const source = (initialRecipe?.source || '').toLowerCase();
    const shouldFetch = targetId.toLowerCase().startsWith('fatsecret:') || source === 'fatsecret';
    if (!targetId || !shouldFetch) {
      if (source === 'fatsecret') {
        console.warn('Recipe detail fetch skipped: no valid FatSecret recipe id', {
          routeRecipeId,
          stateRecipeId: initialRecipe?.id,
          url: initialRecipe?.url,
        });
      }
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    getRecipeDetailById(targetId)
      .then((detail) => {
        if (cancelled || !detail) return;
        setApiRecipe({
          id: detail.id,
          name: detail.name,
          source: detail.source,
          description: detail.description,
          image: detail.image,
          ingredients: detail.ingredients,
          matchedIngredients: detail.matchedIngredients,
          missingIngredients: detail.missingIngredients,
          instructions: detail.instructions,
          prepTime: detail.prepTime,
          cookTime: detail.cookTime,
          totalTime: detail.totalTime,
          servingSize: detail.servingSize,
          recipeType: detail.recipeType,
          recipeTypes: detail.recipeTypes,
          calories: detail.calories,
          difficulty: detail.difficulty,
          rawCategory: detail.rawCategory,
          uiCategory: detail.uiCategory,
          url: detail.url,
        });
      })
      .catch((error) => {
        console.error('Recipe detail fetch failed, using summary payload only:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routeRecipeId, initialRecipe?.id, initialRecipe?.source]);

  const loadFavoriteStatus = async () => {
    if (!user || !favoriteRecipeId) return;
    try {
      const favorited = await isRecipeFavorited(user.uid, favoriteRecipeId);
      setIsFavorited(favorited);
    } catch (error) {
      console.error('Error loading favorite status:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user || !displayRecipe || isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      if (isFavorited) {
        await removeFavoriteRecipe(user.uid, favoriteRecipeId);
        setIsFavorited(false);
      } else {
        await addFavoriteRecipe(user.uid, {
          sourceRecipeId: displayRecipe.id,
          recipeName: displayRecipe.name,
          recipeSource: displayRecipe.source,
          recipeDescription: displayRecipe.description,
          recipeImage: displayRecipe.image,
          ingredients: displayRecipe.ingredients,
          instructions: displayRecipe.instructions,
          prepTime: displayRecipe.prepTime,
          cookTime: displayRecipe.cookTime,
          totalTime: displayRecipe.totalTime,
          servingSize: displayRecipe.servingSize,
          recipeType: displayRecipe.recipeType,
          recipeTypes: displayRecipe.recipeTypes,
          calories: displayRecipe.calories,
        });
        setIsFavorited(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const isInFridge = (ingredientName: string): boolean => {
    if (!displayRecipe?.matchedIngredients || displayRecipe.matchedIngredients.length === 0) return false;
    const lower = ingredientName.toLowerCase();
    return displayRecipe.matchedIngredients.some(matched => {
      const ml = matched.toLowerCase();
      return lower.includes(ml) || ml.includes(lower) ||
        lower.split(/[\s,]+/).some(word => word.length > 2 && ml.includes(word));
    });
  };

  useEffect(() => {
    if (!displayRecipe && !routeRecipeId) {
      console.warn('RecipeDetailPage: no location.state — redirecting to /recipes');
      navigate('/recipes', { replace: true });
    }
  }, [displayRecipe, routeRecipeId, navigate]);

  if (!displayRecipe && isLoadingDetail) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', fontFamily: '"Poppins", sans-serif', color: '#666' }}>
          Loading recipe details...
        </p>
      </div>
    );
  }
  if (!displayRecipe) return null;

  const validInstructions = useMemo(() => (displayRecipe.instructions ?? [])
    .map((item) => (item || '').trim())
    .filter((item) => item.length > 0 && !item.startsWith('Full recipe:')), [displayRecipe.instructions]);
  const minutesForDisplay = displayRecipeMinutes(displayRecipe);
  const recipeTypeChipValues = recipeTypeChips(displayRecipe);

  useEffect(() => {
    if (!displayRecipe) return;
    console.log('🍽️ Recipe detail state:', {
      name: displayRecipe.name,
      source: displayRecipe.source,
      prepTime: displayRecipe.prepTime,
      cookTime: displayRecipe.cookTime,
      totalTime: displayRecipe.totalTime,
      calories: displayRecipe.calories,
      servingSize: displayRecipe.servingSize,
      recipeType: displayRecipe.recipeType,
      recipeTypes: displayRecipe.recipeTypes,
      difficulty: displayRecipe.difficulty,
      instructionsCount: displayRecipe.instructions?.length ?? 0,
      validInstructionsCount: validInstructions.length,
      ingredientCount: displayRecipe.ingredients?.length ?? 0,
      image: displayRecipe.image,
      detailFetched: !!apiRecipe,
    });
  }, [displayRecipe, validInstructions.length, apiRecipe]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', position: 'relative' }}>
      {/* Hero image */}
      <div style={{ position: 'relative', width: '100%', height: '240px', overflow: 'hidden' }}>
        {displayRecipe.image ? (
          <img src={displayRecipe.image} alt={displayRecipe.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', backgroundColor: '#e8e8e0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px',
          }}>
            🍽️
          </div>
        )}

        {/* Gradient overlay — transparent top → black bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 100%)',
        }} />

        {/* Back button */}
        <div
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', top: '60px', left: '20px',
            width: '40px', height: '40px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 10H5M5 10L10 15M5 10L10 5"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Favorite star */}
        <div
          onClick={handleToggleFavorite}
          style={{
            position: 'absolute', top: '60px', right: '20px',
            width: '24px', height: '24px',
            cursor: isTogglingFavorite ? 'wait' : 'pointer',
            opacity: isTogglingFavorite ? 0.5 : 1,
          }}
        >
          {isFavorited ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFD700">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Content panel */}
      <div style={{
        position: 'relative',
        backgroundColor: '#f7f6ef',
        borderTopLeftRadius: '40px',
        borderTopRightRadius: '40px',
        marginTop: '-59px',
        padding: '48px 20px 60px',
        minHeight: 'calc(100vh - 181px)',
      }}>
        {/* Recipe header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '300',
            fontFamily: '"Canela", Georgia, serif',
            color: '#333',
            letterSpacing: '-0.036px',
          }}>
            {displayRecipe.name}
          </h1>

          <p style={{
            margin: 0,
            fontSize: '12px',
            fontFamily: '"Poppins", sans-serif',
            color: '#11130b',
            opacity: 0.4,
            lineHeight: '1.35',
            letterSpacing: '-0.4316px',
          }}>
            By {sourceLabel(displayRecipe.source, displayRecipe.url)}
          </p>

          {/* Stats list */}
          {(minutesForDisplay !== Number.MAX_SAFE_INTEGER || displayRecipe.calories != null || displayRecipe.servingSize) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {minutesForDisplay !== Number.MAX_SAFE_INTEGER && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: '"Sora", "Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                    {minutesForDisplay} min
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="6.5" stroke="#333" strokeWidth="1.2" />
                    <path d="M8 4.5V8L10.5 10" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              {displayRecipe.calories != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: '"Sora", "Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                    {displayRecipe.calories} Cal
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8.2 1.8C9.1 3.1 9.4 4.2 9 5.3C8.7 6.1 8.1 6.8 7.4 7.4C6.4 8.3 5.6 9.1 5.6 10.4C5.6 12 6.9 13.2 8.5 13.2C10.4 13.2 11.9 11.7 11.9 9.8C11.9 7.1 10.3 4.5 8.2 1.8Z" stroke="#333" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {displayRecipe.servingSize && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: '"Sora", "Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                    {displayRecipe.servingSize}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4.5 3.2V8.1C4.5 9.2 5.4 10.1 6.5 10.1C7.6 10.1 8.5 9.2 8.5 8.1V3.2M6.5 10.1V13.5M3.8 3.2H9.2M11.3 2.8V8.7M11.3 8.7C12.3 8.7 13.1 7.9 13.1 6.9V5.4C13.1 4.4 12.3 3.6 11.3 3.6" stroke="#333" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          )}
          {recipeTypeChipValues.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {recipeTypeChipValues.map((chip) => (
                <span
                  key={`${displayRecipe.id || displayRecipe.name}-${chip}`}
                  style={{
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '10px',
                    color: '#073d33',
                    backgroundColor: '#e3e9e3',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    height: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        {displayRecipe.description && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '12px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(51,51,51,0.1)',
            marginBottom: '28px',
          }}>
            <h2 style={{
              margin: 0, fontSize: '16px',
              fontFamily: '"Poppins", sans-serif',
              color: '#333', textTransform: 'capitalize',
              fontWeight: '400',
            }}>
              Description
            </h2>
            <p style={{
              margin: 0, fontSize: '12px',
              fontFamily: '"Poppins", sans-serif',
              color: 'rgba(0,0,0,0.4)',
            }}>
              {displayRecipe.description}
            </p>
          </div>
        )}

        {/* Ingredients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
          <h2 style={{
            margin: 0, fontSize: '16px',
            fontFamily: '"Poppins", sans-serif',
            color: '#333', textTransform: 'capitalize',
            fontWeight: '400',
          }}>
            Ingredients
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {isLoadingDetail && (
              <p style={{ margin: '0 0 12px', fontSize: '12px', fontFamily: '"Poppins", sans-serif', color: 'rgba(0,0,0,0.5)' }}>
                Loading recipe ingredients from FatSecret...
              </p>
            )}
            {displayRecipe.ingredients.length === 0 && !isLoadingDetail && (
              <p style={{ margin: '0 0 12px', fontSize: '12px', fontFamily: '"Poppins", sans-serif', color: 'rgba(0,0,0,0.5)' }}>
                Ingredient details are not available for this recipe.
              </p>
            )}
            {displayRecipe.ingredients.map((ingredient, idx) => {
              const { name, quantity } = parseIngredient(ingredient);
              const inFridge = isInFridge(name);
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid rgba(51,51,51,0.1)',
                  }}
                >
                  {/* Left: image + name + amount */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '60px', height: '60px',
                      backgroundColor: '#efefeb',
                      borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '28px', flexShrink: 0,
                    }}>
                      {getIngredientEmoji(name)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                      <span style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '18px',
                        color: 'black',
                        textTransform: 'capitalize',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {name}
                      </span>
                      {quantity && (
                        <span style={{
                          fontFamily: '"Poppins", sans-serif',
                          fontSize: '12px',
                          color: 'black',
                          opacity: 0.5,
                        }}>
                          {quantity}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: In fridge / Unstocked badge */}
                  {displayRecipe.matchedIngredients && displayRecipe.matchedIngredients.length > 0 && (
                    <div style={{
                      backgroundColor: '#d3e2d0',
                      borderRadius: '8px',
                      padding: '0 8px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                      marginLeft: '8px',
                    }}>
                      <span style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '10px',
                        color: '#073d33',
                      }}>
                        {inFridge ? 'In fridge' : 'Unstocked'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Steps */}
        {validInstructions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
            <h2 style={{
              margin: 0, fontSize: '16px',
              fontFamily: '"Poppins", sans-serif',
              color: '#333', textTransform: 'capitalize',
              fontWeight: '400',
            }}>
              Steps
            </h2>
            {validInstructions.map((instruction, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{
                  margin: 0, fontSize: '16px',
                  fontFamily: '"Canela", Georgia, serif',
                  color: '#11130b', textTransform: 'capitalize',
                  fontWeight: '400',
                }}>
                  Step {idx + 1}
                </h3>
                <p style={{
                  margin: 0, fontSize: '12px',
                  fontFamily: '"Poppins", sans-serif',
                  color: 'rgba(0,0,0,0.4)',
                }}>
                  {instruction}
                </p>
              </div>
            ))}
          </div>
        )}
        {!isLoadingDetail && validInstructions.length === 0 && (
          <p style={{ margin: '0 0 28px', fontSize: '12px', fontFamily: '"Poppins", sans-serif', color: 'rgba(0,0,0,0.5)' }}>
            Cooking directions are not available for this recipe.
          </p>
        )}

        {/* View Original Recipe */}
        {displayRecipe.url && (
          <a
            href={displayRecipe.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '8px', width: '100%', padding: '14px 0',
              backgroundColor: '#073d33', color: '#fff',
              borderRadius: '12px', border: 'none',
              fontSize: '14px', fontFamily: '"Poppins", sans-serif',
              fontWeight: '500', textDecoration: 'none',
              cursor: 'pointer', boxSizing: 'border-box',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3.5H3.5C2.948 3.5 2.5 3.948 2.5 4.5V12.5C2.5 13.052 2.948 13.5 3.5 13.5H11.5C12.052 13.5 12.5 13.052 12.5 12.5V10M9.5 2.5H13.5M13.5 2.5V6.5M13.5 2.5L6.5 9.5"
                stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            View Original Recipe
          </a>
        )}
      </div>
    </div>
  );
}
