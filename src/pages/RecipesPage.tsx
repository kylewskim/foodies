import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser } from '../firebase/saveReceipt';
import type { Item, StoredRecipe } from '../types';
import { BottomNavigation } from '../components/BottomNavigation';
import { RecipeCardSkeleton } from '../components/RecipeCardSkeleton';
import { generateRecipes as generateAIRecipes } from '../llm/generateRecipes';
import { fetchRecipeImages } from '../utils/fetchRecipeImage';
import { generateRecipeId } from '../firebase/favoriteRecipes';
import {
  getUserRecipes,
  saveUserRecipes,
  shouldRegenerateRecipes,
  checkRecipesNeedRefresh,
  clearRecipesRefreshFlag,
} from '../firebase/userRecipes';

interface Recipe extends StoredRecipe {
  userItems: Item[];  // User's items that match this recipe
}

export function RecipesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadRecipes();
    }
  }, [user]);

  const loadRecipes = async (forceRegenerate: boolean = false) => {
    if (!user) return;

    try {
      // Check if recipes need background refresh (from item changes)
      const needsBackgroundRefresh = checkRecipesNeedRefresh();

      // Fetch user's current inventory
      const items = await getItemsByUser(user.uid);

      // Sort items by expiration date (earliest first)
      items.sort((a, b) => {
        const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
        const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
        return expA.getTime() - expB.getTime();
      });

      setUserItems(items);

      if (items.length === 0) {
        setRecipes([]);
        setLoading(false);
        setIsRefreshing(false);
        clearRecipesRefreshFlag();
        return;
      }

      // Try to load from Firebase
      const firebaseRecipes = await getUserRecipes(user.uid);

      // Helper function to map recipes to UI format
      const mapRecipesToUI = (storedRecipes: StoredRecipe[]) => {
        return storedRecipes.map(stored => {
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

          return {
            ...stored,
            userItems: matchedUserItems,
          };
        });
      };

      // Check if we should regenerate
      let shouldRegenerate = forceRegenerate || needsBackgroundRefresh;
      let regenerationReason = forceRegenerate ? 'Manual refresh' : needsBackgroundRefresh ? 'Items changed' : '';

      if (!forceRegenerate && !needsBackgroundRefresh && firebaseRecipes) {
        const check = shouldRegenerateRecipes(items, firebaseRecipes);
        shouldRegenerate = check.shouldRegenerate;
        regenerationReason = check.reason;
      }

      // If we have cached recipes and need background refresh, show cached first
      if (needsBackgroundRefresh && firebaseRecipes && !forceRegenerate) {
        console.log('📦 Showing cached recipes while refreshing in background');
        const recipesWithUserItems = mapRecipesToUI(firebaseRecipes.recipes);
        setRecipes(recipesWithUserItems);
        setLoading(false);
        // Continue to background refresh below
      }

      if (!shouldRegenerate && firebaseRecipes) {
        // Use Firebase recipes
        console.log(`✅ Using Firebase recipes: ${regenerationReason || 'No changes'}`);
        const recipesWithUserItems = mapRecipesToUI(firebaseRecipes.recipes);
        setRecipes(recipesWithUserItems);
        setLoading(false);
        setIsRefreshing(false);
        clearRecipesRefreshFlag();
        return;
      }

      if (!firebaseRecipes && !forceRegenerate) {
        regenerationReason = 'No saved recipes';
      }

      // Regenerate recipes
      console.log(`🔄 Regenerating recipes: ${regenerationReason}`);
      setIsRefreshing(true);

      const aiRecipes = await generateAIRecipes(items);

      // Fetch images for all recipes in parallel
      const recipeNames = aiRecipes.map(r => r.name);
      const images = await fetchRecipeImages(recipeNames);

      // Map AI recipes to Recipe interface with images and user items
      const recipesWithImages: Recipe[] = aiRecipes.map(aiRecipe => {
        // Find user items that match the matched ingredients
        const matchedUserItems = items.filter(item =>
          aiRecipe.matchedIngredients.some(ing =>
            item.name.toLowerCase().includes(ing.toLowerCase()) ||
            ing.toLowerCase().includes(item.name.toLowerCase())
          )
        );

        // Sort matched user items by expiration date
        matchedUserItems.sort((a, b) => {
          const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
          const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
          return expA.getTime() - expB.getTime();
        });

        // Calculate missing ingredients
        const missingIngredients = aiRecipe.ingredients.filter(
          ing => !aiRecipe.matchedIngredients.some(matched =>
            matched.toLowerCase().includes(ing.toLowerCase()) ||
            ing.toLowerCase().includes(matched.toLowerCase())
          )
        );

        return {
          ...aiRecipe,
          id: generateRecipeId(aiRecipe.name),
          image: images.get(aiRecipe.name),
          missingIngredients,
          userItems: matchedUserItems,
        };
      });

      setRecipes(recipesWithImages);

      // Save to Firebase
      const storedRecipes: StoredRecipe[] = recipesWithImages.map(recipe => ({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        image: recipe.image,
        ingredients: recipe.ingredients,
        matchedIngredients: recipe.matchedIngredients,
        missingIngredients: recipe.missingIngredients,
        prepTime: recipe.prepTime,
        calories: recipe.calories,
        difficulty: recipe.difficulty,
        instructions: recipe.instructions,
      }));

      await saveUserRecipes(user.uid, storedRecipes, items);
      clearRecipesRefreshFlag(); // Clear the flag after successful refresh
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Filter recipes based on selected ingredient
  const filteredRecipes = selectedIngredient
    ? recipes.filter(recipe =>
        recipe.userItems.some(item => item.itemId === selectedIngredient)
      )
    : recipes;

  const selectedItem = selectedIngredient
    ? userItems.find(item => item.itemId === selectedIngredient)
    : null;

  const pulseKeyframes = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      paddingBottom: '100px'
    }}>
      <style>{pulseKeyframes}</style>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          fontFamily: '"Poppins", sans-serif',
          color: '#11130b',
        }}>
          Recipe
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isRefreshing && (
            <div style={{
              fontSize: '10px',
              color: '#666',
              fontFamily: '"Poppins", sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#98a93c',
              }} />
              생성 중...
            </div>
          )}
          {!loading && !isRefreshing && (
            <div
              onClick={() => loadRecipes(true)}
              style={{
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                backgroundColor: '#f0f0f0',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#11130b" strokeWidth="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Magic Kitchen & Collection Buttons */}
      <div style={{
        padding: '0 20px',
        marginBottom: '24px',
        display: 'flex',
        gap: '12px',
      }}>
        {/* Magic Kitchen Button */}
        <div
          onClick={() => navigate('/magic-kitchen')}
          style={{
            flex: 1,
            background: 'linear-gradient(90deg, #b8f3d8 0%, #f3f5b8 100%)',
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
          {/* Magic Wand Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'relative', zIndex: 1 }}
          >
            <path d="M15 4V2M15 16V14M8 9H10M20 9H22M17.8 11.8L19 13M17.8 6.2L19 5M12.2 6.2L11 5M12.2 11.8L11 13M3 21L12 12" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

          {/* Text */}
          <p style={{
            fontSize: '10px',
            fontWeight: '500',
            fontFamily: '"Poppins", sans-serif',
            color: '#333',
            margin: 0,
            position: 'relative',
            zIndex: 1,
          }}>
            Magic Kitchen
          </p>

          {/* Beta Label */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            padding: '2px 10px',
            height: '19px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomLeftRadius: '8px',
          }}>
            <p style={{
              fontSize: '10px',
              fontWeight: '800',
              fontStyle: 'italic',
              fontFamily: '"Poppins", sans-serif',
              color: '#98a93c',
              margin: 0,
            }}>
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
          <div style={{ fontSize: '24px' }}>⭐</div>
          <p style={{
            fontSize: '10px',
            fontWeight: '500',
            fontFamily: '"Poppins", sans-serif',
            color: '#333',
            margin: 0,
          }}>
            Collection
          </p>
        </div>
      </div>

      {/* Based on what you have */}
      {(userItems.length > 0 || loading) && (
        <div style={{ padding: '0 20px', marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '400',
              fontFamily: '"Poppins", sans-serif',
              color: '#1a1a1a',
              margin: 0,
            }}>
              Based on what you have
            </h2>
            {selectedIngredient && (
              <button
                onClick={() => setSelectedIngredient(null)}
                style={{
                  fontSize: '12px',
                  fontFamily: '"Poppins", sans-serif',
                  color: '#073d35',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
          }}>
            {loading ? (
              // Skeleton for ingredient chips
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    minWidth: '96px',
                    width: '96px',
                    height: '93px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    backgroundColor: '#e0e0e0',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  <div style={{
                    width: '50px',
                    height: '12px',
                    borderRadius: '4px',
                    backgroundColor: '#e0e0e0',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                </div>
              ))
            ) : (
              userItems.slice(0, 12).map((item) => {
                const isSelected = selectedIngredient === item.itemId;

                return (
                  <div
                    key={item.itemId}
                    onClick={() => setSelectedIngredient(isSelected ? null : item.itemId)}
                    style={{
                      minWidth: '96px',
                      width: '96px',
                      height: '93px',
                      backgroundColor: isSelected ? '#d3e2d0' : 'white',
                      border: isSelected ? '1px solid #073d35' : 'none',
                      borderRadius: '16px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '8px',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      overflow: 'hidden',
                    }}>
                      {/* Placeholder for ingredient image */}
                      {item.category === 'Produce' && '🥬'}
                      {item.category === 'Protein' && '🍖'}
                      {item.category === 'Dairy' && '🥛'}
                      {item.category === 'Grains' && '🌾'}
                      {item.category === 'Beverages' && '🥤'}
                      {!['Produce', 'Protein', 'Dairy', 'Grains', 'Beverages'].includes(item.category) && '🍽️'}
                    </div>
                    <p style={{
                      fontSize: '10px',
                      fontWeight: isSelected ? '600' : '400',
                      fontFamily: '"Sora", sans-serif',
                      color: 'black',
                      margin: 0,
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}>
                      {item.name}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Filter Info */}
      {selectedItem && (
        <div style={{
          padding: '0 20px',
          marginBottom: '16px',
        }}>
          <div style={{
            backgroundColor: '#d3e2d0',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif',
              color: '#11130b',
            }}>
              Showing recipes with <strong>{selectedItem.name}</strong> ({filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'})
            </span>
          </div>
        </div>
      )}

      {/* Recipe Cards */}
      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <RecipeCardSkeleton count={3} />
        ) : filteredRecipes.length === 0 && selectedIngredient ? (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <div style={{
              fontSize: '18px',
              marginBottom: '8px',
              fontFamily: '"Poppins", sans-serif'
            }}>
              No recipes found
            </div>
            <div style={{
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif'
            }}>
              No recipes use {selectedItem?.name}
            </div>
          </div>
        ) : recipes.length === 0 ? (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍳</div>
            <div style={{
              fontSize: '18px',
              marginBottom: '8px',
              fontFamily: '"Poppins", sans-serif'
            }}>
              No recipes found
            </div>
            <div style={{
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif'
            }}>
              Add more items to your inventory to get recipe suggestions
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                onClick={() => {
                  navigate(`/recipes/${recipe.id}`, {
                    state: {
                      name: recipe.name,
                      description: recipe.description,
                      image: recipe.image,
                      ingredients: recipe.ingredients,
                      matchedIngredients: recipe.matchedIngredients,
                      missingIngredients: recipe.missingIngredients,
                      prepTime: recipe.prepTime,
                      calories: recipe.calories,
                      difficulty: recipe.difficulty,
                      instructions: recipe.instructions,
                    }
                  });
                }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                    cursor: 'pointer',
                  }}
                >
                  {/* Recipe Image */}
                  <div style={{
                    width: '100%',
                    height: '152px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    {recipe.image ? (
                      <img
                        src={recipe.image}
                        alt={recipe.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '64px',
                      }}>
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Recipe Info */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}>
                    <h3 style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      fontFamily: '"Canela", serif',
                      color: 'black',
                      margin: 0,
                    }}>
                      {recipe.name}
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      fontFamily: '"Poppins", sans-serif',
                      color: 'rgba(0, 0, 0, 0.8)',
                      margin: 0,
                    }}>
                      By AI Chef
                    </p>
                    <p style={{
                      fontSize: '12px',
                      fontFamily: '"Poppins", sans-serif',
                      color: 'rgba(0, 0, 0, 0.4)',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '18px',
                      maxHeight: '54px',
                    }}>
                      {recipe.description}
                    </p>
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
