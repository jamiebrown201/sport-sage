/**
 * Sync Fixtures Job
 *
 * Scrapes upcoming fixtures from FlashScore and stores them in the database.
 * Adapted from Lambda handler for VPS deployment.
 */

import { sports, competitions, findOrCreateTeam } from '@sport-sage/database';
import { and, sql } from 'drizzle-orm';
import { getDb } from '../database/client.js';
import { getBrowserPool } from '../browser/pool.js';
import { createJobLogger } from '../logger.js';
import { recordRequest } from '../monitoring/metrics.js';
import { getRateLimitDetector, extractDomain } from '../rate-limit/detector.js';
import { simulateHumanBehavior, waitWithJitter } from '../browser/behavior.js';

// Import scraper classes - these will be copied from the existing scraper package
// For now, we'll inline a simplified version
import type { Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const logger = createJobLogger('sync-fixtures');
const DEBUG_DIR = '/tmp/scraper-debug';

const SPORTS_TO_SYNC = ['football', 'tennis', 'basketball', 'darts', 'cricket'] as const;

interface ScrapedFixture {
  externalId: string;
  sportSlug: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  source: string;
}

export async function runSyncFixtures(): Promise<void> {
  logger.info('Starting fixtures sync');
  const startTime = Date.now();

  const browserPool = getBrowserPool();
  const rateLimiter = getRateLimitDetector();
  const db = getDb();

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  try {
    for (const sportSlug of SPORTS_TO_SYNC) {
      logger.info(`Syncing fixtures for ${sportSlug}`);
      // Reset debug counter for each sport
      debugCount = 0;

      const { page, release } = await browserPool.getPage();

      try {
        // Wait for rate limit before scraping
        await rateLimiter.waitForRateLimit('flashscore.com');

        // Scrape fixtures with human-like behavior
        await simulateHumanBehavior(page);
        const fixtures = await scrapeFlashscoreFixtures(page, sportSlug, 7);

        logger.info(`Found ${fixtures.length} fixtures for ${sportSlug}`);
        recordRequest('flashscore', true, Date.now() - startTime);
        rateLimiter.recordSuccess('flashscore.com');

        // Get sport from DB
        const sportResults = await db
          .select()
          .from(sports)
          .where(sql`${sports.slug}::text = ${sportSlug}`);
        const sport = sportResults[0];

        if (!sport) {
          logger.warn(`Sport not found: ${sportSlug}`);
          continue;
        }

        // Build competition cache
        const competitionCache = new Map<string, string>();

        const getCompetitionId = async (fixture: ScrapedFixture): Promise<string> => {
          const cached = competitionCache.get(fixture.competition);
          if (cached) return cached;

          // Find or create competition
          let competition = await db.query.competitions.findFirst({
            where: and(
              sql`${competitions.sportId} = ${sport.id}::uuid`,
              sql`${competitions.name} = ${fixture.competition}`
            ),
          });

          if (!competition) {
            const [newComp] = await db
              .insert(competitions)
              .values({
                sportId: sport.id,
                name: fixture.competition,
                externalFlashscoreId: fixture.competition,
              })
              .returning();
            competition = newComp;
          }

          competitionCache.set(fixture.competition, competition!.id);
          return competition!.id;
        };

        // Process each fixture
        for (const fixture of fixtures) {
          try {
            const competitionId = await getCompetitionId(fixture);
            const result = await findOrCreateEvent(fixture, sport.id, competitionId);

            if (result.isNew) {
              totalCreated++;
            } else {
              totalUpdated++;
            }
          } catch (error) {
            totalFailed++;
            logger.error(`Failed to process fixture: ${fixture.homeTeam} vs ${fixture.awayTeam}`, {
              error,
            });
          }
        }

        logger.info(`Completed ${sportSlug}`, {
          created: totalCreated,
          updated: totalUpdated,
          failed: totalFailed,
        });
      } catch (error) {
        recordRequest('flashscore', false, Date.now() - startTime, { blocked: true });
        rateLimiter.recordFailure('flashscore.com');
        logger.error(`Failed to scrape fixtures for ${sportSlug}`, { error });
      } finally {
        await release();
      }

      // Delay between sports
      await waitWithJitter(2000);
    }

    logger.info('Fixtures sync completed', {
      created: totalCreated,
      updated: totalUpdated,
      failed: totalFailed,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Fixtures sync failed', { error });
    throw error;
  }
}

// Debug helper - save screenshot and HTML for analysis
async function saveDebugInfo(page: Page, name: string): Promise<void> {
  try {
    await mkdir(DEBUG_DIR, { recursive: true });
    const timestamp = Date.now();

    // Save screenshot
    const screenshotPath = join(DEBUG_DIR, `${name}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`Debug screenshot saved: ${screenshotPath}`);

    // Save HTML
    const htmlPath = join(DEBUG_DIR, `${name}-${timestamp}.html`);
    const html = await page.content();
    await writeFile(htmlPath, html);
    logger.info(`Debug HTML saved: ${htmlPath}`);

    // Log URL and title
    const url = page.url();
    const title = await page.title();
    logger.info(`Page info: ${url} - "${title}"`);

    // Log any cookie consent or blocking indicators
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
    if (bodyText.toLowerCase().includes('cookie') ||
        bodyText.toLowerCase().includes('consent') ||
        bodyText.toLowerCase().includes('captcha') ||
        bodyText.toLowerCase().includes('blocked') ||
        bodyText.toLowerCase().includes('access denied')) {
      logger.warn(`Potential blocking detected. Body preview: ${bodyText.substring(0, 500)}`);
    }
  } catch (error) {
    logger.error('Failed to save debug info', { error });
  }
}

// Simplified fixture scraper - this is inlined from the existing scraper
// In production, you might want to share this code properly
async function scrapeFlashscoreFixtures(
  page: Page,
  sportSlug: string,
  days: number
): Promise<ScrapedFixture[]> {
  const fixtures: ScrapedFixture[] = [];
  const baseUrl = `https://www.flashscore.com/${sportSlug}/`;

  // Competition URLs for more reliable scraping
  const competitionUrls: Array<{ url: string; competition: string }> =
    getCompetitionUrls(sportSlug);

  for (const { url, competition } of competitionUrls) {
    try {
      logger.info(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitWithJitter(1500, 20); // Increased wait time for content to load

      // Try to handle cookie consent if present
      try {
        const consentButton = await page.$('#onetrust-accept-btn-handler');
        if (consentButton) {
          logger.info('Cookie consent banner detected, clicking accept');
          await consentButton.click();
          await waitWithJitter(1000, 10);
        }
      } catch {
        // No consent banner, continue
      }

      // Wait for match elements
      const selector = await waitForMatchElements(page);
      if (!selector) {
        logger.warn(`No match elements found for ${competition}`);
        // Save debug info when no matches are found
        await saveDebugInfo(page, `${sportSlug}-${competition.replace(/[^a-z0-9]/gi, '-')}`);
        continue;
      }

      const matches = await page.$$(selector);
      logger.info(`Found ${matches.length} match elements using selector: ${selector}`);

      for (const match of matches) {
        const fixture = await parseMatchElement(match, sportSlug, competition);
        if (fixture && isWithinDays(fixture.startTime, days)) {
          fixtures.push(fixture);
        }
      }

      logger.info(`Parsed ${fixtures.length} valid fixtures from ${competition}`);
    } catch (error) {
      logger.warn(`Failed to scrape ${competition}`, { error });
      await saveDebugInfo(page, `error-${sportSlug}-${competition.replace(/[^a-z0-9]/gi, '-')}`);
    }
  }

  return fixtures;
}

function getCompetitionUrls(sportSlug: string): Array<{ url: string; competition: string }> {
  const urls: Record<string, Array<{ url: string; competition: string }>> = {
    football: [
      {
        url: 'https://www.flashscore.com/football/england/premier-league/fixtures/',
        competition: 'England: Premier League',
      },
      {
        url: 'https://www.flashscore.com/football/england/championship/fixtures/',
        competition: 'England: Championship',
      },
      {
        url: 'https://www.flashscore.com/football/spain/laliga/fixtures/',
        competition: 'Spain: LaLiga',
      },
      {
        url: 'https://www.flashscore.com/football/germany/bundesliga/fixtures/',
        competition: 'Germany: Bundesliga',
      },
      {
        url: 'https://www.flashscore.com/football/italy/serie-a/fixtures/',
        competition: 'Italy: Serie A',
      },
      {
        url: 'https://www.flashscore.com/football/france/ligue-1/fixtures/',
        competition: 'France: Ligue 1',
      },
      {
        url: 'https://www.flashscore.com/football/europe/champions-league/fixtures/',
        competition: 'Europe: Champions League',
      },
      {
        url: 'https://www.flashscore.com/football/europe/europa-league/fixtures/',
        competition: 'Europe: Europa League',
      },
    ],
    tennis: [
      {
        url: 'https://www.flashscore.com/tennis/atp-singles/fixtures/',
        competition: 'ATP Singles',
      },
      {
        url: 'https://www.flashscore.com/tennis/wta-singles/fixtures/',
        competition: 'WTA Singles',
      },
    ],
    basketball: [
      { url: 'https://www.flashscore.com/basketball/usa/nba/fixtures/', competition: 'USA: NBA' },
      {
        url: 'https://www.flashscore.com/basketball/europe/euroleague/fixtures/',
        competition: 'Europe: Euroleague',
      },
    ],
    darts: [
      {
        url: 'https://www.flashscore.com/darts/world/world-championship/fixtures/',
        competition: 'World Championship',
      },
    ],
    cricket: [
      {
        url: 'https://www.flashscore.com/cricket/world/icc-world-test-championship/fixtures/',
        competition: 'ICC World Test Championship',
      },
    ],
  };

  return urls[sportSlug] || [];
}

async function waitForMatchElements(page: Page): Promise<string | null> {
  // Possible selectors for match elements across different sports
  const selectors = [
    '.event__match',           // Standard selector
    '.event__match--scheduled', // Scheduled matches only
    '.event__match--live',     // Live matches
    '[class*="event__match"]', // Partial match
    '.sportName .event__match', // Under sport container
  ];

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 15000 });
      const count = await page.$$(selector).then((els) => els.length);
      if (count > 0) {
        logger.info(`Found matches with selector: ${selector} (${count} elements)`);
        return selector;
      }
    } catch {
      continue;
    }
  }

  // Last resort - check if the page has any events at all
  try {
    const hasEvents = await page.$('.sportName');
    if (hasEvents) {
      logger.debug('Sport container found but no matches - possibly no scheduled games');
    } else {
      logger.warn('No sport container found - page may not have loaded properly');
    }
  } catch {
    // Ignore
  }

  return null;
}

// Track debug output to avoid spamming logs
let debugCount = 0;
const MAX_DEBUG_LOGS = 5;

async function parseMatchElement(
  element: any,
  sportSlug: string,
  competition: string
): Promise<ScrapedFixture | null> {
  const shouldDebug = debugCount < MAX_DEBUG_LOGS;

  try {
    const id = await element.getAttribute('id');
    if (!id) {
      if (shouldDebug) {
        debugCount++;
        logger.warn('parseMatchElement: no ID attribute');
      }
      return null;
    }

    const externalId = id.replace(/g_\d+_/, '');

    // Get team names
    const homeTeam = await getParticipantName(element, 'home');
    const awayTeam = await getParticipantName(element, 'away');
    if (!homeTeam || !awayTeam) {
      if (shouldDebug) {
        debugCount++;
        // Get element's class names for debugging
        const classes = await element.getAttribute('class');
        const innerHtml = await element.evaluate((el: Element) => el.innerHTML?.substring(0, 500));
        logger.warn('parseMatchElement: missing team names', {
          id,
          homeTeam,
          awayTeam,
          classes,
          innerHtml,
        });
      }
      return null;
    }

    // Get time
    const timeText = await getTimeText(element);
    const startTime = parseTime(timeText);
    if (!startTime) {
      if (shouldDebug) {
        debugCount++;
        logger.warn('parseMatchElement: failed to parse time', {
          id,
          homeTeam,
          awayTeam,
          timeText,
        });
      }
      return null;
    }

    return {
      externalId,
      sportSlug,
      competition,
      homeTeam,
      awayTeam,
      startTime,
      source: 'flashscore',
    };
  } catch (error) {
    if (shouldDebug) {
      debugCount++;
      logger.warn('parseMatchElement: exception', { error });
    }
    return null;
  }
}

async function getParticipantName(element: any, type: 'home' | 'away'): Promise<string | null> {
  // Flashscore uses different class names for different sports/layouts
  const selectors =
    type === 'home'
      ? [
          '.event__participant--home',
          '.event__homeParticipant',
          '.duelParticipant--home',
          '.participant__participantName--home',
          '.event__participant:first-of-type',
        ]
      : [
          '.event__participant--away',
          '.event__awayParticipant',
          '.duelParticipant--away',
          '.participant__participantName--away',
          '.event__participant:last-of-type',
        ];

  for (const selector of selectors) {
    try {
      const text = await element.$eval(selector, (el: Element) => el.textContent?.trim());
      if (text) return text;
    } catch {
      continue;
    }
  }

  // Fallback: try to get all participants and pick by index
  const participantSelectors = [
    '.event__participant',
    '.participant__participantName',
    '.participant__participantNameWrapper',
  ];

  for (const selector of participantSelectors) {
    try {
      const participants = await element.$$eval(selector, (els: Element[]) =>
        els.map((el) => el.textContent?.trim()).filter(Boolean)
      );
      if (participants.length >= 2) {
        return type === 'home' ? participants[0] : participants[1];
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function getTimeText(element: any): Promise<string | null> {
  const selectors = ['.event__time', '.event__stage'];

  for (const selector of selectors) {
    try {
      const text = await element.$eval(selector, (el: Element) => el.textContent?.trim());
      if (text) return text;
    } catch {
      continue;
    }
  }

  return null;
}

function parseTime(timeText: string | null): Date | null {
  if (!timeText) return null;

  const trimmed = timeText.trim();

  // Skip live match indicators - these are NOT scheduled times
  const liveIndicators = [
    /^\d{1,3}['+]?\d*$/, // "45", "45+", "45+2", "67'" (minute indicators)
    /^HT$/i, // Half time
    /^Half\s*Time$/i,
    /^FT$/i, // Full time
    /^Finished$/i,
    /^AET$/i, // After extra time
    /^Pen\.?$/i, // Penalties
    /^Break$/i, // Break
    /^\d+(st|nd|rd|th)$/i, // "1st", "2nd" quarter/set
    /^Q[1-4]$/i, // Quarter indicators
    /^Set\s?\d$/i, // Set indicators
    /^Live$/i, // Live indicator
    /^Playing$/i, // Playing indicator
    /^Postp\.?$/i, // Postponed
    /^Canc\.?$/i, // Cancelled
    /^Awarded$/i, // Awarded
    /^W\.?O\.?$/i, // Walkover
    /^Not Started$/i,
    /^Delayed$/i,
    /^Interrupted$/i,
    /^Abandoned$/i,
  ];

  if (liveIndicators.some((pattern) => pattern.test(trimmed))) {
    return null;
  }

  // Must contain a colon for time format
  if (!trimmed.includes(':')) {
    return null;
  }

  try {
    const now = new Date();
    const nowUTC = Date.now();

    // Check for date format: "DD.MM. HH:MM" or "DD.MM.YYYY HH:MM"
    if (trimmed.includes('.')) {
      // Split into date and time parts
      const parts = trimmed.split(' ').filter((p) => p.length > 0);
      if (parts.length < 2) return null;

      const datePart = parts[0];
      const timePart = parts[parts.length - 1];

      // Parse date (DD.MM. or DD.MM.YYYY)
      const dateParts = datePart.split('.').filter((p) => p.length > 0);
      if (dateParts.length < 2) return null;

      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);

      if (isNaN(day) || isNaN(month)) return null;

      // Parse time (HH:MM)
      const timeParts = timePart.split(':');
      if (timeParts.length < 2) return null;

      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);

      if (isNaN(hours) || isNaN(minutes)) return null;

      // Create date in UTC, then adjust for CET offset
      const year = now.getUTCFullYear();
      const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));

      // Adjust for CET: subtract 1 hour (winter) or 2 hours (summer) to get UTC
      const cetOffset = getCETOffset(utcDate);
      utcDate.setTime(utcDate.getTime() - cetOffset);

      // Handle year rollover (if date is in the past, assume next year)
      if (utcDate.getTime() < nowUTC - 24 * 60 * 60 * 1000) {
        utcDate.setUTCFullYear(utcDate.getUTCFullYear() + 1);
      }

      return utcDate;
    } else {
      // Time only format: "HH:MM" - assume today or tomorrow
      const timeParts = trimmed.split(':');
      if (timeParts.length < 2) return null;

      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);

      if (isNaN(hours) || isNaN(minutes)) return null;
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

      // Create date for today in UTC, adjust for CET
      const utcDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hours,
        minutes
      ));

      // Adjust for CET offset
      const cetOffset = getCETOffset(utcDate);
      utcDate.setTime(utcDate.getTime() - cetOffset);

      // If time has passed, assume tomorrow
      if (utcDate.getTime() < nowUTC) {
        utcDate.setTime(utcDate.getTime() + 24 * 60 * 60 * 1000);
      }

      return utcDate;
    }
  } catch {
    return null;
  }
}

/**
 * Get CET/CEST offset in milliseconds
 * CET = UTC+1 (winter), CEST = UTC+2 (summer)
 */
function getCETOffset(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  // Find last Sunday of March (DST starts at 2:00 CET -> 3:00 CEST)
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0));

  // Find last Sunday of October (DST ends at 3:00 CEST -> 2:00 CET)
  const octLast = new Date(Date.UTC(year, 9, 31));
  const dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0));

  // Check if date is in DST period (CEST = UTC+2)
  if (date >= dstStart && date < dstEnd) {
    return 2 * 60 * 60 * 1000; // CEST: +2 hours
  }

  return 1 * 60 * 60 * 1000; // CET: +1 hour
}

function isWithinDays(date: Date, days: number): boolean {
  const now = new Date();
  const maxDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return date >= now && date <= maxDate;
}

// Simplified event deduplication with team normalization
async function findOrCreateEvent(
  fixture: ScrapedFixture,
  sportId: string,
  competitionId: string
): Promise<{ eventId: string; isNew: boolean }> {
  const db = getDb();

  // Check for existing event by external ID
  const existing = await db.execute(sql`
    SELECT id FROM events
    WHERE external_flashscore_id = ${fixture.externalId}
    LIMIT 1
  `);

  if (existing.rows && existing.rows.length > 0) {
    return { eventId: (existing.rows[0] as any).id, isNew: false };
  }

  // Find or create teams using the normalization system
  // This creates team entries in the teams table and auto-learns aliases
  const homeTeamId = await findOrCreateTeam(db as any, fixture.homeTeam, fixture.source);
  const awayTeamId = await findOrCreateTeam(db as any, fixture.awayTeam, fixture.source);

  // Create new event with team IDs linked
  const result = await db.execute(sql`
    INSERT INTO events (
      sport_id, competition_id, competition_name,
      home_team_id, away_team_id,
      home_team_name, away_team_name,
      start_time, status, external_flashscore_id
    ) VALUES (
      ${sportId}::uuid, ${competitionId}::uuid, ${fixture.competition},
      ${homeTeamId}::uuid, ${awayTeamId}::uuid,
      ${fixture.homeTeam}, ${fixture.awayTeam},
      ${fixture.startTime.toISOString()}::timestamptz, 'scheduled'::event_status,
      ${fixture.externalId}
    ) RETURNING id
  `);

  const newEventId = (result.rows?.[0] as any)?.id;

  // Create default market
  await db.execute(sql`
    INSERT INTO markets (event_id, type, name, is_main_market)
    VALUES (${newEventId}::uuid, 'match_winner'::market_type, 'Match Result', true)
  `);

  return { eventId: newEventId, isNew: true };
}
