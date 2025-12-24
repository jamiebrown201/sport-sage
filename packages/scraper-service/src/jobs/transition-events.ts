/**
 * Transition Events Job
 *
 * Transitions events from 'scheduled' to 'live' when their start time has passed.
 * This ensures sync-live-scores will pick them up for score tracking.
 *
 * Also handles auto-voiding predictions when events are cancelled/postponed.
 * Adapted from Lambda handler for VPS deployment.
 */

import { sql, eq, and } from 'drizzle-orm';
import { events, predictions, users, auditLog } from '@sport-sage/database';
import { getDb } from '../database/client.js';
import { createJobLogger } from '../logger.js';

const logger = createJobLogger('transition-events');

export async function runTransitionEvents(): Promise<void> {
  logger.info('Checking for events to transition to live');

  const db = getDb();
  const now = new Date();

  try {
    // Find scheduled events that should have started
    const scheduledPastStart = await db.execute(sql`
      SELECT id, home_team_name, away_team_name, start_time
      FROM events
      WHERE status::text = 'scheduled'
        AND start_time <= ${now.toISOString()}::timestamptz
    `);

    const eventsToTransition = scheduledPastStart.rows || [];

    if (eventsToTransition.length === 0) {
      logger.info('No events to transition');
      return;
    }

    logger.info(`Found ${eventsToTransition.length} events to transition to live`);

    let transitioned = 0;

    for (const event of eventsToTransition) {
      try {
        await db.execute(sql`
          UPDATE events
          SET status = 'live'::event_status,
              updated_at = NOW()
          WHERE id = ${(event as any).id}::uuid
        `);

        transitioned++;
        logger.info(
          `Transitioned to live: ${(event as any).home_team_name} vs ${(event as any).away_team_name}`
        );
      } catch (error) {
        logger.error(`Failed to transition event ${(event as any).id}`, { error });
      }
    }

    logger.info(`Transition completed: ${transitioned}/${eventsToTransition.length} events`);

    // Auto-void predictions for cancelled/postponed events
    await autoVoidCancelledEvents(db);
  } catch (error) {
    logger.error('Transition job failed', { error });
    throw error;
  }
}

/**
 * Auto-void predictions for cancelled or postponed events
 */
async function autoVoidCancelledEvents(db: any): Promise<void> {
  try {
    // Find cancelled/postponed events with pending predictions
    const cancelledEvents = await db.execute(sql`
      SELECT DISTINCT e.id, e.home_team_name, e.away_team_name, e.status
      FROM events e
      INNER JOIN predictions p ON p.event_id = e.id
      WHERE e.status::text IN ('cancelled', 'postponed')
        AND p.status::text = 'pending'
    `);

    const eventsToProcess = cancelledEvents.rows || [];

    if (eventsToProcess.length === 0) {
      return;
    }

    logger.info(`Found ${eventsToProcess.length} cancelled/postponed events with pending predictions`);

    for (const event of eventsToProcess) {
      const eventId = (event as any).id;
      const eventStatus = (event as any).status;

      // Get all pending predictions for this event
      const pendingPreds = await db
        .select({
          id: predictions.id,
          userId: predictions.userId,
          stake: predictions.stake,
        })
        .from(predictions)
        .where(and(
          eq(predictions.eventId, eventId),
          sql`${predictions.status}::text = 'pending'`
        ));

      let voidedCount = 0;
      let refundedTotal = 0;

      for (const pred of pendingPreds) {
        try {
          // Void the prediction
          await db
            .update(predictions)
            .set({
              status: 'void',
              settledAt: new Date(),
            })
            .where(eq(predictions.id, pred.id));

          // Refund the stake
          await db
            .update(users)
            .set({
              coins: sql`${users.coins} + ${pred.stake}`,
            })
            .where(eq(users.id, pred.userId));

          voidedCount++;
          refundedTotal += pred.stake;
        } catch (error) {
          logger.error(`Failed to void prediction ${pred.id}`, { error });
        }
      }

      // Log the action
      if (voidedCount > 0) {
        await db.insert(auditLog).values({
          tableName: 'events',
          recordId: eventId,
          action: 'void',
          oldValues: { pendingPredictions: pendingPreds.length },
          newValues: { voidedPredictions: voidedCount, refundedCoins: refundedTotal },
          reason: `Event ${eventStatus}: Auto-voided ${voidedCount} predictions, refunded ${refundedTotal} coins`,
          changedBy: null, // System action
        });

        logger.info(`Auto-voided predictions for ${(event as any).home_team_name} vs ${(event as any).away_team_name}`, {
          eventId,
          eventStatus,
          voidedCount,
          refundedTotal,
        });
      }
    }
  } catch (error) {
    logger.error('Auto-void cancelled events failed', { error });
    // Don't throw - this is a secondary operation
  }
}
