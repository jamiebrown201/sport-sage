import type { SQSHandler, SQSEvent, SQSRecord } from 'aws-lambda';
import {
  getDb,
  events,
  outcomes,
  predictions,
  accumulatorSelections,
  users,
  userStats,
  transactions,
  activityFeed,
} from '@sport-sage/database';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

interface SettlementMessage {
  type: 'event_finished';
  eventId: string;
  externalId: string;
  result: {
    homeScore: number;
    awayScore: number;
  };
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  logger.setContext({ job: 'settle-predictions' });

  for (const record of event.Records) {
    await processRecord(record);
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  const message: SettlementMessage = JSON.parse(record.body);

  if (message.type !== 'event_finished') {
    logger.warn('Unknown message type', { type: message.type });
    return;
  }

  logger.info('Processing settlement', { eventId: message.eventId });

  const db = getDb();

  try {
    // Get event with markets and outcomes
    const event = await db.query.events.findFirst({
      where: eq(events.id, message.eventId),
      with: {
        markets: {
          with: { outcomes: true },
        },
      },
    });

    if (!event) {
      logger.error('Event not found', { eventId: message.eventId });
      return;
    }

    // Determine winners for each market
    for (const market of event.markets) {
      const winners = determineWinners(market, message.result, event);

      for (const outcome of market.outcomes) {
        const isWinner = winners.includes(outcome.id);
        await db
          .update(outcomes)
          .set({ isWinner })
          .where(eq(outcomes.id, outcome.id));
      }
    }

    // Get all pending predictions for this event
    const pendingPredictions = await db.query.predictions.findMany({
      where: and(
        eq(predictions.eventId, message.eventId),
        eq(predictions.status, 'pending')
      ),
      with: {
        outcome: true,
        user: true,
      },
    });

    logger.info(`Found ${pendingPredictions.length} predictions to settle`);

    // Settle each prediction
    for (const prediction of pendingPredictions) {
      await settleSinglePrediction(db, prediction, message.result);
    }

    // Handle accumulator selections
    await settleAccumulatorSelections(db, message.eventId);

    logger.info('Settlement completed', { eventId: message.eventId });
  } catch (error) {
    logger.error('Settlement failed', error, { eventId: message.eventId });
    throw error;
  } finally {
    logger.clearContext();
  }
}

function determineWinners(
  market: any,
  result: { homeScore: number; awayScore: number },
  event: any
): string[] {
  const winners: string[] = [];
  const { homeScore, awayScore } = result;

  switch (market.type) {
    case 'match_winner':
      // Find the winning outcome
      for (const outcome of market.outcomes) {
        const name = outcome.name.toLowerCase();
        if (homeScore > awayScore && (name.includes('home') || name === event.homeTeamName?.toLowerCase() || name === '1')) {
          winners.push(outcome.id);
        } else if (awayScore > homeScore && (name.includes('away') || name === event.awayTeamName?.toLowerCase() || name === '2')) {
          winners.push(outcome.id);
        } else if (homeScore === awayScore && (name.includes('draw') || name === 'x')) {
          winners.push(outcome.id);
        }
      }
      break;

    case 'both_teams_score':
      const btts = homeScore > 0 && awayScore > 0;
      for (const outcome of market.outcomes) {
        if ((btts && outcome.name.toLowerCase() === 'yes') ||
            (!btts && outcome.name.toLowerCase() === 'no')) {
          winners.push(outcome.id);
        }
      }
      break;

    case 'over_under_goals':
      const totalGoals = homeScore + awayScore;
      const line = parseFloat(market.line) || 2.5;
      for (const outcome of market.outcomes) {
        const name = outcome.name.toLowerCase();
        if ((name.includes('over') && totalGoals > line) ||
            (name.includes('under') && totalGoals < line)) {
          winners.push(outcome.id);
        }
      }
      break;

    // Add more market types as needed
  }

  return winners;
}

async function settleSinglePrediction(db: any, prediction: any, result: any): Promise<void> {
  const isWinner = prediction.outcome?.isWinner === true;
  const status = isWinner ? 'won' : 'lost';

  const settledCoins = isWinner ? prediction.potentialCoins : 0;
  const settledStars = isWinner ? prediction.potentialStars : 0;

  await db.transaction(async (tx: any) => {
    // Update prediction
    await tx
      .update(predictions)
      .set({
        status,
        settledCoins,
        settledStars,
        settledAt: new Date(),
      })
      .where(eq(predictions.id, prediction.id));

    if (isWinner) {
      // Credit user
      await tx
        .update(users)
        .set({
          coins: sql`coins + ${settledCoins}`,
          stars: sql`stars + ${settledStars}`,
        })
        .where(eq(users.id, prediction.userId));

      // Create transaction
      await tx.insert(transactions).values({
        userId: prediction.userId,
        type: 'prediction_win',
        currency: 'coins',
        amount: settledCoins,
        balanceAfter: 0, // Will be recalculated
        description: 'Prediction won',
        referenceId: prediction.id,
        referenceType: 'prediction',
      });

      // Update stats
      await tx
        .update(userStats)
        .set({
          totalWins: sql`total_wins + 1`,
          currentStreak: sql`current_streak + 1`,
          bestStreak: sql`GREATEST(best_streak, current_streak + 1)`,
          totalStarsEarned: sql`total_stars_earned + ${settledStars}`,
        })
        .where(eq(userStats.userId, prediction.userId));

      // Create activity feed entry
      await tx.insert(activityFeed).values({
        userId: prediction.userId,
        type: 'prediction_won',
        title: 'Won a prediction!',
        description: `Won ${settledCoins} coins`,
        predictionId: prediction.id,
        metadata: { coins: settledCoins, stars: settledStars },
      });
    } else {
      // Update stats for loss
      await tx
        .update(userStats)
        .set({
          totalLosses: sql`total_losses + 1`,
          currentStreak: 0,
        })
        .where(eq(userStats.userId, prediction.userId));
    }
  });

  logger.info(`Settled prediction: ${prediction.id}`, { status, settledCoins, settledStars });
}

async function settleAccumulatorSelections(db: any, eventId: string): Promise<void> {
  // Get all pending accumulator selections for this event
  const pendingSelections = await db.query.accumulatorSelections.findMany({
    where: and(
      eq(accumulatorSelections.eventId, eventId),
      eq(accumulatorSelections.status, 'pending')
    ),
    with: {
      outcome: true,
      prediction: {
        with: { selections: true },
      },
    },
  });

  for (const selection of pendingSelections) {
    const isWinner = selection.outcome?.isWinner === true;

    // Update selection status
    await db
      .update(accumulatorSelections)
      .set({
        status: isWinner ? 'won' : 'lost',
        settledAt: new Date(),
      })
      .where(eq(accumulatorSelections.id, selection.id));

    // Check if all selections in the accumulator are settled
    const allSelections = selection.prediction.selections;
    const allSettled = allSelections.every((s: any) =>
      s.id === selection.id ? true : s.status !== 'pending'
    );

    if (allSettled) {
      // Determine overall accumulator result
      const updatedSelections = allSelections.map((s: any) =>
        s.id === selection.id ? { ...s, status: isWinner ? 'won' : 'lost' } : s
      );

      const allWon = updatedSelections.every((s: any) => s.status === 'won');
      const anyLost = updatedSelections.some((s: any) => s.status === 'lost');

      let accStatus: 'won' | 'lost' | 'partial';
      if (allWon) {
        accStatus = 'won';
      } else if (anyLost) {
        accStatus = 'lost';
      } else {
        accStatus = 'partial';
      }

      // Settle the accumulator prediction
      await settleAccumulator(db, selection.prediction.id, accStatus);
    }
  }
}

async function settleAccumulator(
  db: any,
  predictionId: string,
  status: 'won' | 'lost' | 'partial'
): Promise<void> {
  const prediction = await db.query.predictions.findFirst({
    where: eq(predictions.id, predictionId),
    with: { user: true },
  });

  if (!prediction) return;

  const settledCoins = status === 'won' ? prediction.potentialCoins : 0;
  const settledStars = status === 'won' ? prediction.potentialStars : 0;

  await db.transaction(async (tx: any) => {
    await tx
      .update(predictions)
      .set({
        status,
        settledCoins,
        settledStars,
        settledAt: new Date(),
      })
      .where(eq(predictions.id, predictionId));

    if (status === 'won') {
      await tx
        .update(users)
        .set({
          coins: sql`coins + ${settledCoins}`,
          stars: sql`stars + ${settledStars}`,
        })
        .where(eq(users.id, prediction.userId));

      await tx.insert(transactions).values({
        userId: prediction.userId,
        type: 'prediction_win',
        currency: 'coins',
        amount: settledCoins,
        balanceAfter: 0,
        description: 'Accumulator won',
        referenceId: predictionId,
        referenceType: 'prediction',
      });

      await tx
        .update(userStats)
        .set({
          totalWins: sql`total_wins + 1`,
          totalAccumulatorsWon: sql`total_accumulators_won + 1`,
          currentStreak: sql`current_streak + 1`,
          bestStreak: sql`GREATEST(best_streak, current_streak + 1)`,
          totalStarsEarned: sql`total_stars_earned + ${settledStars}`,
        })
        .where(eq(userStats.userId, prediction.userId));

      await tx.insert(activityFeed).values({
        userId: prediction.userId,
        type: 'accumulator_won',
        title: 'Won an accumulator!',
        description: `Won ${settledCoins} coins`,
        predictionId,
        metadata: { coins: settledCoins, stars: settledStars },
      });
    } else {
      await tx
        .update(userStats)
        .set({
          totalLosses: sql`total_losses + 1`,
          currentStreak: 0,
        })
        .where(eq(userStats.userId, prediction.userId));
    }
  });

  logger.info(`Settled accumulator: ${predictionId}`, { status, settledCoins, settledStars });
}
