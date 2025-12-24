/**
 * OddsPortal Scraper
 *
 * Scrapes odds from oddsportal.com - our primary source with 80+ bookmakers.
 */

import type { Page } from 'playwright';
import type { OddsSource, OddsSourceConfig, NormalizedOdds } from './types.js';
import { NoDataAvailableError, NO_DATA_PATTERNS, BotBlockedError, BOT_BLOCKED_PATTERNS } from './types.js';
import { createJobLogger } from '../logger.js';
import { waitWithJitter } from '../browser/behavior.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logger = createJobLogger('odds-oddsportal');
const DEBUG_DIR = '/tmp/scraper-debug';

export const oddsPortalConfig: OddsSourceConfig = {
  name: 'oddsportal',
  domain: 'oddsportal.com',
  enabled: true,
  priority: 1,
  cooldownMinutes: 90, // 1.5 hours minimum
  sportUrls: {
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
  },
};

export const oddsPortalSource: OddsSource = {
  config: oddsPortalConfig,
  scrape: scrapeOddsPortal,
};

async function scrapeOddsPortal(page: Page, sportSlug: string): Promise<NormalizedOdds[]> {
  const allOdds: NormalizedOdds[] = [];
  const urls = oddsPortalConfig.sportUrls[sportSlug] || oddsPortalConfig.sportUrls.football;

  logger.info(`Fetching ${sportSlug} odds from ${urls.length} URL(s)`);

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

      if (allOdds.length >= 20) {
        logger.info(`Got ${allOdds.length} events, stopping URL iteration`);
        break;
      }
    } catch (error) {
      logger.warn(`Failed to scrape URL: ${url}`, { error });
    }

    await waitWithJitter(1000);
  }

  logger.info(`Retrieved ${allOdds.length} total ${sportSlug} events`);
  return allOdds;
}

async function scrapeOddsUrl(page: Page, url: string, sportSlug: string): Promise<NormalizedOdds[]> {
  const odds: NormalizedOdds[] = [];

  logger.info(`Scraping ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await waitWithJitter(2000);

    // Handle cookie consent
    try {
      const consentButton = await page.$('#onetrust-accept-btn-handler, [id*="accept"], button[class*="accept"], .onetrust-close-btn-handler');
      if (consentButton) {
        await consentButton.click();
        logger.info('Clicked cookie consent button');
        await waitWithJitter(2000);
      }
    } catch {
      // No consent button
    }

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await waitWithJitter(1500);

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      window.scrollBy(0, 300);
    });
    await waitWithJitter(3000);

    await page
      .waitForSelector(
        '[class*="eventRow"], [class*="event-row"], [class*="flex"][class*="border"], table tbody tr',
        { timeout: 15000 }
      )
      .catch(() => {
        logger.warn('No event rows found');
      });

    await waitWithJitter(2000);

    // Debug info
    const debugInfo = await page.evaluate(() => {
      const title = document.title;
      const eventRows = document.querySelectorAll('[class*="eventRow"]').length;
      const oddsPattern = (document.body.textContent || '').match(/\d+\.\d{1,2}/g) || [];
      const html = document.body.innerHTML;
      return { title, eventRows, oddsCount: oddsPattern.length, html };
    });
    logger.info(`Debug: ${debugInfo.title}, eventRows=${debugInfo.eventRows}, oddsPatterns=${debugInfo.oddsCount}`);

    // Save HTML for debugging
    try {
      await mkdir(DEBUG_DIR, { recursive: true });
      const filename = join(DEBUG_DIR, `oddsportal-${sportSlug}-${Date.now()}.html`);
      await writeFile(filename, debugInfo.html);
    } catch {
      // Ignore
    }

    // Extract events with odds
    const scrapedEvents = await page.evaluate(() => {
      const results: Array<{
        homeTeam: string;
        awayTeam: string;
        odds: { home: string; draw: string; away: string } | null;
      }> = [];

      const eventRows = document.querySelectorAll('.eventRow, [class*="eventRow"]');

      eventRows.forEach((row) => {
        try {
          const participantNames = row.querySelectorAll('.participant-name');
          if (participantNames.length < 2) return;

          const homeTeam = participantNames[0]?.textContent?.trim() || '';
          const awayTeam = participantNames[1]?.textContent?.trim() || '';

          if (!homeTeam || !awayTeam || homeTeam.length < 2 || awayTeam.length < 2) return;

          const allOddsElements = row.querySelectorAll('p[data-testid*="odd-container"]');
          const oddsValues: string[] = [];

          allOddsElements.forEach((el) => {
            const text = el.textContent?.trim() || '';
            if (/^\d+\.\d+$/.test(text)) {
              oddsValues.push(text);
            }
          });

          // Fallback
          if (oddsValues.length === 0) {
            const winningOdds = row.querySelector('[data-testid="odd-container-winning"]');
            const defaultOdds = row.querySelector('[data-testid="odd-container-default"]');
            const homeOdds = winningOdds?.textContent?.trim() || '';
            const awayOdds = defaultOdds?.textContent?.trim() || '';
            if (/^\d+\.\d+$/.test(homeOdds)) oddsValues.push(homeOdds);
            if (/^\d+\.\d+$/.test(awayOdds)) oddsValues.push(awayOdds);
          }

          let oddsData: { home: string; draw: string; away: string } | null = null;
          if (oddsValues.length >= 2) {
            if (oddsValues.length === 2) {
              oddsData = { home: oddsValues[0]!, draw: '', away: oddsValues[1]! };
            } else if (oddsValues.length >= 3) {
              oddsData = { home: oddsValues[0]!, draw: oddsValues[1]!, away: oddsValues[2]! };
            }
          }

          if (oddsData) {
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
          throw new BotBlockedError(`Blocked by bot protection on oddsportal`);
        }
      }

      // Then check if the page explicitly says "no data available"
      for (const pattern of NO_DATA_PATTERNS) {
        if (pattern.test(pageText)) {
          logger.info(`Detected "no data" message on ${url}: ${pattern.toString()}`);
          throw new NoDataAvailableError(`No matches available for ${sportSlug} on oddsportal`);
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
            source: 'oddsportal',
            bookmakerCount: 1,
            scrapedAt: new Date(),
          });
        }
      }
    }

    logger.info(`Retrieved ${odds.length} events with valid odds from ${url}`);
  } catch (error) {
    logger.warn(`Failed to scrape: ${url}`, { error });
  }

  return odds;
}

export default oddsPortalSource;
