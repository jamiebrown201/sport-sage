/**
 * Nicer Odds Scraper
 *
 * Scrapes odds from nicerodds.co.uk - UK-focused, 15+ bookmakers.
 * Simpler structure, good fallback source.
 */

import type { Page } from 'playwright';
import type { OddsSource, OddsSourceConfig, NormalizedOdds } from './types.js';
import { NoDataAvailableError, NO_DATA_PATTERNS, BotBlockedError, BOT_BLOCKED_PATTERNS } from './types.js';
import { createJobLogger } from '../logger.js';
import { waitWithJitter } from '../browser/behavior.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logger = createJobLogger('odds-nicerodds');
const DEBUG_DIR = '/tmp/scraper-debug';

export const nicerOddsConfig: OddsSourceConfig = {
  name: 'nicerodds',
  domain: 'nicerodds.co.uk',
  enabled: true,
  priority: 3,
  cooldownMinutes: 120, // 2 hours
  sportUrls: {
    football: [
      'https://nicerodds.co.uk/premier-league-betting-odds',
      'https://nicerodds.co.uk/la-liga-betting-odds',
      'https://nicerodds.co.uk/football',
    ],
    basketball: [
      'https://nicerodds.co.uk/nba-betting-odds',
      'https://nicerodds.co.uk/basketball',
    ],
    tennis: [
      'https://nicerodds.co.uk/tennis',
    ],
  },
};

export const nicerOddsSource: OddsSource = {
  config: nicerOddsConfig,
  scrape: scrapeNicerOdds,
};

async function scrapeNicerOdds(page: Page, sportSlug: string): Promise<NormalizedOdds[]> {
  const allOdds: NormalizedOdds[] = [];
  const urls = nicerOddsConfig.sportUrls[sportSlug] || nicerOddsConfig.sportUrls.football;

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

    // Handle cookie consent (GDPR)
    try {
      const consentButton = await page.$('[class*="cookie"] button, [class*="consent"] button, .cc-accept, #accept-cookies, button[onclick*="cookie"]');
      if (consentButton) {
        await consentButton.click();
        logger.info('Clicked cookie consent');
        await waitWithJitter(1500);
      }
    } catch {
      // No consent
    }

    // Wait for match content
    await page.waitForSelector('.match, .fixture, .event, table tr, [class*="match"]', { timeout: 20000 }).catch(() => {
      logger.warn('No match elements found after waiting');
    });

    // Scroll page
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 300));
      await waitWithJitter(800);
    }

    await waitWithJitter(2000);

    // Save debug HTML
    const html = await page.evaluate(() => document.body.innerHTML);
    try {
      await mkdir(DEBUG_DIR, { recursive: true });
      const filename = join(DEBUG_DIR, `nicerodds-${sportSlug}-${Date.now()}.html`);
      await writeFile(filename, html);
      logger.info(`Saved debug HTML to ${filename}`);
    } catch {
      // Ignore
    }

    // Extract matches - Nicer Odds typically uses tables for odds comparison
    const scrapedEvents = await page.evaluate(() => {
      const results: Array<{
        homeTeam: string;
        awayTeam: string;
        odds: { home: string; draw: string; away: string } | null;
      }> = [];

      // Nicer Odds uses table structure for odds
      const matchElements = document.querySelectorAll('table tbody tr, .match, .fixture, [class*="event-row"]');

      matchElements.forEach((row) => {
        try {
          // Look for team names
          const teamElements = row.querySelectorAll('.team, .team-name, [class*="team"], a[href*="team"], td:first-child');
          const rowText = row.textContent || '';

          let homeTeam = '';
          let awayTeam = '';

          // Try finding "Home v Away" or "Home vs Away" pattern
          const vsMatch = rowText.match(/([A-Za-z0-9\s&.'()-]+?)\s+(?:v|vs|V|VS)\s+([A-Za-z0-9\s&.'()-]+?)(?:\s*\d|$)/);
          const dashMatch = rowText.match(/([A-Za-z0-9\s&.'()-]+?)\s*-\s*([A-Za-z0-9\s&.'()-]+?)(?:\s*\d|$)/);

          if (teamElements.length >= 2) {
            homeTeam = teamElements[0]?.textContent?.trim().replace(/\s+/g, ' ') || '';
            awayTeam = teamElements[1]?.textContent?.trim().replace(/\s+/g, ' ') || '';
          } else if (vsMatch) {
            homeTeam = vsMatch[1].trim();
            awayTeam = vsMatch[2].trim();
          } else if (dashMatch) {
            homeTeam = dashMatch[1].trim();
            awayTeam = dashMatch[2].trim();
          }

          // Clean up team names
          homeTeam = homeTeam.replace(/^\d+\s*/, '').trim();
          awayTeam = awayTeam.replace(/^\d+\s*/, '').trim();

          if (!homeTeam || !awayTeam || homeTeam.length < 2 || awayTeam.length < 2) return;
          if (homeTeam.length > 50 || awayTeam.length > 50) return; // Too long, probably wrong element

          // Look for odds - decimal format
          const oddsElements = row.querySelectorAll('.odds, .odd, [class*="odds"], span, td');
          const oddsValues: string[] = [];

          oddsElements.forEach((el) => {
            const text = el.textContent?.trim() || '';
            // Match decimal odds
            const match = text.match(/^(\d+\.\d{1,2})$/);
            if (match) {
              const val = parseFloat(match[1]);
              if (val >= 1.01 && val <= 100) {
                oddsValues.push(match[1]);
              }
            }
          });

          // Also look for fractional odds and convert
          oddsElements.forEach((el) => {
            const text = el.textContent?.trim() || '';
            const fracMatch = text.match(/^(\d+)\/(\d+)$/);
            if (fracMatch) {
              const decimal = (parseInt(fracMatch[1]) / parseInt(fracMatch[2])) + 1;
              if (decimal >= 1.01 && decimal <= 100) {
                oddsValues.push(decimal.toFixed(2));
              }
            }
          });

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
          throw new BotBlockedError(`Blocked by bot protection on nicerodds`);
        }
      }

      // Then check if the page explicitly says "no data available"
      for (const pattern of NO_DATA_PATTERNS) {
        if (pattern.test(pageText)) {
          logger.info(`Detected "no data" message on ${url}: ${pattern.toString()}`);
          throw new NoDataAvailableError(`No matches available for ${sportSlug} on nicerodds`);
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
            source: 'nicerodds',
            bookmakerCount: 1,
            scrapedAt: new Date(),
          });
        }
      }
    }

    logger.info(`Retrieved ${odds.length} events with valid odds`);
  } catch (error) {
    logger.warn(`Failed to scrape: ${url}`, { error });
  }

  return odds;
}

export default nicerOddsSource;
