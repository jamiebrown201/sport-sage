import type { ScheduledHandler, Context } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getDb, events, sports } from '@sport-sage/database';
import { eq, sql } from 'drizzle-orm';
import { launchBrowser } from '../utils/browser';
import { logger } from '../utils/logger';
import { LiveScoresOrchestrator, type EventToMatch } from '../scrapers/live-scores-orchestrator';
import { RunTracker } from '../utils/run-tracker';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const SETTLEMENT_QUEUE_URL = process.env.SETTLEMENT_QUEUE_URL;

export const handler: ScheduledHandler = async (event, context: Context) => {
  logger.setContext({ job: 'sync-live-scores' });
  logger.info('Starting live scores sync');

  // Initialize run tracker for monitoring
  const tracker = new RunTracker('sync_live_scores', 'multi', context.awsRequestId);
  await tracker.start();

  const db = getDb();

  // First, check if there are any live events
  // Join with sports to get the sport slug for scraper matching
  // Use raw SQL for enum comparison (Data API compatibility)
  const liveEventsWithSport = await db
    .select({
      id: events.id,
      homeTeamName: events.homeTeamName,
      awayTeamName: events.awayTeamName,
      startTime: events.startTime,
      sportSlug: sports.slug,
    })
    .from(events)
    .innerJoin(sports, eq(events.sportId, sports.id))
    .where(sql`${events.status}::text = 'live'`);

  if (liveEventsWithSport.length === 0) {
    logger.info('No live events, skipping sync');
    await tracker.complete();
    return;
  }

  logger.info(`Found ${liveEventsWithSport.length} live events`);

  // Convert to EventToMatch format
  const eventsToMatch: EventToMatch[] = liveEventsWithSport
    .filter(e => e.homeTeamName && e.awayTeamName) // Must have team names
    .map(e => ({
      id: e.id,
      homeTeamName: e.homeTeamName!,
      awayTeamName: e.awayTeamName!,
      startTime: e.startTime,
      sportSlug: e.sportSlug,
    }));

  if (eventsToMatch.length === 0) {
    logger.warn('No events with team names, skipping sync');
    await tracker.complete();
    return;
  }

  logger.info(`${eventsToMatch.length} events have team names for matching`);

  let browser;

  try {
    browser = await launchBrowser();

    // Use multi-source orchestrator - matches by team names!
    const orchestrator = new LiveScoresOrchestrator();
    const result = await orchestrator.getLiveScores(browser, eventsToMatch);
    const scores = result.scores;

    logger.info(`Sources used: ${result.sourcesUsed.join(', ') || 'none'}`);
    orchestrator.logSummary();

    let updated = 0;
    let finished = 0;

    for (const [eventId, score] of scores) {
      try {
        // Update event using Drizzle ORM with sql.raw for enum
        // Data API requires explicit casting for PostgreSQL enums
        const newStatus = score.isFinished ? 'finished' : 'live';
        await db
          .update(events)
          .set({
            homeScore: score.homeScore,
            awayScore: score.awayScore,
            period: score.period,
            minute: score.minute ?? null,
            status: sql.raw(`'${newStatus}'::event_status`),
            updatedAt: new Date(),
          } as any)
          .where(eq(events.id, eventId));

        updated++;

        // If finished, queue for settlement
        if (score.isFinished) {
          finished++;

          if (SETTLEMENT_QUEUE_URL) {
            await sqs.send(
              new SendMessageCommand({
                QueueUrl: SETTLEMENT_QUEUE_URL,
                MessageBody: JSON.stringify({
                  type: 'event_finished',
                  eventId: eventId,
                  result: {
                    homeScore: score.homeScore,
                    awayScore: score.awayScore,
                  },
                }),
                MessageGroupId: eventId, // FIFO queue deduplication
              })
            );

            logger.info(`Queued event for settlement: ${eventId}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to update event: ${eventId}`, error);
      }
    }

    // Record stats for monitoring
    tracker.recordSportStats('all', {
      processed: liveEventsWithSport.length,
      updated,
    });

    await tracker.complete();
    logger.info('Live scores sync completed', { updated, finished });
  } catch (error) {
    await tracker.fail(error as Error);
    logger.error('Live scores sync failed', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    logger.clearContext();
  }
};
