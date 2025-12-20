import { z } from 'zod';

// =============================================================================
// SPORTS SCHEMAS
// =============================================================================

export const SportSlugSchema = z.enum([
  'football',
  'tennis',
  'darts',
  'cricket',
  'basketball',
  'american_football',
  'golf',
  'boxing',
  'mma',
  'f1',
  'horse_racing',
  'rugby',
  'ice_hockey',
  'baseball',
  'esports',
]);
export type SportSlug = z.infer<typeof SportSlugSchema>;

export const SportSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: SportSlugSchema,
  iconName: z.string(), // Icon library name instead of emoji
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type Sport = z.infer<typeof SportSchema>;

export const CompetitionSchema = z.object({
  id: z.string(),
  sportId: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  country: z.string().optional(),
  logoUrl: z.string().url().optional(),
  tier: z.enum(['tier1', 'tier2', 'tier3']).default('tier2'), // Premier League = tier1
  isActive: z.boolean().default(true),
});
export type Competition = z.infer<typeof CompetitionSchema>;

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  logoUrl: z.string().url().optional(),
  competitionIds: z.array(z.string()),
});
export type Team = z.infer<typeof TeamSchema>;

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  nationality: z.string().optional(),
  imageUrl: z.string().url().optional(),
  sportId: z.string(),
  ranking: z.number().int().optional(), // For tennis, darts rankings
});
export type Player = z.infer<typeof PlayerSchema>;
