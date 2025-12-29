/**
 * Cleanup Stale Events Job
 *
 * Detects and marks stale "live" events as "finished".
 * Events are considered stale if they've been "live" for too long
 * based on their sport type (football: 3h, basketball: 3h, tennis: 5h, etc.)
 *
 * This prevents events from being stuck in "live" status forever
 * when the scraper can't find scores from external sources.
 */

import { events, sports } from '@sport-sage/database';
import { eq, sql, and, lt } from 'drizzle-orm';
import { getDb } from '../database/client.js';
import { createJobLogger } from '../logger.js';

const logger = createJobLogger('cleanup-stale-events');

// Maximum duration an event can be "live" before being force-finished
// Based on typical game durations + buffer
const MAX_LIVE_DURATION_HOURS: Record<string, number> = {
  football: 3,      // 90min + halftime + stoppage + buffer
  basketball: 3,    // 48min + quarters + overtime + buffer
  tennis: 6,        // Long matches can go 5+ hours
  hockey: 4,        // 60min + periods + overtime + buffer
  baseball: 5,      // Can be long, especially extra innings
  american_football: 5, // 4 quarters + halftime + commercials
  default: 4,       // Default fallback
};

export async function runCleanupStaleEvents(): Promise<void> {
  logger.info('Starting stale events cleanup');
  const startTime = Date.now();

  const db = getDb();

  try {
    // Get all live events with their sport info
    const liveEvents = await db
      .select({
        id: events.id,
        homeTeamName: events.homeTeamName,
        awayTeamName: events.awayTeamName,
        startTime: events.startTime,
        sportSlug: sports.slug,
        homeScore: events.homeScore,
        awayScore: events.awayScore,
        period: events.period,
      })
      .from(events)
      .innerJoin(sports, eq(events.sportId, sports.id))
      .where(sql`${events.status}::text = 'live'`);

    if (liveEvents.length === 0) {
      logger.info('No live events to check');
      return;
    }

    logger.info(`Checking ${liveEvents.length} live events for staleness`);

    const now = new Date();
    let cleanedUp = 0;

    for (const event of liveEvents) {
      const maxHours = MAX_LIVE_DURATION_HOURS[event.sportSlug] || MAX_LIVE_DURATION_HOURS.default;
      const maxAgeMs = maxHours * 60 * 60 * 1000;
      const eventAge = now.getTime() - new Date(event.startTime).getTime();
      if (eventAge > maxAgeMs) {
        // Event has been "live" for too long - mark as finished
        logger.warn('Marking stale event as finished', {
          eventId: event.id,
          homeTeam: event.homeTeamName,
          awayTeam: event.awayTeamName,
          startTime: event.startTime,
          ageHours: Math.round(eventAge / (60 * 60 * 1000) * 10) / 10,
          maxHours,
          sport: event.sportSlug,
        });

        await db
          .update(events)
          .set({
            status: sql.raw(`'finished'::event_status`),
            period: event.period || 'FT', // Keep existing period or set to FT
            updatedAt: new Date(),
          })
          .where(eq(events.id, event.id));

        cleanedUp++;
      }
    }

    logger.info('Stale events cleanup completed', {
      checked: liveEvents.length,
      cleanedUp,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Stale events cleanup failed', { error });
    throw error;
  }
}
