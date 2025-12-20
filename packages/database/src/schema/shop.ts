import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Enums
export const cosmeticCategoryEnum = pgEnum('cosmetic_category', [
  'avatar_frame',
  'background',
  'card_skin',
  'victory_animation',
  'username_color',
  'emote',
  'badge',
]);

export const cosmeticRarityEnum = pgEnum('cosmetic_rarity', [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]);

// Cosmetics table
export const cosmetics = pgTable(
  'cosmetics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    category: cosmeticCategoryEnum('category').notNull(),
    rarity: cosmeticRarityEnum('rarity').notNull().default('common'),
    priceStars: integer('price_stars'),
    priceGems: integer('price_gems'),
    priceUsd: numeric('price_usd', { precision: 8, scale: 2 }),
    imageUrl: varchar('image_url', { length: 512 }),
    animationUrl: varchar('animation_url', { length: 512 }),
    iconName: varchar('icon_name', { length: 50 }),
    colorValue: varchar('color_value', { length: 20 }), // For username colors
    isAvailable: boolean('is_available').notNull().default(true),
    isPremiumOnly: boolean('is_premium_only').notNull().default(false),
    isLimitedTime: boolean('is_limited_time').notNull().default(false),
    isExclusive: boolean('is_exclusive').notNull().default(false),
    limitPerUser: integer('limit_per_user'),
    availableUntil: timestamp('available_until', { withTimezone: true }),
    appleProductId: varchar('apple_product_id', { length: 100 }),
    googleProductId: varchar('google_product_id', { length: 100 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cosmetics_category_idx').on(table.category),
    index('cosmetics_available_idx').on(table.isAvailable),
    index('cosmetics_rarity_idx').on(table.rarity),
  ]
);

// User cosmetics (purchased items)
export const userCosmetics = pgTable(
  'user_cosmetics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cosmeticId: uuid('cosmetic_id')
      .notNull()
      .references(() => cosmetics.id, { onDelete: 'cascade' }),
    currencyUsed: varchar('currency_used', { length: 20 }).notNull(), // 'stars', 'gems', 'usd', 'earned'
    pricePaid: integer('price_paid').notNull().default(0),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('user_cosmetics_user_id_idx').on(table.userId),
    index('user_cosmetics_cosmetic_id_idx').on(table.cosmeticId),
  ]
);

// User inventory (equipped items and consumables)
export const userInventory = pgTable('user_inventory', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  equippedAvatarFrameId: uuid('equipped_avatar_frame_id').references(() => cosmetics.id),
  equippedBackgroundId: uuid('equipped_background_id').references(() => cosmetics.id),
  equippedCardSkinId: uuid('equipped_card_skin_id').references(() => cosmetics.id),
  equippedBadgeId: uuid('equipped_badge_id').references(() => cosmetics.id),
  equippedVictoryAnimationId: uuid('equipped_victory_animation_id').references(() => cosmetics.id),
  equippedUsernameColorId: uuid('equipped_username_color_id').references(() => cosmetics.id),
  streakShields: integer('streak_shields').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Gem packs for purchase
export const gemPacks = pgTable('gem_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  gems: integer('gems').notNull(),
  bonusPercent: integer('bonus_percent').notNull().default(0),
  priceGbp: numeric('price_gbp', { precision: 8, scale: 2 }).notNull(),
  priceUsd: numeric('price_usd', { precision: 8, scale: 2 }).notNull(),
  appleProductId: varchar('apple_product_id', { length: 100 }),
  googleProductId: varchar('google_product_id', { length: 100 }),
  isPopular: boolean('is_popular').notNull().default(false),
  isBestValue: boolean('is_best_value').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

// Relations
export const cosmeticsRelations = relations(cosmetics, ({ many }) => ({
  userCosmetics: many(userCosmetics),
}));

export const userCosmeticsRelations = relations(userCosmetics, ({ one }) => ({
  user: one(users, {
    fields: [userCosmetics.userId],
    references: [users.id],
  }),
  cosmetic: one(cosmetics, {
    fields: [userCosmetics.cosmeticId],
    references: [cosmetics.id],
  }),
}));

export const userInventoryRelations = relations(userInventory, ({ one }) => ({
  user: one(users, {
    fields: [userInventory.userId],
    references: [users.id],
  }),
  avatarFrame: one(cosmetics, {
    fields: [userInventory.equippedAvatarFrameId],
    references: [cosmetics.id],
    relationName: 'equippedAvatarFrame',
  }),
  background: one(cosmetics, {
    fields: [userInventory.equippedBackgroundId],
    references: [cosmetics.id],
    relationName: 'equippedBackground',
  }),
  cardSkin: one(cosmetics, {
    fields: [userInventory.equippedCardSkinId],
    references: [cosmetics.id],
    relationName: 'equippedCardSkin',
  }),
  badge: one(cosmetics, {
    fields: [userInventory.equippedBadgeId],
    references: [cosmetics.id],
    relationName: 'equippedBadge',
  }),
  victoryAnimation: one(cosmetics, {
    fields: [userInventory.equippedVictoryAnimationId],
    references: [cosmetics.id],
    relationName: 'equippedVictoryAnimation',
  }),
  usernameColor: one(cosmetics, {
    fields: [userInventory.equippedUsernameColorId],
    references: [cosmetics.id],
    relationName: 'equippedUsernameColor',
  }),
}));

// Type exports
export type Cosmetic = typeof cosmetics.$inferSelect;
export type NewCosmetic = typeof cosmetics.$inferInsert;
export type UserCosmetic = typeof userCosmetics.$inferSelect;
export type NewUserCosmetic = typeof userCosmetics.$inferInsert;
export type UserInventory = typeof userInventory.$inferSelect;
export type NewUserInventory = typeof userInventory.$inferInsert;
export type GemPack = typeof gemPacks.$inferSelect;
export type NewGemPack = typeof gemPacks.$inferInsert;

// Constants for streak shields
export const STREAK_SHIELD_PACKS = {
  single: { shields: 1, price: 25 },
  triple: { shields: 3, price: 60 },
  weekly: { shields: 7, price: 120 },
} as const;
