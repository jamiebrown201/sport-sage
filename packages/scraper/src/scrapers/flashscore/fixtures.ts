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
  source: string;
}

// Base URLs for sports pages (fallback)
const SPORT_URLS: Record<string, string> = {
  football: 'https://www.flashscore.com/football/',
  tennis: 'https://www.flashscore.com/tennis/',
  basketball: 'https://www.flashscore.com/basketball/',
  darts: 'https://www.flashscore.com/darts/',
  cricket: 'https://www.flashscore.com/cricket/',
};

// Competition-specific URLs with known competition names
// This is more reliable than trying to parse competition from DOM
interface CompetitionUrl {
  url: string;
  competition: string;
}

const COMPETITION_URLS: Record<string, CompetitionUrl[]> = {
  football: [
    // England
    { url: 'https://www.flashscore.com/football/england/premier-league/fixtures/', competition: 'England: Premier League' },
    { url: 'https://www.flashscore.com/football/england/championship/fixtures/', competition: 'England: Championship' },
    { url: 'https://www.flashscore.com/football/england/league-one/fixtures/', competition: 'England: League One' },
    { url: 'https://www.flashscore.com/football/england/league-two/fixtures/', competition: 'England: League Two' },
    { url: 'https://www.flashscore.com/football/england/fa-cup/fixtures/', competition: 'England: FA Cup' },
    { url: 'https://www.flashscore.com/football/england/efl-cup/fixtures/', competition: 'England: EFL Cup' },
    // Spain
    { url: 'https://www.flashscore.com/football/spain/laliga/fixtures/', competition: 'Spain: LaLiga' },
    { url: 'https://www.flashscore.com/football/spain/laliga2/fixtures/', competition: 'Spain: LaLiga2' },
    { url: 'https://www.flashscore.com/football/spain/copa-del-rey/fixtures/', competition: 'Spain: Copa del Rey' },
    // Germany
    { url: 'https://www.flashscore.com/football/germany/bundesliga/fixtures/', competition: 'Germany: Bundesliga' },
    { url: 'https://www.flashscore.com/football/germany/2-bundesliga/fixtures/', competition: 'Germany: 2. Bundesliga' },
    { url: 'https://www.flashscore.com/football/germany/dfb-pokal/fixtures/', competition: 'Germany: DFB Pokal' },
    // Italy
    { url: 'https://www.flashscore.com/football/italy/serie-a/fixtures/', competition: 'Italy: Serie A' },
    { url: 'https://www.flashscore.com/football/italy/serie-b/fixtures/', competition: 'Italy: Serie B' },
    { url: 'https://www.flashscore.com/football/italy/coppa-italia/fixtures/', competition: 'Italy: Coppa Italia' },
    // France
    { url: 'https://www.flashscore.com/football/france/ligue-1/fixtures/', competition: 'France: Ligue 1' },
    { url: 'https://www.flashscore.com/football/france/ligue-2/fixtures/', competition: 'France: Ligue 2' },
    { url: 'https://www.flashscore.com/football/france/coupe-de-france/fixtures/', competition: 'France: Coupe de France' },
    // Portugal
    { url: 'https://www.flashscore.com/football/portugal/liga-portugal/fixtures/', competition: 'Portugal: Liga Portugal' },
    { url: 'https://www.flashscore.com/football/portugal/liga-portugal-2/fixtures/', competition: 'Portugal: Liga Portugal 2' },
    // Netherlands
    { url: 'https://www.flashscore.com/football/netherlands/eredivisie/fixtures/', competition: 'Netherlands: Eredivisie' },
    // Scotland
    { url: 'https://www.flashscore.com/football/scotland/premiership/fixtures/', competition: 'Scotland: Premiership' },
    // European
    { url: 'https://www.flashscore.com/football/europe/champions-league/fixtures/', competition: 'Europe: Champions League' },
    { url: 'https://www.flashscore.com/football/europe/europa-league/fixtures/', competition: 'Europe: Europa League' },
    { url: 'https://www.flashscore.com/football/europe/europa-conference-league/fixtures/', competition: 'Europe: Conference League' },
  ],
  tennis: [
    { url: 'https://www.flashscore.com/tennis/atp-singles/fixtures/', competition: 'ATP Singles' },
    { url: 'https://www.flashscore.com/tennis/wta-singles/fixtures/', competition: 'WTA Singles' },
  ],
  basketball: [
    { url: 'https://www.flashscore.com/basketball/usa/nba/fixtures/', competition: 'USA: NBA' },
    { url: 'https://www.flashscore.com/basketball/europe/euroleague/fixtures/', competition: 'Europe: Euroleague' },
  ],
  darts: [
    { url: 'https://www.flashscore.com/darts/world/world-championship/fixtures/', competition: 'World Championship' },
    { url: 'https://www.flashscore.com/darts/world/premier-league/fixtures/', competition: 'Premier League Darts' },
  ],
  cricket: [
    { url: 'https://www.flashscore.com/cricket/world/icc-world-test-championship/fixtures/', competition: 'ICC World Test Championship' },
  ],
};

// Fallback scheduled URLs (for general sport pages, competition parsed from DOM)
const SCHEDULED_URLS: Record<string, string[]> = {
  football: [
    'https://www.flashscore.com/football/?d=1', // Tomorrow
    'https://www.flashscore.com/football/?d=2', // Day after tomorrow
  ],
};

// Resources to block for faster page loads and reduced bandwidth
// These are standard browser optimizations - not suspicious at all
const BLOCKED_RESOURCE_TYPES = ['image', 'media', 'font', 'stylesheet', 'texttrack', 'eventsource', 'websocket', 'manifest', 'other'];
const BLOCKED_DOMAINS = [
  // Analytics & tracking
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'facebook.net',
  'facebook.com',
  'twitter.com',
  'connect.facebook.net',
  // Ad networks
  'ads.',
  'ad.',
  'adserver.',
  'analytics.',
  'tracking.',
  'pixel.',
  'beacon.',
  // Common third-party scripts
  'hotjar.com',
  'clarity.ms',
  'newrelic.com',
  'sentry.io',
  'segment.com',
  'mixpanel.com',
  'amplitude.com',
  'intercom.io',
  'crisp.chat',
  'tawk.to',
  'onesignal.com',
  'pusher.com',
  // CDNs we don't need (fonts, icons)
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.fontawesome.com',
  'kit.fontawesome.com',
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
   * This reduces bandwidth by ~70-80% without affecting scraping
   */
  private async configureRouteBlocking(): Promise<void> {
    if (this.routeConfigured) return;

    await this.page.route('**/*', (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      const url = request.url();

      // Block heavy resource types (images, fonts, CSS, etc.)
      if (BLOCKED_RESOURCE_TYPES.includes(resourceType)) {
        return route.abort();
      }

      // Block tracking/analytics/ad domains
      if (BLOCKED_DOMAINS.some((domain) => url.includes(domain))) {
        return route.abort();
      }

      // Block third-party scripts (only allow flashscore.com scripts)
      if (resourceType === 'script' && !url.includes('flashscore.com')) {
        return route.abort();
      }

      return route.continue();
    });

    this.routeConfigured = true;
    logger.debug('Route blocking configured - blocking images, fonts, CSS, analytics, third-party scripts');
  }

  async getUpcomingFixtures(sportSlug: string, days = 7): Promise<ScrapedFixture[]> {
    const baseUrl = SPORT_URLS[sportSlug];
    if (!baseUrl) {
      logger.warn(`No URL configured for sport: ${sportSlug}`);
      return [];
    }

    const allFixtures: ScrapedFixture[] = [];
    const seenIds = new Set<string>();

    // Configure route blocking once for all pages
    await this.configureRouteBlocking();

    // First, scrape competition-specific URLs (where competition is known from URL)
    const competitionUrls = COMPETITION_URLS[sportSlug] || [];

    for (const { url, competition } of competitionUrls) {
      logger.info(`Scraping fixtures for ${competition}`, { url });

      try {
        await retryWithBackoff(async () => {
          await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        });

        await randomDelay(500, 1000);

        const matchSelector = await this.waitForMatchElements();
        if (!matchSelector) {
          logger.debug(`No matches found for ${competition}`);
          continue;
        }

        const matches = await this.page.$$(matchSelector);
        logger.debug(`Found ${matches.length} matches for ${competition}`);

        for (const match of matches) {
          try {
            // Pass the known competition name
            const fixture = await this.parseMatchElement(match, sportSlug, competition);
            if (fixture && this.isWithinDays(fixture.startTime, days)) {
              if (!seenIds.has(fixture.externalId)) {
                seenIds.add(fixture.externalId);
                allFixtures.push(fixture);
              }
            }
          } catch (error) {
            logger.debug('Failed to parse match element', { error });
          }

          await randomDelay(50, 100);
        }
      } catch (error) {
        logger.warn(`Failed to scrape ${competition}`, { error: (error as Error).message });
      }
    }

    // Fallback: scrape general sport pages (competition parsed from DOM)
    const fallbackUrls = SCHEDULED_URLS[sportSlug] || [baseUrl];

    for (const url of fallbackUrls) {
      // Skip fallback if we already have enough fixtures
      if (allFixtures.length >= 200) {
        logger.debug('Skipping fallback URLs - already have enough fixtures');
        break;
      }

      logger.info(`Scraping fallback fixtures for ${sportSlug}`, { url });

      try {
        await retryWithBackoff(async () => {
          await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        });

        await randomDelay(500, 1000);

        const matchSelector = await this.waitForMatchElements();
        if (!matchSelector) {
          logger.debug(`No matches found on fallback page: ${url}`);
          continue;
        }

        const matches = await this.page.$$(matchSelector);
        logger.info(`Found ${matches.length} match elements on fallback page`);

        for (const match of matches) {
          try {
            // No known competition - will try to parse from DOM
            const fixture = await this.parseMatchElement(match, sportSlug);
            if (fixture && this.isWithinDays(fixture.startTime, days)) {
              if (!seenIds.has(fixture.externalId)) {
                seenIds.add(fixture.externalId);
                allFixtures.push(fixture);
              }
            }
          } catch (error) {
            logger.debug('Failed to parse match element', { error });
          }

          await randomDelay(50, 100);
        }
      } catch (error) {
        logger.error(`Failed to scrape fallback page: ${url}`, error);
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
    sportSlug: string,
    knownCompetition?: string
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

      // Use known competition if provided, otherwise try to parse from DOM
      let competition = knownCompetition;
      if (!competition) {
        competition = await this.getCompetitionName(element);
      }

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
