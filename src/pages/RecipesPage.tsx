import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser } from '../firebase/saveReceipt';
import type { Item } from '../types';
import { BottomNavigation } from '../components/BottomNavigation';
import { AddFoodModal } from '../components/AddFoodModal';

interface Recipe {
  id: string;
  name: string;
  image?: string;
  ingredients: string[];
  missingIngredients: string[];
  matchedIngredients: string[];
}

export function RecipesPage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadRecipes();
    }
  }, [user]);

  const loadRecipes = async () => {
    if (!user) return;
    
    try {
      const items = await getItemsByUser(user.uid);

      // Generate recipe recommendations based on inventory
      const recommendedRecipes = generateRecipes(items);
      setRecipes(recommendedRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecipes = (items: Item[]): Recipe[] => {
    const itemNames = items.map(item => item.name.toLowerCase());
    
    // Sample recipes with ingredient matching
    const allRecipes: Recipe[] = [
      {
        id: '1',
        name: 'Green Salad',
        ingredients: ['lettuce', 'tomato', 'cucumber', 'avocado', 'salad dressing'],
        missingIngredients: [],
        matchedIngredients: [],
      },
      {
        id: '2',
        name: 'Fruit Smoothie',
        ingredients: ['banana', 'strawberry', 'yogurt', 'milk', 'honey'],
        missingIngredients: [],
        matchedIngredients: [],
      },
      {
        id: '3',
        name: 'Pasta with Tomato Sauce',
        ingredients: ['pasta', 'tomato sauce', 'garlic', 'onion', 'olive oil'],
        missingIngredients: [],
        matchedIngredients: [],
      },
      {
        id: '4',
        name: 'Chicken Stir Fry',
        ingredients: ['chicken', 'broccoli', 'carrot', 'soy sauce', 'rice'],
        missingIngredients: [],
        matchedIngredients: [],
      },
      {
        id: '5',
        name: 'Sandwich',
        ingredients: ['bread', 'cheese', 'lettuce', 'tomato', 'mayonnaise'],
        missingIngredients: [],
        matchedIngredients: [],
      },
    ];

    // Match ingredients with inventory
    return allRecipes.map(recipe => {
      const matched: string[] = [];
      const missing: string[] = [];

      recipe.ingredients.forEach(ingredient => {
        const found = itemNames.some(itemName => 
          itemName.includes(ingredient.toLowerCase()) || 
          ingredient.toLowerCase().includes(itemName)
        );
        
        if (found) {
          matched.push(ingredient);
        } else {
          missing.push(ingredient);
        }
      });

      return {
        ...recipe,
        matchedIngredients: matched,
        missingIngredients: missing,
      };
    }).filter(recipe => recipe.matchedIngredients.length > 0)
      .sort((a, b) => b.matchedIngredients.length - a.matchedIngredients.length);
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fafaf8'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#fafaf8',
      paddingBottom: '100px'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '20px', 
          fontWeight: '600',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          Suggested Recipes
        </h1>
        <p style={{ 
          margin: '8px 0 0 0', 
          fontSize: '14px', 
          color: '#999',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          Based on your current inventory
        </p>
      </div>

      {/* Recipes List */}
      <div style={{ padding: '0 20px' }}>
        {recipes.length === 0 ? (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍳</div>
            <div style={{ 
              fontSize: '18px', 
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              No recipes found
            </div>
            <div style={{ 
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Add more items to your inventory to get recipe suggestions
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recipes.map(recipe => (
              <div
                key={recipe.id}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  {recipe.image ? (
                    <img
                      src={recipe.image}
                      alt={recipe.name}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '12px',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '12px',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px'
                    }}>
                      🍽️
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      marginBottom: '12px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      {recipe.name}
                    </h3>
                    
                    {recipe.matchedIngredients.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#999', 
                          marginBottom: '6px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          You have:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {recipe.matchedIngredients.map((ing, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#e8f5e9',
                                color: '#2e7d32',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '500',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                              }}
                            >
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {recipe.missingIngredients.length > 0 && (
                      <div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#999', 
                          marginBottom: '6px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }}>
                          You need:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {recipe.missingIngredients.map((ing, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#fff3e0',
                                color: '#e65100',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                              }}
                            >
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setIsAddFoodModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '92px', // 72px nav + 20px spacing
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#073d35',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 99,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f7f6ef" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Bottom Navigation */}
      <BottomNavigation />

      {/* Add Food Modal */}
      <AddFoodModal
        isOpen={isAddFoodModalOpen}
        onClose={() => setIsAddFoodModalOpen(false)}
      />
    </div>
  );
}
