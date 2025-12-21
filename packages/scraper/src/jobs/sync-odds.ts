import type { ScheduledHandler, Context } from 'aws-lambda';
import { getDb, events, markets, outcomes } from '@sport-sage/database';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { launchBrowser } from '../utils/browser';
import { logger } from '../utils/logger';
import { OddsOrchestrator, type NormalizedOdds } from '../scrapers/odds-orchestrator';
import { normalizeTeamName, combinedSimilarity } from '../normalization/team-names';
import { RunTracker } from '../utils/run-tracker';

export const handler: ScheduledHandler = async (event, context: Context) => {
  logger.setContext({ job: 'sync-odds' });
  logger.info('Starting odds sync');

  // Initialize run tracker for monitoring
  const tracker = new RunTracker('sync_odds', 'multi', context.awsRequestId);
  await tracker.start();

  const db = getDb();

  // Get events starting within 24 hours
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Use raw SQL for enum comparison (Data API compatibility)
  const upcomingEvents = await db.query.events.findMany({
    where: and(
      sql`${events.status}::text = 'scheduled'`,
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
    await tracker.complete();
    return;
  }

  logger.info(`Found ${upcomingEvents.length} events to sync odds for`);

  let browser;

  try {
    browser = await launchBrowser();

    // Use multi-source orchestrator - tries FREE OddsPortal first!
    const orchestrator = new OddsOrchestrator();

    let totalUpdated = 0;

    // For each sport, scrape odds and match to events
    for (const sportSlug of ['football', 'tennis', 'basketball', 'hockey', 'baseball']) {
      logger.info(`Syncing odds for ${sportSlug}`);

      try {
        const result = await orchestrator.getOddsForSport(browser, sportSlug);
        const scrapedOdds = result.odds;

        if (scrapedOdds.length === 0) {
          logger.info(`No odds found for ${sportSlug}`);
          continue;
        }

        logger.info(`Got ${scrapedOdds.length} events with odds for ${sportSlug}`);
        logger.info(`Sources used: ${result.sourcesUsed.join(', ') || 'none'}`);

        // Match scraped odds to our events using fuzzy matching
        for (const evt of upcomingEvents) {
          const matched = matchEventToScrapedOdds(evt, scrapedOdds);

          if (matched) {
            await updateEventOdds(db, evt, matched.odds);
            totalUpdated++;
          }
        }
      } catch (error) {
        logger.error(`Failed to sync odds for ${sportSlug}`, error);
      }
    }

    orchestrator.logSummary();

    // Record stats for monitoring
    tracker.recordSportStats('all', {
      processed: upcomingEvents.length,
      updated: totalUpdated,
    });

    await tracker.complete();
    logger.info('Odds sync completed', { updated: totalUpdated });
  } catch (error) {
    await tracker.fail(error as Error);
    logger.error('Odds sync failed', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    logger.clearContext();
  }
};

const MATCH_THRESHOLD = 0.75; // Lower than auto-learn (0.85) for matching existing events

function matchEventToScrapedOdds(
  event: any,
  scrapedOdds: NormalizedOdds[]
): { odds: NormalizedOdds; confidence: number } | null {
  const eventHome = normalizeTeamName(event.homeTeamName || '');
  const eventAway = normalizeTeamName(event.awayTeamName || '');

  if (!eventHome || !eventAway) return null;

  let bestMatch: { odds: NormalizedOdds; confidence: number } | null = null;

  for (const odds of scrapedOdds) {
    const scrapedHome = normalizeTeamName(odds.homeTeam);
    const scrapedAway = normalizeTeamName(odds.awayTeam);

    // Use combined similarity (Levenshtein + token matching)
    const homeSimilarity = combinedSimilarity(eventHome, scrapedHome);
    const awaySimilarity = combinedSimilarity(eventAway, scrapedAway);

    // Both teams must meet threshold
    if (homeSimilarity >= MATCH_THRESHOLD && awaySimilarity >= MATCH_THRESHOLD) {
      const avgConfidence = (homeSimilarity + awaySimilarity) / 2;

      if (!bestMatch || avgConfidence > bestMatch.confidence) {
        bestMatch = { odds, confidence: avgConfidence };
      }
    }
  }

  if (bestMatch) {
    logger.debug(`Matched odds: "${eventHome} vs ${eventAway}" -> "${bestMatch.odds.homeTeam} vs ${bestMatch.odds.awayTeam}" (${(bestMatch.confidence * 100).toFixed(0)}%)`);
  }

  return bestMatch;
}

async function updateEventOdds(db: any, event: any, odds: NormalizedOdds): Promise<void> {
  // Find the match_winner market
  const mainMarket = event.markets.find((m: any) => m.type === 'match_winner');

  if (!mainMarket) {
    logger.debug('No match_winner market found', { eventId: event.id });
    return;
  }

  // Update market with odds
  if (odds.homeWin !== undefined || odds.awayWin !== undefined) {
    await db
      .update(markets)
      .set({
        homeOdds: odds.homeWin?.toString(),
        drawOdds: odds.draw?.toString(),
        awayOdds: odds.awayWin?.toString(),
        updatedAt: new Date(),
      })
      .where(eq(markets.id, mainMarket.id));

    // Also update or create individual outcomes
    const outcomeData = [
      { name: 'Home Win', odds: odds.homeWin },
      { name: 'Draw', odds: odds.draw },
      { name: 'Away Win', odds: odds.awayWin },
    ].filter(o => o.odds !== undefined);

    for (const outcomeInfo of outcomeData) {
      const existingOutcome = mainMarket.outcomes.find((o: any) =>
        o.name.toLowerCase() === outcomeInfo.name.toLowerCase()
      );

      if (existingOutcome) {
        await db
          .update(outcomes)
          .set({
            odds: outcomeInfo.odds!.toString(),
            previousOdds: existingOutcome.odds,
            updatedAt: new Date(),
          })
          .where(eq(outcomes.id, existingOutcome.id));
      } else {
        await db.insert(outcomes).values({
          marketId: mainMarket.id,
          name: outcomeInfo.name,
          odds: outcomeInfo.odds!.toString(),
        });
      }
    }
  }

  logger.debug('Updated odds for event', {
    eventId: event.id,
    source: odds.source,
    bookmakers: odds.bookmakerCount,
  });
}
