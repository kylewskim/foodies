import { collection, addDoc, doc, setDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { Receipt, Item } from '../types';

/**
 * Save a receipt to Firestore
 * 
 * @param receipt - Receipt object to save
 * @returns The saved receipt with ID
 */
export async function saveReceipt(receipt: Omit<Receipt, 'receiptId'>): Promise<Receipt> {
  try {
    const docRef = await addDoc(collection(db, 'receipts'), receipt);
    
    return {
      ...receipt,
      receiptId: docRef.id,
    };
  } catch (error) {
    console.error('Error saving receipt:', error);
    throw new Error('Failed to save receipt');
  }
}

/**
 * Save an item to Firestore
 * 
 * @param item - Item object to save
 * @returns The saved item with ID
 */
export async function saveItem(item: Omit<Item, 'itemId'>): Promise<Item> {
  try {
    const docRef = await addDoc(collection(db, 'items'), item);
    
    return {
      ...item,
      itemId: docRef.id,
    };
  } catch (error) {
    console.error('Error saving item:', error);
    throw new Error('Failed to save item');
  }
}

/**
 * Save multiple items to Firestore
 * 
 * @param items - Array of items to save
 * @returns Array of saved items with IDs
 */
export async function saveItems(items: Omit<Item, 'itemId'>[]): Promise<Item[]> {
  try {
    const savedItems = await Promise.all(
      items.map(item => saveItem(item))
    );
    return savedItems;
  } catch (error) {
    console.error('Error saving items:', error);
    throw new Error('Failed to save items');
  }
}

/**
 * Update an existing item in Firestore
 * 
 * @param item - Item with updated data
 */
export async function updateItem(item: Item): Promise<void> {
  try {
    const itemRef = doc(db, 'items', item.itemId);
    await setDoc(itemRef, item);
  } catch (error) {
    console.error('Error updating item:', error);
    throw new Error('Failed to update item');
  }
}

/**
 * Get all receipts for a session
 * 
 * @param sessionId - Session ID to query
 * @returns Array of receipts
 */
export async function getReceiptsBySession(sessionId: string): Promise<Receipt[]> {
  try {
    const q = query(
      collection(db, 'receipts'),
      where('sessionId', '==', sessionId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const receipts: Receipt[] = [];
    
    querySnapshot.forEach((doc) => {
      receipts.push({
        receiptId: doc.id,
        ...doc.data(),
      } as Receipt);
    });
    
    return receipts;
  } catch (error) {
    console.error('Error getting receipts:', error);
    throw new Error('Failed to get receipts');
  }
}

/**
 * Get all items for a receipt
 * 
 * @param receiptId - Receipt ID to query
 * @returns Array of items
 */
export async function getItemsByReceipt(receiptId: string): Promise<Item[]> {
  try {
    const q = query(
      collection(db, 'items'),
      where('receiptId', '==', receiptId)
    );
    
    const querySnapshot = await getDocs(q);
    const items: Item[] = [];
    
    querySnapshot.forEach((doc) => {
      items.push({
        itemId: doc.id,
        ...doc.data(),
      } as Item);
    });
    
    return items;
  } catch (error) {
    console.error('Error getting items:', error);
    throw new Error('Failed to get items');
  }
}
