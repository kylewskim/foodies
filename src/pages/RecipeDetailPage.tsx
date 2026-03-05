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
    /^(\d+(?:[./]\d+)?\s*(?:cups?|tbsp|tsp|oz|g|kg|lb|ml|l|pcs?|cloves?|slices?|pieces?)(?:\s+of)?)\s+(.+)$/i
  );
  if (qtyFirstMatch) return { name: qtyFirstMatch[2].trim(), quantity: qtyFirstMatch[1].trim() };

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
          {(displayRecipe.prepTime || displayRecipe.cookTime || displayRecipe.totalTime || displayRecipe.servingSize || displayRecipe.recipeType || displayRecipe.calories != null || displayRecipe.difficulty) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {displayRecipe.prepTime && (
                <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                  Prep time: {displayRecipe.prepTime}
                </p>
              )}
              {displayRecipe.cookTime && (
                <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                  Cook time: {displayRecipe.cookTime}
                </p>
              )}
              {displayRecipe.totalTime && (
                <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                  Total time: {displayRecipe.totalTime}
                </p>
              )}
              {displayRecipe.servingSize && (
                <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                  Serving size: {displayRecipe.servingSize}
                </p>
              )}
              {displayRecipe.recipeType && (
                <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                  Recipe type: {displayRecipe.recipeType}
                </p>
              )}
              {displayRecipe.calories != null && (
                <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                  Calories: {displayRecipe.calories} Cal
                </p>
              )}
              {displayRecipe.difficulty && (
                <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                  Difficulty: {displayRecipe.difficulty}
                </p>
              )}
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
