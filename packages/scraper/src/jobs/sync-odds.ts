import type { ScheduledHandler } from 'aws-lambda';
import { getDb, events, markets, outcomes } from '@sport-sage/database';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { launchBrowser, createPage } from '../utils/browser';
import { logger } from '../utils/logger';
import { OddscheckerScraper } from '../scrapers/oddschecker/odds';
import { normalizeTeamName } from '../normalization/team-names';

export const handler: ScheduledHandler = async (event) => {
  logger.setContext({ job: 'sync-odds' });
  logger.info('Starting odds sync');

  const db = getDb();

  // Get events starting within 24 hours
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingEvents = await db.query.events.findMany({
    where: and(
      eq(events.status, 'scheduled'),
      gte(events.startTime, now),
      lte(events.startTime, tomorrow)
    ),
    with: {
      markets: {
        with: { outcomes: true },
      },
    },
  });

  if (upcomingEvents.length === 0) {
    logger.info('No upcoming events to sync odds for');
    return;
  }

  logger.info(`Found ${upcomingEvents.length} events to sync odds for`);

  let browser;

  try {
    browser = await launchBrowser();
    const page = await createPage(browser);
    const scraper = new OddscheckerScraper(page);

    // Group events by sport
    const eventsBySport = new Map<string, typeof upcomingEvents>();
    for (const evt of upcomingEvents) {
      const sport = evt.sportId;
      if (!eventsBySport.has(sport)) {
        eventsBySport.set(sport, []);
      }
      eventsBySport.get(sport)!.push(evt);
    }

    let totalUpdated = 0;

    // For each sport, scrape odds and match to events
    for (const sportSlug of ['football', 'tennis', 'basketball', 'darts', 'cricket']) {
      logger.info(`Syncing odds for ${sportSlug}`);

      try {
        const scrapedOdds = await scraper.scrapeEventsWithOdds(sportSlug);

        if (scrapedOdds.size === 0) {
          logger.info(`No odds found for ${sportSlug}`);
          continue;
        }

        logger.info(`Scraped ${scrapedOdds.size} events with odds for ${sportSlug}`);

        // Match scraped odds to our events
        for (const evt of upcomingEvents) {
          const matched = matchEventToScrapedOdds(evt, scrapedOdds);

          if (matched) {
            await updateEventOdds(db, evt, matched);
            totalUpdated++;
          }
        }
      } catch (error) {
        logger.error(`Failed to sync odds for ${sportSlug}`, error);
      }
    }

    logger.info('Odds sync completed', { updated: totalUpdated });
  } catch (error) {
    logger.error('Odds sync failed', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    logger.clearContext();
  }
};

function matchEventToScrapedOdds(
  event: any,
  scrapedOdds: Map<string, any>
): any | null {
  const normalizedHome = normalizeTeamName(event.homeTeamName || '');
  const normalizedAway = normalizeTeamName(event.awayTeamName || '');

  // Try to find a match in scraped odds
  for (const [eventText, odds] of scrapedOdds) {
    const normalizedText = eventText.toLowerCase();

    // Check if both team names appear in the event text
    const homeMatch =
      normalizedText.includes(normalizedHome.toLowerCase()) ||
      normalizedHome.toLowerCase().includes(normalizedText.split(' v ')[0]?.trim() || '');

    const awayMatch =
      normalizedText.includes(normalizedAway.toLowerCase()) ||
      normalizedAway.toLowerCase().includes(normalizedText.split(' v ')[1]?.trim() || '');

    if (homeMatch && awayMatch) {
      return odds;
    }
  }

  return null;
}

async function updateEventOdds(db: any, event: any, odds: any): Promise<void> {
  // Find the match_winner market
  const mainMarket = event.markets.find((m: any) => m.type === 'match_winner');

  if (!mainMarket) {
    logger.debug('No match_winner market found', { eventId: event.id });
    return;
  }

  // Update or create outcomes based on scraped odds
  if (odds.markets && odds.markets.length > 0) {
    const matchWinnerMarket = odds.markets.find((m: any) => m.type === 'match_winner');

    if (matchWinnerMarket && matchWinnerMarket.outcomes) {
      for (const scrapedOutcome of matchWinnerMarket.outcomes) {
        // Find matching outcome
        const existingOutcome = mainMarket.outcomes.find((o: any) =>
          o.name.toLowerCase() === scrapedOutcome.name.toLowerCase()
        );

        if (existingOutcome) {
          // Update odds
          await db
            .update(outcomes)
            .set({
              odds: scrapedOutcome.odds.toString(),
              previousOdds: existingOutcome.odds,
              updatedAt: new Date(),
            })
            .where(eq(outcomes.id, existingOutcome.id));
        } else {
          // Create new outcome
          await db.insert(outcomes).values({
            marketId: mainMarket.id,
            name: scrapedOutcome.name,
            odds: scrapedOutcome.odds.toString(),
          });
        }
      }
    }
  }

  // Also update shorthand odds on the market
  if (odds.homeWin !== undefined) {
    await db
      .update(markets)
      .set({
        homeOdds: odds.homeWin?.toString(),
        drawOdds: odds.draw?.toString(),
        awayOdds: odds.awayWin?.toString(),
        updatedAt: new Date(),
      })
      .where(eq(markets.id, mainMarket.id));
  }

  logger.debug('Updated odds for event', { eventId: event.id });
}
