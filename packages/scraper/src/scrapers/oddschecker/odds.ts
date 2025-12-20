import type { Page } from 'playwright-core';
import { logger } from '../../utils/logger';
import { randomDelay, retryWithBackoff } from '../../utils/browser';

export interface ScrapedOdds {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  markets: ScrapedMarket[];
}

export interface ScrapedMarket {
  type: string;
  name: string;
  line?: number;
  outcomes: ScrapedOutcome[];
}

export interface ScrapedOutcome {
  name: string;
  odds: number;
}

export class OddscheckerScraper {
  constructor(private page: Page) {}

  async getOddsForEvent(eventUrl: string): Promise<ScrapedOdds | null> {
    logger.info('Fetching odds from Oddschecker', { url: eventUrl });

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(eventUrl, { waitUntil: 'networkidle' });
      });

      await randomDelay(1500, 3000);

      // Wait for odds table
      await this.page.waitForSelector('.odds-table, .diff-row', { timeout: 10000 }).catch(() => {
        logger.warn('Odds table not found');
      });

      const odds = await this.scrapeMainMarket();

      return odds;
    } catch (error) {
      logger.error('Failed to fetch odds', error);
      return null;
    }
  }

  async scrapeEventsWithOdds(sportSlug: string): Promise<Map<string, ScrapedOdds>> {
    const oddsMap = new Map<string, ScrapedOdds>();

    const sportUrls: Record<string, string> = {
      football: 'https://www.oddschecker.com/football',
      tennis: 'https://www.oddschecker.com/tennis',
      basketball: 'https://www.oddschecker.com/basketball',
      darts: 'https://www.oddschecker.com/darts',
      cricket: 'https://www.oddschecker.com/cricket',
    };

    const url = sportUrls[sportSlug];
    if (!url) {
      logger.warn(`No Oddschecker URL for sport: ${sportSlug}`);
      return oddsMap;
    }

    try {
      await retryWithBackoff(async () => {
        await this.page.goto(url, { waitUntil: 'networkidle' });
      });

      await randomDelay(2000, 4000);

      // Get event links
      const eventLinks = await this.page.$$eval(
        '.beta-event a[href*="/betting/"]',
        (links: Element[]) =>
          links
            .map((a) => ({
              href: (a as HTMLAnchorElement).href,
              text: a.textContent?.trim() || '',
            }))
            .filter((l) => l.href)
      );

      logger.info(`Found ${eventLinks.length} events with odds`);

      // Limit to avoid rate limiting
      const eventsToScrape = eventLinks.slice(0, 20);

      for (const event of eventsToScrape) {
        await randomDelay(2000, 4000);

        const odds = await this.getOddsForEvent(event.href);
        if (odds) {
          // Use event text as key (need to match with our events)
          oddsMap.set(event.text, odds);
        }
      }
    } catch (error) {
      logger.error(`Failed to scrape odds for ${sportSlug}`, error);
    }

    return oddsMap;
  }

  private async scrapeMainMarket(): Promise<ScrapedOdds | null> {
    try {
      // Get all bookmaker odds from the table
      const oddsRows = await this.page.$$('.diff-row, .odds-row');

      if (oddsRows.length === 0) {
        return null;
      }

      const allOdds: Array<{ outcome: string; odds: number[] }> = [];

      for (const row of oddsRows) {
        const outcome = await row
          .$eval('.diff-left-cell, .runner-name', (el: Element) => el.textContent?.trim())
          .catch(() => null);

        if (!outcome) continue;

        // Get all odds from different bookmakers
        const bookmakerOdds = await row
          .$$eval('.odds, .bc', (cells: Element[]) =>
            cells
              .map((cell) => {
                const text = cell.textContent?.trim() || '';
                return this.parseOdds(text);
              })
              .filter((o): o is number => o !== null)
          )
          .catch(() => []);

        if (bookmakerOdds.length > 0) {
          allOdds.push({ outcome, odds: bookmakerOdds });
        }
      }

      if (allOdds.length === 0) {
        return null;
      }

      // Calculate consensus odds (median)
      const consensusOdds = allOdds.map((o) => ({
        name: o.outcome,
        odds: this.calculateMedian(o.odds),
      }));

      // Determine market type and structure
      const result: ScrapedOdds = {
        markets: [
          {
            type: 'match_winner',
            name: 'Match Winner',
            outcomes: consensusOdds,
          },
        ],
      };

      // Try to identify home/draw/away
      if (consensusOdds.length === 3) {
        result.homeWin = consensusOdds[0]?.odds;
        result.draw = consensusOdds[1]?.odds;
        result.awayWin = consensusOdds[2]?.odds;
      } else if (consensusOdds.length === 2) {
        result.homeWin = consensusOdds[0]?.odds;
        result.awayWin = consensusOdds[1]?.odds;
      }

      return result;
    } catch (error) {
      logger.error('Error scraping main market', error);
      return null;
    }
  }

  private parseOdds(text: string): number | null {
    if (!text || text === '-' || text === 'SP') return null;

    // Handle fractional odds (e.g., "5/2")
    if (text.includes('/')) {
      const [num, den] = text.split('/').map(Number);
      if (num && den) {
        return parseFloat((num / den + 1).toFixed(2));
      }
    }

    // Handle decimal odds
    const decimal = parseFloat(text);
    if (!isNaN(decimal) && decimal > 1) {
      return decimal;
    }

    return null;
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return parseFloat(((sorted[mid - 1]! + sorted[mid]!) / 2).toFixed(2));
    }

    return sorted[mid]!;
  }
}
