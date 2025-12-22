import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';
import { matchEvents, type ScrapedEvent } from '../../utils/team-matcher';
import type { LiveScoresScraper, EventToMatch, ScrapeResult, LiveScore } from '../types';

/**
 * 365Scores API scraper - FREE, works without proxy!
 *
 * 365Scores has a public API that's accessible from AWS IPs.
 * Covers: Football, Basketball, Tennis, Baseball, Hockey
 *
 * API endpoint: https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=1&sportId=X
 * sportId: 1=Football, 2=Basketball, 3=Tennis, 4=Ice Hockey, 5=Baseball
 *
 * Response structure uses homeCompetitor/awayCompetitor objects (not a competitors array)
 * statusGroup: 2=in progress, 4=finished
 */
export class Scores365LiveScoresScraper implements LiveScoresScraper {
  constructor(private page: Page) {}

  // Sport slug mapping to 365Scores sport IDs
  private readonly sportMap: Record<string, number> = {
    football: 1,
    basketball: 2,
    tennis: 3,
    ice_hockey: 4,
    baseball: 5,
    cricket: 10, // May not be supported
  };

  async getLiveScores(events: EventToMatch[]): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    if (events.length === 0) {
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    logger.info(`365Scores: Looking for scores for ${events.length} events`);

    try {
      // Group events by sport
      const sportGroups = new Map<string, EventToMatch[]>();
      for (const event of events) {
        const sport = event.sportSlug;
        if (!sportGroups.has(sport)) {
          sportGroups.set(sport, []);
        }
        sportGroups.get(sport)!.push(event);
      }

      let totalMatched = 0;
      let totalUnmatched = 0;

      // Fetch for each sport
      for (const [sport, sportEvents] of sportGroups) {
        const sportId = this.sportMap[sport];
        if (!sportId) {
          logger.debug(`365Scores: No mapping for sport ${sport}`);
          continue;
        }

        const result = await this.fetchAndMatchSport(sportId, sport, sportEvents);
        for (const [id, score] of result.scores) {
          scores.set(id, score);
        }
        totalMatched += result.matchedCount;
        totalUnmatched += result.unmatchedCount;
      }

      logger.info(`365Scores: Matched ${totalMatched} events, ${totalUnmatched} unmatched`);
      return { scores, matchedCount: totalMatched, unmatchedCount: totalUnmatched };
    } catch (error) {
      logger.error('365Scores live scores failed', { error });
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }
  }

  private async fetchAndMatchSport(
    sportId: number,
    sportName: string,
    events: EventToMatch[]
  ): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    // 365Scores API endpoint - use allscores (not current which returns empty)
    const apiUrl = `https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=1&sportId=${sportId}`;

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

      // Parse 365Scores API response
      const scrapedEvents: ScrapedEvent[] = [];

      // 365Scores structure: { games: [...] }
      const games = data.games || [];

      for (const game of games) {
        try {
          // 365Scores uses homeCompetitor/awayCompetitor objects
          const homeTeam = game.homeCompetitor;
          const awayTeam = game.awayCompetitor;

          if (!homeTeam || !awayTeam) continue;

          // statusGroup: 2=in progress, 4=finished
          const statusGroup = game.statusGroup || 0;
          const isLive = statusGroup === 2;
          const isFinished = statusGroup === 4;

          // Skip if not live or finished
          if (!isLive && !isFinished) continue;

          scrapedEvents.push({
            homeTeam: homeTeam.name || homeTeam.shortName || '',
            awayTeam: awayTeam.name || awayTeam.shortName || '',
            homeScore: homeTeam.score ?? 0,
            awayScore: awayTeam.score ?? 0,
            period: this.parsePeriod(game),
            minute: this.parseMinute(game),
            isFinished,
            startTime: game.startTime ? new Date(game.startTime) : undefined,
            sourceId: String(game.id),
            sourceName: '365scores',
          });
        } catch (e) {
          // Skip malformed games
        }
      }

      if (scrapedEvents.length === 0) {
        logger.debug(`365Scores: No live/finished ${sportName} events found`);
        return { scores, unmatchedCount: 0, matchedCount: 0 };
      }

      logger.debug(`365Scores: Found ${scrapedEvents.length} live/finished ${sportName} events`);

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

        logger.debug(`365Scores: Matched "${scraped.homeTeam} vs ${scraped.awayTeam}" ` +
          `to "${match.dbEvent.homeTeamName} vs ${match.dbEvent.awayTeamName}" ` +
          `(confidence: ${match.confidence.toFixed(2)})`);
      }

      const unmatchedCount = scrapedEvents.length - matches.length;
      return { scores, matchedCount: matches.length, unmatchedCount };
    } catch (error) {
      logger.debug(`Failed to fetch 365Scores ${sportName} events`, { error });
      return { scores, matchedCount: 0, unmatchedCount: 0 };
    }
  }

  private parsePeriod(game: any): string {
    const statusGroup = game.statusGroup || 0;
    const statusText = game.shortStatusText || game.statusText || '';

    // statusGroup 4 = finished
    if (statusGroup === 4) return 'FT';

    // Use statusText if available (e.g., "HT", "1st Half", "2nd Half")
    if (statusText) {
      const lower = statusText.toLowerCase();
      if (lower.includes('half time') || lower === 'ht') return 'HT';
      if (lower.includes('1st') || lower.includes('first')) return '1H';
      if (lower.includes('2nd') || lower.includes('second')) return '2H';
      if (lower.includes('extra') || lower === 'et') return 'ET';
      if (lower.includes('penal') || lower === 'pen') return 'PEN';
    }

    // Check for game time display
    const gameTime = game.gameTime || game.gameTimeDisplay;
    if (gameTime && typeof gameTime === 'number' && gameTime > 0) {
      return `${Math.floor(gameTime)}'`;
    }

    return 'LIVE';
  }

  private parseMinute(game: any): number | undefined {
    const gameTime = game.gameTime;
    if (typeof gameTime === 'number' && gameTime > 0) {
      return Math.floor(gameTime);
    }
    return undefined;
  }
}
