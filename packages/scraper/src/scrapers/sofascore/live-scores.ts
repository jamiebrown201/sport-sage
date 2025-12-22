import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';
import { matchEvents, type ScrapedEvent } from '../../utils/team-matcher';
import type { LiveScoresScraper, EventToMatch, ScrapeResult, LiveScore } from '../types';

/**
 * SofaScore live scores scraper - FREE API, no proxy needed
 *
 * Uses api.sofascore.com which is accessible from AWS IPs.
 * Matches events by team names, not source-specific IDs.
 */
export class SofascoreLiveScoresScraper implements LiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(events: EventToMatch[]): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    if (events.length === 0) {
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    logger.info(`SofaScore: Looking for scores for ${events.length} events`);

    try {
      // Group events by sport (SofaScore has different endpoints per sport)
      const footballEvents = events.filter(e => e.sportSlug === 'football');
      const basketballEvents = events.filter(e => e.sportSlug === 'basketball');
      const tennisEvents = events.filter(e => e.sportSlug === 'tennis');

      let totalMatched = 0;
      let totalUnmatched = 0;

      // Fetch live events for each sport
      if (footballEvents.length > 0) {
        const result = await this.fetchAndMatchSport('football', footballEvents);
        for (const [id, score] of result.scores) {
          scores.set(id, score);
        }
        totalMatched += result.matchedCount;
        totalUnmatched += result.unmatchedCount;
      }

      if (basketballEvents.length > 0) {
        const result = await this.fetchAndMatchSport('basketball', basketballEvents);
        for (const [id, score] of result.scores) {
          scores.set(id, score);
        }
        totalMatched += result.matchedCount;
        totalUnmatched += result.unmatchedCount;
      }

      if (tennisEvents.length > 0) {
        const result = await this.fetchAndMatchSport('tennis', tennisEvents);
        for (const [id, score] of result.scores) {
          scores.set(id, score);
        }
        totalMatched += result.matchedCount;
        totalUnmatched += result.unmatchedCount;
      }

      logger.info(`SofaScore: Matched ${totalMatched} events, ${totalUnmatched} unmatched`);
      return { scores, matchedCount: totalMatched, unmatchedCount: totalUnmatched };
    } catch (error) {
      logger.error('SofaScore live scores failed', { error });
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }
  }

  private async fetchAndMatchSport(
    sport: string,
    events: EventToMatch[]
  ): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    // Fetch all live events from SofaScore for this sport
    const liveEvents = await this.fetchLiveEvents(sport);

    if (liveEvents.length === 0) {
      logger.debug(`SofaScore: No live ${sport} events found`);
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    logger.debug(`SofaScore: Found ${liveEvents.length} live ${sport} events to match`);

    // Convert SofaScore events to our ScrapedEvent format
    const scrapedEvents: ScrapedEvent[] = liveEvents.map(event => ({
      homeTeam: event.homeTeam?.name || event.homeTeam?.shortName || '',
      awayTeam: event.awayTeam?.name || event.awayTeam?.shortName || '',
      homeScore: event.homeScore?.current ?? 0,
      awayScore: event.awayScore?.current ?? 0,
      period: this.parsePeriod(event),
      minute: this.parseMinute(event),
      isFinished: event.status?.type === 'finished',
      startTime: event.startTimestamp ? new Date(event.startTimestamp * 1000) : undefined,
      sourceId: String(event.id),
      sourceName: 'sofascore',
    }));

    // Convert our events to DatabaseEvent format for matching
    const dbEvents = events.map(e => ({
      id: e.id,
      homeTeamName: e.homeTeamName,
      awayTeamName: e.awayTeamName,
      startTime: e.startTime,
    }));

    // Match by team names
    const matches = matchEvents(scrapedEvents, dbEvents, {
      threshold: 0.7, // Slightly lower threshold to catch abbreviations
      requireBothTeams: true,
      timeWindowMs: 12 * 60 * 60 * 1000, // 12 hour window
    });

    // Convert matches to LiveScore format
    for (const match of matches) {
      const scraped = match.scrapedEvent;
      scores.set(match.dbEvent.id, {
        eventId: match.dbEvent.id,
        homeScore: scraped.homeScore ?? 0,
        awayScore: scraped.awayScore ?? 0,
        period: scraped.period || 'LIVE',
        minute: scraped.minute,
        isFinished: scraped.isFinished ?? false,
      });

      logger.debug(`SofaScore: Matched "${scraped.homeTeam} vs ${scraped.awayTeam}" ` +
        `to "${match.dbEvent.homeTeamName} vs ${match.dbEvent.awayTeamName}" ` +
        `(confidence: ${match.confidence.toFixed(2)})`);
    }

    const unmatchedCount = scrapedEvents.length - matches.length;
    return { scores, matchedCount: matches.length, unmatchedCount };
  }

  private async fetchLiveEvents(sport: string): Promise<any[]> {
    const apiUrl = `https://api.sofascore.com/api/v1/sport/${sport}/events/live`;

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
      logger.debug(`Failed to fetch SofaScore live ${sport} events`, { error });
      return [];
    }
  }

  private parsePeriod(event: any): string {
    const status = event.status?.type || '';
    const statusDesc = event.status?.description?.toLowerCase() || '';

    if (status === 'finished') return 'FT';
    if (status === 'notstarted') return 'NS';
    if (status === 'postponed') return 'PPD';
    if (status === 'canceled' || status === 'cancelled') return 'CANC';

    if (status === 'inprogress') {
      if (statusDesc.includes('1st half') || statusDesc.includes('first half')) return '1H';
      if (statusDesc.includes('2nd half') || statusDesc.includes('second half')) return '2H';
      if (statusDesc.includes('halftime') || statusDesc.includes('half time')) return 'HT';
      if (statusDesc.includes('extra')) return 'ET';
      if (statusDesc.includes('penalties') || statusDesc.includes('penalty')) return 'PEN';
      if (statusDesc.includes('1st quarter') || statusDesc.includes('q1')) return '1Q';
      if (statusDesc.includes('2nd quarter') || statusDesc.includes('q2')) return '2Q';
      if (statusDesc.includes('3rd quarter') || statusDesc.includes('q3')) return '3Q';
      if (statusDesc.includes('4th quarter') || statusDesc.includes('q4')) return '4Q';
      if (statusDesc.includes('1st set')) return '1S';
      if (statusDesc.includes('2nd set')) return '2S';
      if (statusDesc.includes('3rd set')) return '3S';
      return 'LIVE';
    }

    return 'Unknown';
  }

  private parseMinute(event: any): number | undefined {
    if (event.status?.type !== 'inprogress') return undefined;

    const currentTime = event.time?.played;
    if (currentTime) {
      return Math.floor(currentTime / 60);
    }

    return undefined;
  }
}
