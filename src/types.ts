// Core data models

export interface Session {
  sessionId: string;
}

export interface Receipt {
  receiptId: string;
  userId: string;  // User who owns this receipt
  sessionId: string;
  purchaseDate: string | null;
  createdAt: string;
}

// New category system matching design requirements
export type FoodCategory =
  | 'Produce'
  | 'Protein'
  | 'Grains'
  | 'Dairy'
  | 'Snacks'
  | 'Condiments'
  | 'Beverages'
  | 'Prepared';

// Storage location
export type StorageLocation = 'fridge' | 'freezer' | 'pantry';

export type ExpirationSource = 'auto' | 'manual';

export interface Item {
  itemId: string;
  userId: string;  // User who owns this item
  receiptId: string;
  name: string;
  quantity: string | null;
  category: FoodCategory;
  location: StorageLocation;
  purchaseDate: string;
  autoExpirationDate: string;
  manualExpirationDate: string | null;
  expirationSource: ExpirationSource;
}

// LLM function input/output types

export interface NormalizeInputTextOutput {
  purchase_date: string | null;
  items: Array<{
    raw_name: string;
    quantity: string | null;
  }>;
}

export interface ClassifyItemOutput {
  is_food: boolean;
  normalized_name: string;
  category: FoodCategory;
}

export interface EstimateExpirationDaysOutput {
  expiration_days: number;
  confidence: 'high' | 'medium' | 'low';
}

// Processing types

export interface ProcessedItem {
  raw_name: string;
  quantity: string | null;
  normalized_name: string;
  category: FoodCategory;
  is_food: boolean;
  expiration_days: number;
  confidence: 'high' | 'medium' | 'low';
}
