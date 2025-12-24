/**
 * OddsDigger Scraper
 *
 * Scrapes odds from oddsdigger.com - JavaScript-heavy site that requires
 * waiting for content to load. Covers multiple sports with good odds data.
 */

import type { Page } from 'playwright';
import type { OddsSource, OddsSourceConfig, NormalizedOdds } from './types.js';
import { NoDataAvailableError, NO_DATA_PATTERNS, BotBlockedError, BOT_BLOCKED_PATTERNS } from './types.js';
import { createJobLogger } from '../logger.js';
import { waitWithJitter } from '../browser/behavior.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logger = createJobLogger('odds-oddsdigger');
const DEBUG_DIR = '/tmp/scraper-debug';

export const oddsDiggerConfig: OddsSourceConfig = {
  name: 'oddsdigger',
  domain: 'oddsdigger.com',
  enabled: true,
  priority: 2, // Medium priority - JS-heavy but good data
  cooldownMinutes: 60,
  sportUrls: {
    football: [
      'https://oddsdigger.com/football',
    ],
    basketball: [
      'https://oddsdigger.com/basketball',
    ],
    tennis: [
      'https://oddsdigger.com/tennis',
    ],
  },
};

export const oddsDiggerSource: OddsSource = {
  config: oddsDiggerConfig,
  scrape: scrapeOddsDigger,
};

async function scrapeOddsDigger(page: Page, sportSlug: string): Promise<NormalizedOdds[]> {
  const allOdds: NormalizedOdds[] = [];
  const urls = oddsDiggerConfig.sportUrls[sportSlug] || oddsDiggerConfig.sportUrls.football;

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
    // Set English locale to avoid German content
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9' });

    // OddsDigger is JS-heavy, need networkidle and extra wait
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await waitWithJitter(5000); // Extra wait for JS rendering

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, 500));
    await waitWithJitter(2000);

    // Save debug HTML
    try {
      await mkdir(DEBUG_DIR, { recursive: true });
      const html = await page.content();
      const debugPath = join(DEBUG_DIR, `oddsdigger-${sportSlug}-${Date.now()}.html`);
      await writeFile(debugPath, html);
      logger.info(`Saved debug HTML to ${debugPath}`);
    } catch (e) {
      logger.warn('Failed to save debug HTML', { error: e });
    }

    // Parse match data
    // Structure: tr.c-common-tb__row contains team cells and odds
    const scrapedEvents = await page.evaluate(() => {
      const results: Array<{
        homeTeam: string;
        awayTeam: string;
        odds: number[];
      }> = [];

      // Find all main match rows
      const matchRows = Array.from(document.querySelectorAll('tr.c-common-tb__row'));

      for (const row of matchRows) {
        // Get team names from the fav cells
        const teamCells = row.querySelectorAll('.c-common-tb__fav');
        if (teamCells.length < 2) continue;

        const homeTeam = teamCells[0]?.textContent?.trim() || '';
        const awayTeam = teamCells[1]?.textContent?.trim() || '';

        if (!homeTeam || !awayTeam) continue;

        // Get odds - they're numbers in table cells
        const allCells = Array.from(row.querySelectorAll('td.c-common-tb__cell'));
        const oddsValues: number[] = [];

        for (const cell of allCells) {
          const text = cell.textContent?.trim() || '';
          // Match decimal odds like 1.5, 2.00, 11, etc.
          if (/^\d+(\.\d+)?$/.test(text)) {
            const value = parseFloat(text);
            // Valid odds are typically between 1.01 and 1000
            if (value >= 1.01 && value <= 1000) {
              oddsValues.push(value);
            }
          }
        }

        // Need at least 2 odds (home, away) - 3 for sports with draw
        if (oddsValues.length >= 2) {
          results.push({
            homeTeam,
            awayTeam,
            odds: oddsValues.slice(0, 3), // Take first 3 (home, draw, away)
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
          throw new BotBlockedError(`Blocked by bot protection on oddsdigger`);
        }
      }

      // Then check if the page explicitly says "no data available"
      for (const pattern of NO_DATA_PATTERNS) {
        if (pattern.test(pageText)) {
          logger.info(`Detected "no data" message on ${url}: ${pattern.toString()}`);
          throw new NoDataAvailableError(`No matches available for ${sportSlug} on oddsdigger`);
        }
      }
    }

    for (const event of scrapedEvents) {
      // OddsDigger odds order: Home, Draw (if applicable), Away
      const homeWin = event.odds[0];
      const draw = event.odds.length >= 3 ? event.odds[1] : undefined;
      const awayWin = event.odds.length >= 3 ? event.odds[2] : event.odds[1];

      if (homeWin > 1 && awayWin > 1) {
        odds.push({
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          homeWin,
          draw: draw && draw > 1 ? draw : undefined,
          awayWin,
          source: 'oddsdigger',
          bookmakerCount: 1,
          scrapedAt: new Date(),
        });
      }
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

export default oddsDiggerSource;
