/**
 * Centralized Pricing Logic for AdVero
 * Ensures consistency between User Display, Payment Processing, and Admin Dashboard.
 */

export const PRICE_PER_SECOND_DAY = 0.1; // $0.10 per second-day unit

/**
 * Calculates the total price for an ad campaign.
 * Returns a number rounded to 2 decimal places to avoid floating point errors.
 * 
 * @param days Number of days the ad will run
 * @param durationSeconds Duration of the ad in seconds
 * @returns Total price in USD (e.g., 5.00)
 */
export const calculateAdPrice = (days: number, durationSeconds: number): number => {
  const rawPrice = days * durationSeconds * PRICE_PER_SECOND_DAY;
  // Round to 2 decimal places to match currency format exactly
  return Math.round(rawPrice * 100) / 100;
};

/**
 * Formats a price number to a currency string
 * @param price Price in USD
 * @returns Formatted string (e.g., "$5.00")
 */
export const formatPrice = (price: number): string => {
  return `$${price.toFixed(2)}`;
};
