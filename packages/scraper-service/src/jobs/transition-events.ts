/**
 * Transition Events Job
 *
 * Transitions events from 'scheduled' to 'live' when their start time has passed.
 * This ensures sync-live-scores will pick them up for score tracking.
 * Adapted from Lambda handler for VPS deployment.
 */

import { sql } from 'drizzle-orm';
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
  } catch (error) {
    logger.error('Transition job failed', { error });
    throw error;
  }
}
