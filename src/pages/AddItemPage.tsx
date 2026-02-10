import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ImageUpload } from '../components/ImageUpload';
import { ManualInput } from '../components/ManualInput';
import { ProcessingScreen } from '../components/ProcessingScreen';
import { ScanResultPage } from '../components/ScanResultPage';
import type { Item, StorageLocation, FoodCategory } from '../types';
import { saveReceipt, saveItems } from '../firebase/saveReceipt';
import { getCurrentDateISO, calculateExpirationDate } from '../utils/dateHelpers';
import { normalizeInputText } from '../llm/normalizeInputText';
import { classifyAndEstimate } from '../llm/classifyAndEstimate';
import { markRecipesNeedRefresh } from '../firebase/userRecipes';

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
  const [defaultLocation] = useState<StorageLocation>('fridge');
  const [autoProcessStarted, setAutoProcessStarted] = useState(false);
  const [receiptDate, setReceiptDate] = useState<string | undefined>(undefined);
  const [cachedExpirations, setCachedExpirations] = useState<{ expiration_days: number; confidence: 'high' | 'medium' | 'low' }[]>([]);

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

  const processSelectedFile = async (file: File) => {
    setProcessing(true);
    try {
      // Import OCR functions
      const { extractTextWithGoogleVision, isGoogleVisionConfigured } = await import('../utils/googleVisionOCR');
      const Tesseract = (await import('tesseract.js')).default;
      
      let extractedText: string;
      
      if (isGoogleVisionConfigured()) {
        try {
          extractedText = await extractTextWithGoogleVision(file);
        } catch (googleError) {
          console.warn('Google Vision API failed, falling back to Tesseract:', googleError);
          const result = await Tesseract.recognize(file, 'eng+kor');
          extractedText = result.data.text;
        }
      } else {
        const result = await Tesseract.recognize(file, 'eng+kor');
        extractedText = result.data.text;
      }
      
      if (!extractedText.trim()) {
        alert('Could not extract text from image. Please try again.');
        setProcessing(false);
        return;
      }
      
      // Process the extracted text
      await handleImageUpload(extractedText);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Failed to process image. Please try again.');
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
    try {
      const normalized = await normalizeInputText(extractedText);
      const rawNames = normalized.items.map(item => item.raw_name);

      // Classify items and estimate expiration days in a single API call
      const results = await classifyAndEstimate(rawNames);

      const purchaseDateISO = normalized.purchase_date || getCurrentDateISO();
      const tempReceiptId = `temp_${Date.now()}`;
      setReceiptDate(purchaseDateISO);

      // Cache expirations so date changes don't need API calls
      setCachedExpirations(results.map(r => ({
        expiration_days: r.expiration_days,
        confidence: r.confidence,
      })));

      const items: Item[] = results.map((result, i) => ({
        itemId: `temp_${i}_${Date.now()}`,
        userId: user?.uid || '',
        receiptId: tempReceiptId,
        name: result.normalized_name,
        quantity: normalized.items[i].quantity,
        category: result.category,
        location: defaultLocation,
        purchaseDate: purchaseDateISO,
        autoExpirationDate: calculateExpirationDate(purchaseDateISO, result.expiration_days),
        manualExpirationDate: null,
        expirationSource: 'auto' as const,
      }));

      setProcessedItems(items);
      setInputMethod('review');
    } catch (error) {
      console.error('Error processing input:', error);
      alert('Failed to process input. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleImageUpload = (extractedText: string) => processExtractedText(extractedText);
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

    // Use cached expiration days — no API call needed, just recalculate dates
    const updatedItems = processedItems.map((item, i) => ({
      ...item,
      purchaseDate: newDateISO,
      autoExpirationDate: calculateExpirationDate(
        newDateISO,
        cachedExpirations[i]?.expiration_days ?? 7
      ),
    }));

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

      // Navigate to home page to show updated inventory
      navigate('/');
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
          userId: user.uid,
          sessionId: `session_${Date.now()}`,
          purchaseDate: purchaseDateISO,
          createdAt: getCurrentDateISO(),
        });

        const itemToSave: Omit<Item, 'itemId'> = {
          userId: user.uid,
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

  // Show processing screen
  if (processing) {
    return <ProcessingScreen message="Processing Receipt..." />;
  }

  if (inputMethod === 'image') {
    // methodParam이 'scan'이면 카메라, 'upload'면 앨범
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
        <ImageUpload onTextExtracted={handleImageUpload} useCamera={useCamera} />
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
