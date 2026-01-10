// Core data models

export interface Session {
  sessionId: string;
}

export interface Receipt {
  receiptId: string;
  sessionId: string;
  purchaseDate: string | null;
  createdAt: string;
}

export type FoodCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'bakery'
  | 'pantry'
  | 'frozen'
  | 'snack'
  | 'beverage'
  | 'non-food'
  | 'unknown';

export type ExpirationSource = 'auto' | 'manual';

export interface Item {
  itemId: string;
  receiptId: string;
  name: string;
  quantity: string | null;
  category: FoodCategory;
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
