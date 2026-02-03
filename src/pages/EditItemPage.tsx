import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Item, StorageLocation, FoodCategory } from '../types';
import { updateItem } from '../firebase/saveReceipt';

export function EditItemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const item = location.state?.item as Item | undefined;
  const isTemporary = location.state?.isTemporary as boolean | undefined;
  const returnPath = location.state?.returnPath as string | undefined;
  const processedItems = location.state?.processedItems as Item[] | undefined;
  
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) {
      navigate('/inventory');
    }
  }, [item, navigate]);

  if (!item) {
    return null;
  }

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

      // If it's a temporary item from ProcessedItemsList/ScanResultPage, pass updatedItem back via state
      // Otherwise, update in Firebase
      if (isTemporary || processedItems) {
        // Temporary item - pass updatedItem back via navigate state
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
  const locations: StorageLocation[] = ['fridge', 'freezer', 'pantry'];

  // Shared style objects
  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    color: '#666',
    marginBottom: '8px',
    fontFamily: '"Poppins", sans-serif',
  };

  const bottomBorderInputStyle = {
    width: '100%',
    padding: '12px 4px',
    fontSize: '16px',
    border: 'none',
    borderBottom: '0.8px solid #d0d0ca',
    backgroundColor: 'transparent',
    color: '#1a1a1a',
    outline: 'none',
    fontFamily: '"Poppins", sans-serif',
  };

  const pillButtonStyle = (isSelected: boolean) => ({
    flex: 1,
    padding: '8px 12px',
    backgroundColor: isSelected ? '#073d35' : '#efeee7',
    color: isSelected ? '#fff' : '#11130b',
    border: 'none',
    borderRadius: '16px',
    fontSize: '14px',
    fontFamily: '"Poppins", sans-serif',
    cursor: 'pointer',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f7f1', paddingBottom: '180px' }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '0.707px solid #e5e5e0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <button
          onClick={() => {
            // If we have processedItems, go back to scan result with the items intact
            if (processedItems && returnPath) {
              navigate(returnPath, {
                state: {
                  processedItems,
                  // Don't include updatedItem - user cancelled
                }
              });
            } else {
              navigate(-1);
            }
          }}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}
        >
          ←
        </button>
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          color: '#1a1a1a',
          fontFamily: '"Poppins", sans-serif',
          letterSpacing: '-0.3172px',
        }}>
          Edit an item
        </h1>
      </div>

      {/* Form */}
      <div style={{ padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Item Name */}
          <div>
            <label style={labelStyle}>
              Item Name
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder=""
              style={bottomBorderInputStyle}
            />
          </div>

          {/* Location - Pill Buttons */}
          <div>
            <label style={labelStyle}>
              Location
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => setLocationValue(loc)}
                  style={pillButtonStyle(locationValue === loc)}
                >
                  {loc.charAt(0).toUpperCase() + loc.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>
              Category
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FoodCategory)}
                style={{
                  ...bottomBorderInputStyle,
                  appearance: 'none',
                  paddingRight: '32px',
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div style={{
                position: 'absolute',
                right: '4px',
                bottom: '12px',
                pointerEvents: 'none',
                fontSize: '12px',
                color: '#666',
              }}>
                ▼
              </div>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label style={labelStyle}>
              Quantity
            </label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder=""
              style={bottomBorderInputStyle}
            />
          </div>

          {/* Bought Date */}
          <div>
            <label style={labelStyle}>
              Bought Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              style={bottomBorderInputStyle}
            />
          </div>

          {/* Expiration Date */}
          <div>
            <label style={labelStyle}>
              Expiration date
            </label>
            <input
              type="date"
              value={expirationDate ? new Date(expirationDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setExpirationDate(e.target.value)}
              style={bottomBorderInputStyle}
            />
            <div style={{
              fontSize: '12px',
              color: '#999',
              marginTop: '6px',
              paddingLeft: '4px',
              fontFamily: '"Poppins", sans-serif',
            }}>
              Used to calculate reminders and impact.
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#f7f6ef',
        borderTop: '1px solid #c6c6c6',
        padding: '12px 20px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 1000,
      }}>
        <button
          onClick={handleSave}
          disabled={saving || !itemName.trim()}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: (saving || !itemName.trim()) ? '#ccc' : '#073d35',
            color: '#f7f6ef',
            border: 'none',
            borderRadius: '23726400px',
            fontSize: '16px',
            fontWeight: '500',
            fontFamily: '"Poppins", sans-serif',
            cursor: (saving || !itemName.trim()) ? 'not-allowed' : 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
