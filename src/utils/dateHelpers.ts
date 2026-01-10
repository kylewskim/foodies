/**
 * Get current date as ISO string
 */
export function getCurrentDateISO(): string {
  return new Date().toISOString();
}

/**
 * Calculate expiration date from purchase date and days
 */
export function calculateExpirationDate(purchaseDate: string, daysUntilExpiration: number): string {
  const date = new Date(purchaseDate);
  date.setDate(date.getDate() + daysUntilExpiration);
  return date.toISOString();
}

/**
 * Format ISO date string to readable format (YYYY-MM-DD)
 */
export function formatDateForDisplay(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().split('T')[0];
}

/**
 * Format date for input field (YYYY-MM-DD)
 */
export function formatDateForInput(isoString: string): string {
  return formatDateForDisplay(isoString);
}

/**
 * Parse date input value to ISO string
 */
export function parseDateInput(dateString: string): string {
  return new Date(dateString).toISOString();
}

/**
 * Check if a date string is valid
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Get days until expiration (positive = future, negative = expired)
 */
export function getDaysUntilExpiration(expirationDate: string): number {
  const now = new Date();
  const expDate = new Date(expirationDate);
  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
