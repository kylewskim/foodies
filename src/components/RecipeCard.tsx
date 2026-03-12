import type { MouseEvent } from 'react';
import type { StoredRecipe } from '../types';

interface RecipeCardProps {
  recipe: StoredRecipe;
  matchedCount: number;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (event: MouseEvent<HTMLDivElement>) => void;
}

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

function displayMinutes(recipe: StoredRecipe): number {
  const prep = parseMinutes(recipe.prepTime);
  const cook = parseMinutes(recipe.cookTime);
  if (prep !== Number.MAX_SAFE_INTEGER && cook !== Number.MAX_SAFE_INTEGER) return prep + cook;
  if (prep !== Number.MAX_SAFE_INTEGER) return prep;
  if (cook !== Number.MAX_SAFE_INTEGER) return cook;
  return parseMinutes(recipe.totalTime);
}

function totalTimeLabel(recipe: StoredRecipe): string | null {
  const minutes = displayMinutes(recipe);
  if (minutes === Number.MAX_SAFE_INTEGER) return null;
  return `${minutes} min`;
}

function recipeTypeChips(recipe: StoredRecipe): string[] {
  const types = recipe.recipeTypes && recipe.recipeTypes.length > 0
    ? recipe.recipeTypes
    : (recipe.recipeType ? recipe.recipeType.split(',').map((t) => t.trim()).filter(Boolean) : []);
  return [...new Set(types)]
    .filter((t) => t && t.toLowerCase() !== 'main' && t.toLowerCase() !== 'quick_bites')
    .slice(0, 4);
}

export function RecipeCard({
  recipe,
  matchedCount,
  onClick,
  isFavorite = false,
  onToggleFavorite,
}: RecipeCardProps) {
  const chips = recipeTypeChips(recipe);
  const timeLabel = totalTimeLabel(recipe);

  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
    >
      <div style={{ width: '100%', height: '152px', borderRadius: '16px', overflow: 'hidden' }}>
        {recipe.image ? (
          <img src={recipe.image} alt={recipe.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#e8e8e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
            }}
          >
            🍽️
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
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
            }}
          >
            {recipe.name}
          </span>
          {onToggleFavorite ? (
            <div
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite(event);
              }}
              style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
              role="button"
              aria-label={isFavorite ? 'Remove favorite recipe' : 'Add favorite recipe'}
            >
              {isFavorite ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD700">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', opacity: 0.6, flexWrap: 'wrap' }}>
          {timeLabel && (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#333" strokeWidth="1.2" />
                <path d="M8 4.5V8L10.5 10" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                {timeLabel}
              </span>
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>·</span>
            </>
          )}
          <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
            Uses <strong>{matchedCount}</strong> of your items
          </span>
        </div>

        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {chips.map((chip) => (
              <span
                key={`${recipe.id}-${chip}`}
                style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '10px',
                  color: '#073d33',
                  backgroundColor: '#e3e9e3',
                  borderRadius: '999px',
                  padding: '3px 8px',
                  lineHeight: 1.2,
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
