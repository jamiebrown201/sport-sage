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
 * ESPN scraper - FREE, works without proxy
 *
 * ESPN has low protection and provides good football data.
 * One of the best free sources available.
 */
export class ESPNLiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(externalIds: string[]): Promise<Map<string, LiveScore>> {
    const scores = new Map<string, LiveScore>();

    if (externalIds.length === 0) {
      return scores;
    }

    logger.info(`ESPN: Fetching live scores`);

    try {
      await retryWithBackoff(async () => {
        await this.page.goto('https://www.espn.com/soccer/scoreboard', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      await randomDelay(1000, 2000);

      // Wait for scores to load
      await this.page.waitForSelector('[class*="ScoreCell"], [class*="scoreboard"]', {
        timeout: 10000,
      }).catch(() => {
        logger.debug('ESPN: Waiting for content...');
      });

      // Extract match data
      const matches = await this.page.evaluate(() => {
        const results: Array<{
          homeTeam: string;
          awayTeam: string;
          homeScore: number;
          awayScore: number;
          status: string;
          gameId: string;
        }> = [];

        // Try various ESPN selectors
        const scoreboardItems = document.querySelectorAll(
          '[class*="Scoreboard"], [class*="ScoreCell"], [class*="game"]'
        );

        scoreboardItems.forEach((item) => {
          try {
            // Look for team names
            const teamEls = item.querySelectorAll('[class*="TeamName"], [class*="team-name"]');
            const scoreEls = item.querySelectorAll('[class*="Score"], [class*="score"]');
            const statusEl = item.querySelector('[class*="StatusText"], [class*="time"], [class*="status"]');

            if (teamEls.length >= 2) {
              const homeTeam = teamEls[0]?.textContent?.trim() || '';
              const awayTeam = teamEls[1]?.textContent?.trim() || '';

              let homeScore = 0;
              let awayScore = 0;

              if (scoreEls.length >= 2) {
                homeScore = parseInt(scoreEls[0]?.textContent?.trim() || '0') || 0;
                awayScore = parseInt(scoreEls[1]?.textContent?.trim() || '0') || 0;
              }

              const status = statusEl?.textContent?.trim() || '';

              // Generate ID
              const gameId = `espn_${homeTeam.toLowerCase().replace(/\s+/g, '_')}_${awayTeam.toLowerCase().replace(/\s+/g, '_')}`;

              if (homeTeam && awayTeam) {
                results.push({
                  homeTeam,
                  awayTeam,
                  homeScore,
                  awayScore,
                  status,
                  gameId,
                });
              }
            }
          } catch {
            // Skip failed elements
          }
        });

        return results;
      });

      // Match with our external IDs
      for (const match of matches) {
        const matchingId = this.findMatchingId(match, externalIds);
        if (matchingId) {
          const score = this.parseMatch(match, matchingId);
          if (score) {
            scores.set(matchingId, score);
          }
        }
      }

      logger.info(`ESPN: Retrieved ${scores.size} live/finished scores`);
      return scores;
    } catch (error) {
      logger.error('ESPN live scores failed', { error });
      return scores;
    }
  }

  async getFixtures(days = 7): Promise<Array<{
    externalId: string;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    startTime: Date;
  }>> {
    const fixtures: Array<{
      externalId: string;
      homeTeam: string;
      awayTeam: string;
      competition: string;
      startTime: Date;
    }> = [];

    try {
      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        const dateStr = date.toISOString().split('T')[0]!.replace(/-/g, '');

        await this.page.goto(
          `https://www.espn.com/soccer/schedule/_/date/${dateStr}`,
          { waitUntil: 'domcontentloaded', timeout: 30000 }
        );

        await randomDelay(500, 1000);

        const dayFixtures = await this.page.evaluate(() => {
          const results: Array<{
            homeTeam: string;
            awayTeam: string;
            time: string;
            competition: string;
          }> = [];

          const rows = document.querySelectorAll(
            '[class*="Schedule"], [class*="schedule-row"], [class*="game"]'
          );

          rows.forEach((row) => {
            try {
              const teamEls = row.querySelectorAll('[class*="team"]');
              const timeEl = row.querySelector('[class*="time"], [class*="date"]');
              const compEl = row.querySelector('[class*="league"], [class*="competition"]');

              if (teamEls.length >= 2) {
                results.push({
                  homeTeam: teamEls[0]?.textContent?.trim() || '',
                  awayTeam: teamEls[1]?.textContent?.trim() || '',
                  time: timeEl?.textContent?.trim() || '',
                  competition: compEl?.textContent?.trim() || 'Football',
                });
              }
            } catch {
              // Skip
            }
          });

          return results;
        });

        for (const match of dayFixtures) {
          if (match.homeTeam && match.awayTeam) {
            fixtures.push({
              externalId: `espn_${match.homeTeam.toLowerCase().replace(/\s+/g, '_')}_${match.awayTeam.toLowerCase().replace(/\s+/g, '_')}`,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              competition: match.competition,
              startTime: this.parseTime(match.time, date),
            });
          }
        }
      }
    } catch (error) {
      logger.error('ESPN fixtures failed', { error });
    }

    return fixtures;
  }

  private findMatchingId(
    match: { homeTeam: string; awayTeam: string; gameId: string },
    externalIds: string[]
  ): string | null {
    // Check for ESPN IDs first
    if (externalIds.includes(match.gameId)) {
      return match.gameId;
    }

    const homeTeam = match.homeTeam.toLowerCase();
    const awayTeam = match.awayTeam.toLowerCase();

    // Try fuzzy matching
    for (const externalId of externalIds) {
      const idLower = externalId.toLowerCase();
      if (
        idLower.includes(homeTeam.substring(0, 4)) ||
        idLower.includes(awayTeam.substring(0, 4))
      ) {
        return externalId;
      }
    }

    return null;
  }

  private parseMatch(
    match: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      status: string;
    },
    externalId: string
  ): LiveScore | null {
    try {
      const status = match.status.toLowerCase();

      let period = 'LIVE';
      let isFinished = false;
      let minute: number | undefined;

      if (status.includes('ft') || status.includes('final')) {
        period = 'FT';
        isFinished = true;
      } else if (status.includes('ht') || status.includes('half')) {
        period = 'HT';
      } else if (status.includes('1st') || status.includes('first')) {
        period = '1H';
      } else if (status.includes('2nd') || status.includes('second')) {
        period = '2H';
      } else {
        const minuteMatch = status.match(/(\d+)/);
        if (minuteMatch) {
          minute = parseInt(minuteMatch[1]!);
          period = `${minute}'`;
        }
      }

      return {
        externalId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        period,
        minute,
        isFinished,
      };
    } catch {
      return null;
    }
  }

  private parseTime(timeStr: string, date: Date): Date {
    const result = new Date(date);

    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      result.setHours(parseInt(match[1]!), parseInt(match[2]!), 0, 0);
    }

    return result;
  }
}
