import { useNavigate } from 'react-router-dom';
import type { Item } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';

interface ProcessedItemsListProps {
  items: Item[];
  onItemUpdate: (updatedItem: Item) => void;
  onSaveAll: () => void;
  onChangeLocation: () => void;
  onManualEntry: () => void;
  isSaving: boolean;
}

export function ProcessedItemsList({
  items,
  onSaveAll,
  onChangeLocation,
  onManualEntry,
  isSaving,
}: ProcessedItemsListProps) {
  const navigate = useNavigate();

  const getLocationText = (location: string) => {
    const locations: Record<string, string> = {
      'fridge': 'Refrigerator',
      'freezer': 'Freezer',
      'pantry': 'Pantry',
    };
    return locations[location] || location;
  };

  const getExpirationText = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    if (daysUntil < 0) return `Expired ${Math.abs(daysUntil)} days ago`;
    if (daysUntil === 0) return 'Expires today';
    if (daysUntil === 1) return 'Expires in 1 day';
    return `Expires in ${daysUntil} days`;
  };

  const handleEditClick = (item: Item) => {
    navigate('/edit-item', { 
      state: { 
        item,
        isTemporary: item.itemId.startsWith('temp_'),
        returnPath: '/add-item?method=review',
        processedItems: items // Pass current items list
      } 
    });
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#fafafa',
      paddingBottom: '100px'
    }}>
      {/* Top Action Buttons */}
      <div style={{
        padding: '20px',
        display: 'flex',
        gap: '12px'
      }}>
        <button
          onClick={onChangeLocation}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: '#f5f5f5',
            color: '#333',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          change location
        </button>
        <button
          onClick={onManualEntry}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: '#f5f5f5',
            color: '#333',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Manual entry
        </button>
      </div>

      {/* Items List */}
      <div style={{ padding: '0 20px' }}>
        {items.map((item) => (
          <div
            key={item.itemId}
            style={{
              backgroundColor: '#f0f0f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#000',
                marginBottom: '6px'
              }}>
                {item.name}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#666',
                lineHeight: '1.4'
              }}>
                {item.quantity || '1'} {item.quantity ? '' : 'item'} • {getLocationText(item.location)} • {getExpirationText(item)}
              </div>
            </div>
            <button
              onClick={() => handleEditClick(item)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                color: '#666',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✏️
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{
        padding: '0 20px 20px 20px'
      }}>
        <div style={{
          fontSize: '14px',
          color: '#333',
          fontWeight: '500'
        }}>
          {items.length} {items.length === 1 ? 'food' : 'foods'} found
        </div>
      </div>

      {/* Add to Inventory Button */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '20px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e0e0e0'
      }}>
        <button
          onClick={onSaveAll}
          disabled={isSaving}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: isSaving ? '#ccc' : '#f5f5f5',
            color: '#333',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isSaving ? 'not-allowed' : 'pointer'
          }}
        >
          {isSaving ? 'Adding...' : 'Add to inventory'}
        </button>
      </div>
    </div>
  );
}
