import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser } from '../firebase/saveReceipt';
import type { Item, StoredRecipe } from '../types';
import { BottomNavigation } from '../components/BottomNavigation';
import { RecipeCardSkeleton } from '../components/RecipeCardSkeleton';
import { getRecommendations } from '../services/recommendationService';
import {
  addFavoriteRecipe,
  getFavoriteRecipesByUser,
  removeFavoriteRecipe,
  generateRecipeId,
} from '../firebase/favoriteRecipes';

interface Recipe extends StoredRecipe {
  userItems: Item[];
  matchedUserItemCount: number;
}

type FilterTag = 'All' | 'Breakfast' | 'Lunch/Dinner' | 'Snack' | 'Dessert' | 'Beverage' | 'Others';
type SortMode = 'most_items_used' | 'quickest';

const FILTER_TAGS: FilterTag[] = ['All', 'Breakfast', 'Lunch/Dinner', 'Snack', 'Dessert', 'Beverage', 'Others'];

function parseMinutes(value?: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const text = value.trim();
  if (!text) return Number.MAX_SAFE_INTEGER;
  const isoMatch = text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (isoMatch) {
    const hours = isoMatch[1] ? Number(isoMatch[1]) : 0;
    const mins = isoMatch[2] ? Number(isoMatch[2]) : 0;
    const total = (hours * 60) + mins;
    return total > 0 ? total : Number.MAX_SAFE_INTEGER;
  }
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(Number(m[1])) : Number.MAX_SAFE_INTEGER;
}

function quickestMinutes(recipe: Recipe): number {
  const cook = parseMinutes(recipe.cookTime);
  if (cook !== Number.MAX_SAFE_INTEGER) return cook;
  const prep = parseMinutes(recipe.prepTime);
  if (prep !== Number.MAX_SAFE_INTEGER) return prep;
  return parseMinutes(recipe.totalTime);
}

export function RecipesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTag, setActiveTag] = useState<FilterTag>('All');
  const [sortMode, setSortMode] = useState<SortMode>('most_items_used');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) loadRecipes();
  }, [user]);

  const loadRecipes = async () => {
    if (!user) return;
    const loadStartedAt = performance.now();
    try {
      const itemsStartedAt = performance.now();
      const items = await getItemsByUser(user.uid);
      const itemsDurationMs = Math.round(performance.now() - itemsStartedAt);
      items.sort((a, b) => {
        const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
        const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
        return expA.getTime() - expB.getTime();
      });

      if (items.length === 0) {
        setRecipes([]);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      setIsRefreshing(true);
      const recommendationsStartedAt = performance.now();
      const result = await getRecommendations(user.uid, items, false);
      const recommendationsDurationMs = Math.round(performance.now() - recommendationsStartedAt);

      const recipesWithUI: Recipe[] = result.recipes.map((stored) => {
        const matchedUserItems = items.filter((item) =>
          stored.matchedIngredients.some((ing) =>
            item.name.toLowerCase().includes(ing.toLowerCase()) ||
            ing.toLowerCase().includes(item.name.toLowerCase())
          )
        );

        matchedUserItems.sort((a, b) => {
          const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
          const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
          return expA.getTime() - expB.getTime();
        });

        return {
          ...stored,
          image: stored.image,
          userItems: matchedUserItems,
          matchedUserItemCount: matchedUserItems.length,
        };
      });

      setRecipes(recipesWithUI);

      const favoritesStartedAt = performance.now();
      const favoriteRecipes = await getFavoriteRecipesByUser(user.uid);
      const favoritedSet = new Set(favoriteRecipes.map((fav) => fav.recipeId));
      setFavoritedIds(favoritedSet);
      const favoritesDurationMs = Math.round(performance.now() - favoritesStartedAt);

      console.log('⏱️ Recipes page timing:', {
        items_count: items.length,
        recommended_count: recipesWithUI.length,
        get_items_ms: itemsDurationMs,
        get_recommendations_ms: recommendationsDurationMs,
        get_favorites_ms: favoritesDurationMs,
        total_load_ms: Math.round(performance.now() - loadStartedAt),
      });
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const toggleFavorite = async (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const recipeId = generateRecipeId(recipe.name);
    const wasFav = favoritedIds.has(recipeId);
    const newFavs = new Set(favoritedIds);

    if (wasFav) {
      newFavs.delete(recipeId);
      setFavoritedIds(newFavs);
      await removeFavoriteRecipe(user.uid, recipeId);
    } else {
      newFavs.add(recipeId);
      setFavoritedIds(newFavs);
      await addFavoriteRecipe(user.uid, {
        sourceRecipeId: recipe.id,
        recipeName: recipe.name,
        recipeSource: recipe.source,
        recipeDescription: recipe.description,
        recipeImage: recipe.image,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        totalTime: recipe.totalTime,
        servingSize: recipe.servingSize,
        recipeType: recipe.recipeType,
        calories: recipe.calories,
      });
    }
  };

  const filteredRecipes = useMemo(() => {
    const byCategory = recipes.filter((recipe) => {
      if (activeTag === 'All') return true;
      return recipe.uiCategory === activeTag;
    });

    const sorted = [...byCategory].sort((a, b) => {
      if (sortMode === 'quickest') {
        const quickDiff = quickestMinutes(a) - quickestMinutes(b);
        if (quickDiff !== 0) return quickDiff;
      }

      const matchedDiff = b.matchedUserItemCount - a.matchedUserItemCount;
      if (matchedDiff !== 0) return matchedDiff;
      const coverageDiff = (b.coverage || 0) - (a.coverage || 0);
      if (coverageDiff !== 0) return coverageDiff;
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return quickestMinutes(a) - quickestMinutes(b);
    });

    return sorted;
  }, [recipes, activeTag, sortMode]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', paddingBottom: '100px', position: 'relative' }}>
      <div style={{ padding: '14px 20px 0 20px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '400', fontFamily: '"Poppins", sans-serif', color: '#11130b', letterSpacing: '-0.39px' }}>
          Recipe
        </h1>
      </div>

      <div style={{ padding: '16px 20px 0', display: 'flex', gap: '12px' }}>
        <div
          onClick={() => navigate('/magic-kitchen')}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #b8f3d8 0%, #daf4d5 50%, #f3f5b8 100%)',
            borderRadius: '16px',
            padding: '8px',
            height: '66px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', zIndex: 1 }}>
            <path d="M15 4V2M15 16V14M8 9H10M20 9H22M17.8 11.8L19 13M17.8 6.2L19 5M12.2 6.2L11 5M12.2 11.8L11 13M3 21L12 12" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontSize: '10px', fontWeight: '500', fontFamily: '"Poppins", sans-serif', color: '#333', margin: 0, position: 'relative', zIndex: 1 }}>
            Magic Kitchen
          </p>
          <div style={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.5)', padding: '2px 10px', height: '19px', display: 'flex', alignItems: 'center', borderBottomLeftRadius: '8px' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', fontStyle: 'italic', fontFamily: '"Poppins", sans-serif', color: '#98a93c', margin: 0 }}>
              Beta
            </p>
          </div>
        </div>

        <div
          onClick={() => navigate('/collection')}
          style={{
            flex: 1,
            backgroundColor: '#d3e2d0',
            borderRadius: '16px',
            padding: '8px',
            height: '66px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontSize: '10px', fontWeight: '500', fontFamily: '"Poppins", sans-serif', color: '#333', margin: 0 }}>
            Collection
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '16px 20px', scrollbarWidth: 'none' }}>
        <button
          onClick={() => setSortSheetOpen(true)}
          style={{
            flexShrink: 0,
            backgroundColor: '#efeee7',
            border: 'none',
            borderRadius: '16px',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Open sort filter"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 6H20M7 12H17M10 18H14" stroke="#11130b" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>

        {FILTER_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            style={{
              flexShrink: 0,
              backgroundColor: activeTag === tag ? '#e3e9e3' : '#efeee7',
              color: activeTag === tag ? '#073d33' : '#11130b',
              border: 'none',
              borderRadius: '16px',
              padding: '6px 12px',
              fontFamily: '"Poppins", sans-serif',
              fontSize: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {isRefreshing && (
        <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#98a93c' }} />
          <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '11px', color: '#666' }}>
            Updating recipes...
          </span>
        </div>
      )}

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {loading ? (
          <RecipeCardSkeleton count={3} />
        ) : filteredRecipes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍳</div>
            <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '16px', color: '#666', margin: '0 0 8px' }}>
              No recipes found
            </p>
            <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#999', margin: 0 }}>
              Add items to your inventory to get suggestions
            </p>
          </div>
        ) : (
          filteredRecipes.map((recipe) => {
            const recipeId = generateRecipeId(recipe.name);
            const isFav = favoritedIds.has(recipeId);

            return (
              <div
                key={recipe.id}
                onClick={() => navigate(`/recipes/${recipe.id}`, {
                  state: {
                    id: recipe.id,
                    name: recipe.name,
                    source: recipe.source,
                    description: recipe.description,
                    image: recipe.image,
                    ingredients: recipe.ingredients,
                    matchedIngredients: recipe.matchedIngredients,
                    missingIngredients: recipe.missingIngredients,
                    prepTime: recipe.prepTime,
                    cookTime: recipe.cookTime,
                    totalTime: recipe.totalTime,
                    servingSize: recipe.servingSize,
                    recipeType: recipe.recipeType,
                    calories: recipe.calories,
                    difficulty: recipe.difficulty,
                    instructions: recipe.instructions,
                    url: recipe.url || null,
                    rawCategory: recipe.rawCategory,
                    uiCategory: recipe.uiCategory,
                  },
                })}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
              >
                <div style={{ width: '100%', height: '152px', borderRadius: '16px', overflow: 'hidden' }}>
                  {recipe.image ? (
                    <img src={recipe.image} alt={recipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: '#e8e8e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
                      🍽️
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: '"Canela", Georgia, serif',
                      fontSize: '14px',
                      lineHeight: 'normal',
                      color: 'black',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginRight: '8px',
                    }}>
                      {recipe.name}
                    </span>
                    <div onClick={(e) => toggleFavorite(recipe, e)} style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}>
                      {isFav ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD700">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', opacity: 0.6 }}>
                    {(recipe.cookTime || recipe.prepTime || recipe.totalTime) && (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6.5" stroke="#333" strokeWidth="1.2" />
                          <path d="M8 4.5V8L10.5 10" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                          {recipe.cookTime || recipe.prepTime || recipe.totalTime}
                        </span>
                        <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>·</span>
                      </>
                    )}
                    <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                      Uses <strong>{recipe.matchedUserItemCount}</strong> of your items
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {sortSheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div
            onClick={() => setSortSheetOpen(false)}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />

          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f7f6ef',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '20px', lineHeight: '20px', color: '#11130b' }}>Sort by</p>
              <button
                onClick={() => setSortSheetOpen(false)}
                style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#11130b', fontSize: '28px', lineHeight: '28px' }}
              >
                ×
              </button>
            </div>

            <button
              onClick={() => {
                setSortMode('most_items_used');
                setSortSheetOpen(false);
              }}
              style={{
                width: '100%',
                border: 'none',
                borderBottom: '1px solid rgba(51,51,51,0.1)',
                background: 'transparent',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#11130b' }}>Most items used</span>
              {sortMode === 'most_items_used' ? <span style={{ fontSize: '22px', color: '#11130b' }}>✓</span> : <span />}
            </button>

            <button
              onClick={() => {
                setSortMode('quickest');
                setSortSheetOpen(false);
              }}
              style={{
                width: '100%',
                border: 'none',
                borderBottom: '1px solid rgba(51,51,51,0.1)',
                background: 'transparent',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: sortMode === 'quickest' ? '#11130b' : 'rgba(17,19,11,0.5)' }}>
                Quickest
              </span>
              {sortMode === 'quickest' ? <span style={{ fontSize: '22px', color: '#11130b' }}>✓</span> : <span />}
            </button>

            <div style={{ height: '34px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '8px' }}>
              <div style={{ width: '134px', height: '5px', borderRadius: '100px', backgroundColor: '#11130b' }} />
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}
