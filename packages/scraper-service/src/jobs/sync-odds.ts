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

// The Odds API config (free tier: 500 requests/month)
const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

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

  // Debug: Log all database events we're trying to match
  for (const evt of upcomingEvents) {
    logger.info(`DB Event: ${evt.homeTeamName} vs ${evt.awayTeamName}`);
  }

  let totalUpdated = 0;

  try {
    for (const sportSlug of ['football', 'tennis', 'basketball']) {
      logger.info(`Syncing odds for ${sportSlug}`);

      let scrapedOdds: NormalizedOdds[] = [];

      // Try OddsPortal scraping first
      const { page, release } = await browserPool.getPage();

      try {
        // Wait for rate limit
        await rateLimiter.waitForRateLimit('oddsportal.com');

        // Simulate human behavior
        await simulateHumanBehavior(page);

        // Scrape odds
        scrapedOdds = await scrapeOddsPortal(page, sportSlug);

        if (scrapedOdds.length > 0) {
          recordRequest('oddsportal', true, Date.now() - startTime);
          rateLimiter.recordSuccess('oddsportal.com');
          logger.info(`Got ${scrapedOdds.length} odds from OddsPortal for ${sportSlug}`);
        }
      } catch (error) {
        recordRequest('oddsportal', false, Date.now() - startTime, { blocked: true });
        rateLimiter.recordFailure('oddsportal.com');
        logger.warn(`OddsPortal scraping failed for ${sportSlug}`, { error });
      } finally {
        await release();
      }

      // Fallback to the-odds-api.com if OddsPortal didn't return results
      if (scrapedOdds.length === 0 && ODDS_API_KEY) {
        logger.info(`OddsPortal returned no results, trying the-odds-api for ${sportSlug}`);
        try {
          scrapedOdds = await fetchFromTheOddsApi(sportSlug);
          if (scrapedOdds.length > 0) {
            logger.info(`Got ${scrapedOdds.length} odds from the-odds-api for ${sportSlug}`);
          }
        } catch (error) {
          logger.warn(`the-odds-api failed for ${sportSlug}`, { error });
        }
      }

      if (scrapedOdds.length === 0) {
        logger.info(`No odds found for ${sportSlug}`);
        continue;
      }

      logger.info(`Got ${scrapedOdds.length} events with odds for ${sportSlug}`);

      // Debug: Log first few scraped odds
      if (scrapedOdds.length > 0) {
        logger.info(`Sample scraped odds: ${scrapedOdds.slice(0, 3).map(o => `${o.homeTeam} vs ${o.awayTeam}`).join(', ')}`);
      }

      // Match scraped odds to our events
      for (const evt of upcomingEvents) {
        // Debug: Log each event we're trying to match
        logger.debug(`Trying to match: ${evt.homeTeamName} vs ${evt.awayTeamName}`);

        const matched = matchEventToOdds(evt, scrapedOdds);

        if (matched) {
          logger.info(`Matched: ${evt.homeTeamName} vs ${evt.awayTeamName} -> ${matched.homeTeam} vs ${matched.awayTeam}`);
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
  const apiResponses: any[] = [];
  const failedRequests: Array<{ url: string; status: number }> = [];
  const blockedRequests: string[] = [];

  logger.info(`OddsPortal: Scraping ${url}`);

  // Log all requests to understand what's happening
  page.on('request', (request) => {
    const reqUrl = request.url();
    if (reqUrl.includes('oddsportal') && !reqUrl.includes('.css') && !reqUrl.includes('.png') && !reqUrl.includes('.svg')) {
      logger.debug(`OddsPortal Request: ${request.method()} ${reqUrl.substring(0, 100)}`);
    }
  });

  // Track failed requests
  page.on('requestfailed', (request) => {
    const reqUrl = request.url();
    if (reqUrl.includes('oddsportal')) {
      blockedRequests.push(reqUrl.substring(0, 100));
      logger.warn(`OddsPortal Request FAILED: ${reqUrl.substring(0, 100)} - ${request.failure()?.errorText}`);
    }
  });

  // Intercept API responses that might contain odds data
  page.on('response', async (response) => {
    const responseUrl = response.url();
    const status = response.status();

    // Log non-200 responses from OddsPortal
    if (responseUrl.includes('oddsportal') && status !== 200 && status !== 204 && status !== 304) {
      failedRequests.push({ url: responseUrl.substring(0, 100), status });
      logger.warn(`OddsPortal Response ${status}: ${responseUrl.substring(0, 100)}`);
    }

    if (
      responseUrl.includes('/ajax') ||
      responseUrl.includes('/api') ||
      responseUrl.includes('feed') ||
      responseUrl.includes('games') ||
      responseUrl.includes('matches') ||
      responseUrl.includes('next-games') ||
      responseUrl.includes('event')
    ) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const json = await response.json();
          apiResponses.push({ url: responseUrl, data: json });
          logger.info(`OddsPortal: Captured API response from ${responseUrl.substring(0, 80)}`);
        }
      } catch {
        // Not JSON or failed to parse
      }
    }
  });

  try {
    // Use networkidle for dynamic content
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await waitWithJitter(2000);

    // Handle cookie consent - OddsPortal uses OneTrust
    try {
      const consentButton = await page.$('#onetrust-accept-btn-handler, [id*="accept"], button[class*="accept"], .onetrust-close-btn-handler');
      if (consentButton) {
        await consentButton.click();
        logger.info('OddsPortal: Clicked cookie consent button');
        await waitWithJitter(2000);
      }
    } catch {
      // No consent button, continue
    }

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await waitWithJitter(1500);

    // Additional scroll and wait for Vue hydration
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      window.scrollBy(0, 300);
    });
    await waitWithJitter(3000);

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

    // Log network issues summary
    if (failedRequests.length > 0) {
      logger.warn(`OddsPortal: ${failedRequests.length} HTTP errors`, { failedRequests });
    }
    if (blockedRequests.length > 0) {
      logger.warn(`OddsPortal: ${blockedRequests.length} blocked requests`, { blockedRequests });
    }

    // Try to parse any captured API responses
    if (odds.length === 0 && apiResponses.length > 0) {
      logger.info(`OddsPortal: Trying to parse ${apiResponses.length} API response(s)`);
      for (const { url: apiUrl, data } of apiResponses) {
        try {
          const parsed = parseApiResponse(data, sportSlug);
          if (parsed.length > 0) {
            logger.info(`OddsPortal: Parsed ${parsed.length} events from API: ${apiUrl.substring(0, 50)}`);
            odds.push(...parsed);
          }
        } catch (e) {
          logger.debug(`Failed to parse API response: ${apiUrl}`, { error: e });
        }
      }
    }

    logger.info(`OddsPortal: Retrieved ${odds.length} events with valid odds from ${url}`);
  } catch (error) {
    logger.warn(`Failed to scrape OddsPortal: ${url}`, { error });
  }

  return odds;
}

// Parse OddsPortal API responses (structure varies)
function parseApiResponse(data: any, sportSlug: string): NormalizedOdds[] {
  const results: NormalizedOdds[] = [];

  // Try different API response structures
  const items = data?.d?.rows || data?.d?.oddsData || data?.rows || data?.matches || data?.events || [];

  for (const item of items) {
    try {
      // Common fields
      const homeTeam = item.home?.name || item.homeTeam || item.home_name || item.participants?.[0]?.name || '';
      const awayTeam = item.away?.name || item.awayTeam || item.away_name || item.participants?.[1]?.name || '';

      if (!homeTeam || !awayTeam) continue;

      // Try to extract odds
      const odds = item.odds || item.eventOdds || {};
      const homeWin = parseFloat(odds['1'] || odds.home || odds['1x2']?.[0] || '0');
      const draw = parseFloat(odds['X'] || odds.draw || odds['1x2']?.[1] || '0');
      const awayWin = parseFloat(odds['2'] || odds.away || odds['1x2']?.[2] || '0');

      if (homeWin > 1 && awayWin > 1) {
        results.push({
          homeTeam,
          awayTeam,
          homeWin,
          draw: draw > 1 ? draw : undefined,
          awayWin,
          source: 'oddsportal-api',
          bookmakerCount: 1,
        });
      }
    } catch {
      continue;
    }
  }

  return results;
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
