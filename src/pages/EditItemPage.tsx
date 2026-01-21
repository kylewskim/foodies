import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Item, StorageLocation, FoodCategory } from '../types';
import { updateItem } from '../firebase/saveReceipt';

export function EditItemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const item = location.state?.item as Item | undefined;
  const isTemporary = location.state?.isTemporary as boolean | undefined;
  
  const [itemName, setItemName] = useState(item?.name || '');
  const [quantity, setQuantity] = useState(item?.quantity || '');
  const [purchaseDate, setPurchaseDate] = useState(
    item?.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [expirationDate, setExpirationDate] = useState(
    item ? (item.manualExpirationDate || item.autoExpirationDate) : ''
  );
  const [locationValue, setLocationValue] = useState<StorageLocation>(item?.location || 'fridge');
  const [category, setCategory] = useState<FoodCategory>(item?.category || 'Produce');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) {
      navigate('/inventory');
    }
  }, [item, navigate]);

  if (!item) {
    return null;
  }

  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    // Add ordinal suffix
    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    return `${month} ${getOrdinal(day)}, ${year}`;
  };

  const handleSave = async () => {
    if (!itemName.trim()) {
      alert('Please enter an item name');
      return;
    }

    setSaving(true);
    try {
      const purchaseDateISO = new Date(purchaseDate).toISOString();
      const expirationDateISO = expirationDate ? new Date(expirationDate).toISOString() : null;

      const updatedItem: Item = {
        ...item,
        name: itemName,
        quantity: quantity || null,
        category,
        location: locationValue,
        purchaseDate: purchaseDateISO,
        manualExpirationDate: expirationDateISO,
        expirationSource: expirationDateISO ? 'manual' : 'auto',
      };

      // If it's a temporary item from ProcessedItemsList, pass updatedItem back via state
      // Otherwise, update in Firebase
      if (isTemporary) {
        // Temporary item - pass updatedItem back via navigate state
        const returnPath = location.state?.returnPath as string | undefined;
        const processedItems = location.state?.processedItems as Item[] | undefined;
        
        // Update the item in the list
        const updatedItems = processedItems?.map(i => 
          i.itemId === updatedItem.itemId ? updatedItem : i
        ) || [updatedItem];
        
        navigate(returnPath || '/add-item?method=review', { 
          state: { 
            updatedItem,
            processedItems: updatedItems
          } 
        });
      } else {
        // Real item - update in Firebase
        await updateItem(updatedItem);
        navigate(-1);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const categories: FoodCategory[] = ['Produce', 'Protein', 'Grains', 'Dairy', 'Snacks', 'Condiments', 'Beverages', 'Prepared'];
  const locations: StorageLocation[] = ['pantry', 'fridge', 'freezer'];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
          Edit item
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || !itemName.trim()}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            color: saving || !itemName.trim() ? '#999' : '#007bff',
            cursor: saving || !itemName.trim() ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            padding: '4px 8px'
          }}
        >
          Save
        </button>
      </div>

      {/* Form */}
      <div style={{ padding: '20px' }}>
        {/* Item name */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '8px'
          }}>
            Item name
          </label>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Item name"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              backgroundColor: 'white',
              border: 'none',
              borderRadius: '8px',
              color: '#000'
            }}
          />
        </div>

        {/* Location - Segmented Control */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '12px'
          }}>
            Location
          </label>
          <div style={{
            display: 'flex',
            gap: '8px'
          }}>
            {locations.map(loc => (
              <button
                key={loc}
                onClick={() => setLocationValue(loc)}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: locationValue === loc ? '#333' : 'white',
                  color: locationValue === loc ? '#fff' : '#000',
                  textTransform: 'capitalize'
                }}
              >
                {loc === 'fridge' ? 'Fridge' : loc === 'freezer' ? 'Freezer' : 'Pantry'}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '8px'
          }}>
            Category
          </label>
          <div style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FoodCategory)}
              style={{
                width: '100%',
                fontSize: '16px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#000',
                appearance: 'none',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <span style={{ fontSize: '12px', color: '#999' }}>▼</span>
          </div>
        </div>

        {/* Container or quantity */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '8px'
          }}>
            Container or quantity
          </label>
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g., 1 bag"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              backgroundColor: 'white',
              border: 'none',
              borderRadius: '8px',
              color: '#000'
            }}
          />
        </div>

        {/* Bought date */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '8px'
          }}>
            Bought date
          </label>
          <div style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '16px' }}>📅</span>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              style={{
                flex: 1,
                fontSize: '16px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#000',
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '14px', color: '#666' }}>
              {formatDateDisplay(purchaseDate)}
            </span>
          </div>
        </div>

        {/* Expiration date */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#000',
            marginBottom: '8px'
          }}>
            Expiration date
          </label>
          <div style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '16px' }}>📅</span>
            <input
              type="date"
              value={expirationDate ? new Date(expirationDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setExpirationDate(e.target.value)}
              style={{
                flex: 1,
                fontSize: '16px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#000',
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '14px', color: '#666' }}>
              {expirationDate ? formatDateDisplay(expirationDate) : ''}
            </span>
          </div>
          <div style={{
            fontSize: '12px',
            color: '#999',
            marginTop: '6px',
            paddingLeft: '4px'
          }}>
            Used to calculate reminders and impact.
          </div>
        </div>

        {/* More options */}
        <div>
          <button
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <span style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#000'
            }}>
              More options
            </span>
            <span style={{
              fontSize: '12px',
              color: '#999',
              transform: showMoreOptions ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}>
              ▼
            </span>
          </button>
          {showMoreOptions && (
            <div style={{
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '8px',
              marginTop: '8px'
            }}>
              {/* Additional options can be added here */}
              <div style={{ fontSize: '14px', color: '#666' }}>
                Additional options coming soon...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
