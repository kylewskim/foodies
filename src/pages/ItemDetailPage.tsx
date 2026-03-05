import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { markItemAsTrashed, markItemAsUsed } from '../firebase/saveReceipt';
import type { Item, StoredRecipe } from '../types';
import { getRecipesForItem } from '../services/recommendationService';
import { getDaysUntilExpiration } from '../utils/dateHelpers';

import { ProductImage } from '../components/ProductImage';

export function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedRecipes, setRelatedRecipes] = useState<StoredRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  useEffect(() => {
    if (item) {
      loadRelatedRecipes();
    }
  }, [item]);

  const loadItem = async () => {
    try {
      if (!itemId) return;

      const itemDoc = await getDoc(doc(db, 'items', itemId));
      if (itemDoc.exists()) {
        const data = itemDoc.data();
        setItem({
          itemId: itemDoc.id,
          location: data.location || 'fridge',
          ...data,
        } as Item);
      } else {
        alert('Item not found');
        navigate('/inventory');
      }
    } catch (error) {
      console.error('Error loading item:', error);
      alert('Failed to load item');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedRecipes = async () => {
    if (!item) return;

    try {
      setLoadingRecipes(true);
      const recipes = await getRecipesForItem(item);
      setRelatedRecipes(recipes);
    } catch (error) {
      console.error('Error loading related recipes:', error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handleTrash = async () => {
    if (!item) return;

    try {
      await markItemAsTrashed(item.itemId);
      navigate('/inventory');
    } catch (error) {
      console.error('Error trashing item:', error);
      alert('Failed to trash item');
    }
  };

  const handleUsed = async () => {
    if (!item) return;

    try {
      await markItemAsUsed(item.itemId);
      navigate('/inventory');
    } catch (error) {
      console.error('Error marking item as used:', error);
      alert('Failed to update item');
    }
  };

  const getStatusBadge = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);

    if (daysUntil < 0) {
      return {
        text: 'Expired',
        bgColor: 'rgba(17,19,11,0.2)',
        textColor: '#333',
      };
    }

    if (daysUntil === 0) {
      return {
        text: 'Expires today',
        bgColor: 'rgba(252,238,117,0.75)',
        textColor: '#756900',
      };
    }

    if (daysUntil <= 5) {
      return {
        text: `Eat within ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
        bgColor: 'rgba(215,237,100,0.75)',
        textColor: '#516c00',
      };
    }

    return null;
  };

  const getDaysSincePurchase = (item: Item) => {
    const purchaseDate = new Date(item.purchaseDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - purchaseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };


  if (loading || !item) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f7f6ef'
      }}>
        <div style={{ fontSize: '18px', color: '#666', fontFamily: '"Poppins", sans-serif' }}>
          Loading...
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(item);
  const daysSince = getDaysSincePurchase(item);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      paddingBottom: '140px'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Top Row - Back and Edit */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 19L8 12L15 5" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Edit Button */}
          <button
            onClick={() => navigate('/edit-item', { state: { item } })}
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M11 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H15C20 22 22 20 22 15V13" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16.04 3.02001L8.16 10.9C7.86 11.2 7.56 11.79 7.5 12.22L7.07 15.23C6.91 16.32 7.68 17.08 8.77 16.93L11.78 16.5C12.2 16.44 12.79 16.14 13.1 15.84L20.98 7.96001C22.34 6.60001 22.98 5.02001 20.98 3.02001C18.98 1.02001 17.4 1.66001 16.04 3.02001Z" stroke="#11130b" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.91 4.15002C15.58 6.54002 17.45 8.41002 19.85 9.09002" stroke="#11130b" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Title */}
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          fontFamily: '"Poppins", sans-serif',
          color: '#11130b',
          textTransform: 'capitalize',
          paddingLeft: '8px',
        }}>
          {item.name}
        </h1>
      </div>

      {/* Item Info Card */}
      <div style={{
        padding: '16px 20px',
      }}>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}>
          {/* Item Image */}
          <ProductImage imageUrl={item.imageUrl} name={item.name} category={item.category} size={75} />

          {/* Item Details */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {/* Expiration Badge */}
            {statusBadge && (
              <div style={{
                backgroundColor: statusBadge.bgColor,
                height: '20px',
                padding: '0 8px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-start',
              }}>
                <p style={{
                  fontSize: '10px',
                  fontFamily: '"Poppins", sans-serif',
                  color: statusBadge.textColor,
                  margin: 0,
                }}>
                  {statusBadge.text}
                </p>
              </div>
            )}

            {/* Location and Category */}
            <div style={{
              display: 'flex',
              gap: '4.8px',
              alignItems: 'center',
            }}>
              {/* Location Icon */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 11.1917C11.4359 11.1917 12.6 10.0276 12.6 8.59168C12.6 7.15573 11.4359 5.99168 10 5.99168C8.56406 5.99168 7.4 7.15573 7.4 8.59168C7.4 10.0276 8.56406 11.1917 10 11.1917Z" stroke="#11130b" strokeWidth="1.25"/>
                <path d="M3.01667 7.07501C4.65833 -0.141652 15.35 -0.133319 16.9833 7.08335C17.9417 11.3167 15.3083 14.9 13 17.1167C11.325 18.7333 8.675 18.7333 6.99167 17.1167C4.69167 14.9 2.05833 11.3083 3.01667 7.07501Z" stroke="#11130b" strokeWidth="1.25"/>
              </svg>
              <p style={{
                fontSize: '14px',
                fontFamily: '"Poppins", sans-serif',
                color: '#11130b',
                margin: 0,
                textTransform: 'capitalize',
              }}>
                {item.location}
              </p>
              <span style={{
                fontSize: '14.4px',
                fontFamily: '"Poppins", sans-serif',
                color: '#11130b',
              }}>
                ·
              </span>
              <p style={{
                fontSize: '14px',
                fontFamily: '"Poppins", sans-serif',
                color: '#11130b',
                margin: 0,
              }}>
                {item.category}
              </p>
            </div>

            {/* Bought Date */}
            <div style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}>
              {/* Clock Icon */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M18.3334 10C18.3334 14.6 14.6001 18.3333 10.0001 18.3333C5.40008 18.3333 1.66675 14.6 1.66675 10C1.66675 5.40001 5.40008 1.66667 10.0001 1.66667C14.6001 1.66667 18.3334 5.40001 18.3334 10Z" stroke="#11130b" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.0917 12.65L10.5084 11.1083C10.0584 10.8417 9.69168 10.2 9.69168 9.67501V6.25833" stroke="#11130b" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{
                fontSize: '14px',
                fontFamily: '"Poppins", sans-serif',
                color: '#11130b',
                margin: 0,
              }}>
                Bought {daysSince} days ago
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cook Now Section */}
      <div style={{ padding: '24px 20px 0 20px' }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '400',
          fontFamily: '"Poppins", sans-serif',
          color: '#1a1a1a',
          margin: '0 0 16px 0',
        }}>
          Cook Now
        </h2>

        {loadingRecipes ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#999',
            fontFamily: '"Poppins", sans-serif',
            fontSize: '14px',
          }}>
            Loading recipes...
          </div>
        ) : relatedRecipes.length === 0 ? (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '40px 30px',
            textAlign: 'center',
            color: '#999',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🍳</div>
            <div style={{
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif',
              marginBottom: '8px',
              color: '#666',
            }}>
              No recipes found for this ingredient yet.
            </div>
            <Link
              to="/recipes"
              style={{
                fontSize: '14px',
                fontFamily: '"Poppins", sans-serif',
                color: '#073d35',
                textDecoration: 'underline',
              }}
            >
              Browse all recipes
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {relatedRecipes.map((recipe, index) => (
              <Link
                key={recipe.id || index}
                to={`/recipes/${recipe.id}`}
                state={{
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
                }}
                style={{ textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Recipe Image */}
                  <div style={{
                    width: '100%',
                    height: '152px',
                    borderRadius: '16px',
                    backgroundColor: '#e8e8e8',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                      <span style={{ fontSize: '48px' }}>🍽️</span>
                    )}
                  </div>

                  {/* Recipe Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Title and Heart */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <p style={{
                        fontSize: '14px',
                        fontFamily: '"Canela", Georgia, serif',
                        color: '#000',
                        margin: 0,
                      }}>
                        {recipe.name}
                      </p>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10.517 17.3417C10.2337 17.4417 9.76699 17.4417 9.48366 17.3417C7.06699 16.5167 1.66699 13.075 1.66699 7.24167C1.66699 4.66667 3.74199 2.58333 6.30033 2.58333C7.81699 2.58333 9.15866 3.31667 10.0003 4.45C10.842 3.31667 12.192 2.58333 13.7003 2.58333C16.2587 2.58333 18.3337 4.66667 18.3337 7.24167C18.3337 13.075 12.9337 16.5167 10.517 17.3417Z" stroke="#333" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    {/* Time and Tags */}
                    {(recipe.prepTime || recipe.difficulty) && (
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        alignItems: 'center',
                        opacity: 0.6,
                      }}>
                        {recipe.prepTime && (
                          <p style={{
                            fontSize: '12px',
                            fontFamily: '"Poppins", sans-serif',
                            color: '#333',
                            margin: 0,
                          }}>
                            {recipe.prepTime}
                          </p>
                        )}
                        {recipe.prepTime && recipe.difficulty && (
                          <span style={{ fontSize: '12px', color: '#333' }}>·</span>
                        )}
                        {recipe.difficulty && (
                          <p style={{
                            fontSize: '12px',
                            fontFamily: '"Poppins", sans-serif',
                            color: '#333',
                            margin: 0,
                          }}>
                            {recipe.difficulty}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Matched Ingredients */}
                    <p style={{
                      fontSize: '12px',
                      fontFamily: '"Poppins", sans-serif',
                      color: 'rgba(0,0,0,0.8)',
                      margin: 0,
                    }}>
                      Uses <strong>{recipe.matchedIngredients?.length || 0}</strong> item{(recipe.matchedIngredients?.length || 0) === 1 ? '' : 's'} from your inventory
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Bottom Buttons */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#f7f6ef',
        borderTop: '1px solid #073d35',
        padding: '16px 20px',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        display: 'flex',
        gap: '16px',
        zIndex: 100,
      }}>
        {/* Trash Button */}
        <button
          onClick={handleTrash}
          style={{
            flex: 1,
            padding: '16px',
            backgroundColor: 'transparent',
            color: '#073d35',
            border: '1.5px solid #073d35',
            borderRadius: '23726400px',
            fontSize: '16px',
            fontWeight: '400',
            fontFamily: '"Poppins", sans-serif',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          Trash
        </button>

        {/* Used Button */}
        <button
          onClick={handleUsed}
          style={{
            flex: 1,
            padding: '16px',
            backgroundColor: '#073d35',
            color: '#f7f6ef',
            border: 'none',
            borderRadius: '23726400px',
            fontSize: '16px',
            fontWeight: '500',
            fontFamily: '"Poppins", sans-serif',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          Used
        </button>
      </div>
    </div>
  );
}
