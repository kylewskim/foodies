import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser } from '../firebase/saveReceipt';
import type { Item, StoredRecipe } from '../types';
import { BottomNavigation } from '../components/BottomNavigation';
import { RecipeCardSkeleton } from '../components/RecipeCardSkeleton';
import { fetchRecipeImages } from '../utils/fetchRecipeImage';
import { getRecommendations } from '../services/recommendationService';
import {
  addFavoriteRecipe,
  removeFavoriteRecipe,
  isRecipeFavorited,
  generateRecipeId,
} from '../firebase/favoriteRecipes';

interface Recipe extends StoredRecipe {
  userItems: Item[];
}

type FilterTag = 'All' | 'Quick and easy' | 'Use my food' | 'Vegetarian' | 'Protein max';

const TAGS: FilterTag[] = ['All', 'Quick and easy', 'Use my food', 'Vegetarian', 'Protein max'];

export function RecipesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTag, setActiveTag] = useState<FilterTag>('All');
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) loadRecipes();
  }, [user]);

  const loadRecipes = async () => {
    if (!user) return;
    try {
      const items = await getItemsByUser(user.uid);
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
      const result = await getRecommendations(user.uid, items, false);
      const recipeNames = result.recipes.map(r => r.name);
      const images = await fetchRecipeImages(recipeNames);

      const recipesWithUI: Recipe[] = result.recipes.map(stored => {
        const matchedUserItems = items.filter(item =>
          stored.matchedIngredients.some(ing =>
            item.name.toLowerCase().includes(ing.toLowerCase()) ||
            ing.toLowerCase().includes(item.name.toLowerCase())
          )
        );
        matchedUserItems.sort((a, b) => {
          const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
          const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
          return expA.getTime() - expB.getTime();
        });
        return { ...stored, image: stored.image || images.get(stored.name), userItems: matchedUserItems };
      });

      setRecipes(recipesWithUI);

      // Load favorite status
      const recipeIds = recipesWithUI.map(r => generateRecipeId(r.name));
      const checks = await Promise.all(recipeIds.map(id => isRecipeFavorited(user.uid, id)));
      setFavoritedIds(new Set(recipeIds.filter((_, i) => checks[i])));
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
        recipeName: recipe.name,
        recipeSource: recipe.source,
        recipeDescription: recipe.description,
        recipeImage: recipe.image,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime,
      });
    }
  };

  const parseMinutes = (prepTime: string): number => {
    const match = prepTime.match(/(\d+)/);
    return match ? parseInt(match[1]) : 60;
  };

  const filteredRecipes = recipes.filter(recipe => {
    if (activeTag === 'All') return true;
    if (activeTag === 'Quick and easy') return parseMinutes(recipe.prepTime) <= 30;
    if (activeTag === 'Use my food') return recipe.matchedIngredients.length > 0;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 0 20px' }}>
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          fontFamily: '"Poppins", sans-serif',
          color: '#11130b',
          letterSpacing: '-0.39px',
        }}>
          Recipe
        </h1>
      </div>

      {/* Magic Kitchen & Collection */}
      <div style={{ padding: '16px 20px 0', display: 'flex', gap: '12px' }}>
        {/* Magic Kitchen */}
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
            <path d="M15 4V2M15 16V14M8 9H10M20 9H22M17.8 11.8L19 13M17.8 6.2L19 5M12.2 6.2L11 5M12.2 11.8L11 13M3 21L12 12"
              stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{
            fontSize: '10px', fontWeight: '500', fontFamily: '"Poppins", sans-serif',
            color: '#333', margin: 0, position: 'relative', zIndex: 1,
          }}>
            Magic Kitchen
          </p>
          <div style={{
            position: 'absolute', top: 0, right: 0,
            backgroundColor: 'rgba(255,255,255,0.5)',
            padding: '2px 10px', height: '19px',
            display: 'flex', alignItems: 'center', borderBottomLeftRadius: '8px',
          }}>
            <p style={{
              fontSize: '10px', fontWeight: '800', fontStyle: 'italic',
              fontFamily: '"Poppins", sans-serif', color: '#98a93c', margin: 0,
            }}>
              Beta
            </p>
          </div>
        </div>

        {/* Collection */}
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
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
              stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{
            fontSize: '10px', fontWeight: '500', fontFamily: '"Poppins", sans-serif',
            color: '#333', margin: 0,
          }}>
            Collection
          </p>
        </div>
      </div>

      {/* Tag Filter Chips */}
      <div style={{
        display: 'flex', gap: '8px', overflowX: 'auto',
        padding: '16px 20px', scrollbarWidth: 'none',
      }}>
        {TAGS.map(tag => (
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

      {/* Refreshing indicator */}
      {isRefreshing && (
        <div style={{
          padding: '0 20px 12px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#98a93c' }} />
          <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '11px', color: '#666' }}>
            Updating recipes...
          </span>
        </div>
      )}

      {/* Recipe Cards */}
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
          filteredRecipes.map(recipe => {
            const recipeId = generateRecipeId(recipe.name);
            const isFav = favoritedIds.has(recipeId);
            const tagLabel = recipe.matchedIngredients.length > 0 ? 'Use my food' : null;

            return (
              <div
                key={recipe.id}
                onClick={() => navigate(`/recipes/${recipe.id}`, {
                  state: {
                    name: recipe.name,
                    source: recipe.source,
                    description: recipe.description,
                    image: recipe.image,
                    ingredients: recipe.ingredients,
                    matchedIngredients: recipe.matchedIngredients,
                    missingIngredients: recipe.missingIngredients,
                    prepTime: recipe.prepTime,
                    calories: recipe.calories,
                    difficulty: recipe.difficulty,
                    instructions: recipe.instructions,
                    url: recipe.url || null,
                  }
                })}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
              >
                {/* Image */}
                <div style={{
                  width: '100%', height: '152px',
                  borderRadius: '16px', overflow: 'hidden',
                }}>
                  {recipe.image ? (
                    <img src={recipe.image} alt={recipe.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      backgroundColor: '#e8e8e0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '48px',
                    }}>
                      🍽️
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Name + bookmark */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: '"Canela", Georgia, serif',
                      fontSize: '14px',
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
                    <div
                      onClick={(e) => toggleFavorite(recipe, e)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                    >
                      {isFav ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD700">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                            stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                            stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Clock + uses */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', opacity: 0.6 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6.5" stroke="#333" strokeWidth="1.2" />
                      <path d="M8 4.5V8L10.5 10" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                      {recipe.prepTime}
                    </span>
                    <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>·</span>
                    <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                      Uses <strong>{recipe.matchedIngredients.length}</strong> of your items
                    </span>
                  </div>

                  {/* Tag badge */}
                  {tagLabel && (
                    <div style={{ display: 'flex' }}>
                      <div style={{
                        backgroundColor: '#d3e2d0',
                        borderRadius: '8px',
                        padding: '0 8px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                      }}>
                        <span style={{
                          fontFamily: '"Poppins", sans-serif',
                          fontSize: '10px',
                          color: '#073d33',
                        }}>
                          {tagLabel}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
