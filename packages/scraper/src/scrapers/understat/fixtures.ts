import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';
import { BaseFixturesScraper, type ScrapedFixture } from '../base';

/**
 * Understat scraper - EASY TO SCRAPE, no heavy protection
 *
 * Understat embeds JSON data directly in the page, making it very easy to extract.
 * Covers: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Russian Premier League
 *
 * Lower protection than Flashscore, good backup source.
 */
export class UnderstatFixturesScraper extends BaseFixturesScraper {
  readonly source = 'understat';
  readonly priority = 3; // Lower priority than Flashscore and Sofascore

  protected readonly sportUrls: Record<string, string> = {
    football: 'https://understat.com',
  };

  // Understat league mappings
  private readonly leagueIds: Record<string, string> = {
    'epl': 'EPL',
    'premier-league': 'EPL',
    'la-liga': 'La_liga',
    'bundesliga': 'Bundesliga',
    'serie-a': 'Serie_A',
    'ligue-1': 'Ligue_1',
    'russian-premier-league': 'RFPL',
  };

  async getUpcomingFixtures(sportSlug: string, days = 7): Promise<ScrapedFixture[]> {
    if (sportSlug !== 'football') {
      logger.debug(`Understat only supports football, skipping ${sportSlug}`);
      return [];
    }

    const allFixtures: ScrapedFixture[] = [];
    const seenIds = new Set<string>();

    // Scrape each league
    for (const [leagueName, leagueId] of Object.entries(this.leagueIds)) {
      try {
        const fixtures = await this.fetchLeagueFixtures(leagueId, leagueName);

        for (const fixture of fixtures) {
          if (!seenIds.has(fixture.externalId)) {
            seenIds.add(fixture.externalId);
            allFixtures.push(fixture);
          }
        }

        await randomDelay(500, 1000); // Be nice to Understat
      } catch (error) {
        logger.warn(`Understat: Failed to fetch ${leagueName}`, { error });
      }
    }

    // Filter to upcoming fixtures only
    const now = new Date();
    const maxDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const upcomingFixtures = allFixtures.filter(
      f => f.startTime >= now && f.startTime <= maxDate
    );

    logger.info(`Understat: Scraped ${upcomingFixtures.length} upcoming fixtures`);
    return upcomingFixtures;
  }

  private async fetchLeagueFixtures(leagueId: string, leagueName: string): Promise<ScrapedFixture[]> {
    const currentYear = new Date().getFullYear();
    // Understat uses season years like 2024 for 2024/25 season
    const season = new Date().getMonth() >= 7 ? currentYear : currentYear - 1;

    const url = `https://understat.com/league/${leagueId}/${season}`;

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      await randomDelay(500, 1000);

      // Understat embeds JSON data in script tags - look for datesData
      const fixtures = await this.page.evaluate((league) => {
        const scripts = Array.from(document.querySelectorAll('script'));

        for (const script of scripts) {
          const content = script.textContent || '';

          // Look for datesData which contains fixture info
          if (content.includes('datesData')) {
            const match = content.match(/datesData\s*=\s*JSON\.parse\('(.+?)'\)/);
            if (match) {
              try {
                // Understat escapes the JSON string
                const jsonStr = match[1]!
                  .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
                    String.fromCharCode(parseInt(hex, 16))
                  );

                const data = JSON.parse(jsonStr);

                // data is an array of dates with matches
                const results: Array<{
                  id: string;
                  homeTeam: string;
                  awayTeam: string;
                  datetime: string;
                  isResult: boolean;
                }> = [];

                for (const dateStr of Object.keys(data)) {
                  const matches = data[dateStr];
                  for (const match of matches) {
                    results.push({
                      id: match.id,
                      homeTeam: match.h?.title || match.h?.short_title || 'Unknown',
                      awayTeam: match.a?.title || match.a?.short_title || 'Unknown',
                      datetime: match.datetime,
                      isResult: match.isResult === true || match.isResult === 'true',
                    });
                  }
                }

                return results;
              } catch (e) {
                // JSON parse failed
              }
            }
          }
        }

        return [];
      }, leagueName);

      // Convert to ScrapedFixture format
      return fixtures
        .filter(f => !f.isResult) // Only upcoming fixtures
        .map(f => this.parseFixture(f, leagueName))
        .filter((f): f is ScrapedFixture => f !== null);

    } catch (error) {
      logger.debug(`Understat: Failed to fetch ${leagueName}`, { error });
      return [];
    }
  }

  private parseFixture(
    fixture: {
      id: string;
      homeTeam: string;
      awayTeam: string;
      datetime: string;
      isResult: boolean;
    },
    leagueName: string
  ): ScrapedFixture | null {
    try {
      // Parse datetime (format: YYYY-MM-DD HH:MM:SS)
      const startTime = new Date(fixture.datetime);

      if (isNaN(startTime.getTime())) {
        return null;
      }

      // Format league name nicely
      const competition = leagueName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      return {
        externalId: `us_${fixture.id}`,
        sportSlug: 'football',
        competition: competition,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        startTime,
        source: 'understat',
      };
    } catch {
      return null;
    }
  }
}

/**
 * Understat live scores/results scraper
 */
export class UnderstatResultsScraper {
  constructor(private page: Page) {}

  async getResults(externalIds: string[]): Promise<Map<string, {
    homeScore: number;
    awayScore: number;
    isFinished: boolean;
  }>> {
    const results = new Map<string, { homeScore: number; awayScore: number; isFinished: boolean }>();

    // Extract Understat IDs
    const understatIds = externalIds
      .filter(id => id.startsWith('us_'))
      .map(id => id.replace('us_', ''));

    if (understatIds.length === 0) {
      return results;
    }

    // Fetch individual match pages for results
    for (const matchId of understatIds.slice(0, 20)) { // Limit to avoid too many requests
      try {
        const result = await this.fetchMatchResult(matchId);
        if (result) {
          results.set(`us_${matchId}`, result);
        }
        await randomDelay(200, 400);
      } catch (error) {
        logger.debug(`Failed to fetch Understat match ${matchId}`, { error });
      }
    }

    return results;
  }

  private async fetchMatchResult(matchId: string): Promise<{
    homeScore: number;
    awayScore: number;
    isFinished: boolean;
  } | null> {
    const url = `https://understat.com/match/${matchId}`;

    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // Extract score from the page
      const result = await this.page.evaluate(() => {
        // Look for score in shotsData JSON
        const scripts = Array.from(document.querySelectorAll('script'));

        for (const script of scripts) {
          const content = script.textContent || '';

          if (content.includes('shotsData')) {
            const match = content.match(/shotsData\s*=\s*JSON\.parse\('(.+?)'\)/);
            if (match) {
              try {
                const jsonStr = match[1]!
                  .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
                    String.fromCharCode(parseInt(hex, 16))
                  );

                const data = JSON.parse(jsonStr);

                // Count goals from shots data
                let homeGoals = 0;
                let awayGoals = 0;

                if (data.h) {
                  homeGoals = data.h.filter((s: any) => s.result === 'Goal').length;
                }
                if (data.a) {
                  awayGoals = data.a.filter((s: any) => s.result === 'Goal').length;
                }

                return { homeScore: homeGoals, awayScore: awayGoals, isFinished: true };
              } catch {
                // Parse failed
              }
            }
          }
        }

        // Try extracting from visible score element
        const scoreEl = document.querySelector('.block-match-result');
        if (scoreEl) {
          const scoreText = scoreEl.textContent?.trim();
          const scoreMatch = scoreText?.match(/(\d+)\s*-\s*(\d+)/);
          if (scoreMatch) {
            return {
              homeScore: parseInt(scoreMatch[1]!),
              awayScore: parseInt(scoreMatch[2]!),
              isFinished: true,
            };
          }
        }

        return null;
      });

      return result;
    } catch {
      return null;
    }
  }
}
