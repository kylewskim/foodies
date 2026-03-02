import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ImageUpload } from '../components/ImageUpload';
import { ManualInput } from '../components/ManualInput';
import { ProcessingScreen } from '../components/ProcessingScreen';
import { ScanResultPage } from '../components/ScanResultPage';
import type { Item, StorageLocation, FoodCategory } from '../types';
import { saveReceipt, saveItems } from '../firebase/saveReceipt';
import { getCurrentDateISO } from '../utils/dateHelpers';
import { normalizeInputText } from '../llm/normalizeInputText';
import { parseReceiptWithVision } from '../llm/parseReceiptWithVision';
import { isOpenAIConfigured } from '../llm/openaiClient';
import { predictLifecycle } from '../lifecycle/predictLifecycle';
import { markRecipesNeedRefresh } from '../firebase/userRecipes';
import { capitalizeWords } from '../llm/classifyItems';
import type { NormalizeInputTextOutput } from '../types';
import { fetchProductImage } from '../services/productImageService';

type InputMethod = 'image' | 'manual' | 'form' | 'review';

export function AddItemPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const editItem = location.state?.item as Item | undefined;
  
  const methodParam = searchParams.get('method');
  
  // Check if returning from EditItemPage with updated item
  const returningWithUpdate = location.state?.updatedItem as Item | undefined;
  const returningItems = location.state?.processedItems as Item[] | undefined;
  // Check if file was selected from AddFoodModal
  const selectedFile = location.state?.selectedFile as File | undefined;
  
  const getInitialMethod = (): InputMethod => {
    // If returning from edit with items, go to review
    if (returningWithUpdate || returningItems) {
      return 'review';
    }
    if (editItem) {
      return 'form';
    }
    if (methodParam === 'scan' || methodParam === 'upload') {
      return 'image';
    }
    if (methodParam === 'manual') {
      return 'manual';
    }
    // No method specified - go back to home
    return 'image'; // Default to image since we removed select screen
  };
  
  const [inputMethod, setInputMethod] = useState<InputMethod>(getInitialMethod);
  const [processing, setProcessing] = useState(false);
  const [processedItems, setProcessedItems] = useState<Item[]>(returningItems || []);
  const [saving, setSaving] = useState(false);
  const [autoProcessStarted, setAutoProcessStarted] = useState(false);
  const [receiptDate, setReceiptDate] = useState<string | undefined>(undefined);

  // Handle returning from EditItemPage with an updated item
  useEffect(() => {
    if (returningWithUpdate) {
      setProcessedItems(prevItems =>
        prevItems.map(item =>
          item.itemId === returningWithUpdate.itemId ? returningWithUpdate : item
        )
      );
      // Clear the state to prevent re-processing
      window.history.replaceState({}, '');
    }
  }, [returningWithUpdate]);

  // Auto-process file if selected from AddFoodModal
  useEffect(() => {
    if (selectedFile && !autoProcessStarted) {
      setAutoProcessStarted(true);
      processSelectedFile(selectedFile);
      // Clear the state to prevent re-processing
      window.history.replaceState({}, '');
    }
  }, [selectedFile, autoProcessStarted]);

  // Core pipeline step: items (already normalized) → lifecycle → filter → display
  const processNormalized = async (normalized: NormalizeInputTextOutput) => {
    const purchaseDateRaw = normalized.purchase_date || getCurrentDateISO();
    const purchaseDateYMD = purchaseDateRaw.includes('T')
      ? purchaseDateRaw.split('T')[0]
      : purchaseDateRaw;

    const tempReceiptId = `temp_${Date.now()}`;
    setReceiptDate(purchaseDateRaw);

    const tLifecycleStart = performance.now();
    const items: Item[] = normalized.items.map((rawItem, i) => {
      const itemName = capitalizeWords(rawItem.raw_name);
      const lifecycle = predictLifecycle({
        name: itemName,
        purchaseDate: purchaseDateYMD,
      });

      return {
        itemId: `temp_${i}_${Date.now()}`,
        userId: user?.uid || '',
        receiptId: tempReceiptId,
        name: itemName,
        quantity: rawItem.quantity,
        category: lifecycle.displayCategory,
        location: lifecycle.recommendedLocation,
        purchaseDate: purchaseDateRaw,
        autoExpirationDate: lifecycle.autoExpirationDate
          ? new Date(lifecycle.autoExpirationDate + 'T00:00:00').toISOString()
          : getCurrentDateISO(),
        manualExpirationDate: null,
        expirationSource: 'auto' as const,
        ingredientCategory: lifecycle.ingredientCategory,
        categorySource: lifecycle.categorySource,
        predictionSource: lifecycle.predictionSource,
        autoExpireLabel: lifecycle.autoExpireLabel,
        autoExpireStatus: lifecycle.autoExpireStatus,
      };
    });

    console.log(`⏱️ [Pipeline] predictLifecycle (${items.length} items): ${(performance.now() - tLifecycleStart).toFixed(0)}ms`);

    const foodItems = items.filter(item =>
      item.ingredientCategory !== 'unknown' && item.ingredientCategory !== 'non-food'
    );
    const filtered = items.filter(item =>
      item.ingredientCategory === 'unknown' || item.ingredientCategory === 'non-food'
    );
    if (filtered.length > 0) {
      console.log(`🚫 Filtered ${filtered.length} non-food/unknown items:`);
      filtered.forEach(item => console.log(`  ❌ ${item.name} (${item.ingredientCategory})`));
    }
    foodItems.forEach(item => {
      console.log(`  📦 ${item.name} → cat: ${item.ingredientCategory} → loc: ${item.location} → ${item.autoExpireLabel}`);
    });

    setProcessedItems(foodItems);
    setInputMethod('review');

    // Background image fetch — fire-and-forget, never blocks UI
    foodItems.forEach(async (item) => {
      const url = await fetchProductImage(item.name);
      if (url) {
        setProcessedItems(prev =>
          prev.map(p => p.itemId === item.itemId ? { ...p, imageUrl: url } : p)
        );
      }
    });
  };

  const processSelectedFile = async (file: File) => {
    setProcessing(true);
    const t0 = performance.now();
    try {
      if (!isOpenAIConfigured()) {
        console.error('[Vision] VITE_OPENAI_API_KEY is missing or unavailable. Receipt scan requires GPT-4o Vision.');
        alert('AI receipt scan is not configured. Please set VITE_OPENAI_API_KEY and redeploy.');
        return;
      }

      console.log('🔍 [Pipeline] Trying GPT-4o Vision direct parse...');
      const tVisionStart = performance.now();
      const visionResult = await parseReceiptWithVision(file);
      console.log(`⏱️ [Pipeline] Vision parse: ${(performance.now() - tVisionStart).toFixed(0)}ms`);

      if (!visionResult || visionResult.items.length === 0) {
        console.error('[Vision] GPT-4o Vision could not parse this receipt image. OCR fallback is disabled.');
        alert('Could not parse this receipt with AI. Please retake the photo and try again.');
        return;
      }

      console.log(`✅ [Pipeline] Vision extracted ${visionResult.items.length} items`);
      await processNormalized(visionResult);
      console.log(`⏱️ [Pipeline] Full pipeline (Vision → save-ready): ${(performance.now() - t0).toFixed(0)}ms`);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };
  
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

  const processExtractedText = async (extractedText: string) => {
    setProcessing(true);
    const tStart = performance.now();
    try {
      const tNormStart = performance.now();
      const normalized = await normalizeInputText(extractedText);
      console.log(`⏱️ [Pipeline] normalizeInputText: ${(performance.now() - tNormStart).toFixed(0)}ms (${normalized.items.length} items extracted)`);
      console.log(`⏱️ [Pipeline] processExtractedText total: ${(performance.now() - tStart).toFixed(0)}ms`);
      await processNormalized(normalized);
    } catch (error) {
      console.error('Error processing input:', error);
      alert('Failed to process input. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualInput = (text: string) => processExtractedText(text);

  const handleAddNewItem = () => {
    // Navigate to form view to add a new item manually
    setInputMethod('form');
  };

  const handleCancelForm = () => {
    // If we have processedItems, go back to review mode instead of navigating away
    if (processedItems.length > 0) {
      setInputMethod('review');
    } else {
      navigate('/');
    }
  };

  const handleDeleteItems = (itemIds: string[]) => {
    setProcessedItems(prevItems => 
      prevItems.filter(item => !itemIds.includes(item.itemId))
    );
  };

  const handleItemUpdate = (updatedItem: Item) => {
    setProcessedItems(prevItems =>
      prevItems.map(item =>
        item.itemId === updatedItem.itemId ? updatedItem : item
      )
    );
  };

  const handleDateChange = (newDateISO: string) => {
    setReceiptDate(newDateISO);
    const dateYMD = newDateISO.includes('T') ? newDateISO.split('T')[0] : newDateISO;

    // Recompute lifecycle for each item with the new purchase date (instant, no API)
    const updatedItems = processedItems.map((item) => {
      const lifecycle = predictLifecycle({
        name: item.name,
        purchaseDate: dateYMD,
        storageLocation: item.location,
        ingredientCategory: item.ingredientCategory,
      });
      return {
        ...item,
        purchaseDate: newDateISO,
        autoExpirationDate: lifecycle.autoExpirationDate
          ? new Date(lifecycle.autoExpirationDate + 'T00:00:00').toISOString()
          : item.autoExpirationDate,
        autoExpireLabel: lifecycle.autoExpireLabel,
        autoExpireStatus: lifecycle.autoExpireStatus,
      };
    });

    setProcessedItems(updatedItems);
  };

  const handleSaveAll = async () => {
    if (processedItems.length === 0 || !user) return;
    
    setSaving(true);
    try {
      const purchaseDate = processedItems[0].purchaseDate;
      
      const receipt = await saveReceipt({
        userId: user.uid,
        sessionId: `session_${Date.now()}`,
        purchaseDate,
        createdAt: getCurrentDateISO(),
      });
      
      const itemsToSave = processedItems.map(item => ({
        ...item,
        userId: user.uid,
        receiptId: receipt.receiptId,
      }));
      
      const itemsWithoutIds = itemsToSave.map(({ itemId, ...rest }) => rest);
      await saveItems(itemsWithoutIds);

      // Mark recipes for refresh since new items were added
      markRecipesNeedRefresh();

      // After saving scanned items, move to inventory ("At Home") view
      navigate('/inventory');
    } catch (error) {
      console.error('Error saving items:', error);
      alert('Failed to save items. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!itemName.trim() || !user) {
      alert('Please enter an item name');
      return;
    }

    setProcessing(true);
    try {
      const purchaseDateISO = new Date(purchaseDate).toISOString();
      const expirationDateISO = expirationDate ? new Date(expirationDate).toISOString() : null;

      if (editItem) {
        // Update existing item — recompute lifecycle
        const purchaseDateYMD = purchaseDateISO.includes('T')
          ? purchaseDateISO.split('T')[0]
          : purchaseDateISO;
        const lifecycle = predictLifecycle({
          name: itemName,
          purchaseDate: purchaseDateYMD,
          storageLocation: locationValue,
        });
        const autoExpDate = lifecycle.autoExpirationDate
          ? new Date(lifecycle.autoExpirationDate + 'T00:00:00').toISOString()
          : editItem.autoExpirationDate;

        const { updateItem } = await import('../firebase/saveReceipt');
        await updateItem({
          ...editItem,
          name: itemName,
          quantity: quantity || null,
          category,
          location: locationValue,
          purchaseDate: purchaseDateISO,
          autoExpirationDate: autoExpDate,
          manualExpirationDate: expirationDateISO,
          expirationSource: expirationDateISO ? 'manual' : 'auto',
          ingredientCategory: lifecycle.ingredientCategory,
          categorySource: lifecycle.categorySource,
          predictionSource: lifecycle.predictionSource,
          autoExpireLabel: lifecycle.autoExpireLabel,
          autoExpireStatus: lifecycle.autoExpireStatus,
        });
        alert('Item updated successfully!');
      } else {
        // Create new item
        const receipt = await saveReceipt({
          userId: user.uid,
          sessionId: `session_${Date.now()}`,
          purchaseDate: purchaseDateISO,
          createdAt: getCurrentDateISO(),
        });

        // Compute lifecycle prediction for the new item
        const purchaseDateYMD = purchaseDateISO.includes('T')
          ? purchaseDateISO.split('T')[0]
          : purchaseDateISO;
        const lifecycle = predictLifecycle({
          name: itemName,
          purchaseDate: purchaseDateYMD,
          storageLocation: locationValue,
        });

        const autoExpDate = lifecycle.autoExpirationDate
          ? new Date(lifecycle.autoExpirationDate + 'T00:00:00').toISOString()
          : getCurrentDateISO();

        const itemToSave: Omit<Item, 'itemId'> = {
          userId: user.uid,
          receiptId: receipt.receiptId,
          name: itemName,
          quantity: quantity || null,
          category: category,
          location: locationValue,
          purchaseDate: purchaseDateISO,
          autoExpirationDate: expirationDateISO || autoExpDate,
          manualExpirationDate: expirationDateISO,
          expirationSource: expirationDateISO ? 'manual' : 'auto',
          // Lifecycle prediction fields
          ingredientCategory: lifecycle.ingredientCategory,
          categorySource: lifecycle.categorySource,
          predictionSource: lifecycle.predictionSource,
          autoExpireLabel: lifecycle.autoExpireLabel,
          autoExpireStatus: lifecycle.autoExpireStatus,
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

  // Show processing screen
  if (processing) {
    return <ProcessingScreen message="Processing Receipt..." />;
  }

  if (inputMethod === 'image') {
    // 'scan' opens the camera; 'upload' opens the photo library
    const useCamera = methodParam === 'scan';
    
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', padding: '20px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            marginBottom: '20px',
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: 'transparent',
            color: '#073d35',
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"Poppins", sans-serif',
          }}
        >
          ← Back
        </button>
        <ImageUpload onFileSelected={processSelectedFile} useCamera={useCamera} />
      </div>
    );
  }

  if (inputMethod === 'manual') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', padding: '20px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            marginBottom: '20px',
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: 'transparent',
            color: '#073d35',
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"Poppins", sans-serif',
          }}
        >
          ← Back
        </button>
        <ManualInput onTextSubmitted={handleManualInput} />
      </div>
    );
  }

  if (inputMethod === 'review') {
    return (
      <ScanResultPage
        items={processedItems}
        receiptDate={receiptDate}
        onItemUpdate={handleItemUpdate}
        onDeleteItems={handleDeleteItems}
        onSaveAll={handleSaveAll}
        onAddItem={handleAddNewItem}
        onDateChange={handleDateChange}
        isSaving={saving}
      />
    );
  }

  // Form view
  const categories: FoodCategory[] = ['Produce', 'Protein', 'Grains', 'Dairy', 'Snacks', 'Condiments', 'Beverages', 'Prepared', 'Canned', 'Frozen', 'Other'];
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
          onClick={handleCancelForm}
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
          Add an item
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
          disabled={processing || !itemName.trim()}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: (processing || !itemName.trim()) ? '#ccc' : '#073d35',
            color: '#f7f6ef',
            border: 'none',
            borderRadius: '23726400px',
            fontSize: '16px',
            fontWeight: '500',
            fontFamily: '"Poppins", sans-serif',
            cursor: (processing || !itemName.trim()) ? 'not-allowed' : 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {processing ? 'Saving...' : 'Add To Items'}
        </button>
        <button
          onClick={handleCancelForm}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: 'transparent',
            color: '#073d35',
            border: '1.5px solid #073d35',
            borderRadius: '23726400px',
            fontSize: '16px',
            fontFamily: '"Poppins", sans-serif',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
