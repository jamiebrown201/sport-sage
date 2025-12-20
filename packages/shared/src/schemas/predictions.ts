import { z } from 'zod';
import { EventSchema, OutcomeSchema } from './events';

// =============================================================================
// PREDICTIONS SCHEMAS
// =============================================================================

export const PredictionStatusSchema = z.enum(['pending', 'won', 'lost', 'void', 'cashout']);
export type PredictionStatus = z.infer<typeof PredictionStatusSchema>;

export const PredictionTypeSchema = z.enum(['single', 'accumulator']);
export type PredictionType = z.infer<typeof PredictionTypeSchema>;

// Single selection in an accumulator
export const PredictionSelectionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  event: EventSchema,
  marketId: z.string(),
  outcomeId: z.string(),
  outcome: OutcomeSchema,
  odds: z.number().positive(),
  status: PredictionStatusSchema,
  settledAt: z.string().datetime().optional(),
});
export type PredictionSelection = z.infer<typeof PredictionSelectionSchema>;

export const PredictionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: PredictionTypeSchema,

  // For single predictions
  eventId: z.string().optional(),
  event: EventSchema.optional(),
  outcomeId: z.string().optional(),
  outcome: OutcomeSchema.optional(),

  // For accumulators
  selections: z.array(PredictionSelectionSchema).optional(),

  stake: z.number().int().positive(),
  totalOdds: z.number().positive(), // Combined odds for accumulators
  potentialCoins: z.number().int(),
  potentialStars: z.number().int(),
  starsMultiplier: z.number().positive().default(1.0),

  status: PredictionStatusSchema,
  settledCoins: z.number().int().optional(), // Actual coins won
  settledStars: z.number().int().optional(), // Actual stars won
  settledAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Prediction = z.infer<typeof PredictionSchema>;

// Request schemas
export const PlacePredictionRequestSchema = z.object({
  type: PredictionTypeSchema,
  stake: z.number().int().positive().max(10000),

  // For single
  eventId: z.string().optional(),
  outcomeId: z.string().optional(),

  // For accumulator
  selections: z.array(z.object({
    eventId: z.string(),
    marketId: z.string(),
    outcomeId: z.string(),
  })).optional(),
}).refine(data => {
  if (data.type === 'single') {
    return data.eventId && data.outcomeId;
  }
  return data.selections && data.selections.length >= 2 && data.selections.length <= 10;
}, {
  message: 'Single predictions require eventId and outcomeId. Accumulators require 2-10 selections.',
});
export type PlacePredictionRequest = z.infer<typeof PlacePredictionRequestSchema>;

export const PredictionResponseSchema = z.object({
  prediction: PredictionSchema,
  newBalance: z.number().int(),
});
export type PredictionResponse = z.infer<typeof PredictionResponseSchema>;

// Prediction history filters
export const PredictionHistoryFilterSchema = z.object({
  status: PredictionStatusSchema.optional(),
  type: PredictionTypeSchema.optional(),
  sportSlug: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().default(1),
  pageSize: z.number().int().default(20),
});
export type PredictionHistoryFilter = z.infer<typeof PredictionHistoryFilterSchema>;
