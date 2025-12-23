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
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logger = createJobLogger('sync-odds');
const DEBUG_DIR = '/tmp/scraper-debug';

// OddsPortal URLs - try multiple endpoints with fallbacks
const SPORT_URLS: Record<string, string[]> = {
  football: [
    'https://www.oddsportal.com/matches/football/',
    'https://www.oddsportal.com/football/england/premier-league/',
    'https://www.oddsportal.com/football/spain/laliga/',
  ],
  basketball: [
    'https://www.oddsportal.com/basketball/usa/nba/',
    'https://www.oddsportal.com/matches/basketball/',
  ],
  tennis: [
    'https://www.oddsportal.com/matches/tennis/',
  ],
};

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
  const allOdds: NormalizedOdds[] = [];
  const urls = SPORT_URLS[sportSlug] || SPORT_URLS.football;

  logger.info(`OddsPortal: Fetching ${sportSlug} odds from ${urls.length} URL(s)`);

  // Try each URL until we get enough events
  for (const url of urls) {
    try {
      const urlOdds = await scrapeOddsUrl(page, url, sportSlug);

      // Deduplicate by team names
      for (const odds of urlOdds) {
        const exists = allOdds.some(
          (o) =>
            o.homeTeam.toLowerCase() === odds.homeTeam.toLowerCase() &&
            o.awayTeam.toLowerCase() === odds.awayTeam.toLowerCase()
        );
        if (!exists) {
          allOdds.push(odds);
        }
      }

      // If we got enough events, stop
      if (allOdds.length >= 20) {
        logger.info(`OddsPortal: Got ${allOdds.length} events, stopping URL iteration`);
        break;
      }
    } catch (error) {
      logger.warn(`Failed to scrape OddsPortal URL: ${url}`, { error });
    }

    // Small delay between URLs
    await waitWithJitter(1000);
  }

  logger.info(`OddsPortal: Retrieved ${allOdds.length} total ${sportSlug} events`);
  return allOdds;
}

async function scrapeOddsUrl(page: Page, url: string, sportSlug: string): Promise<NormalizedOdds[]> {
  const odds: NormalizedOdds[] = [];

  logger.info(`OddsPortal: Scraping ${url}`);

  try {
    // Use networkidle for dynamic content
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await waitWithJitter(2000);

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await waitWithJitter(1500);

    // Wait for content to load with fallback
    await page
      .waitForSelector(
        '[class*="eventRow"], [class*="event-row"], [class*="flex"][class*="border"], table tbody tr',
        { timeout: 15000 }
      )
      .catch(() => {
        logger.warn('OddsPortal: No event rows found');
      });

    await waitWithJitter(2000);

    // Debug: Log page info and save HTML for analysis
    const debugInfo = await page.evaluate(() => {
      const title = document.title;
      const currentUrl = window.location.href;
      const eventRows = document.querySelectorAll('[class*="eventRow"]').length;
      const allLinks = document.querySelectorAll('a').length;
      const oddsPattern = (document.body.textContent || '').match(/\d+\.\d{1,2}/g) || [];
      const html = document.body.innerHTML;

      // Look for any divs that might contain match data
      const flexDivs = document.querySelectorAll('div.flex').length;
      const borderDivs = document.querySelectorAll('div[class*="border"]').length;
      const groupDivs = document.querySelectorAll('div[class*="group"]').length;

      // Find any text containing team-like patterns
      const teamMatches = (document.body.textContent || '').match(/[A-Z][a-z]+ [A-Z][a-z]+ - [A-Z][a-z]+ [A-Z][a-z]+/g) || [];

      return { title, currentUrl, eventRows, allLinks, oddsCount: oddsPattern.length, htmlLength: html.length, flexDivs, borderDivs, groupDivs, teamMatches: teamMatches.slice(0, 5), html };
    });
    logger.info(
      `OddsPortal Debug: ${debugInfo.title}, eventRows=${debugInfo.eventRows}, links=${debugInfo.allLinks}, oddsPatterns=${debugInfo.oddsCount}, flexDivs=${debugInfo.flexDivs}, borderDivs=${debugInfo.borderDivs}, groupDivs=${debugInfo.groupDivs}`
    );
    if (debugInfo.teamMatches.length > 0) {
      logger.info(`OddsPortal Debug: Team matches found: ${debugInfo.teamMatches.join(', ')}`);
    }

    // Save HTML for debugging (only once per sport)
    try {
      await mkdir(DEBUG_DIR, { recursive: true });
      const filename = join(DEBUG_DIR, `oddsportal-${sportSlug}-${Date.now()}.html`);
      await writeFile(filename, debugInfo.html);
      logger.info(`OddsPortal Debug: Saved HTML to ${filename}`);
    } catch (e) {
      // Ignore write errors
    }

    // Try JSON-LD structured data first (most reliable)
    const jsonLdEvents = await page.evaluate(() => {
      const results: Array<{ homeTeam: string; awayTeam: string }> = [];
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach((script) => {
        try {
          const data = JSON.parse(script.textContent || '');
          const events = Array.isArray(data) ? data : [data];
          events.forEach((event) => {
            if (event['@type']?.includes('SportsEvent') && event.name) {
              const parts = event.name.split(' - ');
              if (parts.length === 2) {
                results.push({ homeTeam: parts[0].trim(), awayTeam: parts[1].trim() });
              }
            }
          });
        } catch {
          // Skip invalid JSON
        }
      });
      return results;
    });

    if (jsonLdEvents.length > 0) {
      logger.info(`OddsPortal: Found ${jsonLdEvents.length} events from JSON-LD`);
    }

    // Extract events with odds from DOM
    const scrapedEvents = await page.evaluate((sport) => {
      const results: Array<{
        homeTeam: string;
        awayTeam: string;
        odds: { home: string; draw: string; away: string } | null;
      }> = [];

      // Try eventRow structure (Vue.js based OddsPortal)
      const eventRows = document.querySelectorAll('[class*="eventRow"], [class*="event-row"]');

      eventRows.forEach((row) => {
        try {
          const rowText = row.textContent || '';

          // Find team names from links or text patterns
          const links = row.querySelectorAll('a');
          const teamLinks: string[] = [];
          links.forEach((link) => {
            const href = link.getAttribute('href') || '';
            const text = link.textContent?.trim() || '';
            if (
              (href.includes('/match/') || href.includes(`/${sport}/`)) &&
              text.length > 2 &&
              text.length < 50
            ) {
              teamLinks.push(text);
            }
          });

          let homeTeam = '';
          let awayTeam = '';

          if (teamLinks.length >= 2) {
            homeTeam = teamLinks[0];
            awayTeam = teamLinks[1];
          } else {
            // Try pattern matching
            const matchPattern = rowText.match(
              /([A-Za-z][A-Za-z0-9\s\.'-]+)\s*[-–]\s*([A-Za-z][A-Za-z0-9\s\.'-]+)/
            );
            if (matchPattern) {
              homeTeam = matchPattern[1].trim();
              awayTeam = matchPattern[2].trim();
            }
          }

          if (homeTeam && awayTeam && homeTeam.length > 2 && awayTeam.length > 2) {
            // Find odds (decimal numbers)
            const oddsMatches = rowText.match(/\d+\.\d{1,2}/g) || [];
            let oddsData: { home: string; draw: string; away: string } | null = null;

            if (oddsMatches.length >= 2) {
              if (oddsMatches.length === 2) {
                oddsData = { home: oddsMatches[0]!, draw: '', away: oddsMatches[1]! };
              } else if (oddsMatches.length >= 3) {
                oddsData = { home: oddsMatches[0]!, draw: oddsMatches[1]!, away: oddsMatches[2]! };
              }
            }

            results.push({ homeTeam, awayTeam, odds: oddsData });
          }
        } catch {
          // Skip failed rows
        }
      });

      // Also try table structure for older OddsPortal pages
      if (results.length === 0) {
        const tableRows = document.querySelectorAll('table tbody tr');
        tableRows.forEach((row) => {
          try {
            const rowText = row.textContent || '';
            const matchPattern = rowText.match(
              /([A-Za-z][A-Za-z0-9\s\.'-]+)\s*[-–]\s*([A-Za-z][A-Za-z0-9\s\.'-]+)/
            );
            if (matchPattern) {
              const homeTeam = matchPattern[1].trim();
              const awayTeam = matchPattern[2].trim();
              const oddsMatches = rowText.match(/\d+\.\d{1,2}/g) || [];
              let oddsData: { home: string; draw: string; away: string } | null = null;
              if (oddsMatches.length >= 2) {
                oddsData = {
                  home: oddsMatches[0]!,
                  draw: oddsMatches.length >= 3 ? oddsMatches[1]! : '',
                  away: oddsMatches[oddsMatches.length >= 3 ? 2 : 1]!,
                };
              }
              if (homeTeam.length > 2 && awayTeam.length > 2) {
                results.push({ homeTeam, awayTeam, odds: oddsData });
              }
            }
          } catch {
            // Skip
          }
        });
      }

      return results;
    }, sportSlug);

    logger.info(`OddsPortal: DOM parsing found ${scrapedEvents.length} events`);

    // Convert to NormalizedOdds
    for (const event of scrapedEvents) {
      if (event.odds) {
        const homeWin = parseFloat(event.odds.home);
        const draw = event.odds.draw ? parseFloat(event.odds.draw) : undefined;
        const awayWin = parseFloat(event.odds.away);

        if (!isNaN(homeWin) && !isNaN(awayWin) && homeWin > 1 && awayWin > 1) {
          odds.push({
            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,
            homeWin,
            draw: draw && !isNaN(draw) && draw > 1 ? draw : undefined,
            awayWin,
            source: 'oddsportal',
            bookmakerCount: 1,
          });
        }
      }
    }

    // If DOM parsing found nothing but JSON-LD has events, log it
    if (odds.length === 0 && jsonLdEvents.length > 0) {
      logger.info(`OddsPortal: DOM found no odds, JSON-LD has ${jsonLdEvents.length} fixture names only`);
    }

    logger.info(`OddsPortal: Retrieved ${odds.length} events with valid odds from ${url}`);
  } catch (error) {
    logger.warn(`Failed to scrape OddsPortal: ${url}`, { error });
  }

  return odds;
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
