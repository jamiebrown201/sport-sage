import type { Browser, Page } from 'playwright-core';
import { logger } from '../utils/logger';
import { OddsPortalScraper, type OddsPortalEvent } from './oddsportal/odds';
import { OddscheckerScraper, type ScrapedOdds } from './oddschecker/odds';
import { launchBrowser, createPage } from '../utils/browser';
import { getProxyManager } from '../utils/proxy-manager';

export interface OddsSource {
  name: string;
  priority: number;
  needsProxy: boolean;
  scraper: (page: Page) => OddsScraper;
}

interface OddsScraper {
  getUpcomingOdds?(sport: string): Promise<OddsPortalEvent[]>;
  scrapeEventsWithOdds?(sport: string): Promise<Map<string, ScrapedOdds>>;
}

export interface NormalizedOdds {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  source: string;
  bookmakerCount?: number;
}

/**
 * Multi-source odds orchestrator
 *
 * Priority based on testing (2024-12-21):
 * - OddsPortal: WORKS without proxy (187 items) ✅ FREE ODDS!
 * - Oddschecker: BLOCKED (needs proxy)
 *
 * Strategy: Use FREE OddsPortal first, only use Oddschecker with proxy as fallback.
 */
export class OddsOrchestrator {
  private sources: OddsSource[] = [
    // === FREE WORKING SOURCES ===
    {
      name: 'oddsportal',
      priority: 1, // BEST - works without proxy, FREE odds!
      needsProxy: false,
      scraper: (page) => new OddsPortalScraper(page),
    },
    // === BLOCKED SOURCES (try with proxy if available) ===
    {
      name: 'oddschecker',
      priority: 2, // Blocked without proxy
      needsProxy: true,
      scraper: (page) => new OddscheckerScraper(page),
    },
  ];

  private stats = {
    oddsportal: { success: 0, fail: 0, events: 0 },
    oddschecker: { success: 0, fail: 0, events: 0 },
  };

  async getOddsForSport(
    browser: Browser,
    sport: string
  ): Promise<{
    odds: NormalizedOdds[];
    sourcesUsed: string[];
    stats: typeof this.stats;
  }> {
    const allOdds: NormalizedOdds[] = [];
    const sourcesUsed: string[] = [];

    // Sort sources by priority
    const sortedSources = [...this.sources].sort((a, b) => a.priority - b.priority);

    for (const source of sortedSources) {
      // Skip proxy-required sources if no proxy configured
      const proxyManager = getProxyManager();
      if (source.needsProxy && !proxyManager.isEnabled()) {
        logger.debug(`Skipping ${source.name} - needs proxy but none configured`);
        continue;
      }

      try {
        logger.info(`Trying ${source.name} for ${sport} odds...`);

        const page = await createPage(browser);

        try {
          const scraper = source.scraper(page);

          if (source.name === 'oddsportal' && 'getUpcomingOdds' in scraper) {
            const events = await (scraper as OddsPortalScraper).getUpcomingOdds(sport);

            if (events.length > 0) {
              this.stats.oddsportal.success++;
              this.stats.oddsportal.events += events.length;
              sourcesUsed.push(source.name);

              for (const event of events) {
                if (event.odds) {
                  allOdds.push({
                    homeTeam: event.homeTeam,
                    awayTeam: event.awayTeam,
                    competition: event.competition,
                    homeWin: event.odds.homeWin,
                    draw: event.odds.draw,
                    awayWin: event.odds.awayWin,
                    source: 'oddsportal',
                    bookmakerCount: event.odds.bookmakerCount,
                  });
                }
              }

              logger.info(`OddsPortal: Got ${events.length} events with odds`);
            }
          } else if (source.name === 'oddschecker' && 'scrapeEventsWithOdds' in scraper) {
            const oddsMap = await (scraper as OddscheckerScraper).scrapeEventsWithOdds(sport);

            if (oddsMap.size > 0) {
              this.stats.oddschecker.success++;
              this.stats.oddschecker.events += oddsMap.size;
              sourcesUsed.push(source.name);

              for (const [eventName, odds] of oddsMap) {
                // Parse event name (usually "Team1 v Team2" or "Team1 vs Team2")
                const parts = eventName.split(/\s+v(?:s)?\s+/i);
                const homeTeam = parts[0]?.trim() || eventName;
                const awayTeam = parts[1]?.trim() || '';

                allOdds.push({
                  homeTeam,
                  awayTeam,
                  competition: 'Unknown',
                  homeWin: odds.homeWin,
                  draw: odds.draw,
                  awayWin: odds.awayWin,
                  source: 'oddschecker',
                });
              }

              logger.info(`Oddschecker: Got ${oddsMap.size} events with odds`);
            }
          }
        } finally {
          // Close page only - do NOT close context, it kills the browser in Lambda
          await page.close().catch(() => {});
        }

        // If we got enough odds from this source, we can stop
        if (allOdds.length >= 50) {
          logger.info(`Got ${allOdds.length} odds, sufficient coverage`);
          break;
        }
      } catch (error) {
        this.stats[source.name as keyof typeof this.stats].fail++;
        logger.warn(`${source.name} failed:`, {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return {
      odds: allOdds,
      sourcesUsed,
      stats: this.stats,
    };
  }

  /**
   * Get odds for multiple sports
   */
  async getAllSportsOdds(
    browser: Browser,
    sports: string[] = ['football', 'basketball', 'tennis']
  ): Promise<Map<string, NormalizedOdds[]>> {
    const result = new Map<string, NormalizedOdds[]>();

    for (const sport of sports) {
      const { odds } = await this.getOddsForSport(browser, sport);
      result.set(sport, odds);
    }

    return result;
  }

  /**
   * Log summary of source usage
   */
  logSummary(): void {
    logger.info('=== Odds Sources Summary ===');
    for (const [source, stats] of Object.entries(this.stats)) {
      const total = stats.success + stats.fail;
      if (total > 0) {
        const rate = Math.round((stats.success / total) * 100);
        logger.info(`${source}: ${stats.success}/${total} (${rate}% success), ${stats.events} events`);
      }
    }
  }
}

/**
 * Get odds using the tiered orchestrator
 *
 * This is the main function to use - it handles all the complexity of
 * trying OddsPortal first (FREE) and falling back to Oddschecker if needed.
 */
export async function getMultiSourceOdds(
  sport: string = 'football'
): Promise<NormalizedOdds[]> {
  const browser = await launchBrowser();

  try {
    const orchestrator = new OddsOrchestrator();
    const result = await orchestrator.getOddsForSport(browser, sport);

    logger.info(`Multi-source odds: ${result.odds.length} events found`);
    logger.info(`Sources used: ${result.sourcesUsed.join(', ') || 'none'}`);

    return result.odds;
  } finally {
    await browser.close();
  }
}
