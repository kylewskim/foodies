import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  addFavoriteRecipe,
  removeFavoriteRecipe,
  isRecipeFavorited,
  generateRecipeId,
} from '../firebase/favoriteRecipes';

interface RecipeDetailState {
  name: string;
  description?: string;
  image?: string;
  ingredients: string[];
  matchedIngredients?: string[];
  missingIngredients?: string[];
  instructions?: string[];
  prepTime?: string;
  calories?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export function RecipeDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const recipe = location.state as RecipeDetailState;

  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // Generate consistent recipe ID
  const recipeId = recipe ? generateRecipeId(recipe.name) : '';

  useEffect(() => {
    if (user && recipeId) {
      loadFavoriteStatus();
    }
  }, [user, recipeId]);

  const loadFavoriteStatus = async () => {
    if (!user || !recipeId) return;
    try {
      console.log('Loading favorite status for:', recipeId);
      const favorited = await isRecipeFavorited(user.uid, recipeId);
      console.log('Is favorited:', favorited);
      setIsFavorited(favorited);
    } catch (error) {
      console.error('Error loading favorite status:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user || !recipe || isTogglingFavorite) return;

    console.log('Toggling favorite, current state:', isFavorited);
    setIsTogglingFavorite(true);

    try {
      if (isFavorited) {
        console.log('Removing from favorites...');
        await removeFavoriteRecipe(user.uid, recipeId);
        setIsFavorited(false);
        console.log('Removed successfully');
      } else {
        console.log('Adding to favorites...');
        await addFavoriteRecipe(user.uid, {
          recipeName: recipe.name,
          recipeDescription: recipe.description,
          recipeImage: recipe.image,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prepTime: recipe.prepTime,
        });
        setIsFavorited(true);
        console.log('Added successfully');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('별 추가/제거 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  if (!recipe) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f7f6ef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ fontFamily: '"Poppins", sans-serif', color: '#666' }}>
          Recipe not found
        </p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      position: 'relative',
    }}>
      {/* Recipe Image with Gradient Overlay */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '240px',
        overflow: 'hidden',
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

        {/* Black gradient overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.8) 100%)',
        }} />

        {/* Back Button */}
        <div
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            top: '60px',
            left: '20px',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 10H5M5 10L10 15M5 10L10 5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Star Button */}
        <div
          onClick={handleToggleFavorite}
          style={{
            position: 'absolute',
            top: '60px',
            right: '20px',
            width: '24px',
            height: '24px',
            cursor: isTogglingFavorite ? 'wait' : 'pointer',
            opacity: isTogglingFavorite ? 0.5 : 1,
          }}
        >
          {isFavorited ? (
            // Filled yellow star
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="#FFD700"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            // Outline star
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>

      {/* White Content Container */}
      <div style={{
        position: 'relative',
        backgroundColor: '#f7f6ef',
        borderTopLeftRadius: '40px',
        borderTopRightRadius: '40px',
        marginTop: '-59px',
        padding: '48px 20px 40px',
        minHeight: 'calc(100vh - 181px)',
      }}>
        {/* Recipe Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '28px',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '300',
            fontFamily: '"Canela", serif',
            color: '#333',
            letterSpacing: '-0.036px',
            lineHeight: 'normal',
          }}>
            {recipe.name}
          </h1>
          <p style={{
            margin: 0,
            fontSize: '12px',
            fontFamily: '"Poppins", sans-serif',
            color: '#11130b',
            opacity: 0.4,
            lineHeight: '1.35',
          }}>
            By AI Chef
          </p>

          {/* Recipe Stats */}
          <div style={{
            display: 'flex',
            gap: '20px',
            alignItems: 'center',
          }}>
            {recipe.prepTime && (
              <div style={{
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: '"Sora", sans-serif',
                  color: '#333',
                }}>
                  {recipe.prepTime}
                </p>
                <div style={{ width: '16px', height: '16px', fontSize: '12px' }}>⏱️</div>
              </div>
            )}

            {recipe.calories && (
              <div style={{
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: '"Sora", sans-serif',
                  color: '#333',
                }}>
                  {recipe.calories} Cal
                </p>
                <div style={{ width: '16px', height: '16px', fontSize: '12px' }}>🔥</div>
              </div>
            )}

            {recipe.difficulty && (
              <div style={{
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: '"Sora", sans-serif',
                  color: '#333',
                }}>
                  {recipe.difficulty}
                </p>
                <div style={{ width: '16px', height: '16px', fontSize: '12px' }}>
                  {recipe.difficulty === 'Easy' ? '✓' : recipe.difficulty === 'Medium' ? '⚡' : '⭐'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {recipe.description && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '28px',
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontFamily: '"Poppins", sans-serif',
              color: '#333',
              textTransform: 'capitalize',
            }}>
              Description
            </h2>
            <p style={{
              margin: 0,
              fontSize: '12px',
              fontFamily: '"Poppins", sans-serif',
              color: 'rgba(0, 0, 0, 0.4)',
              lineHeight: 'normal',
            }}>
              {recipe.description}
            </p>
          </div>
        )}

        {/* Ingredients */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '28px',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontFamily: '"Poppins", sans-serif',
            color: '#333',
            textTransform: 'capitalize',
          }}>
            Ingredients
          </h2>
          {recipe.ingredients.map((ingredient, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#d3e2d0',
                borderRadius: '8px',
                padding: '8px 16px 8px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                }}>
                  🥗
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '16px',
                  fontFamily: '"Poppins", sans-serif',
                  color: 'black',
                }}>
                  {ingredient}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Steps */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontFamily: '"Poppins", sans-serif',
              color: '#333',
              textTransform: 'capitalize',
            }}>
              Steps
            </h2>
            {recipe.instructions.map((instruction, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontFamily: '"Canela", serif',
                  color: '#11130b',
                  textTransform: 'capitalize',
                }}>
                  Step {idx + 1}
                </h3>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: '"Poppins", sans-serif',
                  color: 'rgba(0, 0, 0, 0.4)',
                  lineHeight: 'normal',
                }}>
                  {instruction}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
