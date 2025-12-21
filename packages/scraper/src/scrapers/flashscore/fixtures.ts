import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';

export interface ScrapedFixture {
  externalId: string;
  sportSlug: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  source?: string;
}

// Base URLs for sports pages
const SPORT_URLS: Record<string, string> = {
  football: 'https://www.flashscore.com/football/',
  tennis: 'https://www.flashscore.com/tennis/',
  basketball: 'https://www.flashscore.com/basketball/',
  darts: 'https://www.flashscore.com/darts/',
  cricket: 'https://www.flashscore.com/cricket/',
};

// Scheduled fixtures URLs (for sports with heavy live traffic)
// These show upcoming matches only, avoiding live/finished matches
const SCHEDULED_URLS: Record<string, string[]> = {
  football: [
    'https://www.flashscore.com/football/?d=1', // Tomorrow
    'https://www.flashscore.com/football/?d=2', // Day after tomorrow
    'https://www.flashscore.com/football/?d=0', // Today (but later matches)
  ],
};

// Resources to block for faster page loads
const BLOCKED_RESOURCE_TYPES = ['image', 'media', 'font', 'stylesheet'];
const BLOCKED_DOMAINS = [
  'googletagmanager.com',
  'google-analytics.com',
  'doubleclick.net',
  'googlesyndication.com',
  'facebook.net',
  'facebook.com',
  'twitter.com',
  'ads.',
  'analytics.',
  'tracking.',
];

export class FlashscoreFixturesScraper {
  readonly source = 'flashscore';
  readonly priority = 1; // Primary scraper
  private routeConfigured = false;

  constructor(private page: Page) {}

  supportsSport(sportSlug: string): boolean {
    return sportSlug in SPORT_URLS;
  }

  /**
   * Configure route to block unnecessary resources for faster loading
   */
  private async configureRouteBlocking(): Promise<void> {
    if (this.routeConfigured) return;

    await this.page.route('**/*', (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      const url = request.url();

      // Block heavy resource types
      if (BLOCKED_RESOURCE_TYPES.includes(resourceType)) {
        return route.abort();
      }

      // Block tracking/analytics domains
      if (BLOCKED_DOMAINS.some((domain) => url.includes(domain))) {
        return route.abort();
      }

      return route.continue();
    });

    this.routeConfigured = true;
    logger.debug('Route blocking configured');
  }

  async getUpcomingFixtures(sportSlug: string, days = 7): Promise<ScrapedFixture[]> {
    const baseUrl = SPORT_URLS[sportSlug];
    if (!baseUrl) {
      logger.warn(`No URL configured for sport: ${sportSlug}`);
      return [];
    }

    // For sports with heavy live traffic, use scheduled URLs
    const urls = SCHEDULED_URLS[sportSlug] || [baseUrl];
    const allFixtures: ScrapedFixture[] = [];
    const seenIds = new Set<string>();

    // Configure route blocking once for all pages
    await this.configureRouteBlocking();

    for (const url of urls) {
      logger.info(`Scraping fixtures for ${sportSlug}`, { url, days });

      try {
        await retryWithBackoff(async () => {
          // Use domcontentloaded instead of networkidle - much faster
          await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        });

        await randomDelay(500, 1000);

        // Wait for events container with multiple possible selectors
        const matchSelector = await this.waitForMatchElements();

        if (!matchSelector) {
          logger.debug(`No matches found on page: ${url}`);
          continue;
        }

        // Get all match elements using the detected selector
        const matches = await this.page.$$(matchSelector);
        logger.info(`Found ${matches.length} match elements with selector: ${matchSelector}`);

        for (const match of matches) {
          try {
            const fixture = await this.parseMatchElement(match, sportSlug);
            if (fixture && this.isWithinDays(fixture.startTime, days)) {
              // Deduplicate by external ID
              if (!seenIds.has(fixture.externalId)) {
                seenIds.add(fixture.externalId);
                allFixtures.push(fixture);
              }
            }
          } catch (error) {
            logger.debug('Failed to parse match element', { error });
          }

          // Reduced delay - we're blocking resources so parsing is fast
          await randomDelay(50, 100);
        }
      } catch (error) {
        logger.error(`Failed to scrape page: ${url}`, error);
      }
    }

    logger.info(`Scraped ${allFixtures.length} fixtures for ${sportSlug}`);
    return allFixtures;
  }

  /**
   * Wait for match elements - tries multiple selectors as Flashscore uses
   * different DOM structures for different sports/pages
   */
  private async waitForMatchElements(): Promise<string | null> {
    // Possible selectors for match elements across different sports
    const possibleSelectors = [
      '.event__match',           // Standard selector
      '.event__match--scheduled', // Scheduled matches only
      '.event__match--live',     // Live matches
      '[class*="event__match"]', // Partial match
      '.sportName .event__match', // Under sport container
    ];

    for (const selector of possibleSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 15000 });
        const count = await this.page.$$(selector).then((els) => els.length);
        if (count > 0) {
          logger.debug(`Found matches with selector: ${selector} (${count} elements)`);
          return selector;
        }
      } catch {
        // Try next selector
      }
    }

    // Last resort - check if the page has any events at all
    try {
      const hasEvents = await this.page.$('.sportName');
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

  private async parseMatchElement(
    element: any,
    sportSlug: string
  ): Promise<ScrapedFixture | null> {
    try {
      const id = await element.getAttribute('id');
      if (!id) return null;

      const externalId = id.replace('g_1_', '').replace('g_2_', '').replace('g_3_', '');

      // Get team/player names - try multiple selectors for different sports
      const homeTeam = await this.getParticipantName(element, 'home');
      const awayTeam = await this.getParticipantName(element, 'away');

      if (!homeTeam || !awayTeam) {
        return null;
      }

      // Get time - try multiple selectors
      const timeText = await this.getTimeText(element);
      const startTime = this.parseTime(timeText);
      if (!startTime) {
        return null;
      }

      // Get competition from header
      const competition = await this.getCompetitionName(element);

      return {
        externalId,
        sportSlug,
        competition: competition || 'Unknown',
        homeTeam,
        awayTeam,
        startTime,
        source: 'flashscore',
      };
    } catch (error) {
      logger.debug('Error parsing match element', { error });
      return null;
    }
  }

  /**
   * Get participant name (home/away team or player)
   * Tries multiple selectors for different sports
   */
  private async getParticipantName(
    element: any,
    type: 'home' | 'away'
  ): Promise<string | null> {
    // Flashscore uses different class names for different sports/layouts
    // Build selectors based on type
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
        // Try next selector
      }
    }

    // Fallback: try to get all participants and pick by index
    // Flashscore sometimes uses just .event__participant divs
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
        // If only one participant found, might be stacked vertically
        if (participants.length === 1 && type === 'home') {
          return participants[0] ?? null;
        }
      } catch {
        // Try next selector
      }
    }

    return null;
  }

  /**
   * Get time text from match element
   * Tries multiple selectors
   */
  private async getTimeText(element: any): Promise<string | null> {
    const selectors = ['.event__time', '.event__stage', '.event__stage--block'];

    for (const selector of selectors) {
      try {
        const text = await element.$eval(selector, (el: Element) => el.textContent?.trim());
        if (text) return text;
      } catch {
        // Try next selector
      }
    }

    return null;
  }

  private async getCompetitionName(matchElement: any): Promise<string | null> {
    try {
      // Navigate up to find the competition header
      const competitionInfo = await matchElement.evaluate((el: Element) => {
        let sibling = el.previousElementSibling;
        while (sibling) {
          if (sibling.classList.contains('event__header')) {
            // Try multiple selectors for competition name
            const titleName = sibling.querySelector('.event__title--name');
            if (titleName?.textContent?.trim()) {
              // Also get country if available
              const country = sibling.querySelector('.event__title--type')?.textContent?.trim();
              const name = titleName.textContent.trim();
              return country ? `${country}: ${name}` : name;
            }

            // Fallback selectors
            const title = sibling.querySelector('.event__title');
            if (title?.textContent?.trim()) {
              return title.textContent.trim();
            }

            // Another fallback - look for any text content
            const headerText = sibling.textContent?.trim();
            if (headerText) {
              // Clean up - remove extra whitespace
              return headerText.replace(/\s+/g, ' ').substring(0, 100);
            }
          }
          sibling = sibling.previousElementSibling;
        }
        return null;
      });

      return competitionInfo || null;
    } catch (error) {
      logger.debug('Error getting competition name', { error });
    }
    return null;
  }

  private parseTime(timeText: string | null): Date | null {
    if (!timeText) return null;

    try {
      const trimmed = timeText.trim();

      // Skip live match indicators - these are NOT scheduled times
      // Live matches show: "45+2", "HT", "FT", "90+3", "67'", "1st", "2nd", "Break", etc.
      const liveIndicators = [
        /^\d{1,3}['+]?\d*$/, // "45", "45+", "45+2", "67'" (minute indicators)
        /^HT$/i, // Half time
        /^Half\s*Time$/i, // Half Time (full text)
        /^FT$/i, // Full time
        /^Finished$/i, // Finished (full text)
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
        /^Not Started$/i, // Not started
        /^Delayed$/i, // Delayed
        /^Interrupted$/i, // Interrupted
        /^Abandoned$/i, // Abandoned
      ];

      if (liveIndicators.some((pattern) => pattern.test(trimmed))) {
        return null; // Skip live/finished matches
      }

      // Must contain a colon for time format (HH:MM)
      if (!trimmed.includes(':')) {
        return null;
      }

      // Clean the time text - remove any trailing non-time characters
      // e.g., "13:00FRO" -> "13:00", "16:30Postponed" -> "16:30"
      const cleanedTime = trimmed.replace(/^(\d{1,2}:\d{2}(?:\s+\d{1,2}\.\d{1,2}\.?)?).*$/, '$1').trim();

      // Flashscore displays times in CET/CEST (Central European Time)
      // We parse as CET and convert to UTC for storage
      const now = new Date();
      const nowUTC = Date.now();

      if (cleanedTime.includes('.')) {
        // Date and time format: "DD.MM. HH:MM" or "DD.MM.YYYY HH:MM"
        const parts = cleanedTime.split(' ').filter((p) => p.length > 0);
        if (parts.length < 2) return null;

        const datePart = parts[0];
        const timePart = parts[parts.length - 1];

        const dateParts = datePart.split('.').filter((p) => p.length > 0);
        if (dateParts.length < 2) return null;

        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);

        if (isNaN(day) || isNaN(month)) return null;

        const timeParts = timePart.split(':');
        if (timeParts.length < 2) return null;

        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);

        if (isNaN(hours) || isNaN(minutes)) return null;

        // Create date in UTC, then adjust for CET offset
        const year = now.getUTCFullYear();
        const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));

        // Adjust for CET: subtract 1 hour (winter) or 2 hours (summer) to get UTC
        const cetOffset = this.getCETOffset(utcDate);
        utcDate.setTime(utcDate.getTime() - cetOffset);

        // Handle year rollover (if date is in the past, assume next year)
        if (utcDate.getTime() < nowUTC) {
          utcDate.setUTCFullYear(utcDate.getUTCFullYear() + 1);
        }

        return utcDate;
      } else {
        // Time only format: "HH:MM" - assume today or tomorrow
        const timeParts = cleanedTime.split(':');
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
        const cetOffset = this.getCETOffset(utcDate);
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
   * DST switches: last Sunday of March (to CEST) and last Sunday of October (to CET)
   */
  private getCETOffset(date: Date): number {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();

    // Find last Sunday of March (DST starts at 2:00 CET -> 3:00 CEST)
    const marchLast = new Date(Date.UTC(year, 2, 31)); // March 31
    const dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0)); // 1:00 UTC = 2:00 CET

    // Find last Sunday of October (DST ends at 3:00 CEST -> 2:00 CET)
    const octLast = new Date(Date.UTC(year, 9, 31)); // October 31
    const dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0)); // 1:00 UTC = 3:00 CEST

    // Check if date is in DST period (CEST = UTC+2)
    if (date >= dstStart && date < dstEnd) {
      return 2 * 60 * 60 * 1000; // CEST: +2 hours
    }

    return 1 * 60 * 60 * 1000; // CET: +1 hour
  }

  private isWithinDays(date: Date, days: number): boolean {
    const now = new Date();
    const maxDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return date >= now && date <= maxDate;
  }
}
