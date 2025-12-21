import type { ScheduledHandler, Context } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getDb, events } from '@sport-sage/database';
import { eq, sql } from 'drizzle-orm';
import { launchBrowser, createPage } from '../utils/browser';
import { logger } from '../utils/logger';
import { LiveScoresOrchestrator } from '../scrapers/live-scores-orchestrator';
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
  // Use raw SQL for enum comparison (Data API compatibility)
  const liveEvents = await db
    .select()
    .from(events)
    .where(sql`${events.status}::text = 'live'`);

  if (liveEvents.length === 0) {
    logger.info('No live events, skipping sync');
    await tracker.complete();
    return;
  }

  logger.info(`Found ${liveEvents.length} live events`);

  let browser;

  try {
    browser = await launchBrowser();

    // Use multi-source orchestrator - tries free sources first!
    const orchestrator = new LiveScoresOrchestrator();

    // Get all external IDs (any source)
    const externalIds = liveEvents
      .flatMap((e) => [
        e.externalFlashscoreId,
        e.externalOddscheckerId,
      ])
      .filter((id): id is string => !!id);

    const result = await orchestrator.getLiveScores(browser, externalIds);
    const scores = result.scores;

    logger.info(`Sources used: ${result.sourcesUsed.join(', ') || 'none'}`);
    orchestrator.logSummary();

    let updated = 0;
    let finished = 0;

    for (const [externalId, score] of scores) {
      // Find event by any of its external IDs
      const event = liveEvents.find(
        (e) =>
          e.externalFlashscoreId === externalId ||
          e.externalOddscheckerId === externalId
      );
      if (!event) continue;

      try {
        // Update event
        await db
          .update(events)
          .set({
            homeScore: score.homeScore,
            awayScore: score.awayScore,
            period: score.period,
            minute: score.minute,
            status: score.isFinished ? 'finished' : 'live',
            updatedAt: new Date(),
          })
          .where(eq(events.id, event.id));

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
                  eventId: event.id,
                  externalId,
                  result: {
                    homeScore: score.homeScore,
                    awayScore: score.awayScore,
                  },
                }),
                MessageGroupId: event.id, // FIFO queue deduplication
              })
            );

            logger.info(`Queued event for settlement: ${event.id}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to update event: ${event.id}`, error);
      }
    }

    // Record stats for monitoring
    tracker.recordSportStats('all', {
      processed: liveEvents.length,
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
