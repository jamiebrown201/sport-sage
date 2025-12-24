/**
 * BetExplorer Scraper
 *
 * Scrapes odds from betexplorer.com - same company as OddsPortal but simpler HTML.
 * Very clean structure with odds in data-odd attributes.
 */

import type { Page } from 'playwright';
import type { OddsSource, OddsSourceConfig, NormalizedOdds } from './types.js';
import { NoDataAvailableError, NO_DATA_PATTERNS, BotBlockedError, BOT_BLOCKED_PATTERNS } from './types.js';
import { createJobLogger } from '../logger.js';
import { waitWithJitter } from '../browser/behavior.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logger = createJobLogger('odds-betexplorer');
const DEBUG_DIR = '/tmp/scraper-debug';

export const betExplorerConfig: OddsSourceConfig = {
  name: 'betexplorer',
  domain: 'betexplorer.com',
  enabled: true,
  priority: 1, // High priority - clean HTML, reliable
  cooldownMinutes: 60,
  sportUrls: {
    football: [
      'https://www.betexplorer.com/football/',
      'https://www.betexplorer.com/football/england/premier-league/',
    ],
    basketball: [
      'https://www.betexplorer.com/basketball/usa/nba/',
      'https://www.betexplorer.com/basketball/',
    ],
    tennis: [
      'https://www.betexplorer.com/tennis/',
    ],
  },
};

export const betExplorerSource: OddsSource = {
  config: betExplorerConfig,
  scrape: scrapeBetExplorer,
};

async function scrapeBetExplorer(page: Page, sportSlug: string): Promise<NormalizedOdds[]> {
  const allOdds: NormalizedOdds[] = [];
  const urls = betExplorerConfig.sportUrls[sportSlug] || betExplorerConfig.sportUrls.football;

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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitWithJitter(2000);

    // Wait for the main table to load
    try {
      await page.waitForSelector('table.table-main tr[data-dt]', { timeout: 15000 });
    } catch {
      logger.warn('No match rows found after waiting');
    }

    // Save debug HTML
    try {
      await mkdir(DEBUG_DIR, { recursive: true });
      const html = await page.content();
      const debugPath = join(DEBUG_DIR, `betexplorer-${sportSlug}-${Date.now()}.html`);
      await writeFile(debugPath, html);
      logger.info(`Saved debug HTML to ${debugPath}`);
    } catch (e) {
      logger.warn('Failed to save debug HTML', { error: e });
    }

    // Parse match data from the page
    // BetExplorer structure:
    // <tr data-dt="24,12,2025,21,00">
    //   <td><span class="table-main__time">21:00</span><a href="...">Team A - Team B</a></td>
    //   <td class="table-main__odds" data-odd="2.12">...</td>  (home)
    //   <td class="table-main__odds" data-odd="3.00">...</td>  (draw)
    //   <td class="table-main__odds" data-odd="3.73">...</td>  (away)
    // </tr>

    const scrapedEvents = await page.evaluate(() => {
      const results: Array<{
        homeTeam: string;
        awayTeam: string;
        odds: { home: string; draw: string; away: string } | null;
      }> = [];

      // Find all match rows
      const matchRows = Array.from(document.querySelectorAll('table.table-main tr[data-dt]'));

      for (const row of matchRows) {
        // Get team names from the link text
        const teamLink = row.querySelector('td a[href*="/"]');
        if (!teamLink) continue;

        const teamText = teamLink.textContent?.trim() || '';
        const teams = teamText.split(' - ').map((t: string) => t.trim());
        if (teams.length !== 2) continue;

        // Get odds from data-odd attributes
        const oddsCells = row.querySelectorAll('td.table-main__odds');
        if (oddsCells.length < 2) continue; // Tennis has 2, football has 3

        // Get the button inside each cell which has the data-odd attribute
        const homeOddBtn = oddsCells[0].querySelector('button[data-odd]');
        const awayOddBtn = oddsCells.length >= 3
          ? oddsCells[2].querySelector('button[data-odd]')
          : oddsCells[1].querySelector('button[data-odd]'); // Tennis: 2nd cell is away
        const drawOddBtn = oddsCells.length >= 3
          ? oddsCells[1].querySelector('button[data-odd]')
          : null; // No draw for tennis

        const homeOdd = homeOddBtn?.getAttribute('data-odd') || '';
        const awayOdd = awayOddBtn?.getAttribute('data-odd') || '';
        const drawOdd = drawOddBtn?.getAttribute('data-odd') || '';

        if (homeOdd && awayOdd) {
          results.push({
            homeTeam: teams[0],
            awayTeam: teams[1],
            odds: {
              home: homeOdd,
              draw: drawOdd || '0',
              away: awayOdd,
            },
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

      // First check if we're being blocked (Cloudflare, captcha, etc.)
      for (const pattern of BOT_BLOCKED_PATTERNS) {
        if (pattern.test(pageHtml) || pattern.test(pageText)) {
          logger.warn(`Detected bot blocking on ${url}: ${pattern.toString()}`);
          throw new BotBlockedError(`Blocked by bot protection on betexplorer`);
        }
      }

      // Then check if the page explicitly says "no data available"
      for (const pattern of NO_DATA_PATTERNS) {
        if (pattern.test(pageText)) {
          logger.info(`Detected "no data" message on ${url}: ${pattern.toString()}`);
          throw new NoDataAvailableError(`No matches available for ${sportSlug} on betexplorer`);
        }
      }
    }

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
            source: 'betexplorer',
            bookmakerCount: 1,
            scrapedAt: new Date(),
          });
        }
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

export default betExplorerSource;
