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
 * 365Scores scraper - Works FREE without proxy!
 *
 * Covers: Football, Basketball, Tennis, Baseball, Hockey
 * 2000+ competitions available
 *
 * Test result (2024-12-21): 63 items found, works without proxy
 */
export class Scores365LiveScoresScraper {
  constructor(private page: Page) {}

  private readonly sportUrls: Record<string, string> = {
    football: 'https://www.365scores.com/football',
    basketball: 'https://www.365scores.com/basketball',
    tennis: 'https://www.365scores.com/tennis',
    baseball: 'https://www.365scores.com/baseball',
    hockey: 'https://www.365scores.com/hockey',
  };

  /**
   * Get live scores - compatible with orchestrator interface
   * If externalIds provided, will try to match; otherwise returns all
   */
  async getLiveScores(externalIds?: string[]): Promise<Map<string, LiveScore>> {
    const scores = new Map<string, LiveScore>();

    // If no specific IDs, scrape football by default
    const sports = externalIds?.length ? this.detectSportsFromIds(externalIds) : ['football'];

    for (const sport of sports) {
      const sportScores = await this.getLiveScoresForSport(sport);
      for (const [id, score] of sportScores) {
        scores.set(id, score);
      }
    }

    return scores;
  }

  /**
   * Detect which sports to scrape based on external IDs
   */
  private detectSportsFromIds(externalIds: string[]): string[] {
    const sports = new Set<string>();

    for (const id of externalIds) {
      const idLower = id.toLowerCase();
      if (idLower.includes('football') || idLower.includes('soccer')) {
        sports.add('football');
      } else if (idLower.includes('basketball') || idLower.includes('nba')) {
        sports.add('basketball');
      } else if (idLower.includes('tennis')) {
        sports.add('tennis');
      } else if (idLower.includes('baseball') || idLower.includes('mlb')) {
        sports.add('baseball');
      } else if (idLower.includes('hockey') || idLower.includes('nhl')) {
        sports.add('hockey');
      }
    }

    // Default to football if can't detect
    if (sports.size === 0) {
      sports.add('football');
    }

    return Array.from(sports);
  }

  async getLiveScoresForSport(sport: string = 'football'): Promise<Map<string, LiveScore>> {
    const scores = new Map<string, LiveScore>();
    const url = this.sportUrls[sport] || this.sportUrls.football;

    logger.info(`365Scores: Fetching ${sport} live scores`);

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      await randomDelay(1000, 2000);

      // Wait for games to load
      await this.page.waitForSelector('[class*="game"], [class*="match"]', {
        timeout: 10000,
      }).catch(() => {
        logger.debug('365Scores: No games found');
      });

      // Extract match data
      const matches = await this.page.evaluate((sportName) => {
        const results: Array<{
          id: string;
          homeTeam: string;
          awayTeam: string;
          homeScore: number;
          awayScore: number;
          status: string;
          competition: string;
        }> = [];

        // 365Scores uses game cards
        const gameElements = document.querySelectorAll(
          '[class*="game-card"], [class*="GameCard"], [class*="match"]'
        );

        gameElements.forEach((el, idx) => {
          try {
            // Find team names
            const teamEls = el.querySelectorAll('[class*="team-name"], [class*="TeamName"]');
            const scoreEls = el.querySelectorAll('[class*="score"], [class*="Score"]');
            const statusEl = el.querySelector('[class*="status"], [class*="time"], [class*="Status"]');
            const compEl = el.querySelector('[class*="competition"], [class*="league"], [class*="Competition"]');

            let homeTeam = '';
            let awayTeam = '';
            let homeScore = 0;
            let awayScore = 0;

            if (teamEls.length >= 2) {
              homeTeam = teamEls[0]?.textContent?.trim() || '';
              awayTeam = teamEls[1]?.textContent?.trim() || '';
            }

            if (scoreEls.length >= 2) {
              homeScore = parseInt(scoreEls[0]?.textContent?.trim() || '0') || 0;
              awayScore = parseInt(scoreEls[1]?.textContent?.trim() || '0') || 0;
            } else if (scoreEls.length === 1) {
              const scoreText = scoreEls[0]?.textContent?.trim() || '';
              const match = scoreText.match(/(\d+)\s*[-:]\s*(\d+)/);
              if (match) {
                homeScore = parseInt(match[1]!) || 0;
                awayScore = parseInt(match[2]!) || 0;
              }
            }

            const status = statusEl?.textContent?.trim() || '';
            const competition = compEl?.textContent?.trim() || 'Unknown';

            if (homeTeam && awayTeam) {
              const id = `365_${sportName}_${homeTeam.toLowerCase().replace(/\s+/g, '_')}_${idx}`;
              results.push({
                id,
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
                status,
                competition,
              });
            }
          } catch {
            // Skip failed elements
          }
        });

        return results;
      }, sport);

      for (const match of matches) {
        const score = this.parseMatch(match);
        if (score) {
          scores.set(match.id, score);
        }
      }

      logger.info(`365Scores: Retrieved ${scores.size} ${sport} scores`);
      return scores;
    } catch (error) {
      logger.error(`365Scores ${sport} failed`, { error });
      return scores;
    }
  }

  async getFixtures(sport: string = 'football', days = 7): Promise<Array<{
    externalId: string;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    startTime: Date;
    sport: string;
  }>> {
    const fixtures: Array<{
      externalId: string;
      homeTeam: string;
      awayTeam: string;
      competition: string;
      startTime: Date;
      sport: string;
    }> = [];

    const url = this.sportUrls[sport] || this.sportUrls.football;

    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await randomDelay(1000, 2000);

      const upcomingMatches = await this.page.evaluate((sportName) => {
        const results: Array<{
          homeTeam: string;
          awayTeam: string;
          time: string;
          competition: string;
        }> = [];

        // Find upcoming games (not started yet)
        const gameElements = document.querySelectorAll('[class*="game-card"], [class*="upcoming"]');

        gameElements.forEach((el) => {
          try {
            const teamEls = el.querySelectorAll('[class*="team-name"]');
            const timeEl = el.querySelector('[class*="time"], [class*="kickoff"]');
            const compEl = el.querySelector('[class*="competition"]');

            if (teamEls.length >= 2) {
              results.push({
                homeTeam: teamEls[0]?.textContent?.trim() || '',
                awayTeam: teamEls[1]?.textContent?.trim() || '',
                time: timeEl?.textContent?.trim() || '',
                competition: compEl?.textContent?.trim() || 'Unknown',
              });
            }
          } catch {
            // Skip
          }
        });

        return results;
      }, sport);

      for (const match of upcomingMatches) {
        if (match.homeTeam && match.awayTeam) {
          fixtures.push({
            externalId: `365_${sport}_${match.homeTeam.toLowerCase().replace(/\s+/g, '_')}_${match.awayTeam.toLowerCase().replace(/\s+/g, '_')}`,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            competition: match.competition,
            startTime: this.parseTime(match.time),
            sport,
          });
        }
      }
    } catch (error) {
      logger.error(`365Scores ${sport} fixtures failed`, { error });
    }

    return fixtures;
  }

  private parseMatch(match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    status: string;
  }): LiveScore | null {
    try {
      const status = match.status.toLowerCase();

      let period = 'LIVE';
      let isFinished = false;
      let minute: number | undefined;

      if (status.includes('ft') || status.includes('final') || status.includes('ended')) {
        period = 'FT';
        isFinished = true;
      } else if (status.includes('ht') || status.includes('half')) {
        period = 'HT';
      } else if (status.includes('1st') || status.includes('1h')) {
        period = '1H';
      } else if (status.includes('2nd') || status.includes('2h')) {
        period = '2H';
      } else if (status.includes('live') || status.includes('progress')) {
        period = 'LIVE';
      } else if (status.includes('ns') || status.includes('scheduled')) {
        period = 'NS';
      } else {
        const minuteMatch = status.match(/(\d+)/);
        if (minuteMatch) {
          minute = parseInt(minuteMatch[1]!);
          period = `${minute}'`;
        }
      }

      return {
        externalId: match.id,
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

  private parseTime(timeStr: string): Date {
    const now = new Date();
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      now.setHours(parseInt(match[1]!), parseInt(match[2]!), 0, 0);
    }
    return now;
  }

  getSupportedSports(): string[] {
    return Object.keys(this.sportUrls);
  }
}
