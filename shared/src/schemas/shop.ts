import { z } from 'zod';

// =============================================================================
// SHOP & IAP SCHEMAS
// =============================================================================

export const ShopItemCategorySchema = z.enum([
  'gems_pack',
  'subscription',
  'avatar',
  'badge',
  'coin_boost',
  'star_multiplier',
  'special_offer',
]);
export type ShopItemCategory = z.infer<typeof ShopItemCategorySchema>;

export const ShopItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: ShopItemCategorySchema,

  // Pricing - at least one should be set
  priceGems: z.number().int().min(0).optional(),
  priceUSD: z.number().positive().optional(),

  // What you get
  gemsAmount: z.number().int().optional(), // For gem packs
  coinsAmount: z.number().int().optional(),
  starsMultiplier: z.number().positive().optional(),
  durationDays: z.number().int().positive().optional(), // For subscriptions/boosts

  // Display
  imageUrl: z.string().url().optional(),
  iconName: z.string().optional(),
  badgeText: z.string().optional(), // "BEST VALUE", "NEW", etc.
  originalPriceUSD: z.number().positive().optional(), // For showing discounts

  // Availability
  isAvailable: z.boolean().default(true),
  isPremiumOnly: z.boolean().default(false),
  limitPerUser: z.number().int().positive().optional(),
  availableUntil: z.string().datetime().optional(),

  // IAP
  appleProductId: z.string().optional(),
  googleProductId: z.string().optional(),
  sortOrder: z.number().int().default(0),
});
export type ShopItem = z.infer<typeof ShopItemSchema>;

export const PurchaseRequestSchema = z.object({
  itemId: z.string(),
  paymentMethod: z.enum(['gems', 'apple_iap', 'google_iap']),
  receiptData: z.string().optional(), // For IAP validation
});
export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>;

export const PurchaseResponseSchema = z.object({
  success: z.boolean(),
  transactionId: z.string().optional(),
  newGemsBalance: z.number().int().optional(),
  newCoinsBalance: z.number().int().optional(),
  newStarsBalance: z.number().int().optional(),
  unlockedItemId: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type PurchaseResponse = z.infer<typeof PurchaseResponseSchema>;

// User's inventory of purchased items
export const UserInventoryItemSchema = z.object({
  itemId: z.string(),
  item: ShopItemSchema,
  purchasedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});
export type UserInventoryItem = z.infer<typeof UserInventoryItemSchema>;

export const GemPackSchema = z.object({
  id: z.string(),
  gems: z.number().int().positive(),
  priceUSD: z.number().positive(),
  bonusGems: z.number().int().min(0).default(0),
  badgeText: z.string().optional(),
  appleProductId: z.string(),
  googleProductId: z.string(),
});
export type GemPack = z.infer<typeof GemPackSchema>;
