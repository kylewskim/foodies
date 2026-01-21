import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ImageUpload } from '../components/ImageUpload';
import { ManualInput } from '../components/ManualInput';
import { ProcessedItemsList } from '../components/ProcessedItemsList';
import type { Item, StorageLocation, FoodCategory } from '../types';
import { getOrCreateSessionId } from '../utils/session';
import { saveReceipt, saveItems } from '../firebase/saveReceipt';
import { getCurrentDateISO, calculateExpirationDate } from '../utils/dateHelpers';
import { normalizeInputText } from '../llm/normalizeInputText';
import { classifyItems } from '../llm/classifyItems';
import { estimateExpirationDays } from '../llm/estimateExpirationDays';

type InputMethod = 'select' | 'image' | 'manual' | 'form' | 'review';

export function AddItemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editItem = location.state?.item as Item | undefined;
  
  const methodParam = searchParams.get('method');
  const initialMethod = editItem 
    ? 'form' 
    : methodParam === 'scan' || methodParam === 'upload' 
      ? 'image' 
      : methodParam === 'manual' 
        ? 'manual' 
        : 'select';
  
  const [inputMethod, setInputMethod] = useState<InputMethod>(initialMethod);
  const [processing, setProcessing] = useState(false);
  const [processedItems, setProcessedItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [defaultLocation, setDefaultLocation] = useState<StorageLocation>('fridge');
  
  // Form state
  const [itemName, setItemName] = useState(editItem?.name || '');
  const [quantity, setQuantity] = useState(editItem?.quantity || '');
  const [purchaseDate, setPurchaseDate] = useState(
    editItem?.purchaseDate ? new Date(editItem.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [expirationDate, setExpirationDate] = useState(
    editItem ? (editItem.manualExpirationDate || editItem.autoExpirationDate) : ''
  );
  const [locationValue, setLocationValue] = useState<StorageLocation>(editItem?.location || 'fridge');
  const [category, setCategory] = useState<FoodCategory>(editItem?.category || 'Produce');

  const handleImageUpload = async (extractedText: string) => {
    setProcessing(true);
    try {
      const normalized = await normalizeInputText(extractedText);
      const rawNames = normalized.items.map(item => item.raw_name);
      const classified = await classifyItems(rawNames);
      
      const purchaseDateISO = normalized.purchase_date || getCurrentDateISO();
      const tempReceiptId = `temp_${Date.now()}`;
      
      // Process all items
      const items: Item[] = [];
      for (let i = 0; i < classified.length; i++) {
        const classifiedItem = classified[i];
        const normalizedItem = normalized.items[i];
        
        const expiration = await estimateExpirationDays(
          classifiedItem.normalized_name,
          classifiedItem.category
        );
        
        const autoExpirationDate = calculateExpirationDate(
          purchaseDateISO,
          expiration.expiration_days
        );
        
        items.push({
          itemId: `temp_${i}_${Date.now()}`,
          receiptId: tempReceiptId,
          name: classifiedItem.normalized_name,
          quantity: normalizedItem.quantity,
          category: classifiedItem.category,
          location: defaultLocation,
          purchaseDate: purchaseDateISO,
          autoExpirationDate,
          manualExpirationDate: null,
          expirationSource: 'auto',
        });
      }
      
      setProcessedItems(items);
      setInputMethod('review');
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualInput = async (text: string) => {
    setProcessing(true);
    try {
      const normalized = await normalizeInputText(text);
      const rawNames = normalized.items.map(item => item.raw_name);
      const classified = await classifyItems(rawNames);
      
      const purchaseDateISO = normalized.purchase_date || getCurrentDateISO();
      const tempReceiptId = `temp_${Date.now()}`;
      
      // Process all items
      const items: Item[] = [];
      for (let i = 0; i < classified.length; i++) {
        const classifiedItem = classified[i];
        const normalizedItem = normalized.items[i];
        
        const expiration = await estimateExpirationDays(
          classifiedItem.normalized_name,
          classifiedItem.category
        );
        
        const autoExpirationDate = calculateExpirationDate(
          purchaseDateISO,
          expiration.expiration_days
        );
        
        items.push({
          itemId: `temp_${i}_${Date.now()}`,
          receiptId: tempReceiptId,
          name: classifiedItem.normalized_name,
          quantity: normalizedItem.quantity,
          category: classifiedItem.category,
          location: defaultLocation,
          purchaseDate: purchaseDateISO,
          autoExpirationDate,
          manualExpirationDate: null,
          expirationSource: 'auto',
        });
      }
      
      setProcessedItems(items);
      setInputMethod('review');
    } catch (error) {
      console.error('Error processing manual input:', error);
      alert('Failed to process input. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleItemUpdate = (updatedItem: Item) => {
    setProcessedItems(prevItems =>
      prevItems.map(item =>
        item.itemId === updatedItem.itemId ? updatedItem : item
      )
    );
  };

  const handleSaveAll = async () => {
    if (processedItems.length === 0) return;
    
    setSaving(true);
    try {
      const sessionId = getOrCreateSessionId();
      const purchaseDate = processedItems[0].purchaseDate;
      
      const receipt = await saveReceipt({
        sessionId,
        purchaseDate,
        createdAt: getCurrentDateISO(),
      });
      
      const itemsToSave = processedItems.map(item => ({
        ...item,
        receiptId: receipt.receiptId,
      }));
      
      const itemsWithoutIds = itemsToSave.map(({ itemId, ...rest }) => rest);
      await saveItems(itemsWithoutIds);
      
      // Navigate to home page to show updated inventory
      navigate('/');
    } catch (error) {
      console.error('Error saving items:', error);
      alert('Failed to save items. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeLocation = () => {
    // Show location picker and update all items
    const locations: StorageLocation[] = ['fridge', 'freezer', 'pantry'];
    const currentIndex = locations.indexOf(defaultLocation);
    const nextIndex = (currentIndex + 1) % locations.length;
    const newLocation = locations[nextIndex];
    
    setDefaultLocation(newLocation);
    setProcessedItems(prevItems =>
      prevItems.map(item => ({ ...item, location: newLocation }))
    );
  };

  const handleSave = async () => {
    if (!itemName.trim()) {
      alert('Please enter an item name');
      return;
    }

    setProcessing(true);
    try {
      const sessionId = getOrCreateSessionId();
      const purchaseDateISO = new Date(purchaseDate).toISOString();
      const expirationDateISO = expirationDate ? new Date(expirationDate).toISOString() : null;

      if (editItem) {
        // Update existing item
        const { updateItem } = await import('../firebase/saveReceipt');
        await updateItem({
          ...editItem,
          name: itemName,
          quantity: quantity || null,
          category,
          location: locationValue,
          purchaseDate: purchaseDateISO,
          manualExpirationDate: expirationDateISO,
          expirationSource: expirationDateISO ? 'manual' : 'auto',
        });
        alert('Item updated successfully!');
      } else {
        // Create new item
        const receipt = await saveReceipt({
          sessionId,
          purchaseDate: purchaseDateISO,
          createdAt: getCurrentDateISO(),
        });

        const itemToSave: Omit<Item, 'itemId'> = {
          receiptId: receipt.receiptId,
          name: itemName,
          quantity: quantity || null,
          category,
          location: locationValue,
          purchaseDate: purchaseDateISO,
          autoExpirationDate: expirationDateISO || calculateExpirationDate(purchaseDateISO, 7),
          manualExpirationDate: expirationDateISO,
          expirationSource: expirationDateISO ? 'manual' : 'auto',
        };

        await saveItems([itemToSave]);
        alert('Item saved successfully!');
      }

      navigate('/inventory');
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (inputMethod === 'select') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
        <div style={{ marginBottom: '30px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        </div>

        <h1 style={{ fontSize: '24px', marginBottom: '30px', textAlign: 'center' }}>
          Add New Item
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px', margin: '0 auto' }}>
          <button
            onClick={() => setInputMethod('image')}
            style={{
              padding: '30px',
              fontSize: '18px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '48px' }}>📷</span>
            <span>Scan receipt</span>
          </button>

          <button
            onClick={() => setInputMethod('image')}
            style={{
              padding: '30px',
              fontSize: '18px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '48px' }}>🖼️</span>
            <span>Upload image</span>
          </button>

          <button
            onClick={() => setInputMethod('manual')}
            style={{
              padding: '30px',
              fontSize: '18px',
              backgroundColor: '#ffc107',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '48px' }}>⌨️</span>
            <span>Manual entry</span>
          </button>

          <button
            onClick={() => setInputMethod('form')}
            style={{
              padding: '30px',
              fontSize: '18px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '48px' }}>✏️</span>
            <span>Fill form directly</span>
          </button>
        </div>
      </div>
    );
  }

  if (inputMethod === 'image') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
        <button
          onClick={() => setInputMethod('select')}
          style={{
            marginBottom: '20px',
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <ImageUpload onTextExtracted={handleImageUpload} />
        {processing && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div>Processing...</div>
          </div>
        )}
      </div>
    );
  }

  if (inputMethod === 'manual') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
        <button
          onClick={() => setInputMethod('select')}
          style={{
            marginBottom: '20px',
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <ManualInput onTextSubmitted={handleManualInput} />
        {processing && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div>Processing...</div>
          </div>
        )}
      </div>
    );
  }

  if (inputMethod === 'review') {
    return (
      <ProcessedItemsList
        items={processedItems}
        onItemUpdate={handleItemUpdate}
        onSaveAll={handleSaveAll}
        onChangeLocation={handleChangeLocation}
        onManualEntry={() => setInputMethod('manual')}
        isSaving={saving}
      />
    );
  }

  // Form view
  const categories: FoodCategory[] = ['Produce', 'Protein', 'Grains', 'Dairy', 'Snacks', 'Condiments', 'Beverages', 'Prepared'];
  const locations: StorageLocation[] = ['fridge', 'freezer', 'pantry'];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
          {editItem ? 'Edit Item' : 'Add New Item'}
        </h1>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: 'transparent',
            color: '#007bff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>

      {/* Form */}
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
              Item name *
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., Banana"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
              Quantity
            </label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 3"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
              Purchase date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
              Expiration date
            </label>
            <input
              type="date"
              value={expirationDate ? new Date(expirationDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setExpirationDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
              Location
            </label>
            <select
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value as StorageLocation)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            >
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc.charAt(0).toUpperCase() + loc.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FoodCategory)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={processing || !itemName.trim()}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: processing || !itemName.trim() ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: processing || !itemName.trim() ? 'not-allowed' : 'pointer',
              marginTop: '10px',
            }}
          >
            {processing ? 'Saving...' : (editItem ? 'Update Item' : 'Add Item')}
          </button>
        </div>
      </div>
    </div>
  );
}
