import type { ScheduledHandler } from 'aws-lambda';
import { getDb, events, markets, sports, competitions } from '@sport-sage/database';
import { eq, and, sql } from 'drizzle-orm';
import { launchBrowser, createPage } from '../utils/browser';
import { logger } from '../utils/logger';
import { FlashscoreFixturesScraper } from '../scrapers/flashscore/fixtures';
import { findOrCreateTeam } from '../normalization/team-names';

const SPORTS_TO_SYNC = ['football', 'tennis', 'basketball', 'darts', 'cricket'];

export const handler: ScheduledHandler = async (event) => {
  logger.setContext({ job: 'sync-fixtures' });
  logger.info('Starting fixtures sync');

  let browser;

  try {
    browser = await launchBrowser();
    const page = await createPage(browser);
    const scraper = new FlashscoreFixturesScraper(page);
    const db = getDb();

    let totalCreated = 0;
    let totalUpdated = 0;

    for (const sportSlug of SPORTS_TO_SYNC) {
      logger.info(`Syncing fixtures for ${sportSlug}`);

      // Get sport from DB
      const sport = await db.query.sports.findFirst({
        where: eq(sports.slug, sportSlug as any),
      });

      if (!sport) {
        logger.warn(`Sport not found: ${sportSlug}`);
        continue;
      }

      const fixtures = await scraper.getUpcomingFixtures(sportSlug, 7);
      logger.info(`Found ${fixtures.length} fixtures for ${sportSlug}`);

      for (const fixture of fixtures) {
        try {
          // Find or create competition
          let competition = await db.query.competitions.findFirst({
            where: and(
              eq(competitions.sportId, sport.id),
              eq(competitions.name, fixture.competition)
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

          // Find or create teams
          const homeTeamId = await findOrCreateTeam(fixture.homeTeam, 'flashscore');
          const awayTeamId = await findOrCreateTeam(fixture.awayTeam, 'flashscore');

          // Check if event exists
          const existingEvent = await db.query.events.findFirst({
            where: eq(events.externalFlashscoreId, fixture.externalId),
          });

          if (existingEvent) {
            // Update if start time changed
            if (existingEvent.startTime.getTime() !== fixture.startTime.getTime()) {
              await db
                .update(events)
                .set({
                  startTime: fixture.startTime,
                  updatedAt: new Date(),
                })
                .where(eq(events.id, existingEvent.id));
              totalUpdated++;
            }
          } else {
            // Create new event
            const [newEvent] = await db
              .insert(events)
              .values({
                sportId: sport.id,
                competitionId: competition!.id,
                competitionName: fixture.competition,
                homeTeamId,
                awayTeamId,
                homeTeamName: fixture.homeTeam,
                awayTeamName: fixture.awayTeam,
                startTime: fixture.startTime,
                status: 'scheduled',
                externalFlashscoreId: fixture.externalId,
              })
              .returning();

            // Create default match_winner market
            await db.insert(markets).values({
              eventId: newEvent.id,
              type: 'match_winner',
              name: 'Match Result',
              isMainMarket: true,
            });

            totalCreated++;
          }
        } catch (error) {
          logger.error(`Failed to process fixture: ${fixture.homeTeam} vs ${fixture.awayTeam}`, error);
        }
      }
    }

    logger.info('Fixtures sync completed', { created: totalCreated, updated: totalUpdated });
  } catch (error) {
    logger.error('Fixtures sync failed', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    logger.clearContext();
  }
};
