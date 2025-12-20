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
}

const SPORT_URLS: Record<string, string> = {
  football: 'https://www.flashscore.com/football/',
  tennis: 'https://www.flashscore.com/tennis/',
  basketball: 'https://www.flashscore.com/basketball/',
  darts: 'https://www.flashscore.com/darts/',
  cricket: 'https://www.flashscore.com/cricket/',
};

export class FlashscoreFixturesScraper {
  constructor(private page: Page) {}

  async getUpcomingFixtures(sportSlug: string, days = 7): Promise<ScrapedFixture[]> {
    const url = SPORT_URLS[sportSlug];
    if (!url) {
      logger.warn(`No URL configured for sport: ${sportSlug}`);
      return [];
    }

    logger.info(`Scraping fixtures for ${sportSlug}`, { url, days });

    const fixtures: ScrapedFixture[] = [];

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(url, { waitUntil: 'networkidle' });
      });

      await randomDelay(1000, 2000);

      // Wait for events container
      await this.page.waitForSelector('.event__match', { timeout: 10000 }).catch(() => {
        logger.warn('No matches found on page');
      });

      // Get all match elements
      const matches = await this.page.$$('.event__match');

      for (const match of matches) {
        try {
          const fixture = await this.parseMatchElement(match, sportSlug);
          if (fixture && this.isWithinDays(fixture.startTime, days)) {
            fixtures.push(fixture);
          }
        } catch (error) {
          logger.debug('Failed to parse match element', { error });
        }

        await randomDelay(100, 300);
      }

      logger.info(`Scraped ${fixtures.length} fixtures for ${sportSlug}`);
    } catch (error) {
      logger.error(`Failed to scrape fixtures for ${sportSlug}`, error);
    }

    return fixtures;
  }

  private async parseMatchElement(
    element: any,
    sportSlug: string
  ): Promise<ScrapedFixture | null> {
    try {
      const id = await element.getAttribute('id');
      if (!id) return null;

      const externalId = id.replace('g_1_', '');

      // Get team names
      const homeTeam = await element
        .$eval('.event__participant--home', (el: Element) => el.textContent?.trim())
        .catch(() => null);

      const awayTeam = await element
        .$eval('.event__participant--away', (el: Element) => el.textContent?.trim())
        .catch(() => null);

      if (!homeTeam || !awayTeam) return null;

      // Get time
      const timeText = await element
        .$eval('.event__time', (el: Element) => el.textContent?.trim())
        .catch(() => null);

      const startTime = this.parseTime(timeText);
      if (!startTime) return null;

      // Get competition from header
      const competition = await this.getCompetitionName(element);

      return {
        externalId,
        sportSlug,
        competition: competition || 'Unknown',
        homeTeam,
        awayTeam,
        startTime,
      };
    } catch (error) {
      logger.debug('Error parsing match element', { error });
      return null;
    }
  }

  private async getCompetitionName(matchElement: any): Promise<string | null> {
    try {
      // Navigate up to find the competition header
      const headerElement = await matchElement.evaluateHandle((el: Element) => {
        let sibling = el.previousElementSibling;
        while (sibling) {
          if (sibling.classList.contains('event__header')) {
            return sibling;
          }
          sibling = sibling.previousElementSibling;
        }
        return null;
      });

      if (headerElement) {
        const name = await headerElement.evaluate((el: Element) =>
          el.querySelector('.event__title--name')?.textContent?.trim()
        );
        return name || null;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  private parseTime(timeText: string | null): Date | null {
    if (!timeText) return null;

    try {
      // Flashscore format: "HH:MM" or "DD.MM. HH:MM"
      const now = new Date();

      if (timeText.includes('.')) {
        // Date and time format
        const [datePart, timePart] = timeText.split(' ');
        const [day, month] = datePart.split('.');
        const [hours, minutes] = timePart.split(':');

        const date = new Date(
          now.getFullYear(),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes)
        );

        // Handle year rollover
        if (date < now) {
          date.setFullYear(date.getFullYear() + 1);
        }

        return date;
      } else {
        // Time only - assume today
        const [hours, minutes] = timeText.split(':');
        const date = new Date(now);
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // If time has passed, assume tomorrow
        if (date < now) {
          date.setDate(date.getDate() + 1);
        }

        return date;
      }
    } catch {
      return null;
    }
  }

  private isWithinDays(date: Date, days: number): boolean {
    const now = new Date();
    const maxDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return date >= now && date <= maxDate;
  }
}
