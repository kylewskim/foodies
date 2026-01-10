import { useState } from 'react';
import { ImageUpload } from './components/ImageUpload';
import { ManualInput } from './components/ManualInput';
import { ItemList } from './components/ItemList';
import type { Item, ProcessedItem } from './types';
import { normalizeInputText } from './llm/normalizeInputText';
import { classifyItems } from './llm/classifyItems';
import { estimateExpirationDays } from './llm/estimateExpirationDays';
import { saveReceipt, saveItems } from './firebase/saveReceipt';
import { getOrCreateSessionId } from './utils/session';
import { getCurrentDateISO, calculateExpirationDate } from './utils/dateHelpers';

type InputMethod = 'image' | 'manual' | null;

function App() {
  const [inputMethod, setInputMethod] = useState<InputMethod>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * Main processing pipeline
   * Handles both image OCR and manual text input
   */
  const processInput = async (rawText: string) => {
    setProcessing(true);
    try {
      // Step 1: Normalize input text
      const normalized = await normalizeInputText(rawText);
      
      // Step 2: Classify items
      const rawNames = normalized.items.map(item => item.raw_name);
      const classified = await classifyItems(rawNames);
      
      // Step 3: Estimate expiration for each item
      const processedItems: ProcessedItem[] = [];
      for (let i = 0; i < classified.length; i++) {
        const classifiedItem = classified[i];
        const normalizedItem = normalized.items[i];
        
        const expiration = await estimateExpirationDays(
          classifiedItem.normalized_name,
          classifiedItem.category
        );
        
        processedItems.push({
          raw_name: normalizedItem.raw_name,
          quantity: normalizedItem.quantity,
          normalized_name: classifiedItem.normalized_name,
          category: classifiedItem.category,
          is_food: classifiedItem.is_food,
          expiration_days: expiration.expiration_days,
          confidence: expiration.confidence,
        });
      }
      
      // Step 4: Convert to Item objects with dates
      const purchaseDate = normalized.purchase_date || getCurrentDateISO();
      const tempReceiptId = `temp_${Date.now()}`; // Temporary ID until saved
      
      const itemObjects: Item[] = processedItems.map((processed, index) => {
        const autoExpirationDate = calculateExpirationDate(
          purchaseDate,
          processed.expiration_days
        );
        
        return {
          itemId: `temp_${index}`,
          receiptId: tempReceiptId,
          name: processed.normalized_name,
          quantity: processed.quantity,
          category: processed.category,
          purchaseDate,
          autoExpirationDate,
          manualExpirationDate: null,
          expirationSource: 'auto',
        };
      });
      
      setItems(itemObjects);
    } catch (error) {
      console.error('Error processing input:', error);
      alert('Failed to process input. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Handle image upload (OCR text extraction)
   */
  const handleImageUpload = async (extractedText: string) => {
    await processInput(extractedText);
  };

  /**
   * Handle manual text input
   */
  const handleManualInput = async (text: string) => {
    await processInput(text);
  };

  /**
   * Update a single item (e.g., manual expiration date)
   */
  const handleItemUpdate = (updatedItem: Item) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.itemId === updatedItem.itemId ? updatedItem : item
      )
    );
  };

  /**
   * Save all items to Firestore
   */
  const handleSaveAll = async () => {
    if (items.length === 0) return;
    
    setSaving(true);
    try {
      const sessionId = getOrCreateSessionId();
      const purchaseDate = items[0].purchaseDate;
      
      // Save receipt first
      const receipt = await saveReceipt({
        sessionId,
        purchaseDate,
        createdAt: getCurrentDateISO(),
      });
      
      // Update items with real receipt ID and save
      const itemsToSave = items.map(item => ({
        ...item,
        receiptId: receipt.receiptId,
      }));
      
      // Remove temporary IDs
      const itemsWithoutIds = itemsToSave.map(({ itemId, ...rest }) => rest);
      
      await saveItems(itemsWithoutIds);
      
      alert('Successfully saved to Firestore!');
      
      // Reset for next input
      setItems([]);
      setInputMethod(null);
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      alert('Failed to save to Firestore. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Reset to choose input method again
   */
  const handleReset = () => {
    setInputMethod(null);
    setItems([]);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '36px', color: '#333', marginBottom: '10px' }}>
            🥗 Foodies - Food Tracker
          </h1>
          <p style={{ fontSize: '18px', color: '#666' }}>
            Track your groceries and never waste food again
          </p>
        </header>

        {inputMethod === null && (
          <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2 style={{ marginBottom: '30px', color: '#555' }}>Choose Input Method</h2>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setInputMethod('image')}
                style={{
                  padding: '20px 40px',
                  fontSize: '18px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  minWidth: '200px',
                }}
              >
                📷 Upload Receipt Image
              </button>
              <button
                onClick={() => setInputMethod('manual')}
                style={{
                  padding: '20px 40px',
                  fontSize: '18px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  minWidth: '200px',
                }}
              >
                ✍️ Manual Entry
              </button>
            </div>
          </div>
        )}

        {inputMethod === 'image' && items.length === 0 && (
          <div>
            <button
              onClick={handleReset}
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
          </div>
        )}

        {inputMethod === 'manual' && items.length === 0 && (
          <div>
            <button
              onClick={handleReset}
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
          </div>
        )}

        {processing && (
          <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h2 style={{ color: '#555' }}>Processing your items...</h2>
            <p style={{ color: '#777' }}>
              Normalizing text → Classifying items → Estimating expiration dates
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div>
            <button
              onClick={handleReset}
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
              ← Start Over
            </button>
            <ItemList
              items={items}
              onItemUpdate={handleItemUpdate}
              onSaveAll={handleSaveAll}
              isSaving={saving}
            />
          </div>
        )}

        <footer style={{ marginTop: '50px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
          <p>MVP - No authentication required. Session stored in localStorage.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
