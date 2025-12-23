/**
 * Sync Odds Job
 *
 * Scrapes odds from OddsPortal and updates event markets.
 * Adapted from Lambda handler for VPS deployment.
 */

import { events, markets, outcomes } from '@sport-sage/database';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '../database/client.js';
import { getBrowserPool } from '../browser/pool.js';
import { createJobLogger } from '../logger.js';
import { recordRequest } from '../monitoring/metrics.js';
import { getRateLimitDetector } from '../rate-limit/detector.js';
import { simulateHumanBehavior, waitWithJitter } from '../browser/behavior.js';
import type { Page } from 'playwright';

const logger = createJobLogger('sync-odds');

interface NormalizedOdds {
  homeTeam: string;
  awayTeam: string;
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  source: string;
  bookmakerCount?: number;
}

export async function runSyncOdds(): Promise<void> {
  logger.info('Starting odds sync');
  const startTime = Date.now();

  const browserPool = getBrowserPool();
  const rateLimiter = getRateLimitDetector();
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

  try {
    for (const sportSlug of ['football', 'tennis', 'basketball']) {
      logger.info(`Syncing odds for ${sportSlug}`);

      const { page, release } = await browserPool.getPage();

      try {
        // Wait for rate limit
        await rateLimiter.waitForRateLimit('oddsportal.com');

        // Simulate human behavior
        await simulateHumanBehavior(page);

        // Scrape odds
        const scrapedOdds = await scrapeOddsPortal(page, sportSlug);
        recordRequest('oddsportal', true, Date.now() - startTime);
        rateLimiter.recordSuccess('oddsportal.com');

        if (scrapedOdds.length === 0) {
          logger.info(`No odds found for ${sportSlug}`);
          continue;
        }

        logger.info(`Got ${scrapedOdds.length} events with odds for ${sportSlug}`);

        // Match scraped odds to our events
        for (const evt of upcomingEvents) {
          const matched = matchEventToOdds(evt, scrapedOdds);

          if (matched) {
            await updateEventOdds(db, evt, matched);
            totalUpdated++;
          }
        }
      } catch (error) {
        recordRequest('oddsportal', false, Date.now() - startTime, { blocked: true });
        rateLimiter.recordFailure('oddsportal.com');
        logger.error(`Failed to sync odds for ${sportSlug}`, { error });
      } finally {
        await release();
      }

      // Delay between sports
      await waitWithJitter(3000);
    }

    logger.info('Odds sync completed', {
      updated: totalUpdated,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Odds sync failed', { error });
    throw error;
  }
}

async function scrapeOddsPortal(page: Page, sportSlug: string): Promise<NormalizedOdds[]> {
  const odds: NormalizedOdds[] = [];

  const sportUrls: Record<string, string> = {
    football: 'https://www.oddsportal.com/football/',
    tennis: 'https://www.oddsportal.com/tennis/',
    basketball: 'https://www.oddsportal.com/basketball/',
  };

  const url = sportUrls[sportSlug];
  if (!url) return odds;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitWithJitter(2000);

    // Wait for odds to load (Vue.js renders dynamically)
    await page.waitForSelector('.eventRow, [class*="eventRow"]', { timeout: 30000 });
    await waitWithJitter(1000);

    // Get all event rows
    const rows = await page.$$('.eventRow, [class*="eventRow"]');

    for (const row of rows) {
      try {
        const eventOdds = await parseOddsRow(row);
        if (eventOdds) {
          odds.push(eventOdds);
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    logger.warn(`Failed to scrape OddsPortal for ${sportSlug}`, { error });
  }

  return odds;
}

async function parseOddsRow(row: any): Promise<NormalizedOdds | null> {
  try {
    // Get team names
    const participants = await row.$$eval(
      '.participant-name, [class*="participant"]',
      (els: Element[]) => els.map((el) => el.textContent?.trim()).filter(Boolean)
    );

    if (participants.length < 2) return null;

    const homeTeam = participants[0] || '';
    const awayTeam = participants[1] || '';

    // Get odds values
    const oddsValues = await row.$$eval('.odds-value, [class*="odds"]', (els: Element[]) =>
      els.map((el) => {
        const text = el.textContent?.trim();
        return text ? parseFloat(text) : null;
      })
    );

    // Filter valid odds
    const validOdds = oddsValues.filter((o): o is number => o !== null && !isNaN(o) && o > 1);

    if (validOdds.length < 2) return null;

    // Determine if draw market exists (3 odds vs 2)
    const hasDrawMarket = validOdds.length >= 3;

    return {
      homeTeam,
      awayTeam,
      homeWin: validOdds[0],
      draw: hasDrawMarket ? validOdds[1] : undefined,
      awayWin: hasDrawMarket ? validOdds[2] : validOdds[1],
      source: 'oddsportal',
      bookmakerCount: 1,
    };
  } catch {
    return null;
  }
}

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

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bfc\b/gi, '')
    .replace(/\bsc\b/gi, '')
    .replace(/\bunited\b/gi, 'utd')
    .replace(/\bcity\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

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
