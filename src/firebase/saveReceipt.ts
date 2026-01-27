import { collection, addDoc, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
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
 * Get all receipts for a user
 * 
 * @param userId - User ID to query
 * @returns Array of receipts
 */
export async function getReceiptsByUser(userId: string): Promise<Receipt[]> {
  try {
    const q = query(
      collection(db, 'receipts'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const receipts: Receipt[] = [];
    
    querySnapshot.forEach((doc) => {
      receipts.push({
        receiptId: doc.id,
        ...doc.data(),
      } as Receipt);
    });
    
    // Sort by createdAt descending (client-side) to avoid needing a composite index
    return receipts.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
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
      const data = doc.data();
      items.push({
        itemId: doc.id,
        location: data.location || 'fridge', // Default location for old data
        ...data,
      } as Item);
    });
    
    return items;
  } catch (error) {
    console.error('Error getting items:', error);
    throw new Error('Failed to get items');
  }
}

/**
 * Get all items for a user
 * 
 * @param userId - User ID to query
 * @returns Array of items
 */
export async function getItemsByUser(userId: string): Promise<Item[]> {
  try {
    const q = query(
      collection(db, 'items'),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const items: Item[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        itemId: doc.id,
        location: data.location || 'fridge', // Default location for old data
        ...data,
      } as Item);
    });
    
    return items;
  } catch (error) {
    console.error('Error getting items by user:', error);
    throw new Error('Failed to get items by user');
  }
}

/**
 * Get items expiring soon (within specified days)
 * 
 * @param userId - User ID to query
 * @param days - Number of days to look ahead (default: 7)
 * @returns Array of items expiring soon
 */
export async function getItemsExpiringSoon(userId: string, days: number = 7): Promise<Item[]> {
  try {
    const allItems = await getItemsByUser(userId);
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);
    
    return allItems
      .map(item => ({
        ...item,
        location: item.location || 'fridge', // Default location for old data
      }))
      .filter(item => {
        const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
        const expDate = new Date(expirationDate);
        return expDate >= now && expDate <= futureDate;
      }).sort((a, b) => {
      const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
      const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
      return expA.getTime() - expB.getTime();
    });
  } catch (error) {
    console.error('Error getting items expiring soon:', error);
    throw new Error('Failed to get items expiring soon');
  }
}

/**
 * Get items by location
 * 
 * @param userId - User ID to query
 * @param location - Storage location to filter by
 * @returns Array of items in the specified location
 */
export async function getItemsByLocation(userId: string, location: 'fridge' | 'freezer' | 'pantry'): Promise<Item[]> {
  try {
    const allItems = await getItemsByUser(userId);
    return allItems
      .map(item => ({
        ...item,
        location: item.location || 'fridge', // Default location for old data
      }))
      .filter(item => item.location === location)
      .sort((a, b) => {
        const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
        const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
        return expA.getTime() - expB.getTime();
      });
  } catch (error) {
    console.error('Error getting items by location:', error);
    throw new Error('Failed to get items by location');
  }
}
