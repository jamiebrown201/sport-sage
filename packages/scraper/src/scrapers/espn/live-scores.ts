import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';
import { matchEvents, type ScrapedEvent } from '../../utils/team-matcher';
import type { LiveScoresScraper, EventToMatch, ScrapeResult, LiveScore } from '../types';

/**
 * ESPN API scraper - FREE, works without proxy
 *
 * ESPN has a public API that's accessible from AWS IPs.
 * Uses the scoreboard API endpoint for live scores.
 *
 * Supports: football (soccer), basketball, tennis
 */
export class ESPNLiveScoresScraper implements LiveScoresScraper {
  constructor(private page: Page) {}

  // Sport slug mapping to ESPN sport codes
  private readonly sportMap: Record<string, string> = {
    football: 'soccer',
    basketball: 'basketball',
    tennis: 'tennis',
    ice_hockey: 'hockey',
    cricket: 'cricket',
  };

  async getLiveScores(events: EventToMatch[]): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    if (events.length === 0) {
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    logger.info(`ESPN: Looking for scores for ${events.length} events`);

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
        const espnSport = this.sportMap[sport];
        if (!espnSport) {
          logger.debug(`ESPN: No mapping for sport ${sport}`);
          continue;
        }

        const result = await this.fetchAndMatchSport(espnSport, sportEvents);
        for (const [id, score] of result.scores) {
          scores.set(id, score);
        }
        totalMatched += result.matchedCount;
        totalUnmatched += result.unmatchedCount;
      }

      logger.info(`ESPN: Matched ${totalMatched} events, ${totalUnmatched} unmatched`);
      return { scores, matchedCount: totalMatched, unmatchedCount: totalUnmatched };
    } catch (error) {
      logger.error('ESPN live scores failed', { error });
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }
  }

  private async fetchAndMatchSport(
    espnSport: string,
    events: EventToMatch[]
  ): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    // ESPN API endpoint for live scores
    // Format: https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
    // For soccer, league is typically 'all' or specific like 'eng.1'
    const apiUrl = espnSport === 'soccer'
      ? 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard'
      : `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/scoreboard`;

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

      // Parse ESPN API response
      const scrapedEvents: ScrapedEvent[] = [];

      // ESPN structure: { events: [...] } or { leagues: [{ events: [...] }] }
      const espnEvents = data.events || [];

      // Also check leagues structure
      if (data.leagues) {
        for (const league of data.leagues) {
          if (league.events) {
            espnEvents.push(...league.events);
          }
        }
      }

      for (const event of espnEvents) {
        try {
          const competitors = event.competitions?.[0]?.competitors || [];
          if (competitors.length < 2) continue;

          // ESPN uses 'home' field to identify home/away
          const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
          const awayTeam = competitors.find((c: any) => c.homeAway === 'away');

          if (!homeTeam || !awayTeam) continue;

          const status = event.status || event.competitions?.[0]?.status || {};
          const isLive = status.type?.state === 'in' || status.type?.name === 'STATUS_IN_PROGRESS';
          const isFinished = status.type?.state === 'post' || status.type?.completed === true;

          // Skip if not live or finished
          if (!isLive && !isFinished) continue;

          // Get competition/league name
          const competitionName = event.competitions?.[0]?.league?.name
            || event.league?.name
            || event.competitions?.[0]?.league?.abbreviation
            || undefined;

          scrapedEvents.push({
            homeTeam: homeTeam.team?.displayName || homeTeam.team?.name || '',
            awayTeam: awayTeam.team?.displayName || awayTeam.team?.name || '',
            homeScore: parseInt(homeTeam.score) || 0,
            awayScore: parseInt(awayTeam.score) || 0,
            period: this.parsePeriod(status),
            minute: this.parseMinute(status),
            isFinished,
            startTime: event.date ? new Date(event.date) : undefined,
            competitionName,
            sourceId: event.id,
            sourceName: 'espn',
          });
        } catch (e) {
          // Skip malformed events
        }
      }

      if (scrapedEvents.length === 0) {
        logger.debug(`ESPN: No live/finished ${espnSport} events found`);
        return { scores, unmatchedCount: 0, matchedCount: 0 };
      }

      logger.debug(`ESPN: Found ${scrapedEvents.length} live/finished ${espnSport} events`);

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
          competitionName: scraped.competitionName,
        });

        logger.debug(`ESPN: Matched "${scraped.homeTeam} vs ${scraped.awayTeam}" ` +
          `to "${match.dbEvent.homeTeamName} vs ${match.dbEvent.awayTeamName}" ` +
          `(confidence: ${match.confidence.toFixed(2)})`);
      }

      const unmatchedCount = scrapedEvents.length - matches.length;
      return { scores, matchedCount: matches.length, unmatchedCount };
    } catch (error) {
      logger.debug(`Failed to fetch ESPN ${espnSport} events`, { error });
      return { scores, matchedCount: 0, unmatchedCount: 0 };
    }
  }

  private parsePeriod(status: any): string {
    const type = status.type?.name || status.type?.description || '';
    const period = status.period || 0;

    if (type.includes('FINAL') || type.includes('STATUS_FINAL')) return 'FT';
    if (type.includes('HALFTIME')) return 'HT';
    if (type.includes('IN_PROGRESS') || type.includes('STATUS_IN_PROGRESS')) {
      if (period === 1) return '1H';
      if (period === 2) return '2H';
      return 'LIVE';
    }

    // Check displayClock for minute
    const clock = status.displayClock || '';
    if (clock && clock !== '0:00') {
      return clock;
    }

    return 'LIVE';
  }

  private parseMinute(status: any): number | undefined {
    const clock = status.displayClock || '';
    // ESPN shows time as "45:00" or "90+3"
    const minuteMatch = clock.match(/^(\d+)/);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]);
    }
    return undefined;
  }
}
