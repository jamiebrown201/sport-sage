import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';

export interface OddsPortalOdds {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  startTime?: Date;
  bookmakerCount: number;
}

export interface OddsPortalEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  startTime?: Date;
  odds: OddsPortalOdds | null;
}

/**
 * OddsPortal scraper - Works FREE without proxy!
 *
 * Covers: Football, Basketball, Tennis, Hockey, Baseball, Handball, Volleyball
 * Provides: Odds comparison from multiple bookmakers
 *
 * Test result (2024-12-21): 187 items found, works without proxy
 */
export class OddsPortalScraper {
  constructor(private page: Page) {}

  private readonly sportUrls: Record<string, string> = {
    football: 'https://www.oddsportal.com/football/',
    basketball: 'https://www.oddsportal.com/basketball/',
    tennis: 'https://www.oddsportal.com/tennis/',
    hockey: 'https://www.oddsportal.com/hockey/',
    baseball: 'https://www.oddsportal.com/baseball/',
    handball: 'https://www.oddsportal.com/handball/',
    volleyball: 'https://www.oddsportal.com/volleyball/',
  };

  async getUpcomingOdds(sport: string = 'football'): Promise<OddsPortalEvent[]> {
    const events: OddsPortalEvent[] = [];
    const url = this.sportUrls[sport] || this.sportUrls.football;

    logger.info(`OddsPortal: Fetching ${sport} odds`);

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      await randomDelay(1500, 2500);

      // Wait for matches to load
      await this.page.waitForSelector('[class*="eventRow"], [class*="event-row"], table tbody tr', {
        timeout: 10000,
      }).catch(() => {
        logger.debug('OddsPortal: No matches found on page');
      });

      // Extract event data with odds
      const scrapedEvents = await this.page.evaluate((sportName) => {
        const results: Array<{
          id: string;
          homeTeam: string;
          awayTeam: string;
          competition: string;
          time: string;
          odds: {
            home: string;
            draw: string;
            away: string;
            bookmakerCount: number;
          } | null;
        }> = [];

        let currentCompetition = '';

        // OddsPortal uses table rows for events
        const rows = document.querySelectorAll(
          'table tbody tr, [class*="eventRow"], [class*="event-row"], .table-main tr'
        );

        rows.forEach((row, idx) => {
          try {
            // Check if this is a competition header
            const compHeader = row.querySelector('[class*="table-participant"], th, .table-participant');
            if (compHeader && !row.querySelector('[class*="odds"]')) {
              const compText = compHeader.textContent?.trim();
              if (compText && compText.length > 3) {
                currentCompetition = compText;
              }
              return;
            }

            // Try to find team names
            const participantEl = row.querySelector(
              '[class*="participant"], [class*="team"], .table-participant a, td:first-child a'
            );
            const participantText = participantEl?.textContent?.trim() || '';

            // OddsPortal typically shows "Team1 - Team2" format
            let homeTeam = '';
            let awayTeam = '';

            if (participantText.includes(' - ')) {
              const parts = participantText.split(' - ');
              homeTeam = parts[0]?.trim() || '';
              awayTeam = parts[1]?.trim() || '';
            } else if (participantText.includes(' v ')) {
              const parts = participantText.split(' v ');
              homeTeam = parts[0]?.trim() || '';
              awayTeam = parts[1]?.trim() || '';
            } else if (participantText.includes(' vs ')) {
              const parts = participantText.split(' vs ');
              homeTeam = parts[0]?.trim() || '';
              awayTeam = parts[1]?.trim() || '';
            }

            if (!homeTeam || !awayTeam) return;

            // Find time
            const timeEl = row.querySelector('[class*="time"], .table-time, td:nth-child(1)');
            const time = timeEl?.textContent?.trim() || '';

            // Find odds - typically in table cells
            const oddsCells = row.querySelectorAll('[class*="odds"], .odds-nowrp, td[class*="odds"]');
            let odds: {
              home: string;
              draw: string;
              away: string;
              bookmakerCount: number;
            } | null = null;

            if (oddsCells.length >= 2) {
              // For 2-way markets (tennis, basketball)
              if (oddsCells.length === 2) {
                odds = {
                  home: oddsCells[0]?.textContent?.trim() || '',
                  draw: '',
                  away: oddsCells[1]?.textContent?.trim() || '',
                  bookmakerCount: 1,
                };
              } else if (oddsCells.length >= 3) {
                // For 3-way markets (football, hockey)
                odds = {
                  home: oddsCells[0]?.textContent?.trim() || '',
                  draw: oddsCells[1]?.textContent?.trim() || '',
                  away: oddsCells[2]?.textContent?.trim() || '',
                  bookmakerCount: 1,
                };
              }
            }

            // Also try alternate odds selectors
            if (!odds || (!odds.home && !odds.away)) {
              const altOdds = row.querySelectorAll('a[class*="odds"], span[class*="odds"]');
              if (altOdds.length >= 2) {
                if (altOdds.length === 2) {
                  odds = {
                    home: altOdds[0]?.textContent?.trim() || '',
                    draw: '',
                    away: altOdds[1]?.textContent?.trim() || '',
                    bookmakerCount: 1,
                  };
                } else if (altOdds.length >= 3) {
                  odds = {
                    home: altOdds[0]?.textContent?.trim() || '',
                    draw: altOdds[1]?.textContent?.trim() || '',
                    away: altOdds[2]?.textContent?.trim() || '',
                    bookmakerCount: 1,
                  };
                }
              }
            }

            const id = `op_${sportName}_${homeTeam.toLowerCase().replace(/\s+/g, '_')}_${idx}`;

            results.push({
              id,
              homeTeam,
              awayTeam,
              competition: currentCompetition || 'Unknown',
              time,
              odds,
            });
          } catch {
            // Skip failed rows
          }
        });

        return results;
      }, sport);

      for (const event of scrapedEvents) {
        const parsedEvent = this.parseEvent(event, sport);
        if (parsedEvent) {
          events.push(parsedEvent);
        }
      }

      logger.info(`OddsPortal: Retrieved ${events.length} ${sport} events with odds`);
      return events;
    } catch (error) {
      logger.error(`OddsPortal ${sport} failed`, { error });
      return events;
    }
  }

  async getOddsForMatch(matchUrl: string): Promise<OddsPortalOdds | null> {
    logger.info(`OddsPortal: Fetching detailed odds from ${matchUrl}`);

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(matchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      });

      await randomDelay(1500, 2500);

      // Wait for odds table
      await this.page.waitForSelector('[class*="odds"], table', {
        timeout: 10000,
      }).catch(() => {
        logger.debug('OddsPortal: No odds table found');
      });

      const oddsData = await this.page.evaluate(() => {
        const result: {
          homeTeam: string;
          awayTeam: string;
          competition: string;
          odds: Array<{
            bookmaker: string;
            home: string;
            draw: string;
            away: string;
          }>;
        } = {
          homeTeam: '',
          awayTeam: '',
          competition: '',
          odds: [],
        };

        // Get match info
        const participantEl = document.querySelector('[class*="participant"], h1');
        const participantText = participantEl?.textContent?.trim() || '';

        if (participantText.includes(' - ')) {
          const parts = participantText.split(' - ');
          result.homeTeam = parts[0]?.trim() || '';
          result.awayTeam = parts[1]?.trim() || '';
        }

        // Get competition
        const compEl = document.querySelector('[class*="breadcrumb"] a:last-child, [class*="tournament"]');
        result.competition = compEl?.textContent?.trim() || 'Unknown';

        // Get odds from all bookmakers
        const oddsRows = document.querySelectorAll('[class*="bookmaker-row"], table tbody tr');

        oddsRows.forEach((row) => {
          try {
            const bookmakerEl = row.querySelector('[class*="bookmaker"], td:first-child');
            const oddsCells = row.querySelectorAll('[class*="odds"], td[class*="odds"]');

            if (oddsCells.length >= 2) {
              result.odds.push({
                bookmaker: bookmakerEl?.textContent?.trim() || 'Unknown',
                home: oddsCells[0]?.textContent?.trim() || '',
                draw: oddsCells.length >= 3 ? (oddsCells[1]?.textContent?.trim() || '') : '',
                away: oddsCells[oddsCells.length - 1]?.textContent?.trim() || '',
              });
            }
          } catch {
            // Skip
          }
        });

        return result;
      });

      if (!oddsData.homeTeam || oddsData.odds.length === 0) {
        return null;
      }

      // Calculate consensus odds (average of all bookmakers)
      const homeOdds = oddsData.odds
        .map(o => this.parseOddsValue(o.home))
        .filter((n): n is number => n !== null);
      const drawOdds = oddsData.odds
        .map(o => this.parseOddsValue(o.draw))
        .filter((n): n is number => n !== null);
      const awayOdds = oddsData.odds
        .map(o => this.parseOddsValue(o.away))
        .filter((n): n is number => n !== null);

      return {
        homeTeam: oddsData.homeTeam,
        awayTeam: oddsData.awayTeam,
        competition: oddsData.competition,
        homeWin: homeOdds.length > 0 ? this.calculateAverage(homeOdds) : undefined,
        draw: drawOdds.length > 0 ? this.calculateAverage(drawOdds) : undefined,
        awayWin: awayOdds.length > 0 ? this.calculateAverage(awayOdds) : undefined,
        bookmakerCount: oddsData.odds.length,
      };
    } catch (error) {
      logger.error('OddsPortal detailed odds failed', { error });
      return null;
    }
  }

  private parseEvent(
    event: {
      id: string;
      homeTeam: string;
      awayTeam: string;
      competition: string;
      time: string;
      odds: { home: string; draw: string; away: string; bookmakerCount: number } | null;
    },
    sport: string
  ): OddsPortalEvent | null {
    try {
      let parsedOdds: OddsPortalOdds | null = null;

      if (event.odds) {
        const homeOdds = this.parseOddsValue(event.odds.home);
        const drawOdds = this.parseOddsValue(event.odds.draw);
        const awayOdds = this.parseOddsValue(event.odds.away);

        if (homeOdds || awayOdds) {
          parsedOdds = {
            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,
            competition: event.competition,
            homeWin: homeOdds ?? undefined,
            draw: drawOdds ?? undefined,
            awayWin: awayOdds ?? undefined,
            bookmakerCount: event.odds.bookmakerCount,
          };
        }
      }

      return {
        id: event.id,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        competition: event.competition,
        startTime: this.parseTime(event.time),
        odds: parsedOdds,
      };
    } catch {
      return null;
    }
  }

  private parseOddsValue(text: string): number | null {
    if (!text || text === '-' || text === '' || text === 'N/A') return null;

    // Handle fractional odds (e.g., "5/2")
    if (text.includes('/')) {
      const [num, den] = text.split('/').map(Number);
      if (num && den) {
        return parseFloat((num / den + 1).toFixed(2));
      }
    }

    // Handle decimal odds
    const decimal = parseFloat(text.replace(',', '.'));
    if (!isNaN(decimal) && decimal > 1) {
      return parseFloat(decimal.toFixed(2));
    }

    return null;
  }

  private parseTime(timeStr: string): Date | undefined {
    if (!timeStr) return undefined;

    const now = new Date();

    // Try to parse time like "15:00" or "20:30"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const date = new Date(now);
      date.setHours(parseInt(timeMatch[1]!), parseInt(timeMatch[2]!), 0, 0);
      // If time is in the past, assume it's tomorrow
      if (date < now) {
        date.setDate(date.getDate() + 1);
      }
      return date;
    }

    // Try to parse date like "21 Dec" or "21/12"
    const dateMatch = timeStr.match(/(\d{1,2})\s*(?:\/|\.|\s+)(\d{1,2}|\w+)/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]!);
      let month: number;

      // Check if second part is month name or number
      const monthPart = dateMatch[2]!;
      if (/^\d+$/.test(monthPart)) {
        month = parseInt(monthPart) - 1;
      } else {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        month = monthNames.findIndex(m => monthPart.toLowerCase().startsWith(m));
        if (month === -1) month = now.getMonth();
      }

      const date = new Date(now.getFullYear(), month, day);
      if (date < now) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return date;
    }

    return undefined;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return parseFloat((sum / numbers.length).toFixed(2));
  }

  getSupportedSports(): string[] {
    return Object.keys(this.sportUrls);
  }
}
