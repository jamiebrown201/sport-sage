import { z } from 'zod';
import { SportSchema } from './sports';

// =============================================================================
// EVENTS & MARKETS SCHEMAS
// =============================================================================

export const EventStatusSchema = z.enum(['scheduled', 'live', 'finished', 'cancelled', 'postponed']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const MarketTypeSchema = z.enum([
  'match_winner',
  'double_chance',
  'both_teams_score',
  'over_under_goals',
  'over_under_points',
  'correct_score',
  'first_scorer',
  'handicap',
  'set_winner',
  'game_winner',
  'frame_winner',
  'to_qualify',
]);
export type MarketType = z.infer<typeof MarketTypeSchema>;

export const OutcomeSchema = z.object({
  id: z.string(),
  name: z.string(),
  odds: z.number().positive(),
  isWinner: z.boolean().optional(),
  isSuspended: z.boolean().default(false),
  previousOdds: z.number().positive().optional(), // For showing odds movement
});
export type Outcome = z.infer<typeof OutcomeSchema>;

export const MarketSchema = z.object({
  id: z.string(),
  type: MarketTypeSchema,
  name: z.string().optional(), // e.g., "Over/Under 2.5 Goals"
  line: z.number().optional(), // e.g., 2.5 for over/under
  outcomes: z.array(OutcomeSchema),
  isSuspended: z.boolean().default(false),
  isMainMarket: z.boolean().default(false),
});
export type Market = z.infer<typeof MarketSchema>;

export const SponsoredEventSchema = z.object({
  id: z.string(),
  sponsorName: z.string(),
  sponsorLogoUrl: z.string().url(),
  title: z.string(),
  description: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  prizeDescription: z.string(),
  brandingColor: z.string(),
  bonusStarsMultiplier: z.number().positive().default(1.5),
});
export type SponsoredEvent = z.infer<typeof SponsoredEventSchema>;

export const EventSchema = z.object({
  id: z.string(),
  sport: SportSchema,
  competitionId: z.string(),
  competition: z.string(), // Denormalized for convenience
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  homeTeamId: z.string().optional(),
  awayTeamId: z.string().optional(),
  player1: z.string().optional(),
  player2: z.string().optional(),
  player1Id: z.string().optional(),
  player2Id: z.string().optional(),
  startTime: z.string().datetime(),
  status: EventStatusSchema,
  homeScore: z.number().int().optional(),
  awayScore: z.number().int().optional(),
  period: z.string().optional(), // "1st Half", "2nd Set", etc.
  minute: z.number().int().optional(), // For live football
  markets: z.array(MarketSchema),
  sponsoredEvent: SponsoredEventSchema.optional(),
  isFeatured: z.boolean().default(false),
  viewCount: z.number().int().default(0),
  predictionCount: z.number().int().default(0),
});
export type Event = z.infer<typeof EventSchema>;

// API Response schemas
export const EventsListResponseSchema = z.object({
  events: z.array(EventSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type EventsListResponse = z.infer<typeof EventsListResponseSchema>;

export const EventsFilterSchema = z.object({
  sportSlug: z.string().optional(),
  competitionId: z.string().optional(),
  status: EventStatusSchema.optional(),
  startDateFrom: z.string().datetime().optional(),
  startDateTo: z.string().datetime().optional(),
  isFeatured: z.boolean().optional(),
  page: z.number().int().default(1),
  pageSize: z.number().int().default(20),
});
export type EventsFilter = z.infer<typeof EventsFilterSchema>;
