import { useState } from 'react';
import type { Item } from '../types';
import { formatDateForInput, parseDateInput, getDaysUntilExpiration } from '../utils/dateHelpers';

interface ItemRowProps {
  item: Item;
  onUpdate: (updatedItem: Item) => void;
}

export function ItemRow({ item, onUpdate }: ItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDate, setEditedDate] = useState(
    formatDateForInput(item.manualExpirationDate || item.autoExpirationDate)
  );

  const displayExpirationDate = item.manualExpirationDate || item.autoExpirationDate;
  const daysUntil = getDaysUntilExpiration(displayExpirationDate);
  
  const getExpirationColor = () => {
    if (daysUntil < 0) return '#dc3545'; // Expired - red
    if (daysUntil <= 2) return '#fd7e14'; // Expiring soon - orange
    if (daysUntil <= 5) return '#ffc107'; // Warning - yellow
    return '#28a745'; // Good - green
  };

  const getExpirationLabel = () => {
    if (daysUntil < 0) return `Expired ${Math.abs(daysUntil)} days ago`;
    if (daysUntil === 0) return 'Expires today';
    if (daysUntil === 1) return 'Expires tomorrow';
    return `Expires in ${daysUntil} days`;
  };

  const handleSaveDate = () => {
    try {
      const newDate = parseDateInput(editedDate);
      const updatedItem: Item = {
        ...item,
        manualExpirationDate: newDate,
        expirationSource: 'manual',
      };
      onUpdate(updatedItem);
      setIsEditing(false);
    } catch (error) {
      alert('Invalid date format');
    }
  };

  const handleCancelEdit = () => {
    setEditedDate(formatDateForInput(item.manualExpirationDate || item.autoExpirationDate));
    setIsEditing(false);
  };

  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '12px' }}>{item.name}</td>
      <td style={{ padding: '12px' }}>{item.quantity || '-'}</td>
      <td style={{ padding: '12px' }}>{item.category}</td>
      <td style={{ padding: '12px', textTransform: 'capitalize' }}>
        {item.location || 'fridge'}
      </td>
      <td style={{ padding: '12px' }}>
        {isEditing ? (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <input
              type="date"
              value={editedDate}
              onChange={(e) => setEditedDate(e.target.value)}
              style={{
                padding: '4px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <button
              onClick={handleSaveDate}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ✓
            </button>
            <button
              onClick={handleCancelEdit}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ✗
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: getExpirationColor(), fontWeight: 'bold' }}>
              {getExpirationLabel()}
            </span>
            <span style={{ fontSize: '12px', color: '#666' }}>
              ({formatDateForInput(displayExpirationDate)})
            </span>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          </div>
        )}
      </td>
      <td style={{ padding: '12px' }}>
        {item.expirationSource === 'manual' ? (
          <span style={{ color: '#007bff', fontWeight: 'bold' }}>Manual</span>
        ) : (
          <span style={{ color: '#6c757d' }}>Auto</span>
        )}
      </td>
    </tr>
  );
}
