/**
 * Backfill Teams Job
 *
 * One-time migration to create teams and link existing events.
 * This populates the teams table and sets home_team_id/away_team_id
 * on existing events that only have team names.
 */

import { events, findOrCreateTeam } from '@sport-sage/database';
import { sql, isNull, and, or } from 'drizzle-orm';
import { getDb } from '../database/client.js';
import { createJobLogger } from '../logger.js';

const logger = createJobLogger('backfill-teams');

export async function runBackfillTeams(): Promise<void> {
  logger.info('Starting team backfill');
  const startTime = Date.now();
  const db = getDb();

  let processed = 0;
  let teamsCreated = 0;
  let eventsUpdated = 0;
  let failed = 0;

  try {
    // Get all events that don't have team IDs but have team names
    const eventsToProcess = await db
      .select({
        id: events.id,
        homeTeamName: events.homeTeamName,
        awayTeamName: events.awayTeamName,
        homeTeamId: events.homeTeamId,
        awayTeamId: events.awayTeamId,
      })
      .from(events)
      .where(
        and(
          or(isNull(events.homeTeamId), isNull(events.awayTeamId)),
          sql`${events.homeTeamName} IS NOT NULL`,
          sql`${events.awayTeamName} IS NOT NULL`
        )
      );

    logger.info(`Found ${eventsToProcess.length} events to process`);

    // Track unique teams created
    const teamsMap = new Map<string, string>();

    for (const event of eventsToProcess) {
      processed++;

      if (!event.homeTeamName || !event.awayTeamName) {
        continue;
      }

      try {
        let homeTeamId = event.homeTeamId;
        let awayTeamId = event.awayTeamId;

        // Find or create home team if needed
        if (!homeTeamId) {
          const cacheKey = `home:${event.homeTeamName}`;
          if (teamsMap.has(cacheKey)) {
            homeTeamId = teamsMap.get(cacheKey)!;
          } else {
            homeTeamId = await findOrCreateTeam(db as any, event.homeTeamName, 'flashscore');
            teamsMap.set(cacheKey, homeTeamId);
            if (!teamsMap.has(`seen:${homeTeamId}`)) {
              teamsMap.set(`seen:${homeTeamId}`, '1');
              teamsCreated++;
            }
          }
        }

        // Find or create away team if needed
        if (!awayTeamId) {
          const cacheKey = `away:${event.awayTeamName}`;
          if (teamsMap.has(cacheKey)) {
            awayTeamId = teamsMap.get(cacheKey)!;
          } else {
            awayTeamId = await findOrCreateTeam(db as any, event.awayTeamName, 'flashscore');
            teamsMap.set(cacheKey, awayTeamId);
            if (!teamsMap.has(`seen:${awayTeamId}`)) {
              teamsMap.set(`seen:${awayTeamId}`, '1');
              teamsCreated++;
            }
          }
        }

        // Update the event with team IDs
        await db.execute(sql`
          UPDATE events
          SET home_team_id = ${homeTeamId}::uuid,
              away_team_id = ${awayTeamId}::uuid
          WHERE id = ${event.id}::uuid
        `);

        eventsUpdated++;

        // Log progress every 50 events
        if (processed % 50 === 0) {
          logger.info(`Progress: ${processed}/${eventsToProcess.length} events, ${teamsCreated} teams created`);
        }
      } catch (error) {
        failed++;
        logger.error(`Failed to process event ${event.id}`, { error, event });
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('Team backfill completed', {
      processed,
      eventsUpdated,
      teamsCreated,
      failed,
      durationMs,
    });
  } catch (error) {
    logger.error('Team backfill failed', { error });
    throw error;
  }
}
