import type { ScheduledHandler, Context } from 'aws-lambda';
import { getDb, sports, competitions } from '@sport-sage/database';
import { and, sql } from 'drizzle-orm';
import { launchBrowser, createPage } from '../utils/browser';
import { logger } from '../utils/logger';
import { FlashscoreFixturesScraper } from '../scrapers/flashscore/fixtures';
import { findOrCreateEvent, calculateDedupStats, type ScrapedFixture } from '../normalization/event-dedup';
import { RunTracker } from '../utils/run-tracker';

const SPORTS_TO_SYNC = ['football', 'tennis', 'basketball', 'darts', 'cricket'] as const;

export const handler: ScheduledHandler = async (event, context: Context) => {
  logger.setContext({ job: 'sync-fixtures' });
  logger.info('Starting fixtures sync');

  // Initialize run tracker for monitoring
  const tracker = new RunTracker('sync_fixtures', 'flashscore', context.awsRequestId);
  await tracker.start();

  let browser;

  try {
    browser = await launchBrowser();
    // Use proxy for Flashscore - blocked from AWS IPs
    const page = await createPage(browser, { useProxy: true });
    const scraper = new FlashscoreFixturesScraper(page);
    const db = getDb();

    for (const sportSlug of SPORTS_TO_SYNC) {
      logger.info(`Syncing fixtures for ${sportSlug}`);

      let sportCreated = 0;
      let sportUpdated = 0;
      let sportFailed = 0;

      // Get sport from DB - use raw SQL for enum comparison
      const sportResults = await db
        .select()
        .from(sports)
        .where(sql`${sports.slug}::text = ${sportSlug}`);
      const sport = sportResults[0];

      if (!sport) {
        logger.warn(`Sport not found: ${sportSlug}`);
        continue;
      }

      const fixtures = await scraper.getUpcomingFixtures(sportSlug, 7);
      logger.info(`Found ${fixtures.length} fixtures for ${sportSlug}`);

      // Build competition lookup for this sport
      const competitionCache = new Map<string, string>();

      const getCompetitionId = async (fixture: ScrapedFixture): Promise<string> => {
        const cached = competitionCache.get(fixture.competition);
        if (cached) return cached;

        // Find or create competition
        let competition = await db.query.competitions.findFirst({
          where: and(
            sql`${competitions.sportId} = ${sport.id}::uuid`,
            sql`${competitions.name} = ${fixture.competition}`
          ),
        });

        if (!competition) {
          const [newComp] = await db
            .insert(competitions)
            .values({
              sportId: sport.id,
              name: fixture.competition,
              externalFlashscoreId: fixture.competition,
            })
            .returning();
          competition = newComp;
        }

        competitionCache.set(fixture.competition, competition!.id);
        return competition!.id;
      };

      // Convert fixtures to ScrapedFixture format
      const scrapedFixtures: ScrapedFixture[] = fixtures.map(f => ({
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        competition: f.competition,
        startTime: f.startTime,
        externalId: f.externalId,
        source: 'flashscore',
      }));

      // Process each fixture with deduplication
      const dedupResults = new Map<string, { isNew: boolean; matchedSource?: string }>();

      for (const fixture of scrapedFixtures) {
        try {
          const competitionId = await getCompetitionId(fixture);
          const result = await findOrCreateEvent(fixture, sport.id, competitionId);

          const key = `${fixture.homeTeam}:${fixture.awayTeam}:${fixture.startTime.toISOString()}`;
          dedupResults.set(key, result);

          if (result.isNew) {
            sportCreated++;
          } else {
            sportUpdated++;
          }
        } catch (error) {
          sportFailed++;
          logger.error(`Failed to process fixture: ${fixture.homeTeam} vs ${fixture.awayTeam}`, error);
        }
      }

      // Log deduplication stats
      const stats = calculateDedupStats(dedupResults as any);
      logger.info(`Dedup stats for ${sportSlug}`, {
        total: stats.total,
        new: stats.new,
        deduplicated: stats.deduplicated,
        bySource: stats.bySource,
      });

      // Record stats for this sport
      tracker.recordSportStats(sportSlug, {
        processed: fixtures.length,
        created: sportCreated,
        updated: sportUpdated,
        failed: sportFailed,
      });

      logger.info(`Completed ${sportSlug}`, { created: sportCreated, updated: sportUpdated, failed: sportFailed });
    }

    await tracker.complete();
    logger.info('Fixtures sync completed');
  } catch (error) {
    await tracker.fail(error as Error);
    logger.error('Fixtures sync failed', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    logger.clearContext();
  }
};
