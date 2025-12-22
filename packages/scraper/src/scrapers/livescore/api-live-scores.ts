import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';
import { matchEvents, type ScrapedEvent } from '../../utils/team-matcher';
import type { LiveScoresScraper, EventToMatch, ScrapeResult, LiveScore } from '../types';

/**
 * LiveScore.com API scraper - FREE, no proxy needed
 *
 * Uses prod-public-api.livescore.com which is accessible from AWS IPs.
 * Matches events by team names, not source-specific IDs.
 *
 * API endpoint: https://prod-public-api.livescore.com/v1/api/app/date/{sport}/{date}/{timezone}
 * - sport: "soccer", "basketball", "tennis", "hockey", "cricket"
 * - date: YYYYMMDD format
 * - timezone: offset in hours (e.g., 7 for UTC+0)
 */
export class LiveScoreApiScraper implements LiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(events: EventToMatch[]): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    if (events.length === 0) {
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    logger.info(`LiveScore API: Looking for scores for ${events.length} events`);

    try {
      // Group events by sport
      const footballEvents = events.filter(e => e.sportSlug === 'football');
      const basketballEvents = events.filter(e => e.sportSlug === 'basketball');
      const tennisEvents = events.filter(e => e.sportSlug === 'tennis');
      const hockeyEvents = events.filter(e => e.sportSlug === 'ice_hockey');
      const cricketEvents = events.filter(e => e.sportSlug === 'cricket');

      let totalMatched = 0;
      let totalUnmatched = 0;

      // Fetch live events for each sport
      if (footballEvents.length > 0) {
        const result = await this.fetchAndMatchSport('soccer', footballEvents);
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

      if (hockeyEvents.length > 0) {
        const result = await this.fetchAndMatchSport('hockey', hockeyEvents);
        for (const [id, score] of result.scores) {
          scores.set(id, score);
        }
        totalMatched += result.matchedCount;
        totalUnmatched += result.unmatchedCount;
      }

      if (cricketEvents.length > 0) {
        const result = await this.fetchAndMatchSport('cricket', cricketEvents);
        for (const [id, score] of result.scores) {
          scores.set(id, score);
        }
        totalMatched += result.matchedCount;
        totalUnmatched += result.unmatchedCount;
      }

      logger.info(`LiveScore API: Matched ${totalMatched} events, ${totalUnmatched} unmatched`);
      return { scores, matchedCount: totalMatched, unmatchedCount: totalUnmatched };
    } catch (error) {
      logger.error('LiveScore API live scores failed', { error });
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }
  }

  private async fetchAndMatchSport(
    sport: string,
    events: EventToMatch[]
  ): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    // Fetch all events from LiveScore API for today
    const allApiEvents = await this.fetchEvents(sport);

    // Filter to only live or recently finished events
    const liveEvents = allApiEvents.filter(e =>
      e.status === 'inprogress' || e.status === 'finished'
    );

    if (liveEvents.length === 0) {
      logger.debug(`LiveScore API: No live/finished ${sport} events found`);
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    logger.debug(`LiveScore API: Found ${liveEvents.length} live/finished ${sport} events to match`);

    // Convert LiveScore events to our ScrapedEvent format
    const scrapedEvents: ScrapedEvent[] = liveEvents.map(event => ({
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      period: event.period,
      minute: event.minute,
      isFinished: event.status === 'finished',
      startTime: event.startTime,
      sourceId: event.id,
      sourceName: 'livescore',
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
      threshold: 0.7,
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

      logger.debug(`LiveScore API: Matched "${scraped.homeTeam} vs ${scraped.awayTeam}" ` +
        `to "${match.dbEvent.homeTeamName} vs ${match.dbEvent.awayTeamName}" ` +
        `(confidence: ${match.confidence.toFixed(2)})`);
    }

    const unmatchedCount = scrapedEvents.length - matches.length;
    return { scores, matchedCount: matches.length, unmatchedCount };
  }

  private async fetchEvents(sport: string): Promise<Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    period: string;
    minute?: number;
    status: 'scheduled' | 'inprogress' | 'finished';
    startTime?: Date;
  }>> {
    // Get today's date in YYYYMMDD format
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    // Timezone offset (7 = UTC+0 in their API format)
    const apiUrl = `https://prod-public-api.livescore.com/v1/api/app/date/${sport}/${dateStr}/7`;

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(apiUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
      });

      await randomDelay(200, 400);

      const bodyText = await this.page.evaluate(() => document.body.innerText);
      const data = JSON.parse(bodyText);

      const events: Array<{
        id: string;
        homeTeam: string;
        awayTeam: string;
        homeScore: number;
        awayScore: number;
        period: string;
        minute?: number;
        status: 'scheduled' | 'inprogress' | 'finished';
        startTime?: Date;
      }> = [];

      // Parse stages (leagues) and their events
      for (const stage of data.Stages || []) {
        const competition = stage.Snm || stage.CompN || 'Unknown';

        for (const match of stage.Events || []) {
          try {
            const homeTeam = match.T1?.[0]?.Nm || '';
            const awayTeam = match.T2?.[0]?.Nm || '';

            if (!homeTeam || !awayTeam) continue;

            const homeScore = parseInt(match.Tr1 || '0') || 0;
            const awayScore = parseInt(match.Tr2 || '0') || 0;

            // Parse status
            // Eps: "FT" = finished, "HT" = halftime, "1H"/"2H" = in progress, time like "45'" = minute
            // Epr: 2 = finished, 1 = in progress, 0 = scheduled
            // Esid: 6 = finished, 5 = in progress, etc.
            let status: 'scheduled' | 'inprogress' | 'finished' = 'scheduled';
            let period = 'NS';
            let minute: number | undefined;

            const eps = match.Eps || '';
            const epr = match.Epr;

            if (epr === 2 || eps === 'FT' || eps.toLowerCase().includes('ft')) {
              status = 'finished';
              period = 'FT';
            } else if (epr === 1 || eps.match(/^\d+['']?$/) || eps === 'HT' || eps === '1H' || eps === '2H') {
              status = 'inprogress';
              period = this.parsePeriod(eps);
              minute = this.parseMinute(eps);
            }

            // Parse start time (Esd format: YYYYMMDDHHMMSS)
            let startTime: Date | undefined;
            if (match.Esd) {
              const esd = String(match.Esd);
              if (esd.length >= 12) {
                const year = esd.slice(0, 4);
                const month = esd.slice(4, 6);
                const day = esd.slice(6, 8);
                const hour = esd.slice(8, 10);
                const min = esd.slice(10, 12);
                startTime = new Date(`${year}-${month}-${day}T${hour}:${min}:00Z`);
              }
            }

            events.push({
              id: match.Eid || `ls_${homeTeam}_${awayTeam}`,
              homeTeam,
              awayTeam,
              homeScore,
              awayScore,
              period,
              minute,
              status,
              startTime,
            });
          } catch (e) {
            // Skip invalid matches
          }
        }
      }

      return events;
    } catch (error) {
      logger.debug(`Failed to fetch LiveScore API ${sport} events`, { error });
      return [];
    }
  }

  private parsePeriod(eps: string): string {
    const lower = eps.toLowerCase();

    if (lower === 'ft' || lower.includes('full')) return 'FT';
    if (lower === 'ht' || lower.includes('half')) return 'HT';
    if (lower === '1h' || lower.includes('1st')) return '1H';
    if (lower === '2h' || lower.includes('2nd')) return '2H';
    if (lower.includes('pen')) return 'PEN';
    if (lower.includes('et') || lower.includes('extra')) return 'ET';

    // Check for minute format like "45'" or "90+3'"
    const minuteMatch = eps.match(/(\d+)\+?(\d+)?['']?/);
    if (minuteMatch) {
      return `${minuteMatch[1]}'`;
    }

    return 'LIVE';
  }

  private parseMinute(eps: string): number | undefined {
    const minuteMatch = eps.match(/(\d+)/);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]!);
    }
    return undefined;
  }
}
