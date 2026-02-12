import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Item, StorageLocation, FoodCategory } from '../types';
import { updateItem } from '../firebase/saveReceipt';
import { predictLifecycle } from '../lifecycle/predictLifecycle';

export function EditItemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const item = location.state?.item as Item | undefined;
  const isTemporary = location.state?.isTemporary as boolean | undefined;
  const returnPath = location.state?.returnPath as string | undefined;
  const processedItems = location.state?.processedItems as Item[] | undefined;

  const [itemName, setItemName] = useState(item?.name || '');
  const [purchaseDate, setPurchaseDate] = useState(
    item?.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [locationValue, setLocationValue] = useState<StorageLocation>(item?.location || 'fridge');
  const [category, setCategory] = useState<FoodCategory>(item?.category || 'Produce');
  const [price, setPrice] = useState<string>(item?.price ? String(item.price / 100) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) {
      navigate('/inventory');
    }
  }, [item, navigate]);

  if (!item) {
    return null;
  }

  const handleCancel = () => {
    if (processedItems && returnPath) {
      navigate(returnPath, {
        state: {
          processedItems,
        }
      });
    } else {
      navigate(-1);
    }
  };

  const handleSave = async () => {
    if (!itemName.trim()) {
      alert('Please enter an item name');
      return;
    }

    setSaving(true);
    try {
      const purchaseDateISO = new Date(purchaseDate).toISOString();
      const purchaseDateYMD = purchaseDate; // Already in YYYY-MM-DD from input[type=date]

      // Convert price string to cents (number), or null if empty
      const priceInCents = price.trim() ? Math.round(parseFloat(price) * 100) : null;

      // Recompute lifecycle prediction when name/location/date change
      const lifecycle = predictLifecycle({
        name: itemName,
        purchaseDate: purchaseDateYMD,
        storageLocation: locationValue,
      });

      const autoExpDate = lifecycle.autoExpirationDate
        ? new Date(lifecycle.autoExpirationDate + 'T00:00:00').toISOString()
        : item.autoExpirationDate;

      const updatedItem: Item = {
        ...item,
        name: itemName,
        category,
        location: locationValue,
        purchaseDate: purchaseDateISO,
        autoExpirationDate: item.manualExpirationDate ? item.autoExpirationDate : autoExpDate,
        price: priceInCents,
        ingredientCategory: lifecycle.ingredientCategory,
        categorySource: lifecycle.categorySource,
        predictionSource: lifecycle.predictionSource,
        autoExpireLabel: lifecycle.autoExpireLabel,
        autoExpireStatus: lifecycle.autoExpireStatus,
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
  const locations: StorageLocation[] = ['fridge', 'pantry', 'freezer'];

  // Shared style objects
  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    color: '#666',
    marginBottom: '8px',
    fontFamily: '"Poppins", sans-serif',
    letterSpacing: '-0.0762px',
  };

  const bottomBorderInputStyle = {
    width: '100%',
    padding: '12px 0',
    fontSize: '18px',
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
    backgroundColor: isSelected ? '#e3e9e3' : '#efeee7',
    color: '#11130b',
    border: isSelected ? '1px solid #073d35' : 'none',
    borderRadius: '16px',
    fontSize: '14px',
    fontFamily: '"Poppins", sans-serif',
    cursor: 'pointer',
    textAlign: 'center' as const,
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f7f1', paddingBottom: '140px' }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '0.707px solid #e5e5e0',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <button
          onClick={handleCancel}
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
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          color: '#1a1a1a',
          fontFamily: '"Poppins", sans-serif',
          letterSpacing: '-0.3172px',
          paddingLeft: '8px',
        }}>
          Item Detail
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
                  cursor: 'pointer',
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9L12 15L18 9" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
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

          {/* Price (optional) */}
          <div>
            <label style={labelStyle}>
              Price (optional)
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '18px',
                color: '#1a1a1a',
                fontFamily: '"Poppins", sans-serif',
              }}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                style={{
                  ...bottomBorderInputStyle,
                  paddingLeft: '16px',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#f7f6ef',
        padding: '16px 20px',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        display: 'flex',
        gap: '16px',
        zIndex: 1000,
      }}>
        {/* Cancel Button */}
        <button
          onClick={handleCancel}
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
          cancel
        </button>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !itemName.trim()}
          style={{
            flex: 1,
            padding: '16px',
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
          {saving ? 'saving...' : 'save'}
        </button>
      </div>
    </div>
  );
}
