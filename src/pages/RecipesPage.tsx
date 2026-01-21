import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrCreateSessionId } from '../utils/session';
import { getItemsBySession } from '../firebase/saveReceipt';
import type { Item } from '../types';

interface Recipe {
  id: string;
  name: string;
  image?: string;
  ingredients: string[];
  missingIngredients: string[];
  matchedIngredients: string[];
}

export function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const sessionId = getOrCreateSessionId();
      const items = await getItemsBySession(sessionId);

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
    }).filter(recipe => recipe.matchedIngredients.length > 0) // Only show recipes with at least one matched ingredient
      .sort((a, b) => b.matchedIngredients.length - a.matchedIngredients.length); // Sort by most matched ingredients
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      paddingBottom: '80px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderBottom: '1px solid #e0e0e0',
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Suggested Recipes</h1>
        <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
          Based on your current inventory
        </p>
      </div>

      {/* Recipes List */}
      <div style={{ padding: '20px' }}>
        {recipes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#999'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>🍳</div>
            <div style={{ fontSize: '18px', marginBottom: '5px' }}>No recipes found</div>
            <div style={{ fontSize: '14px' }}>Add more items to your inventory to get recipe suggestions</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {recipes.map(recipe => (
              <div
                key={recipe.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                  {recipe.image ? (
                    <img
                      src={recipe.image}
                      alt={recipe.name}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px'
                    }}>
                      🍽️
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      {recipe.name}
                    </h3>
                    
                    {recipe.matchedIngredients.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          You have:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {recipe.matchedIngredients.map((ing, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#d4edda',
                                color: '#155724',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 'bold'
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
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          You need:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {recipe.missingIngredients.map((ing, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#fff3cd',
                                color: '#856404',
                                borderRadius: '12px',
                                fontSize: '12px'
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

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '15px 0',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#666', textAlign: 'center' }}>
          <div style={{ fontSize: '24px' }}>🏠</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>Home</div>
        </Link>
        <Link to="/recipes" style={{ textDecoration: 'none', color: '#007bff', textAlign: 'center' }}>
          <div style={{ fontSize: '24px' }}>🍳</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>Recipes</div>
        </Link>
        <Link to="/add-item" style={{ textDecoration: 'none', color: '#666', textAlign: 'center' }}>
          <div style={{ fontSize: '24px' }}>➕</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>Add</div>
        </Link>
      </div>
    </div>
  );
}
