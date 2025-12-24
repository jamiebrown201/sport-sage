/**
 * Covers.com Scraper
 *
 * Scrapes odds from covers.com - US-focused betting site with
 * great NBA, NFL, MLB, and NHL coverage. Shows multiple bookmaker odds.
 */

import type { Page } from 'playwright';
import type { OddsSource, OddsSourceConfig, NormalizedOdds } from './types.js';
import { NoDataAvailableError, NO_DATA_PATTERNS, BotBlockedError, BOT_BLOCKED_PATTERNS } from './types.js';
import { createJobLogger } from '../logger.js';
import { waitWithJitter } from '../browser/behavior.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logger = createJobLogger('odds-covers');
const DEBUG_DIR = '/tmp/scraper-debug';

export const coversConfig: OddsSourceConfig = {
  name: 'covers',
  domain: 'covers.com',
  enabled: true,
  priority: 2, // Medium priority - US-focused but good data
  cooldownMinutes: 60,
  sportUrls: {
    basketball: [
      'https://www.covers.com/sport/basketball/nba/odds',
    ],
    football: [
      // Covers doesn't have soccer, but we keep this for compatibility
      // Will return empty array
    ],
    tennis: [
      // Limited tennis coverage
    ],
  },
};

export const coversSource: OddsSource = {
  config: coversConfig,
  scrape: scrapeCovers,
};

async function scrapeCovers(page: Page, sportSlug: string): Promise<NormalizedOdds[]> {
  const allOdds: NormalizedOdds[] = [];
  const urls = coversConfig.sportUrls[sportSlug] || [];

  if (urls.length === 0) {
    logger.info(`No URLs configured for ${sportSlug} on Covers.com`);
    return allOdds;
  }

  logger.info(`Fetching ${sportSlug} odds from ${urls.length} URL(s)`);

  for (const url of urls) {
    try {
      const urlOdds = await scrapeUrl(page, url, sportSlug);

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

      if (allOdds.length >= 20) {
        logger.info(`Got ${allOdds.length} events, stopping URL iteration`);
        break;
      }
    } catch (error) {
      // Re-throw BotBlockedError and NoDataAvailableError so rotation logic can handle them
      if (error instanceof BotBlockedError || error instanceof NoDataAvailableError) {
        throw error;
      }
      logger.warn(`Failed to scrape URL: ${url}`, { error });
    }

    await waitWithJitter(1000);
  }

  logger.info(`Retrieved ${allOdds.length} total ${sportSlug} events`);
  return allOdds;
}

async function scrapeUrl(page: Page, url: string, sportSlug: string): Promise<NormalizedOdds[]> {
  const odds: NormalizedOdds[] = [];

  logger.info(`Scraping ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await waitWithJitter(3000);

    // Save debug HTML
    try {
      await mkdir(DEBUG_DIR, { recursive: true });
      const html = await page.content();
      const debugPath = join(DEBUG_DIR, `covers-${sportSlug}-${Date.now()}.html`);
      await writeFile(debugPath, html);
      logger.info(`Saved debug HTML to ${debugPath}`);
    } catch (e) {
      logger.warn('Failed to save debug HTML', { error: e });
    }

    // Parse game data
    // Covers structure:
    // - .oddsGameRow contains each game
    // - .teams-div contains team names
    // - Odds cells contain moneyline, spread, total in different formats
    const scrapedEvents = await page.evaluate(() => {
      const results: Array<{
        awayTeam: string;
        homeTeam: string;
        awayOdds: number | null;
        homeOdds: number | null;
      }> = [];

      // Find game rows
      const rows = document.querySelectorAll('.oddsGameRow, [class*=oddsGameRow]');

      for (const row of Array.from(rows)) {
        // Get team names from teams-div
        const teamsDiv = row.querySelector('.teams-div, [class*=teams-div]');
        if (!teamsDiv) continue;

        const teamTexts = (teamsDiv as HTMLElement).innerText.split('\n')
          .map((t: string) => t.trim())
          .filter((t: string) => t.length > 0 && t.length < 50);

        if (teamTexts.length < 2) continue;

        // Away team is first, home team is second
        const awayTeam = teamTexts[0];
        const homeTeam = teamTexts[1];

        // Get odds - look for decimal odds in the first odds column
        // Each cell shows odds in format: "+200\n3.00\n2/1" (US, decimal, fractional)
        const oddsCells = Array.from(row.querySelectorAll('[class*=oddsTd], [class*=liveOddsCell]'));

        let awayDecimalOdds: number | null = null;
        let homeDecimalOdds: number | null = null;

        // First cell has away team odds, we need to find the decimal value
        if (oddsCells.length > 0) {
          const firstCell = oddsCells[0]?.textContent || '';
          // Extract decimal odds (like 3.00, 1.41) from the cell
          const decimalMatch = firstCell.match(/\b(\d+\.\d{2})\b/);
          if (decimalMatch) {
            awayDecimalOdds = parseFloat(decimalMatch[1]);
          }
        }

        // The home team odds appear after away team in the same cell
        if (oddsCells.length > 0) {
          const firstCell = oddsCells[0]?.textContent || '';
          // Look for second decimal odds (the home team's odds)
          const matches = firstCell.match(/\b(\d+\.\d{2})\b/g);
          if (matches && matches.length >= 2) {
            awayDecimalOdds = parseFloat(matches[0]);
            homeDecimalOdds = parseFloat(matches[1]);
          }
        }

        if (awayDecimalOdds && homeDecimalOdds && awayDecimalOdds > 1 && homeDecimalOdds > 1) {
          results.push({
            awayTeam,
            homeTeam,
            awayOdds: awayDecimalOdds,
            homeOdds: homeDecimalOdds,
          });
        }
      }

      return results;
    });

    logger.info(`DOM parsing found ${scrapedEvents.length} events`);

    // If no events found, check if we're blocked or if there's genuinely no data
    if (scrapedEvents.length === 0) {
      const pageHtml = await page.evaluate(() => document.body?.innerHTML || '');
      const pageText = await page.evaluate(() => document.body?.innerText || '');

      // First check if we're being blocked
      for (const pattern of BOT_BLOCKED_PATTERNS) {
        if (pattern.test(pageHtml) || pattern.test(pageText)) {
          logger.warn(`Detected bot blocking on ${url}: ${pattern.toString()}`);
          throw new BotBlockedError(`Blocked by bot protection on covers`);
        }
      }

      // Then check if the page explicitly says "no data available"
      for (const pattern of NO_DATA_PATTERNS) {
        if (pattern.test(pageText)) {
          logger.info(`Detected "no data" message on ${url}: ${pattern.toString()}`);
          throw new NoDataAvailableError(`No matches available for ${sportSlug} on covers`);
        }
      }
    }

    for (const event of scrapedEvents) {
      odds.push({
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        homeWin: event.homeOdds ?? undefined,
        awayWin: event.awayOdds ?? undefined,
        // No draw for basketball
        draw: undefined,
        source: 'covers',
        bookmakerCount: 1,
        scrapedAt: new Date(),
      });
    }

    logger.info(`Retrieved ${odds.length} events with valid odds from ${url}`);
  } catch (error) {
    // Re-throw BotBlockedError and NoDataAvailableError so rotation logic can handle them
    if (error instanceof BotBlockedError || error instanceof NoDataAvailableError) {
      throw error;
    }
    logger.warn(`Failed to scrape: ${url}`, { error });
  }

  return odds;
}

export default coversSource;
