import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { retryWithBackoff, randomDelay } from '../../utils/browser';

export interface LiveScore {
  externalId: string;
  homeScore: number;
  awayScore: number;
  period: string;
  minute?: number;
  isFinished: boolean;
}

export class FlashscoreLiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(externalIds: string[]): Promise<Map<string, LiveScore>> {
    const scores = new Map<string, LiveScore>();

    if (externalIds.length === 0) {
      return scores;
    }

    // Normalize external IDs - strip any g_X_ prefixes for comparison
    const normalizedIds = new Set(
      externalIds.map(id => id.replace(/^g_\d+_/, ''))
    );

    // Also keep original IDs for direct matching
    const originalIds = new Set(externalIds);

    logger.info(`Fetching live scores for ${externalIds.length} events`);

    try {
      // Navigate to live scores page
      await retryWithBackoff(async () => {
        await this.page.goto('https://www.flashscore.com/live/', {
          waitUntil: 'networkidle',
        });
      });

      // Random delay to appear more human-like
      await randomDelay(500, 1500);

      // Wait for events to load
      await this.page.waitForSelector('.event__match', { timeout: 10000 }).catch(() => {
        logger.debug('No live matches found');
      });

      // Another small delay before scraping
      await randomDelay(300, 800);

      // Get all live matches
      const matches = await this.page.$$('.event__match--live, .event__match--onlyLive');

      for (const match of matches) {
        try {
          const id = await match.getAttribute('id');
          if (!id) continue;

          // Extract the base ID (strip g_X_ prefix)
          const baseId = id.replace(/^g_\d+_/, '');

          // Check if this ID matches any of our events (with or without prefix)
          const matchingExternalId = externalIds.find(extId => {
            const normalizedExtId = extId.replace(/^g_\d+_/, '');
            return normalizedExtId === baseId || extId === id;
          });

          if (!matchingExternalId) continue;

          const score = await this.parseScoreElement(match, matchingExternalId);
          if (score) {
            scores.set(matchingExternalId, score);
          }
        } catch (error) {
          logger.debug('Failed to parse live match', { error });
        }
      }

      // Also check for recently finished matches
      const finishedMatches = await this.page.$$('.event__match--scheduled');
      for (const match of finishedMatches) {
        try {
          const id = await match.getAttribute('id');
          if (!id) continue;

          // Extract the base ID (strip g_X_ prefix)
          const baseId = id.replace(/^g_\d+_/, '');

          // Check if this ID matches any of our events
          const matchingExternalId = externalIds.find(extId => {
            const normalizedExtId = extId.replace(/^g_\d+_/, '');
            return normalizedExtId === baseId || extId === id;
          });

          if (!matchingExternalId) continue;

          // Check if it has a final score
          const hasScore = await match.$('.event__score');
          if (hasScore) {
            const score = await this.parseFinishedMatch(match, matchingExternalId);
            if (score) {
              scores.set(matchingExternalId, score);
            }
          }
        } catch (error) {
          logger.debug('Failed to parse finished match', { error });
        }
      }

      logger.info(`Retrieved ${scores.size} live/finished scores`);
    } catch (error) {
      logger.error('Failed to fetch live scores', error);
    }

    return scores;
  }

  private async parseScoreElement(element: any, externalId: string): Promise<LiveScore | null> {
    try {
      const homeScore = await element
        .$eval('.event__score--home', (el: Element) =>
          parseInt(el.textContent?.trim() || '0')
        )
        .catch(() => 0);

      const awayScore = await element
        .$eval('.event__score--away', (el: Element) =>
          parseInt(el.textContent?.trim() || '0')
        )
        .catch(() => 0);

      const stageText = await element
        .$eval('.event__stage--block', (el: Element) => el.textContent?.trim())
        .catch(() => null);

      const period = this.parsePeriod(stageText);
      const minute = this.parseMinute(stageText);
      const isFinished = stageText?.toLowerCase().includes('finished') ?? false;

      return {
        externalId,
        homeScore,
        awayScore,
        period,
        minute,
        isFinished,
      };
    } catch (error) {
      logger.debug('Error parsing score element', { error });
      return null;
    }
  }

  private async parseFinishedMatch(element: any, externalId: string): Promise<LiveScore | null> {
    try {
      const homeScore = await element
        .$eval('.event__score--home', (el: Element) =>
          parseInt(el.textContent?.trim() || '0')
        )
        .catch(() => 0);

      const awayScore = await element
        .$eval('.event__score--away', (el: Element) =>
          parseInt(el.textContent?.trim() || '0')
        )
        .catch(() => 0);

      return {
        externalId,
        homeScore,
        awayScore,
        period: 'Full Time',
        isFinished: true,
      };
    } catch (error) {
      return null;
    }
  }

  private parsePeriod(stageText: string | null): string {
    if (!stageText) return 'Live';

    const text = stageText.toLowerCase();

    if (text.includes('1st half') || text.includes('first half')) return '1st Half';
    if (text.includes('2nd half') || text.includes('second half')) return '2nd Half';
    if (text.includes('half time') || text.includes('ht')) return 'Half Time';
    if (text.includes('full time') || text.includes('ft')) return 'Full Time';
    if (text.includes('extra time') || text.includes('et')) return 'Extra Time';
    if (text.includes('penalties') || text.includes('pens')) return 'Penalties';

    // For other sports
    if (text.includes('1st set')) return '1st Set';
    if (text.includes('2nd set')) return '2nd Set';
    if (text.includes('3rd set')) return '3rd Set';
    if (text.includes('1st quarter') || text.includes('q1')) return '1st Quarter';
    if (text.includes('2nd quarter') || text.includes('q2')) return '2nd Quarter';
    if (text.includes('3rd quarter') || text.includes('q3')) return '3rd Quarter';
    if (text.includes('4th quarter') || text.includes('q4')) return '4th Quarter';

    return 'Live';
  }

  private parseMinute(stageText: string | null): number | undefined {
    if (!stageText) return undefined;

    // Look for minute pattern like "45'" or "45+3'"
    const minuteMatch = stageText.match(/(\d+)'/);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]);
    }

    return undefined;
  }
}
