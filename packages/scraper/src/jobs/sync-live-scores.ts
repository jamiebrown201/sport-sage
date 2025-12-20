import type { ScheduledHandler } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getDb, events } from '@sport-sage/database';
import { eq, sql } from 'drizzle-orm';
import { launchBrowser, createPage } from '../utils/browser';
import { logger } from '../utils/logger';
import { FlashscoreLiveScoresScraper } from '../scrapers/flashscore/live-scores';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const SETTLEMENT_QUEUE_URL = process.env.SETTLEMENT_QUEUE_URL;

export const handler: ScheduledHandler = async (event) => {
  logger.setContext({ job: 'sync-live-scores' });
  logger.info('Starting live scores sync');

  const db = getDb();

  // First, check if there are any live events
  const liveEvents = await db.query.events.findMany({
    where: eq(events.status, 'live'),
  });

  if (liveEvents.length === 0) {
    logger.info('No live events, skipping sync');
    return;
  }

  logger.info(`Found ${liveEvents.length} live events`);

  let browser;

  try {
    browser = await launchBrowser();
    const page = await createPage(browser);
    const scraper = new FlashscoreLiveScoresScraper(page);

    // Get external IDs to fetch
    const externalIds = liveEvents
      .map((e) => e.externalFlashscoreId)
      .filter((id): id is string => !!id);

    const scores = await scraper.getLiveScores(externalIds);

    let updated = 0;
    let finished = 0;

    for (const [externalId, score] of scores) {
      const event = liveEvents.find((e) => e.externalFlashscoreId === externalId);
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

    logger.info('Live scores sync completed', { updated, finished });
  } catch (error) {
    logger.error('Live scores sync failed', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    logger.clearContext();
  }
};
