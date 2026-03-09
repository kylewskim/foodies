import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser } from '../firebase/saveReceipt';
import { generateCreativeRecipe, type CreativeRecipe } from '../llm/generateCreativeRecipe';
import { generateCreativeRecipeDetail, type CreativeRecipeDetail } from '../llm/generateCreativeRecipeDetail';

export function MagicKitchenResultPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<CreativeRecipe | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<CreativeRecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [preparingDetail, setPreparingDetail] = useState(false);

  useEffect(() => {
    if (user) {
      generateNewRecipe();
    }
  }, [user]);

  const generateNewRecipe = async () => {
    if (!user) return;

    setLoading(true);
    setGenerationProgress(0);

    try {
      // Simulate progress animation
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const items = await getItemsByUser(user.uid);

      if (items.length === 0) {
        alert('No ingredients in your fridge. Please add some items first!');
        navigate('/inventory');
        return;
      }

      const creativeRecipe = await generateCreativeRecipe(items);
      setGenerationProgress(95);
      const creativeDetail = await generateCreativeRecipeDetail(creativeRecipe);

      clearInterval(progressInterval);
      setGenerationProgress(100);
      setRecipe(creativeRecipe);
      setRecipeDetail(creativeDetail);

      // Small delay to show 100% before hiding loading
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error generating creative recipe:', error);
      alert('An error occurred while generating the recipe. Please try again.');
      setLoading(false);
    }
  };

  const handleLearnMore = async () => {
    if (!recipe) return;

    if (!recipeDetail) return;

    setPreparingDetail(true);
    try {
      navigate(`/recipes/magic-${Date.now()}`, {
      state: {
        name: recipe.name,
        source: 'magic-kitchen',
        description: recipeDetail.description,
        image: recipe.imageUrl,
        ingredients: recipeDetail.ingredients,
        matchedIngredients: recipe.matchedIngredients,
        instructions: recipeDetail.instructions,
        prepTime: recipeDetail.prepTime,
        cookTime: recipeDetail.cookTime,
        totalTime: recipeDetail.totalTime,
        servingSize: recipeDetail.servingSize,
        calories: recipeDetail.calories,
        recipeTypes: recipeDetail.recipeTypes,
        difficulty: recipeDetail.difficulty,
      },
    });
    } finally {
      setPreparingDetail(false);
    }
  };

  if (loading || !recipe) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#11130b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
        {/* Header (visible during loading) */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '20px',
          right: '20px',
        }}>
          <div
            onClick={() => navigate('/recipes')}
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
                stroke="#f7f6ef"
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
            color: '#f7f6ef',
          }}>
            Magic Kitchen
          </h1>
        </div>

        {/* Loading animation */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}>
          <div style={{
            fontSize: '120px',
            animation: 'spin 2s linear infinite',
          }}>
            🪄
          </div>
          <div style={{
            textAlign: 'center',
            color: '#f7f6ef',
          }}>
            <p style={{
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontFamily: '"Canela", serif',
              fontWeight: '300',
            }}>
              Creating magic...
            </p>
            <p style={{
              margin: 0,
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif',
              opacity: 0.7,
            }}>
              {generationProgress < 30 && 'Analyzing your ingredients...'}
              {generationProgress >= 30 && generationProgress < 60 && 'Mixing unusual combinations...'}
              {generationProgress >= 60 && generationProgress < 90 && 'Creating the recipe...'}
              {generationProgress >= 90 && 'Generating image...'}
            </p>
          </div>

          {/* Progress bar */}
          <div style={{
            width: '200px',
            height: '4px',
            backgroundColor: 'rgba(247,246,239,0.2)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${generationProgress}%`,
              height: '100%',
              backgroundColor: '#d7ed64',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        <style>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#11130b',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        zIndex: 10,
      }}>
        <div
          onClick={() => navigate('/recipes')}
          style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 10H5M5 10L10 15M5 10L10 5"
              stroke="#f7f6ef"
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
          color: '#f7f6ef',
        }}>
          Magic Kitchen
        </h1>
      </div>

      {/* Recipe card */}
      <div style={{
        position: 'absolute',
        bottom: '128px',
        left: '20px',
        right: '20px',
        height: '518px',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: '#f7f6ef',
      }}>
        {/* Background image */}
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '120px',
          }}>
            🍽️
          </div>
        )}

        {/* Dark gradient overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '281px',
          background: 'linear-gradient(179.88deg, rgba(0, 0, 0, 0) 0.12%, rgba(0, 0, 0, 0.95) 85%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '24px',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontFamily: '"Canela", serif',
              fontWeight: '300',
              color: '#f7f6ef',
              letterSpacing: '-0.03px',
            }}>
              {recipe.name}
            </h2>
            <p style={{
              margin: 0,
              fontSize: '12px',
              fontFamily: '"Poppins", sans-serif',
              color: '#f7f6ef',
              opacity: 0.8,
              lineHeight: '1.35',
              letterSpacing: '-0.4316px',
            }}>
              {recipe.description}
            </p>
            <div
              onClick={preparingDetail ? undefined : handleLearnMore}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: preparingDetail ? 'wait' : 'pointer',
                opacity: 0.8,
              }}
            >
              <p style={{
                margin: 0,
                fontSize: '16px',
                fontFamily: '"Poppins", sans-serif',
                color: '#f7f6ef',
                textTransform: 'capitalize',
                letterSpacing: '-0.3125px',
              }}>
                {preparingDetail ? 'Preparing Details...' : 'Learn More'}
              </p>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="#f7f6ef"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        padding: '0 24px 34px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <button
          onClick={generateNewRecipe}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: '#d7ed64',
            color: '#073d35',
            border: 'none',
            borderRadius: '23726400px',
            fontSize: '16px',
            fontWeight: '500',
            fontFamily: '"Poppins", sans-serif',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          Give Me A New One
        </button>
      </div>
    </div>
  );
}
