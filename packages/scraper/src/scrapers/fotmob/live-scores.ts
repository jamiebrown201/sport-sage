import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';
import { matchEvents, type ScrapedEvent } from '../../utils/team-matcher';
import type { LiveScoresScraper, EventToMatch, ScrapeResult, LiveScore } from '../types';

/**
 * FotMob API scraper - FREE, works without proxy (FOOTBALL ONLY)
 *
 * FotMob has a JSON API that's relatively accessible from AWS IPs.
 * Only supports football/soccer - no other sports.
 *
 * API endpoint: https://www.fotmob.com/api/matches?date=YYYYMMDD
 */
export class FotMobLiveScoresScraper implements LiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(events: EventToMatch[]): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    if (events.length === 0) {
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    // FotMob only supports football
    const footballEvents = events.filter(e => e.sportSlug === 'football');

    if (footballEvents.length === 0) {
      logger.debug('FotMob: No football events to match');
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }

    logger.info(`FotMob: Looking for scores for ${footballEvents.length} football events`);

    try {
      const result = await this.fetchAndMatchFootball(footballEvents);
      return result;
    } catch (error) {
      logger.error('FotMob live scores failed', { error });
      return { scores, unmatchedCount: 0, matchedCount: 0 };
    }
  }

  private async fetchAndMatchFootball(events: EventToMatch[]): Promise<ScrapeResult> {
    const scores = new Map<string, LiveScore>();

    // FotMob API endpoint for today's matches
    const today = new Date().toISOString().split('T')[0]!.replace(/-/g, '');
    const apiUrl = `https://www.fotmob.com/api/matches?date=${today}`;

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

      // Parse FotMob API response
      const scrapedEvents: ScrapedEvent[] = [];

      // FotMob structure: { leagues: [{ matches: [...] }] }
      if (data.leagues) {
        for (const league of data.leagues) {
          if (!league.matches) continue;

          for (const match of league.matches) {
            try {
              const status = match.status || {};
              const isLive = status.started && !status.finished;
              const isFinished = status.finished === true;

              // Skip if not live or finished
              if (!isLive && !isFinished) continue;

              scrapedEvents.push({
                homeTeam: match.home?.name || match.homeTeam?.name || '',
                awayTeam: match.away?.name || match.awayTeam?.name || '',
                homeScore: match.home?.score ?? 0,
                awayScore: match.away?.score ?? 0,
                period: this.parsePeriod(status),
                minute: this.parseMinute(status),
                isFinished,
                startTime: match.timeTS ? new Date(match.timeTS * 1000) : undefined,
                sourceId: String(match.id),
                sourceName: 'fotmob',
              });
            } catch (e) {
              // Skip malformed matches
            }
          }
        }
      }

      if (scrapedEvents.length === 0) {
        logger.debug('FotMob: No live/finished football events found');
        return { scores, unmatchedCount: 0, matchedCount: 0 };
      }

      logger.debug(`FotMob: Found ${scrapedEvents.length} live/finished football events`);

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

        logger.debug(`FotMob: Matched "${scraped.homeTeam} vs ${scraped.awayTeam}" ` +
          `to "${match.dbEvent.homeTeamName} vs ${match.dbEvent.awayTeamName}" ` +
          `(confidence: ${match.confidence.toFixed(2)})`);
      }

      const unmatchedCount = scrapedEvents.length - matches.length;
      return { scores, matchedCount: matches.length, unmatchedCount };
    } catch (error) {
      logger.debug('Failed to fetch FotMob events', { error });
      return { scores, matchedCount: 0, unmatchedCount: 0 };
    }
  }

  private parsePeriod(status: any): string {
    if (status.finished) return 'FT';
    if (status.halftime) return 'HT';

    // Check liveTime for minute display
    if (status.liveTime?.short) {
      const short = status.liveTime.short;
      // FotMob uses "45'" or "90+3'" format
      return short;
    }

    if (status.started) {
      return 'LIVE';
    }

    return 'NS';
  }

  private parseMinute(status: any): number | undefined {
    if (status.liveTime?.short) {
      const short = status.liveTime.short;
      // Extract minute from "45'" or "90+3'" format
      const minuteMatch = short.match(/^(\d+)/);
      if (minuteMatch) {
        return parseInt(minuteMatch[1]);
      }
    }
    return undefined;
  }
}
