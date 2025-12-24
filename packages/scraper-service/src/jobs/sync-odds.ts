/**
 * Sync Odds Job
 *
 * Scrapes odds from multiple sources with intelligent rotation.
 * Sources: OddsPortal, BMBets, Odds Scanner, Nicer Odds, the-odds-api (fallback)
 */

import { events, markets, outcomes } from '@sport-sage/database';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '../database/client.js';
import { getBrowserPool } from '../browser/pool.js';
import { createJobLogger } from '../logger.js';
import { recordRequest } from '../monitoring/metrics.js';
import { simulateHumanBehavior, waitWithJitter } from '../browser/behavior.js';
import {
  scrapeWithRotation,
  getSourcesStatus,
  mergeOdds,
  getSourcePriorities,
  normalizeTeamName,
  stringSimilarity,
  type NormalizedOdds,
} from '../odds-sources/index.js';

const logger = createJobLogger('sync-odds');

// The Odds API config (free tier: 500 requests/month)
const ODDS_API_KEY = process.env.ODDS_API_KEY || '';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

export async function runSyncOdds(): Promise<void> {
  logger.info('Starting odds sync with multi-source rotation');
  const startTime = Date.now();

  // Log source status
  const sourcesStatus = getSourcesStatus();
  logger.info('Source status:', { sources: Object.keys(sourcesStatus).map(name => ({
    name,
    enabled: sourcesStatus[name].enabled,
    onCooldown: sourcesStatus[name].onCooldown,
    cooldownRemaining: sourcesStatus[name].cooldownRemaining ? `${Math.round(sourcesStatus[name].cooldownRemaining! / 60000)}m` : null,
  }))});

  const browserPool = getBrowserPool();
  const db = getDb();

  // Get events starting within 24 hours
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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
    return;
  }

  logger.info(`Found ${upcomingEvents.length} events to sync odds for`);

  let totalUpdated = 0;
  const sourceStats: Record<string, { success: number; failed: number }> = {};

  try {
    for (const sportSlug of ['football', 'tennis', 'basketball']) {
      logger.info(`Syncing odds for ${sportSlug}`);

      let allScrapedOdds: NormalizedOdds[] = [];

      // Get a browser page for scraping
      const { page, release } = await browserPool.getPage();

      try {
        // Simulate human behavior before scraping
        await simulateHumanBehavior(page);

        // Use the rotation system - try up to 2 sources
        const results = await scrapeWithRotation(page, sportSlug, 2);

        // Collect odds from all successful sources (raw, unmerged)
        const rawOdds: NormalizedOdds[] = [];

        for (const result of results) {
          if (!sourceStats[result.source]) {
            sourceStats[result.source] = { success: 0, failed: 0 };
          }

          if (result.success && result.odds.length > 0) {
            sourceStats[result.source].success++;
            recordRequest(result.source, true, result.duration);
            rawOdds.push(...result.odds);
          } else {
            sourceStats[result.source].failed++;
            recordRequest(result.source, false, result.duration, { blocked: true });
          }
        }

        allScrapedOdds = rawOdds;
      } finally {
        await release();
      }

      // Fallback to the-odds-api.com if web scraping didn't return results
      if (allScrapedOdds.length === 0 && ODDS_API_KEY) {
        logger.info(`Web scraping returned no results, trying the-odds-api for ${sportSlug}`);
        try {
          const apiOdds = await fetchFromTheOddsApi(sportSlug);
          if (apiOdds.length > 0) {
            logger.info(`Got ${apiOdds.length} odds from the-odds-api for ${sportSlug}`);
            allScrapedOdds = apiOdds;
            if (!sourceStats['the-odds-api']) {
              sourceStats['the-odds-api'] = { success: 0, failed: 0 };
            }
            sourceStats['the-odds-api'].success++;
          }
        } catch (error) {
          logger.warn(`the-odds-api failed for ${sportSlug}`, { error });
          if (!sourceStats['the-odds-api']) {
            sourceStats['the-odds-api'] = { success: 0, failed: 0 };
          }
          sourceStats['the-odds-api'].failed++;
        }
      }

      if (allScrapedOdds.length === 0) {
        logger.info(`No odds found for ${sportSlug} from any source`);
        continue;
      }

      // Merge and deduplicate odds with validation and priority handling
      const mergedOdds = mergeOdds(allScrapedOdds, sportSlug, getSourcePriorities());
      logger.info(`Merged ${allScrapedOdds.length} raw odds into ${mergedOdds.length} validated matches for ${sportSlug}`);

      // Match merged odds to our events
      for (const evt of upcomingEvents) {
        const matched = matchEventToOdds(evt, mergedOdds);

        if (matched) {
          await updateEventOdds(db, evt, matched);
          totalUpdated++;
        }
      }

      // Delay between sports
      await waitWithJitter(3000);
    }

    logger.info('Odds sync completed', {
      updated: totalUpdated,
      durationMs: Date.now() - startTime,
      sourceStats,
    });
  } catch (error) {
    logger.error('Odds sync failed', { error });
    throw error;
  }
}

// Fetch odds from the-odds-api.com (free tier: 500 requests/month)
async function fetchFromTheOddsApi(sportSlug: string): Promise<NormalizedOdds[]> {
  const results: NormalizedOdds[] = [];

  // Map our sport slugs to the-odds-api sport keys
  const sportKeys: Record<string, string[]> = {
    football: ['soccer_epl', 'soccer_spain_la_liga', 'soccer_italy_serie_a', 'soccer_germany_bundesliga'],
    basketball: ['basketball_nba', 'basketball_euroleague'],
    tennis: [], // Tennis not well supported on the-odds-api
  };

  const keys = sportKeys[sportSlug] || [];
  if (keys.length === 0) {
    logger.info(`the-odds-api: No sport keys for ${sportSlug}`);
    return results;
  }

  for (const sportKey of keys) {
    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=uk,eu&markets=h2h&oddsFormat=decimal`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const remaining = response.headers.get('x-requests-remaining');
        logger.warn(`the-odds-api: Request failed for ${sportKey}`, {
          status: response.status,
          remaining,
        });
        continue;
      }

      // Log remaining quota
      const remaining = response.headers.get('x-requests-remaining');
      const used = response.headers.get('x-requests-used');
      logger.info(`the-odds-api: Quota - used: ${used}, remaining: ${remaining}`);

      const data = await response.json();

      for (const event of data) {
        try {
          const homeTeam = event.home_team || '';
          const awayTeam = event.away_team || '';

          if (!homeTeam || !awayTeam) continue;

          // Get best odds from all bookmakers
          let bestHome = 0;
          let bestDraw = 0;
          let bestAway = 0;
          let bookmakerCount = 0;

          for (const bookmaker of event.bookmakers || []) {
            for (const market of bookmaker.markets || []) {
              if (market.key === 'h2h') {
                for (const outcome of market.outcomes || []) {
                  const price = outcome.price || 0;
                  if (outcome.name === homeTeam) {
                    bestHome = Math.max(bestHome, price);
                  } else if (outcome.name === awayTeam) {
                    bestAway = Math.max(bestAway, price);
                  } else if (outcome.name === 'Draw') {
                    bestDraw = Math.max(bestDraw, price);
                  }
                }
                bookmakerCount++;
              }
            }
          }

          if (bestHome > 1 && bestAway > 1) {
            results.push({
              homeTeam,
              awayTeam,
              homeWin: bestHome,
              draw: bestDraw > 1 ? bestDraw : undefined,
              awayWin: bestAway,
              source: 'the-odds-api',
              bookmakerCount,
              scrapedAt: new Date(),
            });
          }
        } catch {
          continue;
        }
      }

      logger.info(`the-odds-api: Got ${results.length} odds from ${sportKey}`);
    } catch (error) {
      logger.warn(`the-odds-api: Failed to fetch ${sportKey}`, { error });
    }
  }

  return results;
}

// OddsPortal scraping logic has been moved to odds-sources/oddsportal.ts

function matchEventToOdds(event: any, scrapedOdds: NormalizedOdds[]): NormalizedOdds | null {
  const eventHome = normalizeTeamName(event.homeTeamName || '');
  const eventAway = normalizeTeamName(event.awayTeamName || '');

  if (!eventHome || !eventAway) return null;

  const MATCH_THRESHOLD = 0.75;
  let bestMatch: NormalizedOdds | null = null;
  let bestScore = 0;

  for (const odds of scrapedOdds) {
    const scrapedHome = normalizeTeamName(odds.homeTeam);
    const scrapedAway = normalizeTeamName(odds.awayTeam);

    const homeSimilarity = stringSimilarity(eventHome, scrapedHome);
    const awaySimilarity = stringSimilarity(eventAway, scrapedAway);

    if (homeSimilarity >= MATCH_THRESHOLD && awaySimilarity >= MATCH_THRESHOLD) {
      const avgScore = (homeSimilarity + awaySimilarity) / 2;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestMatch = odds;
      }
    }
  }

  return bestMatch;
}

// normalizeTeamName, stringSimilarity, levenshteinDistance moved to odds-sources/utils.ts

async function updateEventOdds(db: any, event: any, odds: NormalizedOdds): Promise<void> {
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

    // Update individual outcomes
    const outcomeData = [
      { name: 'Home Win', odds: odds.homeWin },
      { name: 'Draw', odds: odds.draw },
      { name: 'Away Win', odds: odds.awayWin },
    ].filter((o) => o.odds !== undefined);

    for (const outcomeInfo of outcomeData) {
      const existingOutcome = mainMarket.outcomes.find(
        (o: any) => o.name.toLowerCase() === outcomeInfo.name.toLowerCase()
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
  });
}
