/**
 * BMBets Scraper
 *
 * Scrapes odds from bmbets.com - 55+ bookmakers, 25 sports, good for arbitrage.
 * Dynamic content - requires waiting for JavaScript to load match data.
 */

import type { Page } from 'playwright';
import type { OddsSource, OddsSourceConfig, NormalizedOdds } from './types.js';
import { NoDataAvailableError, NO_DATA_PATTERNS, BotBlockedError, BOT_BLOCKED_PATTERNS } from './types.js';
import { createJobLogger } from '../logger.js';
import { waitWithJitter } from '../browser/behavior.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logger = createJobLogger('odds-bmbets');
const DEBUG_DIR = '/tmp/scraper-debug';

export const bmBetsConfig: OddsSourceConfig = {
  name: 'bmbets',
  domain: 'bmbets.com',
  enabled: true,
  priority: 2,
  cooldownMinutes: 120, // 2 hours
  sportUrls: {
    football: [
      'https://bmbets.com/football/',
      'https://bmbets.com/football/england/premier-league/',
      'https://bmbets.com/football/spain/la-liga/',
    ],
    basketball: [
      'https://bmbets.com/basketball/usa/nba/',
      'https://bmbets.com/basketball/',
    ],
    tennis: [
      'https://bmbets.com/tennis/',
    ],
  },
};

export const bmBetsSource: OddsSource = {
  config: bmBetsConfig,
  scrape: scrapeBMBets,
};

async function scrapeBMBets(page: Page, sportSlug: string): Promise<NormalizedOdds[]> {
  const allOdds: NormalizedOdds[] = [];
  const urls = bmBetsConfig.sportUrls[sportSlug] || bmBetsConfig.sportUrls.football;

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
        logger.info(`Got ${allOdds.length} events, stopping`);
        break;
      }
    } catch (error) {
      logger.warn(`Failed to scrape URL: ${url}`, { error });
    }

    await waitWithJitter(2000);
  }

  logger.info(`Retrieved ${allOdds.length} total ${sportSlug} events`);
  return allOdds;
}

async function scrapeUrl(page: Page, url: string, sportSlug: string): Promise<NormalizedOdds[]> {
  const odds: NormalizedOdds[] = [];

  logger.info(`Scraping ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await waitWithJitter(3000);

    // Handle cookie consent
    try {
      const consentButton = await page.$('[class*="cookie"] button, [class*="consent"] button, .accept-cookies, #accept-cookies');
      if (consentButton) {
        await consentButton.click();
        logger.info('Clicked cookie consent');
        await waitWithJitter(1500);
      }
    } catch {
      // No consent
    }

    // Wait for dynamic content to load - BMBets uses JavaScript rendering
    await page.waitForSelector('.match-row, .event-row, [class*="match"], table tr', { timeout: 20000 }).catch(() => {
      logger.warn('No match rows found after waiting');
    });

    // Scroll to trigger lazy loading
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await waitWithJitter(1000);
    }

    // Wait for any additional loading
    await waitWithJitter(2000);

    // Save debug HTML
    const html = await page.evaluate(() => document.body.innerHTML);
    try {
      await mkdir(DEBUG_DIR, { recursive: true });
      const filename = join(DEBUG_DIR, `bmbets-${sportSlug}-${Date.now()}.html`);
      await writeFile(filename, html);
      logger.info(`Saved debug HTML to ${filename}`);
    } catch {
      // Ignore
    }

    // Extract matches - BMBets uses various structures
    const scrapedEvents = await page.evaluate(() => {
      const results: Array<{
        homeTeam: string;
        awayTeam: string;
        odds: { home: string; draw: string; away: string } | null;
      }> = [];

      // Try table rows first
      const tableRows = document.querySelectorAll('table tbody tr, .match-row, .event-row, [class*="match-item"]');

      tableRows.forEach((row) => {
        try {
          // Look for team names in various possible locations
          const teamElements = row.querySelectorAll('.team-name, .team, [class*="team"], td:first-child a, .participant');

          // Try to find teams from text that looks like "Team A vs Team B" or "Team A - Team B"
          const rowText = row.textContent || '';
          const vsMatch = rowText.match(/([A-Za-z0-9\s&.']+?)\s*(?:vs?\.?|-)\s*([A-Za-z0-9\s&.']+?)(?:\s*\d|$)/i);

          let homeTeam = '';
          let awayTeam = '';

          if (teamElements.length >= 2) {
            homeTeam = teamElements[0]?.textContent?.trim() || '';
            awayTeam = teamElements[1]?.textContent?.trim() || '';
          } else if (vsMatch) {
            homeTeam = vsMatch[1].trim();
            awayTeam = vsMatch[2].trim();
          }

          if (!homeTeam || !awayTeam || homeTeam.length < 2 || awayTeam.length < 2) return;

          // Look for odds - typically in spans or tds with decimal numbers
          const oddsElements = row.querySelectorAll('.odds, .odd, [class*="odds"], td span, td');
          const oddsValues: string[] = [];

          oddsElements.forEach((el) => {
            const text = el.textContent?.trim() || '';
            // Match decimal odds like 1.50, 2.35, etc.
            if (/^\d+\.\d{2}$/.test(text) || /^\d+\.\d$/.test(text)) {
              const val = parseFloat(text);
              if (val >= 1.01 && val <= 100) { // Reasonable odds range
                oddsValues.push(text);
              }
            }
          });

          // Remove duplicates
          const uniqueOdds = [...new Set(oddsValues)];

          let oddsData: { home: string; draw: string; away: string } | null = null;
          if (uniqueOdds.length === 2) {
            oddsData = { home: uniqueOdds[0]!, draw: '', away: uniqueOdds[1]! };
          } else if (uniqueOdds.length >= 3) {
            oddsData = { home: uniqueOdds[0]!, draw: uniqueOdds[1]!, away: uniqueOdds[2]! };
          }

          if (oddsData && homeTeam && awayTeam) {
            results.push({ homeTeam, awayTeam, odds: oddsData });
          }
        } catch {
          // Skip
        }
      });

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
          throw new BotBlockedError(`Blocked by bot protection on bmbets`);
        }
      }

      // Then check if the page explicitly says "no data available"
      for (const pattern of NO_DATA_PATTERNS) {
        if (pattern.test(pageText)) {
          logger.info(`Detected "no data" message on ${url}: ${pattern.toString()}`);
          throw new NoDataAvailableError(`No matches available for ${sportSlug} on bmbets`);
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
            source: 'bmbets',
            bookmakerCount: 1,
            scrapedAt: new Date(),
          });
        }
      }
    }

    logger.info(`Retrieved ${odds.length} events with valid odds`);
  } catch (error) {
    // Re-throw BotBlockedError and NoDataAvailableError so rotation logic can handle them
    if (error instanceof BotBlockedError || error instanceof NoDataAvailableError) {
      throw error;
    }
    logger.warn(`Failed to scrape: ${url}`, { error });
  }

  return odds;
}

export default bmBetsSource;
