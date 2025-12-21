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
 * FotMob scraper - Alternative source with JSON API
 *
 * FotMob has a JSON API that's relatively accessible.
 * Good fallback when Flashscore/SofaScore are blocked.
 */
export class FotMobLiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(externalIds: string[]): Promise<Map<string, LiveScore>> {
    const scores = new Map<string, LiveScore>();

    if (externalIds.length === 0) {
      return scores;
    }

    logger.info(`FotMob: Fetching live scores`);

    try {
      // Fetch live matches from FotMob API
      const liveMatches = await this.fetchLiveMatches();

      // Try to match with our external IDs by team names
      for (const match of liveMatches) {
        const matchingId = this.findMatchingId(match, externalIds);
        if (matchingId) {
          const score = this.parseMatch(match, matchingId);
          if (score) {
            scores.set(matchingId, score);
          }
        }
      }

      logger.info(`FotMob: Retrieved ${scores.size} live/finished scores`);
      return scores;
    } catch (error) {
      logger.error('FotMob live scores failed', { error });
      return scores;
    }
  }

  private async fetchLiveMatches(): Promise<any[]> {
    // FotMob API endpoint for live matches
    const apiUrl = 'https://www.fotmob.com/api/matches?date=' + this.getTodayDate();

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

      // Extract matches from leagues
      const allMatches: any[] = [];

      if (data.leagues) {
        for (const league of data.leagues) {
          if (league.matches) {
            allMatches.push(...league.matches);
          }
        }
      }

      return allMatches;
    } catch (error) {
      logger.debug('Failed to fetch FotMob live matches', { error });
      return [];
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

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      try {
        const date = this.getDateOffset(dayOffset);
        const dayFixtures = await this.fetchDayFixtures(date);
        fixtures.push(...dayFixtures);
        await randomDelay(300, 600);
      } catch (error) {
        logger.debug(`FotMob: Failed to fetch day ${dayOffset}`, { error });
      }
    }

    return fixtures;
  }

  private async fetchDayFixtures(date: string): Promise<Array<{
    externalId: string;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    startTime: Date;
  }>> {
    const apiUrl = `https://www.fotmob.com/api/matches?date=${date}`;

    try {
      await this.page.goto(apiUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      const bodyText = await this.page.evaluate(() => document.body.innerText);
      const data = JSON.parse(bodyText);

      const fixtures: Array<{
        externalId: string;
        homeTeam: string;
        awayTeam: string;
        competition: string;
        startTime: Date;
      }> = [];

      if (data.leagues) {
        for (const league of data.leagues) {
          const leagueName = league.name || league.leagueName || 'Unknown';

          if (league.matches) {
            for (const match of league.matches) {
              if (!match.status?.started) { // Only upcoming
                fixtures.push({
                  externalId: `fm_${match.id}`,
                  homeTeam: match.home?.name || match.homeTeam?.name || 'Unknown',
                  awayTeam: match.away?.name || match.awayTeam?.name || 'Unknown',
                  competition: leagueName,
                  startTime: new Date(match.timeTS || match.status?.utcTime),
                });
              }
            }
          }
        }
      }

      return fixtures;
    } catch (error) {
      logger.debug('FotMob fixtures fetch failed', { error });
      return [];
    }
  }

  private findMatchingId(match: any, externalIds: string[]): string | null {
    const homeTeam = (match.home?.name || match.homeTeam?.name || '').toLowerCase();
    const awayTeam = (match.away?.name || match.awayTeam?.name || '').toLowerCase();

    // First check for FotMob IDs
    const fmId = `fm_${match.id}`;
    if (externalIds.includes(fmId)) {
      return fmId;
    }

    // Try to match by team names (fuzzy)
    for (const externalId of externalIds) {
      // This is a simple match - in production you'd use proper team name normalization
      if (this.teamsMatch(homeTeam, awayTeam, externalId)) {
        return externalId;
      }
    }

    return null;
  }

  private teamsMatch(homeTeam: string, awayTeam: string, externalId: string): boolean {
    // Very basic matching - just check if team names appear in the ID
    const idLower = externalId.toLowerCase();
    return idLower.includes(homeTeam.substring(0, 5)) ||
           idLower.includes(awayTeam.substring(0, 5));
  }

  private parseMatch(match: any, externalId: string): LiveScore | null {
    try {
      const status = match.status || {};
      const homeScore = match.home?.score ?? match.homeScore ?? 0;
      const awayScore = match.away?.score ?? match.awayScore ?? 0;

      let period = 'Unknown';
      let isFinished = false;
      let minute: number | undefined;

      if (status.finished) {
        period = 'FT';
        isFinished = true;
      } else if (status.started) {
        if (status.liveTime?.short) {
          period = status.liveTime.short;
          const minuteMatch = period.match(/(\d+)/);
          if (minuteMatch) {
            minute = parseInt(minuteMatch[1]!);
          }
        } else if (status.halftime) {
          period = 'HT';
        } else {
          period = 'LIVE';
        }
      } else {
        period = 'NS';
      }

      return {
        externalId,
        homeScore,
        awayScore,
        period,
        minute,
        isFinished,
      };
    } catch {
      return null;
    }
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0]!;
  }

  private getDateOffset(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]!;
  }
}
