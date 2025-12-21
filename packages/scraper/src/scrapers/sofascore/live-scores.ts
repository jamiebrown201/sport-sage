import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';

export interface LiveScore {
  externalId: string;
  homeScore: number;
  awayScore: number;
  period: string;
  minute?: number;
  isFinished: boolean;
}

/**
 * SofaScore live scores scraper - FREE alternative to Flashscore
 * Uses their JSON API which is less protected
 */
export class SofascoreLiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(externalIds: string[]): Promise<Map<string, LiveScore>> {
    const scores = new Map<string, LiveScore>();

    if (externalIds.length === 0) {
      return scores;
    }

    // Extract SofaScore IDs (ss_XXXXX format)
    const sofascoreIds = externalIds
      .filter(id => id.startsWith('ss_'))
      .map(id => id.replace('ss_', ''));

    if (sofascoreIds.length === 0) {
      logger.debug('No SofaScore IDs to fetch');
      return scores;
    }

    logger.info(`SofaScore: Fetching live scores for ${sofascoreIds.length} events`);

    try {
      // Fetch live events from SofaScore API
      const liveEvents = await this.fetchLiveEvents();

      // Match with our IDs
      for (const event of liveEvents) {
        const eventId = String(event.id);
        const matchingId = externalIds.find(id => id === `ss_${eventId}`);

        if (matchingId) {
          const score = this.parseEvent(event, matchingId);
          if (score) {
            scores.set(matchingId, score);
          }
        }
      }

      // Also fetch specific event details for IDs not found in live feed
      const foundIds = new Set(Array.from(scores.keys()));
      const missingIds = sofascoreIds.filter(id => !foundIds.has(`ss_${id}`));

      for (const eventId of missingIds.slice(0, 10)) { // Limit to avoid rate limiting
        try {
          const event = await this.fetchEventDetails(eventId);
          if (event) {
            const score = this.parseEvent(event, `ss_${eventId}`);
            if (score) {
              scores.set(`ss_${eventId}`, score);
            }
          }
          await randomDelay(200, 500);
        } catch (error) {
          logger.debug(`Failed to fetch SofaScore event ${eventId}`, { error });
        }
      }

      logger.info(`SofaScore: Retrieved ${scores.size} live/finished scores`);
      return scores;
    } catch (error) {
      logger.error('SofaScore live scores failed', { error });
      return scores;
    }
  }

  private async fetchLiveEvents(): Promise<any[]> {
    const apiUrl = 'https://api.sofascore.com/api/v1/sport/football/events/live';

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(apiUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
      });

      await randomDelay(300, 600);

      const bodyText = await this.page.evaluate(() => document.body.innerText);
      const data = JSON.parse(bodyText);

      return data.events || [];
    } catch (error) {
      logger.debug('Failed to fetch SofaScore live events', { error });
      return [];
    }
  }

  private async fetchEventDetails(eventId: string): Promise<any | null> {
    const apiUrl = `https://api.sofascore.com/api/v1/event/${eventId}`;

    try {
      await this.page.goto(apiUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      const bodyText = await this.page.evaluate(() => document.body.innerText);
      const data = JSON.parse(bodyText);

      return data.event || null;
    } catch (error) {
      return null;
    }
  }

  private parseEvent(event: any, externalId: string): LiveScore | null {
    try {
      const status = event.status?.type || '';
      const homeScore = event.homeScore?.current ?? 0;
      const awayScore = event.awayScore?.current ?? 0;

      // Determine period
      let period = 'Unknown';
      let isFinished = false;
      let minute: number | undefined;

      if (status === 'finished') {
        period = 'FT';
        isFinished = true;
      } else if (status === 'inprogress') {
        // Get current time info
        const statusTime = event.time?.currentPeriodStartTimestamp;
        const currentTime = event.time?.played;

        if (currentTime) {
          minute = Math.floor(currentTime / 60);
        }

        // Determine period based on status description
        const statusDesc = event.status?.description?.toLowerCase() || '';
        if (statusDesc.includes('1st half') || statusDesc.includes('first half')) {
          period = '1H';
        } else if (statusDesc.includes('2nd half') || statusDesc.includes('second half')) {
          period = '2H';
        } else if (statusDesc.includes('halftime') || statusDesc.includes('half time')) {
          period = 'HT';
        } else if (statusDesc.includes('extra')) {
          period = 'ET';
        } else if (statusDesc.includes('penalties') || statusDesc.includes('penalty')) {
          period = 'PEN';
        } else {
          period = 'LIVE';
        }
      } else if (status === 'notstarted') {
        period = 'NS';
      } else if (status === 'postponed') {
        period = 'PPD';
      } else if (status === 'canceled' || status === 'cancelled') {
        period = 'CANC';
      }

      return {
        externalId,
        homeScore,
        awayScore,
        period,
        minute,
        isFinished,
      };
    } catch (error) {
      return null;
    }
  }
}
