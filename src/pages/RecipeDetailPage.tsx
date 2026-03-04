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
  source?: string;
  description?: string;
  image?: string;
  ingredients: string[];
  matchedIngredients?: string[];
  missingIngredients?: string[];
  instructions?: string[];
  prepTime?: string;
  calories?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
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

export function RecipeDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const recipe = location.state as RecipeDetailState;

  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const recipeId = recipe ? generateRecipeId(recipe.name) : '';

  useEffect(() => {
    if (user && recipeId) loadFavoriteStatus();
  }, [user, recipeId]);

  const loadFavoriteStatus = async () => {
    if (!user || !recipeId) return;
    try {
      const favorited = await isRecipeFavorited(user.uid, recipeId);
      setIsFavorited(favorited);
    } catch (error) {
      console.error('Error loading favorite status:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user || !recipe || isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      if (isFavorited) {
        await removeFavoriteRecipe(user.uid, recipeId);
        setIsFavorited(false);
      } else {
        await addFavoriteRecipe(user.uid, {
          recipeName: recipe.name,
          recipeSource: recipe.source,
          recipeDescription: recipe.description,
          recipeImage: recipe.image,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prepTime: recipe.prepTime,
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
    if (!recipe.matchedIngredients || recipe.matchedIngredients.length === 0) return false;
    const lower = ingredientName.toLowerCase();
    return recipe.matchedIngredients.some(matched => {
      const ml = matched.toLowerCase();
      return lower.includes(ml) || ml.includes(lower) ||
        lower.split(/[\s,]+/).some(word => word.length > 2 && ml.includes(word));
    });
  };

  useEffect(() => {
    if (!recipe) {
      console.warn('RecipeDetailPage: no location.state — redirecting to /recipes');
      navigate('/recipes', { replace: true });
    }
  }, [recipe, navigate]);

  if (!recipe) return null;

  const validInstructions = recipe.instructions?.filter(i => !i.startsWith('Full recipe:')) ?? [];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', position: 'relative' }}>
      {/* Hero image */}
      <div style={{ position: 'relative', width: '100%', height: '240px', overflow: 'hidden' }}>
        {recipe.image ? (
          <img src={recipe.image} alt={recipe.name}
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
            {recipe.name}
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
            By {sourceLabel(recipe.source, recipe.url)}
          </p>

          {/* Stats row */}
          {(recipe.prepTime || recipe.calories != null || recipe.difficulty) && (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              {recipe.prepTime && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontFamily: '"Sora", sans-serif', fontSize: '12px', color: '#333' }}>
                    {recipe.prepTime}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="#333" strokeWidth="1.2" />
                    <path d="M8 4.5V8L10.5 10" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              {recipe.calories != null && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontFamily: '"Sora", sans-serif', fontSize: '12px', color: '#333' }}>
                    {recipe.calories} Cal
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2C8 2 5 6 5 9a3 3 0 0 0 6 0c0-3-3-7-3-7z"
                      stroke="#333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {recipe.difficulty && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontFamily: '"Sora", sans-serif', fontSize: '12px', color: '#333' }}>
                    {recipe.difficulty}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2l1.5 3.5 3.5.5-2.5 2.5.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-.5L8 2z"
                      stroke="#333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {recipe.description && (
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
              {recipe.description}
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
            {recipe.ingredients.map((ingredient, idx) => {
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

        {/* View Original Recipe */}
        {recipe.url && (
          <a
            href={recipe.url}
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
