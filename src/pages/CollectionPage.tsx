import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFavoriteRecipesByUser, generateRecipeId } from '../firebase/favoriteRecipes';
import type { FavoriteRecipe } from '../types';

export function CollectionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [favoriteRecipes, setFavoriteRecipes] = useState<FavoriteRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadFavoriteRecipes();
    }
  }, [user]);

  const loadFavoriteRecipes = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const recipes = await getFavoriteRecipesByUser(user.uid);
      console.log('📚 Loaded favorite recipes:', recipes.length);
      setFavoriteRecipes(recipes);
    } catch (error) {
      console.error('Error loading favorite recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f7f6ef'
      }}>
        <div style={{ fontSize: '18px', color: '#666', fontFamily: '"Poppins", sans-serif' }}>
          Loading collection...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      paddingBottom: '40px',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
      }}>
        {/* Back Button */}
        <div
          onClick={() => navigate(-1)}
          style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginBottom: '8px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 10H5M5 10L10 15M5 10L10 5"
              stroke="#11130b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          fontFamily: '"Poppins", sans-serif',
          color: '#11130b',
        }}>
          Collection
        </h1>
      </div>

      {/* Recipe Cards */}
      <div style={{ padding: '0 20px' }}>
        {favoriteRecipes.length === 0 ? (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⭐</div>
            <div style={{
              fontSize: '18px',
              marginBottom: '8px',
              fontFamily: '"Poppins", sans-serif'
            }}>
              No saved recipes
            </div>
            <div style={{
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif'
            }}>
              Star your favorite recipes to add them to your collection
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {favoriteRecipes.map((recipe) => (
              <div
                key={recipe.favoriteId}
                onClick={() => {
                  navigate(`/recipes/${recipe.recipeId}`, {
                    state: {
                      name: recipe.recipeName,
                      description: recipe.recipeDescription,
                      image: recipe.recipeImage,
                      ingredients: recipe.ingredients,
                      instructions: recipe.instructions,
                      prepTime: recipe.prepTime,
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
                  {recipe.recipeImage ? (
                    <img
                      src={recipe.recipeImage}
                      alt={recipe.recipeName}
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
                    {recipe.recipeName}
                  </h3>
                  <p style={{
                    fontSize: '12px',
                    fontFamily: '"Poppins", sans-serif',
                    color: 'rgba(0, 0, 0, 0.8)',
                    margin: 0,
                  }}>
                    By AI Chef
                  </p>
                  {recipe.recipeDescription && (
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
                      {recipe.recipeDescription}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
