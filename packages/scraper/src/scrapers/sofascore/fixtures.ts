import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';
import { BaseFixturesScraper, type ScrapedFixture } from '../base';

/**
 * Sofascore fixture scraper - backup source
 * Uses their mobile-friendly API which returns JSON data
 */
export class SofascoreFixturesScraper extends BaseFixturesScraper {
  readonly source = 'sofascore';
  readonly priority = 2; // Lower priority than Flashscore

  protected readonly sportUrls: Record<string, string> = {
    football: 'https://www.sofascore.com/football',
    tennis: 'https://www.sofascore.com/tennis',
    basketball: 'https://www.sofascore.com/basketball',
    cricket: 'https://www.sofascore.com/cricket',
    darts: 'https://www.sofascore.com/darts',
  };

  // Sofascore sport IDs for API calls
  private readonly sportIds: Record<string, number> = {
    football: 1,
    tennis: 5,
    basketball: 2,
    cricket: 62,
    darts: 22,
  };

  async getUpcomingFixtures(sportSlug: string, days = 7): Promise<ScrapedFixture[]> {
    const sportId = this.sportIds[sportSlug];
    if (!sportId) {
      logger.warn(`Sofascore: No sport ID for ${sportSlug}`);
      return [];
    }

    const allFixtures: ScrapedFixture[] = [];
    const seenIds = new Set<string>();

    // Fetch fixtures for each day
    for (let dayOffset = 0; dayOffset < Math.min(days, 7); dayOffset++) {
      try {
        const fixtures = await this.fetchDayFixtures(sportSlug, sportId, dayOffset);

        for (const fixture of fixtures) {
          if (!seenIds.has(fixture.externalId)) {
            seenIds.add(fixture.externalId);
            allFixtures.push(fixture);
          }
        }

        await randomDelay(500, 1000);
      } catch (error) {
        logger.warn(`Sofascore: Failed to fetch day ${dayOffset} for ${sportSlug}`, { error });
      }
    }

    logger.info(`Sofascore: Scraped ${allFixtures.length} fixtures for ${sportSlug}`);
    return allFixtures;
  }

  private async fetchDayFixtures(
    sportSlug: string,
    sportId: number,
    dayOffset: number
  ): Promise<ScrapedFixture[]> {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // Sofascore API endpoint for scheduled events
    const apiUrl = `https://api.sofascore.com/api/v1/sport/${sportSlug}/scheduled-events/${dateStr}`;

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(apiUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      // Get JSON response
      const content = await this.page.content();
      const jsonMatch = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);

      if (!jsonMatch) {
        // Try to get raw JSON if not wrapped in pre
        const bodyText = await this.page.evaluate(() => document.body.innerText);
        return this.parseApiResponse(bodyText, sportSlug);
      }

      return this.parseApiResponse(jsonMatch[1]!, sportSlug);
    } catch (error) {
      logger.debug(`Sofascore API failed, trying web scraping for ${sportSlug}`, { error });
      return this.scrapeWebPage(sportSlug, dayOffset);
    }
  }

  private parseApiResponse(jsonText: string, sportSlug: string): ScrapedFixture[] {
    try {
      const data = JSON.parse(jsonText);
      const events = data.events || [];

      return events
        .filter((event: any) => event.status?.type === 'notstarted')
        .map((event: any) => this.parseApiEvent(event, sportSlug))
        .filter((f: ScrapedFixture | null): f is ScrapedFixture => f !== null);
    } catch (error) {
      logger.debug('Failed to parse Sofascore API response', { error });
      return [];
    }
  }

  private parseApiEvent(event: any, sportSlug: string): ScrapedFixture | null {
    try {
      const homeTeam = event.homeTeam?.name || event.homeTeam?.shortName;
      const awayTeam = event.awayTeam?.name || event.awayTeam?.shortName;

      if (!homeTeam || !awayTeam) return null;

      // Sofascore uses Unix timestamps
      const startTime = new Date(event.startTimestamp * 1000);

      // Get competition name
      const competition = event.tournament?.name || event.tournament?.uniqueName || 'Unknown';
      const country = event.tournament?.category?.name;

      return {
        externalId: `ss_${event.id}`,
        sportSlug,
        competition: country ? `${country}: ${competition}` : competition,
        homeTeam,
        awayTeam,
        startTime,
        source: 'sofascore',
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fallback: Scrape the web page if API fails
   */
  private async scrapeWebPage(sportSlug: string, dayOffset: number): Promise<ScrapedFixture[]> {
    const baseUrl = this.sportUrls[sportSlug];
    if (!baseUrl) return [];

    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    const url = `${baseUrl}/${dateStr}`;

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      });

      await randomDelay(1000, 2000);

      // Wait for events to load
      await this.page.waitForSelector('[class*="event"]', { timeout: 10000 }).catch(() => {});

      // Extract events from the page
      const fixtures = await this.page.evaluate((sport) => {
        const events: Array<{
          id: string;
          homeTeam: string;
          awayTeam: string;
          competition: string;
          startTime: string;
        }> = [];

        // Sofascore uses various selectors - try to find event rows
        const eventElements = document.querySelectorAll('[class*="eventRow"], [data-testid*="event"]');

        eventElements.forEach((el) => {
          try {
            const homeEl = el.querySelector('[class*="homeTeam"], [class*="home"]');
            const awayEl = el.querySelector('[class*="awayTeam"], [class*="away"]');
            const timeEl = el.querySelector('[class*="time"], [class*="startTime"]');

            const homeTeam = homeEl?.textContent?.trim();
            const awayTeam = awayEl?.textContent?.trim();
            const timeText = timeEl?.textContent?.trim();

            if (homeTeam && awayTeam && timeText) {
              // Generate ID from team names
              const id = `ss_${homeTeam.toLowerCase().replace(/\s+/g, '_')}_${awayTeam.toLowerCase().replace(/\s+/g, '_')}`;

              events.push({
                id,
                homeTeam,
                awayTeam,
                competition: 'Unknown', // Hard to extract from web page
                startTime: timeText,
              });
            }
          } catch {
            // Skip failed elements
          }
        });

        return events;
      }, sportSlug);

      return fixtures
        .map((f) => this.parseWebEvent(f, sportSlug, date))
        .filter((f): f is ScrapedFixture => f !== null);
    } catch (error) {
      logger.warn(`Sofascore web scrape failed for ${sportSlug}`, { error });
      return [];
    }
  }

  private parseWebEvent(
    event: { id: string; homeTeam: string; awayTeam: string; competition: string; startTime: string },
    sportSlug: string,
    date: Date
  ): ScrapedFixture | null {
    try {
      // Parse time (format: HH:MM)
      const timeMatch = event.startTime.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return null;

      const hours = parseInt(timeMatch[1]!);
      const minutes = parseInt(timeMatch[2]!);

      const startTime = new Date(date);
      startTime.setHours(hours, minutes, 0, 0);

      // Adjust for CET
      const cetOffset = this.getCETOffset(startTime);
      startTime.setTime(startTime.getTime() - cetOffset);

      return {
        externalId: event.id,
        sportSlug,
        competition: event.competition,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        startTime,
        source: 'sofascore',
      };
    } catch {
      return null;
    }
  }
}
