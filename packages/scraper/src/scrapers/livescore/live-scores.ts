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
 * LiveScore.com scraper - Alternative source
 *
 * Another fallback option when other sources are blocked.
 * Uses their web interface.
 */
export class LiveScoreLiveScoresScraper {
  constructor(private page: Page) {}

  async getLiveScores(externalIds: string[]): Promise<Map<string, LiveScore>> {
    const scores = new Map<string, LiveScore>();

    if (externalIds.length === 0) {
      return scores;
    }

    logger.info(`LiveScore: Fetching live scores`);

    try {
      await retryWithBackoff(async () => {
        await this.page.goto('https://www.livescore.com/en/football/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      await randomDelay(1000, 2000);

      // Wait for matches to load
      await this.page.waitForSelector('[class*="match"], [data-testid*="match"]', {
        timeout: 10000,
      }).catch(() => {
        logger.debug('LiveScore: No matches found on page');
      });

      // Extract match data from the page
      const matches = await this.page.evaluate(() => {
        const results: Array<{
          homeTeam: string;
          awayTeam: string;
          homeScore: string;
          awayScore: string;
          status: string;
        }> = [];

        // LiveScore uses various selectors - try common patterns
        const matchElements = document.querySelectorAll(
          '[class*="match-row"], [class*="fixture"], [data-testid*="match"]'
        );

        matchElements.forEach((el) => {
          try {
            // Try to extract team names and scores
            const homeEl = el.querySelector('[class*="home"], [class*="team1"]');
            const awayEl = el.querySelector('[class*="away"], [class*="team2"]');
            const scoreEls = el.querySelectorAll('[class*="score"]');
            const statusEl = el.querySelector('[class*="status"], [class*="time"], [class*="minute"]');

            const homeTeam = homeEl?.textContent?.trim() || '';
            const awayTeam = awayEl?.textContent?.trim() || '';

            let homeScore = '0';
            let awayScore = '0';

            if (scoreEls.length >= 2) {
              homeScore = scoreEls[0]?.textContent?.trim() || '0';
              awayScore = scoreEls[1]?.textContent?.trim() || '0';
            } else if (scoreEls.length === 1) {
              const scoreText = scoreEls[0]?.textContent?.trim() || '';
              const match = scoreText.match(/(\d+)\s*[-:]\s*(\d+)/);
              if (match) {
                homeScore = match[1]!;
                awayScore = match[2]!;
              }
            }

            const status = statusEl?.textContent?.trim() || '';

            if (homeTeam && awayTeam) {
              results.push({ homeTeam, awayTeam, homeScore, awayScore, status });
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

      logger.info(`LiveScore: Retrieved ${scores.size} live/finished scores`);
      return scores;
    } catch (error) {
      logger.error('LiveScore live scores failed', { error });
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
      await retryWithBackoff(async () => {
        await this.page.goto('https://www.livescore.com/en/football/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      await randomDelay(1000, 2000);

      // Extract upcoming matches
      const upcomingMatches = await this.page.evaluate(() => {
        const results: Array<{
          homeTeam: string;
          awayTeam: string;
          time: string;
          competition: string;
        }> = [];

        // Look for scheduled matches
        const matchElements = document.querySelectorAll('[class*="scheduled"], [class*="upcoming"]');

        matchElements.forEach((el) => {
          try {
            const homeEl = el.querySelector('[class*="home"]');
            const awayEl = el.querySelector('[class*="away"]');
            const timeEl = el.querySelector('[class*="time"], [class*="kickoff"]');
            const compEl = el.closest('[class*="league"], [class*="competition"]');

            results.push({
              homeTeam: homeEl?.textContent?.trim() || '',
              awayTeam: awayEl?.textContent?.trim() || '',
              time: timeEl?.textContent?.trim() || '',
              competition: compEl?.querySelector('[class*="name"]')?.textContent?.trim() || 'Unknown',
            });
          } catch {
            // Skip
          }
        });

        return results;
      });

      for (const match of upcomingMatches) {
        if (match.homeTeam && match.awayTeam) {
          const id = `ls_${match.homeTeam.toLowerCase().replace(/\s+/g, '_')}_${match.awayTeam.toLowerCase().replace(/\s+/g, '_')}`;

          fixtures.push({
            externalId: id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            competition: match.competition,
            startTime: this.parseTime(match.time),
          });
        }
      }

    } catch (error) {
      logger.error('LiveScore fixtures failed', { error });
    }

    return fixtures;
  }

  private findMatchingId(
    match: { homeTeam: string; awayTeam: string },
    externalIds: string[]
  ): string | null {
    const homeTeam = match.homeTeam.toLowerCase();
    const awayTeam = match.awayTeam.toLowerCase();

    // Check for LiveScore IDs first
    for (const externalId of externalIds) {
      if (externalId.startsWith('ls_')) {
        const idParts = externalId.replace('ls_', '').split('_');
        if (idParts.some(p => homeTeam.includes(p)) &&
            idParts.some(p => awayTeam.includes(p))) {
          return externalId;
        }
      }
    }

    // Try fuzzy matching with other IDs
    for (const externalId of externalIds) {
      const idLower = externalId.toLowerCase();
      if ((idLower.includes(homeTeam.substring(0, 4)) ||
           idLower.includes(awayTeam.substring(0, 4)))) {
        return externalId;
      }
    }

    return null;
  }

  private parseMatch(
    match: { homeTeam: string; awayTeam: string; homeScore: string; awayScore: string; status: string },
    externalId: string
  ): LiveScore | null {
    try {
      const homeScore = parseInt(match.homeScore) || 0;
      const awayScore = parseInt(match.awayScore) || 0;
      const status = match.status.toLowerCase();

      let period = 'LIVE';
      let isFinished = false;
      let minute: number | undefined;

      if (status.includes('ft') || status.includes('finished') || status.includes('full')) {
        period = 'FT';
        isFinished = true;
      } else if (status.includes('ht') || status.includes('half')) {
        period = 'HT';
      } else if (status.includes('1st') || status.includes('first')) {
        period = '1H';
      } else if (status.includes('2nd') || status.includes('second')) {
        period = '2H';
      } else {
        // Try to extract minute
        const minuteMatch = status.match(/(\d+)/);
        if (minuteMatch) {
          minute = parseInt(minuteMatch[1]!);
          period = `${minute}'`;
        }
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

  private parseTime(timeStr: string): Date {
    // Try to parse time like "15:00" or "3:00 PM"
    const now = new Date();

    const match24 = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match24) {
      const date = new Date(now);
      date.setHours(parseInt(match24[1]!), parseInt(match24[2]!), 0, 0);
      return date;
    }

    // Default to now if can't parse
    return now;
  }
}
