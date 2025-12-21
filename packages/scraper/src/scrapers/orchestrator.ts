import type { Page } from 'playwright-core';
import { logger } from '../utils/logger';
import type { FixturesScraper, ScrapedFixture, ScraperResult } from './base';
import { FlashscoreFixturesScraper } from './flashscore/fixtures';
import { SofascoreFixturesScraper } from './sofascore/fixtures';

export interface OrchestratorConfig {
  /** Minimum fixtures expected per sport (triggers failover if below) */
  minFixturesThreshold: Record<string, number>;
  /** Whether to merge results from multiple sources */
  mergeResults: boolean;
  /** Maximum time to wait for a single scraper (ms) */
  scraperTimeout: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  minFixturesThreshold: {
    football: 20,
    basketball: 10,
    tennis: 3,
    darts: 1,
    cricket: 1,
  },
  mergeResults: false, // Use primary only unless it fails
  scraperTimeout: 120000, // 2 minutes per scraper
};

/**
 * Orchestrates multiple scrapers with automatic failover
 *
 * Strategy:
 * 1. Try primary scraper (Flashscore)
 * 2. If primary returns too few fixtures or fails, try backup (Sofascore)
 * 3. Optionally merge results from both sources
 */
export class ScraperOrchestrator {
  private scrapers: FixturesScraper[];
  private config: OrchestratorConfig;

  constructor(page: Page, config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize scrapers in priority order
    this.scrapers = [
      new FlashscoreFixturesScraper(page),
      new SofascoreFixturesScraper(page),
    ].sort((a, b) => a.priority - b.priority);

    logger.debug('Scraper orchestrator initialized', {
      scrapers: this.scrapers.map(s => s.source),
    });
  }

  /**
   * Get fixtures for a sport, with automatic failover
   */
  async getFixtures(sportSlug: string, days = 7): Promise<ScraperResult> {
    const startTime = Date.now();
    const results: ScraperResult[] = [];

    for (const scraper of this.scrapers) {
      if (!scraper.supportsSport(sportSlug)) {
        logger.debug(`Skipping ${scraper.source} - doesn't support ${sportSlug}`);
        continue;
      }

      const result = await this.runScraper(scraper, sportSlug, days);
      results.push(result);

      if (result.success) {
        const minThreshold = this.config.minFixturesThreshold[sportSlug] || 5;

        if (result.fixtures.length >= minThreshold) {
          // Primary succeeded with enough fixtures
          if (!this.config.mergeResults) {
            return result;
          }
        } else {
          logger.warn(`${scraper.source}: Only ${result.fixtures.length} fixtures for ${sportSlug} (min: ${minThreshold}), trying backup`);
        }
      } else {
        logger.warn(`${scraper.source} failed for ${sportSlug}: ${result.error}`);
      }
    }

    // If we're merging or all failed, combine results
    const mergedFixtures = this.mergeFixtures(results);

    return {
      fixtures: mergedFixtures,
      source: results.filter(r => r.success).map(r => r.source).join('+') || 'none',
      success: mergedFixtures.length > 0,
      duration: Date.now() - startTime,
      error: mergedFixtures.length === 0 ? 'All scrapers failed' : undefined,
    };
  }

  /**
   * Run a single scraper with timeout
   */
  private async runScraper(
    scraper: FixturesScraper,
    sportSlug: string,
    days: number
  ): Promise<ScraperResult> {
    const startTime = Date.now();

    try {
      const fixtures = await Promise.race([
        scraper.getUpcomingFixtures(sportSlug, days),
        this.timeout(this.config.scraperTimeout),
      ]);

      // Add source to fixtures if not present
      const fixturesWithSource = fixtures.map(f => ({
        ...f,
        source: f.source || scraper.source,
      }));

      return {
        fixtures: fixturesWithSource,
        source: scraper.source,
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        fixtures: [],
        source: scraper.source,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Merge fixtures from multiple sources, preferring primary source
   */
  private mergeFixtures(results: ScraperResult[]): ScrapedFixture[] {
    const fixtureMap = new Map<string, ScrapedFixture>();

    // Sort by priority (lower priority sources first, so higher priority overwrites)
    const sortedResults = [...results]
      .filter(r => r.success)
      .sort((a, b) => {
        const priorityA = this.scrapers.find(s => s.source === a.source)?.priority || 99;
        const priorityB = this.scrapers.find(s => s.source === b.source)?.priority || 99;
        return priorityB - priorityA; // Higher priority (lower number) comes last
      });

    for (const result of sortedResults) {
      for (const fixture of result.fixtures) {
        // Create a unique key based on teams and approximate time
        const key = this.createFixtureKey(fixture);
        fixtureMap.set(key, fixture);
      }
    }

    return Array.from(fixtureMap.values());
  }

  /**
   * Create a unique key for deduplication across sources
   */
  private createFixtureKey(fixture: ScrapedFixture): string {
    const homeNorm = this.normalizeTeamName(fixture.homeTeam);
    const awayNorm = this.normalizeTeamName(fixture.awayTeam);

    // Round time to nearest hour for matching
    const timeKey = Math.floor(fixture.startTime.getTime() / (60 * 60 * 1000));

    return `${fixture.sportSlug}_${homeNorm}_${awayNorm}_${timeKey}`;
  }

  /**
   * Normalize team name for comparison
   */
  private normalizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/^(fc|ac|as|ss|sc|sk|fk|nk)\s+/i, '')
      .replace(/\s+(fc|cf|sc|afc)$/i, '')
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15); // First 15 chars
  }

  /**
   * Create a timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Scraper timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Get all supported sports
   */
  getSupportedSports(): string[] {
    const sports = new Set<string>();
    for (const scraper of this.scrapers) {
      // Get sports from first scraper that has sportUrls
      if ('sportUrls' in scraper) {
        Object.keys((scraper as any).sportUrls).forEach(s => sports.add(s));
      }
    }
    return Array.from(sports);
  }
}
